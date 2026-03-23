import { useEffect } from 'react'

export default function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      className={`toast-anim fixed top-16 left-1/2 z-50 whitespace-nowrap rounded-xl px-5 py-3
        text-sm font-medium shadow-2xl border
        bg-[#18181c]
        ${type === 'ok'
          ? 'border-green-400/60 text-green-400'
          : 'border-red-400/60 text-red-400'
        }`}
    >
      {msg}
    </div>
  )
}
