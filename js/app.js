// ================================================================
// D&A DRIVE — Complete System Engine Framework
// ================================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwf56LwScE6MpM6R791gJ9DTPwveaQUOhqdUkRAg7VqajOlOcJLgiPZmNY0ctHgAhlHRQ/exec';
const OIL_INTERVAL = 15000;
const TODAY = new Date();

let vehicles = [];
let logs = [];
let donutChart = null;
let scanPerformanceChart = null;
let syncInterval = null;
let activeCompleteTaskItem = null;

// ---- AUTHENTICATION AND SECURITY CONFIGURATIONS ----
function getUser() { return localStorage.getItem('dna_user') || ''; }
function getPassword() { return localStorage.getItem('dna_pass') || ''; }

function saveUserSessionCredentials() {
  const name = document.getElementById('user-name-input').value.trim();
  const pass = document.getElementById('user-pass-input').value.trim();
  if(!name || !pass) { alert('All operational identity metrics required.'); return; }
  
  localStorage.setItem('dna_user', name);
  localStorage.setItem('dna_pass', pass);
  document.getElementById('userName').textContent = name;
  closeModal('userOverlay');
  toast('Identity cleared. System ready.', 'ok');
  fetchData(false);
}

function promptUser() {
  document.getElementById('user-name-input').value = getUser();
  document.getElementById('user-pass-input').value = getPassword();
  openModal('userOverlay');
}

function initUserSession() {
  const u = getUser();
  const p = getPassword();
  if(!u || !p) { openModal('userOverlay'); } 
  else { document.getElementById('userName').textContent = u; }
}

// ---- SYSTEM REALTIME ENGINE CLOCK ----
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent =
    n.toLocaleDateString('fr-MA',{weekday:'short',day:'2-digit',month:'short'}) + ' · ' +
    n.toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateClock, 1000); updateClock();

// ---- SYNCHRONIZATION READ LOGIC ----
function setSyncState(state, msg) {
  const dot = document.getElementById('syncDot');
  const lbl = document.getElementById('syncLbl');
  dot.className = 'sync-dot' + (state === 'ok' ? '' : state === 'stale' ? ' stale' : ' err');
  lbl.textContent = msg;
}

async function fetchData(manual) {
  if (manual) setSyncState('stale', 'Refreshing master matrix…');
  try {
    const [vRes, lRes] = await Promise.all([
      fetch(`${API_URL}?action=getVehicles&t=${Date.now()}`, { redirect: 'follow', mode: 'cors' }),
      fetch(`${API_URL}?action=getLogs&t=${Date.now()}`, { redirect: 'follow', mode: 'cors' })
    ]);
    const vData = await vRes.json();
    const lData = await lRes.json();
    
    if(vData.ok) vehicles = vData.data.map(mapVehicleRecord);
    if(lData.ok) logs = lData.data;
    
    document.getElementById('loadingOverlay').style.display = 'none';
    setSyncState('ok', 'Synced ' + new Date().toLocaleTimeString('fr-MA',{hour:'2-digit',minute:'2-digit'}));
    
    rebuildCoreDashboardViews();
    if(manual) toast('Live architecture refresh completed.', 'ok');
  } catch(e) {
    setSyncState('err','Sync link detached');
    document.getElementById('loadingOverlay').style.display = 'none';
    console.error(e);
  }
}

function mapVehicleRecord(r) {
  return {
    id:          String(r['Vehicle ID'] || ''),
    originId:    String(r['Origin ID'] || ''),
    model:       String(r['Model'] || ''),
    fn:          String(r['Function'] || ''),
    chassis:     String(r['Chassis'] || ''),
    owner:       String(r['Owner'] || ''),
    currentKm:   r['Mileage'] !== '' ? Number(r['Mileage']) : null,
    lastCheck:   String(r['Last Check'] || ''),
    rentMile:    r['Rent Mileage'] !== '' ? Number(r['Rent Mileage']) : null,
    lastOilKm:   r['Last Oil Change'] !== '' ? Number(r['Last Oil Change']) : null,
    nextOilKm:   r['Next Oil Change'] !== '' ? Number(r['Next Oil Change']) : null,
    diagExpiry:  String(r['Annual Diagnostic'] || ''),
    tyreRef:     String(r['Tyres Reference'] || ''),
    tyreBrand:   String(r['Tyres Brand'] || ''),
    fuelCard:    String(r['Fuel Card'] || ''),
    pin:         String(r['PIN'] || ''),
    jawaz:       String(r['Jawaz'] || ''),
    regExpiry:   String(r['Regist Exp'] || ''),
  };
}

// ---- SECURE MUTATION METHOD (POST ROUTING) ----
async function executeSecurePostAction(actionName) {
  const user = getUser();
  const password = getPassword();
  let payload = { action: actionName, user: user, password: password };

  if (actionName === 'updateVehicle') {
    const id = document.getElementById('ef-id').value;
    payload.vehicleId = id;
    payload.note = document.getElementById('ef-notes').value;
    payload.fields = {
      'Origin ID': document.getElementById('ef-originid').value,
      'Model':     document.getElementById('ef-model').value,
      'Function':  document.getElementById('ef-fn').value,
      'Chassis':   document.getElementById('ef-chassis').value,
      'Owner':     document.getElementById('ef-owner').value,
      'Mileage':   document.getElementById('ef-km').value,
      'Last Oil Change': document.getElementById('ef-lastoil').value,
      'Annual Diagnostic': convertHtmlDateToSheet(document.getElementById('ef-diag').value),
      'Regist Exp': convertHtmlDateToSheet(document.getElementById('ef-regexp').value),
      'Fuel Card': document.getElementById('ef-fuelcard').value,
      'PIN':       document.getElementById('ef-pin').value,
      'Jawaz':     document.getElementById('ef-jawaz').value,
      'Tyres Reference': document.getElementById('ef-tyreref').value,
      'Tyres Brand': document.getElementById('ef-tyrebrand').value,
      'Rent Mileage':document.getElementById('ef-rentmile').value,
    };
    closeModal('editOverlay');
  } 
  else if (actionName === 'addVehicle') {
    const id = document.getElementById('af-id').value.trim();
    if(!id) { toast('Error: ID tracking property is required.', 'err'); return; }
    payload.fields = {
      'Vehicle ID': id,
      'Origin ID':  document.getElementById('af-originid').value,
      'Model':      document.getElementById('af-model').value,
      'Function':   document.getElementById('af-fn').value,
      'Chassis':    document.getElementById('af-chassis').value,
      'Owner':      document.getElementById('af-owner').value,
      'Mileage':    document.getElementById('af-km').value,
      'Last Oil Change': document.getElementById('af-lastoil').value,
      'Annual Diagnostic': convertHtmlDateToSheet(document.getElementById('af-diag').value),
      'Regist Exp':  convertHtmlDateToSheet(document.getElementById('af-regexp').value),
      'Fuel Card':   document.getElementById('af-fuelcard').value,
      'PIN':        document.getElementById('af-pin').value,
      'Jawaz':       document.getElementById('af-jawaz').value,
      'Tyres Reference': document.getElementById('af-tyreref').value,
      'Tyres Brand':  document.getElementById('af-tyrebrand').value,
      'Rent Mileage': document.getElementById('af-rentmile').value,
    };
    closeModal('addVehicleOverlay');
  }
  else if (actionName === 'logOilChange') {
    payload.vehicleId = activeVehicleId;
    payload.currentKm = document.getElementById('oil-km').value;
    payload.note = document.getElementById('oil-note').value;
    closeModal('oilOverlay');
  }
  else if (actionName === 'logDiagnostic') {
    payload.vehicleId = activeVehicleId;
    payload.newExpiryDate = convertHtmlDateToSheet(document.getElementById('diag-date').value);
    payload.note = document.getElementById('diag-note').value;
    closeModal('diagOverlay');
  }
  else if (actionName === 'logMaintenance') {
    const rawDate = document.getElementById('sc-date').value;
    payload.vehicleId = document.getElementById('sc-id').value.trim();
    payload.type = document.getElementById('sc-type').value;
    payload.scheduledDate = rawDate ? rawDate.split('-').reverse().join('/') : '';
    payload.mechanic = document.getElementById('sc-mech').value;
    payload.note = document.getElementById('sc-note').value;
    closeModal('schedOverlay');
  }

  document.getElementById('loadingOverlay').style.display = 'flex';
  
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.ok) {
      toast('Security write rejected: ' + result.error, 'err');
      document.getElementById('loadingOverlay').style.display = 'none';
      return;
    }
    
    toast('Security write synchronized. Reloading in 2s...', 'ok');
    setTimeout(() => { fetchData(false); }, 2000);
  } catch(e) {
    toast('Network connection write fault.', 'err');
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

// ---- MATHEMATICAL DATETIME & RUNTIME PARSERS ----
function parseSheetDate(str) {
  if(!str) return null;
  const p = str.split('/');
  if(p.length === 3) return new Date(+p[2], +p[1]-1, +p[0]);
  return null;
}
function convertSheetDateToHtml(str) {
  if(!str) return '';
  const p = str.split('/');
  if(p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  return '';
}
function convertHtmlDateToSheet(str) {
  if(!str) return '';
  const p = str.split('-');
  if(p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return '';
}
function daysUntilExpiry(str) {
  const d = parseSheetDate(str); if(!d) return null;
  return Math.round((d - TODAY)/(1000*60*60*24));
}
function oilRemainingDistance(v) {
  if(v.currentKm === null || v.lastOilKm === null) return null;
  return (v.lastOilKm + OIL_INTERVAL) - v.currentKm;
}
function checkHasPendingSchedule(vehId) {
  return logs.some(l => String(l['Vehicle ID']) === String(vehId) && String(l['Notes']).indexOf('STATUS: PENDING') !== -1);
}

// ---- STATUS EVALUATION CLASSIFICATION ENGINES ----
function getOilStatus(v) {
  if (v.fn && v.fn.toUpperCase().includes('DOWN')) return { label: 'DOWN', cls: 'b-down', order: 0 };
  const r = oilRemainingDistance(v);
  if(r === null) return { label: 'No Data', cls: 'b-gray', order: 5 };
  if(r <= 0)    return { label: 'OVERDUE', cls: 'b-danger', order: 1 };
  if(r <= 2000) return { label: 'CRITICAL', cls: 'b-danger', order: 2 };
  if(r <= 5000) return { label: 'DUE SOON', cls: 'b-warn', order: 3 };
  return { label: 'OK', cls: 'b-ok', order: 4 };
}

function getDiagStatus(v) {
  if (v.fn && v.fn.toUpperCase().includes('DOWN')) return { label: 'DOWN', cls: 'b-down', order: 0 };
  const d = daysUntilExpiry(v.diagExpiry);
  if(d === null) return { label: 'No Data', cls: 'b-gray', order: 5 };
  if(d < 0)   return { label: 'OVERDUE', cls: 'b-danger', order: 1 };
  if(d <= 30) return { label: d + 'd Urgent', cls: 'b-danger', order: 2 };
  if(d <= 90) return { label: d + 'd Warning', cls: 'b-warn', order: 3 };
  return { label: d + 'd Clean', cls: 'b-ok', order: 4 };
}

// ---- INTERFACE CORE RENDER SYSTEM ----
function rebuildCoreDashboardViews() {
  buildKpiStrip();
  buildDonutMixChart();
  buildZoneDistributionBars();
  initDailyScanGraphEngine();
  buildUrgentOilList();
  renderOil();
  renderFleet();
  renderDiag();
  renderSchedule();
  renderLog();
}

function buildKpiStrip() {
  let overdue=0, critical=0, soon=0, clean=0, diagUrgent=0, downCount=0, total=vehicles.length;
  vehicles.forEach(v => {
    if (v.fn && v.fn.toUpperCase().includes('DOWN')) { downCount++; return; }
    const oLabel = getOilStatus(v).label;
    if (oLabel === 'OVERDUE') overdue++;
    else if (oLabel === 'CRITICAL') critical++;
    else if (oLabel === 'DUE SOON') soon++;
    else if (oLabel === 'OK') clean++;
    
    const dLabel = getDiagStatus(v).label;
    if (dLabel === 'OVERDUE' || dLabel.includes('Urgent')) diagUrgent++;
  });

  document.getElementById('kpiRow').innerHTML = `
    <div class="kpi"><div class="kpi-label">Active Roster</div><div class="kpi-val">${total}</div><div class="kpi-sub">Total fleet units</div></div>
    <div class="kpi" style="--accent:var(--danger)"><div class="kpi-label">Oil Overdue</div><div class="kpi-val" style="color:var(--danger)">${overdue}</div><div class="kpi-sub">Service mandatory</div></div>
    <div class="kpi" style="--accent:var(--warn)"><div class="kpi-label">Oil Critical</div><div class="kpi-val" style="color:var(--warn)">${critical}</div><div class="kpi-sub">&lt;2,000 km left</div></div>
    <div class="kpi" style="--accent:#b45309"><div class="kpi-label">Oil Due Soon</div><div class="kpi-val" style="color:#b45309">${soon}</div><div class="kpi-sub">&lt;5,000 km left</div></div>
    <div class="kpi" style="--accent:var(--down)"><div class="kpi-label">Reparation/DOWN</div><div class="kpi-val" style="color:var(--down)">${downCount}</div><div class="kpi-sub">Units out of order</div></div>
    <div class="kpi" style="--accent:var(--danger)"><div class="kpi-label">Diagnostic Alert</div><div class="kpi-val" style="color:var(--danger)">${diagUrgent}</div><div class="kpi-sub">Overdue or &lt;30d</div></div>`;

  // Dynamic system alerts, perfectly ordered by priority (Urgent -> Less Urgent)
  let html = '';
  const urgentOilUnits = vehicles
    .filter(v => ['OVERDUE', 'CRITICAL', 'DUE SOON'].includes(getOilStatus(v).label))
    .sort((a,b) => getOilStatus(a).order - getOilStatus(b).order);
    
  const urgentDiagUnits = vehicles
    .filter(v => ['OVERDUE'].includes(getDiagStatus(v).label) || getDiagStatus(v).label.includes('Urgent'))
    .sort((a,b) => getDiagStatus(a).order - getDiagStatus(b).order);

  if(urgentOilUnits.length) {
    html += `<div class="alert alert-danger">⚠️ <div><b>Prioritized Vehicle Oil Actions Required:</b> ${urgentOilUnits.map(v=> `${v.id} (${getOilStatus(v).label})`).join(', ')}</div></div>`;
  }
  if(urgentDiagUnits.length) {
    html += `<div class="alert alert-warn">📅 <div><b>Prioritized Diagnostic Inspection Certificates Required:</b> ${urgentDiagUnits.map(v=> `${v.id} (${getDiagStatus(v).label})`).join(', ')}</div></div>`;
  }
  document.getElementById('alertBanner').innerHTML = html;
}

function buildDonutMixChart() {
  const counts = {};
  vehicles.forEach(v => { const k = v.model || 'Unassigned Profile'; counts[k] = (counts[k]||0) + 1; });
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  const colors = ['#0047AB','#FFD600','#15803D','#B45309','#6D28D9','#475569','#0891B2','#65A30D'];
  
  if(donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('typeChart'), {
    type: 'doughnut',
    data: { labels: sorted.map(e=>e[0]), datasets: [{ data: sorted.map(e=>e[1]), backgroundColor: colors, borderWidth: 1.5, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '65%' }
  });
  document.getElementById('typeLegend').innerHTML = sorted.map((e,i) =>
    `<div class="leg-row"><div class="leg-sq" style="background:${colors[i]||'#aaa'}"></div>${e[0]} <b>(${e[1]})</b></div>`
  ).join('');
}

function buildZoneDistributionBars() {
  const counts = {};
  vehicles.forEach(v => { const z = (v.fn || 'UNKNOWN').split(' ')[0]; counts[z] = (counts[z]||0) + 1; });
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] || 1;
  document.getElementById('zoneBars').innerHTML = sorted.map(([z,n]) => `
    <div class="bar-row">
      <div class="bar-label">${z}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/max*100)}%"></div></div>
      <div class="bar-val">${n}</div>
    </div>`).join('');
}

function initDailyScanGraphEngine() {
  const dateInput = document.getElementById('scanGraphDate');
  if(!dateInput.value) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
  }
  loadScanGraphAnalytics();
}

async function loadScanGraphAnalytics() {
  const dateStr = document.getElementById('scanGraphDate').value;
  try {
    const res = await fetch(`${API_URL}?action=getDailyScanStatus&date=${dateStr}`);
    const json = await res.json();
    if(json.ok) {
      if(scanPerformanceChart) scanPerformanceChart.destroy();
      scanPerformanceChart = new Chart(document.getElementById('scanPerformanceChart'), {
        type: 'bar',
        data: {
          labels: ['Scanned Operations', 'Missing Checks'],
          datasets: [{ data: [json.scanned, json.unscanned], backgroundColor: ['#15803D', '#C0392B'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
      
      let rosterHtml = '';
      Object.keys(json.breakdown).forEach(id => {
        if(!json.breakdown[id]) rosterHtml += `<span class="unscanned-badge-item">${id}</span>`;
      });
      document.getElementById('scanUnscannedList').innerHTML = rosterHtml || '<div style="color:var(--ok)">Complete submission coverage mapped.</div>';
    }
  } catch(e) { console.error('Reporting analytical load fault.', e); }
}

function buildUrgentOilList() {
  const sorted = [...vehicles]
    .filter(v => v.currentKm !== null)
    .map(v => ({...v, rem: oilRemainingDistance(v)}))
    .sort((a,b) => a.rem - b.rem)
    .slice(0, 5);
    
  document.getElementById('oilUrgent').innerHTML = sorted.map(v => {
    const s = getOilStatus(v);
    const isDown = v.fn && v.fn.toUpperCase().includes('DOWN');
    return `<div class="m-item ${isDown?'item-down':''}" onclick="openOilModal('${v.id}')">
      <span class="badge ${s.cls}">${s.label}</span>
      <div class="m-info">
        <div class="m-veh">${v.id} — ${v.model}</div>
        <div class="m-meta"><span class="pill ${isDown?'pill-down':''}">${v.fn}</span> · Target: ${(v.lastOilKm+OIL_INTERVAL).toLocaleString()} km</div>
      </div>
      <div class="m-right">
        <div class="m-km" style="color:${v.rem<=0?'var(--danger)':v.rem<=2000?'var(--warn)':'var(--t1)'}">${v.rem<=0? '+' + Math.abs(v.rem).toLocaleString() + ' km over' : v.rem.toLocaleString() + ' km left'}</div>
        <div class="m-sub">Current: ${v.currentKm.toLocaleString()} km</div>
      </div>
    </div>`;
  }).join('');
}

// ---- ISOLATED PARAMETER SEARCH FILTERS ----
function renderFleet() {
  const fId = document.getElementById('fleetFilterId').value.trim().toLowerCase();
  const fZone = document.getElementById('fleetFilterZone').value.trim().toLowerCase();
  
  const rows = vehicles.filter(v => {
    if(fId && !v.id.toLowerCase().includes(fId)) return false;
    if(fZone && !v.fn.toLowerCase().includes(fZone)) return false;
    return true;
  });
  
  document.getElementById('fleetCount').textContent = rows.length + ' Asset Records';
  document.getElementById('fleetTbody').innerHTML = rows.map(v => {
    const isDown = v.fn && v.fn.toUpperCase().includes('DOWN');
    const hasSched = checkHasPendingSchedule(v.id);
    return `<tr class="clickable ${isDown?'row-down':''}" onclick="openEditModal('${v.id}')">
      <td><strong>${v.id}</strong> ${hasSched?'📅':''}</td>
      <td>${v.originId || '—'}</td>
      <td>${v.model}</td>
      <td><span class="pill ${isDown?'pill-down':''}">${v.fn}</span></td>
      <td class="mono">${v.chassis}</td>
      <td class="mono">${v.currentKm ? v.currentKm.toLocaleString() : '—'}</td>
      <td>${v.lastCheck || '—'}</td>
      <td class="mono">${v.fuelCard || '—'}</td>
      <td class="mono">${v.pin || '—'}</td>
      <td class="mono">${v.jawaz || '—'}</td>
      <td>${v.tyreRef} <span style="color:var(--t3)">${v.tyreBrand}</span></td>
      <td><span class="badge ${getOilStatus(v).cls}">${getOilStatus(v).label}</span></td>
      <td><span class="badge ${getDiagStatus(v).cls}">${v.diagExpiry || '—'}</span></td>
      <td onclick="event.stopPropagation()">
        <button class="act-btn" onclick="openOilModal('${v.id}')">Oil</button>
        <button class="act-btn" onclick="openDiagModal('${v.id}')">Diag</button>
      </td>
    </tr>`;
  }).join('');
}

function renderSchedule() {
  const fId = document.getElementById('schedFilterId').value.trim().toLowerCase();
  const fZone = document.getElementById('schedFilterZone').value.trim().toLowerCase();
  
  const items = logs.filter(l => {
    if(!l['Scheduled date']) return false;
    if(String(l['Notes']).indexOf('STATUS: PENDING') === -1) return false;
    
    const vId = String(l['Vehicle ID']).toLowerCase();
    const vehObj = vehicles.find(v => v.id.toLowerCase() === vId);
    const vZone = vehObj ? vehObj.fn.toLowerCase() : '';
    
    if(fId && !vId.includes(fId)) return false;
    if(fZone && !vZone.includes(fZone)) return false;
    return true;
  }).sort((a,b) => a['Scheduled date'].localeCompare(b['Scheduled date']));

  document.getElementById('schedCount').textContent = items.length + ' Maintenance Events Open';
  if(!items.length) {
    document.getElementById('schedList').innerHTML = '<div style="color:var(--t3);padding:12px">No matching pending actions mapped.</div>'; return;
  }
  
  document.getElementById('schedList').innerHTML = items.map(l => {
    const type = l['Type'] || 'Maintenance';
    const notesClean = String(l['Notes']).replace('STATUS: PENDING | ', '');
    return `<div class="sched-card">
      <div class="sched-card-left">
        <div class="sched-dot" style="background:var(--blue)"></div>
        <div>
          <div style="font-size:12px;font-weight:600">${l['Vehicle ID']} — ${type}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">Target execution date: <b>${l['Scheduled date']}</b> · ${l['Mechanic'] || 'No Assigned Garage'}</div>
          ${notesClean?`<div style="font-size:11px;color:var(--t3);margin-top:2px">${notesClean}</div>`:''}
        </div>
      </div>
      <div class="sched-card-actions">
        <button class="btn btn-ok" onclick="openCompleteTaskModal('${l['Vehicle ID']}', '${type}')">Mark As Done</button>
      </div>
    </div>`;
  }).join('');
}

function renderOil() {
  const fId = document.getElementById('oilFilterId').value.trim().toLowerCase();
  const fZone = document.getElementById('oilFilterZone').value.trim().toLowerCase();
  
  const rows = vehicles.filter(v => {
    if(fId && !v.id.toLowerCase().includes(fId)) return false;
    if(fZone && !v.fn.toLowerCase().includes(fZone)) return false;
    return true;
  }).sort((a,b) => (oilRemainingDistance(a)??9e9) - (oilRemainingDistance(b)??9e9));

  document.getElementById('oilCount').textContent = rows.length + ' Tracked Lifespans';
  document.getElementById('oilTbody').innerHTML = rows.map(v => {
    const s = getOilStatus(v); const rem = oilRemainingDistance(v);
    return `<tr>
      <td><strong>${v.id}</strong></td>
      <td>${v.model}</td>
      <td><span class="pill">${v.fn}</span></td>
      <td class="mono">${v.currentKm ? v.currentKm.toLocaleString() + ' km' : '—'}</td>
      <td class="mono">${v.lastOilKm ? v.lastOilKm.toLocaleString() + ' km' : '—'}</td>
      <td class="mono">${v.lastOilKm ? (v.lastOilKm + OIL_INTERVAL).toLocaleString() + ' km' : '—'}</td>
      <td class="mono" style="font-weight:600">${rem !== null ? (rem <= 0 ? '⚠ +' + Math.abs(rem).toLocaleString() : rem.toLocaleString() + ' km') : '—'}</td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td><button class="act-btn" onclick="openOilModal('${v.id}')">Log Oil Service</button></td>
    </tr>`;
  }).join('');
}

function renderDiag() {
  const fId = document.getElementById('diagFilterId').value.trim().toLowerCase();
  const fZone = document.getElementById('diagFilterZone').value.trim().toLowerCase();
  
  const rows = vehicles.filter(v => {
    if(fId && !v.id.toLowerCase().includes(fId)) return false;
    if(fZone && !v.fn.toLowerCase().includes(fZone)) return false;
    return true;
  }).sort((a,b) => (daysUntilExpiry(a.diagExpiry)??9999) - (daysUntilExpiry(b.diagExpiry)??9999));

  document.getElementById('diagCount').textContent = rows.length + ' Validation Metrics';
  document.getElementById('diagTbody').innerHTML = rows.map(v => {
    const s = getDiagStatus(v); const d = daysUntilExpiry(v.diagExpiry);
    return `<tr>
      <td><strong>${v.id}</strong></td>
      <td>${v.model}</td>
      <td><span class="pill">${v.fn}</span></td>
      <td style="font-weight:500">${v.diagExpiry || '—'}</td>
      <td style="font-weight:600">${d !== null ? (d < 0 ? '⚠ ' + Math.abs(d) + 'd Overdue' : d + 'd') : '—'}</td>
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td><button class="act-btn" onclick="openDiagModal('${v.id}')">Renew Certificate</button></td>
    </tr>`;
  }).join('');
}

function renderLog() {
  const q = (document.getElementById('logSearch').value || '').toLowerCase();
  const rows = [...logs].reverse().filter(l => {
    if(!q) return true;
    return JSON.stringify(l).toLowerCase().includes(q);
  });
  document.getElementById('logCount').textContent = rows.length + ' History Rows Mapped';
  document.getElementById('logTbody').innerHTML = rows.map(l => `<tr>
    <td style="white-space:nowrap" class="mono">${l['Timestamp'] || ''}</td>
    <td><strong>${l['Vehicle ID'] || ''}</strong></td>
    <td>${l['Type'] || ''}</td>
    <td class="mono">${l['KM at service'] || ''}</td>
    <td class="mono">${l['Scheduled date'] || ''}</td>
    <td>${l['Mechanic'] || ''}</td>
    <td><span class="badge b-info">${l['User'] || 'Unknown'}</span></td>
    <td style="color:var(--t2)">${l['Notes'] || ''}</td>
  </tr>`).join('');
}

// ---- COMPLETE ACTION AND TASK COMPLETION RESOLUTIONS ----
function openCompleteTaskModal(vehId, type) {
  activeCompleteTaskItem = { vehicleId: vehId, type: type };
  document.getElementById('completeTaskModalSub').textContent = `${vehId} — ${type}`;
  
  let fieldsHtml = '';
  if (type === 'Oil Change') {
    fieldsHtml = `
      <div class="form-field">
        <label class="form-label">Current Odometer Odometer (KM)</label>
        <input class="form-input" type="number" id="ct-km" placeholder="Odometer value at service...">
      </div>`;
  } else if (type === 'Annual Diagnostic') {
    fieldsHtml = `
      <div class="form-field">
        <label class="form-label">New Diagnostic Expiration Date</label>
        <input class="form-input" type="date" id="ct-date">
      </div>`;
  }
  fieldsHtml += `
    <div class="form-field">
      <label class="form-label">Resolution Summary Remarks</label>
      <input class="form-input" id="ct-note" placeholder="Append execution parameters...">
    </div>`;
    
  document.getElementById('completeTaskDynamicFields').innerHTML = fieldsHtml;
  openModal('completeTaskOverlay');
}

async function submitTaskResolutionCompletion() {
  const user = getUser();
  const password = getPassword();
  let payload = {
    action: 'completeSchedule',
    vehicleId: activeCompleteTaskItem.vehicleId,
    type: activeCompleteTaskItem.type,
    user: user,
    password: password,
    note: document.getElementById('ct-note').value
  };

  if (activeCompleteTaskItem.type === 'Oil Change') {
    payload.km = document.getElementById('ct-km').value;
    if(!payload.km) { toast('Error: Mileage metric required.', 'err'); return; }
  } else if (activeCompleteTaskItem.type === 'Annual Diagnostic') {
    payload.date = convertHtmlDateToSheet(document.getElementById('ct-date').value);
    if(!payload.date) { toast('Error: Expiration date parameter required.', 'err'); return; }
  }

  closeModal('completeTaskOverlay');
  document.getElementById('loadingOverlay').style.display = 'flex';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if(!result.ok) {
      toast('Security resolution write failed: ' + result.error, 'err');
      document.getElementById('loadingOverlay').style.display = 'none'; return;
    }
    toast('Task updated successfully. Synchronizing system arrays...', 'ok');
    setTimeout(() => { fetchData(false); }, 2000);
  } catch(e) {
    toast('Network synchronization connection breakdown.', 'err');
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

// ---- INTERFACE ACTIONS WRAPPERS ----
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function openAddVehicleModal() {
  const formIds = ['af-id','af-originid','af-model','af-fn','af-chassis','af-owner','af-km','af-lastoil','af-diag','af-regexp','af-fuelcard','af-pin','af-jawaz','af-tyreref','af-tyrebrand','af-rentmile'];
  formIds.forEach(id => { const el = document.getElementById(id); if(el) el.value = el.type==='number'?'0':''; });
  openModal('addVehicleOverlay');
}

function openEditModal(id) {
  const v = vehicles.find(item => item.id === id); if(!v) return;
  activeVehicleId = id;
  document.getElementById('editModalTitle').textContent = `Modify ${v.id} properties`;
  document.getElementById('editModalSub').textContent = v.fn;
  document.getElementById('ef-id').value = v.id;
  document.getElementById('ef-originid').value = v.originId;
  document.getElementById('ef-model').value = v.model;
  document.getElementById('ef-fn').value = v.fn;
  document.getElementById('ef-chassis').value = v.chassis;
  document.getElementById('ef-owner').value = v.owner;
  document.getElementById('ef-km').value = v.currentKm || '';
  document.getElementById('ef-lastoil').value = v.lastOilKm || '';
  document.getElementById('ef-diag').value = convertSheetDateToHtml(v.diagExpiry);
  document.getElementById('ef-regexp').value = convertSheetDateToHtml(v.regExpiry);
  document.getElementById('ef-fuelcard').value = v.fuelCard || '';
  document.getElementById('ef-pin').value = v.pin || '';
  document.getElementById('ef-jawaz').value = v.jawaz || '';
  document.getElementById('ef-tyreref').value = v.tyreRef || '';
  document.getElementById('ef-tyrebrand').value = v.tyreBrand || '';
  document.getElementById('ef-rentmile').value = v.rentMile || '';
  document.getElementById('ef-notes').value = '';
  openModal('editOverlay');
}

function openOilModal(id) {
  const v = vehicles.find(item => item.id === id); if(!v) return;
  activeVehicleId = id;
  document.getElementById('oilModalSub').textContent = `${v.id} — ${v.model} · ${v.fn}`;
  document.getElementById('oil-km').value = v.currentKm || '';
  document.getElementById('oil-hint').textContent = v.lastOilKm ? `Last execution logged at ${v.lastOilKm.toLocaleString()} km. Target runtime value: ${(v.lastOilKm+OIL_INTERVAL).toLocaleString()} km.` : 'No previous run records mapped.';
  document.getElementById('oil-note').value = '';
  openModal('oilOverlay');
}

function openDiagModal(id) {
  const v = vehicles.find(item => item.id === id); if(!v) return;
  activeVehicleId = id;
  document.getElementById('diagModalSub').textContent = `${v.id} — ${v.model} · ${v.fn}`;
  document.getElementById('diag-date').value = convertSheetDateToHtml(v.diagExpiry);
  document.getElementById('diag-note').value = '';
  openModal('diagOverlay');
}

function openScheduleModal() { openModal('schedOverlay'); }

// ---- MESSAGING COMPONENT ----
function toast(msg, type='') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toastWrap').appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3000);
}

// ---- GLOBAL NAVIGATION CONTROL ROUTER ----
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  el.classList.add('active');
}

// ---- EXECUTIVE REPORT EXPORTER (PDF FORMAT) ----
function exportExecutivePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFont("Helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(0, 71, 171);
  doc.text("D&A DRIVE — EXECUTIVE FLEET PERFORMANCE REPORT", 14, 20);
  
  doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString('fr-MA')} | System Operator: ${getUser()}`, 14, 26);
  doc.line(14, 28, 196, 28);
  
  doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(17, 17, 17);
  doc.text("Prioritized High Risk Maintenance Targets", 14, 38);
  
  let y = 46;
  doc.setFontSize(10);
  vehicles.filter(v => ['OVERDUE', 'CRITICAL'].includes(getOilStatus(v).label)).forEach(v => {
    doc.setFont("Helvetica", "bold"); doc.text(`Vehicle ID: ${v.id}`, 16, y);
    doc.setFont("Helvetica", "normal"); doc.text(`Model: ${v.model} | Zone: ${v.fn} | Remaining distance: ${oilRemainingDistance(v)} KM`, 55, y);
    y += 8;
  });
  
  y += 6;
  doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.text("Prioritized High Risk Diagnostic Actions", 14, y);
  y += 8;
  
  vehicles.filter(v => ['OVERDUE'].includes(getDiagStatus(v).label) || getDiagStatus(v).label.includes('Urgent')).forEach(v => {
    doc.setFont("Helvetica", "bold"); doc.text(`Vehicle ID: ${v.id}`, 16, y);
    doc.setFont("Helvetica", "normal"); doc.text(`Model: ${v.model} | Zone: ${v.fn} | Certificate Expiration: ${v.diagExpiry}`, 55, y);
    y += 8;
  });
  
  doc.save(`DNA_Drive_Executive_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  toast('Executive report extracted.', 'ok');
}

// ---- SYSTEM INITIALIZATION RUNTIME SEQUENCE ----
initUserSession();
fetchData(false);
syncInterval = setInterval(() => fetchData(false), 60000);
