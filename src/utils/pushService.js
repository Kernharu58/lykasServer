// Sends push notifications via Expo's push API. No API key is required for
// basic sending — Expo's service handles delivery to APNs/FCM behind the
// scenes. See https://docs.expo.dev/push-notifications/sending-notifications/
//
// NOTE: this could not be exercised against a real device token in
// development (this environment's network egress doesn't reach exp.host) —
// the request shape below matches Expo's documented API exactly, but
// please send yourself one real test notification after deploying before
// relying on this.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const isExpoPushToken = (token) =>
  typeof token === "string" &&
  (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));

// Returns { success: boolean, staleToken?: boolean } — `staleToken` tells
// the caller (notificationHelper.js) to clear User.pushToken, since Expo
// reporting "DeviceNotRegistered" means the app was uninstalled or the
// token rotated and this exact value will never work again.
const sendPushNotification = async ({ pushToken, title, message, data = {} }) => {
  if (!isExpoPushToken(pushToken)) {
    return { success: false, reason: "invalid_token" };
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ to: pushToken, title, body: message, data, sound: "default" }),
    });

    const result = await res.json();
    const ticket = result?.data;

    if (ticket?.status === "error") {
      const isStale = ticket.details?.error === "DeviceNotRegistered";
      console.warn("[push] Expo rejected the notification:", ticket.message);
      return { success: false, reason: ticket.details?.error || "expo_error", staleToken: isStale };
    }

    return { success: true };
  } catch (err) {
    console.error("[push] Send failed:", err.message);
    return { success: false, reason: "network_error" };
  }
};

module.exports = { sendPushNotification, isExpoPushToken };
