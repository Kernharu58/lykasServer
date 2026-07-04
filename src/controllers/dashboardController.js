const Pet              = require("../models/Pet");
const Application      = require("../models/Application");
const User             = require("../models/User");
const Appointment      = require("../models/Appointment");
const Volunteer        = require("../models/Volunteer");
const { Foster }       = require("../models/Foster");
const { HealthCheck }  = require("../models/ShelterCare");
const { Vaccination }  = require("../models/MedicalRecord");
const MonitoringReport = require("../models/MonitoringReport");
const Interview        = require("../models/Interview");
const HomeVisit        = require("../models/HomeVisit");
const Payment          = require("../models/Payment");
const EmergencyReport  = require("../models/EmergencyReport");
const FosterReport     = require("../models/Foster").FosterReport || require("../models/Foster").Foster; // fallback

// ─── ADMIN: Full dashboard summary ───────────────────────────────────────────
// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      // Pets
      totalPets, availablePets, adoptedPets, fosterPets,

      // Applications
      pendingApplications, totalApplications, approvedThisMonth,

      // Users
      totalUsers, newUsersThisMonth,

      // Volunteers
      pendingVolunteers, activeVolunteers,

      // Appointments
      todayAppointments, upcomingAppointments,

      // Interviews & Home Visits
      scheduledInterviews, scheduledHomeVisits,

      // Foster
      activeFosters,

      // Payments
      totalDonations,

      // Alerts
      flaggedHealthChecks, flaggedMonitoring,
      openEmergencyReports, overdueVaccinations,

    ] = await Promise.all([
      Pet.countDocuments({ isArchived: { $ne: true } }),
      Pet.countDocuments({ status: "Available", isArchived: { $ne: true } }),
      Pet.countDocuments({ status: "Adopted" }),
      Pet.countDocuments({ status: "Foster" }),

      Application.countDocuments({ status: "pending" }),
      Application.countDocuments({}),
      Application.countDocuments({ status: "approved", reviewedAt: { $gte: thisMonthStart } }),

      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", createdAt: { $gte: thisMonthStart } }),

      Volunteer.countDocuments({ status: "pending" }),
      Volunteer.countDocuments({ status: "approved" }),

      Appointment.countDocuments({ date: { $gte: today, $lt: new Date(today.getTime() + 86400000) } }),
      Appointment.countDocuments({ date: { $gte: now } }),

      Interview.countDocuments({ status: "scheduled" }),
      HomeVisit.countDocuments({ status: { $in: ["scheduled", "rescheduled"] } }),

      Foster.countDocuments({ status: "active" }),

      Payment.aggregate([{ $match: { type: "donation",      status: "paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),

      HealthCheck.countDocuments({ flagged: true, createdAt: { $gte: last30 } }),
      MonitoringReport.countDocuments({ status: "flagged" }),
      EmergencyReport.countDocuments({ status: { $in: ["open", "in_progress"] } }),
      Vaccination.countDocuments({ nextDueDate: { $lte: now } }),
    ]);

    // Recent activity (last 5 of each)
    const [recentApplications, recentPayments, recentEmergencyReports] = await Promise.all([
      Application.find()
        .populate("applicant", "displayName email profilePicture")
        .populate("pet", "name imageUrl")
        .sort({ createdAt: -1 })
        .limit(5),
      Payment.find({ status: "paid" })
        .populate("paidBy", "displayName email")
        .sort({ paidAt: -1 })
        .limit(5),
      EmergencyReport.find({ status: { $in: ["open", "in_progress"] } })
        .populate("submittedBy", "displayName email")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    res.status(200).json({
      pets: { total: totalPets, available: availablePets, adopted: adoptedPets, foster: fosterPets },
      applications: { pending: pendingApplications, total: totalApplications, approvedThisMonth },
      users: { total: totalUsers, newThisMonth: newUsersThisMonth },
      volunteers: { pending: pendingVolunteers, active: activeVolunteers },
      appointments: { today: todayAppointments, upcoming: upcomingAppointments },
      pipeline: { scheduledInterviews, scheduledHomeVisits, activeFosters },
      financials: {
        totalDonations:    (totalDonations[0]?.total    || 0) / 100,
      },
      alerts: {
        flaggedHealthChecks,
        flaggedMonitoring,
        openEmergencyReports,
        overdueVaccinations,
        pendingApplications,
        pendingVolunteers,
      },
      recent: { applications: recentApplications, payments: recentPayments, emergencyReports: recentEmergencyReports },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getDashboard };
