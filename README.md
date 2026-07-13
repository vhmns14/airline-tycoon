# Airline Tycoon

Web-based airline management tycoon (CEO / ops sim, not a flight simulator).

## Stack

- **Client:** React 18 + Vite + TypeScript + Tailwind + Zustand
- **Server:** Express + SQLite (`node:sqlite`) + JWT auth
- **Persistence:** localStorage (always) + optional cloud save when logged in

## Run (client + API)

```bash
cd airline-tycoon
npm install
npm run dev
```

- Web UI: URL Vite prints (usually `http://localhost:5173`)
- API: `http://localhost:3001` (proxied as `/api` in dev)

### Separate processes

```bash
npm run dev:server   # API only
npm run dev:client   # Vite only
```

### Production-ish API

```bash
export JWT_SECRET='long-random-string'
npm run start:server
```

Database file: `server/data/airline-tycoon.db`

## Cloud login

1. Click **Log in / Save** in the top bar
2. Register a username (3–24 chars) + password (min 6)
3. Progress auto-syncs to SQLite every few seconds while logged in
4. Log in on another browser/device → cloud save loads

Guest play still works offline via this browser only.

## Env

| Variable     | Default              | Notes                          |
|-------------|----------------------|--------------------------------|
| `PORT`      | `3001`               | API port                       |
| `JWT_SECRET`| dev placeholder      | **Change in production**       |
