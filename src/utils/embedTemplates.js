const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('./constants');
const { getHeadUrl } = require('../api/mojang');
const config = require('../config');

const FOOTER_TEXT = config.discord.footerText;

/**
 * Create a styled SkyBlock embed.
 */
function skyblockEmbed(title, description = null) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.SKYBLOCK)
        .setTitle(title)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

    if (description) embed.setDescription(description);
    return embed;
}

/**
 * Create a player-specific embed with their head as thumbnail.
 */
function playerEmbed(title, playerName, uuid) {
    return skyblockEmbed(title)
        .setThumbnail(getHeadUrl(uuid))
        .setAuthor({ name: playerName, iconURL: getHeadUrl(uuid) });
}

/**
 * Create an error embed.
 */
function errorEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('❌ Error')
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
}

/**
 * Create a loading embed.
 */
function loadingEmbed(message = 'Fetching data...') {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setDescription(`⏳ ${message}`)
        .setFooter({ text: FOOTER_TEXT });
}

/**
 * Create a bazaar embed.
 */
function bazaarEmbed(title, description = null) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.BAZAAR)
        .setTitle(`💰 ${title}`)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

    if (description) embed.setDescription(description);
    return embed;
}

/**
 * Create an auction embed.
 */
function auctionEmbed(title, description = null) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.AUCTION)
        .setTitle(`🏷️ ${title}`)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

    if (description) embed.setDescription(description);
    return embed;
}

/**
 * Create a success embed.
 */
function successEmbed(message) {
    return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('✅ Success')
        .setDescription(message)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
}

module.exports = {
    skyblockEmbed,
    playerEmbed,
    errorEmbed,
    loadingEmbed,
    bazaarEmbed,
    auctionEmbed,
    successEmbed,
};
