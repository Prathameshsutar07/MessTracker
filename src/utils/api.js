import { db } from './firebase'
import {
  collection, doc, getDoc, getDocs,
  addDoc, query, where,
  serverTimestamp,
} from 'firebase/firestore'

// ── Collections ───────────────────────────────────────────────
const CUSTOMERS = 'customers'
const ENTRIES   = 'entries'


// ── Date helpers ──────────────────────────────────────────────
export const today = () => {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

// ── Plan helpers ──────────────────────────────────────────────
export const isActive = (customer, usedMeals) => {
  const n = today()
  return (
    n >= customer.startDate &&
    n <= customer.endDate &&
    Number(usedMeals) < Number(customer.totalMeals)
  )
}

export const getMealStats = (customer, entries) => {
  const used      = entries.length
  const total     = Number(customer.totalMeals) || 30
  const remaining = Math.max(0, total - used)
  const percent   = Math.round((used / total) * 100)
  return { used, remaining, percent }
}

export const isMealMarked = (entries, meal) =>
  entries.some((e) => e.date === today() && e.meal === meal)

// ── ID generator ──────────────────────────────────────────────
const genId = () => 'c-' + Math.random().toString(36).slice(2, 8).toUpperCase()

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = async () => {
  const snap = await getDocs(collection(db, CUSTOMERS))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const addCustomer = async ({ name, mobile, startDate, totalMeals }) => {
  const endDate = addDays(startDate, 44)
  const customer = {
    name,
    mobile,
    startDate,
    endDate,
    totalMeals: Number(totalMeals),
    createdAt:  today(),
    createdTs:  serverTimestamp(),
  }
  // Use custom ID so QR code matches Firestore document ID
  const customId  = genId()
  const { setDoc } = await import('firebase/firestore')
  await setDoc(doc(db, CUSTOMERS, customId), customer)
  return { id: customId, ...customer }
}

export const getCustomerById = async (id) => {
  const snap = await getDoc(doc(db, CUSTOMERS, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// ── Entries ───────────────────────────────────────────────────
export const getEntriesForCustomer = async (customerId) => {
  const q    = query(collection(db, ENTRIES), where('customerId', '==', customerId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Returns 'ok' | 'duplicate' | 'exhausted' | 'expired'
export const markEntry = async (customer, entries, meal) => {
  const t = today()
  if (t < customer.startDate || t > customer.endDate)       return 'expired'
  if (entries.length >= Number(customer.totalMeals))        return 'exhausted'
  if (entries.find((e) => e.date === t && e.meal === meal)) return 'duplicate'

  await addDoc(collection(db, ENTRIES), {
    customerId: customer.id,
    date:       t,
    meal,
    createdTs:  serverTimestamp(),
  })
  return 'ok'
}
