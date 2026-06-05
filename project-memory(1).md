# D&A Drive — Fleet Dashboard: Project Memory
*Last updated: 2026-06-05*

---

## 1. Project Overview

**What it is:** A real-time fleet monitoring web dashboard for D&A Drive, managing the WAFALLD / IKEA vehicle fleet across Morocco.

**How it works:**
- A static HTML file (the dashboard) runs in any browser
- It reads from and writes to a **Google Sheet** via a **Google Apps Script Web App**
- Drivers submit daily vehicle checks through a **separate HTML form** (also served by the same Apps Script)
- Multiple users can work simultaneously — dashboard auto-syncs every 5 minutes

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, Chart.js 4.4.1 |
| Backend/API | Google Apps Script (`code.gs`) |
| Data store | Google Sheets (5 tabs) |
| Fonts | DM Sans + DM Mono (Google Fonts) |
| Auth | Password modal (Admin vs Guest) on first open, stored in `sessionStorage` |

**Auth flow:** Login modal on open. Admin enters a password (checked against `PropertiesService` in Apps Script). Guest clicks "View as Guest" — stored as `VIEWER_MODE` in `sessionStorage`. Every write payload includes `password`, validated server-side before execution.

---

## 3. Current Files

| File | Purpose | Last known version |
|---|---|---|
| `index.html` | Dashboard UI | `index__12_.html` |
| `code.gs` | Apps Script backend | `complete_code_gs__1___5_.js` |

---

## 4. Key Configuration

```javascript
// index.html
const API_URL = 'https://script.google.com/macros/s/AKfycbwf56LwScE6MpM6R791gJ9DTPwveaQUOhqdUkRAg7VqajOlOcJLgiPZmNY0ctHgAhlHRQ/exec';
const OIL_INTERVAL = 15000; // default km — IVECO TRAILER uses 20000 via oilInterval(v)
function oilInterval(v){ return (v && v.model && v.model.toUpperCase().includes('IVECO TRAILER')) ? 20000 : OIL_INTERVAL; }
```

```javascript
// code.gs — sheet name constants
var SHEET_VEHICLES    = 'Vehicles';
var SHEET_DAILY       = 'Daily Checks';
var SHEET_MAINTENANCE = 'Maintenance';
var SHEET_LOG         = 'DashboardLog';
```

**Admin password:** Set via Apps Script → Project Settings → Script Properties → key `DASHBOARD_PASSWORD`.

---

## 5. Google Sheet Structure

| Tab | Purpose |
|---|---|
| `Vehicles` | Master vehicle registry — one row per vehicle |
| `Daily Checks` | Driver daily check form submissions |
| `Maintenance` | Mechanical history + planned interventions — what the Schedule tab reads |
| `DashboardLog` | Full audit trail — all edits, every change |
| `Incidents` | Driver incident report submissions |

### `Vehicles` sheet headers (exact, order matters):
```
Vehicle ID | Origin ID | Regist Exp | Model | Chassis | Rent Date | Handover Date |
Owner | Function | Fuel Card | PIN | Jawaz | Mileage | Last Check |
Rent Mileage | Last Oil Change | Next Oil Change | Annual Diagnostic |
Tyres Reference | Tyres Brand
```

### `Maintenance` sheet headers:
```
Col A (1): Timestamp          → server time of submission (audit only)
Col B (2): Vehicle ID
Col C (3): Type
Col D (4): KM at service
Col E (5): User
Col F (6): Notes
Col G (7): Status             → "Pending" (default) or "Done"
Col H (8): Intervention Date  → DD/MM/YYYY — selected by user, NEW THIS SESSION
```

> **Col H was added this session.** Must be added manually as header in the Google Sheet. Existing rows will have it blank — graceful fallback to Timestamp is in place.

### `Daily Checks` sheet headers (relevant columns):
```
Col A: Timestamp
Col B: IKEA ID (Driver ID)
Col C: Vehicle ID (matricule)
Col D: Kilometrage
```

---

## 6. Architecture — How Writes Work

All dashboard writes use **GET + URL-encoded payload** (not POST) to avoid CORS preflight:
```
GET ?action=updateVehicle&payload={...}&t=timestamp
```

Every write payload includes `password` field from `sessionStorage`, validated server-side.

---

## 7. Apps Script (`code.gs`) — All Functions

### Read functions (no auth required)
| Function | Description |
|---|---|
| `getAll_()` | Single endpoint returning vehicles + maintenance + dailyChecks in one response |
| `getVehicles_()` | Returns all Vehicles rows as JSON |
| `getLogs_()` | Returns all DashboardLog rows as JSON (not used in auto-sync) |
| `getMaintenanceLog_()` | Returns all Maintenance rows as JSON, includes `_row` index |
| `getDailyChecks_()` | Returns Daily Checks rows — 2026+ only (date filter applied) |

### Write functions (password-protected)
| Function | Description |
|---|---|
| `updateVehicle_(payload)` | Updates specified fields on a vehicle row; logs to DashboardLog |
| `logOilChange_(payload)` | Updates Last Oil Change + Next Oil Change only (NOT Mileage/Last Check — fixed this session); appends to Maintenance + DashboardLog; respects IVECO TRAILER 20,000 km interval |
| `logDiagnostic_(payload)` | Updates diagnostic expiry; appends to Maintenance + DashboardLog |
| `logMaintenance_(payload)` | Appends planned intervention to Maintenance + DashboardLog |
| `addVehicle_(payload)` | Appends new row to Vehicles; logs to DashboardLog |
| `markMaintenanceDone_(payload)` | Sets Maintenance row col G → `Done` |
| `deleteMaintenanceRow_(payload)` | Deletes a row from Maintenance sheet by row index |
| `updateMaintenanceCell_(payload)` | Updates a specific cell in Maintenance (inline Notes editing, col 6) |
| `updateMaintenanceRow_(payload)` | Updates cols B/C/D/F of a Maintenance row by `_row` index |

### Helpers
| Function | Description |
|---|---|
| `cors_(output)` | Sets MIME type to JSON |
| `getOrCreateLogSheet_(ss)` | Creates DashboardLog tab if missing |
| `appendLog_(ss, entry)` | Appends a row to DashboardLog |
| `testRun()` | Public wrapper to manually trigger auth |

---

## 8. Frontend (`index.html`) — Feature State

### Tab order
1. 📊 Overview
2. 🚐 Fleet
3. 🗓 Schedule
4. 🛢 Oil Changes
5. 📅 Annual Diagnostic

### Pages & features

**Overview**
- 7 KPI cards: Total, Oil Overdue, Oil Critical, Oil Due Soon, Oil OK, Diag Urgent, % App Usage
- Alert banners for overdue oil and urgent diagnostics
- Donut chart: fleet by model
- Bar chart: fleet by zone
- App Usage section — positioned above Top 10 oil list
- Top 10 closest to oil change list (clickable → opens oil modal)
- 🖨 Print / Export PDF button in Overview header

**Fleet**
- Zone filter buttons: All, CAS, RBA, RAK, AGA, MKS, TRS, CAB, 🔴 Down/Garage
- Search: filters by Vehicle ID, Zone, and Model
- `+ Add vehicle` button → Add Vehicle modal
- Full vehicle table, click any row → Edit modal
- Inline Oil + Diag action buttons per row

**Schedule (Planned Interventions)**
- Reads from `Maintenance` sheet
- Type filter buttons: All, Oil Change, Diagnostic, Tyres, Brakes, Inspection, Other
- Search: filters by Vehicle ID
- Date range filter (from → to)
- `+ Plan intervention` button → Schedule modal
- Table sorted newest → oldest by Intervention Date (fallback to Timestamp)
- Table: Date | Vehicle + Model | Type badge | KM | User | Notes (inline editable) | Status
- Per-row actions: ✏ Edit / Mark done / 🗑 Delete (Pending only)
- Calendar view toggle (month view)
  - Full intervention type names (no abbreviation)
  - "+X more" chip is clickable → opens Day Detail Panel
  - Clicking any day cell with events opens Day Detail Panel

**Day Detail Panel** *(new this session)*
- Slide-in panel from right side
- Shows all interventions for a clicked calendar day
- Each intervention rendered as a color-coded card: Vehicle ID, Model, Type, KM, Notes, User
- Close button or clicking away closes it

**Oil Changes**
- Filter: All, Overdue, <2,000 km, <5,000 km, OK
- Search: filters by Vehicle ID, Zone, and Model *(Model added this session)*
- Sorted by urgency
- Log oil change action per row — includes Date of Intervention picker *(new this session)*

**Annual Diagnostic**
- Filter: All, Overdue, <1 month, <3 months, OK
- Search: filters by Vehicle ID, Zone, and Model *(new this session)*
- Sorted by days remaining
- Renew action per row — includes Date of Intervention picker *(new this session)*

---

## 9. Key JS State Variables

```javascript
let vehicles          = [];   // mapped vehicle objects
let dailyChecks       = [];   // Daily Checks rows
let maintenance       = [];   // Maintenance sheet rows (raw)
let maintenanceSorted = [];   // pre-sorted by Intervention Date desc — rebuilt on fetch
let vehicleMap        = {};   // id → vehicle object lookup — rebuilt on fetch
let logs              = [];   // DashboardLog rows (fetched but not rendered)
let oilFilter         = 'all';
let fleetFilter       = 'all';
let diagFilter        = 'all';
let schedFilter       = 'all';
let activeVehicleId   = null;
let activeSchedRow    = null;
let donutChart        = null;
```

---

## 10. Performance Architecture

| # | Change | Impact |
|---|---|---|
| P1 | Optimistic UI — all 9 write functions patch local state, no post-write `fetchData` | ~3–6s saved per action |
| P2 | Single `getAll` endpoint on load/sync | ~4–8s saved on load |
| P3 | `getDailyChecks` date filter — 2026+ rows only | Reduced payload |
| P4 | Lazy tab rendering — `renderActiveTab()` only | ~0.5–1s per sync |
| P5 | Auto-sync at 5 min (was 60s) | Reduced API quota |
| P6 | Batch `setValue` in `updateMaintenanceRow_` | Minor Sheets API efficiency |
| P7 | `staleWhileRevalidate` — renders from memory instantly on manual refresh, fetches in background | Perceived speed |
| P8 | `sessionStorage` cache — renders from cache on page load, fetches fresh in background | Eliminates cold-start spinner on repeat loads |
| P9 | `vehicleMap` lookup — O(1) instead of `vehicles.find()` in `renderSchedule` | Eliminates 40k+ iterations per Schedule render |
| P10 | `maintenanceSorted` pre-sorted cache — sort runs once on fetch, not on every render | Eliminates repeated sort + date parsing |
| P11 | `SCHED_TYPE_COLORS` and `SCHED_TYPE_STYLE` moved outside render functions as module constants | Eliminates object recreation per render |
| P12 | `requestAnimationFrame` on tab switch — browser paints tab transition before rendering content | Eliminates frozen-click feeling |
| P13 | Removed `JSON.stringify` from Schedule row template — replaced with `data-` attributes | Eliminates 100+ serializations per Schedule render |

### `rebuildVehicleMap()` and `rebuildMaintenanceSorted()` — called after:
- `fetchData` completes (both cache load and live fetch)
- Any write that touches `maintenance` (`saveOilChange`, `saveDiag`, `saveSchedule`)

---

## 11. Session Auth & Security

### Current flow
- Login modal on page load
- Admin: password → stored in `sessionStorage` as `dash_pass` + timestamp in `dash_login_time`
- Guest: stored as `VIEWER_MODE` + timestamp
- **8-hour expiry**: on `DOMContentLoaded`, if `dash_login_time` is older than 8 hours, session is cleared and login modal re-appears
- **🔒 Lock button** in header: clears `dash_pass`, `dash_login_time`, `dna_cache` → shows login modal immediately. Works as Admin↔Guest switch.

### SessionStorage keys
| Key | Value |
|---|---|
| `dash_pass` | Admin password string or `'VIEWER_MODE'` |
| `dash_login_time` | `Date.now()` timestamp of login |
| `dna_cache` | JSON stringified `{ vehicles, maintenance, dailyChecks, lastModified }` |
| `dash_user` | User's display name |

---

## 12. Business Logic

### Oil change thresholds
```
km remaining ≤ 0      → OVERDUE  (red)
km remaining ≤ 2,000  → CRITICAL (red)
km remaining ≤ 5,000  → DUE SOON (amber)
km remaining > 5,000  → OK       (green)
null data             → No data  (gray)
```

### Oil interval by model
```
IVECO TRAILER → 20,000 km
All others    → 15,000 km
```
Implemented via `oilInterval(v)` helper in frontend and conditional in `logOilChange_` backend.

### Annual diagnostic thresholds
```
days < 0    → OVERDUE     (red)
days ≤ 30   → Xd left     (red)
days ≤ 90   → Xd left     (amber)
days > 90   → Xd left     (green)
null data   → No data     (gray)
```

### App usage thresholds
```
% ≥ 80   → green
% ≥ 50   → amber
% < 50   → red
```

---

## 13. Intervention Date (Col H) — How It Works

Introduced this session to decouple "when the entry was logged" from "when the intervention actually happened".

- **Oil Changes modal**: date picker, defaults to today, editable for backdating
- **Annual Diagnostic modal**: same
- **Schedule (Plan intervention) modal**: same
- Sent as `interventionDate` (DD/MM/YYYY) in payload to Apps Script
- Written to **col H** of Maintenance sheet
- `renderSchedule` displays `Intervention Date` (col H), falls back to `Timestamp` (col A) for old rows, strips time component
- `renderSchedCal` uses `Intervention Date` first for calendar placement, falls back to `Timestamp`
- `openDayPanel` uses same priority logic

---

## 14. Button Lock (Anti Double-Click)

Helper functions added before `// ---- MODALS ----`:

```javascript
function lockBtn(btn, loadingText='Saving…'){
  btn.disabled = true;
  btn._origText = btn.textContent;
  btn.textContent = loadingText;
  btn.style.opacity = '0.6';
}
function unlockBtn(btn){
  if(!btn) return;
  btn.disabled = false;
  btn.textContent = btn._origText || 'Save';
  btn.style.opacity = '';
}
```

Applied to: `saveOilChange`, `saveDiag`, `saveSchedule`, `saveEditSchedule`, `saveEdit`, `saveAdd`.
- Button locks on click
- Unlocks on error path (`if(!res)`)
- On success the modal closes — no need to unlock

---

## 15. Zone Reference

| Code | Zone |
|---|---|
| CAS | Casablanca |
| RBA | Rabat |
| RAK | Marrakech |
| AGA | Agadir |
| MKS | Meknès |
| TRS | Transport |
| CAB | Tanger / CAB |
| DOWN | In repair / garage |

---

## 16. Key URLs & IDs

| Item | Value |
|---|---|
| Apps Script Web App URL | `https://script.google.com/macros/s/AKfycbwf56LwScE6MpM6R791gJ9DTPwveaQUOhqdUkRAg7VqajOlOcJLgiPZmNY0ctHgAhlHRQ/exec` |
| Google Drive photos folder | `19MizOwvGRKzuG9Ke2im7z7s7lsvRt1Eq` |
| GitHub repo | `dna-drive-fleet` (private) |

---

## 17. Deployment Checklist

1. Open Google Sheet → Extensions → Apps Script
2. Replace `code.gs` with latest version
3. **Manually add `Intervention Date` header in col H of `Maintenance` sheet** *(new requirement)*
4. Confirm Script Property exists: key `DASHBOARD_PASSWORD`
5. Run `testRun()` to re-authorize
6. Deploy → Manage deployments → Edit → **New version** → Deploy
7. URL stays the same — no change needed in `index.html`

---

## 18. Known Issues / Small Bugs

| Issue | Location | Status |
|---|---|---|
| `toast('Viewing dashboard as Guest', 'info')` — `'info'` type has no CSS class | `index.html` | Harmless, shows default dark |
| `let scheduled = []` — unused legacy variable | `index.html` | Safe to remove |
| Write buttons visible to Guest users — clicks fail silently with Unauthorized toast | `index.html` | Not yet hidden |
| `getLogs` fetched but never rendered | `index.html` | Low priority (sync is 5 min) |

---

## 19. Planned / Future Work

| Feature | Notes |
|---|---|
| Hide write buttons for Guest users | Guests see all action buttons; clicks fail with Unauthorized toast |
| `feature/downtime-tracker` | Dedicated tab for DOWN vehicles with entry/exit dates and downtime duration |
| `feature/email-whatsapp-alerts` | Apps Script time trigger for overdue vehicles |
| `feature/zone-export` | Per-zone CSV/PDF export |
| `feature/last-check-in-fleet-table` | Show last daily check date in Fleet table |
| `feature/conflict-detection` | Warn when two users edit same vehicle simultaneously |
| Daily check mileage (col D) | Could cross-check vehicle mileage drift |
| Pre-2026 Daily Checks query | Add `?from=` param to `getDailyChecks_()` if historical scan needed |
| `getLogs_()` date filter | Apply year filter when DashboardLog grows large |
| Export enhancements | Current print/PDF covers Overview only |

---

## 20. Session History

### Sessions prior to 2026-06-02
- Built core dashboard: KPI cards, Fleet table, Oil tab, Diag tab, Schedule tab
- Added auth modal (Admin password + Guest mode)
- Added App Usage feature (ring gauge, daily bar chart, not-scanned by zone)

### Session 2026-06-02
- `getDailyChecks_()` date filter (code.gs)
- App Usage moved above Top 10 oil list in Overview
- Bug fix: scans-per-day D+1 offset (UTC vs local date key)
- Schedule tab: date range filter added
- Print / Export PDF button added to Overview
- Schedule ✏ Edit modal designed and coded

### Session 2026-06-03
- Performance overhaul — P1–P6 applied
- Model filter added to Fleet tab search
- `getAll_()` endpoint added to code.gs
- Optimistic UI applied to all 9 write functions
- Lazy tab rendering via `renderActiveTab()`
- Bug fixed: duplicate `const v` in `saveAdd`
- Bug fixed: `submitAdminPassword is not defined` cascade

### Session 2026-06-05
**Discussed and patched (all surgical):**

- **Font unification** — `*{}` reset now includes `font-family:inherit`, propagates DM Sans into login modal inputs/buttons
- **Annual Diagnostic filter** — search bar added (Vehicle ID, Zone, Model), mirrors Oil Changes filter
- **Oil Changes filter** — Model added to search string, placeholder updated
- **Oil change mileage bug fixed** — `logOilChange_` no longer writes to Mileage (col M) or Last Check (col N); only touches Last Oil Change and Next Oil Change
- **Intervention Date (col H)** — added to Oil, Diag, and Schedule modals; written to Maintenance sheet col H; displayed in Schedule list and used for calendar placement; Day Detail Panel also uses it
- **Calendar: full intervention names** — type abbreviation map removed
- **Calendar: Day Detail Panel** — slide-in right panel showing all interventions for a clicked day, color-coded cards with full details
- **IVECO TRAILER oil interval** — 20,000 km via `oilInterval(v)` helper; applied in all 6 frontend spots and in `logOilChange_` backend
- **Schedule list sorted newest → oldest** — by Intervention Date, fallback to Timestamp
- **Button lock (anti double-click)** — `lockBtn`/`unlockBtn` helpers applied to all 6 save functions
- **Stale-while-revalidate** — manual refresh renders from memory instantly, fetches in background (P7)
- **SessionStorage cache** — renders from cache on load, fetches fresh in background (P8)
- **Schedule performance** — `vehicleMap` O(1) lookup (P9), `maintenanceSorted` pre-sorted cache (P10), module-level type constants (P11), `requestAnimationFrame` on tab switch (P12), `data-` attributes replacing `JSON.stringify` in row template (P13)
- **Bug fixed**: nested template literal in `renderSchedule` IIFE (`v.model` backtick collision) — switched to string concatenation
- **Bug fixed**: `(l['Vehicle ID']||'').replace is not a function` — all row fields wrapped in `String()` before attribute injection
- **Session lock & expiry** — 🔒 Lock button in header clears session and shows login modal; 8-hour auto-expiry on `DOMContentLoaded`; login timestamp stored in `dash_login_time`

---

## 21. How to Run Locally

1. Download `index.html`
2. Open in any browser
3. Enter Admin password (or continue as Guest)
4. Enter your name → dashboard loads from Google Sheet automatically
