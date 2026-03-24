const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const Alert = require('../models/Alert');
const { successEmbed, errorEmbed, skyblockEmbed } = require('../utils/embedTemplates');
const { commaNumber, titleCase } = require('../utils/formatNumber');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alert')
        .setDescription('Manage Bazaar price alerts')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set a price alert for a Bazaar item')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Bazaar item name')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(opt =>
                    opt.setName('condition')
                        .setDescription('When to trigger')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Price goes ABOVE', value: 'bazaar_above' },
                            { name: 'Price goes BELOW', value: 'bazaar_below' },
                        ))
                .addNumberOption(opt =>
                    opt.setName('price')
                        .setDescription('Target price per unit')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View your active alerts'))
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Remove all your alerts')),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        try {
            const products = await hypixel.getBazaar();
            const matches = Object.keys(products)
                .filter(id => id.replace(/_/g, ' ').toLowerCase().includes(focused))
                .slice(0, 25)
                .map(id => ({
                    name: id.replace(/_/g, ' ').substring(0, 100),
                    value: id,
                }));
            await interaction.respond(matches);
        } catch {
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            await interaction.deferReply({ flags: 64 });
            const itemId = interaction.options.getString('item');
            const condition = interaction.options.getString('condition');
            const price = interaction.options.getNumber('price');

            try {
                // Verify item exists in bazaar
                const products = await hypixel.getBazaar();
                if (!products[itemId]) {
                    return interaction.editReply({
                        embeds: [errorEmbed(`Item "${itemId}" not found in Bazaar.`)]
                    });
                }

                // Check existing alert count (limit per user)
                const existing = await Alert.countDocuments({
                    userId: interaction.user.id,
                    triggered: false,
                });
                if (existing >= 10) {
                    return interaction.editReply({
                        embeds: [errorEmbed('You can have at most 10 active alerts. Use `/alert clear` to remove old ones.')]
                    });
                }

                await Alert.create({
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    type: condition,
                    itemId,
                    targetPrice: price,
                });

                const condText = condition === 'bazaar_above' ? 'goes above' : 'goes below';
                await interaction.editReply({
                    embeds: [successEmbed(
                        `🔔 Alert set!\n\n` +
                        `**Item:** ${itemId.replace(/_/g, ' ')}\n` +
                        `**Condition:** Price ${condText} **${commaNumber(price)}** coins\n\n` +
                        `You'll receive a DM when triggered.`
                    )]
                });
            } catch (err) {
                await interaction.editReply({ embeds: [errorEmbed(err.message)] });
            }
        }

        if (sub === 'list') {
            await interaction.deferReply({ flags: 64 });
            try {
                const alerts = await Alert.find({
                    userId: interaction.user.id,
                    triggered: false,
                });

                if (alerts.length === 0) {
                    return interaction.editReply({
                        embeds: [skyblockEmbed('🔔 Your Alerts', 'No active alerts. Use `/alert set` to create one.')]
                    });
                }

                const lines = alerts.map((a, i) => {
                    const cond = a.type === 'bazaar_above' ? '📈 Above' : '📉 Below';
                    return `${i + 1}. **${a.itemId.replace(/_/g, ' ')}** — ${cond} ${commaNumber(a.targetPrice)}`;
                });

                const embed = skyblockEmbed('🔔 Your Alerts')
                    .setDescription(lines.join('\n'));

                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                await interaction.editReply({ embeds: [errorEmbed(err.message)] });
            }
        }

        if (sub === 'clear') {
            await interaction.deferReply({ flags: 64 });
            try {
                const result = await Alert.deleteMany({ userId: interaction.user.id });
                await interaction.editReply({
                    embeds: [successEmbed(`🗑️ Cleared ${result.deletedCount} alert(s).`)]
                });
            } catch (err) {
                await interaction.editReply({ embeds: [errorEmbed(err.message)] });
            }
        }
    },
};
