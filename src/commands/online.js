const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('online')
        .setDescription('Check if a player is currently online on Hypixel')
        .addStringOption(opt =>
            opt.setName('player').setDescription('Minecraft username').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const username = interaction.options.getString('player');

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

            const session = await hypixel.getStatus(uuid);

            let status, color, description;

            if (session && session.online) {
                status = '🟢 Online';
                color = COLORS.SUCCESS;
                const gameType = session.gameType ? titleCase(session.gameType) : 'Unknown';
                const mode = session.mode ? titleCase(session.mode) : '';
                const map = session.map || '';

                description = `**Status:** ${status}\n` +
                    `**Game:** ${gameType}\n` +
                    (mode ? `**Mode:** ${mode}\n` : '') +
                    (map ? `**Map:** ${map}\n` : '');
            } else {
                status = '🔴 Offline';
                color = COLORS.ERROR;

                // Try to get last login from player data
                const player = await hypixel.getPlayer(uuid);
                const lastLogin = player?.lastLogin;
                const lastLogout = player?.lastLogout;

                description = `**Status:** ${status}\n`;
                if (lastLogout) {
                    description += `**Last Seen:** <t:${Math.floor(lastLogout / 1000)}:R>\n`;
                }
                if (lastLogin) {
                    description += `**Last Login:** <t:${Math.floor(lastLogin / 1000)}:F>\n`;
                }
            }

            const embed = playerEmbed(`${status} ${ign}`, ign, uuid)
                .setColor(color)
                .setDescription(description);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
