/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react'

import { HorizonTransactionList } from '../horizon-transaction-list'
import * as horizonApi from '@/lib/api/horizon-transactions'

jest.mock('@/lib/api/horizon-transactions')

const mockFetch = horizonApi.fetchHorizonTransactions as jest.MockedFunction<
  typeof horizonApi.fetchHorizonTransactions
>

const ACCOUNT = 'GBCPNZ6S7RK5N4BX6HBXBCX7P5QNBOJZFGDWBZBXCLK5T6KHWOPTLR3I'

const baseOp: horizonApi.HorizonOperationRecord = {
  id: '1',
  paging_token: 'token-1',
  type: 'payment',
  type_int: 1,
  created_at: '2024-01-15T10:00:00Z',
  transaction_hash: 'hash-abc',
  transaction_successful: true,
  source_account: ACCOUNT,
  amount: '10.0000000',
  asset_type: 'native',
}

beforeEach(() => {
  mockFetch.mockReset()
  mockIntersectionObserver()
})

function mockIntersectionObserver(isIntersecting = false) {
  class IO {
    private cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb
    }
    observe() {
      this.cb([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
    }
    unobserve() {}
    disconnect() {}
  }
  global.IntersectionObserver = IO as unknown as typeof IntersectionObserver
}

describe('HorizonTransactionList', () => {
  it('renders contract event descriptions alongside operation data', async () => {
    mockFetch.mockResolvedValueOnce({
      records: [
        {
          ...baseOp,
          contractEvents: [{ description: 'Filed claim #42 for policy #7' }],
        },
      ],
    })

    render(<HorizonTransactionList account={ACCOUNT} />)

    await waitFor(() => {
      expect(screen.getByText('Filed claim #42 for policy #7')).toBeInTheDocument()
    })
    expect(screen.getByText(/payment · 10\.0000000 XLM/)).toBeInTheDocument()
    expect(screen.getByText('hash-abc')).toBeInTheDocument()
  })

  it('renders empty state when the API returns no transactions', async () => {
    mockFetch.mockResolvedValueOnce({ records: [] })

    render(<HorizonTransactionList account={ACCOUNT} />)

    await waitFor(() => {
      expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument()
    })
  })

  it('loads the next page when the sentinel intersects', async () => {
    mockIntersectionObserver(true)

    mockFetch
      .mockResolvedValueOnce({
        records: [{ ...baseOp, id: '1' }],
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        records: [
          {
            ...baseOp,
            id: '2',
            paging_token: 'token-2',
            transaction_hash: 'hash-def',
          },
        ],
      })

    render(<HorizonTransactionList account={ACCOUNT} />)

    await waitFor(() => {
      expect(screen.getByText('hash-abc')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(screen.getByText('hash-def')).toBeInTheDocument()
    })

    expect(mockFetch.mock.calls[1][1]).toBe('cursor-2')
  })
})
