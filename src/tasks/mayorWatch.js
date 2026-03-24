const hypixel = require('../api/hypixel');
const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const config = require('../config');

let lastMayor = null;
let intervalId = null;

function startMayorWatch(client) {
    console.log('🏛️ Mayor watch task started (5min interval)');
    checkMayor(client);
    intervalId = setInterval(() => checkMayor(client), 5 * 60 * 1000);
}

async function checkMayor(client) {
    try {
        const data = await hypixel.getElection();
        const mayor = data.mayor;
        if (!mayor) return;

        if (lastMayor === null) {
            lastMayor = mayor.name;
            return;
        }

        if (mayor.name !== lastMayor) {
            lastMayor = mayor.name;

            const configs = await GuildConfig.find({ alertChannelId: { $ne: null } });
            if (configs.length === 0) return;

            const perks = (mayor.perks || []).map(p => `• **${p.name}** — ${p.description}`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x4169E1)
                .setTitle('🏛️ New Mayor Elected!')
                .setDescription(`## ${mayor.name}\n\n### Perks\n${perks || 'No perks listed.'}`)
                .setTimestamp()
                .setFooter({ text: config.discord.footerText });

            for (const conf of configs) {
                try {
                    const channel = await client.channels.fetch(conf.alertChannelId);
                    if (channel) await channel.send({ embeds: [embed] });
                } catch (err) {
                    // Ignore sending errors (e.g., bot kicked, channel deleted)
                }
            }
        }
    } catch (err) {
        console.error('Mayor watch error:', err.message);
    }
}

function stopMayorWatch() {
    if (intervalId) clearInterval(intervalId);
}

module.exports = { startMayorWatch, stopMayorWatch };
