const hypixel = require('../api/hypixel');
const config = require('../config');
const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

let knownNewsIds = new Set();
let intervalId = null;

function startNewsFeed(client) {
    console.log('📰 News feed task started (10min interval)');
    loadExisting();
    intervalId = setInterval(() => checkNews(client), 10 * 60 * 1000);
}

async function loadExisting() {
    try {
        const items = await hypixel.getNews();
        for (const item of items) {
            knownNewsIds.add(item.link || item.title);
        }
    } catch (err) {
        console.error('News feed initial load error:', err.message);
    }
}

async function checkNews(client) {
    try {
        const items = await hypixel.getNews();
        if (!items || items.length === 0) return;

        const configs = await GuildConfig.find({ alertChannelId: { $ne: null } });
        if (configs.length === 0) return;

        for (const item of items) {
            const newsId = item.link || item.title;
            if (knownNewsIds.has(newsId)) continue;
            knownNewsIds.add(newsId);

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`📰 ${item.title || 'SkyBlock News'}`)
                .setDescription(item.text || 'No content.')
                .setURL(item.link || null)
                .setTimestamp()
                .setFooter({ text: config.discord.footerText });

            for (const conf of configs) {
                try {
                    const channel = await client.channels.fetch(conf.alertChannelId);
                    if (channel) await channel.send({ embeds: [embed] });
                } catch (err) {
                    // Ignore sending errors
                }
            }
        }
    } catch (err) {
        console.error('News feed error:', err.message);
    }
}

function stopNewsFeed() {
    if (intervalId) clearInterval(intervalId);
}

module.exports = { startNewsFeed, stopNewsFeed };
