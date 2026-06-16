/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { WalletConnectModal } from '../components/WalletConnectModal'
import { LAST_WALLET_ID_STORAGE_KEY } from '../constants'
import { FREIGHTER_ID, XBULL_ID } from '@creit.tech/stellar-wallets-kit'

const mockConnect = jest.fn()
const mockDetect = jest.fn()

jest.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    connect: mockConnect,
    connectionStatus: 'disconnected',
  }),
}))

jest.mock('../utils/detectInstalledWallets', () => ({
  detectInstalledWallets: (...args: unknown[]) => mockDetect(...args),
}))

describe('WalletConnectModal', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    mockConnect.mockResolvedValue(undefined)
    mockDetect.mockResolvedValue({
      [FREIGHTER_ID]: true,
      [XBULL_ID]: false,
      lobstr: false,
    })
  })

  it('enables connect button when wallet is installed', async () => {
    render(<WalletConnectModal open onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Freighter/ })).toBeEnabled()
    })
  })

  it('shows install link when wallet is not installed', async () => {
    render(<WalletConnectModal open onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Install xBull/i })).toHaveAttribute(
        'href',
        'https://xbull.app/',
      )
    })
    expect(screen.getByRole('button', { name: /^xBull/ })).toBeDisabled()
  })

  it('renders error message and retry on connection failure', async () => {
    mockConnect.mockRejectedValueOnce(new Error('User denied access'))

    render(<WalletConnectModal open onOpenChange={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Freighter/ })).toBeEnabled()
    })

    await userEvent.click(screen.getByRole('button', { name: /^Freighter/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User denied access')
    })
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('writes wallet type to localStorage on successful connect', async () => {
    const onOpenChange = jest.fn()
    render(<WalletConnectModal open onOpenChange={onOpenChange} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Freighter/ })).toBeEnabled()
    })

    await userEvent.click(screen.getByRole('button', { name: /^Freighter/ }))

    await waitFor(() => {
      expect(localStorage.getItem(LAST_WALLET_ID_STORAGE_KEY)).toBe(FREIGHTER_ID)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
