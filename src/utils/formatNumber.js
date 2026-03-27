/**
 * Format a large number into a human-readable string.
 * e.g. 1234567 → "1.23M"
 */
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    num = Number(num);
    if (isNaN(num)) return '0';

    const abs = Math.abs(num);
    if (abs >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(num % 1 !== 0 ? 2 : 0);
}

/**
 * Format number with commas.
 * e.g. 1234567 → "1,234,567"
 */
function commaNumber(num) {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });
}



/**
 * Create a visual progress bar.
 * @param {number} current
 * @param {number} max
 * @param {number} length - Number of bar segments (default 12)
 * @returns {string}
 */
function progressBar(current, max, length = 12) {
    if (max <= 0) return '▓'.repeat(length);
    const ratio = Math.min(current / max, 1);
    const filled = Math.round(length * ratio);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Convert XP to level using an XP table.
 * @param {number} xp
 * @param {number[]} table - Cumulative XP thresholds
 * @returns {{ level: number, currentXP: number, nextLevelXP: number, progress: number }}
 */
function xpToLevel(xp, table) {
    let level = 0;
    for (let i = 1; i < table.length; i++) {
        if (xp >= table[i]) {
            level = i;
        } else {
            break;
        }
    }

    const currentLevelXP = table[level] || 0;
    const nextLevelXP = table[level + 1] || currentLevelXP;
    const xpInLevel = xp - currentLevelXP;
    const xpForLevel = nextLevelXP - currentLevelXP;
    const progress = xpForLevel > 0 ? xpInLevel / xpForLevel : 1;

    return {
        level,
        currentXP: xpInLevel,
        nextLevelXP: xpForLevel,
        progress: Math.min(progress, 1),
        totalXP: xp,
        maxLevel: level >= table.length - 1,
    };
}

/**
 * Format a timestamp into a relative time string.
 * e.g. "2 hours ago", "3 days ago"
 */
function timeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}

/**
 * Capitalize first letter of each word.
 */
function titleCase(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}



module.exports = {
    formatNumber,
    commaNumber,
    progressBar,
    xpToLevel,
    timeAgo,
    titleCase,
};
