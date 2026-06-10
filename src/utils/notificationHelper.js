const Notification = require("../models/Notification");

/**
 * Create a notification for one or more recipients.
 *
 * Usage:
 *   await notify({ recipient: userId, type: "APPLICATION_APPROVED",
 *                  title: "Application Approved!", message: "Your application for Buddy was approved.",
 *                  refModel: "Application", refId: application._id });
 *
 *   await notifyMany([userId1, userId2], { type: "EVENT_REMINDER", title: "...", message: "..." });
 */
const notify = async ({ recipient, sender = null, type, title, message, refModel = null, refId = null }) => {
  try {
    await Notification.create({ recipient, sender, type, title, message, refModel, refId });
  } catch (err) {
    console.error("Notification create failed:", err.message);
  }
};

const notifyMany = async (recipients, { sender = null, type, title, message, refModel = null, refId = null }) => {
  try {
    const docs = recipients.map(recipient => ({
      recipient, sender, type, title, message, refModel, refId,
    }));
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("notifyMany failed:", err.message);
  }
};

module.exports = { notify, notifyMany };
