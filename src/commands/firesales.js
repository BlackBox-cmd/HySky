const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { skyblockEmbed, errorEmbed } = require('../utils/embedTemplates');
const { commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('firesales')
        .setDescription('View active and upcoming Fire Sale items'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const sales = await hypixel.getFireSales();

            if (!sales || sales.length === 0) {
                return interaction.editReply({
                    embeds: [skyblockEmbed('🔥 Fire Sales', 'No active or upcoming fire sales right now.')]
                });
            }

            const now = Date.now();
            const active = sales.filter(s => s.start <= now && s.end >= now);
            const upcoming = sales.filter(s => s.start > now);

            const lines = [];

            if (active.length > 0) {
                lines.push('### 🔴 Active Now');
                for (const sale of active) {
                    const name = titleCase(sale.item_id || 'Unknown');
                    const end = `<t:${Math.floor(sale.end / 1000)}:R>`;
                    lines.push(`🔥 **${name}** — Ends ${end}\n   ${commaNumber(sale.amount)} available | Price: 🪙 ${commaNumber(sale.price)}`);
                }
            }

            if (upcoming.length > 0) {
                lines.push('\n### 🟡 Upcoming');
                for (const sale of upcoming) {
                    const name = titleCase(sale.item_id || 'Unknown');
                    const start = `<t:${Math.floor(sale.start / 1000)}:R>`;
                    lines.push(`⏳ **${name}** — Starts ${start}\n   ${commaNumber(sale.amount)} available | Price: 🪙 ${commaNumber(sale.price)}`);
                }
            }

            const embed = skyblockEmbed('🔥 Fire Sales')
                .setColor(0xFF4500)
                .setDescription(lines.join('\n\n'));

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
