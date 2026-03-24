const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { bazaarEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber } = require('../utils/formatNumber');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flipper')
        .setDescription('Find profitable BIN auction flips compared to Bazaar prices')
        .addIntegerOption(opt =>
            opt.setName('minprofit')
                .setDescription('Minimum profit in coins (default: 100,000)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const minProfit = interaction.options.getInteger('minprofit') || 100000;

        try {
            const [bazaar, auctionData, itemsData] = await Promise.all([
                hypixel.getBazaar(),
                hypixel.getActiveAuctions(0),
                hypixel.getItemsResource()
            ]);

            const auctions = auctionData.auctions || [];

            // Build item name → ID mapping
            const nameToId = {};
            for (const item of itemsData) {
                if (item.name && item.id) {
                    nameToId[item.name.toLowerCase()] = item.id;
                }
            }

            // Build bazaar price map (item ID → instant sell price)
            const bazaarPrices = {};
            for (const [id, product] of Object.entries(bazaar)) {
                bazaarPrices[id] = product.quick_status?.buyPrice || 0;
            }

            // Find flips — BIN auctions where AH price < Bazaar sell price
            const flips = [];

            for (const auction of auctions) {
                if (!auction.bin) continue;

                const itemNameStr = auction.item_name?.toLowerCase() || '';
                let itemId = nameToId[itemNameStr];
                if (!itemId) {
                    itemId = auction.item_name?.toUpperCase().replace(/ /g, '_');
                }
                const bazaarPrice = bazaarPrices[itemId];

                if (bazaarPrice && bazaarPrice > 0) {
                    const profit = bazaarPrice - auction.starting_bid;
                    if (profit >= minProfit) {
                        flips.push({
                            name: auction.item_name,
                            ahPrice: auction.starting_bid,
                            bazaarPrice,
                            profit,
                            profitPct: ((profit / auction.starting_bid) * 100).toFixed(1),
                        });
                    }
                }
            }

            // Sort by profit descending
            flips.sort((a, b) => b.profit - a.profit);

            if (flips.length === 0) {
                return interaction.editReply({
                    embeds: [bazaarEmbed('Flip Finder', `No flips found with ≥ ${formatNumber(minProfit)} profit.\n\n*Only page 1 of auctions was searched. Flips are rare!*`)]
                });
            }

            const lines = flips.slice(0, 10).map((f, i) =>
                `**${i + 1}. ${f.name}**\n` +
                `AH: 🪙 ${commaNumber(f.ahPrice)} → Bazaar: 🪙 ${commaNumber(f.bazaarPrice.toFixed(0))}\n` +
                `📈 Profit: **${commaNumber(f.profit.toFixed(0))}** (${f.profitPct}%)`
            );

            const embed = bazaarEmbed('💹 Flip Finder')
                .setDescription(
                    `**Min Profit:** ${formatNumber(minProfit)} coins\n` +
                    `**Flips Found:** ${flips.length}\n\n` +
                    lines.join('\n\n') +
                    `\n\n> ⚠️ *Prices change rapidly. Verify before buying!*`
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
