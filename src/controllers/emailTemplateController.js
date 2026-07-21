const EmailTemplate = require("../models/EmailTemplate");

const DEFAULT_TEMPLATES = [
  { key: "ADOPTION_APPROVAL", label: "Adoption Approval", subject: "Your adoption application was approved! 🎉",
    bodyHtml: "<p>Hi {{displayName}},</p><p>Great news — your application to adopt <strong>{{petName}}</strong> has been approved!</p>",
    variables: ["displayName", "petName"] },
  { key: "ADOPTION_REJECTION", label: "Adoption Rejection", subject: "Update on your adoption application",
    bodyHtml: "<p>Hi {{displayName}},</p><p>Thank you for applying to adopt {{petName}}. After review, we're unable to approve this application at this time.</p><p>Reason: {{reason}}</p>",
    variables: ["displayName", "petName", "reason"] },
  { key: "INTERVIEW_SCHEDULE", label: "Interview Scheduled", subject: "Your adoption interview is scheduled",
    bodyHtml: "<p>Hi {{displayName}},</p><p>Your interview for {{petName}} is scheduled on {{scheduledDate}} ({{method}}).</p>",
    variables: ["displayName", "petName", "scheduledDate", "method"] },
  { key: "HOME_VISIT_SCHEDULE", label: "Home Visit Scheduled", subject: "Your home visit is scheduled",
    bodyHtml: "<p>Hi {{displayName}},</p><p>A home visit for {{petName}} is scheduled on {{scheduledDate}} at {{address}}.</p>",
    variables: ["displayName", "petName", "scheduledDate", "address"] },
  { key: "PASSWORD_RESET", label: "Password Reset", subject: "Reset your Lykas password",
    bodyHtml: "<p>Hi {{displayName}},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href=\"{{resetLink}}\">Reset Password</a></p>",
    variables: ["displayName", "resetLink"] },
  { key: "EMAIL_VERIFICATION", label: "Email Verification", subject: "Verify Your Lykas Account Email",
    bodyHtml: "<p>Welcome to Lykas, {{displayName}}!</p><p><a href=\"{{verificationLink}}\">Verify Email Address</a></p>",
    variables: ["displayName", "verificationLink"] },
];

const ensureDefaultTemplates = async () => {
  for (const tpl of DEFAULT_TEMPLATES) {
    await EmailTemplate.updateOne({ key: tpl.key }, { $setOnInsert: tpl }, { upsert: true });
  }
};

// GET /api/email-templates
const getTemplates = async (_req, res) => {
  try {
    await ensureDefaultTemplates();
    const templates = await EmailTemplate.find({}).sort({ key: 1 });
    res.status(200).json({ templates });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/email-templates/:key
const getTemplateByKey = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({ key: req.params.key.toUpperCase() });
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.status(200).json({ template });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// PUT /api/email-templates/:key  { subject, bodyHtml, isActive }
const updateTemplate = async (req, res) => {
  try {
    const { subject, bodyHtml, isActive } = req.body;
    const template = await EmailTemplate.findOne({ key: req.params.key.toUpperCase() });
    if (!template) return res.status(404).json({ message: "Template not found" });

    if (subject !== undefined) template.subject = subject;
    if (bodyHtml !== undefined) template.bodyHtml = bodyHtml;
    if (isActive !== undefined) template.isActive = isActive;
    template.updatedBy = req.user._id;
    await template.save();

    res.status(200).json({ message: "Template updated", template });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// POST /api/email-templates/:key/preview  { sampleData: { displayName: "Jane", ... } }
const previewTemplate = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({ key: req.params.key.toUpperCase() });
    if (!template) return res.status(404).json({ message: "Template not found" });

    const sampleData = req.body?.sampleData || {};
    const render = (str) =>
      template.variables.reduce((acc, v) => acc.replaceAll(`{{${v}}}`, sampleData[v] ?? `[${v}]`), str);

    res.status(200).json({
      subject: render(template.subject),
      bodyHtml: render(template.bodyHtml),
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Used internally by other controllers/utils to render + send using a DB
// template if one exists, so admins can edit copy without a deploy.
const renderTemplate = async (key, data = {}) => {
  const template = await EmailTemplate.findOne({ key: key.toUpperCase(), isActive: true });
  if (!template) return null;
  const render = (str) => (template.variables || []).reduce((acc, v) => acc.replaceAll(`{{${v}}}`, data[v] ?? ""), str);
  return { subject: render(template.subject), bodyHtml: render(template.bodyHtml) };
};

module.exports = { getTemplates, getTemplateByKey, updateTemplate, previewTemplate, renderTemplate, ensureDefaultTemplates };
