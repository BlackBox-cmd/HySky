const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const mojang = require('../api/mojang');
const LinkedAccount = require('../models/LinkedAccount');
const { skyblockEmbed, playerEmbed, errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bingo')
        .setDescription('View current Bingo event or a player\'s Bingo progress')
        .addStringOption(opt =>
            opt.setName('player')
                .setDescription('Player username (leave blank for event goals)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const username = interaction.options.getString('player');

        try {
            if (username) {
                // Explicit player argument
                const { id: uuid, name: ign } = await mojang.getUUID(username);
                return await showPlayerBingo(interaction, uuid, ign);
            }

            // Try linked account for player bingo card
            const link = await LinkedAccount.findOne({ discordId: interaction.user.id });
            if (link) {
                return await showPlayerBingo(interaction, link.minecraftUuid, link.minecraftName);
            }

            // No player and no linked account — show event goals
            const event = await hypixel.getBingoEvent();
            if (!event || !event.goals) {
                return interaction.editReply({
                    embeds: [errorEmbed('No active Bingo event.')]
                });
            }

            const goals = event.goals || [];
            const goalLines = goals.slice(0, 20).map((g, i) => {
                const name = g.name || `Goal ${i + 1}`;
                const lore = g.lore ? ` — *${g.lore.substring(0, 80)}*` : '';
                return `${i + 1}. **${name}**${lore}`;
            });

            const embed = skyblockEmbed('🎯 Current Bingo Event')
                .setColor(0xFF6347)
                .setDescription(
                    `**Event ID:** ${event.id || 'Unknown'}\n\n` +
                    goalLines.join('\n')
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};

async function showPlayerBingo(interaction, uuid, ign) {
    const events = await hypixel.getBingo(uuid);

    if (!events || events.length === 0) {
        return interaction.editReply({
            embeds: [errorEmbed(`${ign} has no Bingo data.`)]
        });
    }

    const latest = events[events.length - 1];
    const completed = latest.completed_goals || [];
    const total = 20;

    const embed = playerEmbed(`🎯 Bingo — ${ign}`, ign, uuid)
        .setColor(0xFF6347)
        .setDescription(
            `**Bingo Key:** ${latest.key || 'Unknown'}\n` +
            `**Completed Goals:** ${completed.length}/${total}\n` +
            `**Points Earned:** ${latest.points || 0}\n\n` +
            `### ✅ Completed Goals\n` +
            (completed.length > 0
                ? completed.map(g => `• ${g}`).join('\n')
                : 'No goals completed yet.')
        );

    return interaction.editReply({ embeds: [embed] });
}
