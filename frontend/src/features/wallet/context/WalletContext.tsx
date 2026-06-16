'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  FREIGHTER_ID,
  xBullModule,
  XBULL_ID,
  LobstrModule,
  LOBSTR_ID,
} from '@creit.tech/stellar-wallets-kit'
import { LAST_WALLET_ID_STORAGE_KEY } from '../constants'
import type { AppNetwork } from '@/config/networkManifest'
import { passphraseToAppNetwork } from '@/config/networkManifest'
import { toast } from '@/components/ui/use-toast'
import {
  computeNetworkMismatch,
  type WalletNetworkResolution,
} from '@/features/wallet/utils/networkMismatch'

export type WalletId = typeof FREIGHTER_ID | typeof XBULL_ID | typeof LOBSTR_ID
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface WalletContextValue {
  address: string | null
  connectionStatus: ConnectionStatus
  activeWalletId: WalletId | null
  /** The network the wallet is currently on (null = unknown / not connected) */
  walletNetwork: AppNetwork | null
  /** The network the app is configured to use */
  appNetwork: AppNetwork
  /** True when wallet network ≠ app network (or wallet uses an unmapped passphrase) */
  networkMismatch: boolean
  /**
   * Last wallet `getNetwork()` outcome: `ok` + mapped passphrase (or null if unknown),
   * `idle` before connect / after disconnect, `error` if getNetwork threw.
   */
  walletNetworkResolution: WalletNetworkResolution
  connect: (walletId: WalletId) => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (xdr: string) => Promise<string>
  setAppNetwork: (network: AppNetwork) => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

const LS_NETWORK_KEY = 'niffyinsure:appNetwork'
const LS_WALLET_SESSION = 'niffyinsur-wallet-session-v1'

interface WalletSession {
  walletId: WalletId;
  publicKey: string;
}

function kitNetworkFor(app: AppNetwork): WalletNetwork {
  if (app === 'mainnet') return WalletNetwork.PUBLIC
  if (app === 'futurenet') return WalletNetwork.FUTURENET
  return WalletNetwork.TESTNET
}

function createKit(appNetwork: AppNetwork, selectedWalletId: WalletId = FREIGHTER_ID): StellarWalletsKit {
  return new StellarWalletsKit({
    network: kitNetworkFor(appNetwork),
    selectedWalletId,
    modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
  })
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [activeWalletId, setActiveWalletId] = useState<WalletId | null>(null)
  const [walletNetwork, setWalletNetwork] = useState<AppNetwork | null>(null)
  const [walletNetworkResolution, setWalletNetworkResolution] =
    useState<WalletNetworkResolution>({ status: 'idle' })
  const [appNetwork, setAppNetworkState] = useState<AppNetwork>(() => {
    if (typeof window === 'undefined') return 'testnet'
    return (localStorage.getItem(LS_NETWORK_KEY) as AppNetwork) ?? 'testnet'
  })

  const kitRef = useRef<StellarWalletsKit | null>(null)

  // Initialize kit once on mount
  useEffect(() => {
    if (!kitRef.current) kitRef.current = createKit(appNetwork)

    // Auto-reconnect last wallet (Silent reconnect on app mount)
    const sessionRaw = localStorage.getItem(LS_WALLET_SESSION)
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw) as WalletSession
        reconnect(session)
      } catch {
        localStorage.removeItem(LS_WALLET_SESSION)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function reconnect(session: WalletSession) {
    try {
      const kit = kitRef.current ?? createKit(appNetwork, session.walletId)
      kitRef.current = kit
      kit.setWallet(session.walletId)
      const { address: addr } = await kit.getAddress()
      
      if (addr) {
        // Validate reconnected public key matches stored value (Requirement: clear if mismatched)
        if (addr !== session.publicKey) {
          console.warn('Wallet address mismatch during reconnect. Clearing session.')
          localStorage.removeItem(LS_WALLET_SESSION)
          return
        }

        setAddress(addr)
        setActiveWalletId(session.walletId)
        setConnectionStatus('connected')
        await refreshWalletNetwork()
      }
    } catch {
      // Failed to reconnect (extension locked or unavailable)
      // Requirement: show a non-blocking banner if it fails.
      toast({
        title: 'Reconnect failed',
        description: 'Unable to auto-reconnect to your wallet. Please unlock your extension or connect manually.',
        variant: 'default', // non-blocking (not 'destructive' if we want it subtle)
      })
    }
  }

  async function refreshWalletNetwork() {
    try {
      const { network, networkPassphrase } = await kitRef.current!.getNetwork()
      const appNet = passphraseToAppNetwork(networkPassphrase ?? network)
      setWalletNetwork(appNet)
      setWalletNetworkResolution({ status: 'ok', mappedNetwork: appNet })
    } catch {
      setWalletNetwork(null)
      setWalletNetworkResolution({ status: 'error' })
    }
  }

  const connect = useCallback(async (walletId: WalletId) => {
    setConnectionStatus('connecting')
    try {
      const kit = kitRef.current ?? createKit(appNetwork, walletId)
      kitRef.current = kit
      kit.setWallet(walletId)
      const { address: addr } = await kit.getAddress()
      
      if (addr) {
        setAddress(addr)
        setActiveWalletId(walletId)
        setConnectionStatus('connected')
        
        // Save session data (Requirement: {walletType, publicKey})
        // SECURITY NOTE: We only store the public key. Never store private keys or seed phrases in localStorage.
        localStorage.setItem(LS_WALLET_SESSION, JSON.stringify({
          walletId,
          publicKey: addr
        }))
        localStorage.setItem(LAST_WALLET_ID_STORAGE_KEY, walletId)

        await refreshWalletNetwork()
      }
    } catch (err: unknown) {
      setWalletNetworkResolution({ status: 'idle' })
      setConnectionStatus('error')
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        toast({ title: 'Transaction Cancelled', description: 'You rejected the request in your wallet.', variant: 'destructive' })
      } else {
        toast({ title: 'Connection failed', description: msg, variant: 'destructive' })
      }
      throw err
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appNetwork])

  const disconnect = useCallback(async () => {
    await kitRef.current?.disconnect()
    setAddress(null)
    setConnectionStatus('disconnected')
    setActiveWalletId(null)
    setWalletNetwork(null)
    setWalletNetworkResolution({ status: 'idle' })
    localStorage.removeItem(LS_WALLET_SESSION)
  }, [])

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    await refreshWalletNetwork()
    try {
      const { signedTxXdr } = await kitRef.current!.signTransaction(xdr, {
        address: address ?? undefined,
        networkPassphrase: kitNetworkFor(appNetwork),
      })
      await refreshWalletNetwork()
      return signedTxXdr
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('cancel')) {
        toast({ title: 'Transaction Cancelled', description: 'You rejected the transaction in your wallet.', variant: 'destructive' })
      }
      throw err
    }
  }, [address, appNetwork])

  const setAppNetwork = useCallback((network: AppNetwork) => {
    setAppNetworkState(network)
    localStorage.setItem(LS_NETWORK_KEY, network)
    kitRef.current = createKit(network, activeWalletId ?? FREIGHTER_ID)
    // Re-check wallet network after app network change
    if (connectionStatus === 'connected') {
      refreshWalletNetwork()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWalletId, connectionStatus])

  const networkMismatch = computeNetworkMismatch(
    connectionStatus,
    appNetwork,
    walletNetworkResolution,
  )

  return (
    <WalletContext.Provider
      value={{
        address,
        connectionStatus,
        activeWalletId,
        walletNetwork,
        appNetwork,
        networkMismatch,
        walletNetworkResolution,
        connect,
        disconnect,
        signTransaction,
        setAppNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used inside <WalletProvider>')
  return ctx
}
