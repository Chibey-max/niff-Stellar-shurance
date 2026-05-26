/**
 * @jest-environment jsdom
 */

import {
  sanitizeAnalyticsProps,
  trackClaimFiled,
  trackPageView,
  trackPolicyInitiated,
  trackQuoteSubmitted,
  trackVoteCast,
} from '@/lib/analytics'
import { setCookieConsent, COOKIE_CONSENT_KEY } from '@/lib/cookie-consent'

const WALLET = 'GBCPNZ6S7RK5N4BX6HBXBCX7P5QNBOJZFGDWBZBXCLK5T6KHWOPTLR3I'

describe('analytics consent gating', () => {
  const plausible = jest.fn()

  beforeEach(() => {
    localStorage.clear()
    plausible.mockClear()
    window.plausible = plausible
  })

  afterEach(() => {
    delete window.plausible
  })

  it('does not fire events before consent is given', () => {
    trackPageView('/policies')
    trackQuoteSubmitted({
      policyType: 'Auto',
      region: 'Low',
      coverageTier: 'Basic',
    })
    trackPolicyInitiated()
    trackClaimFiled()
    trackVoteCast('approve')

    expect(plausible).not.toHaveBeenCalled()
  })

  it('does not fire events when consent is declined', () => {
    setCookieConsent('declined')
    trackPageView('/claims')
    expect(plausible).not.toHaveBeenCalled()
  })

  it('fires each tracked event after consent is accepted', () => {
    setCookieConsent('accepted')

    trackPageView('/')
    trackQuoteSubmitted({
      policyType: 'Health',
      region: 'Medium',
      coverageTier: 'Standard',
    })
    trackPolicyInitiated()
    trackClaimFiled()
    trackVoteCast('reject')

    expect(plausible).toHaveBeenCalledTimes(5)
    expect(plausible).toHaveBeenCalledWith('page_view', { props: { path: '/' } })
    expect(plausible).toHaveBeenCalledWith('quote_submitted', {
      props: {
        policy_type: 'Health',
        region: 'Medium',
        coverage_tier: 'Standard',
      },
    })
    expect(plausible).toHaveBeenCalledWith('policy_initiated', undefined)
    expect(plausible).toHaveBeenCalledWith('claim_filed', undefined)
    expect(plausible).toHaveBeenCalledWith('vote_cast', {
      props: { vote_direction: 'reject' },
    })
  })
})

describe('sanitizeAnalyticsProps', () => {
  it('strips wallet addresses and PII keys from event payloads', () => {
    const sanitized = sanitizeAnalyticsProps({
      policy_type: 'Auto',
      wallet_address: WALLET,
      source_account: WALLET,
      email: 'user@example.com',
      vote_direction: 'approve',
    })

    expect(sanitized).toEqual({
      policy_type: 'Auto',
      vote_direction: 'approve',
    })
    expect(JSON.stringify(sanitized)).not.toContain(WALLET)
    expect(JSON.stringify(sanitized)).not.toContain('user@example.com')
  })
})

describe('analytics consent persistence', () => {
  it('respects stored consent from localStorage', () => {
    const expiresAt = Date.now() + 86400000
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({ value: 'accepted', expiresAt }),
    )
    window.plausible = jest.fn()

    trackPageView('/policies')
    expect(window.plausible).toHaveBeenCalledWith('page_view', {
      props: { path: '/policies' },
    })
  })
})
