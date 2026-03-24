const nbt = require('prismarine-nbt');

/**
 * Decode a Base64 encoded NBT string (used for inventories in Hypixel API)
 * @param {string} base64Data
 * @returns {Promise<Array>} Array of parsed items
 */
async function decodeInventoryData(base64Data) {
    if (!base64Data) return [];
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const parsed = await nbt.parse(buffer);
        
        // simplify internal nbt structure to pure JS objects
        const items = nbt.simplify(parsed.parsed || parsed);
        
        // Return the list of items from the NBT list structure
        return items.i || [];
    } catch (err) {
        console.error('Failed to parse NBT data:', err.message);
        return [];
    }
}

/**
 * Extract SkyBlock Item IDs from an array of simplified NBT items
 * @param {Array} items
 * @returns {Array<{id: string, count: number, _raw: Object}>}
 */
function extractSkyBlockItems(items) {
    const parsedItems = [];
    for (const item of items) {
        if (!item || !item.tag || !item.tag.ExtraAttributes || !item.tag.ExtraAttributes.id) continue;
        parsedItems.push({
            id: item.tag.ExtraAttributes.id,
            count: item.Count || 1,
            recombed: item.tag.ExtraAttributes.rarity_upgrades === 1,
            _raw: item
        });
    }
    return parsedItems;
}

module.exports = {
    decodeInventoryData,
    extractSkyBlockItems
};
