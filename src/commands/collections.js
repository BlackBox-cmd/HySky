const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { progressBar, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collections')
        .setDescription('View a player\'s collection progress')
        .addStringOption(opt =>
            opt.setName('player').setDescription('Minecraft username').setRequired(false))
        .addStringOption(opt =>
            opt.setName('profile').setDescription('Profile name').setRequired(false))
        .addStringOption(opt =>
            opt.setName('category')
                .setDescription('Filter by category')
                .setRequired(false)
                .addChoices(
                    { name: 'Farming', value: 'FARMING' },
                    { name: 'Mining', value: 'MINING' },
                    { name: 'Combat', value: 'COMBAT' },
                    { name: 'Foraging', value: 'FORAGING' },
                    { name: 'Fishing', value: 'FISHING' },
                    { name: 'Rift', value: 'RIFT' },
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const username = interaction.options.getString('player');
        const profileName = interaction.options.getString('profile');
        const category = interaction.options.getString('category');

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

            const collections = member.collection || {};
            const resData = await hypixel.getCollectionsResource();
            const collectionRes = resData.collections || {};

            let totalUnlocked = 0;
            let totalMax = 0;
            const categoryLines = {};

            for (const [cat, catData] of Object.entries(collectionRes)) {
                if (category && cat !== category) continue;

                const items = catData.items || {};
                const lines = [];

                for (const [itemId, itemInfo] of Object.entries(items)) {
                    const tiers = itemInfo.tiers || [];
                    const collected = collections[itemId] || 0;
                    const maxTier = tiers.length;
                    let unlockedTier = 0;

                    for (const tier of tiers) {
                        if (collected >= tier.amountRequired) {
                            unlockedTier = tier.tier;
                        }
                    }

                    totalUnlocked += unlockedTier;
                    totalMax += maxTier;

                    if (collected > 0) {
                        const bar = progressBar(unlockedTier, maxTier, 6);
                        lines.push(
                            `**${itemInfo.name || titleCase(itemId)}** ${bar} ${unlockedTier}/${maxTier}`
                        );
                    }
                }

                if (lines.length > 0) {
                    categoryLines[cat] = lines;
                }
            }

            let desc = `**Profile:** ${profile.cute_name || 'Unknown'}\n`;
            desc += `**Collection Tiers Unlocked:** ${totalUnlocked}/${totalMax}\n\n`;

            const categoryEmojis = {
                FARMING: '🌾', MINING: '⛏️', COMBAT: '⚔️',
                FORAGING: '🪓', FISHING: '🎣', RIFT: '🌀',
            };

            for (const [cat, lines] of Object.entries(categoryLines)) {
                const emoji = categoryEmojis[cat] || '📦';
                desc += `### ${emoji} ${titleCase(cat)}\n`;
                desc += lines.slice(0, 8).join('\n') + '\n';
                if (lines.length > 8) desc += `*...and ${lines.length - 8} more*\n`;
                desc += '\n';
            }

            const embed = playerEmbed(`📦 Collections — ${ign}`, ign, uuid)
                .setColor(COLORS.SKYBLOCK)
                .setDescription(desc.substring(0, 4000));

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
