const Pet = require("../models/Pet");
const User = require("../models/User");
const Application = require("../models/Application");
const Payment = require("../models/Payment");
const Volunteer = require("../models/Volunteer");
const Event = require("../models/Event");
const EmergencyReport = require("../models/EmergencyReport");
const Feedback = require("../models/Feedback");
const InventoryItem = require("../models/InventoryItem");
const Shelter = require("../models/Shelter");

// Analytics gives a single, cross-cutting "bird's eye view" dashboard.
// (Deep-dive, exportable breakdowns per topic live in /api/reports.)

// ─── Overview: top-line KPIs across the whole system ──────────────────────────
// GET /api/analytics/overview
const getOverview = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalPets, availablePets, adoptedPets,
      totalUsers, newUsersThisMonth,
      pendingApplications, approvedThisMonth,
      revenueAgg, revenueLastMonthAgg,
      activeVolunteers, upcomingEvents,
      openEmergencies, newFeedback,
      lowStockCount, sheltersAgg,
    ] = await Promise.all([
      Pet.countDocuments({}),
      Pet.countDocuments({ status: "Available" }),
      Pet.countDocuments({ status: "Adopted" }),

      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", createdAt: { $gte: startOfMonth } }),

      Application.countDocuments({ status: "pending" }),
      Application.countDocuments({ status: "approved", reviewedAt: { $gte: startOfMonth } }),

      Payment.aggregate([
        { $match: { status: "paid", createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { status: "paid", createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Volunteer.countDocuments({ status: "active" }),
      Event.countDocuments({ date: { $gte: now } }),

      EmergencyReport.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Feedback.countDocuments({ status: "new" }),

      InventoryItem.find({}, "quantity minThreshold").then(
        (items) => items.filter((i) => i.quantity <= i.minThreshold).length
      ),
      Shelter.find({}, "capacity currentOccupancy"),
    ]);

    const revenueThisMonth = (revenueAgg[0]?.total || 0) / 100; // stored in centavos
    const revenueLastMonth = (revenueLastMonthAgg[0]?.total || 0) / 100;
    const revenueGrowth = revenueLastMonth > 0
      ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
      : (revenueThisMonth > 0 ? 100 : 0);

    const totalCapacity = sheltersAgg.reduce((s, x) => s + x.capacity, 0);
    const totalOccupancy = sheltersAgg.reduce((s, x) => s + x.currentOccupancy, 0);

    res.status(200).json({
      pets: { total: totalPets, available: availablePets, adopted: adoptedPets },
      users: { total: totalUsers, newThisMonth: newUsersThisMonth },
      adoptions: { pending: pendingApplications, approvedThisMonth },
      revenue: {
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        growthPercent: revenueGrowth,
      },
      volunteers: { active: activeVolunteers },
      events: { upcoming: upcomingEvents },
      emergencies: { open: openEmergencies },
      feedback: { new: newFeedback },
      inventory: { lowStock: lowStockCount },
      shelters: {
        total: sheltersAgg.length,
        totalCapacity,
        totalOccupancy,
        utilizationRate: totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Growth trend: users, applications, revenue over last N months ───────────
// GET /api/analytics/trends?months=6
const getTrends = async (req, res) => {
  try {
    const months = Math.min(Number(req.query.months) || 6, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [userTrend, applicationTrend, revenueTrend] = await Promise.all([
      User.aggregate([
        { $match: { role: "user", createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
      Application.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
      Payment.aggregate([
        { $match: { status: "paid", createdAt: { $gte: since } } },
        { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } }, total: { $sum: "$amount" } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
    ]);

    res.status(200).json({
      users: userTrend.map((r) => ({ year: r._id.y, month: r._id.m, count: r.count })),
      applications: applicationTrend.map((r) => ({ year: r._id.y, month: r._id.m, count: r.count })),
      revenue: revenueTrend.map((r) => ({ year: r._id.y, month: r._id.m, total: r.total / 100 })),
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── Pet mix: species/status breakdown for pie/bar charts ────────────────────
// GET /api/analytics/pets-breakdown
const getPetsBreakdown = async (req, res) => {
  try {
    const [bySpecies, byStatus] = await Promise.all([
      Pet.aggregate([{ $group: { _id: "$species", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Pet.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    ]);
    res.status(200).json({
      bySpecies: bySpecies.map((r) => ({ label: r._id, count: r.count })),
      byStatus: byStatus.map((r) => ({ label: r._id, count: r.count })),
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getOverview, getTrends, getPetsBreakdown };
