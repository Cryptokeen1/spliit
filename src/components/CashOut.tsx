import { useEffect, useState } from 'react'
import { erc20Abi, isAddress, type Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { Banknote, ExternalLink } from 'lucide-react'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { IS_MAINNET, NETWORK_LABEL } from '@/network'
import { VAULT_ADDRESS } from '@/payoutvault'
import { ARC_ID, GAS_RESERVE, SPLITPAY_ADDRESS, USDC_ADDRESS, useChainTx } from '@/splitpay'
import { TxStatus } from './TxStatus'

const RAMPS = [
  { name: 'MoonPay', note: 'Sell crypto to a bank or card', href: 'https://www.moonpay.com/sell' },
  { name: 'Transak', note: 'Off-ramp to bank accounts', href: 'https://transak.com' },
  { name: 'Ramp', note: 'Sell crypto for cash', href: 'https://ramp.network' },
  { name: 'Coinbase', note: 'Exchange: sell USDC to your bank', href: 'https://www.coinbase.com' },
  { name: 'Kraken', note: 'Exchange: sell USDC to your bank', href: 'https://www.kraken.com' },
]

/**
 * Cash out: sell USDC for local currency. Ramps and exchanges give you a deposit address; this screen
 * sends USDC from your wallet to it. Always confirm the provider accepts USDC on the same network.
 */
export function CashOut({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { address } = useAccount()
  const tx = useChainTx()
  const [to, setTo] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_ID,
    query: { enabled: Boolean(address) },
  })

  useEffect(() => {
    if (tx.isSuccess) {
      void balance.refetch()
      setAmountInput('')
      setConfirmed(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.isSuccess])

  if (!address) return null

  const wallet = balance.data ?? 0n
  const spendable = wallet > GAS_RESERVE ? wallet - GAS_RESERVE : 0n
  let amount: bigint | null = null
  try {
    amount = amountInput.trim() ? parseUsdc(amountInput.trim()) : null
  } catch {
    amount = null
  }

  const blocked = [USDC_ADDRESS, SPLITPAY_ADDRESS, VAULT_ADDRESS, address].map((a) => a.toLowerCase())
  const toOk = isAddress(to) && !blocked.includes(to.toLowerCase())
  let problem = ''
  if (to !== '' && !toOk) problem = isAddress(to) ? 'That is your own wallet or a contract of this app. Use the ramp\'s deposit address.' : 'Enter a valid address.'
  else if (amountInput.trim() !== '' && (amount === null || amount === 0n)) problem = 'Enter an amount above zero.'
  else if (amount !== null && amount > wallet) problem = 'Not enough USDC in your wallet.'
  else if (amount !== null && amount > spendable) problem = `Keep ${formatUsdc(GAS_RESERVE)} USDC for network fees.`

  const busy = tx.isPending || tx.isConfirming
  const canSend = toOk && amount !== null && amount > 0n && !problem && confirmed && !busy

  return (
    <section className="glass space-y-3 rounded-3xl p-5" aria-label="Cash out">
      <button className="flex min-h-[44px] w-full items-center justify-between" aria-expanded={open} onClick={onToggle}>
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <Banknote size={18} /> Cash out
        </span>
        <span className="text-sm text-[color:var(--muted)]">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="space-y-5">
          {!IS_MAINNET && (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900 text-pretty">
              You are on {NETWORK_LABEL}. Test USDC has no cash value and ramps do not accept it. Use this on mainnet.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">1. Pick where to sell</p>
            <p className="text-xs text-[color:var(--muted)] text-pretty">
              Start a sell order with a provider. It shows a deposit address and may ask you to verify your identity. Check that it accepts
              USDC on Arc first. If it does not, bridge your USDC to a network it supports before depositing.
            </p>
            <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl bg-[color:var(--field)]">
              {RAMPS.map((r) => (
                <li key={r.name}>
                  <a className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2" href={r.href} target="_blank" rel="noopener noreferrer">
                    <span>
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="block text-xs text-[color:var(--muted)]">{r.note}</span>
                    </span>
                    <ExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ul>
            <a
              className="text-xs text-[color:var(--muted)] underline"
              href="https://docs.arc.io/integrate/on-off-ramps"
              target="_blank"
              rel="noopener noreferrer"
            >
              Which ramps support Arc (Arc docs)
            </a>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">2. Send USDC to the deposit address</p>
            <input
              className="field font-mono text-sm"
              placeholder="Deposit address from the provider (0x...)"
              value={to}
              onChange={(e) => setTo(e.target.value.trim())}
              spellCheck={false}
              aria-label="Deposit address"
            />
            <div className="flex items-center gap-2">
              <input
                className="field tnum text-lg"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-label="Amount"
              />
              <span className="text-sm font-medium text-[color:var(--muted)]">USDC</span>
            </div>
            <button type="button" className="text-xs text-[color:var(--muted)] underline tnum" onClick={() => setAmountInput(formatUsdc(spendable))}>
              Balance: {formatUsdc(wallet)} USDC (use max, keeps {formatUsdc(GAS_RESERVE)} for fees)
            </button>
            {problem && <p className="text-sm text-red-700">{problem}</p>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span className="text-pretty">
                I checked that this address accepts USDC on {NETWORK_LABEL}. Sending to the wrong address or network can lose the money.
              </span>
            </label>
            <button
              className="btn-primary w-full"
              disabled={!canSend}
              onClick={() => {
                if (amount === null) return
                tx.reset()
                void tx.send({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [to, amount] })
              }}
            >
              {busy ? 'Working...' : 'Send USDC'}
            </button>
            <TxStatus tx={tx} doneText="Sent. The provider pays out once the deposit is confirmed." />
          </div>
        </div>
      )}
    </section>
  )
}
