const User             = require("../models/User");
const Application      = require("../models/Application");
const { Foster }       = require("../models/Foster");
const MonitoringReport = require("../models/MonitoringReport");
const Interview        = require("../models/Interview");
const HomeVisit        = require("../models/HomeVisit");
const RiskAssessment   = require("../models/RiskAssessment");
const Payment          = require("../models/Payment");
const Pet              = require("../models/Pet");

// ─── Helper: compute compliance score ────────────────────────────────────────
// Based on monitoring reports submitted vs expected (1 per month for 12 months)
const calcComplianceScore = (monitoringReports, adoptedDate) => {
  if (!adoptedDate) return null;
  const monthsElapsed = Math.min(
    Math.floor((Date.now() - new Date(adoptedDate).getTime()) / (30 * 24 * 60 * 60 * 1000)),
    12
  );
  if (monthsElapsed === 0) return 100;
  const expected = monthsElapsed;
  const submitted = monitoringReports.length;
  return Math.round(Math.min((submitted / expected) * 100, 100));
};

// ─── ADMIN: Get full adopter profile ─────────────────────────────────────────
// GET /api/adopter-profile/:userId
const getAdopterProfile = async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId).select("-password -refreshTokens");
    if (!user) return res.status(404).json({ message: "User not found" });

    // All applications this user has made
    const applications = await Application.find({ applicant: userId })
      .populate("pet", "name species breed imageUrl status")
      .populate("reviewedBy", "displayName email")
      .sort({ createdAt: -1 });

    // Adopted pets
    const adoptedPets = await Pet.find({ owner: userId, status: "Adopted" })
      .select("name species breed imageUrl updatedAt");

    // Foster history
    const fosterHistory = await Foster.find({ fosterer: userId })
      .populate("pet", "name species breed imageUrl")
      .sort({ startDate: -1 });

    // Interview results
    const interviews = await Interview.find({ applicant: userId })
      .populate("pet", "name imageUrl")
      .sort({ scheduledDate: -1 });

    // Home visit results
    const homeVisits = await HomeVisit.find({ applicant: userId })
      .populate("pet", "name imageUrl")
      .sort({ scheduledDate: -1 });

    // Risk assessments
    const riskAssessments = await RiskAssessment.find({ applicant: userId })
      .populate("pet", "name imageUrl")
      .populate("assessedBy", "displayName")
      .sort({ createdAt: -1 });

    // Monitoring reports submitted
    const monitoringReports = await MonitoringReport.find({ submittedBy: userId })
      .populate("pet", "name imageUrl")
      .sort({ reportDate: -1 });

    // Payment history
    const payments = await Payment.find({ paidBy: userId, status: "paid" })
      .sort({ paidAt: -1 });

    // Compliance score — based on most recent adoption date
    const latestAdoption = applications.find(a => a.status === "approved");
    const complianceScore = calcComplianceScore(
      monitoringReports,
      latestAdoption?.reviewedAt
    );

    // Risk level from latest assessment
    const latestRisk = riskAssessments[0];

    // Summary flags
    const hasFailedInterview  = interviews.some(i  => i.result  === "failed");
    const hasFailedHomeVisit  = homeVisits.some(hv => hv.result === "failed");
    const hasFlaggedReports   = monitoringReports.some(r => r.status === "flagged");
    const totalRejections     = applications.filter(a => a.status === "rejected").length;

    res.status(200).json({
      user,
      summary: {
        totalApplications:   applications.length,
        approvedApplications: applications.filter(a => a.status === "approved").length,
        rejectedApplications: totalRejections,
        totalAdoptedPets:     adoptedPets.length,
        totalFosters:         fosterHistory.length,
        complianceScore,
        riskLevel:            latestRisk?.riskLevel || "N/A",
        riskScore:            latestRisk?.totalScore || null,
        hasFailedInterview,
        hasFailedHomeVisit,
        hasFlaggedReports,
      },
      applications,
      adoptedPets,
      fosterHistory,
      interviews,
      homeVisits,
      riskAssessments,
      monitoringReports,
      payments,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: List all adopters (users who have at least one application) ───────
// GET /api/adopter-profile?page=1&limit=20&riskLevel=High
const getAllAdopterProfiles = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Get unique applicant IDs
    const applicantIds = await Application.distinct("applicant");

    const [users, total] = await Promise.all([
      User.find({ _id: { $in: applicantIds } })
        .select("displayName email profilePicture createdAt volunteerHours status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments({ _id: { $in: applicantIds } }),
    ]);

    // Attach quick stats per user
    const profiles = await Promise.all(users.map(async (u) => {
      const [appCount, adoptedCount, latestRisk, flaggedReports] = await Promise.all([
        Application.countDocuments({ applicant: u._id }),
        Pet.countDocuments({ owner: u._id, status: "Adopted" }),
        RiskAssessment.findOne({ applicant: u._id }).sort({ createdAt: -1 }).select("riskLevel totalScore"),
        MonitoringReport.countDocuments({ submittedBy: u._id, status: "flagged" }),
      ]);
      return {
        ...u.toObject(),
        totalApplications: appCount,
        totalAdoptedPets:  adoptedCount,
        riskLevel:         latestRisk?.riskLevel || "N/A",
        riskScore:         latestRisk?.totalScore || null,
        flaggedReports,
      };
    }));

    res.status(200).json({
      profiles,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getAdopterProfile, getAllAdopterProfiles };
