// ================================================================
// D&A DRIVE — Complete code.gs
// ================================================================
// ---- Sheet names ----
var SHEET_VEHICLES    = 'Vehicles';
var SHEET_DAILY       = 'Daily Checks';
var SHEET_MAINTENANCE = 'Maintenance';
var SHEET_LOG = 'DashboardLog';

// ---- Trips & Config spreadsheet (separate document) ----
var TRIPS_SS_ID  = '1nixoCLzylc5a5vLSNFoaf3xEbUojjBkY8TIQUyjgRX8';
var SHEET_USERS  = 'Users';
var SHEET_SETUP  = 'Setup';
var SHEET_TRIPS  = 'Trips';
var SHEET_TRIP_NIGHTS = 'TripAccommodations';
var SHEET_TRIP_LOG    = 'DashboardLog'; // separate tab, inside TRIPS_SS_ID

// ================================================================
// GET — serves driver forms + dashboard API
// ================================================================
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;

  // 0. Login itself — this call IS the credential check, so it runs before the gate below
  if (action === 'authenticate') {
    return authenticateUser_(e.parameter.username, e.parameter.password);
  }

  // 1. Every dashboard action (read or write) now requires a valid Users-sheet account
  var dashboardActions = [
    'getVehicles', 'getAll', 'getLogs', 'getMaintenanceLog', 'getDailyChecks',
    'updateVehicle', 'logOilChange', 'logDiagnostic', 'logMaintenance', 'addVehicle',
    'markMaintenanceDone', 'deleteMaintenanceRow', 'updateMaintenanceCell', 'updateMaintenanceRow',
    'addUser'
  ];

  if (dashboardActions.indexOf(action) !== -1) {
    try {
      // Write actions carry a JSON payload (which includes credentials);
      // read actions pass username/password as plain query params
      var username, password, payload;
      if (e.parameter.payload) {
        payload  = JSON.parse(e.parameter.payload);
        username = payload.username;
        password = payload.password;
      } else {
        username = e.parameter.username;
        password = e.parameter.password;
      }

      var user = verifyCredentials_(username, password);
      if (!user) {
        return cors_(ContentService.createTextOutput(JSON.stringify({
          ok: false,
          error: 'Unauthorized: Invalid or missing credentials.'
        })));
      }

      // Reads — any logged-in user, Admin or User
      if (action === 'getVehicles')       return getVehicles_();
      if (action === 'getAll')            return getAll_();
      if (action === 'getLogs')           return getLogs_();
      if (action === 'getMaintenanceLog') return getMaintenanceLog_();
      if (action === 'getDailyChecks')    return getDailyChecks_();

      // Everything past this point writes Fleet data — Admin role required
      if (user.role !== 'Admin') {
        return cors_(ContentService.createTextOutput(JSON.stringify({
          ok: false,
          error: 'Unauthorized: Admin role required.'
        })));
      }
      if (action === 'addUser')              return addUser_(payload);
      if (action === 'updateVehicle')        return updateVehicle_(payload);
      if (action === 'logOilChange')         return logOilChange_(payload);
      if (action === 'logDiagnostic')        return logDiagnostic_(payload);
      if (action === 'logMaintenance')       return logMaintenance_(payload);
      if (action === 'addVehicle')           return addVehicle_(payload);
      if (action === 'markMaintenanceDone')  return markMaintenanceDone_(payload);
      if (action === 'deleteMaintenanceRow') return deleteMaintenanceRow_(payload);
      if (action === 'updateMaintenanceCell')return updateMaintenanceCell_(payload);
      if (action === 'updateMaintenanceRow') return updateMaintenanceRow_(payload);

    } catch(err) { 
      return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))); 
    }
  }

  // --- Driver HTML forms (untouched — separate flow, no dashboard login involved) ---
  try {
    var page = e.parameter.page;
    if (page === 'incidents') {
      return HtmlService.createHtmlOutputFromFile('Incidents').setTitle('IKEA Incident Report').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    return HtmlService.createHtmlOutputFromFile('checkForm').setTitle('IKEA Fleet Control').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h2>Error</h2><p>' + err.message + '</p>').setTitle('Error').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// ================================================================
// POST — kept for compatibility but dashboard uses GET
// ================================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    if (action === 'updateVehicle')  return updateVehicle_(payload);
    if (action === 'logMaintenance') return logMaintenance_(payload);
    if (action === 'logOilChange')   return logOilChange_(payload);
    if (action === 'logDiagnostic')  return logDiagnostic_(payload);
    if (action === 'addVehicle')     return addVehicle_(payload);
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action: ' + action })));
  } catch(err) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })));
  }
}

// ================================================================
// DASHBOARD API — read functions
// ================================================================
function getVehicles_() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sh      = ss.getSheetByName(SHEET_VEHICLES);
  var data    = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      obj[h] = v;
    });
    return obj;
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({
    ok: true,
    lastModified: new Date().toISOString(),
    data: rows
  })));
}

function getAll_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Vehicles
  var vSh = ss.getSheetByName(SHEET_VEHICLES);
  var vData = vSh.getDataRange().getValues();
  var vHeaders = vData[0];
  var vehicles = vData.slice(1).map(function(row) {
    var obj = {};
    vHeaders.forEach(function(h, i) {
      var v = row[i];
      if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      obj[h] = v;
    });
    return obj;
  });

  // Maintenance
  var mSh = ss.getSheetByName(SHEET_MAINTENANCE);
  var maintenance = [];
  if (mSh) {
    var mData = mSh.getDataRange().getValues();
    if (mData.length >= 2) {
      var mHeaders = mData[0];
      maintenance = mData.slice(1).map(function(row, i) {
        var obj = { _row: i + 2 };
        mHeaders.forEach(function(h, j) {
          var v = row[j];
          if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
          obj[h] = v;
        });
        return obj;
      });
    }
  }

  // Daily Checks (2026+ only)
  var dSh = ss.getSheetByName(SHEET_DAILY);
  var dailyChecks = [];
  if (dSh) {
    var dData = dSh.getDataRange().getValues();
    if (dData.length >= 2) {
      var cutoff = new Date('2026-01-01T00:00:00');
      dailyChecks = dData.slice(1).filter(function(row) {
        return row[0] instanceof Date && row[0] >= cutoff;
      }).map(function(row) {
        return {
          timestamp: Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
          driverId:  String(row[1] || ''),
          vehicleId: String(row[2] || '')
        };
      }).filter(function(r) { return r.vehicleId !== ''; });
    }
  }

  return cors_(ContentService.createTextOutput(JSON.stringify({
    ok: true,
    lastModified: new Date().toISOString(),
    vehicles:     vehicles,
    maintenance:  maintenance,
    dailyChecks:  dailyChecks
  })));
}
function getLogs_() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = getOrCreateLogSheet_(ss);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] })));
  }
  var headers = data[0];
  var rows = data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var v = row[i];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
      }
      obj[h] = v;
    });
    return obj;
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: rows })));
}

function getMaintenanceLog_() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ss.getSheetByName(SHEET_MAINTENANCE);
  if (!sh) return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] })));
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] })));
  var headers = data[0];
  var rows = data.slice(1).map(function(row, i) {
    var obj = { _row: i + 2 }; // 1-based row index for updates
    headers.forEach(function(h, j) {
      var v = row[j];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
      }
      obj[h] = v;
    });
    return obj;
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: rows })));
}
function getDailyChecks_() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ss.getSheetByName(SHEET_DAILY);
  if (!sh) return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] })));
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: [] })));
  
  // Cutoff set to January 1st, 2026
  var cutoff = new Date('2026-01-01T00:00:00');  
  
  var rows = data.slice(1).filter(function(row) {    
    var ts = row[0];    
    return ts instanceof Date && ts >= cutoff;  
  }).map(function(row) {    
    var ts = Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');    
    return {      
      timestamp: ts,      
      driverId:  String(row[1] || ''),      
      vehicleId: String(row[2] || '')    
    };  
  }).filter(function(r) { return r.vehicleId !== ''; });

  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, data: rows })));
}

// ================================================================
// DASHBOARD API — write functions
// ================================================================
function updateVehicle_(payload) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sh      = ss.getSheetByName(SHEET_VEHICLES);
  var data    = sh.getDataRange().getValues();
  var headers = data[0];
  var rowIdx  = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(payload.vehicleId)) {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Vehicle ID not found: ' + payload.vehicleId })));
  }
  var changed = [];
  Object.keys(payload.fields).forEach(function(fieldName) {
    var colIdx = headers.indexOf(fieldName);
    if (colIdx === -1) return;
    sh.getRange(rowIdx, colIdx + 1).setValue(payload.fields[fieldName]);
    changed.push(fieldName + ' → ' + payload.fields[fieldName]);
  });
  appendLog_(ss, {
    timestamp: new Date(),
    vehicleId: payload.vehicleId,
    action:    'Edit: ' + changed.join(', '),
    user:      payload.user || 'Unknown',
    note:      payload.note || ''
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true, updated: changed })));
}

function logOilChange_(payload) {
  var km        = Number(payload.currentKm);
  var model     = String(payload.model || '').toUpperCase();
  var nextOilKm = km + (model.indexOf('IVECO TRAILER') !== -1 ? 20000 : model.indexOf('MITSUBISHI FUSO') !== -1 ? 10000 : 15000);
  updateVehicle_({
    vehicleId: payload.vehicleId,
    fields: {
      'Last Oil Change': km,
      'Next Oil Change': nextOilKm
    },
    user: payload.user,
    note: 'Oil change logged'
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAINTENANCE);
  if (sh) {
    sh.appendRow([new Date(), payload.vehicleId, 'Oil Change', km, payload.user || 'Unknown', payload.note || '', 'Pending', payload.interventionDate || '']);
  }
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}

function logDiagnostic_(payload) {
  updateVehicle_({
    vehicleId: payload.vehicleId,
    fields: { 'Annual Diagnostic': payload.newExpiryDate },
    user: payload.user,
    note: 'Annual diagnostic renewed'
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_MAINTENANCE);
  if (sh) {
    sh.appendRow([new Date(), payload.vehicleId, 'Annual Diagnostic', '', payload.user || 'Unknown', 'New expiry: ' + payload.newExpiryDate, 'Pending', payload.interventionDate || '']);
  }
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}

function logMaintenance_(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Maintenance sheet — history shown on dashboard
  var msh = ss.getSheetByName(SHEET_MAINTENANCE);
  if (msh) {
    var eventDate = payload.scheduledDate || new Date();
    msh.appendRow([
      eventDate,
      payload.vehicleId        || '',
      payload.type             || 'General',
      payload.km               || '',
      payload.user             || 'Unknown',
      payload.note             || '',
      'Pending',
      payload.interventionDate || ''
    ]);
  }

  // DashboardLog — full audit trail
  appendLog_(ss, {
    timestamp: new Date(),
    vehicleId: payload.vehicleId || '',
    action:    'Scheduled: ' + (payload.type || 'General'),
    user:      payload.user  || 'Unknown',
    note:      'Date: ' + (payload.scheduledDate || '—') + (payload.mechanic ? ' · ' + payload.mechanic : '') + (payload.note ? ' · ' + payload.note : '')
  });

  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}

function addVehicle_(payload) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sh      = ss.getSheetByName(SHEET_VEHICLES);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var newRow  = headers.map(function(h) {
    return payload.fields[h] !== undefined ? payload.fields[h] : '';
  });
  sh.appendRow(newRow);
  appendLog_(ss, {
    timestamp: new Date(),
    vehicleId: payload.fields['Vehicle ID'] || '?',
    action:    'New vehicle added',
    user:      payload.user || 'Unknown',
    note:      payload.note || ''
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}

function markMaintenanceDone_(payload) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var sh  = ss.getSheetByName(SHEET_MAINTENANCE);
  var statusCol = 7; // Column G
  sh.getRange(payload.row, statusCol).setValue('Done');
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}
function deleteMaintenanceRow_(payload) {
  var rowNumber = payload.row; 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MAINTENANCE);
  
  if (rowNumber > 1 && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
  } else {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid row index" })));
  }
}
function updateMaintenanceCell_(payload) {
  var rowNumber = payload.row;
  var colNumber = payload.column; // Column index (e.g., 6 for Notes)
  var newValue = payload.value;
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MAINTENANCE);
  
  if (rowNumber > 1 && rowNumber <= sheet.getLastRow()) {
    sheet.getRange(rowNumber, colNumber).setValue(newValue);
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
  } else {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid row index" })));
  }
}
function updateMaintenanceRow_(payload) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_MAINTENANCE);
  var row   = payload.row;
  if (!row || row < 2 || row > sheet.getLastRow()) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid row index' })));
  }
  // Columns: A=Timestamp(1), B=VehicleID(2), C=Type(3), D=KM(4), E=User(5), F=Notes(6), G=Status(7)
  // We allow editing B, C, D, F — never touch A (timestamp) or G (status) here
  sheet.getRange(row, 2, 1, 3).setValues([[payload.vehicleId || '', payload.type || '', payload.km || '']]);
  sheet.getRange(row, 6).setValue(payload.note || '');
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}
// ================================================================
// AUTH — Users sheet (lives in TRIPS_SS_ID, tab "Users")
// Columns: Username | PasswordHash | Salt | Display Name | Role
// ================================================================
function getTripSS_() {
  return SpreadsheetApp.openById(TRIPS_SS_ID);
}

function getOrCreateUsersSheet_() {
  var ss = getTripSS_();
  var sh = ss.getSheetByName(SHEET_USERS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_USERS);
    sh.appendRow(['Username', 'PasswordHash', 'Salt', 'Display Name', 'Role']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function generateSalt_() {
  return Utilities.getUuid();
}

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + String(salt));
  return bytes.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

// Returns { username, displayName, role } on success, or null
function verifyCredentials_(username, password) {
  if (!username || !password) return null;
  var sh   = getOrCreateUsersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      var storedHash = data[i][1];
      var salt       = data[i][2];
      if (hashPassword_(password, salt) === storedHash) {
        return { username: data[i][0], displayName: data[i][3] || data[i][0], role: data[i][4] || 'User' };
      }
      return null; // wrong password
    }
  }
  return null; // username not found
}

function authenticateUser_(username, password) {
  var user = verifyCredentials_(username, password);
  if (!user) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Invalid username or password.' })));
  }
  return cors_(ContentService.createTextOutput(JSON.stringify({
    ok: true, username: user.username, displayName: user.displayName, role: user.role
  })));
}

// Admin-only — called after doGet() has already confirmed the caller's role === 'Admin'
function addUser_(payload) {
  if (!payload.newUsername || !payload.newPassword) {
    return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing new user credentials.' })));
  }
  var sh   = getOrCreateUsersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(payload.newUsername).toLowerCase()) {
      return cors_(ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Username already exists.' })));
    }
  }
  var salt = generateSalt_();
  var hash = hashPassword_(payload.newPassword, salt);
  sh.appendRow([
    payload.newUsername,
    hash,
    salt,
    payload.newDisplayName || payload.newUsername,
    payload.newRole === 'Admin' ? 'Admin' : 'User'
  ]);
  appendLog_(getTripSS_(), {
    timestamp: new Date(),
    vehicleId: '',
    action:    'User created: ' + payload.newUsername + ' (' + (payload.newRole === 'Admin' ? 'Admin' : 'User') + ')',
    user:      payload.username || 'Unknown',
    note:      ''
  });
  return cors_(ContentService.createTextOutput(JSON.stringify({ ok: true })));
}

// ================================================================
// HELPERS
// ================================================================
function cors_(output) {
  return output.setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateLogSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.appendRow(['Timestamp', 'Vehicle ID', 'Type', 'KM at service', 'Scheduled date', 'Mechanic', 'User', 'Notes']);
    sh.setFrozenRows(1);
    sh.getRange('1:1').setFontWeight('bold').setBackground('#0047ab').setFontColor('#ffffff');
  }
  return sh;
}

function appendLog_(ss, entry) {
  var sh = getOrCreateLogSheet_(ss);
  sh.appendRow([entry.timestamp, entry.vehicleId, entry.action, '', '', '', entry.user, entry.note]);
}

// ================================================================
// EXISTING DRIVER FORM FUNCTIONS (unchanged)
// ================================================================
function uploadDailyCheck(formData) {
  try {
    Logger.log("uploadDailyCheck called with formData: " + JSON.stringify(formData));
    const rootFolder = DriveApp.getFolderById('19MizOwvGRKzuG9Ke2im7z7s7lsvRt1Eq');
    const timestamp  = new Date();
    const dateStr    = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    const photoUrls  = [];
    for (let i = 1; i <= 5; i++) {
      const photoData = formData[`photo${i}`];
      if (photoData && photoData.data) {
        const fileName  = `${dateStr}_${formData.ikeaId}_${formData.matricule}_photo${i}.jpg`;
        const file      = Utilities.newBlob(Utilities.base64Decode(photoData.data), photoData.mimeType, fileName);
        const savedFile = rootFolder.createFile(file);
        savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrls.push(savedFile.getUrl());
      } else {
        photoUrls.push('');
      }
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Daily Checks');
    if (!sheet) {
      sheet = ss.insertSheet('Daily Checks');
      sheet.appendRow(['Timestamp', 'IKEA ID', 'Vehicle ID', 'Kilometrage', 'Tires', 'Lights', 'Windows', 'Body', 'Notes', 'Latitude', 'Longitude', 'Accuracy', 'Photo 1 URL', 'Photo 2 URL', 'Photo 3 URL', 'Photo 4 URL', 'Photo 5 URL']);
    }
    sheet.appendRow([timestamp, formData.ikeaId, formData.matricule, formData.kilometrage, formData.tires, formData.lights, formData.windows, formData.body, formData.notes, formData.latitude, formData.longitude, formData.accuracy, ...photoUrls]);
    Logger.log("Data saved successfully for IKEA ID: " + formData.ikeaId);
    return { status: 'success' };
  } catch (e) {
    Logger.log("Error in uploadDailyCheck: " + e.message);
    throw new Error("Failed to submit daily check: " + e.message);
  }
}

function ensureIncidentsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Incidents');
  if (!sheet) {
    sheet = ss.insertSheet('Incidents');
    sheet.appendRow(['Timestamp', 'IKEA ID', 'Vehicle ID', 'Incident Location', 'Incident Description', 'Physical Casualties', 'Photo 1 URL', 'Photo 2 URL', 'Photo 3 URL']);
  }
}

function uploadIncidentReport(formData) {
  try {
    Logger.log("uploadIncidentReport called with formData: " + JSON.stringify(formData));
    ensureIncidentsSheet();
    const rootFolder = DriveApp.getFolderById('19MizOwvGRKzuG9Ke2im7z7s7lsvRt1Eq');
    const sheet      = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Incidents');
    const timestamp  = new Date();
    const dateStr    = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'dd-MM-yyyy');
    const photoUrls  = [];
    for (let i = 1; i <= 3; i++) {
      const photoData = formData[`photo${i}`];
      if (photoData && photoData.data) {
        const fileName  = `${dateStr}_${formData.ikeaId}_${formData.matricule}_incident_photo${i}.jpg`;
        const file      = Utilities.newBlob(Utilities.base64Decode(photoData.data), photoData.mimeType, fileName);
        const savedFile = rootFolder.createFile(file);
        savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrls.push(savedFile.getUrl());
      } else {
        photoUrls.push('');
      }
    }
    sheet.appendRow([timestamp, formData.ikeaId, formData.matricule, formData.incidentLocation, formData.incidentDescription, formData.casualties, ...photoUrls]);
    Logger.log("Incident report saved successfully for IKEA ID: " + formData.ikeaId);
    return { status: 'success' };
  } catch (e) {
    Logger.log("Error in uploadIncidentReport: " + e.message);
    throw new Error("Failed to submit incident report: " + e.message);
  }
}

function testRun() {
  getVehicles_();
}

// ================================================================
// ONE-TIME SETUP — run this once manually from the Apps Script editor
// (select it in the function dropdown, click Run) to create the first
// Admin account. Safe to leave in place — it refuses to run again if
// "Saad" already exists.
// ================================================================

function seedFirstAdmin() {
  var sh   = getOrCreateUsersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === 'saad') {
      Logger.log('User "Saad" already exists — skipping seed.');
      return;
    }
  }
  var salt = generateSalt_();
  var hash = hashPassword_('Rinci@2026', salt);
  sh.appendRow(['Saad', hash, salt, 'Saad', 'Admin']);
  Logger.log('Admin account "Saad" created.');
}
