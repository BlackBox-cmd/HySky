const { startBazaarAlerts } = require('../tasks/bazaarAlerts');
const { startMayorWatch } = require('../tasks/mayorWatch');
const { startFireSaleWatch } = require('../tasks/firesaleWatch');
const { startNewsFeed } = require('../tasks/newsFeed');
const { startJacobWatch } = require('../tasks/jacobWatch');
const config = require('../config');

const { Events, ActivityType, REST, Routes } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {

        console.log(`\n╔══════════════════════════════════════════╗`);
        console.log(`║  🎮 HySky a Hypixel SkyBlock Bot        ║`);
        console.log(`║  Logged in as: ${client.user.tag.padEnd(24)} ║`);
        console.log(`║  Servers: ${String(client.guilds.cache.size).padEnd(29)} ║`);
        console.log(`║  Commands: ${String(client.commands.size).padEnd(28)} ║`);
        console.log(`╚══════════════════════════════════════════╝\n`);

        // ── Auto-deploy slash commands ───────────────────────────
        try {
            const commands = client.commands
                .filter(cmd => cmd.data)
                .map(cmd => cmd.data.toJSON());

            const rest = new REST({ version: '10' }).setToken(config.discord.token);

            // Clear old guild-scoped commands if GUILD_ID exists
            if (config.discord.guildId) {
                try {
                    await rest.put(
                        Routes.applicationGuildCommands(client.user.id, config.discord.guildId),
                        { body: [] }
                    );
                    console.log(`🧹 Cleared old guild commands from: ${config.discord.guildId}`);
                } catch (clearErr) {
                    // Not critical — guild may no longer exist
                }
            }

            // Deploy globally
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log(`🚀 Deployed ${commands.length} slash commands globally`);
        } catch (deployErr) {
            console.error('⚠️  Failed to auto-deploy commands:', deployErr.message);
            console.warn('⚠️  Bot will continue running with previously deployed commands.');
        }

        // Set bot activity
        client.user.setActivity('Hypixel SkyBlock | /stats', { type: ActivityType.Playing });

        // Start background tasks
        startBazaarAlerts(client);
        startMayorWatch(client);
        startFireSaleWatch(client);
        startNewsFeed(client);
        startJacobWatch(client);

        console.log('✅ All systems online!\n');
    },
};
