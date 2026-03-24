const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { commaNumber, timeAgo } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('View bank balance and recent transactions')
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

            const purse = member.currencies?.coin_purse ?? member.coin_purse ?? 0;
            const banking = profile.banking || {};
            const balance = banking.balance ?? 0;
            const transactions = banking.transactions || [];

            // Recent transactions
            const txLines = transactions.slice(0, 10).map(tx => {
                const action = tx.action === 'DEPOSIT' ? '📥' : '📤';
                const initiator = tx.initiator_name || 'Unknown';
                return `${action} **${commaNumber(tx.amount)}** — ${initiator} — ${timeAgo(tx.timestamp)}`;
            });

            const embed = playerEmbed(`🏦 Bank — ${ign}`, ign, uuid)
                .setColor(COLORS.GOLD)
                .setDescription(
                    `**Profile:** ${profile.cute_name || 'Unknown'}\n\n` +
                    `💰 **Purse:** ${commaNumber(Math.floor(purse))} coins\n` +
                    `🏦 **Bank:** ${commaNumber(Math.floor(balance))} coins\n` +
                    `💎 **Total Liquid:** ${commaNumber(Math.floor(purse + balance))} coins`
                )
                .addFields({
                    name: '📋 Recent Transactions',
                    value: txLines.length > 0 ? txLines.join('\n') : 'No transaction history available (Banking API may be disabled).',
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
