# Airline Tycoon — Checkpoint (2026-07-13)

Catatan handoff. Workspace: `/home/vahmi/ghproject/airline-tycoon`

---

## Status umum

Game **playable** end-to-end. Build: `npx tsc -b` lulus (sesi polish 2026-07-13).

Default flight: **real-time 1×**. Opsional **30× / 60×** di Airline → Settings.

---

## Sesi 2026-07-13 — polish

### Balance
- `REALTIME_REVENUE_MULT` **2.65**, `REALTIME_COST_MULT` **0.8**
- Fair price/cargo rate: base + per-km (short hop tetap hidup)
- Leg P&L book fuel cost (`LEG_FUEL_COST_PER_L`) biar toast profit jujur
- Slot fee regional lebih murah; mega-hub masih mahal
- Fuel market band sedikit lebih lunak; start fuel/cash difficulty naik tipis
- Map cargo payout naik; TTL 1h; mix job 1–3t / 4–10t / 11–20t

### Map cargo
- Board di **Map tab** (bukan cuma Airline): accept, freighter match, km, ETA
- Filter map **Cargo** + arc oranye (solid = active, dashed = offer)
- OD airport ring oranye; toolbar **Cargo** fit-to-jobs
- Delivery butuh freighter **role cargo + capacity ≥ tons**
- Toast jelas kalau freighter kelewat kecil

### Mobile
- Bottom dock: **Ops · Map · Flt · Rte · Buy · More** (sheet Hub/Fuel/Airline/Bank/Books)
- Safe-area padding; touch pan + pinch zoom di map
- TopBar HUD lebih padat; map height responsif
- Touch targets / `touch-action: manipulation`

---

## File penting

| Area | Path |
|------|------|
| Balance knobs | `src/sim/constants.ts`, `economy.ts`, `airportRules.ts`, `fuel.ts`, `difficulty.ts` |
| Map cargo | `src/sim/mapCargo.ts`, `components/map/MapPanel.tsx`, `WorldMap.tsx` |
| Mobile nav | `components/layout/Sidebar.tsx`, `TopBar.tsx`, `App.tsx`, `index.css` |
| State | `src/store/gameStore.ts` |

---

## Cara main singkat

1. Found airline → Hangar sewa/beli prop (atau freighter kecil untuk cargo).
2. Fuel farm → Routes open → **Fly**.
3. Map → **Cargo** filter: accept job → freighter route A→B → land → lump sum.
4. Time scale di Airline kalau mau ngebut.

Save: localStorage `airline-tycoon-save` + cloud kalau login.

---

## Dev

```bash
cd /home/vahmi/ghproject/airline-tycoon
npm run dev
npx tsc -b
```

---

## Backlog (masih kasar)

- [ ] Balance fine-tune setelah main 1–2 jam real-time lagi
- [ ] In-flight leg yang sudah jalan sebelum ganti scale tetap ETA lama
- [ ] Used listings masih ephemeral (memory)
- [ ] Season leaderboard murni local
- [ ] Tutorial teks update fitur baru
- [ ] Push GitHub (saat ini git **lokal** saja)
