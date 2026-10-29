/** Round avatar coloured from the wallet address, so the same wallet always looks the same. */
export function Avatar({ address, size = 44 }: { address: string; size?: number }) {
  const hex = address.replace(/^0x/, '').toLowerCase()
  const h1 = parseInt(hex.slice(0, 4) || '0', 16) % 360
  const h2 = (h1 + 48) % 360
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display text-sm font-semibold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${h1} 65% 45%), hsl(${h2} 70% 38%))` }}
      aria-hidden="true"
    >
      {hex.slice(0, 2).toUpperCase()}
    </span>
  )
}
