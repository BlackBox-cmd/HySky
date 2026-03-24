const hypixel = require('../api/hypixel');
const config = require('../config');
const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { commaNumber, titleCase } = require('../utils/formatNumber');

let knownSaleIds = new Set();
let intervalId = null;

function startFireSaleWatch(client) {
    console.log('🔥 Fire sale watch task started (2min interval)');
    checkFireSales(client);
    intervalId = setInterval(() => checkFireSales(client), 2 * 60 * 1000);
}

async function checkFireSales(client) {
    try {
        const sales = await hypixel.getFireSales();
        if (!sales || sales.length === 0) return;

        const now = Date.now();
        const active = sales.filter(s => s.start <= now && s.end >= now);
        if (active.length === 0) return;

        const configs = await GuildConfig.find({ alertChannelId: { $ne: null } });
        if (configs.length === 0) return;

        for (const sale of active) {
            const saleKey = `${sale.item_id}-${sale.start}`;
            if (knownSaleIds.has(saleKey)) continue;
            knownSaleIds.add(saleKey);

            const embed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle('🔥 Fire Sale Started!')
                .setDescription(
                    `**${titleCase(sale.item_id || 'Unknown')}**\n\n` +
                    `**Price:** 🪙 ${commaNumber(sale.price)}\n` +
                    `**Available:** ${commaNumber(sale.amount)}\n` +
                    `**Ends:** <t:${Math.floor(sale.end / 1000)}:R>`
                )
                .setTimestamp()
                .setFooter({ text: config.discord.footerText });

            for (const conf of configs) {
                try {
                    const channel = await client.channels.fetch(conf.alertChannelId);
                    if (channel) await channel.send({ embeds: [embed] });
                } catch (err) {
                    // Ignore missing permissions or channels
                }
            }
        }
    } catch (err) {
        console.error('Fire sale watch error:', err.message);
    }
}

function stopFireSaleWatch() {
    if (intervalId) clearInterval(intervalId);
}

module.exports = { startFireSaleWatch, stopFireSaleWatch };
