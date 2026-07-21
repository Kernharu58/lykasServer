// Scheduled reminder jobs (High Priority #6 "Scheduled Jobs").
//
// Each job is a small async function that returns { itemsProcessed, message }.
// runJob() wraps execution with timing + a ScheduledJobLog entry so the
// admin panel can show job history and let staff trigger a job on demand,
// on top of the cron schedule in src/cronJob.js.

const ScheduledJobLog = require("../models/ScheduledJobLog");
const Application = require("../models/Application");
const Interview = require("../models/Interview");
const HomeVisit = require("../models/HomeVisit");
const UserDocument = require("../models/UserDocument");
const InKindDonation = require("../models/InKindDonation");
const MedicalRecord = require("../models/MedicalRecord");
const User = require("../models/User");
const { notify, notifyMany } = require("../utils/notificationHelper");

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const getStaffIds = async () => {
  const staff = await User.find({ role: { $in: ["admin", "staff", "super_admin"] } }).select("_id");
  return staff.map((s) => s._id);
};

// ── Adoption reminders: applications sitting in "adoption_scheduled" too long ──
const adoptionReminders = async () => {
  const stuck = await Application.find({
    stage: "adoption_scheduled",
    updatedAt: { $lte: daysFromNow(-3) },
  }).populate("pet", "name");

  const staffIds = await getStaffIds();
  for (const app of stuck) {
    await notifyMany(staffIds, {
      type: "ADOPTION_REMINDER",
      title: "Adoption pending completion",
      message: `The adoption for ${app.pet?.name || "a pet"} has been scheduled for 3+ days without being marked complete.`,
      refModel: "Application",
      refId: app._id,
    });
  }
  return { itemsProcessed: stuck.length, message: `${stuck.length} stalled adoption(s) flagged` };
};

// ── Vaccination reminders: MedicalRecord.nextDueDate within 7 days ─────────────
const vaccinationReminders = async () => {
  const due = await MedicalRecord.find({
    nextDueDate: { $gte: new Date(), $lte: daysFromNow(7) },
  }).populate("pet", "name");

  const staffIds = await getStaffIds();
  for (const record of due) {
    await notifyMany(staffIds, {
      type: "VACCINATION_DUE",
      title: "Vaccination due soon",
      message: `${record.pet?.name || "A pet"}'s ${record.vaccineName} vaccination is due on ${record.nextDueDate.toDateString()}.`,
      refModel: "Pet",
      refId: record.pet?._id,
    });
  }
  return { itemsProcessed: due.length, message: `${due.length} upcoming vaccination(s) flagged` };
};

// ── Interview reminders: scheduled for tomorrow ────────────────────────────────
const interviewReminders = async () => {
  const tomorrowStart = new Date(daysFromNow(1).setHours(0, 0, 0, 0));
  const tomorrowEnd = new Date(daysFromNow(1).setHours(23, 59, 59, 999));
  const interviews = await Interview.find({
    status: "scheduled",
    scheduledDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
  }).populate("pet", "name");

  for (const interview of interviews) {
    await notify({
      recipient: interview.applicant,
      type: "INTERVIEW_REMINDER",
      title: "Interview tomorrow",
      message: `Reminder: your interview for ${interview.pet?.name || "your application"} is scheduled for tomorrow.`,
      refModel: "Application",
      refId: interview.application,
    });
  }
  return { itemsProcessed: interviews.length, message: `${interviews.length} interview reminder(s) sent` };
};

// ── Home visit reminders: scheduled for tomorrow ───────────────────────────────
const homeVisitReminders = async () => {
  const tomorrowStart = new Date(daysFromNow(1).setHours(0, 0, 0, 0));
  const tomorrowEnd = new Date(daysFromNow(1).setHours(23, 59, 59, 999));
  const visits = await HomeVisit.find({
    status: "scheduled",
    scheduledDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
  }).populate("pet", "name");

  for (const visit of visits) {
    await notify({
      recipient: visit.applicant,
      type: "HOME_VISIT_REMINDER",
      title: "Home visit tomorrow",
      message: `Reminder: your home visit for ${visit.pet?.name || "your application"} is scheduled for tomorrow.`,
      refModel: "Application",
      refId: visit.application,
    });
  }
  return { itemsProcessed: visits.length, message: `${visits.length} home visit reminder(s) sent` };
};

// ── Expired documents: gov't ID docs expiring within 30 days ───────────────────
const expiredDocuments = async () => {
  const expiring = await UserDocument.find({
    expiresAt: { $ne: null, $gte: new Date(), $lte: daysFromNow(30) },
    status: { $ne: "rejected" },
  });

  for (const doc of expiring) {
    await notify({
      recipient: doc.user,
      type: "DOCUMENT_EXPIRING",
      title: "Document expiring soon",
      message: `Your uploaded ${doc.label || doc.type} expires on ${doc.expiresAt.toDateString()}. Please upload a renewed copy.`,
      refModel: "Application",
      refId: doc.application,
    });
  }
  return { itemsProcessed: expiring.length, message: `${expiring.length} expiring document(s) flagged` };
};

// ── Donation reminders: pending donations awaiting staff confirmation ──────────
const donationReminders = async () => {
  const stale = await InKindDonation.find({
    status: "pending",
    isDeleted: false,
    createdAt: { $lte: daysFromNow(-3) },
  });

  const staffIds = await getStaffIds();
  if (stale.length) {
    await notifyMany(staffIds, {
      type: "DONATION_REMINDER",
      title: "Donations awaiting confirmation",
      message: `${stale.length} in-kind donation(s) have been pending for 3+ days without confirmation.`,
    });
  }
  return { itemsProcessed: stale.length, message: `${stale.length} stale donation(s) flagged` };
};

const JOBS = {
  adoption_reminders: { label: "Adoption Reminders", schedule: "Daily 08:00", run: adoptionReminders },
  vaccination_reminders: { label: "Vaccination Reminders", schedule: "Daily 08:00", run: vaccinationReminders },
  interview_reminders: { label: "Interview Reminders", schedule: "Daily 07:00", run: interviewReminders },
  home_visit_reminders: { label: "Home Visit Reminders", schedule: "Daily 07:00", run: homeVisitReminders },
  expired_documents: { label: "Expired Documents", schedule: "Daily 08:00", run: expiredDocuments },
  donation_reminders: { label: "Donation Reminders", schedule: "Daily 09:00", run: donationReminders },
};

// Wraps a job with timing + a ScheduledJobLog entry. Used by both the cron
// schedule (src/cronJob.js) and the manual "Run now" admin endpoint.
const runJob = async (jobKey, { triggeredBy = "cron", triggeredByUser = null } = {}) => {
  const def = JOBS[jobKey];
  if (!def) throw new Error(`Unknown job: ${jobKey}`);

  const startedAt = new Date();
  try {
    const { itemsProcessed, message } = await def.run();
    const finishedAt = new Date();
    return ScheduledJobLog.create({
      jobKey,
      label: def.label,
      status: "success",
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      itemsProcessed,
      message,
      triggeredBy,
      triggeredByUser,
    });
  } catch (error) {
    const finishedAt = new Date();
    return ScheduledJobLog.create({
      jobKey,
      label: def.label,
      status: "failed",
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      itemsProcessed: 0,
      error: error.message,
      triggeredBy,
      triggeredByUser,
    });
  }
};

module.exports = { JOBS, runJob };
