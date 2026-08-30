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
- **Storage:** SQLite (`data/app.sqlite`) for mutable app state, sessions, CSV/lua caches, and combat missions. DCS export JSON files remain the simulator bridge. On first load, leftover app JSON is imported then moved to `data/legacy-json/`. Backup with `npm run data:backup`. Requires Node 22.13+ (`node:sqlite` is still experimental).

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
- Node.js 22.13+ (uses the built-in SQLite driver)
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


#ALGORITHM

Spiegazione teorica (alto livello)

Per ogni aeroporto attivo e ogni arma importante, il sistema calcola lo stato usando le soglie per‑arma:
X (media), X/2 (alta), X/4 (critica).
Se lo stock scende sotto queste soglie, viene creato un ordine con quantità orderQuantity (di default = X).
Se un aeroporto supera X*2 per un’arma, può diventare donatore (se non è la base principale). La base principale resta sempre sorgente “infinita”.
Per ogni ordine si calcola il “peso ISO” (isoFill), che serve a comporre il carico dei C‑130.
Le missioni sono ottimizzate per sfruttare la capacità totale di 2.5 unità (2 ISO + 1 ISO small).
Gli ordini vengono spezzati se superano la capacità residua per riempire più missioni.
Le missioni sono raggruppate per rotta (source → destination) e velivolo consigliato.
Non si duplicano ordini nella stessa missione/rotta.
C’è una regola semplice di “sharing”: se sulla stessa rotta ci sono 2 missioni con ISO small vuoti e una missione con 1 ISO pieno, si sposta 0.5+0.5 dentro i piccoli e si elimina la missione da 1 ISO.
Schema logico (passi chiave)

INPUT

Scorte per aeroporto
Config arma: thresholdX, orderQuantity, isoFill
Config logistica: ISO 1.0, ISO small 0.5, max 2.5
Distanze, aeroporti attivi, base principale
GENERAZIONE ORDINI

Per ogni aeroporto attivo
Per ogni arma importante
Calcola priorità:
<= X/4 => critical, <= X/2 => high, <= X => medium, altrimenti ok
Se priorità ≠ ok → crea ordine (qty = orderQuantity)
Determina donatore: base principale o aeroporto che supera X*2
(rispettando distanza e condizioni di donazione)
Deduplica ordini per aeroporto/arma
CREAZIONE MISSIONI (packing)

Raggruppa ordini per rotta e tipo velivolo
Per ogni gruppo:
Ordina per priorità (critical > high > medium)
Alloca isoFill dentro la capacità 2.5
Se un ordine non entra intero → crea “chunk” residuo per la prossima missione
Regola “sharing” tra missioni della stessa rotta (spostare 1 ISO in 2 small)
OUTPUT

Missioni con più ordini, carico ISO composto, sorgente, destinazione, priorità, velivolo consigliato
Grafica (flowchart ASCII)

[Scorte aeroporto] + [Config arma/logistica]
            |
            v
   [Calcolo soglie X, X/2, X/4]
            |
            v
 [Priorità per arma: critical/high/medium/ok]
            |
            v
    [Se ok -> skip]  [Se != ok -> crea ordine]
            |
            v
 [Sorgente: base principale o donatore (X*2 + distanza)]
            |
            v
      [Ordini per rotta + velivolo]
            |
            v
    [Packing ISO: max 2.5 unità]
      |             |
      |             +--> [Split ordine se non entra]
      v
 [Missioni con più ordini]
            |
            v
[Sharing: se 2 small vuoti + 1 iso pieno -> sposta 0.5+0.5]
            |
            v
      [Missioni finali] 