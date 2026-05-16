import { useState, useEffect, useCallback } from 'react'
import StatusPill from './StatusPill'
import PaymentBadge from './PaymentBadge'
import Calendar from './Calendar'
import {
  isActive, fmtDate, getMealStats, getPaymentStatus, getAmountPaid, currentHotelConfig,
  getCustomers, getEntriesForCustomer, getPaymentLogs, addPaymentLog, deletePaymentLog,
} from '../../utils/api'

const METHODS = ['cash', 'upi', 'card', 'other']

export default function CustomersTab({ onToast }) {
  const expiryDays = currentHotelConfig?.expiryDays || 45;

  const [customers,        setCustomers]        = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [entries,          setEntries]          = useState([])
  const [paymentLogs,      setPaymentLogs]      = useState([])
  const [loadingList,      setLoadingList]      = useState(true)
  const [loadingDetail,    setLoadingDetail]    = useState(false)
  const [view,             setView]             = useState('detail')  // 'detail' | 'paymentlog'
  const [filter,           setFilter]           = useState('all')
  const [addingPayment,    setAddingPayment]    = useState(false)
  const [savingPayment,    setSavingPayment]    = useState(false)
  const [deletingId,       setDeletingId]       = useState(null)
  const [payForm,          setPayForm]          = useState({
    amount: '', method: 'cash', ref: '', note: '',
  })

  const loadCustomers = useCallback(() => {
    setLoadingList(true)
    getCustomers()
      .then(async (list) => {
        // Fetch payment logs for every customer so filters & badges work immediately
        const enriched = await Promise.all(
          list.map(async (c) => {
            try {
              const logs = await getPaymentLogs(c.id)
              return { ...c, _paymentLogs: logs }
            } catch {
              return { ...c, _paymentLogs: [] }
            }
          })
        )
        setCustomers(enriched)
      })
      .catch((err) => onToast('Failed to load: ' + err.message, 'err'))
      .finally(() => setLoadingList(false))
  }, [onToast])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const handleSelectCustomer = async (c) => {
    setLoadingDetail(true)
    setSelectedCustomer(c)
    setView('detail')
    setAddingPayment(false)
    try {
      const [e, p] = await Promise.all([
        getEntriesForCustomer(c.id),
        getPaymentLogs(c.id),
      ])
      setEntries(e)
      setPaymentLogs(p)
    } catch (err) {
      onToast('Failed to load: ' + err.message, 'err')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleClose = () => {
    setSelectedCustomer(null)
    setEntries([])
    setPaymentLogs([])
    setView('detail')
    setAddingPayment(false)
  }

  const handleAddPayment = async () => {
    const amt = Number(payForm.amount)
    if (!amt || amt <= 0) { onToast('Enter a valid amount', 'err'); return }
    const due      = Number(selectedCustomer.paymentAmount)
    const alreadyPaid = getAmountPaid(paymentLogs)
    if (alreadyPaid + amt > due) {
      onToast(`Amount exceeds balance due ₹${due - alreadyPaid}`, 'err'); return
    }
    setSavingPayment(true)
    try {
      const log = await addPaymentLog(selectedCustomer.id, payForm)
      const updated = [...paymentLogs, log]
      setPaymentLogs(updated)
      setPayForm({ amount: '', method: 'cash', ref: '', note: '' })
      setAddingPayment(false)
      onToast('Payment recorded!', 'ok')
      // Refresh customer list to update badges
      setCustomers((cs) => cs.map((c) =>
        c.id === selectedCustomer.id ? { ...c, _paymentLogs: updated } : c
      ))
      // Also update selectedCustomer so its own badge reflects the new status
      setSelectedCustomer((prev) => ({ ...prev, _paymentLogs: updated }))
    } catch (err) {
      onToast('Failed: ' + err.message, 'err')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleDeletePayment = async (payId) => {
    if (!window.confirm('Delete this payment entry?')) return
    setDeletingId(payId)
    try {
      await deletePaymentLog(selectedCustomer.id, payId)
      const updated = paymentLogs.filter((l) => l.id !== payId)
      setPaymentLogs(updated)
      setCustomers((cs) => cs.map((c) =>
        c.id === selectedCustomer.id ? { ...c, _paymentLogs: updated } : c
      ))
      onToast('Payment entry deleted', 'ok')
    } catch (err) {
      onToast('Failed: ' + err.message, 'err')
    } finally {
      setDeletingId(null)
    }
  }

  const stats        = selectedCustomer ? getMealStats(selectedCustomer, entries) : null
  const amountPaid   = getAmountPaid(paymentLogs)
  const amountDue    = selectedCustomer ? Number(selectedCustomer.paymentAmount) : 0
  const balance      = Math.max(0, amountDue - amountPaid)
  const payStatus    = selectedCustomer ? getPaymentStatus(selectedCustomer, paymentLogs) : 'pending'
  const lunchCount   = entries.filter((e) => e.meal === 'lunch').length
  const dinnerCount  = entries.filter((e) => e.meal === 'dinner').length

  // Summary stats across all customers (use embedded logs if loaded, else estimate)
  const totalPaid    = customers.filter((c) => {
    const status = getPaymentStatus(c, c._paymentLogs || [])
    return status === 'paid'
  }).length
  const totalPartial = customers.filter((c) => {
    const status = getPaymentStatus(c, c._paymentLogs || [])
    return status === 'partial'
  }).length
  const totalPending = customers.filter((c) => {
    const status = getPaymentStatus(c, c._paymentLogs || [])
    return status === 'pending'
  }).length

  const filtered = customers.filter((c) => {
    if (filter === 'paid')    return getPaymentStatus(c, c._paymentLogs || []) === 'paid'
    if (filter === 'partial') return getPaymentStatus(c, c._paymentLogs || []) === 'partial'
    if (filter === 'pending') return getPaymentStatus(c, c._paymentLogs || []) === 'pending'
    return true
  })

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">
          Customers
        </h1>
        <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">
          {customers.length} total
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 px-4 mb-4">
        {[
          ['Paid',    totalPaid,    'text-green-400'],
          ['Partial', totalPartial, 'text-orange-400'], 
          ['Pending', totalPending, 'text-yellow-400'],
          ['Total',   customers.length, 'text-[#f0ede8]'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-[#18181c] border border-[#2e2e38] rounded-xl px-2 py-2.5 text-center">
            <p className="text-[10px] text-[#8a8a9a] uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-[16px] font-bold ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto">
        {[['all','All'],['paid','Paid'],['partial','Partial'],['pending','Pending']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors whitespace-nowrap
              ${filter === val
                ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                : 'bg-[#222228] border-[#2e2e38] text-[#8a8a9a] hover:border-[#4a4a5a]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-4">
        {loadingList ? (
          <div className="flex items-center justify-center py-16 text-[#8a8a9a] gap-3">
            <Spinner /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#8a8a9a]">
            <div className="text-4xl mb-3">🍽</div>
            <p>{customers.length === 0 ? 'No customers yet.' : 'No results.'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => {
              const cStatus = getPaymentStatus(c, c._paymentLogs || [])
              return (
                <div key={c.id} onClick={() => handleSelectCustomer(c)}
                  className="bg-[#18181c] border border-[#2e2e38] p-4 rounded-xl cursor-pointer hover:border-[#4a4a5a] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[17px] font-semibold">{c.name}</p>
                      <p className="font-mono text-[11px] text-[#8a8a9a]">{c.id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusPill active={isActive(c, 0)} />
                      <PaymentBadge status={cStatus} />
                    </div>
                  </div>
                  <div className="flex justify-between text-[12px] text-[#8a8a9a]">
                    <span>📱 {c.mobile}</span>
                    <span className="text-[#f0c040] font-semibold">₹{c.paymentAmount}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#8a8a9a] mt-1">
                    <span>{c.totalMeals} meals · {expiryDays} days</span>
                    <span>Expires {fmtDate(c.endDate)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50"
          onClick={(e) => e.target === e.currentTarget && handleClose()}>
          <div className="bg-[#18181c] rounded-t-2xl w-full max-h-[92vh] overflow-y-auto pb-10">
            <div className="w-10 h-1 bg-[#2e2e38] rounded-full mx-auto mt-4 mb-4" />

            {/* Tab switcher */}
            <div className="flex gap-2 px-5 mb-4">
              {[['detail','Details'],['paymentlog','💳 Payment Log']].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-semibold border transition-colors
                    ${view === v
                      ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                      : 'bg-[#222228] border-[#2e2e38] text-[#8a8a9a]'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── DETAILS VIEW ── */}
            {view === 'detail' && (
              <div className="px-5 space-y-4">
                {/* Customer info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                    <p className="font-mono text-[11px] text-[#8a8a9a]">{selectedCustomer.id}</p>
                    <p className="text-[13px] text-[#8a8a9a] mt-1">📱 {selectedCustomer.mobile}</p>
                    <p className="text-[13px] text-[#8a8a9a]">
                      📅 {fmtDate(selectedCustomer.startDate)} → {fmtDate(selectedCustomer.endDate)}
                    </p>
                  </div>
                  <StatusPill active={isActive(selectedCustomer, entries.length)} />
                </div>

                {/* Payment summary card */}
                <div className={`rounded-xl border p-4
                  ${payStatus === 'paid'    ? 'bg-green-400/8 border-green-400/25'
                  : payStatus === 'partial' ? 'bg-orange-400/8 border-orange-400/25'
                  :                           'bg-yellow-400/8 border-yellow-400/25'}`}>
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
                  {/* Progress bar */}
                  {/* <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all
                      ${payStatus === 'paid' ? 'bg-green-400' : payStatus === 'partial' ? 'bg-orange-400' : 'bg-yellow-400'}`}
                      style={{ width: `${Math.min(100, Math.round((amountPaid / amountDue) * 100))}%` }} />
                  </div>
                  <button onClick={() => setView('paymentlog')}
                    className="w-full mt-3 py-2.5 rounded-lg bg-[#18181c] border border-[#2e2e38]
                      text-[#f0ede8] text-[13px] font-medium hover:border-[#f0c040] hover:text-[#f0c040]
                      transition-colors flex items-center justify-center gap-2">
                    💳 View Payment Log ({paymentLogs.length})
                  </button> */}
                </div>

                {/* Meal quota */}
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8 text-[#8a8a9a] gap-3">
                    <Spinner /> Loading…
                  </div>
                ) : (
                  <>
                    <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3">
                      <div className="flex justify-between text-[13px] mb-2">
                        <span className="text-[#8a8a9a]">Meal quota</span>
                        <span className="font-semibold">
                          <span className={stats.remaining === 0 ? 'text-red-400' : 'text-[#f0c040]'}>{stats.used}</span>
                          <span className="text-[#8a8a9a]"> / {selectedCustomer.totalMeals}</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full transition-all
                          ${stats.percent >= 90 ? 'bg-red-400' : stats.percent >= 70 ? 'bg-[#e8794a]' : 'bg-[#f0c040]'}`}
                          style={{ width: `${stats.percent}%` }} />
                      </div>
                      <p className="text-[11px] text-[#8a8a9a]">{stats.remaining} meals remaining</p>
                    </div>

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

                    {entries.length > 0 && (
                      <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4">
                        <p className="text-[11px] font-semibold text-[#8a8a9a] uppercase tracking-widest mb-3">Meal Calendar</p>
                        <Calendar entries={entries} />
                      </div>
                    )}
                  </>
                )}

                <button onClick={handleClose}
                  className="w-full py-3.5 rounded-xl bg-[#222228] border border-[#2e2e38]
                    text-[#f0ede8] font-medium hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">
                  Close
                </button>
              </div>
            )}

            {/* ── PAYMENT LOG VIEW ── */}
            {view === 'paymentlog' && (
              <div className="px-5 space-y-4">
                {/* Summary bar */}
                <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-[#f0ede8]">{selectedCustomer.name}</p>
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
                      <p className={`text-[15px] font-bold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>₹{balance}</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#2e2e38] rounded-full overflow-hidden mt-3">
                    <div className={`h-full rounded-full ${payStatus === 'paid' ? 'bg-green-400' : 'bg-orange-400'}`}
                      style={{ width: `${Math.min(100, Math.round((amountPaid / amountDue) * 100))}%` }} />
                  </div>
                </div>

                {/* Add payment button */}
                {balance > 0 && !addingPayment && (
                  <button onClick={() => setAddingPayment(true)}
                    className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold text-[14px]
                      hover:bg-green-400 transition-colors flex items-center justify-center gap-2">
                    + Add Payment
                  </button>
                )}

                {/* Add payment form */}
                {addingPayment && (
                  <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4 space-y-3">
                    <p className="text-[13px] font-semibold text-[#f0ede8]">Record Payment</p>

                    <div>
                      <label className="block text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-1">
                        Amount (max ₹{balance})
                      </label>
                      <input
                        type="number"
                        className="w-full bg-[#18181c] border border-[#2e2e38] text-[#f0ede8] rounded-lg
                          px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#f0c040] transition-colors"
                        placeholder={`₹${balance}`}
                        value={payForm.amount}
                        onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-1">Method</label>
                      <div className="grid grid-cols-4 gap-2">
                        {METHODS.map((m) => (
                          <button key={m} onClick={() => setPayForm((f) => ({ ...f, method: m }))}
                            className={`py-2 rounded-lg text-[12px] font-semibold border capitalize transition-colors
                              ${payForm.method === m
                                ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                                : 'bg-[#18181c] border-[#2e2e38] text-[#8a8a9a]'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {payForm.method === 'upi' && (
                      <div>
                        <label className="block text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-1">UTR / Ref No.</label>
                        <input
                          className="w-full bg-[#18181c] border border-[#2e2e38] text-[#f0ede8] rounded-lg
                            px-3 py-2.5 text-[14px] placeholder:text-[#8a8a9a] focus:outline-none focus:border-[#f0c040] transition-colors"
                          placeholder="Enter UTR number"
                          value={payForm.ref}
                          onChange={(e) => setPayForm((f) => ({ ...f, ref: e.target.value }))}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-[#8a8a9a] uppercase tracking-wider mb-1">Note (optional)</label>
                      <input
                        className="w-full bg-[#18181c] border border-[#2e2e38] text-[#f0ede8] rounded-lg
                          px-3 py-2.5 text-[14px] placeholder:text-[#8a8a9a] focus:outline-none focus:border-[#f0c040] transition-colors"
                        placeholder="e.g. advance payment"
                        value={payForm.note}
                        onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setAddingPayment(false)}
                        className="flex-1 py-3 rounded-lg bg-[#18181c] border border-[#2e2e38]
                          text-[#8a8a9a] font-medium hover:border-red-400/50 hover:text-red-400 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleAddPayment} disabled={savingPayment}
                        className="flex-1 py-3 rounded-lg bg-green-500 text-white font-semibold
                          hover:bg-green-400 transition-colors disabled:opacity-50
                          flex items-center justify-center gap-2">
                        {savingPayment ? <Spinner /> : null}
                        {savingPayment ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment log entries */}
                {paymentLogs.length === 0 ? (
                  <div className="text-center py-8 text-[#8a8a9a]">
                    <div className="text-3xl mb-2">💸</div>
                    <p className="text-[13px]">No payments recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-[#8a8a9a] uppercase tracking-widest">Payment History</p>
                    {paymentLogs.map((log, idx) => (
                      <div key={log.id}
                        className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3
                          flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-400/15 flex items-center justify-center
                            text-[11px] font-bold text-green-400 shrink-0">
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="text-[15px] font-bold text-green-400">₹{log.amount}</p>
                            <p className="text-[11px] text-[#8a8a9a] capitalize">
                              {log.method}
                              {log.ref && ` · ${log.ref}`}
                            </p>
                            {log.note && <p className="text-[11px] text-[#8a8a9a] italic">{log.note}</p>}
                            <p className="text-[10px] text-[#8a8a9a] mt-0.5">{fmtDate(log.date)}</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeletePayment(log.id)} disabled={deletingId === log.id}
                          className="text-[#8a8a9a] hover:text-red-400 transition-colors disabled:opacity-40 shrink-0 p-1">
                          {deletingId === log.id ? <Spinner /> : '🗑'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={handleClose}
                  className="w-full py-3.5 rounded-xl bg-[#222228] border border-[#2e2e38]
                    text-[#f0ede8] font-medium hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
  </svg>
}