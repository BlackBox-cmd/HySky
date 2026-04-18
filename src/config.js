require('dotenv').config();

module.exports = {
    discord: {
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.GUILD_ID, // Kept to clear old commands if present
        footerText: process.env.FOOTER_TEXT || 'HySky Bot | Made by Mr_Freak_cmd | v1.1.1',
    },
    hypixel: {
        apiKey: process.env.HYPIXEL_API_KEY,
        baseUrl: 'https://api.hypixel.net/v2',
    },
    mojang: {
        baseUrl: 'https://api.mojang.com',
    },
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hypixel-skyblock-bot',
    },
    cache: {
        profileTTL: 300,      // 5 minutes
        bazaarTTL: 60,         // 1 minute
        auctionTTL: 120,       // 2 minutes
        resourceTTL: 3600,     // 1 hour
        mojangTTL: 600,        // 10 minutes
    },
    uptimeKuma: {
        url: process.env.UPTIME_KUMA_URL,
        interval: parseInt(process.env.UPTIME_KUMA_INTERVAL) || 30,
    },
};
