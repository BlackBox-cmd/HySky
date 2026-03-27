const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { formatNumber, commaNumber, titleCase } = require('../utils/formatNumber');
const { COLORS } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('networth')
        .setDescription('Estimate a player\'s networth from bank, purse, and Bazaar prices')
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

            const purse = member.currencies?.coin_purse ?? member.coin_purse ?? 0;
            const bank = profile.banking?.balance ?? 0;

            // ── Estimate from various sources ──
            const breakdown = [];
            let total = 0;

            // Bank + Purse
            const liquid = purse + bank;
            total += liquid;
            breakdown.push({ name: '🪙 Purse', value: purse });
            breakdown.push({ name: '🏦 Bank', value: bank });

            // Sacks — estimate from sack contents
            const sackCounts = member.inventory?.sacks_counts ?? 
                               member.shared_inventory?.sacks_counts ?? 
                               profile.sacks_counts ?? 
                               profile.shared_inventory?.sacks_counts ?? {};
            let sackValue = 0;
            const bazaar = await hypixel.getBazaar();
            for (const [item, count] of Object.entries(sackCounts)) {
                if (count > 0 && bazaar[item]) {
                    const price = bazaar[item].quick_status?.buyPrice || 0;
                    sackValue += price * count;
                }
            }
            if (sackValue > 0) {
                total += sackValue;
                breakdown.push({ name: '🎒 Sacks', value: sackValue });
            }

            // Essence
            const essences = member.currencies?.essence || {};
            for (const [type, data] of Object.entries(essences)) {
                const amount = data?.current || 0;
                if (amount > 0) {
                    const essenceId = `ESSENCE_${type.toUpperCase()}`;
                    if (bazaar[essenceId]) {
                        const price = bazaar[essenceId].quick_status?.buyPrice || 0;
                        const val = price * amount;
                        total += val;
                        breakdown.push({ name: `✨ ${titleCase(type)} Essence`, value: val });
                    }
                }
            }

            // Note: Full networth calculation (inventory items, pets, armor)
            // requires NBT decoding which is complex. This gives a baseline.

            const lines = breakdown.map(b =>
                `${b.name}: **${commaNumber(Math.floor(b.value))}** coins`
            );

            const embed = playerEmbed(`💰 Networth — ${ign}`, ign, uuid)
                .setColor(COLORS.GOLD)
                .setDescription(
                    `**Profile:** ${profile.cute_name || 'Unknown'}\n\n` +
                    `## 💎 Estimated Networth: ${formatNumber(total)} coins\n` +
                    `*(${commaNumber(Math.floor(total))} coins)*\n\n` +
                    `### Breakdown\n` +
                    lines.join('\n') + '\n\n' +
                    `> ⚠️ *This is a partial estimate based on liquid coins, sacks, and essences. ` +
                    `Full inventory/pet/armor valuation requires NBT data decoding.*`
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
