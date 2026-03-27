const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, progressBar } = require('../utils/formatNumber');
const { SLAYERS, COLORS } = require('../utils/constants');

const SLAYER_LEVELS = {
    zombie:   [0, 5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
    spider:   [0, 5, 25, 200, 1000, 5000, 20000, 100000, 400000, 1000000],
    wolf:     [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    enderman: [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    blaze:    [0, 10, 30, 250, 1500, 5000, 20000, 100000, 400000, 1000000],
    vampire:  [0, 20, 75, 240, 840, 2400, 6000],
};

// Approximate costs per tier (coins)
const TIER_COSTS = {
    zombie:   [100, 2000, 10000, 50000, 100000],
    spider:   [100, 2000, 10000, 50000, 100000],
    wolf:     [100, 2000, 10000, 50000, 100000],
    enderman: [100, 2000, 10000, 50000, 100000],
    blaze:    [100, 2000, 10000, 50000, 100000],
    vampire:  [100, 2000, 10000, 50000, 100000],
};

function getSlayerLevel(type, xp) {
    const table = SLAYER_LEVELS[type] || [];
    let level = 0;
    for (let i = 1; i < table.length; i++) {
        if (table[i] > 0 && xp >= table[i]) level = i;
        else break;
    }
    const nextXP = table[level + 1] || 0;
    const currXP = table[level] || 0;
    const progress = nextXP > 0 ? (xp - currXP) / (nextXP - currXP) : 1;
    return { level, xp, nextXP: nextXP - currXP, currentXP: xp - currXP, progress: Math.min(progress, 1) };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slayer')
        .setDescription('View slayer boss stats')
        .addStringOption(opt =>
            opt.setName('player').setDescription('Minecraft username').setRequired(false))
        .addStringOption(opt =>
            opt.setName('profile').setDescription('Profile name').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const username = interaction.options.getString('player');
        const profileName = interaction.options.getString('profile');

        try {
            let uuid, ign;
            if (!username) {
                const link = await LinkedAccount.findOne({ discordId: interaction.user.id });
                if (!link) {
                    return interaction.editReply({ embeds: [errorEmbed('No linked account found. Please provide a Minecraft username or link your account using `/link`.')] });
                }
                uuid = link.minecraftUuid;
                ign = link.minecraftName;
            } else {
                const mojangData = await mojang.getUUID(username);
                uuid = mojangData.id;
                ign = mojangData.name;
            }

            const { profile, member } = await hypixel.getProfileMember(uuid, profileName);

            const slayerData = member.slayer?.slayer_bosses || member.slayer_bosses || {};
            const slayerKeys = Object.keys(SLAYERS);

            let currentView = 'OVERVIEW'; // OVERVIEW or a slayer key (e.g., 'zombie')

            // ── Overview builder ─────────────────────────────────
            const buildOverview = () => {
                let totalXP = 0;
                let totalCoinsSpent = 0;
                const lines = [];

                for (const [key, meta] of Object.entries(SLAYERS)) {
                    const slayer = slayerData[key] || {};
                    const xp = slayer.xp || 0;
                    totalXP += xp;

                    const info = getSlayerLevel(key, xp);
                    const bar = progressBar(info.progress, 1, 10);

                    // Count total kills
                    let totalKills = 0;
                    for (let t = 0; t <= 4; t++) {
                        const k = slayer[`boss_kills_tier_${t}`] || 0;
                        totalKills += k;
                        totalCoinsSpent += k * ((TIER_COSTS[key] || [])[t] || 0);
                    }

                    lines.push(
                        `${meta.emoji} **${meta.name}** — Level **${info.level}**\n` +
                        `${bar} ${commaNumber(xp)} XP | ${commaNumber(totalKills)} kills`
                    );
                }

                return playerEmbed(`🗡️ Slayers — ${ign}`, ign, uuid)
                    .setColor(COLORS.SKYBLOCK)
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                        `**Total Slayer XP:** ${commaNumber(totalXP)}\n` +
                        `**Est. Coins Spent:** ${formatNumber(totalCoinsSpent)}\n\n` +
                        lines.join('\n\n')
                    );
            };

            // ── Per-slayer detail builder ─────────────────────────
            const buildDetail = (key) => {
                const meta = SLAYERS[key];
                const slayer = slayerData[key] || {};
                const xp = slayer.xp || 0;
                const info = getSlayerLevel(key, xp);
                const bar = progressBar(info.progress, 1, 15);

                // Kill tiers
                const maxTier = key === 'vampire' ? 4 : 4;
                const killLines = [];
                let totalKills = 0;
                let totalCoins = 0;
                for (let t = 0; t <= maxTier; t++) {
                    const k = slayer[`boss_kills_tier_${t}`] || 0;
                    totalKills += k;
                    const cost = (TIER_COSTS[key] || [])[t] || 0;
                    totalCoins += k * cost;
                    killLines.push(`**T${t + 1}:** ${commaNumber(k)} kills — 🪙 ${formatNumber(k * cost)} spent`);
                }

                // Progress info
                let progressLine = '';
                if (!info.progress || info.progress >= 1) {
                    progressLine = '**MAX LEVEL** 🎉';
                } else {
                    const needed = (SLAYER_LEVELS[key]?.[info.level + 1] || 0) - xp;
                    progressLine = `${commaNumber(needed > 0 ? needed : 0)} XP to Level ${info.level + 1}`;
                }

                return playerEmbed(`${meta.emoji} ${meta.name} — ${ign}`, ign, uuid)
                    .setColor(parseInt(meta.color.replace('#', ''), 16))
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n\n` +
                        `**Level ${info.level}**\n` +
                        `${bar} ${(info.progress * 100).toFixed(1)}%\n` +
                        `${commaNumber(xp)} Total XP\n` +
                        `${progressLine}\n\n` +
                        `**🗡️ Boss Kills** (Total: ${commaNumber(totalKills)})\n` +
                        killLines.join('\n') + '\n\n' +
                        `**💰 Total Est. Coins Spent:** ${formatNumber(totalCoins)}`
                    );
            };

            // ── Embed / Row builders ─────────────────────────────
            const getEmbed = () => {
                if (currentView === 'OVERVIEW') return buildOverview();
                return buildDetail(currentView);
            };

            const getRows = () => {
                const components = [];

                // Overview + one button per slayer
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('sl_overview')
                        .setLabel('Overview')
                        .setStyle(currentView === 'OVERVIEW' ? ButtonStyle.Success : ButtonStyle.Primary),
                    ...slayerKeys.slice(0, 4).map(key => {
                        const meta = SLAYERS[key];
                        return new ButtonBuilder()
                            .setCustomId(`sl_${key}`)
                            .setLabel(meta.name.split(' ')[0])
                            .setEmoji(meta.emoji)
                            .setStyle(currentView === key ? ButtonStyle.Success : ButtonStyle.Secondary);
                    })
                );
                components.push(row1);

                // Second row for remaining slayers (blaze, vampire)
                if (slayerKeys.length > 4) {
                    const row2 = new ActionRowBuilder().addComponents(
                        ...slayerKeys.slice(4).map(key => {
                            const meta = SLAYERS[key];
                            return new ButtonBuilder()
                                .setCustomId(`sl_${key}`)
                                .setLabel(meta.name.split(' ')[0])
                                .setEmoji(meta.emoji)
                                .setStyle(currentView === key ? ButtonStyle.Success : ButtonStyle.Secondary);
                        })
                    );
                    components.push(row2);
                }

                return components;
            };

            // ── Send ─────────────────────────────────────────────
            const message = await interaction.editReply({ embeds: [getEmbed()], components: getRows() });

            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These controls are not for you!', flags: 64 });
                }

                if (i.customId === 'sl_overview') {
                    currentView = 'OVERVIEW';
                } else if (i.customId.startsWith('sl_')) {
                    currentView = i.customId.replace('sl_', '');
                }

                await i.update({ embeds: [getEmbed()], components: getRows() });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });

        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
