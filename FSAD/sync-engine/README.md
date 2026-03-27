# Real-Time Event Synchronization Engine

**Course Outcome CO1:** Use database queries and web technologies to create dynamic web pages (K3 Level – Apply)

---

## Project Overview

A fully browser-based simulation of a distributed, real-time event synchronization engine. It demonstrates how multiple database nodes communicate, propagate writes, detect conflicts, and maintain consistency using **vector clocks** and **Last-Write-Wins (LWW)** conflict resolution.

---

## Folder Structure

```
sync-engine/
│
├── index.html              ← App entry point (sidebar nav + script imports)
│
├── css/
│   ├── base.css            ← Variables, reset, layout shell, utilities
│   └── dashboard.css       ← Sidebar, panels, node cards, charts, tables
│
├── js/
│   ├── state.js            ← Shared reactive application state (AppState)
│   ├── db.js               ← KV database layer (write, read, del, query)
│   ├── engine.js           ← Simulation engine (tick, events, partitions)
│   ├── topology.js         ← Canvas network topology & packet animations
│   ├── ui.js               ← DOM rendering, toast notifications, charts
│   ├── router.js           ← Client-side page router + page templates
│   └── app.js              ← Bootstrap & wiring
│
└── README.md
```

---

## Pages / Modules

| Page         | Description |
|-------------|-------------|
| **Dashboard** | Full overview: topology, KPIs, node cards, vector clocks, conflicts |
| **Nodes**     | Detailed per-node stats and vector clock display |
| **Database**  | Live KV store table with versioning |
| **Event Log** | Scrolling real-time log of all distributed events |
| **Query Lab** | Interactive SQL/KV query simulator |
| **Conflicts** | Conflict resolution log and strategy explanation |

---

## CO1 Concepts Demonstrated

### Database Queries (K3 – Apply)
- **KV Database** with versioned records (write, read, delete)
- **Conflict detection** using version comparison
- **LWW Resolution**: stale writes are detected and discarded
- **Interactive Query Simulator** — real queries against live state:
  ```sql
  SELECT * FROM events WHERE node='N1'
  SELECT * FROM db
  SELECT COUNT(*)
  GET user:alice
  SHOW conflicts
  SHOW clocks
  ```

### Web Technologies for Dynamic Pages
- **Canvas API** — animated mesh topology with packet animations
- **DOM Manipulation** — all panels update on every engine tick
- **Event-driven architecture** — writes propagate asynchronously to peers
- **Client-side router** — SPA with 6 pages, no page reload
- **Vector Clocks** — Lamport timestamps track causal ordering

---

## How to Run

Simply open `index.html` in any modern browser. No build step required.

```bash
# Option 1: Open directly
open sync-engine/index.html

# Option 2: Local server (recommended)
cd sync-engine
python3 -m http.server 8080
# then visit http://localhost:8080
```

---

## Key Technologies

- Vanilla JavaScript (ES6 modules pattern via IIFEs)
- HTML5 Canvas API
- CSS custom properties (variables)
- Google Fonts (Rajdhani + Share Tech Mono)
- No frameworks, no build tools
