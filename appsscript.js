// ═══════════════════════════════════════════════════════════════
//  MessTrack — Google Apps Script
//
//  SETUP INSTRUCTIONS:
//  1. Open your Google Sheet
//  2. Click Extensions → Apps Script
//  3. Delete all existing code, paste this entire file
//  4. Save (Ctrl+S)
//  5. Click Deploy → New deployment
//       Type: Web App
//       Execute as: Me
//       Who has access: Anyone
//  6. Click Deploy → copy the Web App URL
//  7. Paste the URL in your .env file:
//       REACT_APP_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
//  8. Restart the React app (npm start)
//
//  SHEET STRUCTURE (auto-created on first run):
//  Sheet "Customers":  id | name | mobile | startDate | endDate | totalMeals | createdAt
//  Sheet "Entries":    id | customerId | date | meal
// ═══════════════════════════════════════════════════════════════

const SHEET_ID        = SpreadsheetApp.getActiveSpreadsheet().getId()
const SHEET_CUSTOMERS = 'Customers'
const SHEET_ENTRIES   = 'Entries'

// ── Bootstrap: create sheets + headers if missing ──────────────
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  let cs = ss.getSheetByName(SHEET_CUSTOMERS)
  if (!cs) {
    cs = ss.insertSheet(SHEET_CUSTOMERS)
    cs.appendRow(['id', 'name', 'mobile', 'startDate', 'endDate', 'totalMeals', 'createdAt'])
    cs.setFrozenRows(1)
  }

  let es = ss.getSheetByName(SHEET_ENTRIES)
  if (!es) {
    es = ss.insertSheet(SHEET_ENTRIES)
    es.appendRow(['id', 'customerId', 'date', 'meal'])
    es.setFrozenRows(1)
  }
}

// ── ID generator ───────────────────────────────────────────────
function genId() {
  return 'C' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ── Sheet helpers ──────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
}

function getRows(sheetName) {
  const sheet = getSheet(sheetName)
  const data  = sheet.getDataRange().getValues()
  if (data.length <= 1) return []          // only headers or empty
  const headers = data[0]
  return data.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? '') })
    return obj
  })
}

function appendRow(sheetName, obj) {
  const sheet   = getSheet(sheetName)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  const row     = headers.map(h => obj[h] ?? '')
  sheet.appendRow(row)
}

// ── CORS response helper ────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── Main router ────────────────────────────────────────────────
function doGet(e) {
  try {
    ensureSheets()
    const action = e.parameter.action
    const p      = e.parameter

    if (action === 'getCustomers') {
      const customers = getRows(SHEET_CUSTOMERS)
      return jsonResponse({ customers })
    }

    if (action === 'addCustomer') {
      const customer = {
        id:          genId(),
        name:        p.name,
        mobile:      p.mobile,
        startDate:   p.startDate,
        endDate:     p.endDate,
        totalMeals:  p.totalMeals,
        createdAt:   p.createdAt,
      }
      appendRow(SHEET_CUSTOMERS, customer)
      return jsonResponse({ customer })
    }

    if (action === 'getCustomerById') {
      const customers = getRows(SHEET_CUSTOMERS)
      const customer  = customers.find(c => c.id === p.id) || null
      if (!customer) return jsonResponse({ error: 'Customer not found' })
      return jsonResponse({ customer })
    }

    if (action === 'getEntriesForCustomer') {
      const all     = getRows(SHEET_ENTRIES)
      const entries = all.filter(e => e.customerId === p.customerId)
      return jsonResponse({ entries })
    }

    if (action === 'markEntry') {
      const entry = {
        id:         genId(),
        customerId: p.customerId,
        date:       p.date,
        meal:       p.meal,
      }
      appendRow(SHEET_ENTRIES, entry)
      return jsonResponse({ entry })
    }

    return jsonResponse({ error: `Unknown action: ${action}` })

  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}
