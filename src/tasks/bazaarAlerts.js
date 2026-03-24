const hypixel = require('../api/hypixel');
const config = require('../config');
const Alert = require('../models/Alert');
const { commaNumber } = require('../utils/formatNumber');
const { EmbedBuilder } = require('discord.js');

let intervalId = null;

/**
 * Start the bazaar alert polling task.
 * Checks every 60 seconds for triggered price alerts.
 * @param {import('discord.js').Client} client
 */
function startBazaarAlerts(client) {
    console.log('🔔 Bazaar alert task started (60s interval)');

    intervalId = setInterval(async () => {
        try {
            const activeAlerts = await Alert.find({ triggered: false });
            if (activeAlerts.length === 0) return;

            const products = await hypixel.getBazaar();

            for (const alert of activeAlerts) {
                const product = products[alert.itemId];
                if (!product) continue;

                const currentBuyVal = product.quick_status?.sellPrice || 0; // Price to Buy
                const currentSellVal = product.quick_status?.buyPrice || 0; // Price to Sell
                let triggered = false;
                let currentPrice = 0;

                if (alert.type === 'bazaar_above' && currentSellVal >= alert.targetPrice) {
                    triggered = true;
                    currentPrice = currentSellVal;
                }
                if (alert.type === 'bazaar_below' && currentBuyVal <= alert.targetPrice) {
                    triggered = true;
                    currentPrice = currentBuyVal;
                }

                if (triggered) {
                    alert.triggered = true;
                    await alert.save();

                    // DM the user
                    try {
                        const user = await client.users.fetch(alert.userId);
                        const condText = alert.type === 'bazaar_above' ? '📈 went ABOVE' : '📉 went BELOW';
                        const itemName = alert.itemId.replace(/_/g, ' ');

                        const embed = new EmbedBuilder()
                            .setColor(0xFFAA00)
                            .setTitle('🔔 Bazaar Price Alert Triggered!')
                            .setDescription(
                                `**${itemName}** ${condText} your target!\n\n` +
                                `**Current Price:** 🪙 ${commaNumber(currentPrice.toFixed(1))}\n` +
                                `**Your Target:** 🪙 ${commaNumber(alert.targetPrice)}`
                            )
                            .setTimestamp()
                            .setFooter({ text: config.discord.footerText });

                        await user.send({ embeds: [embed] });
                    } catch (dmErr) {
                        console.warn(`Could not DM user ${alert.userId}:`, dmErr.message);
                    }
                }
            }
        } catch (err) {
            console.error('Bazaar alert task error:', err.message);
        }
    }, 60000); // Every 60 seconds
}

function stopBazaarAlerts() {
    if (intervalId) clearInterval(intervalId);
}

module.exports = { startBazaarAlerts, stopBazaarAlerts };
