const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  address: { type: String, default: "Happy Paws Shelter, Pampanga" },
  phone: { type: String, default: "+63 939 268 3311" },
  email: { type: String, default: "info@carepaws.org" }
});

module.exports = mongoose.model("Settings", settingsSchema);