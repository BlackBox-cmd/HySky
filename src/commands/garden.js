const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, progressBar, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

const CROP_EMOJIS = {
    WHEAT: '<a:WHEAT_enchanted:1487603410592071760>',
    CARROT: '<a:CARROT_ITEM_enchanted:1487603049638920372>',
    POTATO: '<a:POTATO_ITEM_enchanted:1487603336264810537>',
    PUMPKIN: '<a:PUMPKIN_enchanted:1487603457383727145>',
    MELON: '<a:MELON_enchanted:1487603102147412140>',
    MUSHROOM: '🍄',
    CACTUS: '<a:CACTUS_enchanted:1487602982995497142>',
    SUGAR_CANE: '<a:SUGAR_CANE_enchanted:1487603265871937566>',
    NETHER_WART: '<a:NETHER_WART_enchanted:1487603509749616690>',
    COCOA_BEANS: '<a:ENCHANTED_COCOA_enchanted:1487603935584976956>',
    SUNFLOWER: '<a:ENCHANTED_SUNFLOWER_enchanted:1487604021781991535>',
    MOONFLOWER: '<a:MOONFLOWER_enchanted:1487603153254879312>',
    WILD_ROSE: '<a:ENCHANTED_WILD_ROSE_enchanted:1487603373577605180>',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('garden')
        .setDescription('View a player\'s garden stats')
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

            const gardenData = await hypixel.getGarden(profile.profile_id);
            const garden = gardenData.garden || gardenData;

            const copper = member.garden_player_data?.copper || 0;
            const plotsUnlocked = garden.unlocked_plots_ids?.length || 0;
            const activeVisitors = Object.keys(garden.active_commissions || {}).length;

            let desc = `**Profile:** ${profile.cute_name || 'Unknown'}\n`;

            // Garden level
            const gardenXP = garden.garden_experience || 0;
            desc += `**Garden Level:** ${getGardenLevel(gardenXP)} (${formatNumber(gardenXP)} XP)\n`;
            desc += `**💳 Copper:** ${commaNumber(copper)}\n`;
            desc += `**🏞️ Plots Unlocked:** ${plotsUnlocked}/25\n\n`;

            // Crop Upgrades
            const cropUpgrades = garden.crop_upgrade_levels || {};
            if (Object.keys(cropUpgrades).length > 0) {
                desc += `### 🌱 Crop Upgrades\n`;
                for (const [crop, level] of Object.entries(cropUpgrades)) {
                    if (level > 0) {
                        const emoji = CROP_EMOJIS[crop.toUpperCase().replace('_ITEM', '').replace('INK_SACK:3', 'COCOA_BEANS')] || '🌿';
                        desc += `${emoji} **${titleCase(crop.replace('_ITEM', '').replace('INK_SACK:3', 'COCOA_BEANS'))}:** Lvl ${level}\n`;
                    }
                }
                desc += '\n';
            }

            // Composter stats
            const composter = garden.composter_data || {};
            if (Object.keys(composter).length > 0) {
                desc += `### ♻️ Composter\n`;
                desc += `**Organic Matter:** ${formatNumber(composter.organic_matter || 0)}\n`;
                desc += `**Fuel Units:** ${formatNumber(composter.fuel_units || 0)}\n`;
                desc += `**Compost Generated:** ${commaNumber(composter.compost_items || 0)}\n`;
                
                const upgrades = composter.upgrades || {};
                if (Object.keys(upgrades).length > 0) {
                    desc += `*Upgrades: Speed ${upgrades.speed||0}, Multi-Drop ${upgrades.multi_drop||0}, Cost ${upgrades.cost_reduction||0}*\n`;
                }
                desc += '\n';
            }

            // Visitors
            const visitors = garden.commission_data || {};
            const activeCommissions = garden.active_commissions || {};
            const totalVisitors = visitors.total_completed || 0;
            const uniqueVisitors = visitors.unique_npcs_served || 0;
            if (totalVisitors > 0 || uniqueVisitors > 0 || activeVisitors > 0) {
                desc += `### 👥 Visitors\n`;
                desc += `**Waiting Right Now:** ${activeVisitors}\n`;
                
                if (activeVisitors > 0) {
                    for (const [npc, data] of Object.entries(activeCommissions)) {
                        const name = titleCase(npc);
                        const reqs = data.requirement || [];
                        const reqStrings = reqs.map(r => `${commaNumber(r.amount)}x ${titleCase(r.item || r.original_item)}`);
                        desc += `> **${name}:** ${reqStrings.join(', ')}\n`;
                    }
                    desc += '\n';
                }

                desc += `**Total Served:** ${commaNumber(totalVisitors)}\n`;
                desc += `**Unique Served:** ${commaNumber(uniqueVisitors)}\n`;
            }

            const embed = playerEmbed(`🪴 Garden — ${ign}`, ign, uuid)
                .setColor(0x228B22)
                .setDescription(desc);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};

function getGardenLevel(xp) {
    // Simplified garden level calculation
    const thresholds = [0, 70, 100, 140, 240, 600, 1500, 2000, 2500, 3000, 10000, 10000, 10000, 10000, 10000];
    let level = 0;
    let totalNeeded = 0;
    for (let i = 0; i < thresholds.length; i++) {
        totalNeeded += thresholds[i];
        if (xp >= totalNeeded) level = i + 1;
        else break;
    }
    return level;
}
