import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAbiItem, hexToString, type Hex } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { fetchSplitsOwnedBy } from '@/lib/enumerate'
import { scanEvents } from '@/lib/logScan'
import { ARC_ID, SPLITPAY_ADDRESS, SPLITPAY_DEPLOY_BLOCK, splitPayAbi } from '@/splitpay'

type Kind = 'received' | 'paid' | 'withdrawn'

interface Item {
  key: string
  kind: Kind
  amount: bigint
  splitId?: bigint
  note: string
  hash: Hex
  block: bigint
  index: number
  time?: number
}

const paymentEvent = getAbiItem({ abi: splitPayAbi, name: 'PaymentReceived' })
const withdrawnEvent = getAbiItem({ abi: splitPayAbi, name: 'Withdrawn' })

function readRef(ref: Hex): string {
  try {
    return hexToString(ref, { size: 32 }).replace(/\0+$/g, '').trim()
  } catch {
    return ''
  }
}

function dayLabel(ts?: number): string {
  if (!ts) return 'Recent'
  const d = new Date(ts * 1000)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: diff > 300 ? 'numeric' : undefined })
}

function clock(ts?: number): string {
  return ts ? new Date(ts * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''
}

function ago(ts?: number): string {
  if (!ts) return ''
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

const META: Record<Kind, { title: string; sign: string; Icon: typeof ArrowDownLeft; tone: string }> = {
  received: { title: 'Paid into your split', sign: '+', Icon: ArrowDownLeft, tone: 'text-emerald-700 bg-emerald-50' },
  paid: { title: 'Payment sent', sign: '-', Icon: ArrowUpRight, tone: 'text-[color:var(--ink)] bg-white/80' },
  withdrawn: { title: 'Withdrawal', sign: '-', Icon: Landmark, tone: 'text-[color:var(--ink)] bg-white/80' },
}

export function ActivityFeed({ refreshKey }: { refreshKey: number }) {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: ARC_ID })
  const query = useQuery({
    queryKey: ['activity', address, refreshKey],
    enabled: Boolean(client && address),
    refetchInterval: 60000,
    queryFn: async (): Promise<Item[]> => {
      if (!client || !address) return []
      const me = address.toLowerCase()
      const [owned, logs] = await Promise.all([
        fetchSplitsOwnedBy(client, address),
        scanEvents(client, SPLITPAY_ADDRESS, [paymentEvent, withdrawnEvent], SPLITPAY_DEPLOY_BLOCK),
      ])
      const ownedIds = new Set(owned.map((s) => String(s.id)))
      const payments = logs.filter((l) => l.eventName === 'PaymentReceived')
      const withdrawals = logs.filter((l) => l.eventName === 'Withdrawn')
      const paid = payments.filter((l) => String(l.args.payer).toLowerCase() === me)
      const received = payments.filter((l) => ownedIds.has(String(l.args.splitId)))
      const withdrawn = withdrawals.filter((l) => String(l.args.account).toLowerCase() === me)

      const all: Item[] = []
      const seen = new Set<string>()
      for (const l of received) {
        const id = `${l.transactionHash}-${l.logIndex}`
        seen.add(id)
        // A payment you made to your own split is shown once, as received.
        all.push({
          key: `r-${id}`,
          kind: 'received',
          amount: (l.args.amount as bigint) - (l.args.fee as bigint),
          splitId: l.args.splitId as bigint,
          note: readRef(l.args.paymentReference as Hex),
          hash: l.transactionHash,
          block: l.blockNumber,
          index: l.logIndex,
        })
      }
      for (const l of paid) {
        const id = `${l.transactionHash}-${l.logIndex}`
        if (seen.has(id)) continue
        all.push({
          key: `p-${id}`,
          kind: 'paid',
          amount: l.args.amount as bigint,
          splitId: l.args.splitId as bigint,
          note: readRef(l.args.paymentReference as Hex),
          hash: l.transactionHash,
          block: l.blockNumber,
          index: l.logIndex,
        })
      }
      for (const l of withdrawn) {
        all.push({
          key: `w-${l.transactionHash}-${l.logIndex}`,
          kind: 'withdrawn',
          amount: l.args.amount as bigint,
          note: '',
          hash: l.transactionHash,
          block: l.blockNumber,
          index: l.logIndex,
        })
      }
      all.sort((a, b) => (a.block === b.block ? b.index - a.index : a.block < b.block ? 1 : -1))
      const top = all.slice(0, 30)

      const blocks = [...new Set(top.map((t) => t.block))]
      const stamps = new Map<bigint, number>()
      await Promise.all(
        blocks.map(async (b) => {
          try {
            const blk = await client.getBlock({ blockNumber: b })
            stamps.set(b, Number(blk.timestamp))
          } catch {
            /* time is decorative; skip on failure */
          }
        }),
      )
      return top.map((t) => ({ ...t, time: stamps.get(t.block) }))
    },
  })
  const items = query.data ?? []
  const state: 'idle' | 'loading' | 'error' = query.isError ? 'error' : query.isFetching && items.length === 0 ? 'loading' : 'idle'
  const load = () => void query.refetch()

  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, 6)
  const groups: { label: string; rows: Item[] }[] = []
  for (const it of visible) {
    const label = dayLabel(it.time)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(it)
    else groups.push({ label, rows: [it] })
  }

  return (
    <section className="space-y-3" aria-label="Transactions">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-lg font-semibold">Transactions</h2>
        {state === 'loading' && <span className="text-xs text-[color:var(--muted)]">Updating...</span>}
      </div>
      {state === 'error' && (
        <p className="px-1 text-sm text-[color:var(--muted)]">
          Could not load transactions. <button className="underline" onClick={load}>Retry</button>
        </p>
      )}
      {state !== 'error' && items.length === 0 && state !== 'loading' && (
        <p className="glass rounded-3xl p-5 text-sm text-[color:var(--muted)] text-pretty">
          Nothing yet. Payments to your splits, payments you send and withdrawals will show up here.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">{g.label}</p>
          <ul className="glass divide-y divide-[color:var(--line)] overflow-hidden rounded-3xl">
            {g.rows.map((it) => {
              const m = META[it.kind]
              return (
                <li key={it.key}>
                  <a
                    className="flex min-h-[64px] items-center gap-3 px-4 py-3"
                    href={buildTxExplorerUrl(ARC_ID, it.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className={`grid size-11 place-items-center rounded-full ${m.tone}`}>
                      <m.Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {m.title}
                        {it.splitId !== undefined ? ` · Split #${it.splitId}` : ''}
                      </span>
                      <span className="block truncate text-xs text-[color:var(--muted)]">
                        {[it.note, clock(it.time) || ago(it.time)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={`tnum text-sm font-semibold ${it.kind === 'received' ? 'text-emerald-700' : ''}`}>
                      {m.sign}
                      {formatUsdc(it.amount)}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {items.length > 6 && (
        <button className="btn-ghost w-full" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `Show all (${items.length})`}
        </button>
      )}
      <p className="px-1 text-xs text-[color:var(--muted)]">Shows recent activity. Amounts paid into your splits are after the 0.2% protocol fee.</p>
    </section>
  )
}
