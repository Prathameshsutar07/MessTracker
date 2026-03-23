// ── Date helpers ─────────────────────────────────────────
export const today = () => new Date().toISOString().slice(0, 10)

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

// Add N days to a date string, return new date string
export const addDays = (dateStr, n) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Plan is valid if today is within date range AND meals remain
export const isActive = (customer, usedMeals) => {
  const n = today()
  const withinDate = n >= customer.startDate && n <= customer.endDate
  const mealsLeft  = usedMeals < customer.totalMeals
  return withinDate && mealsLeft
}

// Returns { used, remaining, percent }
export const getMealStats = (customer, entries) => {
  const used      = entries.length
  const remaining = Math.max(0, customer.totalMeals - used)
  const percent   = Math.round((used / customer.totalMeals) * 100)
  return { used, remaining, percent }
}

const genId = () => 'C' + Math.random().toString(36).slice(2, 8).toUpperCase()

// ── Storage keys ─────────────────────────────────────────
const CK = 'mt_customers'
const EK = 'mt_entries'

const load = (key) => JSON.parse(localStorage.getItem(key) || '[]')
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

// ── Customers ────────────────────────────────────────────
export const getCustomers = () => load(CK)

// totalMeals: 30 or 60 — endDate is auto-calculated as startDate + 44 days (45 day validity)
export const addCustomer = ({ name, mobile, startDate, totalMeals }) => {
  const customers = load(CK)
  const endDate   = addDays(startDate, 44) // 45 days inclusive
  const customer  = {
    id: genId(),
    name,
    mobile,
    startDate,
    endDate,
    totalMeals: Number(totalMeals),
    createdAt: today(),
  }
  save(CK, [...customers, customer])
  return customer
}

export const getCustomerById = (id) =>
  load(CK).find((c) => c.id === id) || null

// ── Entries ──────────────────────────────────────────────
// Each entry: { id, customerId, date, meal: 'lunch' | 'dinner' }

export const getEntriesForCustomer = (customerId) =>
  load(EK).filter((e) => e.customerId === customerId)

// Returns 'ok' | 'duplicate' | 'exhausted' | 'expired'
export const markEntry = (customer, entries, meal) => {
  const t = today()

  // Date validity check
  if (t < customer.startDate || t > customer.endDate) return 'expired'

  // Meal quota check
  if (entries.length >= customer.totalMeals) return 'exhausted'

  // Duplicate check for same day + meal
  if (entries.find((e) => e.date === t && e.meal === meal)) return 'duplicate'

  const allEntries = load(EK)
  save(EK, [...allEntries, { id: genId(), customerId: customer.id, date: t, meal }])
  return 'ok'
}

export const isMealMarked = (entries, meal) =>
  entries.some((e) => e.date === today() && e.meal === meal)