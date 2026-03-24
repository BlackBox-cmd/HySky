const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successEmbed, errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Server administration and configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('alert-channel')
                .setDescription('Set the channel for global news, fire sales, and mayor updates')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Select a text channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('jacob-channel')
                .setDescription('Set the channel for Jacob\'s Farming Contest alerts')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Select a text channel')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))),

    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'alert-channel') {
                const channel = interaction.options.getChannel('channel');

                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { alertChannelId: channel.id },
                    { upsert: true, returnDocument: 'after' }
                );

                await interaction.editReply({
                    embeds: [successEmbed(`✅ Alert channel set to ${channel}!\nGlobal events like News, Fire Sales, and Mayor elections will be posted here.`)]
                });
            } else if (sub === 'jacob-channel') {
                const channel = interaction.options.getChannel('channel');

                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { jacobChannelId: channel.id },
                    { upsert: true, returnDocument: 'after' }
                );

                await interaction.editReply({
                    embeds: [successEmbed(`✅ Jacob Contest channel set to ${channel}!\nUpcoming farming contests will be announced here 5 minutes before they start.`)]
                });
            }
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
