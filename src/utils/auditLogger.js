const AuditLog = require("../models/AuditLog");

// Fields we never want sitting in an audit trail even if someone passes
// a full document into `before`/`after`.
const SENSITIVE_FIELDS = ["password", "resetPasswordToken", "emailVerificationToken"];

const sanitize = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const clone = { ...obj };
  SENSITIVE_FIELDS.forEach((field) => delete clone[field]);
  return clone;
};

// Diffs `before` vs `after` down to just the fields that changed, so the
// audit record stays small and readable instead of storing two full copies
// of every document on every save.
const diffFields = (before, after) => {
  if (!before || !after) return { before: sanitize(before), after: sanitize(after) };
  const b = sanitize(before);
  const a = sanitize(after);
  const changedBefore = {};
  const changedAfter = {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  keys.forEach((key) => {
    const bv = b[key];
    const av = a[key];
    const same = JSON.stringify(bv) === JSON.stringify(av);
    if (!same) {
      changedBefore[key] = bv;
      changedAfter[key] = av;
    }
  });
  return { before: changedBefore, after: changedAfter };
};

/**
 * Generic per-record audit trail entry.
 * @param {Object} opts
 * @param {String} opts.actor        - acting user's _id
 * @param {String} opts.action       - e.g. "PET_UPDATE", "USER_SOFT_DELETE"
 * @param {String} opts.entityType   - e.g. "Pet", "User", "Volunteer", "Application"
 * @param {String} opts.entityId    - the record's _id
 * @param {Object} [opts.before]     - previous values (only changed keys are kept)
 * @param {Object} [opts.after]      - new values (only changed keys are kept)
 * @param {Object} [opts.req]        - Express req, used to capture IP/user-agent
 * @param {String} [opts.targetUser] - kept for backwards compatibility with the
 *                                     older user-centric AuditLog entries
 * @param {Object} [opts.metadata]   - free-form extra context
 */
const logChange = async ({ actor, action, entityType, entityId, before, after, req, targetUser, metadata }) => {
  try {
    if (!actor) return;
    const { before: previousValues, after: newValues } = diffFields(before, after);
    await AuditLog.create({
      actor,
      action,
      entityType,
      entityId,
      previousValues,
      newValues,
      targetUser,
      metadata,
      ipAddress: req?.ip || req?.headers?.["x-forwarded-for"] || null,
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};

// GET /api/audit-logs/record?entityType=Pet&entityId=...
const getRecordHistory = async (entityType, entityId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);
  const filter = { entityType, entityId };
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "displayName email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);
  return { logs, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } };
};

module.exports = { logChange, getRecordHistory };
