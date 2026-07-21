const User = require("../models/User");
const Pet = require("../models/Pet");

// GET /api/duplicates/users — groups users sharing a phone number or gov't ID
// (email is already unique-indexed, so it can't duplicate).
const getDuplicateUsers = async (_req, res) => {
  try {
    const byPhone = await User.aggregate([
      { $match: { isDeleted: { $ne: true }, phone: { $nin: [null, ""] } } },
      { $group: { _id: "$phone", count: { $sum: 1 }, users: { $push: { id: "$_id", displayName: "$displayName", email: "$email" } } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    const byGovId = await User.aggregate([
      { $match: { isDeleted: { $ne: true }, governmentId: { $nin: [null, ""] } } },
      { $group: { _id: "$governmentId", count: { $sum: 1 }, users: { $push: { id: "$_id", displayName: "$displayName", email: "$email" } } } },
      { $match: { count: { $gt: 1 } } },
    ]).catch(() => []); // governmentId may not exist on every deployment's schema

    res.status(200).json({
      duplicatePhones: byPhone.map((g) => ({ phone: g._id, users: g.users })),
      duplicateGovernmentIds: byGovId.map((g) => ({ governmentId: g._id, users: g.users })),
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// GET /api/duplicates/pets — pets sharing the same name + species (likely re-entries)
const getDuplicatePets = async (_req, res) => {
  try {
    const groups = await Pet.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { name: { $toLower: "$name" }, species: "$species" },
          count: { $sum: 1 },
          pets: { $push: { id: "$_id", name: "$name", species: "$species", status: "$status" } },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);
    res.status(200).json({ duplicatePets: groups.map((g) => ({ name: g._id.name, species: g._id.species, pets: g.pets })) });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = { getDuplicateUsers, getDuplicatePets };
