.PHONY: dev local frontend backend electron ai-proxy setup db-create db-drop db-reset install clean help

ROOT_DIR := $(shell pwd)

# ─── Main Commands ───────────────────────────────────────────────

## Start everything (backend + frontend)
dev:
	@echo "🧠 Starting PolyMind..."
	@make backend &
	@sleep 5
	@make frontend

## Start frontend only — no backend, pure local mode (http://localhost:8080)
local:
	@echo "🧠 Starting PolyMind (local mode — no backend, no PostgreSQL)..."
	@make ai-proxy &
	@sleep 1
	cd $(ROOT_DIR) && NO_BACKEND=true yarn r polymind.ts bundle -p @polycanvas/web --dev

## Start the AI CORS proxy (http://localhost:3010)
ai-proxy:
	@echo "🤖 Starting AI proxy on http://localhost:3010..."
	cd $(ROOT_DIR)/packages/frontend/apps/ai-proxy && node --experimental-strip-types index.ts

## Start frontend only with backend proxy (http://localhost:8080)
frontend:
	@echo "🌐 Starting frontend on http://localhost:8080..."
	cd $(ROOT_DIR) && yarn r polymind.ts bundle -p @polycanvas/web --dev

## Start Electron desktop app (renderer on :8080 + Electron main process)
electron:
	@echo "🖥️  Starting PolyMind Electron..."
	@NO_BACKEND=true yarn r polymind.ts bundle -p @polycanvas/electron-renderer --dev &
	@echo "⏳ Waiting for renderer on localhost:8080..."
	@until curl -s -o /dev/null http://localhost:8080 2>/dev/null; do sleep 2; done
	@echo "✅ Renderer ready, launching Electron..."
	cd $(ROOT_DIR)/packages/frontend/apps/electron && DEV_SERVER_URL=http://localhost:8080 $(ROOT_DIR)/node_modules/.bin/tsx ./scripts/dev.ts

## Start backend only (http://localhost:3010)
backend:
	@echo "⚙️  Starting backend..."
	cd $(ROOT_DIR)/packages/backend/server && NODE_OPTIONS="--import=$(ROOT_DIR)/tools/cli/register.js --disable-warning=ExperimentalWarning" yarn dev

# ─── Setup Commands ─────────────────────────────────────────────

## First-time setup (install deps + create db + push schema)
setup: install db-create db-push
	@echo "✅ Setup complete! Run 'make dev' to start."

## Install dependencies
install:
	@echo "📦 Installing dependencies..."
	yarn install

## Push Prisma schema to database
db-push:
	@echo "🗄️  Pushing database schema..."
	cd $(ROOT_DIR)/packages/backend/server && npx prisma db push

## Create database
db-create:
	@echo "🗄️  Creating database..."
	createdb polymind 2>/dev/null || echo "Database 'polymind' already exists"

## Drop database
db-drop:
	@echo "⚠️  Dropping database..."
	dropdb polymind 2>/dev/null || echo "Database 'polymind' does not exist"

## Reset database (drop + create + push schema)
db-reset: db-drop db-create db-push
	@echo "✅ Database reset complete."

## Clean build artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -rf node_modules/.cache
	rm -rf packages/frontend/apps/web/dist
	@echo "✅ Clean complete."

# ─── Help ────────────────────────────────────────────────────────

## Show this help
help:
	@echo ""
	@echo "  PolyMind Commands:"
	@echo "  ────────────────────────────────"
	@echo "  make dev        - Start backend + frontend"
	@echo "  make local      - Start local mode (no backend, no PostgreSQL)"
	@echo "  make frontend   - Start frontend with backend proxy"
	@echo "  make electron   - Start Electron desktop app"
	@echo "  make ai-proxy   - Start AI CORS proxy (localhost:3010)"
	@echo "  make backend    - Start backend only (localhost:3010)"
	@echo "  make setup      - First-time setup (install + db)"
	@echo "  make install    - Install dependencies"
	@echo "  make db-push    - Push Prisma schema to database"
	@echo "  make db-create  - Create database"
	@echo "  make db-drop    - Drop database"
	@echo "  make db-reset   - Reset database"
	@echo "  make clean      - Clean build artifacts"
	@echo ""
