import { useState } from 'react'
import QRCode from 'qrcode'
import { addCustomer, today, fmtDate, addDays } from '../../utils/api'
import QRDisplay from './QRDisplay'

const inputCls = `w-full bg-[#222228] border border-[#2e2e38] text-[#f0ede8] rounded-lg
  px-3.5 py-3 text-[15px] placeholder:text-[#8a8a9a]
  focus:outline-none focus:border-[#f0c040] transition-colors`

export default function AddCustomer({ onToast }) {
  const [form, setForm] = useState({ name: '', mobile: '', startDate: today(), totalMeals: '30' })
  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const previewEndDate = form.startDate ? addDays(form.startDate, 44) : ''

  const handleSubmit = async () => {
    if (!form.name.trim()) { onToast('Enter customer name', 'err'); return }
    if (!form.mobile.trim()) { onToast('Enter mobile number', 'err'); return }
    if (!form.startDate) { onToast('Select start date', 'err'); return }
    setLoading(true)
    try {
      const c = await addCustomer(form)
      setCreated(c)
      setForm({ name: '', mobile: '', startDate: today(), totalMeals: '30' })
      onToast('Customer added!', 'ok')
    } catch (err) {
      onToast('Failed to save: ' + err.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    QRCode.toDataURL(created.id, { width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' } }, (err, url) => {
      if (err) return
      const a = document.createElement('a')
      a.download = `${created.id}-qr.png`
      a.href = url
      a.click()
    })
  }

  if (created) return (
    <div className="flex-1 overflow-y-auto">
      <Header badge="QR Generated" />
      <div className="p-5">
        <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl p-4 mb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[17px] font-semibold">{created.name}</p>
              <p className="font-mono text-[11px] text-[#8a8a9a]">{created.id}</p>
            </div>
            <span className="bg-green-400/20 text-green-400 border border-green-400/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            {[
              ['Plan', `${created.totalMeals} Meals`, 'text-[#f0c040]'],
              ['Validity', '45 Days', ''],
              ['Start', fmtDate(created.startDate), ''],
              ['Expires', fmtDate(created.endDate), ''],
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

        <div className="flex flex-col items-center py-2 mb-5">
          <div className="bg-white p-4 rounded-xl mb-3"><QRDisplay value={created.id} size={200} /></div>
          <p className="font-mono text-[12px] text-[#8a8a9a]">ID: {created.id}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setCreated(null)} className="flex-1 bg-[#222228] border border-[#2e2e38] text-[#f0ede8] font-medium rounded-lg py-3.5 hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">Add Another</button>
          <button onClick={downloadQR} className="flex-1 bg-[#f0c040] text-[#0f0f11] font-semibold rounded-lg py-3.5 hover:bg-[#f5d060] transition-all">Download QR</button>
          {/* share QR on whatsapp with a QR image */}
          <button
            onClick={async () => {
              try {
                // Generate QR as data URL
                const qrDataUrl = await QRCode.toDataURL(created.id)

                // Convert to Blob
                const blob = await fetch(qrDataUrl).then((res) => res.blob())

                // Create file
                const file = new File([blob], `${created.id}-qr.png`, {
                  type: 'image/png',
                })

                const shareText = `🍽️ Mess QR Code

                Name: ${created.name}
                Plan: ${created.totalMeals} meals

                Scan or open:
                ${window.location.origin}/qr/${created.id}`

                // Check if Web Share API supports files
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    title: 'Mess QR Code',
                    text: shareText,
                    files: [file],
                  })
                } else if (navigator.share) {
                  // Fallback (without file)
                  await navigator.share({
                    title: 'Mess QR Code',
                    text: shareText,
                    url: `${window.location.origin}/qr/${created.id}`,
                  })
                } else {
                  // Final fallback (open WhatsApp with text)
                  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
                  window.open(url, '_blank')
                }
              } catch (err) {
                console.error('Share failed:', err)
              }
            }}
            className="flex-1 bg-[#25D366] text-white font-semibold rounded-lg py-3.5 hover:bg-[#1ebe5b] transition-all"
          >
            Share QR
          </button>
        </div>
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
            <p className="text-[12px] text-[#8a8a9a] mt-1.5">📅 Expires <span className="text-[#f0c040] font-medium">{fmtDate(previewEndDate)}</span> (45 days)</p>
          )}
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8a8a9a] tracking-widest uppercase mb-2">Meal Plan</label>
          <div className="grid grid-cols-2 gap-3">
            {[['30', '🥗', '~1 meal/day'], ['60', '🍱', '~2 meals/day']].map(([n, icon, hint]) => (
              <button key={n} onClick={() => setForm((f) => ({ ...f, totalMeals: n }))}
                className={`flex flex-col items-center py-4 rounded-xl border font-semibold transition-all
                  ${form.totalMeals === n
                    ? 'bg-[#f0c040]/20 border-[#f0c040] text-[#f0c040]'
                    : 'bg-[#222228] border-[#2e2e38] text-[#8a8a9a] hover:border-[#4a4a5a]'}`}>
                <span className="text-2xl mb-1">{icon}</span>
                <span className="text-[20px] font-bold">{n}</span>
                <span className="text-[11px] mt-0.5 opacity-80">Meals</span>
                <span className="text-[10px] mt-1 opacity-60">{hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3 text-[13px] text-[#8a8a9a]">
          <span className="text-[#f0ede8] font-medium">{form.totalMeals} meals</span> over 45 days
          {previewEndDate && <> · expires <span className="text-[#f0c040]">{fmtDate(previewEndDate)}</span></>}
        </div>
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-[#f0c040] text-[#0f0f11] font-semibold rounded-lg py-3.5 text-[15px] hover:bg-[#f5d060] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? <Spinner /> : null}
          {loading ? 'Saving...' : 'Generate QR Code'}
        </button>
      </div>
    </div>
  )
}

function Header({ badge }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-2">
      <div className="text-[22px] font-semibold tracking-tight"><span className="text-[#f0c040]">Mess</span>Track</div>
      <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">{badge}</span>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
