/**
 * Format weight for display
 * @param {number} weightLbs - Weight in pounds
 * @returns {string} - Formatted weight string (e.g., "1,500 lb" or "2,500 lb (1.1 tons)")
 */
export function formatWeight(weightLbs) {
  if (!weightLbs || weightLbs === 0) return 'N/A';

  const formattedLbs = weightLbs.toLocaleString();

  // If weight is over 2000 lbs, also show tons
  if (weightLbs >= 2000) {
    const tons = (weightLbs / 2000).toFixed(1);
    return `${formattedLbs} lb (${tons} tons)`;
  }

  return `${formattedLbs} lb`;
}

/**
 * Get weight with icon for display
 * @param {number} weightLbs - Weight in pounds
 * @returns {object} - Object with formatted text and icon
 */
export function getWeightDisplay(weightLbs) {
  const formatted = formatWeight(weightLbs);

  // Categorize by weight
  let icon = '📦';
  let color = 'text-gray-400';

  if (weightLbs >= 10000) {
    icon = '🚛'; // Very heavy
    color = 'text-red-400';
  } else if (weightLbs >= 5000) {
    icon = '📦'; // Heavy
    color = 'text-orange-400';
  } else if (weightLbs >= 1000) {
    icon = '📦'; // Medium
    color = 'text-yellow-400';
  } else if (weightLbs > 0) {
    icon = '📦'; // Light
    color = 'text-green-400';
  }

  return { formatted, icon, color };
}
