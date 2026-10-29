import type { Address, PublicClient } from 'viem'
import { VAULT_ADDRESS, vaultAbi, vestedAt, type EscrowView, type PlanView } from '@/payoutvault'
import { SPLITPAY_ADDRESS, splitPayAbi, type SplitView } from '@/splitpay'

/**
 * The newest records read per contract. Reading by id costs one batched call however old the contract is,
 * unlike scanning logs, which grows with every block.
 */
const NEWEST = 300n

function idRange(count: bigint): bigint[] {
  const first = count > NEWEST ? count - NEWEST + 1n : 1n
  const ids: bigint[] = []
  for (let i = first; i <= count; i++) ids.push(i)
  return ids
}

export async function fetchSplitsOwnedBy(client: PublicClient, owner: Address): Promise<SplitView[]> {
  const count = await client.readContract({ address: SPLITPAY_ADDRESS, abi: splitPayAbi, functionName: 'splitCount' })
  const ids = idRange(count)
  if (ids.length === 0) return []
  const rows = await client.multicall({
    contracts: ids.map((id) => ({ address: SPLITPAY_ADDRESS, abi: splitPayAbi, functionName: 'getSplit', args: [id] }) as const),
    allowFailure: false,
  })
  return rows
    .map(([o, version, recipients, bps], i): SplitView => ({ id: ids[i], owner: o, version, recipients, bps }))
    .filter((s) => s.owner.toLowerCase() === owner.toLowerCase())
    .sort((a, b) => (a.id < b.id ? 1 : -1))
}

export async function fetchVaultInvolving(client: PublicClient, me: Address, nowSec: number): Promise<{ escrows: EscrowView[]; plans: PlanView[] }> {
  const [escrowCount, planCount] = await Promise.all([
    client.readContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'escrowCount' }),
    client.readContract({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'planCount' }),
  ])
  const eIds = idRange(escrowCount)
  const pIds = idRange(planCount)
  const [eRows, pRows] = await Promise.all([
    eIds.length
      ? client.multicall({
          contracts: eIds.map((id) => ({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'getEscrow', args: [id] }) as const),
          allowFailure: false,
        })
      : Promise.resolve([]),
    pIds.length
      ? client.multicall({
          contracts: pIds.map((id) => ({ address: VAULT_ADDRESS, abi: vaultAbi, functionName: 'getPlan', args: [id] }) as const),
          allowFailure: false,
        })
      : Promise.resolve([]),
  ])

  const mine = me.toLowerCase()
  const escrows: EscrowView[] = eRows
    .map((e, i): EscrowView => ({
      id: eIds[i],
      payer: e.payer,
      seller: e.seller,
      arbiter: e.arbiter,
      amount: e.amount,
      deadline: Number(e.deadline),
      releaseOnDeadline: e.releaseOnDeadline,
      status: e.status,
      note: '',
    }))
    .filter((e) => [e.payer, e.seller, e.arbiter].some((a) => a.toLowerCase() === mine))
    .sort((a, b) => (a.id < b.id ? 1 : -1))

  const plans: PlanView[] = pRows
    .map((p, i): PlanView => {
      const base: PlanView = {
        id: pIds[i],
        kind: p.kind,
        funder: p.funder,
        recipient: p.recipient,
        total: p.total,
        claimed: p.claimed,
        start: Number(p.start),
        cliff: Number(p.cliff),
        duration: Number(p.duration),
        periods: p.periods,
        revocable: p.revocable,
        revokedAt: Number(p.revokedAt),
        vested: 0n,
        releasable: 0n,
        note: '',
      }
      const vested = vestedAt(base, nowSec)
      return { ...base, vested, releasable: vested > p.claimed ? vested - p.claimed : 0n }
    })
    .filter((p) => [p.funder, p.recipient].some((a) => a.toLowerCase() === mine))
    .sort((a, b) => (a.id < b.id ? 1 : -1))

  return { escrows, plans }
}
