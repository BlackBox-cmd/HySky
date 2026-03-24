const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { skyblockEmbed, errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('news')
        .setDescription('View latest SkyBlock news and updates'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const items = await hypixel.getNews();

            if (!items || items.length === 0) {
                return interaction.editReply({
                    embeds: [skyblockEmbed('📰 SkyBlock News', 'No news available.')]
                });
            }

            const lines = items.slice(0, 8).map((item, i) => {
                const title = item.title || 'Untitled';
                const text = item.text || '';
                const link = item.link ? `[Read More](${item.link})` : '';
                return `**${i + 1}. ${title}**\n${text.substring(0, 120)}${text.length > 120 ? '...' : ''}\n${link}`;
            });

            const embed = skyblockEmbed('📰 SkyBlock News')
                .setDescription(lines.join('\n\n'));

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
