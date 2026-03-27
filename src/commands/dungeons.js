const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, progressBar, xpToLevel, titleCase } = require('../utils/formatNumber');
const { DUNGEON_CLASSES, SKILL_XP_TABLES, COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dungeons')
        .setDescription('View Catacombs and dungeon class stats')
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

            const dungeons = member.dungeons;
            if (!dungeons) {
                return interaction.editReply({
                    embeds: [errorEmbed(`${ign} has no dungeon data.`)]
                });
            }

            const catacombs = dungeons.dungeon_types?.catacombs || {};
            const masterCata = dungeons.dungeon_types?.master_catacombs || {};

            // ── State ────────────────────────────────────────────
            let currentView = 'OVERVIEW'; // OVERVIEW, FLOORS, MASTER

            // ── Catacombs Level (shared) ─────────────────────────
            const cataXP = catacombs.experience || 0;
            const cataInfo = xpToLevel(cataXP, SKILL_XP_TABLES.dungeon);
            const cataBar = progressBar(cataInfo.progress, 1, 12);

            const classEmojis = { healer: '💚', mage: '💜', berserk: '❤️', archer: '💛', tank: '💙' };

            const selectedClass = dungeons.selected_dungeon_class
                ? titleCase(dungeons.selected_dungeon_class)
                : 'None';

            // ── Overview page ────────────────────────────────────
            const buildOverview = () => {
                const classLines = [];
                for (const cls of DUNGEON_CLASSES) {
                    const clsData = dungeons.player_classes?.[cls] || {};
                    const clsXP = clsData.experience || 0;
                    const clsInfo = xpToLevel(clsXP, SKILL_XP_TABLES.dungeon);
                    const emoji = classEmojis[cls] || '⚔️';
                    classLines.push(
                        `${emoji} **${titleCase(cls)}** Lvl **${clsInfo.level}** — ${formatNumber(clsXP)} XP`
                    );
                }

                // Quick floor summary
                const completions = catacombs.tier_completions || {};
                let totalRuns = 0;
                for (let f = 0; f <= 7; f++) totalRuns += (completions[f] || 0);

                const masterComp = masterCata.tier_completions || {};
                let totalMaster = 0;
                for (let f = 1; f <= 7; f++) totalMaster += (masterComp[f] || 0);

                return playerEmbed(`🏰 Dungeons — ${ign}`, ign, uuid)
                    .setColor(COLORS.DUNGEON)
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                        `**Selected Class:** ${selectedClass}\n\n` +
                        `**⚔️ Catacombs Level ${cataInfo.level}**\n` +
                        `${cataBar} ${(cataInfo.progress * 100).toFixed(1)}%\n` +
                        `${formatNumber(cataXP)} Total XP\n`
                    )
                    .addFields(
                        {
                            name: '🛡️ Class Levels',
                            value: classLines.join('\n') || 'No data',
                            inline: false,
                        },
                        {
                            name: '📊 Quick Stats',
                            value:
                                `**Total Catacombs Runs:** ${commaNumber(totalRuns)}\n` +
                                `**Total Master Runs:** ${commaNumber(totalMaster)}`,
                            inline: false,
                        }
                    );
            };

            // ── Floor Details page ───────────────────────────────
            const buildFloors = () => {
                const completions = catacombs.tier_completions || {};
                const bestScores = catacombs.best_score || {};
                const fastestS = catacombs.fastest_time_s || {};
                const fastestSPlus = catacombs.fastest_time_s_plus || {};
                const mobsKilled = catacombs.mobs_killed || {};
                const mostDmgBerserk = catacombs.most_damage_berserk || {};
                const mostDmgMage = catacombs.most_damage_mage || {};
                const mostHealing = catacombs.most_healing || {};

                const lines = [];
                for (let f = 0; f <= 7; f++) {
                    const comp = completions[f] || 0;
                    const name = f === 0 ? '🚪 Entrance' : `⚔️ Floor ${f}`;

                    const parts = [`**${name}** — ${commaNumber(comp)} runs`];

                    if (bestScores[f]) parts.push(`  🏆 Best Score: **${bestScores[f]}**`);

                    if (fastestSPlus[f]) {
                        parts.push(`  ⏱️ Fastest S+: **${formatTime(fastestSPlus[f])}**`);
                    } else if (fastestS[f]) {
                        parts.push(`  ⏱️ Fastest S: **${formatTime(fastestS[f])}**`);
                    }

                    if (mobsKilled[f]) parts.push(`  💀 Mobs Killed: **${commaNumber(mobsKilled[f])}**`);
                    if (mostHealing[f]) parts.push(`  💚 Most Healing: **${commaNumber(Math.floor(mostHealing[f]))}**`);

                    lines.push(parts.join('\n'));
                }

                return playerEmbed(`🗺️ Floor Details — ${ign}`, ign, uuid)
                    .setColor(COLORS.DUNGEON)
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                        `**Catacombs Level:** ${cataInfo.level}\n\n` +
                        lines.join('\n\n')
                    );
            };

            // ── Master Mode page ─────────────────────────────────
            const buildMaster = () => {
                const completions = masterCata.tier_completions || {};
                const bestScores = masterCata.best_score || {};
                const fastestS = masterCata.fastest_time_s || {};
                const fastestSPlus = masterCata.fastest_time_s_plus || {};

                const lines = [];
                let hasAny = false;
                for (let f = 1; f <= 7; f++) {
                    const comp = completions[f] || 0;
                    if (comp > 0) hasAny = true;

                    const parts = [`**💀 M${f}** — ${commaNumber(comp)} runs`];

                    if (bestScores[f]) parts.push(`  🏆 Best Score: **${bestScores[f]}**`);

                    if (fastestSPlus[f]) {
                        parts.push(`  ⏱️ Fastest S+: **${formatTime(fastestSPlus[f])}**`);
                    } else if (fastestS[f]) {
                        parts.push(`  ⏱️ Fastest S: **${formatTime(fastestS[f])}**`);
                    }

                    lines.push(parts.join('\n'));
                }

                const desc = hasAny
                    ? lines.join('\n\n')
                    : '*No Master Mode runs recorded.*';

                return playerEmbed(`💀 Master Mode — ${ign}`, ign, uuid)
                    .setColor(COLORS.DUNGEON)
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                        `**Catacombs Level:** ${cataInfo.level}\n\n` +
                        desc
                    );
            };

            // ── Embed / Row builders ─────────────────────────────
            const getEmbed = () => {
                if (currentView === 'FLOORS') return buildFloors();
                if (currentView === 'MASTER') return buildMaster();
                return buildOverview();
            };

            const getRows = () => {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('dg_overview')
                        .setLabel('Overview')
                        .setStyle(currentView === 'OVERVIEW' ? ButtonStyle.Success : ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('dg_floors')
                        .setLabel('Floors')
                        .setStyle(currentView === 'FLOORS' ? ButtonStyle.Success : ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('dg_master')
                        .setLabel('Master Mode')
                        .setStyle(currentView === 'MASTER' ? ButtonStyle.Success : ButtonStyle.Primary),
                );
                return [row];
            };

            // ── Send ─────────────────────────────────────────────
            const message = await interaction.editReply({ embeds: [getEmbed()], components: getRows() });

            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These controls are not for you!', flags: 64 });
                }

                if (i.customId === 'dg_overview') currentView = 'OVERVIEW';
                else if (i.customId === 'dg_floors') currentView = 'FLOORS';
                else if (i.customId === 'dg_master') currentView = 'MASTER';

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

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
