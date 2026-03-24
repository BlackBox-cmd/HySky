const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed, loadingEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, progressBar, xpToLevel, titleCase } = require('../utils/formatNumber');
const { SKILLS, SKILL_EMOJIS, SKILL_XP_TABLES, SLAYERS, COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View a player\'s SkyBlock profile overview')
        .addStringOption(opt =>
            opt.setName('player')
                .setDescription('Minecraft username')
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('profile')
                .setDescription('Profile name (e.g. Strawberry)')
                .setRequired(false)),

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

            // ── Skills Summary ──
            let skillAvg = 0;
            let skillCount = 0;
            const skillLines = [];

            for (const skill of SKILLS) {
                const xpKeyOld = `experience_skill_${skill}`;
                const xpKeyNew = `SKILL_${skill.toUpperCase()}`;
                
                const xp = member.player_data?.experience?.[xpKeyNew] ?? 
                           member.player_data?.experience?.[xpKeyOld] ?? 
                           member[xpKeyOld] ?? 0;
                           
                if (xp > 0 || skill !== 'social') {
                    const info = xpToLevel(xp, SKILL_XP_TABLES.standard);
                    skillAvg += info.level;
                    skillCount++;
                    const emoji = SKILL_EMOJIS[skill] || '📊';
                    skillLines.push(`${emoji} **${titleCase(skill)}:** ${info.level}`);
                }
            }

            if (skillCount > 0) skillAvg = (skillAvg / skillCount).toFixed(1);

            // ── Slayer Summary ──
            let totalSlayerXP = 0;
            const slayerLines = [];
            const slayerData = member.slayer?.slayer_bosses || member.slayer_bosses || {};

            for (const [key, info] of Object.entries(SLAYERS)) {
                const slayer = slayerData[key];
                if (slayer) {
                    const xp = slayer.xp || 0;
                    totalSlayerXP += xp;
                    slayerLines.push(`${info.emoji} **${info.name}:** ${formatNumber(xp)} XP`);
                }
            }

            // ── Dungeon Summary ──
            const dungeons = member.dungeons?.dungeon_types?.catacombs;
            let cataLevel = 0;
            if (dungeons) {
                const cataXP = dungeons.experience || 0;
                const cataInfo = xpToLevel(cataXP, SKILL_XP_TABLES.dungeon);
                cataLevel = cataInfo.level;
            }

            // ── Bank & Purse ──
            const purse = member.currencies?.coin_purse ?? member.coin_purse ?? 0;
            const bankBalance = profile.banking?.balance ?? 0;

            // ── Build Embed ──
            const embed = playerEmbed(
                `📊 SkyBlock Stats — ${ign}`,
                ign, uuid
            )
                .setColor(COLORS.SKYBLOCK)
                .setDescription(`**Profile:** ${profile.cute_name || 'Unknown'} ${profile.game_mode ? `(${titleCase(profile.game_mode)})` : ''}`)
                .addFields(
                    {
                        name: `⭐ Skill Average: ${skillAvg}`,
                        value: skillLines.length > 0
                            ? skillLines.slice(0, 5).join('\n')
                            : 'No skill data (API disabled?)',
                        inline: true,
                    },
                    {
                        name: `⭐ Skills (cont.)`,
                        value: skillLines.length > 5
                            ? skillLines.slice(5).join('\n')
                            : '​',
                        inline: true,
                    },
                    { name: '\u200B', value: '\u200B', inline: false },
                    {
                        name: `🗡️ Slayer — Total: ${formatNumber(totalSlayerXP)} XP`,
                        value: slayerLines.length > 0
                            ? slayerLines.join('\n')
                            : 'No slayer data',
                        inline: true,
                    },
                    {
                        name: '🏰 Dungeons',
                        value: `⚔️ **Catacombs Level:** ${cataLevel}`,
                        inline: true,
                    },
                    { name: '\u200B', value: '\u200B', inline: false },
                    {
                        name: '💰 Economy',
                        value: [
                            `🪙 **Purse:** ${commaNumber(purse)}`,
                            `🏦 **Bank:** ${commaNumber(bankBalance)}`,
                            `💎 **Total:** ${commaNumber(purse + bankBalance)}`,
                        ].join('\n'),
                        inline: false,
                    }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
