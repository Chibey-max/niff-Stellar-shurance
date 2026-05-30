import type { PolicyDto } from '@/features/policies/api';

// 7 days × 24h × 3600s / 5s per ledger
export const EXPIRING_SOON_LEDGER_THRESHOLD = 120_960;

export type PolicyExpiryGroup = 'active' | 'expiringSoon' | 'expired';

export function classifyPolicyExpiryGroup(policy: PolicyDto): PolicyExpiryGroup {
  if (!policy.is_active || policy.expiry_countdown.ledgers_remaining < 0) return 'expired';
  if (policy.expiry_countdown.ledgers_remaining <= EXPIRING_SOON_LEDGER_THRESHOLD) return 'expiringSoon';
  return 'active';
}

export function groupPoliciesByExpiry(policies: PolicyDto[]): Record<PolicyExpiryGroup, PolicyDto[]> {
  const groups: Record<PolicyExpiryGroup, PolicyDto[]> = { active: [], expiringSoon: [], expired: [] };
  for (const policy of policies) groups[classifyPolicyExpiryGroup(policy)].push(policy);
  return groups;
}
