/** SpleatPay mark: one ring (a payment) divided into shares. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SpleatPay logo" className="shrink-0">
      <rect width="64" height="64" rx="16" fill="#0f1b33" />
      <g fill="none" strokeWidth="8" transform="rotate(-90 32 32)">
        <circle cx="32" cy="32" r="17" stroke="#ffffff" strokeDasharray="55.7 51.1" strokeDashoffset="0" />
        <circle cx="32" cy="32" r="17" stroke="#7f9ccb" strokeDasharray="26.9 79.9" strokeDashoffset="-58.7" />
        <circle cx="32" cy="32" r="17" stroke="#c9a86a" strokeDasharray="15.2 91.6" strokeDashoffset="-88.6" />
      </g>
      <circle cx="32" cy="32" r="4" fill="#ffffff" />
    </svg>
  )
}
