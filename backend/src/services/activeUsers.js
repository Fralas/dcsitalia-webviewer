/**
 * Active Users Service
 * Tracks users logged in via Discord OAuth
 */

// Map of user_id -> user data
const activeUsers = new Map();

// Timeout for user inactivity (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

/**
 * Add or update an active user
 * @param {Object} userData - User data from Discord OAuth
 * @returns {Object} Updated user data
 */
export function addActiveUser(userData) {
  const user = {
    id: userData.id,
    globalName: userData.global_name || userData.username,
    username: userData.username,
    avatar: userData.avatar,
    discriminator: userData.discriminator,
    lastActivity: Date.now(),
    loginTime: activeUsers.has(userData.id) ? activeUsers.get(userData.id).loginTime : Date.now()
  };

  activeUsers.set(userData.id, user);

  console.log(`👤 Active user: ${user.globalName} (${user.username})`);

  return user;
}

/**
 * Update user's last activity timestamp
 * @param {string} userId - User ID
 * @returns {boolean} Success
 */
export function updateUserActivity(userId) {
  const user = activeUsers.get(userId);
  if (user) {
    user.lastActivity = Date.now();
    activeUsers.set(userId, user);
    return true;
  }
  return false;
}

/**
 * Remove an active user
 * @param {string} userId - User ID
 * @returns {boolean} Success
 */
export function removeActiveUser(userId) {
  const user = activeUsers.get(userId);
  if (user) {
    console.log(`👋 User left: ${user.globalName}`);
    return activeUsers.delete(userId);
  }
  return false;
}

/**
 * Get all active users
 * Removes inactive users (last activity > INACTIVITY_TIMEOUT)
 * @returns {Array} Array of active user objects
 */
export function getActiveUsers() {
  const now = Date.now();
  const users = [];

  // Clean up inactive users and collect active ones
  for (const [userId, user] of activeUsers.entries()) {
    if (now - user.lastActivity > INACTIVITY_TIMEOUT) {
      console.log(`⏰ Removing inactive user: ${user.globalName} (${Math.floor((now - user.lastActivity) / 60000)} minutes inactive)`);
      activeUsers.delete(userId);
    } else {
      users.push(user);
    }
  }

  return users;
}

/**
 * Get active user by ID
 * @param {string} userId - User ID
 * @returns {Object|null} User data or null
 */
export function getActiveUser(userId) {
  const user = activeUsers.get(userId);
  if (!user) return null;

  // Check if user is inactive
  if (Date.now() - user.lastActivity > INACTIVITY_TIMEOUT) {
    removeActiveUser(userId);
    return null;
  }

  return user;
}

/**
 * Get count of active users
 * @returns {number} Active user count
 */
export function getActiveUserCount() {
  getActiveUsers(); // Clean up inactive users first
  return activeUsers.size;
}

/**
 * Clean up all inactive users
 * Run periodically to keep the list clean
 */
export function cleanupInactiveUsers() {
  const now = Date.now();
  let removedCount = 0;

  for (const [userId, user] of activeUsers.entries()) {
    if (now - user.lastActivity > INACTIVITY_TIMEOUT) {
      console.log(`🧹 Cleanup: Removing inactive user ${user.globalName}`);
      activeUsers.delete(userId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`🧹 Cleaned up ${removedCount} inactive users`);
  }

  return removedCount;
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveUsers, 5 * 60 * 1000);

export default {
  addActiveUser,
  updateUserActivity,
  removeActiveUser,
  getActiveUsers,
  getActiveUser,
  getActiveUserCount,
  cleanupInactiveUsers
};
