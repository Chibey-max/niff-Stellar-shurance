import {
  FreighterModule,
  xBullModule,
  LobstrModule,
  FREIGHTER_ID,
  XBULL_ID,
  LOBSTR_ID,
} from '@creit.tech/stellar-wallets-kit'
import type { WalletId } from '../context/WalletContext'

export type WalletInstallState = Record<WalletId, boolean>

const MODULES: { id: WalletId; module: { isAvailable(): Promise<boolean> } }[] = [
  { id: FREIGHTER_ID as WalletId, module: new FreighterModule() },
  { id: XBULL_ID as WalletId, module: new xBullModule() },
  { id: LOBSTR_ID as WalletId, module: new LobstrModule() },
]

/** Probes each supported wallet module for browser availability. */
export async function detectInstalledWallets(): Promise<WalletInstallState> {
  const entries = await Promise.all(
    MODULES.map(async ({ id, module }) => {
      try {
        return [id, await module.isAvailable()] as const
      } catch {
        return [id, false] as const
      }
    }),
  )
  return Object.fromEntries(entries) as WalletInstallState
}
