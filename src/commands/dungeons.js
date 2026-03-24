const { SlashCommandBuilder } = require('discord.js');
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

            // Catacombs Level
            const cataXP = catacombs.experience || 0;
            const cataInfo = xpToLevel(cataXP, SKILL_XP_TABLES.dungeon);
            const cataBar = progressBar(cataInfo.progress, 1, 12);

            // Class Levels
            const classLines = [];
            const classEmojis = { healer: '💚', mage: '💜', berserk: '❤️', archer: '💛', tank: '💙' };

            for (const cls of DUNGEON_CLASSES) {
                const clsData = dungeons.player_classes?.[cls] || {};
                const clsXP = clsData.experience || 0;
                const clsInfo = xpToLevel(clsXP, SKILL_XP_TABLES.dungeon);
                const emoji = classEmojis[cls] || '⚔️';
                classLines.push(
                    `${emoji} **${titleCase(cls)}** Lvl **${clsInfo.level}** — ${formatNumber(clsXP)} XP`
                );
            }

            // Floor Completions
            const floorLines = [];
            const completions = catacombs.tier_completions || {};
            const bestScores = catacombs.best_score || {};
            const fastestS = catacombs.fastest_time_s || {};
            const fastestSPlus = catacombs.fastest_time_s_plus || {};

            for (let f = 0; f <= 7; f++) {
                const comp = completions[f] || 0;
                if (comp > 0) {
                    const name = f === 0 ? 'Entrance' : `Floor ${f}`;
                    const score = bestScores[f] ? ` | Best: ${bestScores[f]}` : '';
                    const fast = fastestSPlus[f]
                        ? ` | S+: ${formatTime(fastestSPlus[f])}`
                        : fastestS[f]
                            ? ` | S: ${formatTime(fastestS[f])}`
                            : '';
                    floorLines.push(`**${name}:** ${commaNumber(comp)} runs${score}${fast}`);
                }
            }

            // Master Mode
            const masterLines = [];
            const masterComp = masterCata.tier_completions || {};
            for (let f = 1; f <= 7; f++) {
                const comp = masterComp[f] || 0;
                if (comp > 0) {
                    masterLines.push(`**M${f}:** ${commaNumber(comp)} runs`);
                }
            }

            // Selected class
            const selectedClass = dungeons.selected_dungeon_class
                ? titleCase(dungeons.selected_dungeon_class)
                : 'None';

            const embed = playerEmbed(`🏰 Dungeons — ${ign}`, ign, uuid)
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
                        name: '🗺️ Floor Completions',
                        value: floorLines.length > 0 ? floorLines.join('\n') : 'No completions',
                        inline: true,
                    },
                    {
                        name: '💀 Master Mode',
                        value: masterLines.length > 0 ? masterLines.join('\n') : 'No master runs',
                        inline: true,
                    }
                );

            await interaction.editReply({ embeds: [embed] });
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
