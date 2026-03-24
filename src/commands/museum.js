const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { commaNumber } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('museum')
        .setDescription('View a player\'s museum donation progress')
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

            const { profile } = await hypixel.getProfileMember(uuid, profileName);

            const museumData = await hypixel.getMuseum(profile.profile_id);
            const members = museumData.members || {};
            const playerMuseum = members[uuid] || {};

            const items = playerMuseum.items || {};
            const special = playerMuseum.special || [];

            const totalDonated = Object.keys(items).length + special.length;

            let desc = `**Profile:** ${profile.cute_name || 'Unknown'}\n`;
            desc += `**Total Donations:** ${commaNumber(totalDonated)}\n`;
            desc += `**Items:** ${Object.keys(items).length} | **Special:** ${special.length}\n\n`;

            // Show some donated item names
            const itemNames = Object.keys(items).slice(0, 15).map(id => {
                const itemData = items[id];
                const borrowing = itemData.borrowing ? ' 🔄' : '';
                return `• ${id.replace(/_/g, ' ')}${borrowing}`;
            });

            if (itemNames.length > 0) {
                desc += `### 🏛️ Recent Donations\n${itemNames.join('\n')}`;
                if (Object.keys(items).length > 15) {
                    desc += `\n*...and ${Object.keys(items).length - 15} more*`;
                }
            }

            const embed = playerEmbed(`🏛️ Museum — ${ign}`, ign, uuid)
                .setColor(COLORS.GOLD)
                .setDescription(desc);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
