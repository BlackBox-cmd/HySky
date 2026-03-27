const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const strassburger = require('../api/strassburger');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const UserConfig = require('../models/UserConfig');
const { playerEmbed, skyblockEmbed, successEmbed, errorEmbed } = require('../utils/embedTemplates');
const { commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS, CROPS, CROP_EMOJIS, CROP_NAMES } = require('../utils/constants');
const ALL_CROPS_VALUE = 'all';
const ALL_CROPS_NAME = 'All Crops';

const HYPIXEL_CROP_EMOJIS = {
    WHEAT: '🌾', CARROT_ITEM: '🥕', POTATO_ITEM: '🥔', PUMPKIN: '🎃',
    MELON: '🍈', MUSHROOM_COLLECTION: '🍄', CACTUS: '🌵', SUGAR_CANE: '🎋',
    NETHER_STALK: '🟣', COCOA_BEANS: '☕',
    MOONFLOWER: '🌸', WILD_ROSE: '🌹', DOUBLE_PLANT: '🌻' 
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jacob')
        .setDescription('Commands for Jacob\'s Farming Contests')
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('View a player\'s Farming Contests stats (Medals, Perks, Brackets)')
                .addStringOption(opt =>
                    opt.setName('player').setDescription('Minecraft username').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('profile').setDescription('Profile name').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('next')
                .setDescription('View the next 3 scheduled farming contests')
        )
        .addSubcommand(sub =>
            sub.setName('subscribe')
                .setDescription('Subscribe to get DMs for a specific crop contest')
                .addStringOption(opt =>
                    opt.setName('crop')
                        .setDescription('Select crop')
                        .setRequired(true)
                        .addChoices(
                            { name: ALL_CROPS_NAME, value: ALL_CROPS_VALUE },
                            ...CROPS.map(c => ({ name: CROP_NAMES[c], value: c }))
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('unsubscribe')
                .setDescription('Unsubscribe from DMs for a specific crop contest')
                .addStringOption(opt =>
                    opt.setName('crop')
                        .setDescription('Select crop')
                        .setRequired(true)
                        .addChoices(
                            { name: ALL_CROPS_NAME, value: ALL_CROPS_VALUE },
                            ...CROPS.map(c => ({ name: CROP_NAMES[c], value: c }))
                        )
                )
        ),

    async execute(interaction) {
        // Only next should not be ephemeral (optional preference), but deferReply default is fine.
        await interaction.deferReply({ ephemeral: interaction.options.getSubcommand() !== 'next' && interaction.options.getSubcommand() !== 'stats' });
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'stats') {
                const username = interaction.options.getString('player');
                const profileName = interaction.options.getString('profile');

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

            const jacob = member.jacobs_contest;

            if (!jacob || !jacob.medals_inv) {
                return interaction.editReply({
                    embeds: [errorEmbed(`${ign} has not participated in any Jacob's Contests on this profile.`)]
                });
            }

            const medals = jacob.medals_inv || {};
            const perks = jacob.perks || {};
            
            // Medals
            const bronze = medals.bronze || 0;
            const silver = medals.silver || 0;
            const gold = medals.gold || 0;

            // Perks
            const doubleDrops = perks.double_drops || 0;
            const levelCap = perks.farming_level_cap || 0;
            const pbTracker = perks.personal_bests ? 'Unlocked ✅' : 'Locked ❌';

            // Contests total
            const totalContests = Object.keys(jacob.contests || {}).length;

            let desc = `**Profile:** ${profile.cute_name || 'Unknown'}\n`;
            desc += `**Total Contests Played:** ${commaNumber(totalContests)}\n\n`;

            desc += `### 🏅 Medals Inventory\n`;
            desc += `🥇 **Gold:** ${commaNumber(gold)}\n`;
            desc += `🥈 **Silver:** ${commaNumber(silver)}\n`;
            desc += `🥉 **Bronze:** ${commaNumber(bronze)}\n\n`;

            desc += `### 🌟 Anita's Perks\n`;
            desc += `**Farming Level Cap:** +${levelCap} (Max Lvl ${60 + levelCap})\n`;
            desc += `**Double Drops Tier:** ${doubleDrops} (+${doubleDrops * 2}% chance)\n`;
            desc += `**Personal Bests Tracking:** ${pbTracker}\n\n`;

            // Brackets
            const brackets = jacob.unique_brackets || {};
            
            // Flatten to track highest per crop
            const cropHighs = {};
            const bracketTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
            const bracketEmojis = {
                bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '🪩', diamond: '💎'
            };

            for (const tier of bracketTiers) {
                const cropsList = brackets[tier] || [];
                for (const crop of cropsList) {
                    cropHighs[crop] = tier; // Overwrites with progressively higher tiers
                }
            }

            if (Object.keys(cropHighs).length > 0) {
                desc += `### 🏆 Highest Brackets Achieved\n`;
                for (const [crop, highestTier] of Object.entries(cropHighs)) {
                    const cleanName = titleCase(crop.replace('_ITEM', '').replace('INK_SACK:3', 'COCOA_BEANS').replace('MUSHROOM_COLLECTION', 'MUSHROOM').replace('NETHER_STALK', 'NETHER_WART'));
                    const icon = HYPIXEL_CROP_EMOJIS[crop] || '🌿';
                    const highestEmoji = bracketEmojis[highestTier];
                    desc += `${icon} **${cleanName}:** ${highestEmoji} ${titleCase(highestTier)}\n`;
                }
            }

            const embed = playerEmbed(`🌾 Jacob's Contests — ${ign}`, ign, uuid)
                .setColor(COLORS.GOLD)
                .setDescription(desc);

            await interaction.editReply({ embeds: [embed] });

        } else if (sub === 'next') {
            const data = await strassburger.getJacobContests();
            if (!data || data.length === 0) {
                return interaction.editReply({ embeds: [errorEmbed('Failed to fetch Jacob contest data. API might be down or no schedule available.')] });
            }

            const upcoming = data.filter(c => new Date(c.time) > new Date()).slice(0, 3);
            if (upcoming.length === 0) {
                return interaction.editReply({ embeds: [errorEmbed('No upcoming contests found.')] });
            }

            const lines = upcoming.map(contest => {
                const time = Math.floor(new Date(contest.time).getTime() / 1000);
                const cropText = contest.crops.map(cropId => `${CROP_EMOJIS[cropId] || '🌾'} **${CROP_NAMES[cropId] || cropId}**`).join('\n* ');
                return `**Contest <t:${time}:R>**\n* ${cropText}`;
            });

            const embed = skyblockEmbed(`👨‍🌾 Upcoming Farming Contests`)
                .setDescription(lines.join('\n\n'));

            await interaction.editReply({ embeds: [embed] });

        } else if (sub === 'subscribe') {
            const crop = interaction.options.getString('crop');

            if (crop === ALL_CROPS_VALUE) {
                await UserConfig.findOneAndUpdate(
                    { discordId: interaction.user.id },
                    { $set: { jacobSubscriptions: [ALL_CROPS_VALUE] } },
                    { upsert: true, returnDocument: 'after' }
                );

                return interaction.editReply({
                    embeds: [successEmbed('✅ You will now receive a DM 5 minutes before **all crop contests**!')]
                });
            }

            const updated = await UserConfig.findOneAndUpdate(
                { discordId: interaction.user.id },
                { $addToSet: { jacobSubscriptions: crop } },
                { upsert: true, returnDocument: 'after' }
            );

            const hasAll = updated?.jacobSubscriptions?.includes(ALL_CROPS_VALUE);
            const extra = hasAll ? '\n\nYou are also subscribed to **All Crops**, so you will still receive every contest alert.' : '';

            await interaction.editReply({
                embeds: [successEmbed(`✅ You will now receive a DM 5 minutes before any **${CROP_NAMES[crop]}** contest!${extra}`)]
            });

        } else if (sub === 'unsubscribe') {
            const crop = interaction.options.getString('crop');

            if (crop === ALL_CROPS_VALUE) {
                await UserConfig.findOneAndUpdate(
                    { discordId: interaction.user.id },
                    { $set: { jacobSubscriptions: [] } },
                    { upsert: true, returnDocument: 'after' }
                );

                return interaction.editReply({
                    embeds: [successEmbed('✅ You have unsubscribed from **all crop contests** alerts.')]
                });
            }

            const updated = await UserConfig.findOneAndUpdate(
                { discordId: interaction.user.id },
                { $pull: { jacobSubscriptions: crop } },
                { returnDocument: 'after' }
            );

            const hasAll = updated?.jacobSubscriptions?.includes(ALL_CROPS_VALUE);
            const extra = hasAll ? '\n\nYou are still subscribed to **All Crops**, so all contest alerts will continue.' : '';

            await interaction.editReply({
                embeds: [successEmbed(`✅ You have unsubscribed from **${CROP_NAMES[crop]}** contest alerts.${extra}`)]
            });
        }
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
