// ─────────────────────────────────────────────────────────────
//  MessTrack — Google Sheets API layer via Apps Script
// ─────────────────────────────────────────────────────────────

const APPS_SCRIPT_URL = process.env.REACT_APP_APPS_SCRIPT_URL || ''

// ── Date helpers — use LOCAL date, never UTC ──────────────────
// new Date().toISOString() is UTC — in India (UTC+5:30) before
// 5:30 AM it returns yesterday's date, causing "plan expired" errors.

export const today = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const fmtDate = (d) =>
  // Add T12:00:00 so parsing never crosses a day boundary due to timezone
  new Date(d + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

export const addDays = (dateStr, n) => {
  // Use noon to prevent DST / UTC midnight edge cases shifting the date
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Plan helpers ──────────────────────────────────────────────
export const isActive = (customer, usedMeals) => {
  const n = today()
  const withinDate = n >= customer.startDate && n <= customer.endDate
  const mealsLeft  = Number(usedMeals) < Number(customer.totalMeals)
  return withinDate && mealsLeft
}

export const getMealStats = (customer, entries) => {
  const used      = entries.length
  const remaining = Math.max(0, Number(customer.totalMeals) - used)
  const percent   = Math.round((used / Number(customer.totalMeals)) * 100)
  return { used, remaining, percent }
}

export const isMealMarked = (entries, meal) =>
  entries.some((e) => e.date === today() && e.meal === meal)

// ── Core fetch wrapper ────────────────────────────────────────
async function call(action, params = {}) {
  if (!APPS_SCRIPT_URL) throw new Error('REACT_APP_APPS_SCRIPT_URL not set in .env')

  const url = new URL(APPS_SCRIPT_URL)
  url.searchParams.set('action', action)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json
}

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = async () => {
  const { customers } = await call('getCustomers')
  return customers
}

export const addCustomer = async ({ name, mobile, startDate, totalMeals }) => {
  const endDate = addDays(startDate, 44)
  const { customer } = await call('addCustomer', {
    name, mobile, startDate, endDate,
    totalMeals: String(totalMeals),
    createdAt: today(),
  })
  return customer
}

export const getCustomerById = async (id) => {
  const { customer } = await call('getCustomerById', { id })
  return customer
}

// ── Entries ───────────────────────────────────────────────────
export const getEntriesForCustomer = async (customerId) => {
  const { entries } = await call('getEntriesForCustomer', { customerId })
  return entries
}

// Returns 'ok' | 'duplicate' | 'exhausted' | 'expired'
export const markEntry = async (customer, entries, meal) => {
  const t = today()

  // Compare as strings — both are YYYY-MM-DD local dates
  if (t < customer.startDate || t > customer.endDate) return 'expired'
  if (entries.length >= Number(customer.totalMeals))  return 'exhausted'
  if (entries.find((e) => e.date === t && e.meal === meal)) return 'duplicate'

  await call('markEntry', { customerId: customer.id, date: t, meal })
  return 'ok'
}