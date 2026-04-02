export default function PaymentBadge({ status }) {
  return status === 'paid' ? (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border
      bg-green-400/15 text-green-400 border-green-400/30">
      ✓ Paid
    </span>
  ) : (
    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border
      bg-yellow-400/15 text-yellow-400 border-yellow-400/30">
      ⏳ Pending
    </span>
  )
}