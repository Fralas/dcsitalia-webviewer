import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

import airports, { getAirportById } from './config/airports.config.js';
import { isImportantWeapon, getPriority, getSupplyQuantityForPriority } from './config/rules.config.js';
import * as csvParser from './services/csvParser.js';
import * as historicalData from './services/historicalData.js';
import * as missionGenerator from './services/missionGenerator.js';
import { findBestSourceAirport } from './services/missionGenerator.js';
import { generateToken } from './utils/jwt.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration based on environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const CSV_DIR = path.resolve(__dirname, '../../');

// Security Middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json());

// Store current data in memory
let currentData = {};

/**
 * Load all airport data
 */
function loadAllData() {
  console.log('📊 Loading airport data...');
  const data = csvParser.parseAllAirports(airports, CSV_DIR);

  // Save snapshots to historical database
  Object.entries(data).forEach(([airportId, airportData]) => {
    if (airportData.data && airportData.data.weapons) {
      historicalData.saveSnapshot(airportId, airportData.data);

      // Check and generate missions (with donor selection)
      const newMissions = missionGenerator.checkAndGenerateMissions(
        airportId,
        airportData.data.weapons,
        data // Pass all airports data for donor selection
      );

      if (newMissions.length > 0) {
        console.log(`🚨 Generated ${newMissions.length} new missions for ${airportData.name}`);
        // Broadcast new missions to all clients
        io.emit('missions:updated', {
          missions: historicalData.getActiveMissions()
        });
      }
    }
  });

  currentData = data;
  return data;
}

// ==================== API ROUTES ====================

/**
 * GET /api/airports - Get all airports with current data
 */
app.get('/api/airports', (req, res) => {
  res.json(currentData);
});

/**
 * GET /api/airports/:id - Get specific airport data
 */
app.get('/api/airports/:id', (req, res) => {
  const airport = currentData[req.params.id];
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found' });
  }
  res.json(airport);
});

/**
 * GET /api/airports/:id/history - Get historical data for airport
 */
app.get('/api/airports/:id/history', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const history = historicalData.getHistory(req.params.id, hours);
  res.json(history);
});

/**
 * GET /api/airports/:id/weapons/:weaponId/history - Get historical data for a specific weapon
 */
app.get('/api/airports/:id/weapons/:weaponId/history', (req, res) => {
  const airportId = req.params.id;
  const weaponId = decodeURIComponent(req.params.weaponId);
  const days = parseInt(req.query.days) || 7;

  const history = historicalData.getWeaponHistory(airportId, weaponId, days);

  res.json({
    airportId,
    weaponId,
    days,
    dataPoints: history.length,
    history
  });
});

/**
 * GET /api/missions - Get all active missions
 */
app.get('/api/missions', (req, res) => {
  const missions = historicalData.getActiveMissions();
  res.json(missions);
});

/**
 * GET /api/missions/airport/:airportId - Get missions for specific airport
 */
app.get('/api/missions/airport/:airportId', (req, res) => {
  const missions = historicalData.getAirportMissions(req.params.airportId);
  res.json(missions);
});

/**
 * POST /api/missions/:id/accept - Accept a mission
 */
app.post('/api/missions/:id/accept', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const success = historicalData.acceptMission(req.params.id, userId);

  if (!success) {
    return res.status(400).json({ error: 'Mission already accepted or not found' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({ success: true, message: 'Mission accepted' });
});

/**
 * POST /api/missions/:id/complete - Complete a mission
 */
app.post('/api/missions/:id/complete', (req, res) => {
  const success = historicalData.completeMission(req.params.id);

  if (!success) {
    return res.status(400).json({ error: 'Mission not found or not accepted' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({ success: true, message: 'Mission completed' });
});

/**
 * POST /api/missions/:id/cancel - Cancel a mission
 */
app.post('/api/missions/:id/cancel', (req, res) => {
  const success = historicalData.cancelMission(req.params.id);

  if (!success) {
    return res.status(400).json({ error: 'Mission not found' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({ success: true, message: 'Mission cancelled' });
});

/**
 * GET /api/stats - Get overall statistics
 */
app.get('/api/stats', (req, res) => {
  const missions = historicalData.getActiveMissions();
  const stats = {
    totalAirports: airports.length,
    activeMissions: missions.filter(m => m.status === 'pending').length,
    acceptedMissions: missions.filter(m => m.status === 'accepted').length,
    criticalAirports: 0,
  };

  // Count airports with critical weapons (quantity <= 5)
  Object.values(currentData).forEach(airport => {
    if (airport.data && airport.data.weapons) {
      const hasCritical = airport.data.weapons.some(w =>
        isImportantWeapon(w.item) && w.quantity <= 5
      );
      if (hasCritical) stats.criticalAirports++;
    }
  });

  res.json(stats);
});

// ==================== TEST ENDPOINTS ====================

/**
 * POST /api/test/generate-mission - Generate a test mission (for testing only)
 * Body: { airportId, weaponId, currentQuantity }
 */
app.post('/api/test/generate-mission', (req, res) => {
  const { airportId, weaponId, currentQuantity = 5 } = req.body;

  if (!airportId || !weaponId) {
    return res.status(400).json({ error: 'airportId and weaponId are required' });
  }

  // Check if airport exists
  const airport = airports.find(a => a.id === airportId);
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found' });
  }

  // Check if mission already exists
  if (historicalData.missionExistsForWeapon(airportId, weaponId)) {
    return res.status(400).json({ error: 'Mission already exists for this weapon' });
  }

  // Create mission
  const missionId = historicalData.createMission(
    airportId,
    weaponId,
    100, // quantity needed
    currentQuantity,
    24 // expires in 24 hours
  );

  console.log(`🧪 TEST: Generated mission ${missionId} for ${weaponId} at ${airportId}`);

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    missionId,
    message: 'Test mission created'
  });
});

/**
 * POST /api/test/generate-random-missions - Generate random test missions
 * Body: { count, airportId? }
 */
app.post('/api/test/generate-random-missions', (req, res) => {
  const { count = 5, airportId } = req.body;

  const testWeapons = [
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154A',
    'weapons.nurs.HYDRA_70_M151',
    'weapons.bombs.GBU_16',
    'weapons.missiles.RB75',
    'weapons.missiles.X_58',
    'weapons.nurs.C_13',
  ];

  let targetAirport = airportId;
  if (!targetAirport) {
    // Pick random non-main-base airport
    const nonMainBases = airports.filter(a => !a.isMainBase);
    if (nonMainBases.length === 0) {
      return res.status(400).json({ error: 'No non-main-base airports available' });
    }
    targetAirport = nonMainBases[Math.floor(Math.random() * nonMainBases.length)].id;
  }

  const generatedMissions = [];

  for (let i = 0; i < count; i++) {
    const randomWeapon = testWeapons[Math.floor(Math.random() * testWeapons.length)];
    const randomQuantity = Math.floor(Math.random() * 15); // 0-14

    // Skip if mission already exists
    if (historicalData.missionExistsForWeapon(targetAirport, randomWeapon)) {
      continue;
    }

    const missionId = historicalData.createMission(
      targetAirport,
      randomWeapon,
      100,
      randomQuantity,
      24
    );

    generatedMissions.push({
      missionId,
      weapon: randomWeapon,
      quantity: randomQuantity
    });

    console.log(`🧪 TEST: Generated random mission ${missionId} for ${randomWeapon} (qty: ${randomQuantity})`);
  }

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    count: generatedMissions.length,
    missions: generatedMissions,
    airportId: targetAirport
  });
});

/**
 * POST /api/airports/:id/create-order - Create a manual supply order
 * Body: { weaponId, quantity }
 */
app.post('/api/airports/:id/create-order', (req, res) => {
  let { weaponId, quantity } = req.body;
  const airportId = req.params.id;

  if (!weaponId) {
    return res.status(400).json({ error: 'weaponId is required' });
  }

  // Check if airport exists
  const airport = airports.find(a => a.id === airportId);
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found' });
  }

  // Check if it's the main base
  if (airport.isMainBase) {
    return res.status(400).json({ error: 'Cannot create orders for main base' });
  }

  // Check if order already exists
  if (historicalData.missionExistsForWeapon(airportId, weaponId)) {
    return res.status(400).json({ error: 'Order already exists for this weapon' });
  }

  // Get current quantity from CSV data
  let currentQuantity = 0;
  if (currentData[airportId] && currentData[airportId].data && currentData[airportId].data.weapons) {
    const weaponData = currentData[airportId].data.weapons.find(w => w.item === weaponId);
    if (weaponData) {
      currentQuantity = weaponData.quantity;
    }
  }

  // If quantity not specified or is 0, calculate based on priority
  if (!quantity || quantity <= 0) {
    const priority = getPriority(currentQuantity);
    quantity = getSupplyQuantityForPriority(priority);
    console.log(`📊 Auto-calculated quantity for ${weaponId}: ${quantity} (priority: ${priority.toUpperCase()}, current: ${currentQuantity})`);
  }

  // Find best source airport using donor selection algorithm
  const bestSource = findBestSourceAirport({
    recipientAirport: airport,
    weaponId,
    quantityNeeded: quantity,
    allAirportsData: currentData,
  });

  // Create order with source routing
  const orderId = historicalData.createMission(
    airportId,
    weaponId,
    quantity,
    currentQuantity,
    24, // expires in 24 hours
    bestSource.airportId,
    bestSource.distance
  );

  console.log(`📦 Manual order created: ${orderId} for ${weaponId} at ${airport.displayName} (qty: ${quantity})`);
  console.log(`   Route: ${bestSource.airportName} → ${airport.displayName} (${bestSource.distance}nm)`);

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    orderId,
    message: 'Order created successfully',
    route: {
      from: bestSource.airportName,
      to: airport.displayName,
      distance: bestSource.distance,
      isDonor: bestSource.isDonor
    }
  });
});

// ==================== DEBUG ENDPOINTS ====================

/**
 * POST /api/debug/generate-orders - Force generation of orders for all airports (requires authentication)
 */
app.post('/api/debug/generate-orders', authenticateToken, requireAdmin, (req, res) => {
  console.log('🔧 DEBUG: Force generating orders for all airports...');

  const results = [];

  // Loop through all airports
  airports.forEach(airport => {
    if (airport.isMainBase) {
      results.push({
        airportId: airport.id,
        airportName: airport.displayName,
        skipped: true,
        reason: 'Main base - no orders generated'
      });
      return;
    }

    // Get weapons data for this airport
    const airportData = currentData[airport.id];
    if (!airportData || !airportData.data || !airportData.data.weapons) {
      results.push({
        airportId: airport.id,
        airportName: airport.displayName,
        skipped: true,
        reason: 'No weapons data available'
      });
      return;
    }

    // Generate missions for this airport (with donor selection)
    const generatedMissions = missionGenerator.checkAndGenerateMissions(
      airport.id,
      airportData.data.weapons,
      currentData // Pass all airports data for donor selection
    );

    results.push({
      airportId: airport.id,
      airportName: airport.displayName,
      missionsGenerated: generatedMissions.length,
      missionIds: generatedMissions
    });
  });

  // Broadcast updated missions to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  const totalGenerated = results.reduce((sum, r) => sum + (r.missionsGenerated || 0), 0);

  console.log(`🔧 DEBUG: Generated ${totalGenerated} total orders`);

  res.json({
    success: true,
    totalGenerated,
    results
  });
});

/**
 * POST /api/debug/clear-orders - Clear all existing orders (requires authentication)
 */
app.post('/api/debug/clear-orders', authenticateToken, requireAdmin, (req, res) => {
  console.log('🔧 DEBUG: Clearing all orders...');

  const beforeCount = historicalData.getActiveMissions().length;

  // Clear all missions
  historicalData.clearAllMissions();

  // Broadcast updated missions to all clients
  io.emit('missions:updated', {
    missions: []
  });

  console.log(`🔧 DEBUG: Cleared ${beforeCount} orders`);

  res.json({
    success: true,
    clearedCount: beforeCount,
    message: `Cleared ${beforeCount} orders`
  });
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Send current data on connection
  socket.emit('data:initial', currentData);
  socket.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ==================== FILE WATCHER ====================

// Watch CSV files for changes
const watcher = chokidar.watch('*.csv', {
  cwd: CSV_DIR,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
});

watcher.on('change', (filename) => {
  console.log(`📝 CSV file changed: ${filename}`);

  // Reload data
  loadAllData();

  // Broadcast update to all connected clients
  io.emit('data:updated', currentData);
});

watcher.on('error', (error) => {
  console.error('File watcher error:', error);
});

// ==================== SCHEDULED TASKS ====================

// Clean up expired missions every 5 minutes
setInterval(() => {
  const expired = historicalData.cleanupExpiredMissions();
  if (expired > 0) {
    console.log(`🧹 Cleaned up ${expired} expired missions`);
    io.emit('missions:updated', {
      missions: historicalData.getActiveMissions()
    });
  }
}, 5 * 60 * 1000);

// Check for new orders every 5 minutes (automatic polling)
setInterval(() => {
  console.log('⏰ 5-minute check: Scanning for critical weapons...');
  loadAllData();
  io.emit('data:updated', currentData);
}, 5 * 60 * 1000); // Every 5 minutes

// ==================== START SERVER ====================

// Load initial data
loadAllData();

httpServer.listen(PORT, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════╗
║   🎮 DCS Warehouse Viewer Server                     ║
║                                                       ║
║   Server running on: http://localhost:${PORT}         ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
║   CSV Directory: ${CSV_DIR.substring(0, 35)}...      ║
║   Airports loaded: ${airports.length}                          ║
║                                                       ║
║   API: http://localhost:${PORT}/api/airports         ║
║   Missions: http://localhost:${PORT}/api/missions    ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// ==================== ADMIN ENDPOINTS ====================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  logger.error('⚠️  ADMIN_PASSWORD is not set in environment variables');
}

/**
 * POST /api/admin/login - Verify admin password and return JWT
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Simple password comparison (in production, use hashed passwords)
    if (password === ADMIN_PASSWORD) {
      // Generate JWT token
      const token = generateToken({
        role: 'admin',
        timestamp: Date.now()
      });

      logger.security('Admin login successful', {
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Login successful',
        token
      });
    } else {
      logger.security('Admin login failed - invalid password', {
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/config/rules - Get rules configuration (requires authentication)
 */
app.get('/api/admin/config/rules', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Import the config dynamically to get the latest version
    import('./config/rules.config.js').then(module => {
      res.json(module.missionRules);
    }).catch(err => {
      console.error('Error loading rules config:', err);
      res.status(500).json({ error: 'Failed to load config' });
    });
  } catch (error) {
    console.error('Error in /api/admin/config/rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/config/airports - Get airports configuration (requires authentication)
 */
app.get('/api/admin/config/airports', authenticateToken, requireAdmin, (req, res) => {
  try {
    res.json(airports);
  } catch (error) {
    console.error('Error in /api/admin/config/airports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ERROR HANDLERS ====================

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  watcher.close();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
