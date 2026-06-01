# D&A Drive — Fleet Dashboard: Project Memory
*Last updated: 2026-06-01*

---

## 1. Project Overview

**What it is:** A real-time fleet monitoring web dashboard for D&A Drive, managing the WAFALLD / IKEA vehicle fleet across Morocco.

**How it works:**
- A static HTML file (the dashboard) runs in any browser
- It reads from and writes to a **Google Sheet** via a **Google Apps Script Web App**
- Drivers submit daily vehicle checks through a **separate HTML form** (also served by the same Apps Script)
- Multiple users can work simultaneously — dashboard auto-syncs every 60 seconds

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, Chart.js 4.4.1 |
| Backend/API | Google Apps Script (`code.gs`) |
| Data store | Google Sheets (5 tabs) |
| Fonts | DM Sans + DM Mono (Google Fonts) |
| Auth | Password prompt (Admin vs Guest) on first open, stored in `sessionStorage` |

> Auth was upgraded in a prior session: users now see a login modal on open. Admin enters a password (checked against `PropertiesService` in Apps Script). Guest clicks "View as Guest" — stored as `VIEWER_MODE` in `sessionStorage`. Write actions send the password in every payload; Apps Script validates it before executing.

---

## 3. Current Files

| File | Purpose |
|---|---|
| `index.html` | Dashboard UI — ~1,480 lines, fully working |
| `code.gs` | Apps Script backend — ~433 lines, fully working |

---

## 4. Key Configuration

```javascript
// index.html
const API_URL = 'https://script.google.com/macros/s/AKfycbwf56LwScE6MpM6R791gJ9DTPwveaQUOhqdUkRAg7VqajOlOcJLgiPZmNY0ctHgAhlHRQ/exec';
const OIL_INTERVAL = 15000; // km between oil changes
```

```javascript
// code.gs — sheet name constants
var SHEET_VEHICLES    = 'Vehicles';
var SHEET_DAILY       = 'Daily Checks';
var SHEET_MAINTENANCE = 'Maintenance';
var SHEET_LOG         = 'DashboardLog';
```

---

## 5. Google Sheet Structure

| Tab | Purpose |
|---|---|
| `Vehicles` | Master vehicle registry — one row per vehicle |
| `Daily Checks` | Driver daily check form submissions |
| `Maintenance` | Mechanical history only — what the Schedule tab reads |
| `DashboardLog` | Full audit trail — all edits, every change |
| `Incidents` | Driver incident report submissions |

### `Vehicles` sheet headers (exact, order matters):
```
Vehicle ID | Origin ID | Regist Exp | Model | Chassis | Rent Date | Handover Date |
Owner | Function | Fuel Card | PIN | Jawaz | Mileage | Last Check |
Rent Mileage | Last Oil Change | Next Oil Change | Annual Diagnostic |
Tyres Reference | Tyres Brand
```

### `Daily Checks` sheet headers (relevant columns):
```
Col A: Timestamp
Col B: IKEA ID (Driver ID)
Col C: Vehicle ID (matricule)
Col D: Kilometrage
Col R: Driver Name (matched to Driver ID)
```

### `Maintenance` sheet headers:
```
Timestamp | Vehicle ID | Type | KM at service | User | Notes | Status
```
> Column G = `Status`. Values: `Pending` (default) or `Done`.

### `DashboardLog` sheet headers:
```
Timestamp | Vehicle ID | Type | KM at service | Scheduled date | Mechanic | User | Notes
```

**Key field conventions:**
- Dates stored as `DD/MM/YYYY` strings
- `Function` field contains zone (e.g. `CAS Livraison`, `RBA Transport`)
- Oil interval: **15,000 km**

---

## 6. Architecture — How Writes Work

All dashboard writes use **GET + URL-encoded payload** (not POST) to avoid CORS preflight:
```
GET ?action=updateVehicle&payload={...}&t=timestamp
```

Every write payload includes `password` field, validated server-side.

> To set the password: Apps Script editor → Project Settings → Script Properties → add key `DASHBOARD_PASSWORD`.

---

## 7. Apps Script (`code.gs`) — All Functions

### Read functions (no auth required)
| Function | Description |
|---|---|
| `getVehicles_()` | Returns all Vehicles rows as JSON |
| `getLogs_()` | Returns all DashboardLog rows as JSON |
| `getMaintenanceLog_()` | Returns all Maintenance rows as JSON, includes `_row` index |
| `getDailyChecks_()` | **[NEW]** Returns Daily Checks rows — cols A/B/C only (timestamp, driverId, vehicleId) |

### Write functions (password-protected)
| Function | Description |
|---|---|
| `updateVehicle_(payload)` | Updates specified fields on a vehicle row; logs to DashboardLog |
| `logOilChange_(payload)` | Updates mileage/oil fields; appends to Maintenance + DashboardLog |
| `logDiagnostic_(payload)` | Updates diagnostic expiry; appends to Maintenance + DashboardLog |
| `logMaintenance_(payload)` | Appends planned intervention to Maintenance + DashboardLog |
| `addVehicle_(payload)` | Appends new row to Vehicles; logs to DashboardLog |
| `markMaintenanceDone_(payload)` | Sets Maintenance row col G → `Done` |
| `deleteMaintenanceRow_(payload)` | Deletes a row from Maintenance sheet by row index |
| `updateMaintenanceCell_(payload)` | Updates a specific cell in Maintenance (inline Notes editing) |

### Helpers
| Function | Description |
|---|---|
| `cors_(output)` | Sets MIME type to JSON |
| `getOrCreateLogSheet_(ss)` | Creates DashboardLog tab if missing |
| `appendLog_(ss, entry)` | Appends a row to DashboardLog |
| `testRun()` | Public wrapper to manually trigger auth |

---

## 8. Frontend (`index.html`) — Complete Feature State

### Tab order
1. 📊 Overview
2. 🚐 Fleet
3. 🗓 Schedule
4. 🛢 Oil Changes
5. 📅 Annual Diagnostic

### Pages & features

**Overview**
- 7 KPI cards: Total, Oil Overdue, Oil Critical, Oil Due Soon, Oil OK, Diag Urgent, **% App Usage** *(new)*
- Alert banners for overdue oil and urgent diagnostics
- Donut chart: fleet by model
- Bar chart: fleet by zone
- Top 10 closest to oil change list (clickable → opens oil modal)
- **App Usage section** *(new — see Section 9)*

**Fleet**
- Zone filter buttons: All, CAS, RBA, RAK, AGA, MKS, TRS, CAB, 🔴 Down/Garage
- Search: filters by Vehicle ID and Zone only
- `+ Add vehicle` button → Add Vehicle modal
- Full vehicle table, click any row → Edit modal
- Inline Oil + Diag action buttons per row

**Schedule (Planned Interventions)**
- Reads from `Maintenance` sheet
- Type filter buttons: All, Oil Change, Diagnostic, Tyres, Brakes, Inspection, Other
- Search: filters by Vehicle ID only
- `+ Plan intervention` button → Schedule modal
- Table: Date | Vehicle + Model | Type badge | KM | User | Notes (inline editable) | Status
- `Mark done` / `🗑 Delete` buttons per row

**Oil Changes**
- Filter: All, Overdue, <2,000 km, <5,000 km, OK
- Sorted by urgency
- Log oil change action per row

**Annual Diagnostic**
- Filter: All, Overdue, <1 month, <3 months, OK
- Sorted by days remaining
- Renew action per row

### JS state variables
```javascript
let vehicles    = [];      // mapped vehicle objects
let logs        = [];      // DashboardLog rows
let dailyChecks = [];      // [NEW] Daily Checks rows (timestamp, driverId, vehicleId)
let maintenance = [];      // Maintenance sheet rows
let scheduled   = [];      // unused legacy var
let oilFilter   = 'all';
let fleetFilter = 'all';
let diagFilter  = 'all';
let schedFilter = 'all';
let activeVehicleId = null;
let donutChart  = null;
let syncInterval = null;
let lastModified = null;
let usageDays   = 7;       // [NEW] default range for app usage
let usageFrom   = null;    // [NEW] custom date range start
let usageTo     = null;    // [NEW] custom date range end
```

### Data fetching
`fetchData()` fires **4** parallel requests on load and every 60s:
```javascript
const [vRes, lRes, mRes, dRes] = await Promise.all([
  fetch(API_URL + '?action=getVehicles&t='       + Date.now(), ...),
  fetch(API_URL + '?action=getLogs&t='           + Date.now(), ...),
  fetch(API_URL + '?action=getMaintenanceLog&t=' + Date.now(), ...),
  fetch(API_URL + '?action=getDailyChecks&t='    + Date.now(), ...)  // NEW
]);
```

---

## 9. App Usage Feature (NEW — added 2026-06-01)

### What was built
A new section at the bottom of the Overview tab that tracks whether drivers are actually using the daily check app.

### Three visual panels (side by side)
| Panel | Description |
|---|---|
| Ring gauge | Big % number with color-coded arc (green ≥80%, amber ≥50%, red <50%) |
| Scans per day | Bar chart — one bar per day, up to 14 bars. Today = dark blue, past = lighter blue, zero = gray |
| Not scanned by zone | Every vehicle with zero scans in the period, grouped by zone, shown as red chip badges |

### % App Usage KPI card (7th card in top row)
- Formula: `unique vehicles scanned ÷ total fleet × 100`
- Same color thresholds as ring gauge
- Sub-label updates to reflect the active date range

### Date range filter (in section header)
- **Last 7 days** (default)
- **Today**
- **Last 30 days**
- **Custom range** via two date pickers
- All panels + KPI card react instantly on change

### Key design decisions
- **Mileage (col D) was intentionally excluded** from this feature — it's a snapshot at scan time, not more accurate than the Vehicles sheet, adds complexity for no usage-tracking benefit. Deferred for future use if needed.
- **Top drivers list was intentionally excluded** — not requested, kept scope clean.
- **No new tab** — everything lives in Overview to keep tab count at 5.

### Functions added to `index.html`
| Function | Description |
|---|---|
| `buildAppUsage()` | Main render function — called from `rebuildAll()` |
| `setUsageRange(days, el)` | Sets preset range (7/1/30 days) and re-renders |
| `setUsageCustom()` | Reads custom date inputs and re-renders |
| `usageDateRange()` | Helper — returns `{from, to}` Date objects for current filter |

---

## 10. Business Logic

### Oil change thresholds
```
km remaining ≤ 0      → OVERDUE  (red)
km remaining ≤ 2,000  → CRITICAL (red)
km remaining ≤ 5,000  → DUE SOON (amber)
km remaining > 5,000  → OK       (green)
null data             → No data  (gray)
```

### Annual diagnostic thresholds
```
days < 0    → OVERDUE     (red)
days ≤ 30   → Xd left     (red)
days ≤ 90   → Xd left     (amber)
days > 90   → Xd left     (green)
null data   → No data     (gray)
```

### App usage thresholds (new)
```
% ≥ 80   → green
% ≥ 50   → amber
% < 50   → red
```

---

## 11. Zone Reference

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

## 12. Key URLs & IDs

| Item | Value |
|---|---|
| Apps Script Web App URL | `https://script.google.com/macros/s/AKfycbwf56LwScE6MpM6R791gJ9DTPwveaQUOhqdUkRAg7VqajOlOcJLgiPZmNY0ctHgAhlHRQ/exec` |
| Google Drive photos folder | `19MizOwvGRKzuG9Ke2im7z7s7lsvRt1Eq` |
| GitHub repo | `dna-drive-fleet` (private) |
| Admin password | Set via Apps Script → Project Settings → Script Properties → `DASHBOARD_PASSWORD` |

---

## 13. Deployment Checklist

1. Open Google Sheet → Extensions → Apps Script
2. Replace `code.gs` with latest version
3. Confirm Script Property exists: key `DASHBOARD_PASSWORD`
4. Run `testRun()` to re-authorize
5. Deploy → Manage deployments → Edit → **New version** → Deploy
6. URL stays the same — no change needed in `index.html`

> ⚠️ **Must redeploy after the 2026-06-01 update** — a new API action (`getDailyChecks`) was added to `code.gs`. The existing deployment will not serve it until a new version is deployed.

---

## 14. Known Issues / Small Bugs

| Issue | Location | Notes |
|---|---|---|
| `toast('Viewing dashboard as Guest', 'info')` | `index.html` | `'info'` toast type has no CSS class — shows default dark. Harmless. |
| `let scheduled = []` | `index.html` state vars | Unused legacy variable, can be removed |
| Write buttons visible to Guest users | `index.html` | Guests can see all action buttons; clicks fail silently with Unauthorized toast. Not yet hidden. |

---

## 15. Planned / Future Work

| Feature | Notes |
|---|---|
| Hide write buttons for Guest users | Guests can currently see all action buttons; clicks fail with Unauthorized toast |
| `feature/downtime-tracker` | Dedicated tab for DOWN vehicles with entry/exit dates and downtime duration |
| `feature/daily-checks-scan-graph` | Wire scan graph to Daily Checks sheet (partially addressed by App Usage section) |
| `feature/email-whatsapp-alerts` | Apps Script time trigger for overdue vehicles |
| `feature/zone-export` | Per-zone CSV/PDF export |
| `feature/last-check-in-fleet-table` | Show last daily check date in Fleet table |
| `feature/conflict-detection` | Warn when two users edit same vehicle simultaneously |
| Daily check mileage (col D) | Deferred — could be used later to cross-check vehicle mileage drift |

---

## 16. How to Run Locally

1. Download `index.html`
2. Open in any browser
3. Enter Admin password (or continue as Guest)
4. Enter your name → dashboard loads from Google Sheet automatically
