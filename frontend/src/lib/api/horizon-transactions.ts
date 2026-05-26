import { getConfig } from '@/config/env'

export interface ContractEventDescription {
  description: string
  eventType?: string
}

export interface HorizonOperationRecord {
  id: string
  paging_token: string
  type: string
  type_int: number
  created_at: string
  transaction_hash: string
  transaction_successful: boolean
  source_account: string
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  amount?: string
  from?: string
  to?: string
  contractEvents?: ContractEventDescription[]
}

export interface HorizonTransactionsResponse {
  records: HorizonOperationRecord[]
  next_cursor?: string
  eventsEnriched?: boolean
}

export async function fetchHorizonTransactions(
  account: string,
  cursor?: string,
  limit = 20,
): Promise<HorizonTransactionsResponse> {
  const { apiUrl } = getConfig()
  const params = new URLSearchParams({
    account,
    limit: String(limit),
  })
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`${apiUrl}/api/horizon/transactions?${params}`)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = new Error(
      (err as { message?: string }).message ?? 'Failed to fetch transactions',
    ) as Error & { status: number }
    error.status = res.status
    throw error
  }

  return res.json() as Promise<HorizonTransactionsResponse>
}
