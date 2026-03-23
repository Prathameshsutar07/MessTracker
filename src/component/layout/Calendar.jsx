import { useState } from 'react'
import { today } from '../../utils/api'

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function Calendar({ entries = [] }) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr    = today()
  const pad = (n) => String(n).padStart(2, '0')

  // Build map: date -> { lunch: count, dinner: count }
  const mealMap = {}
  entries.forEach(({ date, meal }) => {
    if (!mealMap[date]) mealMap[date] = { lunch: 0, dinner: 0 }
    if (meal === 'lunch')  mealMap[date].lunch  += 1
    if (meal === 'dinner') mealMap[date].dinner += 1
  })

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#18181c] border border-[#2e2e38] text-[#f0ede8] hover:border-[#f0c040] hover:text-[#f0c040] transition-colors text-lg">‹</button>
        <span className="font-semibold text-base">{MONTHS[month]} {year}</span>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#18181c] border border-[#2e2e38] text-[#f0ede8] hover:border-[#f0c040] hover:text-[#f0c040] transition-colors text-lg">›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#8a8a9a] py-1 tracking-wider">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty offset cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const d       = i + 1
          const ds      = `${year}-${pad(month + 1)}-${pad(d)}`
          const meals   = mealMap[ds]
          const isToday = ds === todayStr
          const hasAny  = meals && (meals.lunch > 0 || meals.dinner > 0)
          const hasBoth = meals && meals.lunch > 0 && meals.dinner > 0

          return (
            <div key={d}
              className={`rounded-lg flex flex-col items-center justify-center py-1 gap-0.5
                ${isToday        ? 'ring-1 ring-[#e8794a]' : ''}
                ${hasBoth        ? 'bg-[#f0c040]/15'
                  : hasAny       ? 'bg-[#f0c040]/8'
                  : 'bg-[#18181c]'}
              `}
              style={{ minHeight: 52 }}
            >
              {/* Day number */}
              <span className={`text-[11px] font-semibold leading-none
                ${isToday  ? 'text-[#e8794a]'
                  : hasAny ? 'text-[#f0c040]'
                  : 'text-[#8a8a9a]'}`}>
                {d}
              </span>

              {/* Lunch count */}
              {meals && meals.lunch > 0 && (
                <div className="flex items-center gap-[2px]">
                  <span className="text-[8px] leading-none">🌤</span>
                  <span className="text-[9px] font-bold text-[#f0c040] leading-none">{meals.lunch}</span>
                </div>
              )}

              {/* Dinner count */}
              {meals && meals.dinner > 0 && (
                <div className="flex items-center gap-[2px]">
                  <span className="text-[8px] leading-none">🌙</span>
                  <span className="text-[9px] font-bold text-[#e8794a] leading-none">{meals.dinner}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 pt-3 border-t border-[#2e2e38]">
        <div className="flex items-center gap-1.5 text-[11px] text-[#8a8a9a]">
          <span className="text-[10px]">🌤</span> Lunch count
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#8a8a9a]">
          <span className="text-[10px]">🌙</span> Dinner count
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[#8a8a9a]">
          <div className="w-3 h-3 rounded-sm ring-1 ring-[#e8794a]" /> Today
        </div>
      </div>
    </div>
  )
}