const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const { notify } = require("../utils/notificationHelper");

const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_BASE   = "https://api.paymongo.com/v1";

const logAction = async ({ actor, action, metadata }) => {
  try { await AuditLog.create({ actor, action, metadata }); } catch (e) { /* silent */ }
};

// ─── Helper: call PayMongo API ─────────────────────────────────────────────
const paymongoRequest = async (method, path, body = null) => {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Basic ${Buffer.from(PAYMONGO_SECRET + ":").toString("base64")}`,
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${PAYMONGO_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errors?.[0]?.detail || "PayMongo error");
  return data;
};

// ═══════════════════════════════════════════════════════════
// CREATE CHECKOUT LINK (adoption fee or donation)
// ═══════════════════════════════════════════════════════════

// POST /api/payments/create-checkout
// { type: "adoption_fee"|"donation", amount, description, refModel, refId, successUrl, cancelUrl }
const createCheckout = async (req, res) => {
  try {
    const { type, amount, description, refModel, refId, successUrl, cancelUrl } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // Amount in centavos (PayMongo standard — multiply PHP by 100)
    const amountInCentavos = Math.round(Number(amount) * 100);

    // Create PayMongo checkout session
    const pmData = await paymongoRequest("POST", "/checkout_sessions", {
      data: {
        attributes: {
          billing: { name: req.user.displayName, email: req.user.email },
          line_items: [{
            currency:    "PHP",
            amount:      amountInCentavos,
            name:        description || (type === "donation" ? "Donation to Lykas Shelter" : "Adoption Fee"),
            quantity:    1,
          }],
          payment_method_types: ["gcash", "card", "paymaya", "grab_pay"],
          success_url: successUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url:  cancelUrl  || `${process.env.FRONTEND_URL}/payment/cancel`,
          description: description || "",
          metadata: {
            userId:   req.user._id.toString(),
            type,
            refModel: refModel || "",
            refId:    refId    ? refId.toString() : "",
          },
        },
      },
    });

    const session    = pmData.data;
    const checkoutUrl = session.attributes.checkout_url;

    // Save pending payment record
    const payment = await Payment.create({
      paidBy:              req.user._id,
      type,
      amount:              amountInCentavos,
      currency:            "PHP",
      description:         description || "",
      refModel:            refModel || null,
      refId:               refId    || null,
      paymongoPaymentId:   session.id,
      paymongoCheckoutUrl: checkoutUrl,
      paymongoStatus:      "awaiting_payment",
      status:              "pending",
    });

    res.status(201).json({
      message:      "Checkout created",
      checkoutUrl,
      paymentId:    payment._id,
      paymongoId:   session.id,
    });
  } catch (error) {
    res.status(500).json({ message: "Payment Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// PAYMONGO WEBHOOK
// ═══════════════════════════════════════════════════════════

// POST /api/payments/webhook  (public — no auth, PayMongo calls this)
const handleWebhook = async (req, res) => {
  try {
    // ── Signature verification (Shichi §4: always verify before parsing) ──
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers["paymongo-signature"];
      if (!signature) {
        return res.status(401).json({ message: "Missing webhook signature" });
      }
      // PayMongo signature format: "t=<timestamp>,te=<hash>,li=<hash>"
      const parts = Object.fromEntries(signature.split(",").map((p) => p.split("=")));
      const timestamp = parts.t;
      const toSign = `${timestamp}.${JSON.stringify(req.body)}`;
      const expectedHash = require("crypto")
        .createHmac("sha256", webhookSecret)
        .update(toSign)
        .digest("hex");
      if (parts.te !== expectedHash && parts.li !== expectedHash) {
        return res.status(401).json({ message: "Invalid webhook signature" });
      }
    }

    const event = req.body;
    const eventType = event?.data?.attributes?.type;
    const resource  = event?.data?.attributes?.data;

    if (!eventType || !resource) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    if (eventType === "checkout_session.payment.paid") {
      const sessionId = resource.id;
      const metadata  = resource.attributes?.metadata || {};
      const pmStatus  = resource.attributes?.payment_method_used || null;

      const payment = await Payment.findOne({ paymongoPaymentId: sessionId });
      if (!payment) return res.status(404).json({ message: "Payment record not found" });

      payment.status         = "paid";
      payment.paymongoStatus = "paid";
      payment.paymentMethod  = pmStatus;
      payment.paidAt         = new Date();
      await payment.save();

      // Notify the payer
      await notify({
        recipient: payment.paidBy,
        type:      "PAYMENT_RECEIVED",
        title:     "Payment Confirmed ✅",
        message:   `Your ${payment.type === "donation" ? "donation" : "adoption fee"} of ₱${(payment.amount / 100).toFixed(2)} was received successfully.`,
        refModel:  "Payment",
        refId:     payment._id,
      });

      await logAction({
        actor:    payment.paidBy,
        action:   "PAYMENT_COMPLETED",
        metadata: { paymentId: payment._id, type: payment.type, amount: payment.amount },
      });
    }

    if (eventType === "checkout_session.payment.failed") {
      const sessionId = resource.id;
      const payment   = await Payment.findOne({ paymongoPaymentId: sessionId });
      if (payment) {
        payment.status         = "failed";
        payment.paymongoStatus = "failed";
        await payment.save();

        await notify({
          recipient: payment.paidBy,
          type:      "PAYMENT_FAILED",
          title:     "Payment Failed ❌",
          message:   "Your payment could not be processed. Please try again.",
          refModel:  "Payment",
          refId:     payment._id,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).json({ message: "Webhook Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// USER: Get my payment history
// ═══════════════════════════════════════════════════════════

// GET /api/payments/my?type=donation&page=1&limit=20
const getMyPayments = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = { paidBy: req.user._id };
    if (type   && ["adoption_fee","donation"].includes(type))       filter.type   = type;
    if (status && ["pending","paid","failed","refunded"].includes(status)) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      payments,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/payments/my/:id
const getMyPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, paidBy: req.user._id });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// ADMIN: Payment management
// ═══════════════════════════════════════════════════════════

// GET /api/payments?type=donation&status=paid&page=1&limit=20
const getAllPayments = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type   && ["adoption_fee","donation"].includes(type))       filter.type   = type;
    if (status && ["pending","paid","failed","refunded"].includes(status)) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("paidBy", "displayName email profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filter),
    ]);

    res.status(200).json({
      payments,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/payments/:id  (admin)
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("paidBy", "displayName email profilePicture");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/payments/summary  (admin dashboard totals)
const getPaymentSummary = async (req, res) => {
  try {
    const [totalDonations, totalAdoptionFees, pending, failed] = await Promise.all([
      Payment.aggregate([
        { $match: { type: "donation", status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { type: "adoption_fee", status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ status: "pending" }),
      Payment.countDocuments({ status: "failed" }),
    ]);

    res.status(200).json({
      totalDonations:    (totalDonations[0]?.total    || 0) / 100,
      totalAdoptionFees: (totalAdoptionFees[0]?.total || 0) / 100,
      pendingPayments:   pending,
      failedPayments:    failed,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/payments/:id/refund  (admin marks as refunded — manual process)
const markRefunded = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("paidBy", "displayName email");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status !== "paid") {
      return res.status(400).json({ message: "Only paid payments can be refunded" });
    }

    payment.status = "refunded";
    payment.notes  = req.body.notes || "";
    await payment.save();

    await notify({
      recipient: payment.paidBy._id,
      type:      "PAYMENT_RECEIVED",
      title:     "Refund Processed",
      message:   `Your payment of ₱${(payment.amount / 100).toFixed(2)} has been refunded.`,
      refModel:  "Payment",
      refId:     payment._id,
    });

    await logAction({
      actor:    req.user._id,
      action:   "PAYMENT_REFUNDED",
      metadata: { paymentId: payment._id, amount: payment.amount, notes: req.body.notes },
    });

    res.status(200).json({ message: "Payment marked as refunded", payment });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  createCheckout,
  handleWebhook,
  getMyPayments,
  getMyPaymentById,
  getAllPayments,
  getPaymentById,
  getPaymentSummary,
  markRefunded,
};
