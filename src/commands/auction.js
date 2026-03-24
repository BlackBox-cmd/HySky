const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { auctionEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, timeAgo, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auction')
        .setDescription('View auctions')
        .addSubcommand(sub =>
            sub.setName('player')
                .setDescription('View a player\'s active auctions')
                .addStringOption(opt =>
                    opt.setName('player').setDescription('Minecraft username').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('search')
                .setDescription('Search active auctions for a specific item')
                .addStringOption(opt =>
                    opt.setName('item').setDescription('Item name to search').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Auction type')
                        .addChoices(
                            { name: 'BIN (Buy It Now)', value: 'bin' },
                            { name: 'Auction (Bidding)', value: 'auction' },
                            { name: 'All', value: 'all' }
                        )
                        .setRequired(false))),

    async execute(interaction) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'player') {
                await handlePlayerAuctions(interaction);
            } else if (sub === 'search') {
                await handleSearch(interaction);
            }
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};

async function handlePlayerAuctions(interaction) {
    const username = interaction.options.getString('player');
    
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

    const auctions = await hypixel.getAuction({ player: uuid });

    if (!auctions || auctions.length === 0) {
        return interaction.editReply({
            embeds: [errorEmbed(`${ign} has no active auctions.`)]
        });
    }

    const lines = auctions.slice(0, 10).map((a, i) => {
        const bin = a.bin ? '🏷️ BIN' : '🔨 Bid';
        const price = a.bin
            ? commaNumber(a.starting_bid)
            : commaNumber(a.highest_bid_amount || a.starting_bid);
        const bids = a.bin ? '' : ` (${a.bids?.length || 0} bids)`;
        const end = `<t:${Math.floor(a.end / 1000)}:R>`;

        return `${i + 1}. ${bin} **${a.item_name}** — 🪙 ${price}${bids}\n   Ends: ${end}`;
    });

    const embed = auctionEmbed(`${ign}'s Auctions`)
        .setDescription(
            `**Total Active:** ${auctions.length}\n\n` +
            lines.join('\n\n')
        );

    if (auctions.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${auctions.length} auctions • ${config.discord.footerText}` });
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleSearch(interaction) {
    const itemName = interaction.options.getString('item').toLowerCase();
    const typeFilter = interaction.options.getString('type') || 'all';

    // Fetch first page of active auctions
    const data = await hypixel.getActiveAuctions(0);
    const totalPages = data.totalPages || 1;

    // Search through first few pages (limit to avoid rate limiting)
    let allMatches = [];
    const pagesToSearch = Math.min(totalPages, 3);

    for (let p = 0; p < pagesToSearch; p++) {
        const pageData = p === 0 ? data : await hypixel.getActiveAuctions(p);
        const auctions = pageData.auctions || [];

        const matches = auctions.filter(a => {
            const nameMatch = a.item_name?.toLowerCase().includes(itemName);
            if (!nameMatch) return false;
            if (typeFilter === 'bin') return a.bin === true;
            if (typeFilter === 'auction') return !a.bin;
            return true;
        });

        allMatches.push(...matches);
    }

    // Sort BINs by price ascending, auctions by highest bid
    allMatches.sort((a, b) => {
        const priceA = a.bin ? a.starting_bid : (a.highest_bid_amount || a.starting_bid);
        const priceB = b.bin ? b.starting_bid : (b.highest_bid_amount || b.starting_bid);
        return priceA - priceB;
    });

    if (allMatches.length === 0) {
        return interaction.editReply({
            embeds: [errorEmbed(`No auctions found for "${itemName}".`)]
        });
    }

    const lines = allMatches.slice(0, 10).map((a, i) => {
        const bin = a.bin ? '🏷️ BIN' : '🔨 Bid';
        const price = a.bin
            ? commaNumber(a.starting_bid)
            : commaNumber(a.highest_bid_amount || a.starting_bid);
        const tier = a.tier ? ` [${titleCase(a.tier)}]` : '';
        const end = `<t:${Math.floor(a.end / 1000)}:R>`;

        return `${i + 1}. ${bin} **${a.item_name}**${tier}\n   🪙 ${price} — Ends ${end}`;
    });

    const embed = auctionEmbed(`Search: "${itemName}"`)
        .setDescription(
            `**Found:** ${allMatches.length} auctions (searched ${pagesToSearch}/${totalPages} pages)\n\n` +
            lines.join('\n\n')
        );

    await interaction.editReply({ embeds: [embed] });
}
