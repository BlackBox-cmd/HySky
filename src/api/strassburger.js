const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

function cached(key, ttl, fetcher) {
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    return fetcher().then(data => {
        if (data) cache.set(key, data, ttl);
        return data;
    });
}

function mapCrop(cropId, cropName) {
    const cropMap = {
        0: 'cactus', 1: 'carrot', 2: 'cocoa', 3: 'melon', 4: 'mushroom',
        5: 'nether_wart', 6: 'potato', 7: 'pumpkin', 8: 'sugar_cane', 9: 'wheat', 11: 'sunflower'
    };
    if (cropMap[cropId]) return cropMap[cropId];
    return cropName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function getJacobContests() {
    return cached('external:jacob_contests', 5 * 60, async () => {
        try {
            const { data } = await axios.get('https://jacobs.strassburger.org/api/jacobcontests.json', { timeout: 10000 });
            
            // Normalize raw JSON array to standard objects
            return data.map(contest => ({
                time: new Date(contest.timestamp),
                crops: contest.crops.map((id, index) => mapCrop(id, contest.cropNames[index]))
            }));
            
        } catch (err) {
            console.error('Failed to fetch Jacob contests from Strassburger API:', err.message);
            return null;
        }
    });
}

module.exports = {
    getJacobContests
};
