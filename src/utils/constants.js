// ── Skill & Slayer Constants ─────────────────────────────────────

const SKILLS = [
    'farming', 'mining', 'combat', 'foraging', 'fishing',
    'enchanting', 'alchemy', 'taming', 'carpentry', 'social',
];

const SLAYERS = {
    zombie: { name: 'Revenant Horror', emoji: '🧟', color: '#2ECC71' },
    spider: { name: 'Tarantula Broodfather', emoji: '🕷️', color: '#E74C3C' },
    wolf: { name: 'Sven Packmaster', emoji: '🐺', color: '#95A5A6' },
    enderman: { name: 'Voidgloom Seraph', emoji: '🔮', color: '#9B59B6' },
    blaze: { name: 'Inferno Demonlord', emoji: '🔥', color: '#E67E22' },
    vampire: { name: 'Riftstalker Bloodfiend', emoji: '🧛', color: '#C0392B' },
};

const DUNGEON_CLASSES = ['healer', 'mage', 'berserk', 'archer', 'tank'];

// ── Rarity Colors ────────────────────────────────────────────────

const RARITY_COLORS = {
    COMMON: '#FFFFFF',
    UNCOMMON: '#55FF55',
    RARE: '#5555FF',
    EPIC: '#AA00AA',
    LEGENDARY: '#FFAA00',
    MYTHIC: '#FF55FF',
    DIVINE: '#55FFFF',
    SPECIAL: '#FF5555',
    VERY_SPECIAL: '#FF5555',
    SUPREME: '#AA0000',
};

const RARITY_ORDER = [
    'COMMON', 'UNCOMMON', 'RARE', 'EPIC',
    'LEGENDARY', 'MYTHIC', 'DIVINE', 'SPECIAL', 'VERY_SPECIAL', 'SUPREME',
];

// ── Embed Colors ─────────────────────────────────────────────────

const COLORS = {
    PRIMARY: 0x7289DA,
    SUCCESS: 0x2ECC71,
    WARNING: 0xF39C12,
    ERROR: 0xE74C3C,
    INFO: 0x3498DB,
    GOLD: 0xFFAA00,
    BAZAAR: 0x00AA00,
    AUCTION: 0xAA00AA,
    SKYBLOCK: 0x4CC9F0,
    DUNGEON: 0xFF6B6B,
};

// ── Skill XP Thresholds  ────────────────────────────────────────

const SKILL_XP_TABLES = {
    // Standard skills (max 60)
    standard: [
        0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425,
        9925, 14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 322425,
        447425, 597425, 797425, 1047425, 1347425, 1697425, 2097425, 2547425, 3047425, 3597425,
        4197425, 4847425, 5547425, 6297425, 7097425, 7947425, 8847425, 9797425, 10797425, 11897425,
        13097425, 14397425, 15797425, 17297425, 18897425, 20597425, 22397425, 24297425, 26297425, 28397425,
        30647425, 33047425, 35597425, 38297425, 41147425, 44147425, 47297425, 50597425, 54047425, 57647425,
        61397425,
    ],
    // Catacombs / Dungeon XP (max 50)
    dungeon: [
        0, 50, 125, 235, 395, 625, 955, 1425, 2095, 3045,
        4385, 6275, 8940, 12700, 17960, 25340, 35640, 50040, 70040, 97640,
        135640, 188140, 259640, 356640, 488640, 668640, 911640, 1239640, 1684640, 2284640,
        3084640, 4149640, 5559640, 7459640, 9959640, 13259640, 17559640, 23159640, 30359640, 39559640,
        51559640, 66559640, 85559640, 109559640, 139559640, 177559640, 225559640, 285559640, 360559640, 453559640,
        569809640,
    ],
};

// ── Emoji Shortcuts ──────────────────────────────────────────────

const SKILL_EMOJIS = {
    farming: '🌾',
    mining: '⛏️',
    combat: '⚔️',
    foraging: '🪓',
    fishing: '🎣',
    enchanting: '📖',
    alchemy: '⚗️',
    taming: '🐾',
    carpentry: '🪚',
    social: '🤝',
};

// ── Farming Crops ────────────────────────────────────────────────

const CROPS = [
    'cactus', 'carrot', 'cocoa', 'melon', 'mushroom',
    'nether_wart', 'potato', 'pumpkin', 'sugar_cane', 'wheat', 'sunflower',
    'moonflower', 'wild_rose'
];

const CROP_EMOJIS = {
    cactus: '<a:CACTUS_enchanted:1487602982995497142>',
    carrot: '<a:CARROT_ITEM_enchanted:1487603049638920372>',
    cocoa: '<a:ENCHANTED_COCOA_enchanted:1487603935584976956>',
    melon: '<a:MELON_enchanted:1487603102147412140>',
    mushroom: '🍄',
    nether_wart: '<a:NETHER_WART_enchanted:1487603509749616690>',
    potato: '<a:POTATO_ITEM_enchanted:1487603336264810537>',
    pumpkin: '<a:PUMPKIN_enchanted:1487603457383727145>',
    sugar_cane: '<a:SUGAR_CANE_enchanted:1487603265871937566>',
    wheat: '<a:WHEAT_enchanted:1487603410592071760>',
    sunflower: '<a:ENCHANTED_SUNFLOWER_enchanted:1487604021781991535>',
    moonflower: '<a:MOONFLOWER_enchanted:1487603153254879312>',
    wild_rose: '<a:ENCHANTED_WILD_ROSE_enchanted:1487603373577605180>'
};

const CROP_NAMES = {
    cactus: 'Cactus',
    carrot: 'Carrot',
    cocoa: 'Cocoa Beans',
    melon: 'Melon',
    mushroom: 'Mushroom',
    nether_wart: 'Nether Wart',
    potato: 'Potato',
    pumpkin: 'Pumpkin',
    sugar_cane: 'Sugar Cane',
    wheat: 'Wheat',
    sunflower: 'Sunflower',
    moonflower: 'Moonflower',
    wild_rose: 'Wild Rose'
};

// ── Minion Slot Unlocks ──────────────────────────────────────────
// Unique crafted minion count thresholds for additional slots (base = 5)
const MINION_SLOTS = [
    5, 15, 30, 50, 75, 100, 125, 150, 175, 200,
    225, 250, 275, 300, 350, 400, 450, 500, 550, 600,
    650, 700, 750, 800, 850, 900,
];

module.exports = {
    SKILLS,
    SLAYERS,
    DUNGEON_CLASSES,
    RARITY_COLORS,
    COLORS,
    SKILL_XP_TABLES,
    SKILL_EMOJIS,
    CROPS,
    CROP_EMOJIS,
    CROP_NAMES,
    MINION_SLOTS,
};
