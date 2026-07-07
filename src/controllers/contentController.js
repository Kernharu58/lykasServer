const ContentItem = require("../models/ContentItem");
const AuditLog = require("../models/AuditLog");

const logAction = async ({ actor, action, metadata }) => {
  try {
    await AuditLog.create({ actor, action, metadata });
  } catch (e) {
    /* silent */
  }
};

const slugify = (str) =>
  str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ─── PUBLIC/USER: Get published content by type ───────────────────────────────
// GET /api/content/public?type=faq
const getPublicContent = async (req, res) => {
  try {
    const { type, category } = req.query;
    const filter = { isPublished: true };
    if (type) filter.type = type;
    if (category) filter.category = category;

    const items = await ContentItem.find(filter).sort({ category: 1, order: 1, createdAt: 1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── PUBLIC/USER: Get single published page by slug ───────────────────────────
// GET /api/content/public/slug/:slug
const getPublicBySlug = async (req, res) => {
  try {
    const item = await ContentItem.findOne({ slug: req.params.slug, isPublished: true });
    if (!item) return res.status(404).json({ message: "Not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get all content (published + drafts) ──────────────────────────────
// GET /api/content?type=faq
const getAllContent = async (req, res) => {
  try {
    const { type, category } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;

    const items = await ContentItem.find(filter)
      .populate("lastEditedBy", "displayName")
      .sort({ type: 1, category: 1, order: 1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Get single item ─────────────────────────────────────────────────────
// GET /api/content/:id
const getContentById = async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id).populate("lastEditedBy", "displayName");
    if (!item) return res.status(404).json({ message: "Content not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Create content item ────────────────────────────────────────────────
// POST /api/content
// { type, title, body, category, order, isPublished, slug }
const createContent = async (req, res) => {
  try {
    const { type, title, body, category, order, isPublished, slug } = req.body;
    if (!type || !title || !body) {
      return res.status(400).json({ message: "Type, title, and body are required" });
    }

    const item = await ContentItem.create({
      type,
      title,
      body,
      category: category || "General",
      order: order || 0,
      isPublished: isPublished !== undefined ? isPublished : true,
      slug: (type === "page" || type === "policy") ? slugify(slug || title) : null,
      lastEditedBy: req.user._id,
    });

    await logAction({ actor: req.user._id, action: "CONTENT_CREATED", metadata: { contentId: item._id, type, title } });
    res.status(201).json({ message: "Content created", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Update content item ─────────────────────────────────────────────────
// PUT /api/content/:id
const updateContent = async (req, res) => {
  try {
    const item = await ContentItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Content not found" });

    const { title, body, category, order, isPublished, slug } = req.body;
    if (title !== undefined) item.title = title;
    if (body !== undefined) item.body = body;
    if (category !== undefined) item.category = category;
    if (order !== undefined) item.order = order;
    if (isPublished !== undefined) item.isPublished = isPublished;
    if (slug !== undefined && (item.type === "page" || item.type === "policy")) {
      item.slug = slugify(slug);
    }

    item.version += 1;
    item.lastEditedBy = req.user._id;
    await item.save();

    await logAction({ actor: req.user._id, action: "CONTENT_UPDATED", metadata: { contentId: item._id } });
    res.status(200).json({ message: "Content updated", item });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// ─── ADMIN: Delete content item ─────────────────────────────────────────────────
// DELETE /api/content/:id
const deleteContent = async (req, res) => {
  try {
    const item = await ContentItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Content not found" });

    await logAction({ actor: req.user._id, action: "CONTENT_DELETED", metadata: { contentId: item._id, title: item.title } });
    res.status(200).json({ message: "Content deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  getPublicContent,
  getPublicBySlug,
  getAllContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
};
