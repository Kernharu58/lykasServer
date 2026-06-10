const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Optional: who/what triggered this notification
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        // Application flow
        "APPLICATION_SUBMITTED",
        "APPLICATION_APPROVED",
        "APPLICATION_REJECTED",
        "APPLICATION_CANCELLED",
        // Interview
        "INTERVIEW_SCHEDULED",
        "INTERVIEW_RESCHEDULED",
        "INTERVIEW_CANCELLED",
        "INTERVIEW_RESULT",
        // Home visit
        "HOME_VISIT_SCHEDULED",
        "HOME_VISIT_RESCHEDULED",
        "HOME_VISIT_CANCELLED",
        "HOME_VISIT_RESULT",
        // Foster
        "FOSTER_STARTED",
        "FOSTER_ENDED",
        "FOSTER_REPORT_DUE",
        "FOSTER_REPORT_REVIEWED",
        // Monitoring
        "MONITORING_REPORT_DUE",
        "MONITORING_REPORT_REVIEWED",
        "MONITORING_REPORT_FLAGGED",
        // Events
        "EVENT_CREATED",
        "EVENT_REMINDER",
        "EVENT_CANCELLED",
        // Medical / shelter
        "VACCINATION_DUE",
        "HEALTH_CHECK_FLAGGED",
        // Payments
        "PAYMENT_RECEIVED",
        "PAYMENT_FAILED",
        // General
        "GENERAL",
      ],
      required: true,
      index: true,
    },
    title:   { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Optional deep-link reference
    refModel: {
      type: String,
      enum: ["Application","Interview","HomeVisit","Foster","MonitoringReport",
             "Event","Pet","Payment", null],
      default: null,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    isRead:   { type: Boolean, default: false, index: true },
    readAt:   { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index for fast "get my unread notifications"
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
