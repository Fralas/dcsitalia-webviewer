# DCS Italia Warehouse Viewer

A real-time web-based logistics management system for DCS World servers. Monitor warehouse inventory across multiple airports and automatically generate supply missions when critical items are low.

## Features

- **Real-time Dashboard**: Monitor all airports with expandable detailed views
- **Automatic Mission Generation**: Creates supply missions when critical weapons fall below threshold
- **Mission Dispatch System**: Accept and manage logistics missions with multi-user support
- **Historical Data**: Track inventory trends over time (stored in SQLite)
- **Live Updates**: WebSocket-based real-time synchronization across all connected clients
- **Scalable Configuration**: Easy-to-configure system for adding new airports and rules

## Tech Stack

- **Backend**: Node.js + Express + Socket.io + SQLite
- **Frontend**: React + Vite + Tailwind CSS
- **Real-time**: WebSocket for live updates

## Project Structure

```
dcsitalia-webviewer/
├── backend/
│   └── src/
│       ├── config/
│       │   ├── airports.config.js    # Airport configuration
│       │   └── rules.config.js       # Mission rules and thresholds
│       ├── services/
│       │   ├── csvParser.js          # CSV file parser
│       │   ├── historicalData.js     # Database operations
│       │   └── missionGenerator.js   # Mission generation logic
│       └── server.js                 # Express server + WebSocket
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx         # Main dashboard
│       │   ├── AirportCard.jsx       # Airport display card
│       │   └── MissionDispatch.jsx   # Mission management
│       ├── services/
│       │   ├── api.js                # API client
│       │   └── socket.js             # WebSocket client
│       └── App.jsx                   # Root component
├── data/
│   └── historical/                   # SQLite database storage
├── {Airport}_weapons.csv             # Weapons inventory CSV
├── {Airport}_liquids.csv             # Fuel inventory CSV
└── {Airport}_aircraft.csv            # Aircraft inventory CSV (not used)
```

## Installation

### Prerequisites

- Node.js 18+ installed
- CSV files from your DCS server in the root directory

### Setup

1. **Install dependencies**:

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

2. **Configure airports** (optional):

Edit `backend/src/config/airports.config.js` to add your airports:

```javascript
export const airports = [
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true,  // Set to true for your main supply base
    csvPrefix: 'Adana Sakirpasa',  // Must match CSV filename prefix
    coordinates: { lat: 37.0, lon: 35.4 },
  },
  // Add more airports here...
];
```

3. **Configure mission rules** (optional):

Edit `backend/src/config/rules.config.js` to customize:
- Important weapons list
- Critical thresholds
- Mission expiry times
- Liquid fuel thresholds

## Running the Application

### Development Mode (with auto-reload)

```bash
# Run both backend and frontend concurrently
npm run dev
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:3000`

### Production Mode

```bash
# Build frontend
npm run build

# Start backend (serves built frontend)
npm start
```

## Configuration

### Adding New Airports

1. Place CSV files in the root directory with the format:
   - `{AirportName}_weapons.csv`
   - `{AirportName}_liquids.csv`
   - `{AirportName}_aircraft.csv` (optional, not used by system)

2. Add airport configuration to `backend/src/config/airports.config.js`:

```javascript
{
  id: 'incirlik',
  name: 'Incirlik',
  displayName: 'Incirlik Air Base',
  isMainBase: false,
  csvPrefix: 'Incirlik',  // Must match CSV prefix exactly
  coordinates: { lat: 37.0, lon: 35.4 },
}
```

3. Restart the server - the new airport will appear automatically!

### Configuring Important Weapons

Edit the `importantWeapons` array in `backend/src/config/rules.config.js`:

```javascript
importantWeapons: [
  'weapons.missiles.AIM_120C',
  'weapons.missiles.AIM_9X',
  'weapons.missiles.AGM_65F',
  // Add more weapons...
]
```

### Adjusting Thresholds

In `backend/src/config/rules.config.js`:

```javascript
criticalThreshold: 20,  // Generate mission below this quantity
warningThreshold: 50,   // Show warning indicator
```

## Usage

### Dashboard View

- **Airport Cards**: Click any airport to expand and view detailed inventory
- **Status Indicators**:
  - 🔴 Red: Critical (≤5 units)
  - 🟡 Yellow: Warning (≤20 units)
  - 🟢 Green: OK (>50 units)
- **Filters**: View all weapons, only important ones, or only critical items
- **Sorting**: Sort airports by name or by critical items count

### Mission Dispatch

- **Accept Mission**: Enter your name and accept a pending mission
- **Complete Mission**: Mark missions as complete when done
- **Cancel Mission**: Cancel any mission if no longer needed
- **Real-time Updates**: All users see mission status changes instantly

### Mission Priority

- **CRITICAL**: Current stock ≤5 units
- **HIGH**: Current stock ≤20 units
- **MEDIUM**: Current stock >20 units

## API Endpoints

### Airports
- `GET /api/airports` - Get all airports with current data
- `GET /api/airports/:id` - Get specific airport
- `GET /api/airports/:id/history?hours=24` - Get historical data

### Missions
- `GET /api/missions` - Get all active missions
- `GET /api/missions/airport/:airportId` - Get airport missions
- `POST /api/missions/:id/accept` - Accept a mission (body: `{userId}`)
- `POST /api/missions/:id/complete` - Complete a mission
- `POST /api/missions/:id/cancel` - Cancel a mission

### Statistics
- `GET /api/stats` - Get overall statistics

## WebSocket Events

### Client → Server
None (client only listens)

### Server → Client
- `data:initial` - Initial data on connection
- `data:updated` - Airport data updated (CSV file changed)
- `missions:updated` - Missions list updated

## Remote Access

To allow users outside your network to access the system:

### Option 1: Port Forwarding
1. Forward port `3001` (backend) and `3000` (frontend) on your router
2. Give users your public IP: `http://YOUR_PUBLIC_IP:3000`

### Option 2: Reverse Proxy (Recommended)
Use nginx or Apache to serve the application with SSL

### Option 3: Tunnel Service
Use services like ngrok, CloudFlare Tunnel, or Tailscale

## File Monitoring

The system automatically watches CSV files for changes:
- When DCS server updates a CSV file, the system detects it
- Data is reloaded and all clients are notified via WebSocket
- New missions are generated if needed

## Database

Historical data is stored in SQLite at `data/historical/warehouse.db`:
- **warehouse_snapshots**: Inventory snapshots every hour
- **missions**: All mission records with status tracking

## Troubleshooting

### CSV files not detected
- Check that CSV files are in the root directory
- Verify the `csvPrefix` in airports config matches the filename exactly
- Check file permissions

### WebSocket connection failed
- Ensure port 3001 is not blocked by firewall
- Check that backend server is running
- Verify `VITE_SOCKET_URL` environment variable if needed

### Missions not generating
- Check that weapons are in the `importantWeapons` list
- Verify quantity is below `criticalThreshold` (default: 20)
- Check that the airport is not marked as `isMainBase: true`

## License

MIT License - Created for DCS Italia Community

## Support

For issues or questions, contact the development team or open an issue on the project repository.
