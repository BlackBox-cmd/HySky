const mongoose = require('mongoose');

const linkedAccountSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    minecraftUuid: { type: String, required: true },
    minecraftName: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LinkedAccount', linkedAccountSchema);
