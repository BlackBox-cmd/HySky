const { SlashCommandBuilder } = require('discord.js');
const LinkedAccount = require('../models/LinkedAccount');
const { successEmbed, errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unlink your Minecraft account from your Discord profile'),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });

        try {
            const result = await LinkedAccount.findOneAndDelete({ discordId: interaction.user.id });

            if (result) {
                await interaction.editReply({
                    embeds: [successEmbed(`✅ Successfully unlinked your Minecraft account.`)]
                });
            } else {
                await interaction.editReply({
                    embeds: [errorEmbed(`❌ You do not have a linked Minecraft account.`)]
                });
            }
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(`Failed to unlink account: ${err.message}`)] });
        }
    },
};
