/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import AdminClaimsPage from '../page'
import { adminApi } from '@/lib/api/admin'

jest.mock('@/lib/api/admin', () => ({
  adminApi: {
    getClaims: jest.fn(),
    overrideClaimStatus: jest.fn(),
    bulkUpdateClaims: jest.fn(),
  },
}))

// JWT needs 3 dot-separated parts so isStaff can split and parse it
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ jwt: 'header.payload.signature' }),
}))

// Mock atob so isStaff decodes the payload part as admin
jest.spyOn(global, 'atob').mockImplementation(() =>
  JSON.stringify({ role: 'admin' })
)

const mockGetClaims = adminApi.getClaims as jest.MockedFunction<typeof adminApi.getClaims>
const mockOverride = adminApi.overrideClaimStatus as jest.MockedFunction<typeof adminApi.overrideClaimStatus>
const mockBulkUpdate = adminApi.bulkUpdateClaims as jest.MockedFunction<typeof adminApi.bulkUpdateClaims>

type AdminClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID'

const makeClaim = (id: number, status: AdminClaimStatus = 'PENDING') => ({
  id,
  policyId: `POL-${id}`,
  creatorAddress: `GABC${id.toString().padStart(56, '0')}`,
  status,
  amount: '1000',
  description: `Claim ${id}`,
  createdAt: '2025-01-01T10:00:00Z',
  updatedAt: '2025-01-01T10:00:00Z',
})

const mockPage = {
  items: [makeClaim(1), makeClaim(2, 'APPROVED'), makeClaim(3)],
  total: 3,
  nextCursor: undefined,
}

describe('AdminClaimsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetClaims.mockResolvedValue(mockPage)
  })

  it('renders claims list on load', async () => {
    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('redirects non-admins by showing 403 page', async () => {
    jest.spyOn(global, 'atob').mockReturnValueOnce(JSON.stringify({ role: 'user' }))

    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByText('403')).toBeInTheDocument()
    })
  })

  it('selects a claim when checkbox is clicked', async () => {
    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Select claim 1')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByLabelText('Select claim 1'))
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument()
  })

  it('selects all claims when select-all checkbox is clicked', async () => {
    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Select all claims')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByLabelText('Select all claims'))
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument()
  })

  it('deselects all claims when select-all is clicked again', async () => {
    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Select all claims')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByLabelText('Select all claims'))
    await userEvent.click(screen.getByLabelText('Select all claims'))
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument()
  })

  describe('Override Status', () => {
    it('opens override modal when Override button is clicked', async () => {
      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Override status for claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Override status for claim 1'))
      expect(screen.getByText(/override claim status/i)).toBeInTheDocument()
    })

    it('shows validation error when reason is empty', async () => {
      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Override status for claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Override status for claim 1'))
      await userEvent.click(screen.getByRole('button', { name: /confirm override/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/reason is required/i)
      })
    })

    it('submits override when reason is provided', async () => {
      const updatedClaim = { ...makeClaim(1), status: 'APPROVED' as const }
      mockOverride.mockResolvedValueOnce(updatedClaim)

      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Override status for claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Override status for claim 1'))

      const dialog = screen.getByRole('dialog')
      const reasonField = within(dialog).getByLabelText(/reason/i)
      await userEvent.type(reasonField, 'Manual review approved')

      await userEvent.click(within(dialog).getByRole('button', { name: /confirm override/i }))

      await waitFor(() => {
        expect(mockOverride).toHaveBeenCalledWith(
          'header.payload.signature',
          1,
          'APPROVED',
          'Manual review approved',
        )
      })
    })

    it('does not submit when reason is empty whitespace', async () => {
      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Override status for claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Override status for claim 1'))

      const dialog = screen.getByRole('dialog')
      const reasonField = within(dialog).getByLabelText(/reason/i)
      await userEvent.type(reasonField, '   ')
      await userEvent.click(within(dialog).getByRole('button', { name: /confirm override/i }))

      expect(mockOverride).not.toHaveBeenCalled()
    })
  })

  describe('Bulk Update', () => {
    it('shows dry-run preview before confirming bulk update', async () => {
      mockBulkUpdate.mockResolvedValueOnce({
        affectedClaims: [makeClaim(1), makeClaim(3)],
        totalAffected: 2,
      })

      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Select claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Select claim 1'))
      await userEvent.click(screen.getByLabelText('Select claim 3'))
      await userEvent.click(screen.getByRole('button', { name: /bulk update/i }))

      await waitFor(() => {
        expect(screen.getByText(/2 claim\(s\) will be updated/i)).toBeInTheDocument()
      })

      expect(mockBulkUpdate).toHaveBeenCalledWith(
        'header.payload.signature',
        expect.arrayContaining([1, 3]),
        'APPROVED',
        true, // dryRun = true
      )
    })

    it('calls bulk update with dryRun=false when confirming', async () => {
      mockBulkUpdate
        .mockResolvedValueOnce({ affectedClaims: [makeClaim(1)], totalAffected: 1 })
        .mockResolvedValueOnce({ updated: 1 })

      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Select claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Select claim 1'))
      await userEvent.click(screen.getByRole('button', { name: /bulk update/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm update/i })).not.toBeDisabled()
      })

      await userEvent.click(screen.getByRole('button', { name: /confirm update/i }))

      await waitFor(() => {
        expect(mockBulkUpdate).toHaveBeenCalledWith(
          'header.payload.signature',
          [1],
          'APPROVED',
          false, // dryRun = false
        )
      })
    })

    it('shows error when bulk dry-run fails', async () => {
      mockBulkUpdate.mockRejectedValueOnce(new Error('Bulk update failed'))

      render(<AdminClaimsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Select claim 1')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByLabelText('Select claim 1'))
      await userEvent.click(screen.getByRole('button', { name: /bulk update/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Bulk update failed')
      })
    })
  })

  it('shows error when claims fetch fails', async () => {
    mockGetClaims.mockRejectedValueOnce(new Error('Server error'))

    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
  })

  it('shows empty state when no claims found', async () => {
    mockGetClaims.mockResolvedValue({ items: [], total: 0, nextCursor: undefined })

    render(<AdminClaimsPage />)

    await waitFor(() => {
      expect(screen.getByText(/no claims found/i)).toBeInTheDocument()
    })
  })
})
