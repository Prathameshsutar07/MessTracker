import { useState, useEffect } from 'react'
import StatusPill from './StatusPill'
import Calendar from './Calendar'
import { isActive, fmtDate, getMealStats, getCustomers, getEntriesForCustomer } from '../../utils/api'

export default function CustomersTab({ onToast }) {
  const [customers,         setCustomers]         = useState([])
  const [selectedCustomer,  setSelectedCustomer]  = useState(null)
  const [entries,           setEntries]           = useState([])
  const [loadingList,       setLoadingList]       = useState(true)
  const [loadingDetail,     setLoadingDetail]     = useState(false)
  const [search,            setSearch]            = useState('')

  useEffect(() => {
    setLoadingList(true)
    getCustomers()
      .then(setCustomers)
      .catch((err) => onToast('Failed to load customers: ' + err.message, 'err'))
      .finally(() => setLoadingList(false))
  }, [onToast])

  const handleSelectCustomer = async (c) => {
    setLoadingDetail(true)
    setSelectedCustomer(c)
    try {
      const e = await getEntriesForCustomer(c.id)
      setEntries(e)
    } catch (err) {
      onToast('Failed to load entries: ' + err.message, 'err')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleClose = () => { setSelectedCustomer(null); setEntries([]) }

  const stats       = selectedCustomer ? getMealStats(selectedCustomer, entries) : null
  const lunchCount  = entries.filter((e) => e.meal === 'lunch').length
  const dinnerCount = entries.filter((e) => e.meal === 'dinner').length

  return (
    <div className="p-4">
      <div className="flex items-center justify-between px-5 pt-6 pb-2">
        <span className="font-mono text-[10px] bg-[#222228] border border-[#2e2e38] text-[#8a8a9a] px-2.5 py-1 rounded-full">Customers</span>
      </div>
      {/* search and list code... */}
      <input className="w-full bg-[#222228] border border-[#2e2e38] text-[#f0ede8] rounded-lg
        px-3.5 py-3 text-[15px] placeholder-[#8a8a9a] mb-4
        focus:outline-none focus:border-[#f0c040] focus:ring-2 focus:ring-[#f0c040]/10 transition-colors"
        placeholder="Search by name, mobile or ID…" value={search} onChange={(e) => setSearch(e.target.value)} /> 

      {loadingList ? (
        <div className="flex items-center justify-center py-16 text-[#8a8a9a] gap-3">
          <Spinner /> Loading customers…
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-[#8a8a9a]">
          <div className="text-4xl mb-3">🍽</div>
          <p>No customers yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {customers.filter((c) => {
            const searchLower = search.toLowerCase()
            return (
              c.name.toLowerCase().includes(searchLower) ||
              c.mobile.includes(search) ||
              c.id.includes(search)
            )
          }).map((c) => {
            // const cEntries = [] // list view uses lightweight data — entries loaded on open
            // const active   = isActive(c, 0)
            // const used     = 0  // shown after open
            return (
              <div key={c.id} onClick={() => handleSelectCustomer(c)}
                className="bg-[#18181c] border border-[#2e2e38] p-4 rounded-xl cursor-pointer hover:border-[#4a4a5a] transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[17px] font-semibold">{c.name}</p>
                    <p className="font-mono text-[20px] text-[#8a8a9a]">{c.id}</p>
                  </div>
                  <StatusPill active={isActive(c, 0)} />
                </div>
                <div className="flex justify-between text-[11px] text-[#8a8a9a] mb-1">
                  <span>Plan: {c.totalMeals} meals</span>
                  <span>📅 {fmtDate(c.endDate)}</span>
                </div>
                <p className="text-[12px] text-[#8a8a9a]">📱 {c.mobile}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Calendar modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50"
          onClick={(e) => e.target === e.currentTarget && handleClose()}>
          <div className="bg-[#18181c] rounded-t-2xl w-full max-h-[90vh] overflow-y-auto p-5 pb-10">
            <div className="w-10 h-1 bg-[#2e2e38] rounded-full mx-auto mb-5" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedCustomer.name}</h2>
                <p className="font-mono text-[11px] text-[#8a8a9a] mt-0.5">{selectedCustomer.id}</p>
                <p className="text-[13px] text-[#8a8a9a] mt-1">📱 {selectedCustomer.mobile}</p>
                <p className="text-[13px] text-[#8a8a9a]">📅 {fmtDate(selectedCustomer.startDate)} → {fmtDate(selectedCustomer.endDate)}</p>
              </div>
              <StatusPill active={isActive(selectedCustomer, entries.length)} />
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12 text-[#8a8a9a] gap-3"><Spinner /> Loading entries…</div>
            ) : (
              <>
                {/* Quota bar */}
                <div className="bg-[#222228] border border-[#2e2e38] rounded-xl px-4 py-3 mb-4">
                  <div className="flex justify-between text-[13px] mb-2">
                    <span className="text-[#8a8a9a]">Meal quota</span>
                    <span className="font-semibold">
                      <span className={stats.remaining === 0 ? 'text-red-400' : 'text-[#f0c040]'}>{stats.used}</span>
                      <span className="text-[#8a8a9a]"> / {selectedCustomer.totalMeals}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#2e2e38] rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full transition-all ${stats.percent >= 90 ? 'bg-red-400' : stats.percent >= 70 ? 'bg-[#e8794a]' : 'bg-[#f0c040]'}`}
                      style={{ width: `${stats.percent}%` }} />
                  </div>
                  <p className="text-[11px] text-[#8a8a9a]">{stats.remaining} meals remaining</p>
                </div>

                {/* Lunch / Dinner counts */}
                <div className="grid grid-cols-2 gap-3 mb-4">
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

                {/* Calendar */}
                <div className="bg-[#222228] border border-[#2e2e38] rounded-xl p-4 mb-5">
                  <Calendar entries={entries} />
                </div>
              </>
            )}

            <button onClick={handleClose}
              className="w-full py-3.5 rounded-xl bg-[#222228] border border-[#2e2e38] text-[#f0ede8] font-medium hover:border-[#f0c040] hover:text-[#f0c040] transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
}
