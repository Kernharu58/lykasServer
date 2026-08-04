const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendPushNotification } = require("./pushService");

/**
 * Create a notification for one or more recipients.
 *
 * Usage:
 *   await notify({ recipient: userId, type: "APPLICATION_APPROVED",
 *                  title: "Application Approved!", message: "Your application for Buddy was approved.",
 *                  refModel: "Application", refId: application._id });
 *
 *   await notifyMany([userId1, userId2], { type: "EVENT_REMINDER", title: "...", message: "..." });
 *
 * Every call also attempts an Expo push send (in-app inbox + push, not just
 * one or the other) — previously this only ever wrote the in-app
 * Notification record; `expo-notifications` was declared as a dependency
 * but nothing on the backend ever actually sent through it. Push is
 * best-effort: a failed or skipped push never blocks the in-app
 * notification from being created.
 */
const maybeSendPush = async (recipientId, { type, title, message, refModel, refId }) => {
  try {
    const recipient = await User.findById(recipientId).select("notificationsEnabled pushToken");
    if (!recipient?.notificationsEnabled || !recipient?.pushToken) return;

    const result = await sendPushNotification({
      pushToken: recipient.pushToken,
      title,
      message,
      data: { type, refModel, refId: refId ? String(refId) : null },
    });

    // Expo reported this exact token as permanently dead (app uninstalled,
    // token rotated) — clear it so future notify() calls stop trying it.
    if (result.staleToken) {
      await User.updateOne({ _id: recipientId }, { pushToken: null });
    }
  } catch (err) {
    console.error("Push notification attempt failed:", err.message);
  }
};

const notify = async ({ recipient, sender = null, type, title, message, refModel = null, refId = null }) => {
  try {
    await Notification.create({ recipient, sender, type, title, message, refModel, refId });
  } catch (err) {
    console.error("Notification create failed:", err.message);
  }
  await maybeSendPush(recipient, { type, title, message, refModel, refId });
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
  // Best-effort, in parallel — one recipient's stale/missing token or a
  // slow push shouldn't delay the others.
  await Promise.all(
    recipients.map((recipientId) => maybeSendPush(recipientId, { type, title, message, refModel, refId })),
  );
};

module.exports = { notify, notifyMany };
