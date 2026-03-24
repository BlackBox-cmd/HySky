const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.data) {
            commands.push(command.data.toJSON());
            console.log(`📝 Registered: /${command.data.name}`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(config.discord.token);

    try {
        console.log(`\n🔄 Deploying ${commands.length} slash commands...`);

        const appId = (await rest.get(Routes.oauth2CurrentApplication())).id;

        // If GUILD_ID is still in config, clear those old localized commands first
        if (config.discord.guildId) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(appId, config.discord.guildId),
                    { body: [] }
                );
                console.log(`🧹 Cleared old localized commands from guild: ${config.discord.guildId}`);
            } catch (clearErr) {
                console.warn(`⚠️ Could not clear old guild commands: ${clearErr.message}`);
            }
        }

        // Deploy Globally (required for multi-server support)
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log('✅ Deployed globally! (Allows the bot to be used in multiple servers)');
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
}

deployCommands();
