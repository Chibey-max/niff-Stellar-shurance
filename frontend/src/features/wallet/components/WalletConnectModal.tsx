'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet, AlertTriangle } from 'lucide-react'
import { FREIGHTER_ID, XBULL_ID, LOBSTR_ID } from '@creit.tech/stellar-wallets-kit'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useWallet } from '../hooks/useWallet'
import type { WalletId } from '../context/WalletContext'
import { LAST_WALLET_ID_STORAGE_KEY } from '../constants'
import { detectInstalledWallets, type WalletInstallState } from '../utils/detectInstalledWallets'

export interface WalletOption {
  id: WalletId
  label: string
  installUrl: string
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: FREIGHTER_ID as WalletId,
    label: 'Freighter',
    installUrl: 'https://www.freighter.app/',
  },
  {
    id: XBULL_ID as WalletId,
    label: 'xBull',
    installUrl: 'https://xbull.app/',
  },
  {
    id: LOBSTR_ID as WalletId,
    label: 'Lobstr',
    installUrl: 'https://lobstr.co/',
  },
]

export interface WalletConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletConnectModal({ open, onOpenChange }: WalletConnectModalProps) {
  const { connect, connectionStatus } = useWallet()
  const [installed, setInstalled] = useState<WalletInstallState | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [pendingWalletId, setPendingWalletId] = useState<WalletId | null>(null)

  const refreshInstallState = useCallback(async () => {
    const state = await detectInstalledWallets()
    setInstalled(state)
  }, [])

  useEffect(() => {
    if (!open) return
    setConnectError(null)
    void refreshInstallState()
  }, [open, refreshInstallState])

  const isConnecting = connectionStatus === 'connecting' || pendingWalletId !== null

  async function handleConnect(walletId: WalletId) {
    setConnectError(null)
    setPendingWalletId(walletId)
    try {
      await connect(walletId)
      localStorage.setItem(LAST_WALLET_ID_STORAGE_KEY, walletId)
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not connect to your wallet.'
      setConnectError(msg)
    } finally {
      setPendingWalletId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-labelledby="wallet-connect-title" aria-describedby="wallet-connect-desc">
        <DialogHeader>
          <DialogTitle id="wallet-connect-title">Connect Wallet</DialogTitle>
          <DialogDescription id="wallet-connect-desc">
            Choose a wallet to connect to NiffyInsur.
          </DialogDescription>
        </DialogHeader>

        {connectError && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2"
            role="alert"
          >
            <p>{connectError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setConnectError(null)}
            >
              Retry
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {WALLET_OPTIONS.map((w) => {
            const isInstalled = installed?.[w.id] ?? false
            return (
              <div key={w.id} className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  disabled={!isInstalled || isConnecting}
                  onClick={() => handleConnect(w.id)}
                >
                  <Wallet className="h-4 w-4" />
                  {w.label}
                  {pendingWalletId === w.id ? ' — Connecting…' : null}
                </Button>
                {!isInstalled && installed !== null && (
                  <p className="text-xs text-muted-foreground px-1">
                    Not installed?{' '}
                    <a
                      href={w.installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Install {w.label}
                    </a>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Self-custody:</strong> NiffyInsur never asks for your seed phrase or private key.
            Always verify you are on <strong>niffyinsur.com</strong> before connecting.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
