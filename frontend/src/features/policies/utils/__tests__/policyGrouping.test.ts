import type { PolicyDto } from '@/features/policies/api';
import { classifyPolicyExpiryGroup, groupPoliciesByExpiry, EXPIRING_SOON_LEDGER_THRESHOLD } from '@/features/policies/utils/policyGrouping';

const basePolicy: PolicyDto = {
  holder: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
  policy_id: 1,
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
  _link: '/policies/1',
};

function makePolicy(overrides: Partial<PolicyDto> = {}): PolicyDto {
  return {
    ...basePolicy,
    ...overrides,
    coverage_summary: { ...basePolicy.coverage_summary, ...(overrides.coverage_summary ?? {}) },
    expiry_countdown: { ...basePolicy.expiry_countdown, ...(overrides.expiry_countdown ?? {}) },
  };
}

describe('policyGrouping', () => {
  it('classifies active policies when expiry is more than 7 days away', () => {
    const policy = makePolicy({ expiry_countdown: { ledgers_remaining: EXPIRING_SOON_LEDGER_THRESHOLD + 1 } });

    expect(classifyPolicyExpiryGroup(policy)).toBe('active');
  });

  it('classifies expiring soon policies when expiry is exactly 7 days away', () => {
    const policy = makePolicy({ expiry_countdown: { ledgers_remaining: EXPIRING_SOON_LEDGER_THRESHOLD } });

    expect(classifyPolicyExpiryGroup(policy)).toBe('expiringSoon');
  });

  it('classifies expired policies when policy is inactive', () => {
    const policy = makePolicy({ is_active: false, expiry_countdown: { ledgers_remaining: -1 } });

    expect(classifyPolicyExpiryGroup(policy)).toBe('expired');
  });

  it('groups policies into the correct expiry buckets', () => {
    const policies = [
      makePolicy({ policy_id: 2, expiry_countdown: { ledgers_remaining: EXPIRING_SOON_LEDGER_THRESHOLD + 1 } }),
      makePolicy({ policy_id: 3, expiry_countdown: { ledgers_remaining: EXPIRING_SOON_LEDGER_THRESHOLD } }),
      makePolicy({ policy_id: 4, is_active: false, expiry_countdown: { ledgers_remaining: -100 } }),
    ];

    const groups = groupPoliciesByExpiry(policies);

    expect(groups.active).toHaveLength(1);
    expect(groups.expiringSoon).toHaveLength(1);
    expect(groups.expired).toHaveLength(1);
    expect(groups.active[0].policy_id).toBe(2);
    expect(groups.expiringSoon[0].policy_id).toBe(3);
    expect(groups.expired[0].policy_id).toBe(4);
  });
});
