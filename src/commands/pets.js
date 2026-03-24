const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { playerEmbed, errorEmbed } = require('../utils/embedTemplates');
const { titleCase } = require('../utils/formatNumber');
const { RARITY_COLORS, COLORS } = require('../utils/constants');

const RARITY_EMOJIS = {
    COMMON: '⬜',
    UNCOMMON: '🟢',
    RARE: '🔵',
    EPIC: '🟣',
    LEGENDARY: '🟡',
    MYTHIC: '🩷',
    DIVINE: '🩵',
    SPECIAL: '🔴',
    VERY_SPECIAL: '🔴',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pets')
        .setDescription('View a player\'s pet collection')
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

            const pets = member.pets_data?.pets || member.pets || [];

            if (!pets || pets.length === 0) {
                return interaction.editReply({
                    embeds: [errorEmbed(`${ign} has no pets on this profile.`)]
                });
            }

            // Sort by active first, then by rarity (desc), then by level (desc)
            const rarityOrder = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL'];
            const sorted = [...pets].sort((a, b) => {
                if (a.active && !b.active) return -1;
                if (!a.active && b.active) return 1;
                const rA = rarityOrder.indexOf(a.tier) !== -1 ? rarityOrder.indexOf(a.tier) : -1;
                const rB = rarityOrder.indexOf(b.tier) !== -1 ? rarityOrder.indexOf(b.tier) : -1;
                if (rB !== rA) return rB - rA;
                return (getPetLevel(b) - getPetLevel(a));
            });

            // Show top 15 pets
            const lines = sorted.slice(0, 15).map(pet => {
                const emoji = RARITY_EMOJIS[pet.tier] || '⬜';
                const name = titleCase(pet.type);
                const level = getPetLevel(pet);
                const active = pet.active ? ' **[ACTIVE]**' : '';
                const heldItem = pet.heldItem ? ` | 🔧 ${titleCase(pet.heldItem)}` : '';
                const skin = pet.skin ? ` | 🎨 ${pet.skin}` : '';
                return `${emoji} **${name}** — Lvl ${level} (${titleCase(pet.tier)})${active}${heldItem}${skin}`;
            });

            const embed = playerEmbed(`🐾 Pets — ${ign}`, ign, uuid)
                .setColor(COLORS.SKYBLOCK)
                .setDescription(
                    `**Profile:** ${profile.cute_name || 'Unknown'}\n` +
                    `**Total Pets:** ${pets.length}\n\n` +
                    lines.join('\n')
                );

            if (pets.length > 15) {
                embed.setFooter({ text: `Showing 15 of ${pets.length} pets` });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};

// Simple pet level calculator based on XP
function getPetLevel(pet) {
    const xp = pet.exp || 0;
    const tier = pet.tier || 'COMMON';
    let maxLevel = (pet.type === 'GOLDEN_DRAGON') ? 200 : 100;
    
    let targetXp = 25353230; // Legendary/Mythic
    if (tier === 'COMMON') targetXp = 5000000;
    else if (tier === 'UNCOMMON') targetXp = 7500000;
    else if (tier === 'RARE') targetXp = 10000000;
    else if (tier === 'EPIC') targetXp = 18608500;
    if (pet.type === 'GOLDEN_DRAGON') targetXp = 210653230;

    let level = 1;
    if (xp > 0) {
        level = 1 + Math.floor((maxLevel - 1) * Math.pow(Math.min(xp / targetXp, 1), 1 / 2.3));
    }
    return Math.min(Math.max(level, 1), maxLevel);
}
