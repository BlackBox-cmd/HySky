const { SlashCommandBuilder } = require('discord.js');
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
            let totalXP = 0;
            const lines = [];

            for (const [key, meta] of Object.entries(SLAYERS)) {
                const slayer = slayerData[key] || {};
                const xp = slayer.xp || 0;
                totalXP += xp;

                const info = getSlayerLevel(key, xp);
                const bar = progressBar(info.progress, 1, 10);

                // Count boss kills per tier
                const kills = [];
                for (let t = 0; t <= 4; t++) {
                    const k = slayer[`boss_kills_tier_${t}`] || 0;
                    if (k > 0) kills.push(`T${t + 1}: ${commaNumber(k)}`);
                }

                lines.push(
                    `${meta.emoji} **${meta.name}** — Level **${info.level}**\n` +
                    `${bar} ${commaNumber(xp)} XP\n` +
                    (kills.length > 0 ? `Kills: ${kills.join(' | ')}` : 'No kills recorded')
                );
            }

            const embed = playerEmbed(`🗡️ Slayers — ${ign}`, ign, uuid)
                .setColor(COLORS.SKYBLOCK)
                .setDescription(
                    `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `**Total Slayer XP:** ${commaNumber(totalXP)}\n\n` +
                    lines.join('\n\n')
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
