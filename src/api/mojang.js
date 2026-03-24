const axios = require('axios');
const NodeCache = require('node-cache');
const config = require('../config');

const cache = new NodeCache({ stdTTL: config.cache.mojangTTL });

/**
 * Resolve a Minecraft username to a UUID via the Mojang API.
 * Results are cached for 10 minutes.
 * @param {string} username - Minecraft username
 * @returns {Promise<{id: string, name: string}>}
 */
async function getUUID(username) {
    const key = `mojang:${username.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;

    try {
        const { data } = await axios.get(
            `${config.mojang.baseUrl}/users/profiles/minecraft/${encodeURIComponent(username)}`
        );

        if (!data || !data.id) {
            throw new Error(`Player "${username}" not found.`);
        }

        const result = { id: data.id, name: data.name };
        cache.set(key, result);
        return result;
    } catch (err) {
        if (err.response && err.response.status === 404) {
            throw new Error(`Player "${username}" not found.`);
        }
        throw new Error(`Mojang API error: ${err.message}`);
    }
}

/**
 * Format a UUID without dashes into the standard dashed format.
 */
function formatUUID(uuid) {
    return uuid.replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        '$1-$2-$3-$4-$5'
    );
}

/**
 * Get the head render URL for a player.
 */
function getHeadUrl(uuid) {
    return `https://mc-heads.net/avatar/${uuid}/128`;
}

/**
 * Get the full body render URL for a player.
 */
function getBodyUrl(uuid) {
    return `https://mc-heads.net/body/${uuid}/128`;
}

module.exports = { getUUID, formatUUID, getHeadUrl, getBodyUrl };
