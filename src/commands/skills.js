const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, progressBar, xpToLevel, titleCase } = require('../utils/formatNumber');
const { SKILLS, SKILL_EMOJIS, SKILL_XP_TABLES, COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skills')
        .setDescription('View detailed skill levels and XP progress')
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

            let totalLevel = 0;
            let skillCount = 0;
            const lines = [];

            for (const skill of SKILLS) {
                const xpKeyOld = `experience_skill_${skill}`;
                const xpKeyNew = `SKILL_${skill.toUpperCase()}`;
                
                const xp = member.player_data?.experience?.[xpKeyNew] ?? 
                           member.player_data?.experience?.[xpKeyOld] ?? 
                           member[xpKeyOld] ?? 0;
                           
                const info = xpToLevel(xp, SKILL_XP_TABLES.standard);

                totalLevel += info.level;
                skillCount++;

                const emoji = SKILL_EMOJIS[skill] || '📊';
                const bar = progressBar(info.progress, 1, 10);
                const pct = (info.progress * 100).toFixed(1);

                lines.push(
                    `${emoji} **${titleCase(skill)} ${info.level}** ${info.maxLevel ? '✅ MAX' : ''}\n` +
                    `${bar} ${pct}% — ${formatNumber(info.currentXP)}/${formatNumber(info.nextLevelXP)} XP`
                );
            }

            const avg = skillCount > 0 ? (totalLevel / skillCount).toFixed(1) : '0';

            const embed = playerEmbed(
                `📚 Skills — ${ign}`,
                ign, uuid
            )
                .setColor(COLORS.SKYBLOCK)
                .setDescription(
                    `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `**Skill Average:** ⭐ **${avg}**\n` +
                    `**Total XP:** ${formatNumber(SKILLS.reduce((sum, s) => {
                        const kOld = `experience_skill_${s}`;
                        const kNew = `SKILL_${s.toUpperCase()}`;
                        return sum + (member.player_data?.experience?.[kNew] ?? member.player_data?.experience?.[kOld] ?? member[kOld] ?? 0);
                    }, 0))}\n\n` +
                    lines.join('\n\n')
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
