const mongoose = require('mongoose');

const userConfigSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    jacobSubscriptions: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('UserConfig', userConfigSchema);
