const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS, MINION_SLOTS } = require('../utils/constants');

// ── All SkyBlock Minions (complete list) ─────────────────────────
const MINION_CATEGORIES = {
    FARMING: {
        emoji: '🌾',
        ids: [
            'WHEAT', 'CARROT', 'POTATO', 'PUMPKIN', 'MELON',
            'MUSHROOM', 'COCOA', 'CACTUS', 'SUGAR_CANE', 'NETHER_WARTS',
            'FLOWER', 'CHICKEN', 'PIG', 'COW', 'SHEEP', 'RABBIT',
        ],
    },
    MINING: {
        emoji: '⛏️',
        ids: [
            'COBBLESTONE', 'COAL', 'IRON', 'GOLD', 'DIAMOND', 'LAPIS',
            'REDSTONE', 'EMERALD', 'QUARTZ', 'OBSIDIAN', 'GLOWSTONE',
            'GRAVEL', 'ICE', 'SAND', 'ENDER_STONE', 'MITHRIL', 'HARD_STONE',
        ],
    },
    COMBAT: {
        emoji: '⚔️',
        ids: [
            'ZOMBIE', 'SKELETON', 'SPIDER', 'CAVE_SPIDER', 'CREEPER',
            'ENDERMAN', 'BLAZE', 'MAGMA_CUBE', 'SLIME', 'GHAST',
            'WITCH', 'GUARDIAN', 'INFERNO', 'VAMPIRE', 'VOIDLING',
            'REVENANT', 'TARANTULA',
        ],
    },
    FORAGING: {
        emoji: '🪓',
        ids: [
            'OAK', 'SPRUCE', 'BIRCH', 'DARK_OAK', 'ACACIA', 'JUNGLE',
        ],
    },
    FISHING: {
        emoji: '🎣',
        ids: [
            'FISHING', 'CLAY',
        ],
    },
};

// Max tier per minion (most are 12, some differ)
const MAX_TIERS = {
    FLOWER: 12, CHICKEN: 12, PIG: 12, COW: 12, SHEEP: 12, RABBIT: 12,
    INFERNO: 12, VAMPIRE: 12, VOIDLING: 12, REVENANT: 12, TARANTULA: 12,
    HARD_STONE: 12, MITHRIL: 12,
    // Default: 12
};

function getMaxTier(type) {
    return MAX_TIERS[type] || 12;
}

// Get ALL known minion type IDs
function getAllMinionIds() {
    return Object.values(MINION_CATEGORIES).flatMap(c => c.ids);
}

function getCategoryFor(type) {
    for (const [catName, catData] of Object.entries(MINION_CATEGORIES)) {
        if (catData.ids.includes(type)) return catName;
    }
    return 'OTHER';
}

const ITEMS_PER_PAGE = 20;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minions')
        .setDescription('View crafted minions, missing minions, and minion slot progress')
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

            // ── Parse Crafted Minions ────────────────────────────
            const craftedRaw = member.player_data?.crafted_generators || member.crafted_generators || [];

            // Build a set of crafted "TYPE_TIER" entries and a map of type → max tier
            const craftedSet = new Set(craftedRaw.map(e => e.toUpperCase()));
            const craftedMinions = [];
            const uniqueTypes = new Set();

            for (const entry of craftedRaw) {
                const parts = entry.split('_');
                const tier = parseInt(parts.pop());
                const type = parts.join('_');
                uniqueTypes.add(type);
                craftedMinions.push({ type, tier });
            }

            // Group by type to find max tier
            const minionMap = {};
            for (const m of craftedMinions) {
                if (!minionMap[m.type] || m.tier > minionMap[m.type]) {
                    minionMap[m.type] = m.tier;
                }
            }

            // ── Build missing minions list ───────────────────────
            const allIds = getAllMinionIds();
            const missingMinions = []; // { type, missingTiers[], category }
            let totalMissingCrafts = 0;

            for (const type of allIds) {
                const maxTier = getMaxTier(type);
                const missing = [];
                for (let t = 1; t <= maxTier; t++) {
                    const key = `${type}_${t}`;
                    if (!craftedSet.has(key)) {
                        missing.push(t);
                    }
                }
                if (missing.length > 0) {
                    totalMissingCrafts += missing.length;
                    const maxCrafted = minionMap[type] || 0;
                    missingMinions.push({
                        type,
                        maxCrafted,
                        missingTiers: missing,
                        missingCount: missing.length,
                        totalTiers: maxTier,
                        category: getCategoryFor(type),
                    });
                }
            }

            // Also find uncategorized crafted types (not in our known list)
            const allCatIds = new Set(allIds);
            const uncategorizedCrafted = Object.keys(minionMap).filter(t => !allCatIds.has(t));

            // ── Minion Slots ─────────────────────────────────────
            const uniqueCount = craftedRaw.length;
            let currentSlots = 5;
            for (const threshold of MINION_SLOTS) {
                if (uniqueCount >= threshold) currentSlots++;
                else break;
            }

            const communityBonus = profile.community_upgrades?.upgrade_states?.find(u => u.upgrade === 'minion_slots');
            const communitySlots = communityBonus?.tier || 0;
            const totalSlots = currentSlots + communitySlots;

            const nextSlotIdx = currentSlots - 5;
            const nextSlotReq = MINION_SLOTS[nextSlotIdx] || null;

            // ── State ────────────────────────────────────────────
            let currentView = 'OVERVIEW'; // OVERVIEW, MISSING, or a category key
            let currentPage = 0;

            // ── Total known minion crafts ────────────────────────
            const totalPossibleCrafts = allIds.reduce((sum, id) => sum + getMaxTier(id), 0);

            // ── Overview builder ─────────────────────────────────
            const buildOverview = () => {
                let progressLine = '';
                if (nextSlotReq) {
                    progressLine = `**Next Slot at:** ${commaNumber(nextSlotReq)} unique crafts (${uniqueCount}/${nextSlotReq})\n`;
                } else {
                    progressLine = '**All slots unlocked!** 🎉\n';
                }

                const categoryLines = [];
                for (const [catName, catData] of Object.entries(MINION_CATEGORIES)) {
                    const crafted = catData.ids.filter(id => minionMap[id] !== undefined).length;
                    const total = catData.ids.length;
                    categoryLines.push(`${catData.emoji} **${titleCase(catName)}:** ${crafted}/${total} types`);
                }

                if (uncategorizedCrafted.length > 0) {
                    categoryLines.push(`📦 **Other:** ${uncategorizedCrafted.length} types`);
                }

                return playerEmbed(`⚙️ Minions — ${ign}`, ign, uuid)
                    .setColor(COLORS.SKYBLOCK)
                    .setDescription(
                        `**Profile:** ${profile.cute_name || 'Unknown'}\n\n` +
                        `**📊 Unique Crafts:** ${commaNumber(uniqueCount)} / ${commaNumber(totalPossibleCrafts)}\n` +
                        `**🔓 Unique Minion Types:** ${uniqueTypes.size} / ${allIds.length}\n` +
                        `**❌ Missing Crafts:** ${commaNumber(totalMissingCrafts)}\n` +
                        `**🎰 Minion Slots:** ${totalSlots}` +
                        (communitySlots > 0 ? ` *(${currentSlots} + ${communitySlots} community)*` : '') + '\n' +
                        progressLine + '\n' +
                        `**📁 Categories**\n` +
                        (categoryLines.length > 0 ? categoryLines.join('\n') : '*No minions crafted.*')
                    );
            };

            // ── Missing minions builder ──────────────────────────
            const buildMissing = () => {
                if (missingMinions.length === 0) {
                    return playerEmbed(`⚙️ Minions — ${ign}`, ign, uuid)
                        .setColor(COLORS.SUCCESS)
                        .setDescription(`**Profile:** ${profile.cute_name || 'Unknown'}\n\n🎉 **All minions crafted!** No missing minions.`);
                }

                // Sort: completely uncrafted first, then by missing count desc
                const sorted = [...missingMinions].sort((a, b) => {
                    if (a.maxCrafted === 0 && b.maxCrafted > 0) return -1;
                    if (a.maxCrafted > 0 && b.maxCrafted === 0) return 1;
                    return b.missingCount - a.missingCount;
                });

                const pages = [];
                const header = `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `### ❌ Missing Minions — ${commaNumber(totalMissingCrafts)} crafts missing\n\n`;

                for (let i = 0; i < sorted.length; i += ITEMS_PER_PAGE) {
                    const chunk = sorted.slice(i, i + ITEMS_PER_PAGE);
                    const lines = chunk.map(m => {
                        const catEmoji = MINION_CATEGORIES[m.category]?.emoji || '📦';
                        if (m.maxCrafted === 0) {
                            // Completely uncrafted
                            return `${catEmoji} **${titleCase(m.type)} Minion** — ❌ Not crafted (0/${m.totalTiers})`;
                        }
                        // Partially crafted — show which tiers are missing
                        const missingStr = formatMissingTiers(m.missingTiers);
                        return `${catEmoji} **${titleCase(m.type)} Minion** — T${m.maxCrafted}/${m.totalTiers} | Missing: ${missingStr}`;
                    });
                    pages.push(header + lines.join('\n'));
                }

                if (currentPage >= pages.length) currentPage = 0;

                const embed = playerEmbed(`⚙️ Minions — ${ign}`, ign, uuid)
                    .setColor(COLORS.ERROR)
                    .setDescription(pages[currentPage]);

                if (pages.length > 1) {
                    embed.setFooter({ text: `Page ${currentPage + 1} of ${pages.length} • ${commaNumber(missingMinions.length)} minion types with missing tiers` });
                }
                return embed;
            };

            // ── Category detail builder ──────────────────────────
            const buildCategory = (catName) => {
                let minions = [];

                if (catName === 'OTHER') {
                    minions = uncategorizedCrafted.map(type => ({ type, tier: minionMap[type] }));
                } else {
                    const catData = MINION_CATEGORIES[catName];
                    if (!catData) return buildOverview();
                    minions = catData.ids
                        .filter(id => minionMap[id] !== undefined)
                        .map(id => ({ type: id, tier: minionMap[id] }));
                }

                minions.sort((a, b) => b.tier - a.tier);

                if (minions.length === 0) {
                    return playerEmbed(`⚙️ Minions — ${ign}`, ign, uuid)
                        .setColor(COLORS.SKYBLOCK)
                        .setDescription(`**Profile:** ${profile.cute_name || 'Unknown'}\n\n*No minions in this category.*`);
                }

                const pages = [];
                const emoji = MINION_CATEGORIES[catName]?.emoji || '📦';
                const header = `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `### ${emoji} ${titleCase(catName)} Minions\n\n`;

                for (let i = 0; i < minions.length; i += ITEMS_PER_PAGE) {
                    const chunk = minions.slice(i, i + ITEMS_PER_PAGE);
                    const lines = chunk.map(m => {
                        const maxTier = getMaxTier(m.type);
                        const tierBar = '▰'.repeat(m.tier) + '▱'.repeat(Math.max(0, maxTier - m.tier));
                        return `**${titleCase(m.type)} Minion** — T${m.tier}/${maxTier} ${tierBar}`;
                    });
                    pages.push(header + lines.join('\n'));
                }

                if (currentPage >= pages.length) currentPage = 0;

                const embed = playerEmbed(`⚙️ Minions — ${ign}`, ign, uuid)
                    .setColor(COLORS.SKYBLOCK)
                    .setDescription(pages[currentPage]);

                if (pages.length > 1) {
                    embed.setFooter({ text: `Page ${currentPage + 1} of ${pages.length} • Powered by HySky` });
                }
                return embed;
            };

            // ── Embed / Row dispatchers ──────────────────────────
            const getEmbed = () => {
                if (currentView === 'OVERVIEW') return buildOverview();
                if (currentView === 'MISSING') return buildMissing();
                return buildCategory(currentView);
            };

            const getPageCount = () => {
                if (currentView === 'MISSING') {
                    return Math.ceil(missingMinions.length / ITEMS_PER_PAGE);
                }
                if (currentView !== 'OVERVIEW') {
                    let items = [];
                    if (currentView === 'OTHER') {
                        items = uncategorizedCrafted;
                    } else {
                        const catData = MINION_CATEGORIES[currentView];
                        if (catData) items = catData.ids.filter(id => minionMap[id] !== undefined);
                    }
                    return Math.ceil(items.length / ITEMS_PER_PAGE);
                }
                return 1;
            };

            const getRows = () => {
                const components = [];
                const catKeys = Object.keys(MINION_CATEGORIES);

                // Row 1: Overview, Missing, and first 3 categories
                const row1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('mn_overview')
                        .setLabel('Overview')
                        .setStyle(currentView === 'OVERVIEW' ? ButtonStyle.Success : ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('mn_MISSING')
                        .setLabel(`Missing (${totalMissingCrafts})`)
                        .setEmoji('❌')
                        .setStyle(currentView === 'MISSING' ? ButtonStyle.Danger : ButtonStyle.Secondary),
                    ...catKeys.slice(0, 3).map(key => new ButtonBuilder()
                        .setCustomId(`mn_${key}`)
                        .setLabel(titleCase(key))
                        .setEmoji(MINION_CATEGORIES[key].emoji)
                        .setStyle(currentView === key ? ButtonStyle.Success : ButtonStyle.Secondary)
                    )
                );
                components.push(row1);

                // Row 2: Remaining categories + Other
                const row2Btns = catKeys.slice(3).map(key => new ButtonBuilder()
                    .setCustomId(`mn_${key}`)
                    .setLabel(titleCase(key))
                    .setEmoji(MINION_CATEGORIES[key].emoji)
                    .setStyle(currentView === key ? ButtonStyle.Success : ButtonStyle.Secondary)
                );

                if (uncategorizedCrafted.length > 0) {
                    row2Btns.push(new ButtonBuilder()
                        .setCustomId('mn_OTHER')
                        .setLabel('Other')
                        .setEmoji('📦')
                        .setStyle(currentView === 'OTHER' ? ButtonStyle.Success : ButtonStyle.Secondary)
                    );
                }

                if (row2Btns.length > 0) {
                    components.push(new ActionRowBuilder().addComponents(row2Btns));
                }

                // Pagination row
                const totalPages = getPageCount();
                if (totalPages > 1) {
                    const pageRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('mn_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('mn_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= totalPages - 1)
                    );
                    components.push(pageRow);
                }

                return components;
            };

            // ── Send ─────────────────────────────────────────────
            const message = await interaction.editReply({ embeds: [getEmbed()], components: getRows() });

            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These controls are not for you!', flags: 64 });
                }

                if (i.customId === 'mn_overview') {
                    currentView = 'OVERVIEW';
                    currentPage = 0;
                } else if (i.customId === 'mn_prev') {
                    currentPage--;
                } else if (i.customId === 'mn_next') {
                    currentPage++;
                } else if (i.customId.startsWith('mn_')) {
                    currentView = i.customId.replace('mn_', '');
                    currentPage = 0;
                }

                await i.update({ embeds: [getEmbed()], components: getRows() });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });

        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Format a list of missing tiers into compact ranges.
 * e.g. [1,2,3,5,7,8,9] → "T1-3, T5, T7-9"
 */
function formatMissingTiers(tiers) {
    if (tiers.length === 0) return 'None';
    const ranges = [];
    let start = tiers[0];
    let end = tiers[0];

    for (let i = 1; i < tiers.length; i++) {
        if (tiers[i] === end + 1) {
            end = tiers[i];
        } else {
            ranges.push(start === end ? `T${start}` : `T${start}-${end}`);
            start = tiers[i];
            end = tiers[i];
        }
    }
    ranges.push(start === end ? `T${start}` : `T${start}-${end}`);
    return ranges.join(', ');
}
