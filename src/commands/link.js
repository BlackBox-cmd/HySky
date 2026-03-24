const { SlashCommandBuilder } = require('discord.js');
const LinkedAccount = require('../models/LinkedAccount');
const mojang = require('../api/mojang');
const { successEmbed, errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Discord account to a Minecraft username')
        .addStringOption(opt =>
            opt.setName('player')
                .setDescription('Your Minecraft username')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const username = interaction.options.getString('player');

        try {
            // Fetch real UUID and properly capitalized ign from Mojang
            const { id: uuid, name: ign } = await mojang.getUUID(username);

            // Upsert MongoDB database record
            await LinkedAccount.findOneAndUpdate(
                { discordId: interaction.user.id },
                {
                    minecraftUuid: uuid,
                    minecraftName: ign,
                    linkedAt: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            );

            await interaction.editReply({
                embeds: [successEmbed(`✅ Successfully linked your Discord to **${ign}**!\nYou can now use commands like \`/stats\` without needing to type your username.`)]
            });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(`Failed to link account: ${err.message}`)] });
        }
    },
};
