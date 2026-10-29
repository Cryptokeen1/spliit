/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { createConfig, fallback, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { requireChain } from './onchain-facts'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, requireChain(arc.id).rpcUrls[0])

// Arc's public RPCs rate-limit browsers (HTTP 429). Batch JSON-RPC calls into one request, and when a provider
// refuses, move straight on to the next one instead of retrying the same one.
const arcTransport = (chain: typeof arc | typeof arcTestnet) =>
  fallback(
    [...new Set([...requireChain(chain.id).rpcUrls, ...chain.rpcUrls.default.http])].map((url) =>
      http(url, { batch: { wait: 25, batchSize: 40 }, timeout: 12_000, retryCount: 0 }),
    ),
    { retryCount: 3, retryDelay: 700 },
  )

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet], // Ethereum mainnet is needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: arcTransport(arcTestnet),
    [arc.id]: arcTransport(arc),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
