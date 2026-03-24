const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { decodeInventoryData, extractSkyBlockItems } = require('../utils/nbtParser');
const { commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

const MP_VALUES = {
    COMMON: 3, UNCOMMON: 5, RARE: 8, EPIC: 12,
    LEGENDARY: 16, MYTHIC: 22, DIVINE: 32,
    SPECIAL: 3, VERY_SPECIAL: 5
};
const RARITY_ORDER = { 'SPECIAL': 8, 'MYTHIC': 7, 'LEGENDARY': 6, 'EPIC': 5, 'RARE': 4, 'UNCOMMON': 3, 'COMMON': 2 };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('accessories')
        .setDescription('View a player\'s Accessories and Magical Power Dashboard')
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

            const { profile, member } = await hypixel.getProfileMember(uuid, profileName);

            const bagData = member.inventory?.bag_contents?.accessory_bag?.data || member.inventory?.bag_contents?.talisman_bag?.data;
            let ownedIds = new Set();
            let ownedItemsArr = [];

            if (bagData) {
                const rawItems = await decodeInventoryData(bagData);
                ownedItemsArr = extractSkyBlockItems(rawItems);
                ownedItemsArr.forEach(acc => ownedIds.add(acc.id));
            }

            const allItems = await hypixel.getItemsResource();
            const allAccessories = allItems.filter(i => i.category === 'ACCESSORY');
            const missingAccessoriesRaw = allAccessories.filter(a => !ownedIds.has(a.id));

            let totalRecombed = 0;
            let totalEnriched = 0;
            let calculatedMP = 0;
            const rarityCounts = { COMMON: 0, UNCOMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0, MYTHIC: 0, DIVINE: 0, SPECIAL: 0, VERY_SPECIAL: 0 };

            const ownedListRaw = ownedItemsArr.map(a => {
                const name = a._raw?.tag?.display?.Name?.replace(/§[0-9a-fk-or]/g, '') || titleCase(a.id);
                if (a.recombed) totalRecombed++;
                const hasEnrichment = a._raw?.tag?.ExtraAttributes?.talisman_enrichment;
                if (hasEnrichment) totalEnriched++;

                let rarity = 'COMMON';
                const lore = a._raw?.tag?.display?.Lore || [];
                for (const line of lore) {
                    const clean = line.replace(/§[0-9a-fk-or]/g, '');
                    if (/(ACCESSORY|HATCCESSORY|NECKLACE|CLOAK|BELT|GLOVES|BRACELET)/.test(clean)) {
                        const foundRarity = clean.split(' ')[0];
                        if (MP_VALUES[foundRarity]) rarity = foundRarity;
                    }
                }

                if (rarityCounts[rarity] !== undefined) rarityCounts[rarity]++;

                const mp = (MP_VALUES[rarity] || 0) + (hasEnrichment ? 1 : 0);
                calculatedMP += mp;

                return { name, mp, tier: rarity };
            });

            const missingListRaw = missingAccessoriesRaw.map(a => {
                const tier = a.tier || 'COMMON';
                const mp = MP_VALUES[tier] || 0;
                return { name: a.name, mp, tier };
            });

            const storage = member.accessory_bag_storage || {};
            const apiMP = storage.highest_magical_power || calculatedMP;
            const tuningPoints = Math.floor(apiMP / 10);
            const selectedPower = storage.selected_power ? titleCase(storage.selected_power) : 'None';

            let dashDesc = `**Total Accessories:** ${ownedIds.size}/${allAccessories.length}\n`;
            dashDesc += `**Total Recombobulated:** ${totalRecombed}\n`;
            dashDesc += `**Total Enriched:** ${totalEnriched}\n`;
            dashDesc += `**Total Magical Power:** **${commaNumber(apiMP)}** *(${tuningPoints} Tuning Points)*\n`;
            dashDesc += `**Selected Power:** ${selectedPower}\n\n`;

            const RARITY_FORMATS = [
                { key: 'COMMON', display: '[C] Common' }, { key: 'UNCOMMON', display: '[U] Uncommon' },
                { key: 'RARE', display: '[R] Rare' }, { key: 'EPIC', display: '[E] Epic' },
                { key: 'LEGENDARY', display: '[L] Legendary' }, { key: 'MYTHIC', display: '[M] Mythic' },
                { key: 'DIVINE', display: '[D] Divine' }, { key: 'SPECIAL', display: '[S] Special' },
                { key: 'VERY_SPECIAL', display: '[VS] Very Special' }
            ];

            for (const r of RARITY_FORMATS) {
                if (rarityCounts[r.key] !== undefined && rarityCounts[r.key] > 0) {
                    dashDesc += `**${r.display}:** ${rarityCounts[r.key]} accessories\n`;
                }
            }

            let currentState = 'DASHBOARD'; // DASHBOARD, MISSING, OWNED
            let currentFilter = 'ALL'; // ALL, COMMON, UNCOMMON, RARE, EPIC, LEGENDARY, MYTHIC, SPECIAL
            let currentSort = 'DESC'; // DESC (High to Low), ASC (Low to High)
            let currentPage = 0;

            const generatePages = (items, type) => {
                const filtered = currentFilter === 'ALL' ? items : items.filter(i => {
                    const t = i.tier || 'COMMON';
                    if (currentFilter === 'SPECIAL') return t === 'SPECIAL' || t === 'VERY_SPECIAL';
                    return t === currentFilter;
                });

                if (filtered.length === 0) return [`*No ${currentFilter === 'ALL' ? '' : titleCase(currentFilter)} items found in this list.*`];

                const sorted = [...filtered];
                if (currentSort === 'DESC') {
                    sorted.sort((a, b) => (b.mp - a.mp) || ((RARITY_ORDER[b.tier] || 0) - (RARITY_ORDER[a.tier] || 0)));
                } else if (currentSort === 'ASC') {
                    sorted.sort((a, b) => (a.mp - b.mp) || ((RARITY_ORDER[a.tier] || 0) - (RARITY_ORDER[b.tier] || 0)));
                }

                const lines = sorted.map(o => `**${o.name}** *(${titleCase(o.tier)}, +${o.mp} MP)*`);
                const pages = [];
                const chunk = type === 'MISSING' ? 30 : 25;
                const header = `**Profile:** ${profile.cute_name || 'Unknown'}\n### ${type === 'MISSING' ? '❌ Missing Accessories' : '✅ Owned Accessories List'}\n\n`;

                for (let i = 0; i < lines.length; i += chunk) {
                    pages.push(header + lines.slice(i, i + chunk).join('\n'));
                }
                return pages;
            };

            const getEmbed = () => {
                let activePages = [];
                if (currentState === 'DASHBOARD') activePages = [dashDesc];
                else if (currentState === 'MISSING') activePages = generatePages(missingListRaw, 'MISSING');
                else if (currentState === 'OWNED') activePages = generatePages(ownedListRaw, 'OWNED');

                if (currentPage >= activePages.length) currentPage = 0; // Boundary safety
                if (activePages.length === 0) activePages = ['*Empty.*'];

                const e = playerEmbed(`🎒 Accessories & Power — ${ign}`, ign, uuid)
                    .setColor(currentState === 'MISSING' ? COLORS.ERROR : currentState === 'OWNED' ? COLORS.SUCCESS : COLORS.SKYBLOCK)
                    .setDescription(activePages[currentPage]);

                if (activePages.length > 1) {
                    e.setFooter({ text: `Page ${currentPage + 1} of ${activePages.length} • Powered by HySky` });
                } else {
                    e.setFooter({ text: `Powered by HySky` });
                }
                return e;
            };

            const getRows = () => {
                const components = [];

                // Sort Menu (only show if viewing a list)
                if (currentState !== 'DASHBOARD') {
                    const sortMenu = new StringSelectMenuBuilder()
                        .setCustomId('sort_menu')
                        .setPlaceholder('Sort Option')
                        .addOptions(
                            { label: 'All (Highest Power First)', value: 'ALL_DESC', default: currentFilter === 'ALL' && currentSort === 'DESC' },
                            { label: 'All (Lowest Power First)', value: 'ALL_ASC', default: currentFilter === 'ALL' && currentSort === 'ASC' },
                            { label: 'Common Only', value: 'COMMON', default: currentFilter === 'COMMON' },
                            { label: 'Uncommon Only', value: 'UNCOMMON', default: currentFilter === 'UNCOMMON' },
                            { label: 'Rare Only', value: 'RARE', default: currentFilter === 'RARE' },
                            { label: 'Epic Only', value: 'EPIC', default: currentFilter === 'EPIC' },
                            { label: 'Legendary Only', value: 'LEGENDARY', default: currentFilter === 'LEGENDARY' },
                            { label: 'Mythic Only', value: 'MYTHIC', default: currentFilter === 'MYTHIC' },
                            { label: 'Special Only', value: 'SPECIAL', default: currentFilter === 'SPECIAL' }
                        );
                    components.push(new ActionRowBuilder().addComponents(sortMenu));
                }

                const tabRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('tab_dash').setLabel('Accessories').setStyle(currentState === 'DASHBOARD' ? ButtonStyle.Success : ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('tab_miss').setLabel('Missing').setStyle(currentState === 'MISSING' ? ButtonStyle.Success : ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('tab_own').setLabel('Owned List').setStyle(currentState === 'OWNED' ? ButtonStyle.Success : ButtonStyle.Primary)
                );
                components.push(tabRow);

                let activePages = [];
                if (currentState === 'DASHBOARD') activePages = [dashDesc];
                else if (currentState === 'MISSING') activePages = generatePages(missingListRaw, 'MISSING');
                else if (currentState === 'OWNED') activePages = generatePages(ownedListRaw, 'OWNED');

                // Pagination Row
                if (activePages.length > 1) {
                    const pageRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('page_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('page_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === activePages.length - 1)
                    );
                    components.push(pageRow);
                }

                return components;
            };

            const message = await interaction.editReply({ embeds: [getEmbed()], components: getRows() });

            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These controls are not for you!', flags: 64 });
                }

                if (i.isStringSelectMenu() && i.customId === 'sort_menu') {
                    const val = i.values[0];
                    if (val === 'ALL_DESC') { currentFilter = 'ALL'; currentSort = 'DESC'; }
                    else if (val === 'ALL_ASC') { currentFilter = 'ALL'; currentSort = 'ASC'; }
                    else { currentFilter = val; }
                    currentPage = 0; // reset page on sort
                } else if (i.isButton()) {
                    if (i.customId === 'tab_dash') { currentState = 'DASHBOARD'; currentPage = 0; }
                    else if (i.customId === 'tab_miss') { currentState = 'MISSING'; currentPage = 0; }
                    else if (i.customId === 'tab_own') { currentState = 'OWNED'; currentPage = 0; }
                    else if (i.customId === 'page_prev') { currentPage--; }
                    else if (i.customId === 'page_next') { currentPage++; }
                }

                await i.update({ embeds: [getEmbed()], components: getRows() });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => { });
            });

        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
