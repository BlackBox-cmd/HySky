const { SlashCommandBuilder } = require('discord.js');
const hypixel = require('../api/hypixel');
const { skyblockEmbed, errorEmbed } = require('../utils/embedTemplates');
const { titleCase } = require('../utils/formatNumber');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mayor')
        .setDescription('View the current SkyBlock Mayor and election info'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const data = await hypixel.getElection();

            const mayor = data.mayor;
            if (!mayor) {
                return interaction.editReply({
                    embeds: [errorEmbed('No mayor data available.')]
                });
            }

            // Mayor info
            const perks = (mayor.perks || []).map(p =>
                `• **${p.name}** — ${p.description}`
            );

            let desc = `## 🏛️ Current Mayor: ${mayor.name}\n` +
                `**Key:** ${mayor.key || 'N/A'}\n\n` +
                `### Perks\n` +
                (perks.length > 0 ? perks.join('\n') : 'No perks listed.');

            // Election info (if running)
            const election = data.current;
            if (election && election.candidates) {
                desc += `\n\n### 🗳️ Next Election`;
                const year = election.year || '?';
                desc += `\n**Year:** ${year}\n`;

                for (const candidate of election.candidates) {
                    const votes = candidate.votes || 0;
                    const candidatePerks = (candidate.perks || []).map(p => p.name).join(', ');
                    desc += `\n**${candidate.name}** — ${votes.toLocaleString()} votes\n`;
                    if (candidatePerks) desc += `Perks: *${candidatePerks}*\n`;
                }
            }

            const embed = skyblockEmbed('🗳️ Mayor & Election')
                .setColor(0x4169E1)
                .setDescription(desc);

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply({ embeds: [errorEmbed(err.message)] });
        }
    },
};
