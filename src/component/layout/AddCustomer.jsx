import { useState } from 'react'
import QRCode from 'qrcode'
import { addCustomer, today, fmtDate, addDays, currentHotelConfig, addPaymentLog } from '../../utils/api'
import QRDisplay from './QRDisplay'
import PaymentBadge from './PaymentBadge'

const METHODS = ['cash', 'upi', 'card', 'other']

const inputCls = `w-full bg-[#222228] border border-[#2e2e38] text-[#f0ede8] rounded-lg
  px-3.5 py-3 text-[15px] placeholder:text-[#8a8a9a]
  focus:outline-none focus:border-[#f0c040] transition-colors`

// Build the secure dashboard link for a created customer
function dashboardLink(c) {
  return `${window.location.origin}/dashboard/${c.id}?token=${c.accessToken}`
}

export default function AddCustomer({ onToast }) {
  const plans = currentHotelConfig?.plans || [{ meals: 30, price: 1500 }, { meals: 60, price: 2800 }]
  const expiryDays = currentHotelConfig?.expiryDays || 45

  const [form,    setForm]    = useState({ name: '', mobile: '', startDate: today(), totalMeals: String(plans[0].meals) })
  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [amountPaid, setAmountPaid] = useState(0)
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', ref: '', note: '' })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const previewEndDate = form.startDate ? addDays(form.startDate, expiryDays - 1) : ''
  const selectedPlan = plans.find(p => String(p.meals) === form.totalMeals) || plans[0]
  const planPrice = selectedPlan.price

  const handleSubmit = async () => {
    if (!form.name.trim())   { onToast('Enter customer name', 'err'); return }
    if (!form.mobile.trim()) { onToast('Enter mobile number', 'err'); return }
    if (!form.startDate)     { onToast('Select start date', 'err'); return }
    setLoading(true)
    try {
      const c = await addCustomer(form)
      setCreated(c)
      setAmountPaid(0)
      setAddingPayment(false)
      setPayForm({ amount: String(c.paymentAmount), method: 'cash', ref: '', note: '' })
      setForm({ name: '', mobile: '', startDate: today(), totalMeals: '30' })
      onToast('Customer added!', 'ok')
    } catch (err) {
      onToast('Failed to save: ' + err.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPayment = async () => {
    const amt = Number(payForm.amount)
    if (!amt || amt <= 0) { onToast('Enter a valid amount', 'err'); return }
    const due = Number(created.paymentAmount)
    if (amountPaid + amt > due) {
      onToast(`Amount exceeds balance due ₹${due - amountPaid}`, 'err'); return
    }
    setSavingPayment(true)
    try {
      await addPaymentLog(created.id, payForm)
      setAmountPaid((prev) => prev + amt)
      setPayForm({ amount: '', method: 'cash', ref: '', note: '' })
      setAddingPayment(false)
      onToast('Payment recorded!', 'ok')
    } catch (err) {
      onToast('Failed: ' + err.message, 'err')
    } finally {
      setSavingPayment(false)
    }
  }

  // QR encodes only the customer ID — scanned by staff in Scan tab to mark meals
  const downloadQR = () => {
    QRCode.toDataURL(created.id, {
      width: 512, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }, (err, url) => {
      if (err) return
      const a = document.createElement('a')
      a.download = `${created.id}-qr.png`
      a.href = url
      a.click()
    })
  }

  // ── Share on WhatsApp with QR image attached ──────────────
  const handleShare = async () => {
    const text = `🍽️ Meal Plan Activated

Hi ${created.name}!

📋 Plan: ${created.totalMeals} meals · ${expiryDays} days
📅 Valid till: ${fmtDate(created.endDate)}
💰 Amount: ₹${created.paymentAmount}
🪪 Customer ID: ${created.id}
Access your dashboard here: ${dashboardLink(created)}

Please carry your QR card when visiting the mess.`

    try {
      // Generate QR as a PNG data URL first
      const qrDataUrl = await QRCode.toDataURL(created.id, {
        width: 512,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      })

      // Convert data URL → Blob → File so it can be passed to Web Share API
      const blob = await fetch(qrDataUrl).then((r) => r.blob())
      const file = new File([blob], `${created.id}-qr.png`, { type: 'image/png' })

      // Best path: Web Share API with file support
      // Works on Android Chrome 89+, iOS Safari 15.1+
      // Opens native share sheet with QR image AND text pre-loaded → user picks WhatsApp
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Meal Plan QR', text, files: [file] })
        return
      }

      // Fallback A: Web Share API without file (text only)
      if (navigator.share) {
        await navigator.share({ title: 'Meal Plan', text })
        return
      }

      // Fallback B: Desktop — auto-download the QR image, then open WhatsApp web
      // WhatsApp web can't receive images programmatically, so we download it first
      // so the user can manually attach it in the chat that opens
      downloadQR()
      setTimeout(() => {
        window.open(
          `https://wa.me/${created.mobile.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`,
          '_blank'
        )
      }, 600)
    } catch (err) {
      if (err.name !== 'AbortError') onToast('Share failed', 'err')
    }
  }

  const balance = created ? Math.max(0, Number(created.paymentAmount) - amountPaid) : 0
  const payStatus = balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending'

  if (created) return (
    <div className="flex-1 overflow-y-auto">
      <Header badge="Customer Added" />
      <div className="p-5 space-y-4">

        {/* Summary card */}
        <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[17px] font-semibold">{created.name}</p>
              <p className="font-mono text-[11px] text-[#8a8a9a]">{created.id}</p>
            </div>
            <PaymentBadge status={payStatus} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            {[
              ['Plan',    `${created.totalMeals} Meals`, 'text-[#f0c040]'],
              ['Amount',  `₹${created.paymentAmount}`,   'text-[#f0c040]'],
              ['Start',   fmtDate(created.startDate),    ''],
              ['Expires', fmtDate(created.endDate),      ''],
            ].map(([label, val, cls]) => (
              <div key={label} className="bg-[#222228] rounded-lg px-3 py-2">
                <p className="text-[#8a8a9a] text-[11px] uppercase tracking-wider mb-0.5">{label}</p>
                <p className={`font-semibold ${cls}`}>{val}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 bg-[#222228] rounded-lg px-3 py-2">
            <p className="text-[#8a8a9a] text-[11px] uppercase tracking-wider mb-0.5">Mobile</p>
            <p className="font-semibold">📱 {created.mobile}</p>
          </div>
        </div>

        {/* Payment Section */}
        {balance > 0 && !addingPayment && (
          <div className="bg-yellow-400/8 border border-yellow-400/25 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-[13px] font-semibold mb-0.5">⏳ Payment Pending</p>
              <p className="text-[#8a8a9a] text-[12px]">
                Balance: ₹{balance}
              </p>
            </div>
            <button onClick={() => { setAddingPayment(true); setPayForm({ amount: String(balance), method: 'cash', ref: '', note: '' }) }}
              className="py-1.5 px-3 rounded-lg bg-yellow-400/20 text-yellow-500 font-semibold text-[13px]
                hover:bg-yellow-400/30 transition-colors">
              Collect
            </button>
          </div>
        )}

        {balance === 0 && (
          <div className="bg-green-400/8 border border-green-400/25 rounded-xl px-4 py-3 flex items-center gap-2">
             <span className="text-xl">✅</span>
             <div>
               <p className="text-green-400 text-[13px] font-semibold mb-0.5">Payment Completed</p>
               <p className="text-green-400/70 text-[12px]">Amount paid: ₹{amountPaid}</p>
             </div>
          </div>
        )}

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

        {/* QR code */}
        <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl p-4">
          <p className="text-[12px] font-semibold text-[#8a8a9a] uppercase tracking-widest mb-1">Meal Entry QR</p>
          <p className="text-[11px] text-[#8a8a9a] mb-3">Staff scans this to mark lunch / dinner</p>
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl mb-2">
              <QRDisplay value={created.id} size={180} />
            </div>
            <p className="font-mono text-[11px] text-[#8a8a9a]">{created.id}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={downloadQR}
            className="py-3.5 rounded-lg bg-[#f0c040] text-[#0f0f11] font-semibold
              hover:bg-[#f5d060] transition-all text-[14px]">
            Download QR
          </button>
          <button onClick={handleShare}
            className="py-3.5 rounded-lg bg-[#25D366] text-white font-semibold
              hover:bg-[#1ebe5b] transition-all text-[14px]">
            Share via WhatsApp
          </button>
        </div>

        <button onClick={() => setCreated(null)}
          className="w-full py-3.5 rounded-lg bg-[#222228] border border-[#2e2e38]
            text-[#f0ede8] font-medium hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">
          Add Another Customer
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <Header badge="Add Customer" />
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-[#8a8a9a] tracking-widest uppercase mb-1.5">Full Name</label>
          <input className={inputCls} placeholder="e.g. Ravi Kumar" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8a8a9a] tracking-widest uppercase mb-1.5">Mobile Number</label>
          <input type="tel" className={inputCls} placeholder="+91 98765 43210" value={form.mobile} onChange={set('mobile')} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8a8a9a] tracking-widest uppercase mb-1.5">Start Date</label>
          <input type="date" className={inputCls} value={form.startDate} onChange={set('startDate')} />
          {previewEndDate && (
            <p className="text-[12px] text-[#8a8a9a] mt-1.5">
              📅 Expires <span className="text-[#f0c040] font-medium">{fmtDate(previewEndDate)}</span> ({expiryDays} days)
            </p>
          )}
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8a8a9a] tracking-widest uppercase mb-2">Meal Plan</label>
          <div className="grid grid-cols-2 gap-3">
            {plans.map((p) => {
              const n = String(p.meals)
              return (
                <button key={n} onClick={() => setForm((f) => ({ ...f, totalMeals: n }))}
                  className={`flex flex-col items-center py-4 rounded-xl border font-semibold transition-all
                    ${form.totalMeals === n
                      ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                      : 'bg-[#222228] border-[#2e2e38] text-[#8a8a9a] hover:border-[#4a4a5a]'}`}>
                  <span className="text-2xl mb-1">{Number(n) > 40 ? '🍱' : '🥗'}</span>
                  <span className="text-[20px] font-bold">{n}</span>
                  <span className="text-[11px] mt-0.5 opacity-80">Meals</span>
                  <span className="text-[11px] font-bold mt-1 text-[#f0c040]">₹{p.price}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3 text-[13px]">
          <div className="flex justify-between">
            <span className="text-[#8a8a9a]">{form.totalMeals} meals · {expiryDays} days</span>
            <span className="text-[#f0c040] font-bold">₹{planPrice}</span>
          </div>
          {previewEndDate && (
            <p className="text-[#8a8a9a] text-[12px] mt-1">
              Expires <span className="text-[#f0ede8]">{fmtDate(previewEndDate)}</span>
            </p>
          )}
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-[#f0c040] text-[#0f0f11] font-semibold rounded-lg py-3.5 text-[15px]
            hover:bg-[#f5d060] transition-all disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2">
          {loading && <Spinner />}
          {loading ? 'Saving...' : 'Add Customer'}
        </button>
      </div>
    </div>
  )
}

function Header({ badge }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-2">
      <div className="text-[22px] font-semibold tracking-tight">
        <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">Add Customer</span>
      </div>
      <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">
        {badge}
      </span>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  )
}