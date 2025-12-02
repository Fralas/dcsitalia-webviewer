#!/bin/bash

# DCS Warehouse Viewer - Quick Start Script

echo "╔═══════════════════════════════════════════════════════╗"
echo "║   🎮 DCS Warehouse Viewer - Starting...              ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "🚀 Starting development servers..."
echo "   - Backend: http://localhost:3001"
echo "   - Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
