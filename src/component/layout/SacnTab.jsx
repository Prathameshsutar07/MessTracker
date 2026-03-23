import { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import {
  getCustomerById, getEntriesForCustomer,
  markEntry, isMealMarked, isActive, getMealStats, today, fmtDate,
} from '../../utils/api'
import Calendar from './Calendar'
import StatusPill from './StatusPill'

// const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function ScanTab({ onToast }) {
  const [scanning,  setScanning]  = useState(false)
  const [manualId,  setManualId]  = useState('')
  const [customer,  setCustomer]  = useState(null)
  const [entries,   setEntries]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [marking,   setMarking]   = useState(null) // 'lunch' | 'dinner' | null

  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)

  const stopScan = useCallback(() => {
    setScanning(false)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const loadCustomer = useCallback(async (id) => {
    const clean = id.trim().toUpperCase()
    setLoading(true)
    try {
      const c = await getCustomerById(clean)
      if (!c) { onToast('Customer not found', 'err'); return }
      const e = await getEntriesForCustomer(c.id)
      setCustomer(c)
      setEntries(e)
      stopScan()
    } catch (err) {
      onToast('Error: ' + err.message, 'err')
    } finally {
      setLoading(false)
    }
  }, [stopScan, onToast])

  const startScan = useCallback(async () => {
    setCustomer(null)
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      await new Promise((r) => setTimeout(r, 100))
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      const tick = () => {
        const v = videoRef.current; const c = canvasRef.current
        if (!v || !c) return
        if (v.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return }
        c.width = v.videoWidth; c.height = v.videoHeight
        const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0)
        const img = ctx.getImageData(0, 0, c.width, c.height)
        const code = jsQR(img.data, img.width, img.height)
        if (code) { loadCustomer(code.data); return }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      onToast('Camera not available', 'err'); setScanning(false)
    }
  }, [loadCustomer, onToast])

  useEffect(() => () => stopScan(), [stopScan])

  const handleMark = async (meal) => {
    if (!customer || marking) return
    setMarking(meal)
    try {
      const result = await markEntry(customer, entries, meal)
      if (result === 'ok') {
        const updated = await getEntriesForCustomer(customer.id)
        setEntries(updated)
        onToast(`${meal === 'lunch' ? '🌤 Lunch' : '🌙 Dinner'} marked!`, 'ok')
      } else if (result === 'duplicate') {
        onToast(`${meal === 'lunch' ? 'Lunch' : 'Dinner'} already marked today`, 'err')
      } else if (result === 'exhausted') {
        onToast('All meals used up in this plan', 'err')
      } else if (result === 'expired') {
        onToast('Plan has expired', 'err')
      }
    } catch (err) {
      onToast('Error: ' + err.message, 'err')
    } finally {
      setMarking(null)
    }
  }

  const stats        = customer ? getMealStats(customer, entries) : null
  const lunchMarked  = isMealMarked(entries, 'lunch')
  const dinnerMarked = isMealMarked(entries, 'dinner')
  const active       = customer ? isActive(customer, entries.length) : false
  // const now          = new Date()
  const daysLeft     = customer ? Math.max(0, Math.ceil((new Date(customer.endDate) - new Date(today())) / 86400000)) : 0

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <div className="text-[22px] font-semibold tracking-tight"><span className="text-[#f0c040]">Mess</span>Track</div>
        <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">Scan QR</span>
      </div>

      <div className="p-5">
        {!customer ? (
          <>
            {loading && (
              <div className="flex items-center justify-center py-16 text-[#8a8a9a] gap-3">
                <Spinner /> Looking up customer…
              </div>
            )}
            {!loading && scanning ? (
              <>
                <div className="relative aspect-square w-full bg-[#18181c] border-2 border-dashed border-[#2e2e38] rounded-xl overflow-hidden">
                  <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="scan-frame relative w-3/5 h-3/5 border-2 border-[#f0c040] rounded-lg" />
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <p className="text-center text-[13px] text-[#8a8a9a] mt-3 mb-4">Point camera at customer QR code</p>
                <button onClick={stopScan} className="w-full bg-[#222228] border border-[#2e2e38] text-[#f0ede8] font-medium rounded-lg py-3.5 hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">Cancel</button>
              </>
            ) : !loading && (
              <>
                <button onClick={startScan} className="w-full bg-[#f0c040] text-[#0f0f11] font-semibold rounded-lg py-3.5 text-[15px] mb-4 hover:bg-[#f5d060] transition-all flex items-center justify-center gap-2">
                  <CameraIcon /> Open Camera to Scan
                </button>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#2e2e38]" />
                  <span className="text-[12px] text-[#8a8a9a]">or enter ID manually</span>
                  <div className="flex-1 h-px bg-[#2e2e38]" />
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#222228] border border-[#2e2e38] text-[#f0ede8] rounded-lg px-3.5 py-3 text-[15px] placeholder:text-[#8a8a9a] uppercase focus:outline-none focus:border-[#f0c040] transition-colors font-mono tracking-wider"
                    placeholder="Customer ID"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCustomer(manualId)}
                  />
                  <button onClick={() => loadCustomer(manualId)} className="px-5 bg-[#222228] border border-[#2e2e38] text-[#f0ede8] rounded-lg font-medium hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">Go</button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl p-5 mb-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full flex items-center justify-center text-xl font-bold text-[#0f0f11] shrink-0"
                  style={{ background: 'linear-gradient(135deg,#f0c040,#e8794a)', width: 48, height: 48 }}>
                  {customer.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[18px] font-semibold truncate">{customer.name}</p>
                    <StatusPill active={active} />
                  </div>
                  <p className="text-[13px] text-[#8a8a9a]">📱 {customer.mobile}</p>
                </div>
              </div>

              {/* Quota bar */}
              <div className="mb-4">
                <div className="flex justify-between text-[12px] mb-1.5">
                  <span className="text-[#8a8a9a]">Meals used</span>
                  <span className="font-semibold">
                    <span className={stats.remaining === 0 ? 'text-red-400' : 'text-[#f0c040]'}>{stats.used}</span>
                    <span className="text-[#8a8a9a]"> / {customer.totalMeals}</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${stats.percent >= 90 ? 'bg-red-400' : stats.percent >= 70 ? 'bg-[#e8794a]' : 'bg-[#f0c040]'}`}
                    style={{ width: `${stats.percent}%` }} />
                </div>
                <div className="flex justify-between text-[11px] mt-1">
                  <span className="text-[#8a8a9a]">{stats.remaining} meals remaining</span>
                  <span className="text-[#8a8a9a]">{daysLeft} days left</span>
                </div>
              </div>

              <div className="text-[12px] text-[#8a8a9a] mb-4">📅 {fmtDate(customer.startDate)} → {fmtDate(customer.endDate)}</div>

              <div className="border-t border-[#2e2e38] pt-4">
                {!active && stats.remaining === 0 && (
                  <div className="bg-red-400/10 border border-red-400/25 rounded-lg px-4 py-3 text-[13px] text-red-400 text-center mb-3">
                    All {customer.totalMeals} meals have been used
                  </div>
                )}
                {!active && stats.remaining > 0 && (
                  <div className="bg-red-400/10 border border-red-400/25 rounded-lg px-4 py-3 text-[13px] text-red-400 text-center mb-3">
                    Plan expired on {fmtDate(customer.endDate)}
                  </div>
                )}
                {active && (
                  <div className="grid grid-cols-2 gap-3">
                    <MealButton label="Lunch"  icon="🌤" marked={lunchMarked}  loading={marking==='lunch'}  color="yellow" onClick={() => handleMark('lunch')} />
                    <MealButton label="Dinner" icon="🌙" marked={dinnerMarked} loading={marking==='dinner'} color="orange" onClick={() => handleMark('dinner')} />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#18181c] border border-[#2e2e38] rounded-xl p-4 mb-4">
              <Calendar entries={entries} />
            </div>

            <button onClick={() => setCustomer(null)}
              className="w-full bg-[#222228] border border-[#2e2e38] text-[#f0ede8] font-medium rounded-lg py-3.5 hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">
              ← Scan Another
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MealButton({ label, icon, marked, loading, color, onClick }) {
  const y = color === 'yellow'
  return (
    <button onClick={onClick} disabled={marked || loading}
      className={`flex flex-col items-center gap-1.5 py-4 rounded-xl border text-[13px] font-semibold transition-all
        ${marked
          ? y ? 'bg-[#f0c040]/10 border-[#f0c040]/40 text-[#f0c040] cursor-default'
              : 'bg-[#e8794a]/10 border-[#e8794a]/40 text-[#e8794a] cursor-default'
          : y ? 'bg-[#222228] border-[#2e2e38] text-[#f0ede8] hover:border-[#f0c040] hover:text-[#f0c040] active:scale-[.97]'
              : 'bg-[#222228] border-[#2e2e38] text-[#f0ede8] hover:border-[#e8794a] hover:text-[#e8794a] active:scale-[.97]'
        }`}>
      {loading ? <Spinner /> : <span className="text-2xl">{icon}</span>}
      {marked ? `✓ ${label} Marked` : loading ? 'Saving…' : `Mark ${label}`}
    </button>
  )
}

function CameraIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}

function Spinner() {
  return <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
}