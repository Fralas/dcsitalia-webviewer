# DCS Italia Warehouse Viewer

A real-time, web-based logistics dashboard for DCS World servers. Monitor warehouse inventory across multiple airports, generate supply missions automatically, and keep pilots in sync through live updates. The project was created by Francesco La Barba ("Fralas") and made for the DCS Italia community, but anyone may download and use it free of charge. The DCS Italia community are users—not owners—of the software.

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Requirements](#requirements)
- [Quick Start (Development)](#quick-start-development)
- [Configuration](#configuration)
- [Data & CSV Files](#data--csv-files)
- [Scripts](#scripts)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)
- [License](#license)

## Features
- Real-time dashboard with expandable airport views
- Automatic mission generation when critical items are low
- Mission dispatch workflow with multi-user support
- Admin-protected controls with session-based authentication
- Historical data tracking stored in JSON files
- WebSocket-based live synchronization across clients
- CSV files are treated as read-only input

## Architecture
- **Backend:** Node.js + Express + Socket.io with JSON file storage
- **Frontend:** React (Vite) + Tailwind CSS
- **Real-time:** WebSocket events for instant updates across connected clients
- **Storage:** JSON files for historical snapshots and missions (no database)

## Repository Layout
```
dcsitalia-webviewer/
├── backend/                 # Express API, WebSocket server, configuration
│   └── src/
│       ├── config/          # Airport and mission rule configuration
│       ├── services/        # CSV parser, historical data, mission generator
│       └── server.js        # App entry point
├── frontend/                # React application
│   └── src/
│       ├── components/      # Dashboard, AirportCard, MissionDispatch
│       └── services/        # API client, WebSocket client
├── data/historical/         # JSON history snapshots and missions
├── csvexample/              # Sample CSV inputs for reference
├── DEPLOYMENT.md            # Production hardening and hosting guide
├── TEST_COMMANDS.md         # Useful local testing commands
└── start.sh                 # Example startup script
```

## Requirements
- Node.js 18+
- npm 9+
- CSV exports from your DCS server (see [Data & CSV Files](#data--csv-files))

## Quick Start (Development)
1. **Install backend and tooling dependencies**
   ```bash
   npm install
   ```
2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```
3. **Provide CSV data** by copying your DCS exports into the project root (see naming rules below). You can start with the examples in `csvexample/` while exploring the UI.
4. **Configure environment variables** (see [Configuration](#configuration)).
5. **Run the app with hot reload**
   ```bash
   npm run dev
   ```
   - Backend: http://localhost:3001
   - Frontend: http://localhost:3000

To build the production frontend bundle and serve it from the backend, run:
```bash
npm run build
npm start
```

## Configuration

### Environment Variables
Create `.env` files in both `backend/` and `frontend/`.

**backend/.env**
```bash
PORT=3001
NODE_ENV=development
JWT_SECRET=change-me
ADMIN_PASSWORD=change-me
FRONTEND_URL=http://localhost:3000
SESSION_TIMEOUT=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**frontend/.env**
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

### Airport Setup
Configure airports in `backend/src/config/airports.config.js`:
```javascript
export const airports = [
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true,              // Set to true for your main supply base
    csvPrefix: 'Adana Sakirpasa',  // Must match CSV filename prefix
    coordinates: { lat: 37.0, lon: 35.4 },
  },
  // Add more airports here...
];
```

### Mission Rules
Tune mission logic in `backend/src/config/rules.config.js`:
- `importantWeapons` list
- `criticalThreshold` and `warningThreshold`
- Mission expiry times
- Liquid fuel thresholds

## Data & CSV Files
- Place CSV files in the project root using the format:
  - `{AirportName}_weapons.csv`
  - `{AirportName}_liquids.csv`
  - `{AirportName}_aircraft.csv` (optional)
- Ensure `csvPrefix` in the airport config matches the CSV filename prefix exactly.
- CSV files are **never modified** by the application—they are read-only inputs.

## Scripts
- `npm run dev` – start backend and frontend with hot reload
- `npm run dev:backend` – backend only (watch mode)
- `npm run dev:frontend` – frontend dev server
- `npm run build` – build the frontend bundle
- `npm start` – run the backend server (serves built frontend if available)

## Production Deployment
Follow the hardening checklist and hosting instructions in [DEPLOYMENT.md](DEPLOYMENT.md). Key steps include setting secure secrets, enabling HTTPS, and running the backend behind a reverse proxy or process manager.

## Contributing
We welcome issues, feature requests, and pull requests from the community. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you start.

## License
This project is licensed under the [DCS Italia Warehouse Viewer License](LICENSE). The license:
- Credits Francesco La Barba ("Fralas") as the original and sole owner
- Allows anyone to download and use the software for free personal, non-commercial use
- Prohibits redistribution, sublicensing, or selling the software or derivative works

## AI Notice
Parts of this project were created with the assistance of artificial intelligence tooling. The software may contain mistakes or omissions; please review configurations and outputs before operational use.
