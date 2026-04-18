const { skyblockEmbed } = require('../utils/embedTemplates');
const { CROP_EMOJIS, CROP_NAMES } = require('../utils/constants');
const strassburger = require('../api/strassburger');
const GuildConfig = require('../models/GuildConfig');
const UserConfig = require('../models/UserConfig');

let timeoutId = null;

function calculateNextTick() {
    const now = new Date();
    const next = new Date(now);
    
    // Contests happen every hour at XX:15. We want to alert at XX:10.
    if (now.getMinutes() >= 10) {
        next.setHours(next.getHours() + 1);
    }
    next.setMinutes(10);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    return next.getTime() - now.getTime();
}

function startJacobWatch(client) {
    console.log('🌾 Jacob watch task scheduled.');
    scheduleNext(client);
}

function scheduleNext(client) {
    const delay = calculateNextTick();
    timeoutId = setTimeout(() => {
        execute(client);
        scheduleNext(client);
    }, delay);
}

async function execute(client) {
    try {
        const data = await strassburger.getJacobContests();
        if (!data || data.length === 0) return;

        // Find the next contest
        const nextContest = data.find(c => new Date(c.time) > new Date());
        if (!nextContest) return;
        
        // Ensure this contest is the one starting in exactly 5 minutes (approx)
        const timeDiff = new Date(nextContest.time).getTime() - Date.now();
        if (timeDiff > 7 * 60 * 1000 || timeDiff < 3 * 60 * 1000) return;

        const cropText = nextContest.crops.map(cropId => `${CROP_EMOJIS[cropId] || '<a:WHEAT_enchanted:1487603410592071760>'} **${CROP_NAMES[cropId] || cropId}**`).join('\n* ');
        const timestamp = Math.floor(new Date(nextContest.time).getTime() / 1000);

        const buildEmbed = (title) => skyblockEmbed(title).setDescription(`**Contest <t:${timestamp}:R>**\n* ${cropText}`);

        const embedStart = buildEmbed('👨‍🌾 Farming Contest Starting in 5 Minutes!');
        const embedProgress = buildEmbed('👨‍🌾 Farming Contest In Progress!');
        const embedEnded = buildEmbed('👨‍🌾 Farming Contest Ended!');

        // 1. Send to Guilds
        const guilds = await GuildConfig.find({ jacobChannelId: { $ne: null } });
        for (const guild of guilds) {
            try {
                const channel = await client.channels.fetch(guild.jacobChannelId);
                if (channel) {
                    const msg = await channel.send({ embeds: [embedStart] });
                    setTimeout(() => msg.edit({ embeds: [embedProgress] }).catch(() => {}), 5 * 60 * 1000);
                    setTimeout(() => msg.edit({ embeds: [embedEnded] }).catch(() => {}), 25 * 60 * 1000);
                }
            } catch (err) {
                // Ignore missing channels
            }
        }

        // 2. Send to Users (DMs)
        const subscriptionKeys = [...new Set([...nextContest.crops, 'all'])];
        const users = await UserConfig.find({ jacobSubscriptions: { $in: subscriptionKeys } });
        for (const user of users) {
            try {
                const discordUser = await client.users.fetch(user.discordId);
                if (discordUser) {
                    const msg = await discordUser.send({ embeds: [embedStart] });
                    setTimeout(() => msg.edit({ embeds: [embedProgress] }).catch(() => {}), 5 * 60 * 1000);
                    setTimeout(() => msg.edit({ embeds: [embedEnded] }).catch(() => {}), 25 * 60 * 1000);
                }
            } catch (err) {
                // Cannot DM user
            }
        }
    } catch (err) {
        console.error('Jacob watch error:', err.message);
    }
}

function stopJacobWatch() {
    if (timeoutId) clearTimeout(timeoutId);
}

module.exports = { startJacobWatch, stopJacobWatch };
