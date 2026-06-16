/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { PolicyDto } from '@/features/policies/api';
import { PolicyDashboard } from '@/features/policies/components/PolicyDashboard';
import type { UseOptimisticPoliciesReturn } from '@/features/policies/hooks/useOptimisticPolicies';

function makeOptimisticPoliciesReturn(
  overrides: Partial<UseOptimisticPoliciesReturn> = {},
): UseOptimisticPoliciesReturn {
  return {
  policies: [],
  mergedPolicies: [],
  total: 0,
  pageIndex: 0,
  hasNextPage: false,
  hasPrevPage: false,
  loading: false,
  error: null,
  goToPage: jest.fn(),
  retry: jest.fn(),
  applyOptimisticPolicy: jest.fn(),
  entries: new Map(),
  confirm: jest.fn(),
  rollback: jest.fn(),
    ...overrides,
  };
}

const useOptimisticPoliciesMock = jest.fn<UseOptimisticPoliciesReturn, []>(() =>
  makeOptimisticPoliciesReturn(),
);

jest.mock('@/hooks/use-wallet', () => ({
  useWallet: () => ({
    address: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
    connectionStatus: 'connected',
    contractIds: {},
  }),
}));

jest.mock('@/hooks/use-latest-ledger', () => ({
  useLatestLedger: () => 1000000,
}));

jest.mock('@/features/policies/hooks/useOptimisticPolicies', () => ({
  useOptimisticPolicies: () => useOptimisticPoliciesMock(),
  PolicyConfirmationPoller: () => null,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

const basePolicy: PolicyDto = {
  holder: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
  policy_id: 42,
  policy_type: 'Auto',
  region: 'Medium',
  is_active: true,
  coverage_summary: {
    coverage_amount: '10000000000',
    premium_amount: '500000000',
    currency: 'XLM',
    decimals: 7,
  },
  expiry_countdown: {
    start_ledger: 1000000,
    end_ledger: 1120960,
    ledgers_remaining: 120960,
    avg_ledger_close_seconds: 5,
  },
  beneficiary: null,
  claims: [],
  _link: '/policies/42',
};

type PolicyOverrides = Partial<Omit<PolicyDto, 'coverage_summary' | 'expiry_countdown'>> & {
  coverage_summary?: Partial<PolicyDto['coverage_summary']>;
  expiry_countdown?: Partial<PolicyDto['expiry_countdown']>;
};

function makePolicy(overrides: PolicyOverrides = {}): PolicyDto {
  return {
    ...basePolicy,
    ...overrides,
    coverage_summary: { ...basePolicy.coverage_summary, ...(overrides.coverage_summary ?? {}) },
    expiry_countdown: { ...basePolicy.expiry_countdown, ...(overrides.expiry_countdown ?? {}) },
  };
}

describe('PolicyDashboard', () => {
  beforeEach(() => {
    useOptimisticPoliciesMock.mockReturnValue(makeOptimisticPoliciesReturn());
  });

  it('renders get-a-quote CTA when no policies exist', () => {
    render(<PolicyDashboard />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/don't have any policies/i)).toBeInTheDocument();

    const ctaLink = screen.getByRole('link', { name: /get your first quote/i });
    expect(ctaLink).toHaveAttribute('href', '/quote');
  });

  it('renders an expiring soon section for policies within seven days of expiry', () => {
    const expiringPolicy = makePolicy({
      policy_id: 43,
      expiry_countdown: { ledgers_remaining: 120960 },
    });

    useOptimisticPoliciesMock.mockReturnValue(makeOptimisticPoliciesReturn({
      policies: [expiringPolicy],
      mergedPolicies: [expiringPolicy],
      total: 1,
    }));

    render(<PolicyDashboard />);

    expect(screen.getByRole('heading', { name: /Expiring soon/i })).toBeInTheDocument();
    expect(screen.getByText(/#43/)).toBeInTheDocument();
  });
});
