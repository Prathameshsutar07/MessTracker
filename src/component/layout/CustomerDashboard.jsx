import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc, collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '../../utils/firebase'
import Calendar from './Calendar'

// ─── Helpers (mirrors utils/api) ────────────────────────────
function fmtDate(str) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getAmountPaid(logs = []) {
  return logs.reduce((s, l) => s + Number(l.amount || 0), 0)
}

function getPaymentStatus(paymentAmount, logs = []) {
  const paid = getAmountPaid(logs)
  const due  = Number(paymentAmount)
  if (paid <= 0)   return 'pending'
  if (paid >= due) return 'paid'
  return 'partial'
}

function getMealStats(totalMeals, entries = []) {
  const used      = entries.length
  const remaining = Math.max(0, totalMeals - used)
  const percent   = totalMeals > 0 ? Math.min(100, Math.round((used / totalMeals) * 100)) : 0
  return { used, remaining, percent }
}

function isActive(endDate) {
  return new Date(endDate) >= new Date()
}

function getDaysLeft(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
}

// ─── StatusPill — pixel-matched to admin StatusPill ──────────
function StatusPill({ active }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
      ${active
        ? 'bg-green-400/15 border-green-400/30 text-green-400'
        : 'bg-red-400/15   border-red-400/30   text-red-400'}`}>
      {active ? 'Active' : 'Expired'}
    </span>
  )
}

// ─── PaymentBadge — pixel-matched to admin PaymentBadge ──────
function PaymentBadge({ status }) {
  const cfg = {
    paid:    { label: 'Paid',    cls: 'bg-green-400/15  border-green-400/30  text-green-400'  },
    partial: { label: 'Partial', cls: 'bg-orange-400/15 border-orange-400/30 text-orange-400' },
    pending: { label: 'Pending', cls: 'bg-yellow-400/15 border-yellow-400/30 text-yellow-400' },
  }
  const { label, cls } = cfg[status] || cfg.pending
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  )
}



// ─── Spinner ─────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}

// ─── Loading / Error screens ─────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#111114] flex flex-col items-center justify-center gap-4">
      <Spinner />
      <p className="text-[#8a8a9a] text-[13px]">Loading your dashboard…</p>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen bg-[#111114] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl mb-1">🔒</div>
      <h2 className="text-[18px] font-bold text-[#f0ede8]">Access Denied</h2>
      <p className="text-[13px] text-[#8a8a9a] max-w-xs leading-relaxed">
        {message || 'This link is invalid or has expired. Please contact your meal service provider.'}
      </p>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────
export default function CustomerDashboard() {
  const { customerId }   = useParams()
  const [searchParams]   = useSearchParams()
  const token            = searchParams.get('token')

  const [customer,  setCustomer]  = useState(null)
  const [entries,   setEntries]   = useState([])
  const [payments,  setPayments]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [view,      setView]      = useState('detail') // 'detail' | 'paymentlog'

  useEffect(() => {
    async function load() {
      try {
        if (!token) throw new Error('No access token provided.')

        const snap = await getDoc(doc(db, 'customers', customerId))
        if (!snap.exists()) throw new Error('Customer not found.')

        const data = snap.data()

        // 🔐 Token gate — same security as ShareCustomerButton generates
        if (data.accessToken !== token) throw new Error('Invalid or expired link.')

        const [entriesSnap, paymentsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'entries'),
            where('customerId', '==', customerId)
          )),
          getDocs(query(
            collection(db, 'customers', customerId, 'payments'),
            orderBy('createdTs', 'desc')
          )),
        ])

        setCustomer({ ...data, id: snap.id })
        setEntries(entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b) => a.date.localeCompare(b.date)))
        setPayments(paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [customerId, token])

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen message={error} />

  // ─── Derived values — mirrors CustomersTab exactly ───────
  const stats      = getMealStats(customer.totalMeals, entries)
  const amountDue  = Number(customer.paymentAmount)
  const amountPaid = getAmountPaid(payments)
  const balance    = Math.max(0, amountDue - amountPaid)
  const payStatus  = getPaymentStatus(customer.paymentAmount, payments)
  const active     = isActive(customer.endDate)
  const daysLeft   = getDaysLeft(customer.endDate)
  const lunchCount  = entries.filter((e) => e.meal === 'lunch').length
  const dinnerCount = entries.filter((e) => e.meal === 'dinner').length

  // Payment card colours — mirrors admin detail modal exactly
  const payCardCls =
    payStatus === 'paid'    ? 'bg-green-400/[0.08]  border-green-400/25'
    : payStatus === 'partial' ? 'bg-orange-400/[0.08] border-orange-400/25'
    :                           'bg-yellow-400/[0.08] border-yellow-400/25'

  const payBarCls =
    payStatus === 'paid'    ? 'bg-green-400'
    : payStatus === 'partial' ? 'bg-orange-400'
    :                           'bg-yellow-400'

  return (
    <div className="min-h-screen bg-[#111114] text-[#f0ede8]">

      {/* ── Top bar — mirrors admin header style ── */}
      <div className="flex items-center justify-between px-5 pt-10 pb-2">
        <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">
          Meal Plan
        </span>
        <span className={`font-mono text-[10px] px-2.5 py-1 rounded-full border
          ${!active
            ? 'bg-red-400/10    border-red-400/30    text-red-400'
            : daysLeft <= 5
            ? 'bg-orange-400/10 border-orange-400/30 text-orange-400'
            : 'bg-green-400/10  border-green-400/30  text-green-400'}`}>
          {!active ? 'Expired' : `${daysLeft}d left`}
        </span>
      </div>

      {/* ── Customer info — mirrors admin detail modal exactly ── */}
      <div className="px-5 pt-3 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{customer.name}</h2>
            <p className="font-mono text-[11px] text-[#8a8a9a]">{customer.id}</p>
            <p className="text-[13px] text-[#8a8a9a] mt-1">📱 {customer.mobile}</p>
            <p className="text-[13px] text-[#8a8a9a]">
              📅 {fmtDate(customer.startDate)} → {fmtDate(customer.endDate)}
            </p>
          </div>
          <StatusPill active={active} />
        </div>
      </div>

      {/* ── Tab switcher — pixel-match of admin modal tabs ── */}
      <div className="flex gap-2 px-5 mb-4">
        {[['detail', 'Details'], ['paymentlog', '💳 Payment Log']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-semibold border transition-colors
              ${view === v
                ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                : 'bg-[#222228] border-[#2e2e38] text-[#8a8a9a]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════ DETAILS VIEW ══════════════ */}
      {view === 'detail' && (
        <div className="px-5 space-y-4 pb-10">

          {/* Payment summary card — mirrors admin detail modal */}
          <div className={`rounded-xl border p-4 ${payCardCls}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-[#f0ede8]">Payment</p>
              <PaymentBadge status={payStatus} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-[#18181c]/60 rounded-lg py-2">
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Total Due</p>
                <p className="text-[16px] font-bold text-[#f0ede8]">₹{amountDue}</p>
              </div>
              <div className="bg-[#18181c]/60 rounded-lg py-2">
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Paid</p>
                <p className="text-[16px] font-bold text-green-400">₹{amountPaid}</p>
              </div>
              <div className="bg-[#18181c]/60 rounded-lg py-2">
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Balance</p>
                <p className={`text-[16px] font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ₹{balance}
                </p>
              </div>
            </div>
            <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${payBarCls}`}
                style={{ width: `${Math.min(100, Math.round((amountPaid / amountDue) * 100))}%` }} />
            </div>
          </div>

          {/* Meal quota — mirrors admin detail modal */}
          <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3">
            <div className="flex justify-between text-[13px] mb-2">
              <span className="text-[#8a8a9a]">Meal quota</span>
              <span className="font-semibold">
                <span className={stats.remaining === 0 ? 'text-red-400' : 'text-[#f0c040]'}>
                  {stats.used}
                </span>
                <span className="text-[#8a8a9a]"> / {customer.totalMeals}</span>
              </span>
            </div>
            <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all
                ${stats.percent >= 90 ? 'bg-red-400' : stats.percent >= 70 ? 'bg-[#e8794a]' : 'bg-[#f0c040]'}`}
                style={{ width: `${stats.percent}%` }} />
            </div>
            <p className="text-[11px] text-[#8a8a9a]">{stats.remaining} meals remaining</p>
          </div>

          {/* Lunch / Dinner split — mirrors admin detail modal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🌤</span>
              <div>
                <p className="text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-0.5">Lunches</p>
                <p className="text-[20px] font-bold text-[#f0c040]">{lunchCount}</p>
              </div>
            </div>
            <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🌙</span>
              <div>
                <p className="text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-0.5">Dinners</p>
                <p className="text-[20px] font-bold text-[#e8794a]">{dinnerCount}</p>
              </div>
            </div>
          </div>

          {/* Plan details grid */}
          <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Plan',    `${customer.totalMeals} Meals`, 'text-[#f0c040]'],
                ['Amount',  `₹${customer.paymentAmount}`,   'text-[#f0c040]'],
                ['Start',   fmtDate(customer.startDate),    ''],
                ['Expires', fmtDate(customer.endDate),      !active ? 'text-red-400' : ''],
              ].map(([label, val, cls]) => (
                <div key={label} className="bg-[#18181c]/60 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider mb-0.5">{label}</p>
                  <p className={`font-semibold text-[13px] ${cls}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meal Calendar — uses same Calendar component as admin */}
          {entries.length > 0 ? (
            <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4">
              <p className="text-[11px] font-semibold text-[#8a8a9a] uppercase tracking-widest mb-3">
                Meal Calendar
              </p>
              <Calendar entries={entries} />
            </div>
          ) : (
            <div className="text-center py-10 text-[#8a8a9a]">
              <div className="text-4xl mb-3">🍽</div>
              <p className="text-[13px]">No meals recorded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ PAYMENT LOG VIEW ══════════════ */}
      {view === 'paymentlog' && (
        <div className="px-5 space-y-4 pb-10">

          {/* Summary bar — mirrors admin paymentlog view exactly */}
          <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold text-[#f0ede8]">{customer.name}</p>
              <PaymentBadge status={payStatus} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Due</p>
                <p className="text-[15px] font-bold text-[#f0ede8]">₹{amountDue}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Paid</p>
                <p className="text-[15px] font-bold text-green-400">₹{amountPaid}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider">Balance</p>
                <p className={`text-[15px] font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  ₹{balance}
                </p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#2e2e38] rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full ${payStatus === 'paid' ? 'bg-green-400' : 'bg-orange-400'}`}
                style={{ width: `${Math.min(100, Math.round((amountPaid / amountDue) * 100))}%` }}
              />
            </div>
          </div>

          {/* Payment entries — mirrors admin payment log exactly, read-only (no delete) */}
          {payments.length === 0 ? (
            <div className="text-center py-8 text-[#8a8a9a]">
              <div className="text-3xl mb-2">💸</div>
              <p className="text-[13px]">No payments recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#8a8a9a] uppercase tracking-widest">
                Payment History
              </p>
              {payments.map((log, idx) => (
                <div key={log.id}
                  className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3
                    flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* Index bubble — same as admin */}
                    <div className="w-9 h-9 rounded-full bg-green-400/15 flex items-center justify-center
                      text-[11px] font-bold text-green-400 shrink-0">
                      #{payments.length - idx}
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-green-400">₹{log.amount}</p>
                      <p className="text-[11px] text-[#8a8a9a] capitalize">
                        {log.method}{log.ref ? ` · ${log.ref}` : ''}
                      </p>
                      {log.note && (
                        <p className="text-[11px] text-[#8a8a9a] italic">{log.note}</p>
                      )}
                      <p className="text-[10px] text-[#8a8a9a] mt-0.5">{fmtDate(log.date)}</p>
                    </div>
                  </div>
                  {/* Method pill in place of delete button */}
                  <span className="text-[10px] font-mono text-[#8a8a9a] bg-[#18181c] border border-[#2e2e38]
                    px-2 py-0.5 rounded-full capitalize shrink-0">
                    {log.method}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-[10px] text-[#3a3a4a] pb-8">
        For queries, contact your meal service provider
      </p>
    </div>
  )
}