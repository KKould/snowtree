#!/bin/bash
# Clean start script - ensures latest code is always used
set -e

echo "[1/5] Killing running processes..."
pkill -f 'Electron' 2>/dev/null || true
pkill -f 'snowtree' 2>/dev/null || true
pkill -f 'vite' 2>/dev/null || true
pkill -f 'tsc.*watch' 2>/dev/null || true
lsof -ti:4521 | xargs kill -9 2>/dev/null || true
sleep 1

echo "[2/5] Clearing Vite cache..."
rm -rf packages/ui/node_modules/.vite

echo "[3/5] Clearing Electron app cache..."
rm -rf ~/Library/Application\ Support/snowtree/Cache 2>/dev/null || true
rm -rf ~/Library/Application\ Support/snowtree/Code\ Cache 2>/dev/null || true
rm -rf ~/Library/Application\ Support/snowtree/GPUCache 2>/dev/null || true
rm -rf ~/Library/Caches/snowtree 2>/dev/null || true

echo "[4/6] Clearing UI build..."
rm -rf packages/ui/dist

echo "[5/6] Building desktop package..."
pnpm --filter @snowtree/desktop build

echo "[6/6] Starting dev server..."
echo "=========================================="
pnpm dev
