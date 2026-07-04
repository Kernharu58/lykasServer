const Application      = require("../models/Application");
const Pet              = require("../models/Pet");
const User             = require("../models/User");
const Payment          = require("../models/Payment");
const Volunteer        = require("../models/Volunteer");
const { Foster }       = require("../models/Foster");
const MonitoringReport = require("../models/MonitoringReport");
const Interview        = require("../models/Interview");
const HomeVisit        = require("../models/HomeVisit");

// ─── Helper: get date range from query ───────────────────────────────────────
const getRange = (from, to) => {
  const f = from ? new Date(from) : new Date(0);
  const t = to   ? new Date(to)   : new Date();
  return { $gte: f, $lte: t };
};

// ═══════════════════════════════════════════════════════════
// ADOPTION REPORT
// GET /api/reports/adoptions?from=&to=
// ═══════════════════════════════════════════════════════════
const adoptionReport = async (req, res) => {
  try {
    const range = getRange(req.query.from, req.query.to);

    const [
      total, approved, rejected, pending,
      bySpecies, byMonth, avgProcessingDays,
    ] = await Promise.all([
      Application.countDocuments({ createdAt: range }),
      Application.countDocuments({ status: "approved", createdAt: range }),
      Application.countDocuments({ status: "rejected", createdAt: range }),
      Application.countDocuments({ status: "pending",  createdAt: range }),

      // Approved adoptions grouped by pet species
      Application.aggregate([
        { $match: { status: "approved", createdAt: range } },
        { $lookup: { from: "pets", localField: "pet", foreignField: "_id", as: "pet" } },
        { $unwind: "$pet" },
        { $group: { _id: "$pet.species", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Applications per month
      Application.aggregate([
        { $match: { createdAt: range } },
        { $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          total:    { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        }},
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // Average days from application to decision
      Application.aggregate([
        { $match: { status: { $in: ["approved","rejected"] }, reviewedAt: { $ne: null }, createdAt: range } },
        { $project: { days: { $divide: [{ $subtract: ["$reviewedAt", "$createdAt"] }, 86400000] } } },
        { $group: { _id: null, avg: { $avg: "$days" } } },
      ]),
    ]);

    res.status(200).json({
      summary: {
        total, approved, rejected, pending,
        approvalRate:     total > 0 ? Math.round((approved / total) * 100) : 0,
        avgProcessingDays: Math.round(avgProcessingDays[0]?.avg || 0),
      },
      bySpecies,
      byMonth,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// FINANCIAL REPORT
// GET /api/reports/financial?from=&to=
// ═══════════════════════════════════════════════════════════
const financialReport = async (req, res) => {
  try {
    const range = getRange(req.query.from, req.query.to);

    const [totalDonations, byMonth, byMethod, recentPayments] = await Promise.all([
      Payment.aggregate([
        { $match: { type: "donation", status: "paid", paidAt: range } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "paid", paidAt: range } },
        { $group: {
          _id: { year: { $year: "$paidAt" }, month: { $month: "$paidAt" }, type: "$type" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        }},
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: "paid", paidAt: range, paymentMethod: { $ne: null } } },
        { $group: { _id: "$paymentMethod", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Payment.find({ status: "paid", paidAt: range })
        .populate("paidBy", "displayName email")
        .sort({ paidAt: -1 })
        .limit(10),
    ]);

    res.status(200).json({
      summary: {
        totalDonations:    (totalDonations[0]?.total    || 0) / 100,
        totalRevenue:      (totalDonations[0]?.total || 0) / 100,
        donationCount:     totalDonations[0]?.count  || 0,
      },
      byMonth,
      byMethod,
      recentPayments,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// VOLUNTEER REPORT
// GET /api/reports/volunteers?from=&to=
// ═══════════════════════════════════════════════════════════
const volunteerReport = async (req, res) => {
  try {
    const range = getRange(req.query.from, req.query.to);

    const [total, approved, pending, topVolunteers, byMonth] = await Promise.all([
      Volunteer.countDocuments({}),
      Volunteer.countDocuments({ status: "approved" }),
      Volunteer.countDocuments({ status: "pending" }),

      // Top volunteers by hours
      Volunteer.find({ status: "approved" })
        .populate("user", "displayName email profilePicture volunteerHours")
        .sort({ totalHours: -1 })
        .limit(10),

      // New volunteer registrations per month
      Volunteer.aggregate([
        { $match: { createdAt: range } },
        { $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          registered: { $sum: 1 },
          approved:   { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        }},
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    res.status(200).json({
      summary: { total, approved, pending },
      topVolunteers,
      byMonth,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// PET WELFARE REPORT
// GET /api/reports/welfare?from=&to=
// ═══════════════════════════════════════════════════════════
const welfareReport = async (req, res) => {
  try {
    const range = getRange(req.query.from, req.query.to);

    const [
      totalFosters, activeFosters, completedFosters,
      monitoringSubmitted, monitoringFlagged,
      interviewsPassed, interviewsFailed,
      homeVisitsPassed, homeVisitsFailed,
    ] = await Promise.all([
      Foster.countDocuments({ createdAt: range }),
      Foster.countDocuments({ status: "active" }),
      Foster.countDocuments({ status: "completed", createdAt: range }),
      MonitoringReport.countDocuments({ createdAt: range }),
      MonitoringReport.countDocuments({ status: "flagged", createdAt: range }),
      Interview.countDocuments({ result: "passed", createdAt: range }),
      Interview.countDocuments({ result: "failed",  createdAt: range }),
      HomeVisit.countDocuments({ result: "passed", createdAt: range }),
      HomeVisit.countDocuments({ result: "failed",  createdAt: range }),
    ]);

    res.status(200).json({
      foster:     { total: totalFosters, active: activeFosters, completed: completedFosters },
      monitoring: { submitted: monitoringSubmitted, flagged: monitoringFlagged },
      interviews: { passed: interviewsPassed, failed: interviewsFailed },
      homeVisits: { passed: homeVisitsPassed, failed: homeVisitsFailed },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { adoptionReport, financialReport, volunteerReport, welfareReport };
