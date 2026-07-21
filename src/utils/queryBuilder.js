/**
 * Builds a Mongoose filter + sort + pagination options object from
 * standardized query-string params, so every "list" endpoint (pets,
 * applications, volunteers, donations, users...) supports the same
 * search/sort/filter/export UX without repeating this logic everywhere.
 *
 * Query params supported:
 *   q          - free-text search across `searchFields`
 *   sortBy     - field name to sort by (default "createdAt")
 *   sortOrder  - "asc" | "desc" (default "desc")
 *   page, limit
 *   includeDeleted - "true" to include soft-deleted records (admin only)
 *   any key in `filterFields` - exact-match filter, e.g. status=pending
 */
const buildListQuery = (query, { searchFields = [], filterFields = [], defaultSort = "-createdAt", softDelete = false } = {}) => {
  const { q, sortBy, sortOrder, page = 1, limit = 20, includeDeleted } = query;
  const filter = {};

  if (softDelete && includeDeleted !== "true") {
    filter.isDeleted = { $ne: true };
  }

  if (q && searchFields.length) {
    filter.$or = searchFields.map((field) => ({ [field]: { $regex: q, $options: "i" } }));
  }

  filterFields.forEach((field) => {
    const val = query[field];
    if (val !== undefined && val !== "" && val !== "All") {
      filter[field] = val;
    }
  });

  // Date range filter, e.g. ?from=2026-01-01&to=2026-02-01 (applies to createdAt)
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  let sort = defaultSort;
  if (sortBy) {
    sort = `${sortOrder === "asc" ? "" : "-"}${sortBy}`;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  return { filter, sort, skip, limit: limitNum, page: pageNum };
};

const buildPagination = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit) || 1,
});

module.exports = { buildListQuery, buildPagination };
