function shortHex(value) {
  const text = String(value);
  return text.length <= 18 ? text : `${text.slice(0, 10)}...${text.slice(-6)}`;
}

function hashRate(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 H/s";
  const units = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s"];
  let n = value;
  let unit = 0;
  while (n >= 1000 && unit < units.length - 1) {
    n /= 1000;
    unit++;
  }
  return `${n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)} ${units[unit]}`;
}

function uint256Hex(value) {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

/**
 * Calculate and format ETA based on difficulty and hashrate.
 * Formula: ETA (seconds) = 2^256 / difficulty / hashrate
 * @param {BigInt} difficulty - The mining difficulty target
 * @param {number} hashrate - Current hashrate in H/s
 * @returns {string} Formatted ETA like "~2.0d", "~4.5h", "~15m", "~30s"
 */
function formatETA(difficulty, hashrate) {
  if (!hashrate || hashrate <= 0) return "calculating...";
  if (!difficulty || difficulty <= 0n) return "calculating...";

  // 2^256 as BigInt
  const TWO_POW_256 = 1n << 256n;

  // Expected number of hashes to find a solution = 2^256 / difficulty
  const expectedHashes = TWO_POW_256 / difficulty;

  // Convert to seconds: expectedHashes / hashrate
  // Use Number for the final division (precision is fine for display)
  const etaSeconds = Number(expectedHashes) / hashrate;

  if (!Number.isFinite(etaSeconds) || etaSeconds < 0) return "∞";

  return formatDuration(etaSeconds);
}

/**
 * Format seconds into a readable short duration string.
 * @param {number} seconds
 * @returns {string} e.g., "~2.0d", "~4.5h", "~15m", "~30s"
 */
function formatDuration(seconds) {
  if (seconds < 1) return "~0s";

  const days = seconds / 86400;
  const hours = seconds / 3600;
  const minutes = seconds / 60;

  if (days >= 1) {
    return `~${days >= 10 ? days.toFixed(0) : days.toFixed(1)}d`;
  }
  if (hours >= 1) {
    return `~${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)}h`;
  }
  if (minutes >= 1) {
    return `~${minutes >= 10 ? minutes.toFixed(0) : minutes.toFixed(1)}m`;
  }
  return `~${Math.round(seconds)}s`;
}

/**
 * Format elapsed time from milliseconds to HH:MM:SS or Xd HH:MM:SS.
 * @param {number} ms - Elapsed time in milliseconds
 * @returns {string} e.g., "00:05:23" or "1d 02:15:30"
 */
function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

/**
 * Format a number with comma separators.
 * @param {number|bigint|string} n
 * @returns {string} e.g., "1,073,741,824"
 */
function formatNumber(n) {
  return BigInt(n).toLocaleString("en-US");
}

/**
 * Format large hash counts to short readable form.
 * @param {number|bigint|string} n
 * @returns {string} e.g., "1.07B", "534M", "12.3K"
 */
function formatHashesShort(n) {
  const num = Number(n);
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return String(num);
}

module.exports = {
  hashRate,
  shortHex,
  uint256Hex,
  formatETA,
  formatDuration,
  formatElapsed,
  formatNumber,
  formatHashesShort
};
