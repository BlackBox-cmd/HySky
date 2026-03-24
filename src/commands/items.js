const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { skyblockEmbed, errorEmbed } = require('../utils/embedTemplates');
const { titleCase } = require('../utils/formatNumber');
const { RARITY_COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('items')
        .setDescription('Search the SkyBlock item database')
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Item name to search')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        try {
            const items = await hypixel.getItemsResource();
            const matches = items
                .filter(i => i.name?.toLowerCase().includes(focused) ||
                    i.id?.toLowerCase().includes(focused.replace(/ /g, '_')))
                .slice(0, 25)
                .map(i => ({
                    name: `${i.name} [${titleCase(i.tier || 'COMMON')}]`.substring(0, 100),
                    value: i.id,
                }));
            await interaction.respond(matches);
        } catch {
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const itemInput = interaction.options.getString('name');

        try {
            const items = await hypixel.getItemsResource();

            // Find item — exact ID match first, then name search
            let item = items.find(i => i.id === itemInput);
            if (!item) {
                const search = itemInput.toLowerCase();
                item = items.find(i =>
                    i.name?.toLowerCase() === search ||
                    i.name?.toLowerCase().includes(search)
                );
            }

            if (!item) {
                return interaction.editReply({
                    embeds: [errorEmbed(`Item "${itemInput}" not found.`)]
                });
            }

            const rarity = item.tier || 'COMMON';
            const color = RARITY_COLORS[rarity] || '#FFFFFF';

            let description = `**Rarity:** ${titleCase(rarity)}\n`;
            description += `**ID:** \`${item.id}\`\n`;

            if (item.category) description += `**Category:** ${titleCase(item.category)}\n`;
            if (item.npc_sell_price) description += `**NPC Sell Price:** 🪙 ${item.npc_sell_price.toLocaleString()}\n`;
            if (item.material) description += `**Material:** ${item.material}\n`;
            if (item.durability) description += `**Durability:** ${item.durability}\n`;
            if (item.museum) description += `**Museum:** ✅ Can be donated\n`;
            if (item.soulbound) description += `**Soulbound:** ${item.soulbound}\n`;
            if (item.dungeon_item) description += `**Dungeon Item:** ✅\n`;
            if (item.gear_score) description += `**Gear Score:** ${item.gear_score}\n`;

            // Stats
            const stats = item.stats || {};
            const statLines = [];
            for (const [stat, val] of Object.entries(stats)) {
                if (val !== 0) {
                    statLines.push(`${titleCase(stat)}: **${val > 0 ? '+' : ''}${val}**`);
                }
            }
            if (statLines.length > 0) {
                description += `\n### 📊 Stats\n${statLines.join('\n')}`;
            }

            // Requirements
            const reqs = item.requirements || [];
            if (reqs.length > 0) {
                const reqLines = reqs.map(r => {
                    if (r.type === 'SKILL') return `${titleCase(r.skill)} ${r.level}`;
                    if (r.type === 'DUNGEON_SKILL') return `Catacombs ${r.dungeon_type} ${r.level}`;
                    if (r.type === 'SLAYER') return `${titleCase(r.slayer_boss_type)} Slayer ${r.level}`;
                    return JSON.stringify(r);
                });
                description += `\n\n### 🔒 Requirements\n${reqLines.join('\n')}`;
            }

            const embed = skyblockEmbed(`🔍 ${item.name}`)
                .setColor(parseInt(color.replace('#', ''), 16))
                .setDescription(description);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
