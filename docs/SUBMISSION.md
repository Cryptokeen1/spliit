# SpleatPay: hackathon submission

## One-liner
One USDC payment, shared automatically. Merchants split every payment between the people they choose, and teams can lock USDC in escrow, vesting, scheduled payouts and payroll.

## Problem
Getting paid is often a group effort. A shop, a studio or a team receives one payment and then splits it by hand. Paying contractors on a schedule or holding money until work is approved needs a bank, a lawyer or a trusted middleman.

## What it does
- **Split payments:** a merchant sets recipients and percentages once and shares one payment link or QR code. Every USDC payment is divided automatically. Recipients withdraw their share whenever they like.
- **Escrow:** a payer locks USDC until they approve it. An optional arbiter can release or refund. If nobody decides by the deadline, a pre-agreed outcome happens.
- **Scheduled payouts, vesting and payroll:** unlock a payment on a date, over time with a cliff, or in equal steps. Senders can mark a plan cancellable; unlocked money always stays with the recipient.
- **Clear, honest costs:** a flat 0.2% fee, shown before you pay, taken only when money is paid out. No admin can pause, freeze or redirect funds.
- **Neobank-style app:** one balance and activity feed, add money with a QR code, light and dark themes, works on mobile.

## Why Arc
USDC is the gas token on Arc, so fees are paid in the same dollars people are moving, are predictable, and confirm quickly. That makes small, frequent, split payments practical.

## Deployed contracts
Arc Testnet (chain ID 5042002)
- SplitPay contract: `0x42c7cc566ccbba542c4ef8ed66ad468cad22626b`
- PayoutVault: `0xfd4767731c41b2069eac5b87208a0f4e42d436d3`

Arc mainnet (chain ID 5042), deployed by the project owner from their own wallet
- SplitPay contract: `0xbfCbfFd48F813b4e46961deC7a4FE048Af91d992`
- PayoutVault: `0xb53088b5ba3ec15b2bff6de6529f9e1cb4d4b2a5`

Explorer: https://explorer.arc.io (mainnet), https://explorer.testnet.arc.io (testnet)

## Links
- Repository: ADD YOUR GITHUB URL
- Live demo: ADD YOUR PUBLIC DEMO URL (the Netlify site must have access control set to Open to be viewable by judges)
- Demo video: ADD YOUR VIDEO URL

## Tech
Solidity 0.8.28 with Foundry and OpenZeppelin, React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit, Circle USDC on Arc.

## Quality and safety
- Both contracts are immutable with no owner, admin, pause or upgrade path.
- Automated security review, static analysis and a 102-test suite (unit, fuzz and invariant tests) for PayoutVault. SplitPay passed the same review and static analysis.
- Known limits: not independently audited; if the USDC issuer blocklists a contract address, that contract's withdrawals freeze.

## Run it locally
```bash
bun install
bun run dev
```
Contracts: `bun run contracts:build` and `bun run contracts:test`. The app opens on Arc Testnet by default. Mainnet setup is in `docs/mainnet-deploy.md`.

## Try it in two minutes
1. Connect a wallet on Arc Testnet and get test USDC.
2. Merchant tab: create a split between two addresses you own and copy its link.
3. Pay tab: pay it a small amount, then withdraw from Home.
4. Payouts tab: lock a small escrow or a one-hour plan and release or claim it.

## Team
ADD YOUR NAME AND CONTACT
