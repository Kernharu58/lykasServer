const Settings = require("../models/Settings");

// Fetch the settings (Creates default if it doesn't exist yet)
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({}); 
    }
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update the settings
const updateSettings = async (req, res) => {
  try {
    const { address, phone, email } = req.body;
    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({ address, phone, email });
    } else {
      settings.address = address !== undefined ? address : settings.address;
      settings.phone = phone !== undefined ? phone : settings.phone;
      settings.email = email !== undefined ? email : settings.email;
      await settings.save();
    }
    
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getSettings, updateSettings };