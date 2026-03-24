const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config');

const cache = new NodeCache({ stdTTL: config.cache.profileTTL, checkperiod: 60 });

const api = axios.create({
    baseURL: config.hypixel.baseUrl,
    headers: { 'API-Key': config.hypixel.apiKey },
    timeout: 10000,
});

// ── Helpers ──────────────────────────────────────────────────────

function cached(key, ttl, fetcher) {
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    return fetcher().then(data => {
        cache.set(key, data, ttl);
        return data;
    });
}

async function get(endpoint, params = {}) {
    try {
        const { data } = await api.get(endpoint, { params });
        if (!data.success) {
            throw new Error(data.cause || 'Hypixel API returned unsuccessful response');
        }
        return data;
    } catch (err) {
        if (err.response) {
            const status = err.response.status;
            if (status === 429) throw new Error('Rate limited by Hypixel API. Please wait a moment.');
            if (status === 403) throw new Error('Invalid Hypixel API key.');
            if (status === 422) throw new Error('Invalid request parameters.');
        }
        throw new Error(`Hypixel API error: ${err.message}`);
    }
}

// ── Player Data ──────────────────────────────────────────────────

async function getPlayer(uuid) {
    return cached(`player:${uuid}`, config.cache.profileTTL, () =>
        get('/player', { uuid }).then(d => d.player)
    );
}

async function getStatus(uuid) {
    return cached(`status:${uuid}`, 30, () =>
        get('/status', { uuid }).then(d => d.session)
    );
}

async function getRecentGames(uuid) {
    return cached(`recentgames:${uuid}`, 60, () =>
        get('/recentgames', { uuid }).then(d => d.games)
    );
}

async function getGuild(params) {
    // params: { player: uuid } or { id: guildId } or { name: guildName }
    const key = `guild:${JSON.stringify(params)}`;
    return cached(key, config.cache.profileTTL, () =>
        get('/guild', params).then(d => d.guild)
    );
}

// ── SkyBlock Profiles ────────────────────────────────────────────

async function getProfiles(uuid) {
    return cached(`profiles:${uuid}`, config.cache.profileTTL, () =>
        get('/skyblock/profiles', { uuid }).then(d => d.profiles || [])
    );
}

async function getProfile(profileId) {
    return cached(`profile:${profileId}`, config.cache.profileTTL, () =>
        get('/skyblock/profile', { profile: profileId }).then(d => d.profile)
    );
}

/**
 * Get the selected (active) profile for a player, or a named one.
 */
async function getSelectedProfile(uuid, profileName = null) {
    const profiles = await getProfiles(uuid);
    if (!profiles || profiles.length === 0) {
        throw new Error('No SkyBlock profiles found for this player.');
    }

    if (profileName) {
        const match = profiles.find(
            p => p.cute_name && p.cute_name.toLowerCase() === profileName.toLowerCase()
        );
        if (!match) {
            const names = profiles.map(p => p.cute_name).filter(Boolean).join(', ');
            throw new Error(`Profile "${profileName}" not found. Available: ${names}`);
        }
        return match;
    }

    // Return the selected profile
    const selected = profiles.find(p => p.selected);
    return selected || profiles[0];
}

/**
 * Convenience: get a player's member data from their selected profile.
 */
async function getProfileMember(uuid, profileName = null) {
    const profile = await getSelectedProfile(uuid, profileName);
    const member = profile.members && profile.members[uuid];
    if (!member) {
        throw new Error('Player data not found in profile.');
    }
    return { profile, member };
}

// ── SkyBlock Economy ─────────────────────────────────────────────

async function getBazaar() {
    return cached('bazaar', config.cache.bazaarTTL, () =>
        get('/skyblock/bazaar').then(d => d.products)
    );
}

async function getAuction(params) {
    // params: { uuid } or { player } or { profile }
    return get('/skyblock/auction', params).then(d => d.auctions || []);
}

async function getActiveAuctions(page = 0) {
    return cached(`auctions:${page}`, config.cache.auctionTTL, () =>
        get('/skyblock/auctions', { page })
    );
}

async function getEndedAuctions() {
    return cached('auctions_ended', config.cache.auctionTTL, () =>
        get('/skyblock/auctions_ended').then(d => d.auctions || [])
    );
}

// ── SkyBlock Game Data ───────────────────────────────────────────

async function getMuseum(profileId) {
    return cached(`museum:${profileId}`, config.cache.profileTTL, () =>
        get('/skyblock/museum', { profile: profileId })
    );
}

async function getGarden(profileId) {
    return cached(`garden:${profileId}`, config.cache.profileTTL, () =>
        get('/skyblock/garden', { profile: profileId })
    );
}

async function getBingo(uuid) {
    return cached(`bingo:${uuid}`, config.cache.profileTTL, () =>
        get('/skyblock/bingo', { uuid }).then(d => d.events || [])
    );
}

async function getNews() {
    return cached('news', config.cache.resourceTTL, () =>
        get('/skyblock/news').then(d => d.items || [])
    );
}

async function getFireSales() {
    return cached('firesales', 60, () =>
        get('/skyblock/firesales').then(d => d.sales || [])
    );
}

// ── SkyBlock Resources (no API key needed) ───────────────────────

async function getCollectionsResource() {
    return cached('res:collections', config.cache.resourceTTL, () =>
        get('/resources/skyblock/collections')
    );
}

async function getSkillsResource() {
    return cached('res:skills', config.cache.resourceTTL, () =>
        get('/resources/skyblock/skills')
    );
}

async function getItemsResource() {
    return cached('res:items', config.cache.resourceTTL, () =>
        get('/resources/skyblock/items').then(d => d.items || [])
    );
}

async function getElection() {
    return cached('res:election', config.cache.resourceTTL, () =>
        get('/resources/skyblock/election')
    );
}

async function getBingoEvent() {
    return cached('res:bingo', config.cache.resourceTTL, () =>
        get('/resources/skyblock/bingo')
    );
}

// ── External ─────────────────────────────────────────────────────

module.exports = {
    // Player
    getPlayer,
    getStatus,
    getRecentGames,
    getGuild,
    // SkyBlock Profiles
    getProfiles,
    getProfile,
    getSelectedProfile,
    getProfileMember,
    // Economy
    getBazaar,
    getAuction,
    getActiveAuctions,
    getEndedAuctions,
    // Game Data
    getMuseum,
    getGarden,
    getBingo,
    getNews,
    getFireSales,
    // Resources
    getCollectionsResource,
    getSkillsResource,
    getItemsResource,
    getElection,
    getBingoEvent,
};
