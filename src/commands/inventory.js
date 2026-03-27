const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { decodeInventoryData, extractSkyBlockItems } = require('../utils/nbtParser');
const { commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

// ── Bag definitions ──────────────────────────────────────────────
const BAGS = [
    { id: 'inv',            label: '🎒 Inventory',       path: m => m.inventory?.inv_contents?.data },
    { id: 'ender_chest',    label: '🟪 Ender Chest',     path: m => m.inventory?.ender_chest_contents?.data },
    { id: 'personal_vault', label: '🔒 Personal Vault',  path: m => m.inventory?.personal_vault_contents?.data },
    { id: 'talisman_bag',   label: '📿 Talisman Bag',    path: m => m.inventory?.bag_contents?.talisman_bag?.data },
    { id: 'potion_bag',     label: '🧪 Potion Bag',      path: m => m.inventory?.bag_contents?.potion_bag?.data },
    { id: 'fishing_bag',    label: '🎣 Fishing Bag',     path: m => m.inventory?.bag_contents?.fishing_bag?.data },
    { id: 'quiver',         label: '🏹 Quiver',          path: m => m.inventory?.bag_contents?.quiver?.data },
    { id: 'wardrobe',       label: '👔 Wardrobe',        path: m => m.inventory?.wardrobe_contents?.data },
    { id: 'equipment',      label: '⚙️ Equipment',       path: m => m.inventory?.equipment_contents?.data },
];

const RARITY_EMOJIS = {
    COMMON: '⬜', UNCOMMON: '🟢', RARE: '🔵', EPIC: '🟣',
    LEGENDARY: '🟡', MYTHIC: '🩷', DIVINE: '🩵', SPECIAL: '🔴', VERY_SPECIAL: '🔴',
};

const ITEMS_PER_PAGE = 15;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Browse a player\'s bags — backpack, ender chest, talisman bag, and more')
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

            // Pre-decode all bags
            const decoded = {};
            for (const bag of BAGS) {
                const raw = bag.path(member);
                if (raw) {
                    const rawItems = await decodeInventoryData(raw);
                    decoded[bag.id] = parseItems(rawItems);
                } else {
                    decoded[bag.id] = [];
                }
            }

            let currentBag = 'inv';
            let currentPage = 0;

            // ── Build helpers ────────────────────────────────────
            const getPages = () => {
                const items = decoded[currentBag] || [];
                if (items.length === 0) return ['*This bag is empty or the Inventory API is disabled.*'];

                const bagMeta = BAGS.find(b => b.id === currentBag);
                const header = `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `**${bagMeta.label}** — ${items.length} item${items.length !== 1 ? 's' : ''}\n\n`;

                const lines = items.map((item, idx) => {
                    const emoji = RARITY_EMOJIS[item.rarity] || '⬜';
                    const count = item.count > 1 ? ` x${commaNumber(item.count)}` : '';
                    return `${emoji} **${item.name}**${count}`;
                });

                const pages = [];
                for (let i = 0; i < lines.length; i += ITEMS_PER_PAGE) {
                    pages.push(header + lines.slice(i, i + ITEMS_PER_PAGE).join('\n'));
                }
                return pages;
            };

            const getEmbed = () => {
                const pages = getPages();
                if (currentPage >= pages.length) currentPage = 0;

                const embed = playerEmbed(`🎒 Inventory — ${ign}`, ign, uuid)
                    .setColor(COLORS.SKYBLOCK)
                    .setDescription(pages[currentPage]);

                if (pages.length > 1) {
                    embed.setFooter({ text: `Page ${currentPage + 1} of ${pages.length} • Powered by HySky` });
                } else {
                    embed.setFooter({ text: 'Powered by HySky' });
                }
                return embed;
            };

            const getRows = () => {
                const components = [];

                // Bag selection menu
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('bag_select')
                    .setPlaceholder('Select a bag to view')
                    .addOptions(BAGS.map(b => ({
                        label: b.label.replace(/^.\s*/, ''),   // strip emoji for label
                        value: b.id,
                        emoji: b.label.split(' ')[0],
                        description: `${(decoded[b.id] || []).length} items`,
                        default: b.id === currentBag,
                    })));
                components.push(new ActionRowBuilder().addComponents(menu));

                // Pagination
                const pages = getPages();
                if (pages.length > 1) {
                    const pageRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('page_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
                        new ButtonBuilder().setCustomId('page_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= pages.length - 1)
                    );
                    components.push(pageRow);
                }

                return components;
            };

            // ── Send initial reply ───────────────────────────────
            const message = await interaction.editReply({ embeds: [getEmbed()], components: getRows() });

            const collector = message.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'These controls are not for you!', flags: 64 });
                }

                if (i.isStringSelectMenu() && i.customId === 'bag_select') {
                    currentBag = i.values[0];
                    currentPage = 0;
                } else if (i.isButton()) {
                    if (i.customId === 'page_prev') currentPage--;
                    else if (i.customId === 'page_next') currentPage++;
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

// ── Item parsing ─────────────────────────────────────────────────

function parseItems(rawItems) {
    const items = [];
    for (const item of rawItems) {
        if (!item || !item.tag) continue;

        const name = cleanName(item.tag?.display?.Name) || titleCase(item.tag?.ExtraAttributes?.id || 'Unknown Item');
        const count = item.Count || 1;

        // Determine rarity from lore
        let rarity = 'COMMON';
        const lore = item.tag?.display?.Lore || [];
        for (const line of lore) {
            const clean = line.replace(/§[0-9a-fk-or]/g, '');
            const match = clean.match(/^(COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SPECIAL|VERY SPECIAL|SUPREME)/);
            if (match) {
                rarity = match[1].replace(' ', '_');
                break;
            }
        }

        items.push({ name, count, rarity });
    }
    return items;
}

function cleanName(name) {
    if (!name) return null;
    return name.replace(/§[0-9a-fk-or]/g, '').trim();
}
