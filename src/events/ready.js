const { startBazaarAlerts } = require('../tasks/bazaarAlerts');
const { startMayorWatch } = require('../tasks/mayorWatch');
const { startFireSaleWatch } = require('../tasks/firesaleWatch');
const { startNewsFeed } = require('../tasks/newsFeed');
const { startJacobWatch } = require('../tasks/jacobWatch');

const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {

        console.log(`\n╔══════════════════════════════════════════╗`);
        console.log(`║  🎮 HySky a Hypixel SkyBlock Bot        ║`);
        console.log(`║  Logged in as: ${client.user.tag.padEnd(24)} ║`);
        console.log(`║  Servers: ${String(client.guilds.cache.size).padEnd(29)} ║`);
        console.log(`║  Commands: ${String(client.commands.size).padEnd(28)} ║`);
        console.log(`╚══════════════════════════════════════════╝\n`);

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
