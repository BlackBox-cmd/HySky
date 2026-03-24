const { SlashCommandBuilder } = require('discord.js');
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mp')
        .setDescription('View a player\'s Magical Power breakdown and accessory list')
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
            if (!bagData) {
                return interaction.editReply({
                    embeds: [errorEmbed(`${ign} has no accessories or their API is disabled.`)]
                });
            }

            const rawItems = await decodeInventoryData(bagData);
            const accessories = extractSkyBlockItems(rawItems);

            if (accessories.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed(`${ign} has an empty accessory bag.`)]
                });
            }

            // Calculate MP and group by rarity
            const rarityGroups = {};
            let calculatedMP = 0;

            for (const acc of accessories) {
                let rarity = 'COMMON';
                const lore = acc._raw?.tag?.display?.Lore || [];
                
                // Parse lore to find rarity (it handles Recombobulators naturally!)
                for (const line of lore) {
                    const clean = line.replace(/§[0-9a-fk-or]/g, '');
                    const catRegex = /(ACCESSORY|HATCCESSORY|NECKLACE|CLOAK|BELT|GLOVES|BRACELET)/;
                    if (catRegex.test(clean)) {
                        const foundRarity = clean.split(' ')[0];
                        if (MP_VALUES[foundRarity]) rarity = foundRarity;
                    }
                }

                const mp = MP_VALUES[rarity] || 0;
                // Add enrichment MP if present
                const hasEnrichment = acc._raw?.tag?.ExtraAttributes?.talisman_enrichment;
                const totalMp = mp + (hasEnrichment ? 1 : 0);

                calculatedMP += totalMp;

                if (!rarityGroups[rarity]) rarityGroups[rarity] = [];
                
                const itemName = acc._raw?.tag?.display?.Name?.replace(/§[0-9a-fk-or]/g, '') || titleCase(acc.id);
                // Clean off reforge prefixes for cleaner display (optional, but requested to show "which item giving how may power")
                rarityGroups[rarity].push(`${itemName} **(+${totalMp})**`);
            }

            const storage = member.accessory_bag_storage || {};
            const apiMP = storage.highest_magical_power || calculatedMP;
            const selectedPower = storage.selected_power ? titleCase(storage.selected_power) : 'None';

            let desc = `**Profile:** ${profile.cute_name || 'Unknown'}\n`;
            desc += `🪄 **Total Magical Power:** ${commaNumber(apiMP)}\n`;
            desc += `🔮 **Selected Power:** ${selectedPower}\n\n`;

            desc += `### 🎒 Accessories Breakdown\n`;
            
            // Sort rarities by highest MP to lowest
            const sortedRarities = Object.keys(rarityGroups).sort((a,b) => (MP_VALUES[b]||0) - (MP_VALUES[a]||0));

            for (const r of sortedRarities) {
                const items = rarityGroups[r];
                desc += `**${titleCase(r)} (${items.length}):**\n> ${items.join(', ')}\n\n`;
            }

            // Truncate if discord limits (4096)
            if (desc.length > 4000) {
                desc = desc.substring(0, 3950) + '\n\n*...and more (List truncated due to Discord length limits)*';
            }

            const embed = playerEmbed(`🪄 Magical Power — ${ign}`, ign, uuid)
                .setColor(COLORS.SKYBLOCK)
                .setDescription(desc);

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
