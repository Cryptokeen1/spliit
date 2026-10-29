import { useQuery } from '@tanstack/react-query'
import { useAccount, usePublicClient } from 'wagmi'
import { fetchVaultInvolving } from '@/lib/enumerate'
import { ARC_ID } from '@/splitpay'
import type { EscrowView, PlanView } from '@/payoutvault'

/** Escrows and plans the connected wallet is involved in, with live onchain state. */
export function usePayoutData(refreshKey: number) {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: ARC_ID })

  return useQuery({
    queryKey: ['payouts', address, refreshKey],
    enabled: Boolean(client && address),
    refetchInterval: 60000,
    queryFn: async (): Promise<{ escrows: EscrowView[]; plans: PlanView[] }> => {
      if (!client || !address) return { escrows: [], plans: [] }
      return fetchVaultInvolving(client, address, Math.floor(Date.now() / 1000))
    },
  })
}
