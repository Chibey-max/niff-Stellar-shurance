import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { WalletProvider, useWalletContext } from '../context/WalletContext';
import { toast } from '@/components/ui/use-toast';

// Mock dependencies
const mockKit = {
  setWallet: jest.fn(),
  getAddress: jest.fn(),
  getNetwork: jest.fn(),
  disconnect: jest.fn(),
  signTransaction: jest.fn(),
}

jest.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: jest.fn(() => mockKit),
  WalletNetwork: { PUBLIC: 'public', TESTNET: 'testnet', FUTURENET: 'futurenet' },
  FreighterModule: jest.fn(),
  FREIGHTER_ID: 'freighter',
  xBullModule: jest.fn(),
  XBULL_ID: 'xbull',
  LobstrModule: jest.fn(),
  LOBSTR_ID: 'lobstr',
}));

jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

const LS_WALLET_SESSION = 'niffyinsur-wallet-session-v1';

const TestComponent = () => {
  const { address, activeWalletId, connectionStatus } = useWalletContext();
  return (
    <div>
      <div data-testid="address">{address || 'none'}</div>
      <div data-testid="wallet-id">{activeWalletId || 'none'}</div>
      <div data-testid="status">{connectionStatus}</div>
    </div>
  );
};

describe('WalletContext Auto-Reconnect', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockKit.getNetwork.mockResolvedValue({ network: 'testnet', networkPassphrase: 'testnet' });
  });

  it('silently reconnects when valid session exists', async () => {
    const session = { walletId: 'freighter', publicKey: 'GBXYZ...' };
    localStorage.setItem(LS_WALLET_SESSION, JSON.stringify(session));
    
    mockKit.getAddress.mockResolvedValue({ address: 'GBXYZ...' });

    const { getByTestId } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(getByTestId('status').textContent).toBe('connected');
      expect(getByTestId('address').textContent).toBe('GBXYZ...');
      expect(getByTestId('wallet-id').textContent).toBe('freighter');
    });

    expect(mockKit.setWallet).toHaveBeenCalledWith('freighter');
  });

  it('clears session when public keys mismatch', async () => {
    // Session is for GBXYZ, but adapter returns GB123
    const session = { walletId: 'xbull', publicKey: 'GBXYZ...' };
    localStorage.setItem(LS_WALLET_SESSION, JSON.stringify(session));
    
    mockKit.getAddress.mockResolvedValue({ address: 'GB123...' });

    const { getByTestId } = render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(localStorage.getItem(LS_WALLET_SESSION)).toBeNull();
      expect(getByTestId('status').textContent).toBe('disconnected');
    });
  });

  it('shows non-blocking banner (toast) when reconnect fails', async () => {
    const session = { walletId: 'freighter', publicKey: 'GBXYZ...' };
    localStorage.setItem(LS_WALLET_SESSION, JSON.stringify(session));
    
    mockKit.getAddress.mockRejectedValue(new Error('Locked'));

    render(
      <WalletProvider>
        <TestComponent />
      </WalletProvider>
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Reconnect failed',
        variant: 'default',
      }));
    });
  });
});
