'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/hooks/useAuth'
import { useWallet } from '@/hooks/use-wallet'
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/api/notifications'

// Metadata must be exported from a server component, but this page is 'use client'.
// The title is set on the parent settings layout / page instead.

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        <p id={`${id}-desc`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          checked ? 'bg-primary' : 'bg-input',
        ].join(' ')}
      >
        <span className="sr-only">{label}</span>
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

export default function NotificationsPage() {
  const { jwt } = useAuth()
  const { address } = useWallet()

  const [draft, setDraft] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!address || !jwt) {
      setLoading(false)
      return
    }
    setLoading(true)
    setFetchError(null)
    getNotificationPreferences(address, jwt)
      .then((p) => {
        setDraft(p)
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load preferences')
      })
      .finally(() => setLoading(false))
  }, [address, jwt])

  function handleToggle(key: keyof NotificationPreferences, value: boolean) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev)
    // Reset save status when user makes changes
    if (saveStatus === 'saved') setSaveStatus('idle')
  }

  async function handleSave() {
    if (!address || !jwt || !draft) return
    setSaveStatus('saving')
    setSaveError(null)
    try {
      await patchNotificationPreferences(address, draft, jwt)
      setSaveStatus('saved')
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save preferences')
      setSaveStatus('error')
    }
  }

  if (!address || !jwt) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold">Notification Preferences</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Connect your wallet to manage notification preferences.
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Notification Preferences</h1>

      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            Choose which events trigger email and browser notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading preferences…
            </div>
          )}

          {fetchError && (
            <p className="flex items-center gap-1 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {fetchError}
            </p>
          )}

          {!loading && !fetchError && draft && (
            <>
              <ToggleRow
                id="renewal-reminders"
                label="Policy renewal reminders"
                description="Get notified before your policy expires."
                checked={draft.renewalRemindersEnabled}
                onChange={(v) => handleToggle('renewalRemindersEnabled', v)}
              />
              <ToggleRow
                id="claim-updates"
                label="Claim status updates"
                description="Get notified when a claim you filed changes status."
                checked={draft.claimUpdatesEnabled}
                onChange={(v) => handleToggle('claimUpdatesEnabled', v)}
              />
              <ToggleRow
                id="vote-reminders"
                label="Vote reminders"
                description="Get notified about active governance votes you haven't cast yet."
                checked={draft.voteRemindersEnabled}
                onChange={(v) => handleToggle('voteRemindersEnabled', v)}
              />

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  aria-busy={saveStatus === 'saving'}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    'Save preferences'
                  )}
                </Button>

                {saveStatus === 'saved' && (
                  <p className="flex items-center gap-1 text-sm text-green-600" role="status" aria-live="polite">
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                    Preferences saved.
                  </p>
                )}

                {saveStatus === 'error' && saveError && (
                  <p className="flex items-center gap-1 text-sm text-destructive" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    {saveError}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
