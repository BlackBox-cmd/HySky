const { errorEmbed } = require('../utils/embedTemplates');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.warn(`⚠️ Unknown command: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Error in /${interaction.commandName}:`, error);
                const embed = errorEmbed(error.message || 'An unexpected error occurred.');
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ embeds: [embed] }).catch(() => {});
                } else {
                    await interaction.reply({ embeds: [embed], flags: 64 }).catch(() => {});
                }
            }
        }

        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`❌ Autocomplete error in /${interaction.commandName}:`, error);
            }
        }
    },
};
