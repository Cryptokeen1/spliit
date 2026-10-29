import { useEffect, useRef, useState } from 'react'
import { erc20Abi, isAddress } from 'viem'
import type { Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { ArrowDownToLine, Banknote, Landmark, LockKeyhole, Plus, Send, ShieldCheck, Store, Wallet, Zap } from 'lucide-react'
import { formatUsdc } from '@/onchain-money'
import { useContacts } from '@/lib/contacts'
import { usePayoutData } from '@/lib/usePayoutData'
import { VAULT_ADDRESS, vaultAbi, vestedAt } from '@/payoutvault'
import { ARC_ID, FEE_BPS, SPLITPAY_ADDRESS, USDC_ADDRESS, splitPayAbi, useChainTx } from '@/splitpay'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { ActivityFeed } from './ActivityFeed'
import { AddMoney } from './AddMoney'
import { CashOut } from './CashOut'
import { AnimatedAmount } from './AnimatedAmount'
import { Avatar } from './Avatar'
import { TxStatus } from './TxStatus'

export type HomeTarget = 'pay' | 'payouts' | 'merchant'

function TrustCard() {
  const rows = [
    { Icon: LockKeyhole, title: 'Your money stays yours', text: 'No one can pause, freeze or redirect your withdrawals. The contracts have no admin.' },
    { Icon: Zap, title: 'One flat fee', text: `${(FEE_BPS / 100).toFixed(1)}% of each payment, shown before you pay. No spreads, no hidden conversions.` },
    { Icon: ShieldCheck, title: 'Rules cannot change', text: 'The contracts are fixed. Only split owners can edit their own split, and only for future payments.' },
  ]
  return (
    <section className="glass space-y-4 rounded-3xl p-5" aria-label="How your money is protected">
      <h2 className="font-display text-lg font-semibold">Built on self-custody</h2>
      <ul className="space-y-3">
        {rows.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[color:var(--field)]">
              <Icon size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-sm text-[color:var(--muted)] text-pretty">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <a
        className="text-sm text-[color:var(--muted)] underline"
        href={buildAddressExplorerUrl(ARC_ID, SPLITPAY_ADDRESS)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read the contract on the explorer
      </a>
    </section>
  )
}

function Action({ label, Icon, onClick, disabled }: { label: string; Icon: typeof Plus; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="action-btn flex min-w-[60px] flex-col items-center gap-2" onClick={onClick} disabled={disabled}>
      <span className="action-circle">
        <Icon size={22} />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function Account({
  title,
  amount,
  caption,
  Icon,
  onClick,
}: {
  title: string
  amount: bigint
  caption: string
  Icon: typeof Wallet
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="grid size-9 place-items-center rounded-full bg-[color:var(--field)]">
        <Icon size={16} />
      </span>
      <span className="mt-6 block text-xs text-[color:var(--muted)]">{title}</span>
      <span className="block font-display text-xl font-semibold tnum">{formatUsdc(amount)}</span>
      <span className="block text-xs text-[color:var(--muted)]">{caption}</span>
    </>
  )
  const cls = 'glass min-w-[160px] shrink-0 scroll-ml-4 snap-start rounded-3xl p-4 text-left'
  return onClick ? (
    <button className={cls} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function HomeTab({ onNavigate }: { onNavigate: (t: HomeTarget) => void }) {
  const { address, isConnected } = useAccount()
  const contacts = useContacts()
  const tx = useChainTx()
  const [custom, setCustom] = useState(false)
  const [dest, setDest] = useState('')
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const cashRef = useRef<HTMLDivElement>(null)
  const [tick, setTick] = useState(0)
  const addRef = useRef<HTMLDivElement>(null)

  const pending = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: splitPayAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_ID,
    query: { enabled: Boolean(address), refetchInterval: 30000 },
  })
  const wallet = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_ID,
    query: { enabled: Boolean(address), refetchInterval: 30000 },
  })
  const vaultBal = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_ID,
    query: { enabled: Boolean(address), refetchInterval: 30000 },
  })
  const payouts = usePayoutData(0)
  const nowSec = Math.floor(Date.now() / 1000)
  const claimable = (payouts.data?.plans ?? []).reduce((sum, p) => {
    if (!address || p.recipient.toLowerCase() !== address.toLowerCase()) return sum
    const open = vestedAt(p, nowSec) - p.claimed
    return open > 0n ? sum + open : sum
  }, 0n)

  useEffect(() => {
    if (tx.isSuccess) {
      void pending.refetch()
      void wallet.refetch()
      setTick((t) => t + 1)
      setWithdrawOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.isSuccess])

  if (!isConnected || !address) {
    const needWallet = () => toast('Connect your wallet first.')
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar address="0x0000000000000000000000000000000000000001" />
          <div className="min-w-0">
            <p className="text-xs text-[color:var(--muted)]">Welcome</p>
            <p className="truncate font-display text-lg font-semibold leading-tight">SpleatPay</p>
          </div>
        </div>

        <section className="space-y-5 text-center" aria-label="Balance">
          <div>
            <p className="text-sm text-[color:var(--muted)]">Total balance</p>
            <p className="mt-1 font-display text-5xl font-semibold tracking-tight">
              <span className="tnum">0.00</span>
              <span className="ml-2 text-xl font-medium text-[color:var(--muted)]">USDC</span>
            </p>
          </div>
          <div className="flex items-start justify-center gap-3">
            <Action label="Add money" Icon={Plus} onClick={needWallet} />
            <Action label="Pay" Icon={Send} onClick={() => onNavigate('pay')} />
            <Action label="Merchant" Icon={Store} onClick={() => onNavigate('merchant')} />
            <Action label="Payouts" Icon={Landmark} onClick={() => onNavigate('payouts')} />
            <Action label="Cash out" Icon={Banknote} onClick={needWallet} />
          </div>
          <div className="flex justify-center">
            <ConnectKitButton label="Connect wallet" />
          </div>
        </section>

        <section aria-label="Accounts" className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Accounts</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            <Account title="Wallet" amount={0n} caption="Connect to see yours" Icon={Wallet} />
            <Account title="Split earnings" amount={0n} caption="Nothing waiting" Icon={ArrowDownToLine} />
            <Account title="Payouts" amount={0n} caption="Escrow, vesting, payroll" Icon={Landmark} />
          </div>
        </section>

        <section aria-label="Transactions" className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Transactions</h2>
          <div className="glass rounded-3xl p-5 text-sm text-[color:var(--muted)]">
            Connect your wallet to see payments to your splits, payments you send and withdrawals.
          </div>
        </section>

        <TrustCard />
      </div>
    )
  }

  const walletAmt = wallet.data ?? 0n
  const splitAmt = pending.data ?? 0n
  const payoutAmt = (vaultBal.data ?? 0n) + claimable
  const total = walletAmt + splitAmt + payoutAmt
  const target = custom ? dest : address
  const targetOk = isAddress(target)
  const busy = tx.isPending || tx.isConfirming

  const onWithdraw = () => {
    if (splitAmt > 0n) {
      tx.reset()
      setWithdrawOpen((v) => !v)
    } else if (payoutAmt > 0n) {
      onNavigate('payouts')
    } else {
      toast('Nothing to withdraw yet.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar address={address} />
        <div className="min-w-0">
          <p className="text-xs text-[color:var(--muted)]">{greeting()}</p>
          <p className="truncate font-display text-lg font-semibold leading-tight">{contacts.label(address)}</p>
        </div>
      </div>

      <section className="space-y-5 text-center" aria-label="Balance">
        <div>
          <p className="text-sm text-[color:var(--muted)]">Total balance</p>
          <p className="mt-1 font-display text-5xl font-semibold tracking-tight">
            {wallet.isLoading ? <span className="tnum">...</span> : <AnimatedAmount raw={total} />}
            <span className="ml-2 text-xl font-medium text-[color:var(--muted)]">USDC</span>
          </p>
        </div>
        <div className="flex items-start justify-center gap-3">
          <Action
            label="Add money"
            Icon={Plus}
            onClick={() => {
              setAddOpen(true)
              setTimeout(() => addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
            }}
          />
          <Action label="Pay" Icon={Send} onClick={() => onNavigate('pay')} />
          <Action label="Merchant" Icon={Store} onClick={() => onNavigate('merchant')} />
          <Action label="Payouts" Icon={Landmark} onClick={() => onNavigate('payouts')} />
          <Action
            label="Cash out"
            Icon={Banknote}
            onClick={() => {
              setCashOpen(true)
              setTimeout(() => cashRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
            }}
          />
        </div>
      </section>

      {withdrawOpen && (
        <section className="glass space-y-3 rounded-3xl p-5" aria-label="Withdraw">
          <p className="font-display text-lg font-semibold">Withdraw {formatUsdc(splitAmt)} USDC</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
            Send to a different address
          </label>
          {custom && (
            <input
              className="field font-mono text-sm"
              placeholder="0x destination address"
              value={dest}
              onChange={(e) => setDest(e.target.value.trim())}
              spellCheck={false}
              aria-label="Destination address"
            />
          )}
          {custom && dest !== '' && !targetOk && <p className="text-sm text-red-700">Enter a valid address.</p>}
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              disabled={splitAmt === 0n || !targetOk || busy}
              onClick={() => void tx.send({ address: SPLITPAY_ADDRESS, abi: splitPayAbi, functionName: 'withdraw', args: [target] })}
            >
              {busy ? 'Working...' : 'Withdraw'}
            </button>
            <button className="btn-ghost" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      <TxStatus tx={tx} doneText="Withdrawal complete." />

      <section className="space-y-2" aria-label="Accounts">
        <h2 className="px-1 font-display text-lg font-semibold">Accounts</h2>
        <div className="scroll-row -mx-4 px-4">
          <Account title="Wallet" amount={walletAmt} caption="In your wallet" Icon={Wallet} onClick={() => setAddOpen(true)} />
          <Account
            title="Split earnings"
            amount={splitAmt}
            caption={splitAmt > 0n ? 'Ready to withdraw' : 'Nothing waiting'}
            Icon={ArrowDownToLine}
            onClick={onWithdraw}
          />
          <Account
            title="Payouts"
            amount={payoutAmt}
            caption={payoutAmt > 0n ? 'Credited or unlocked' : 'Escrow, vesting, payroll'}
            Icon={Landmark}
            onClick={() => onNavigate('payouts')}
          />
        </div>
      </section>

      <div ref={addRef}>
        <AddMoney open={addOpen} onToggle={() => setAddOpen((v) => !v)} />
      </div>

      <div ref={cashRef}>
        <CashOut open={cashOpen} onToggle={() => setCashOpen((v) => !v)} />
      </div>

      <ActivityFeed refreshKey={tick} />
      <TrustCard />
    </div>
  )
}
