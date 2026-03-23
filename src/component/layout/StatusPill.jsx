export default function StatusPill({ active }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide border
        ${active
          ? 'bg-green-400/15 text-green-400 border-green-400/30'
          : 'bg-red-400/12 text-red-400 border-red-400/30'
        }`}
    >
      {active ? '✓ Active' : '✗ Expired'}
    </span>
  )
}
