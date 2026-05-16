import { db, firebaseConfig } from './firebase'
import {
  collection, doc, getDoc, getDocs, setDoc,
  addDoc, updateDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, updateEmail, updatePassword } from 'firebase/auth'

const CUSTOMERS = 'customers'
const ENTRIES   = 'entries'
const PAYMENTS  = 'payments'  // subcollection under each customer

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

// ── Context for Multi-tenant ──────────────────────────────────
export let currentHotelId = null;
export let currentHotelConfig = null;

export const setHotelContext = (id, config) => {
  currentHotelId = id;
  currentHotelConfig = config;
};

export const getHotelConfig = async (uid) => {
  const snap = await getDoc(doc(db, 'hotels', uid));
  if (snap.exists()) {
    const data = snap.data();
    delete data.password; // Never expose password
    return data;
  }
  return null;
}

export const getHotels = async () => {
  const snap = await getDocs(collection(db, 'hotels'));
  return snap.docs.map(d => {
    const data = d.data();
    delete data.password; // Never expose password
    return { id: d.id, ...data };
  });
}

export const addHotel = async ({ email, password, hotelName, expiryDays, plans }) => {
  const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
  const secondaryAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid = cred.user.uid;
  aw
  const hotelDoc = {
    email,
    password, // store for updates
    hotelName,
    expiryDays: Number(expiryDays),
    plans,
    createdTs: serverTimestamp(),
  };
  await setDoc(doc(db, 'hotels', uid), hotelDoc);
  return { id: uid, ...hotelDoc };
}

export const updateHotel = async (uid, oldEmail, oldPassword, updatedData) => {
  let authSkipped = false;
  if ((updatedData.email && updatedData.email !== oldEmail) || (updatedData.password && updatedData.password !== oldPassword)) {
    if (oldEmail && oldPassword) {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp_" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, oldEmail, oldPassword);
        if (updatedData.email && updatedData.email !== oldEmail) {
          await updateEmail(cred.user, updatedData.email);
        }
        if (updatedData.password && updatedData.password !== oldPassword) {
          await updatePassword(cred.user, updatedData.password);
        }
      } catch (err) {
        authSkipped = true;
      } finally {
        await signOut(secondaryAuth);
      }
    } else {
      authSkipped = true;
    }
  }

  await updateDoc(doc(db, 'hotels', uid), updatedData);
  
  if (authSkipped) {
    return "AUTH_SKIPPED";
  }
  return "OK";
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

// ── Payment status helper ─────────────────────────────────────
// 'paid'    — totalPaid >= paymentAmount
// 'partial' — 0 < totalPaid < paymentAmount
// 'pending' — totalPaid === 0
export const getPaymentStatus = (customer, paymentLogs = []) => {
  const total = Number(customer.paymentAmount) || 0
  const paid  = paymentLogs.reduce((s, p) => s + Number(p.amount), 0)
  if (paid <= 0)    return 'pending'
  if (paid >= total) return 'paid'
  return 'partial'
}

export const getAmountPaid = (paymentLogs = []) =>
  paymentLogs.reduce((s, p) => s + Number(p.amount), 0)

// ── Plan pricing ──────────────────────────────────────────────
export const PLAN_PRICE = { 30: 1500, 60: 2800 }

const genId = () => 'C' + Math.random().toString(36).slice(2, 8).toUpperCase()

// ── Customers ─────────────────────────────────────────────────
export const getCustomers = async () => {
  if (!currentHotelId) return [];
  const q = query(collection(db, CUSTOMERS), where('hotelId', '==', currentHotelId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const addCustomer = async ({ name, mobile, startDate, totalMeals }) => {
  const expiryDays = currentHotelConfig?.expiryDays || 45;
  const endDate  = addDays(startDate, expiryDays - 1);
  const plan = currentHotelConfig?.plans?.find(p => String(p.meals) === String(totalMeals));
  const amount = plan ? plan.price : (PLAN_PRICE[Number(totalMeals)] || 1500);
  const customId = genId()
  const customer = {
    hotelId:       currentHotelId,
    name,
    mobile,
    startDate,
    endDate,
    totalMeals:    Number(totalMeals),
    createdAt:     today(),
    createdTs:     serverTimestamp(),
    paymentAmount: amount,   // total due
    accessToken: genToken(),
  }
  await setDoc(doc(db, CUSTOMERS, customId), customer)
  return { id: customId, ...customer }
}

export const getCustomerById = async (id) => {
  const snap = await getDoc(doc(db, CUSTOMERS, id))
  if (!snap.exists()) return null
  const data = snap.data();
  if (data.hotelId !== currentHotelId) return null; // CRITICAL: Stop Cross-Tenant Scanning
  return { id: snap.id, ...data }
}

// ── Payment logs (subcollection) ──────────────────────────────
// Each doc: { amount, method, ref, note, date, createdTs }

export const getPaymentLogs = async (customerId) => {
  const q    = query(
    collection(db, CUSTOMERS, customerId, PAYMENTS),
    orderBy('createdTs', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const addPaymentLog = async (customerId, { amount, method, ref, note }) => {
  const log = {
    amount:    Number(amount),
    method:    method || 'cash',   // 'cash' | 'upi' | 'other'
    ref:       ref || '',
    note:      note || '',
    date:      today(),
    createdTs: serverTimestamp(),
  }
  const docRef = await addDoc(
    collection(db, CUSTOMERS, customerId, PAYMENTS),
    log
  )
  return { id: docRef.id, ...log }
}

export const deletePaymentLog = async (customerId, paymentId) => {
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, CUSTOMERS, customerId, PAYMENTS, paymentId))
}

// ── Entries ───────────────────────────────────────────────────
export const getEntriesForCustomer = async (customerId) => {
  const q    = query(collection(db, ENTRIES), where('customerId', '==', customerId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Returns 'ok' | 'duplicate' | 'exhausted' | 'expired' | 'unpaid'
export const markEntry = async (customer, paymentLogs, entries, meal) => {
  const t      = today()
  const status = getPaymentStatus(customer, paymentLogs)
  if (status === 'pending')                                 return 'unpaid'
  if (t < customer.startDate || t > customer.endDate)       return 'expired'
  if (entries.length >= Number(customer.totalMeals))        return 'exhausted'
  if (entries.find((e) => e.date === t && e.meal === meal)) return 'duplicate'

  await addDoc(collection(db, ENTRIES), {
    hotelId:    currentHotelId,
    customerId: customer.id,
    date:       t,
    meal,
    createdTs:  serverTimestamp(),
  })
  return 'ok'
}

export const getDashboardData = async (startDate, endDate) => {
  if (!currentHotelId) return null;
  
  // 1. Get all customers
  const qCustomers = query(collection(db, CUSTOMERS), where('hotelId', '==', currentHotelId));
  const snapC = await getDocs(qCustomers);
  const customers = snapC.docs.map(d => ({ id: d.id, ...d.data() }));

  const newCustomers = customers.filter(c => c.createdAt >= startDate && c.createdAt <= endDate);

  // 2. Get all payments
  let allPayments = [];
  await Promise.all(customers.map(async (c) => {
    try {
      const qPay = query(collection(db, CUSTOMERS, c.id, PAYMENTS));
      const pSnap = await getDocs(qPay);
      const logs = pSnap.docs.map(d => ({ customerId: c.id, customerName: c.name, id: d.id, ...d.data()}));
      allPayments.push(...logs);
    } catch { } // ignore
  }));
  const filteredPayments = allPayments.filter(p => p.date >= startDate && p.date <= endDate);

  // 3. Get all entries
  const qEntries = query(collection(db, ENTRIES), where('hotelId', '==', currentHotelId));
  const eSnap = await getDocs(qEntries);
  const allEntries = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const filteredEntries = allEntries.filter(e => e.date >= startDate && e.date <= endDate);

  const customerMap = customers.reduce((m, c) => { m[c.id] = c; return m; }, {});
  const detailedEntries = filteredEntries.map(e => ({
     ...e,
     customerName: customerMap[e.customerId]?.name || 'Unknown',
     customerMobile: customerMap[e.customerId]?.mobile || '-'
  }));

  return {
    allCustomers: customers,
    customers: newCustomers,
    payments: filteredPayments,
    entries: detailedEntries,
  };
}

const genToken = () => Math.random().toString(36).slice(2) + Date.now()