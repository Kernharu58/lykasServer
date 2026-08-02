const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      // Extended from ["donation"] — the checkout flow also needs to charge
      // an adoption fee at the end of the approval pipeline (§6.4 step 3)
      // and an event fee for paid events. refModel already supported
      // "Application"/"Event" before this change; the type enum just hadn't
      // caught up to it.
      type: String,
      enum: ["donation", "adoption_fee", "event_fee"],
      required: true,
      index: true,
    },
    amount:   { type: Number, required: true },   // in PHP centavos (PayMongo standard)
    currency: { type: String, default: "PHP" },
    description: { type: String, trim: true },

    // Reference to what this payment is for
    refModel: {
      type: String,
      enum: ["Application", "Event", null],
      default: null,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // PayMongo fields
    paymongoPaymentId:   { type: String, default: null },  // pi_xxx or link_xxx
    paymongoCheckoutUrl: { type: String, default: null },  // redirect URL
    paymongoStatus:      { type: String, default: null },  // awaiting_payment, paid, failed

    // Payment method used (filled after webhook)
    paymentMethod: {
      type: String,
      enum: ["gcash", "card", "paymaya", "grab_pay", "dob", null],
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    paidAt:    { type: Date, default: null },
    receiptUrl:{ type: String, default: null },
    notes:     { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
