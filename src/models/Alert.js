const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true },
    type: {
        type: String,
        enum: ['bazaar_above', 'bazaar_below'],
        required: true,
    },
    itemId: { type: String, required: true },
    targetPrice: { type: Number, required: true },
    triggered: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

// Index for efficient polling
alertSchema.index({ triggered: 1, type: 1 });

module.exports = mongoose.model('Alert', alertSchema);
