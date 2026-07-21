const jwt = require("jsonwebtoken");
const FeatureFlag = require("../models/FeatureFlag");
const User = require("../models/User");

// When the "maintenance_mode" flag is enabled, every request is rejected
// with 503 except: admins/staff (so they can keep working to fix things)
// and the health check / auth routes (so admins can still sign in).
//
// This middleware runs globally, ahead of the per-route `protect` middleware,
// so it can't rely on req.user being populated yet — it decodes the token
// itself for a quick role check when maintenance mode is on.
const ALWAYS_ALLOWED_PATHS = ["/health", "/api/auth", "/api/system"];

const maintenanceMode = async (req, res, next) => {
  try {
    if (ALWAYS_ALLOWED_PATHS.some((p) => req.path.startsWith(p))) return next();

    const flag = await FeatureFlag.findOne({ key: "maintenance_mode" });
    if (!flag?.enabled) return next();

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("role");
        if (user && ["admin", "staff", "super_admin"].includes(user.role)) return next();
      } catch (e) {
        // invalid/expired token — fall through to the maintenance response
      }
    }

    return res.status(503).json({
      message: "Lykas is currently undergoing scheduled maintenance. Please check back shortly.",
      maintenance: true,
    });
  } catch (error) {
    // If the flag lookup itself fails, fail open rather than taking the whole app down.
    return next();
  }
};

module.exports = maintenanceMode;
