const ScheduledJobLog = require("../models/ScheduledJobLog");
const { JOBS, runJob } = require("../jobs/reminderJobs");

// GET /api/scheduled-jobs  — catalog of jobs + their last run
const getJobs = async (_req, res) => {
  try {
    const jobs = await Promise.all(
      Object.entries(JOBS).map(async ([jobKey, def]) => {
        const lastRun = await ScheduledJobLog.findOne({ jobKey }).sort({ createdAt: -1 });
        return { jobKey, label: def.label, schedule: def.schedule, lastRun };
      }),
    );
    res.status(200).json({ jobs });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/scheduled-jobs/:jobKey/history
const getJobHistory = async (req, res) => {
  try {
    const logs = await ScheduledJobLog.find({ jobKey: req.params.jobKey })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ logs });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/scheduled-jobs/:jobKey/run — manual trigger from the admin panel
const triggerJob = async (req, res) => {
  try {
    const { jobKey } = req.params;
    if (!JOBS[jobKey]) {
      return res.status(404).json({ message: `Unknown job: ${jobKey}` });
    }
    const log = await runJob(jobKey, { triggeredBy: "manual", triggeredByUser: req.user._id });
    res.status(200).json({ message: "Job executed", log });
  } catch (error) {
    res.status(500).json({ message: "Job failed", error: error.message });
  }
};

module.exports = { getJobs, getJobHistory, triggerJob };
