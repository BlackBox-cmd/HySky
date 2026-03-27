const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { bazaarEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber } = require('../utils/formatNumber');


module.exports = {
    data: new SlashCommandBuilder()
        .setName('bazaar')
        .setDescription('View real-time Bazaar prices for an item')
        .addStringOption(opt =>
            opt.setName('item')
                .setDescription('Item name (e.g. Diamond, Enchanted Gold)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(opt =>
            opt.setName('mode')
                .setDescription('View mode')
                .setRequired(false)
                .addChoices(
                    { name: 'Price Overview', value: 'price' },
                    { name: 'Top Orders', value: 'orders' },
                )),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        try {
            const products = await hypixel.getBazaar();
            const productIds = Object.keys(products);

            const matches = productIds
                .filter(id => {
                    const readable = id.replace(/_/g, ' ').toLowerCase();
                    return readable.includes(focused) || id.toLowerCase().includes(focused);
                })
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
        await interaction.deferReply();
        const itemInput = interaction.options.getString('item');
        const mode = interaction.options.getString('mode') || 'price';

        try {
            const products = await hypixel.getBazaar();

            // Find the product — try exact match first, then fuzzy
            let productId = itemInput;
            if (!products[productId]) {
                const searchKey = itemInput.toUpperCase().replace(/ /g, '_');
                const found = Object.keys(products).find(k =>
                    k === searchKey || k.includes(searchKey)
                );
                if (!found) {
                    // Fuzzy search
                    const fuzzy = Object.keys(products).find(k =>
                        k.replace(/_/g, ' ').toLowerCase().includes(itemInput.toLowerCase())
                    );
                    if (!fuzzy) {
                        return interaction.editReply({
                            embeds: [errorEmbed(`Item "${itemInput}" not found in Bazaar.`)]
                        });
                    }
                    productId = fuzzy;
                } else {
                    productId = found;
                }
            }

            const product = products[productId];
            const qs = product.quick_status;
            const itemName = productId.replace(/_/g, ' ');

            if (mode === 'orders') {
                // Show top buy/sell orders
                const buyOrders = (product.buy_summary || []).slice(0, 5);
                const sellOrders = (product.sell_summary || []).slice(0, 5);

                const buyLines = buyOrders.map((o, i) =>
                    `${i + 1}. **${commaNumber(o.pricePerUnit)}** × ${commaNumber(o.amount)} (${o.orders} orders)`
                );
                const sellLines = sellOrders.map((o, i) =>
                    `${i + 1}. **${commaNumber(o.pricePerUnit)}** × ${commaNumber(o.amount)} (${o.orders} orders)`
                );

                const embed = bazaarEmbed(`${itemName} — Order Book`)
                    .addFields(
                        {
                            name: '📗 Buy Orders (Instant Sell)',
                            value: buyLines.length > 0 ? buyLines.join('\n') : 'No orders',
                            inline: true,
                        },
                        {
                            name: '📕 Sell Orders (Instant Buy)',
                            value: sellLines.length > 0 ? sellLines.join('\n') : 'No orders',
                            inline: true,
                        }
                    );

                return interaction.editReply({ embeds: [embed] });
            }

            // Price overview
            const spread = qs.sellPrice - qs.buyPrice;
            const spreadPct = qs.buyPrice > 0 ? ((spread / qs.buyPrice) * 100).toFixed(2) : 0;

            const embed = bazaarEmbed(`${itemName}`)
                .setDescription(
                    `### 📊 Price Overview\n\n` +
                    `**Instant Buy:** 🪙 ${commaNumber(qs.sellPrice.toFixed(1))} per unit\n` +
                    `**Instant Sell:** 🪙 ${commaNumber(qs.buyPrice.toFixed(1))} per unit\n\n` +
                    `**Spread:** ${commaNumber(spread.toFixed(1))} (${spreadPct}%)\n\n` +
                    `### 📈 Volume (7d Moving)\n` +
                    `**Buy Volume:** ${formatNumber(qs.buyVolume)}\n` +
                    `**Sell Volume:** ${formatNumber(qs.sellVolume)}\n\n` +
                    `**Buy Orders:** ${commaNumber(qs.buyOrders)}\n` +
                    `**Sell Orders:** ${commaNumber(qs.sellOrders)}\n\n` +
                    `**Buy Moving Week:** ${formatNumber(qs.buyMovingWeek)}\n` +
                    `**Sell Moving Week:** ${formatNumber(qs.sellMovingWeek)}`
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
