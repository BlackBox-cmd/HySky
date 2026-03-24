const { SlashCommandBuilder } = require('discord.js');
const { skyblockEmbed } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available Hypixel SkyBlock Bot commands'),

    async execute(interaction) {
        const embed = skyblockEmbed('🤖 Hypixel SkyBlock Bot Help')
            .setDescription(`Here are all the available commands to explore SkyBlock data!\n💡 *Tip: If you use \`/link\`, you won't need to type your username anymore!*`)
            .addFields(
                {
                    name: '🏠 Player & Profile',
                    value: '`/link` — Link your Minecraft account\n`/unlink` — Remove your linked account\n`/stats` — Profile overview\n`/skills` — Skill levels\n`/slayer` — Slayer bosses\n`/dungeons` — Catacombs stats\n`/jacob` — Farming Contests\n`/networth` — Estimated networth\n`/bank` — Balances\n`/pets` — Active & inactive pets\n`/accessories` — Owned/Missing list\n`/mp` — Magical Power stats',
                    inline: false
                },
                {
                    name: '💰 Economy & Market',
                    value: '`/bazaar` — Live prices & volume\n`/auction` — View player auctions\n`/flipper` — Find profitable flips\n`/firesales` — Active/upcoming fire sales',
                    inline: false
                },
                {
                    name: '🗺️ Game Info & Events',
                    value: '`/mayor` — Current & upcoming mayor\n`/bingo` — Bingo events\n`/news` — SkyBlock patch notes\n`/items` — Search item database\n`/online` — Check player status\n`/collections` — Collection progress\n`/museum` — Museum donations\n`/garden` — Garden milestones & visitors',
                    inline: false
                },
                {
                    name: '🔔 Alerts & Admin',
                    value: '`/alert` — Set personal Bazaar price triggers\n`/setup` — Server admins can set an alert channel for news, mayors, and fire sales',
                    inline: false
                }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
