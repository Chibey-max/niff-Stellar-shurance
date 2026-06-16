# niffyInsure — Event Dictionary

> **Schema version: 1**  
> `SCHEMA_VERSION` in `events.rs` and `events.schema.ts` must stay in sync.  
> Breaking changes (field removed / type changed) → semver-major contract release + `SCHEMA_VERSION` bump.  
> Adding new optional fields is backward-compatible; no bump required.
>
> **Ownership:** the contract author is responsible for updating this file on every contract release.  
> CI enforces that every event name in `events.rs` has a corresponding entry here (see `.github/workflows/ci.yml` — `check-event-dictionary` job).

## Units

| Type | Unit | Notes |
|------|------|-------|
| Token amounts | **stroops** (i128 as string) | 1 XLM = 10 000 000 stroops (7 decimals). Never use floats. |
| Time | **ledger sequence** (u32) | 1 ledger ≈ 5 s on Stellar mainnet. Multiply by 5 for wall-clock seconds. |
| Boolean flags | **u32** (0 / 1) | Matches ABI encoding. `1 = true`, `0 = false`. |
| Addresses | **Stellar address string** | Holder = `G…`, contract/asset = `C…`. |
| Image reference | **FNV-1a u64 hash** | Hash of concatenated IPFS CIDs. Full CIDs stored off-chain. |

---

## Topic layout

Every event has at least two topics:

```
topic[0]  namespace   "niffyins" (claim/admin events) | "niffyinsure" (policy events)
topic[1]  event name  see table below
topic[2+] identifiers claim_id, holder, asset, … (event-specific)
```

The indexer discriminates events by `${topic[0]}:${topic[1]}`.

---

## Admin Audit Event (`namespace = "niffyinsure"`)

### `admin_action` — immutable admin audit trail

Emitted after every successful admin-authenticated entrypoint. Failed or unauthorized calls do not emit this event.

**Topics:** `("niffyinsure", "admin_action")`

```json
{
  "actor": "G...",
  "action_type": "set_token",
  "params": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `actor` | string (G...) | Authenticated account that authorized the admin operation |
| `action_type` | string | Stable machine-readable action name |
| `params` | object | String-keyed parameter map; currently emitted as `{}` to preserve the schema while avoiding address/string encoding ambiguity |

Stable `action_type` values:

`initialize`, `update_multiplier_table`, `admin_set_premium_multiplier`, `set_allowed_asset`, `admin_set_vote_duration_ledgers`, `admin_set_quorum_bps`, `set_grace_period_ledgers`, `process_claim`, `set_calculator`, `clear_calculator`, `admin_terminate_policy`, `propose_admin`, `accept_admin`, `cancel_admin`, `propose_admin_action`, `confirm_admin_action`, `cancel_admin_action`, `set_token`, `set_treasury`, `drain`, `sweep_token`, `set_sweep_cap`, `set_sweep_notice_period`, `admin_set_max_evidence_count`, `admin_set_gateway_allowlist`, `admin_set_asset_premium_table`, `pause`, `unpause`, `pause_bind`, `pause_claims`, `set_rolling_claim_cap`, `set_rolling_claim_window_ledgers`, `set_ttl_alert_threshold`, `gov_set_token_runtime_enabled`, `gov_set_token_address_stub`, `admin_set_open_claim_count`.

---

## Claim events  (`namespace = "niffyins"`)

### `clm_filed` — claim filed

**Topics:** `("niffyins", "clm_filed", claim_id: u64, holder: Address)`

```json
{
  "version": 1,
  "policy_id": 3,
  "amount": "5000000",
  "evidence_hashes": ["<32-byte hex>"],
  "filed_at": 1234567
}
```

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | u32 | Per-holder policy identifier |
| `amount` | string (stroops) | Requested payout |
| `evidence_hashes` | string[] | SHA-256 digests (32 bytes each); on-chain commitment only |
| `filed_at` | u32 (ledger) | Ledger when claim was filed |

---

### `vote_cast` — ballot cast

**Topics:** `("niffyins", "vote_cast", claim_id: u64, voter: Address)`

```json
{
  "version": 1,
  "vote": "Approve",
  "approve_votes": 2,
  "reject_votes": 1,
  "at_ledger": 1234568
}
```

| Field | Type | Description |
|-------|------|-------------|
| `vote` | `"Approve"` \| `"Reject"` | This voter's choice |
| `approve_votes` | u32 | Running approve tally after this vote |
| `reject_votes` | u32 | Running reject tally after this vote |

---

### `clm_final` — claim finalized

Emitted when voting reaches majority **or** the vote window expires.

**Topics:** `("niffyins", "clm_final", claim_id: u64)`

```json
{
  "version": 1,
  "status": "Approved",
  "approve_votes": 3,
  "reject_votes": 1,
  "at_ledger": 1355527
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"Approved"` \| `"Rejected"` | Final outcome |

---

### `clm_paid` — payout executed

**Topics:** `("niffyins", "clm_paid", claim_id: u64)`

```json
{
  "version": 1,
  "recipient": "G...",
  "amount": "5000000",
  "asset": "C...",
  "at_ledger": 1355528
}
```

| Field | Type | Description |
|-------|------|-------------|
| `amount` | string (stroops) | Actual payout transferred |
| `asset` | string (C…) | Asset contract used for payout |

---

### `payout_asset_override_applied` — policy payout asset override used

Emitted when claim settlement uses a policy-type payout asset override instead of
the premium asset stored on the policy.

**Topics:** `("niffyinsure", "payout_asset_override_applied", claim_id: u64)`

| Field | Type | Description |
|-------|------|-------------|
| `version` | u32 | Event schema version |
| `policy_type` | PolicyType | Policy type whose configuration supplied the override |
| `premium_asset` | string (C…) | Asset used for the policy premium |
| `payout_asset` | string (C…) | Asset used for the claim payout |

---

### `installment_disbursed` — partial claim payout executed

Emitted by `disburse_installment` for each partial payout on an approved claim.

**Topics:** `("niffyinsure", "installment_disbursed", claim_id: u64)`

| Field | Type | Description |
|-------|------|-------------|
| `version` | u32 | Event schema version |
| `recipient` | string (G… or C…) | Address receiving the installment |
| `amount` | string (stroops) | Amount disbursed in this installment |
| `paid_amount` | string (stroops) | Cumulative amount paid after this installment |
| `total_amount` | string (stroops) | Total approved claim amount |
| `installment_count` | u32 | Number of installments paid so far |
| `asset` | string (C…) | Asset contract used for payout |
| `at_ledger` | u32 (ledger) | Ledger when the installment was disbursed |

---

### `claim_fully_paid` — installment claim completed

Emitted by `disburse_installment` when cumulative installments fully satisfy the
net approved claim amount.

**Topics:** `("niffyinsure", "claim_fully_paid", claim_id: u64)`

| Field | Type | Description |
|-------|------|-------------|
| `version` | u32 | Event schema version |
| `recipient` | string (G… or C…) | Final payout recipient |
| `total_paid` | string (stroops) | Total amount paid across installments |
| `installment_count` | u32 | Number of installments used |
| `at_ledger` | u32 (ledger) | Ledger when the claim became fully paid |

---

### `claim_evidence_updated` — claim evidence replaced

Emitted when the claimant replaces evidence before any votes are cast.

**Topics:** `("niffyinsure", "claim_evidence_updated", claim_id: u64)`

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | u32 | Per-holder policy identifier |
| `evidence_hashes` | string[] | SHA-256 digests (32 bytes each); on-chain commitment only |
| `at_ledger` | u32 (ledger) | Ledger when evidence was updated |

---

### `payout_recipient_warning` — contract recipient payout warning

Emitted when payout is sent to a contract address so indexers can surface a
recipient-risk warning.

**Topics:** `("niffyinsure", "payout_recipient_warning", claim_id: u64)`

| Field | Type | Description |
|-------|------|-------------|
| `recipient` | string (C…) | Contract address receiving payout |
| `asset` | string (C…) | Asset contract used for payout |
| `at_ledger` | u32 (ledger) | Ledger when the warning was emitted |

---

### `claim_withdrawn` — claim withdrawn by claimant

Emitted when the claimant withdraws their own claim before any votes are cast.
Indexers must surface `Withdrawn` status distinctly on the claims board.

**Topics:** `("niffyinsure", "claim_withdrawn", claim_id: u64)`

```json
{
  "version": 1,
  "policy_id": 3,
  "claimant": "G...",
  "at_ledger": 1234600
}
```

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | u32 | Per-holder policy identifier |
| `claimant` | string (G…) | Address of the withdrawing claimant |
| `at_ledger` | u32 (ledger) | Ledger of withdrawal |

---

### `claim_status_changed` — claim status transition

Emitted on every claim status transition, including filing, vote resolution,
deadline finalization, payout, and withdrawal.

**Topics:** `("niffyins", "claim_status_changed", claim_id: u64)`

```json
{
  "version": 1,
  "old_status": "Processing",
  "new_status": "Approved",
  "at_ledger": 1355527
}
```

| Field | Type | Description |
|-------|------|-------------|
| `old_status` | ClaimStatus | Status before the transition (`Pending` is used for initial filing) |
| `new_status` | ClaimStatus | Status after the transition |
| `at_ledger` | u32 (ledger) | Ledger of the transition |

---

## Policy lifecycle events  (`namespace = "niffyinsure"`)

### `PolicyInitiated` — policy bound

**Topics:** `("niffyinsure", "PolicyInitiated", holder: Address)`

```json
{
  "version": 1,
  "policy_id": 1,
  "premium": "500000",
  "asset": "C...",
  "policy_type": "Auto",
  "region": "Medium",
  "coverage": "50000000",
  "start_ledger": 1234567,
  "end_ledger": 2285767
}
```

| Field | Type | Description |
|-------|------|-------------|
| `policy_id` | u32 | Per-holder identifier (not globally unique; use `holder + policy_id`) |
| `premium` | string (stroops) | Premium paid at bind time |
| `policy_type` | `"Auto"` \| `"Health"` \| `"Property"` | Coverage category |
| `region` | `"Low"` \| `"Medium"` \| `"High"` | Geographic risk tier |
| `coverage` | string (stroops) | Maximum payout |
| `end_ledger` | u32 (ledger) | Expiry ledger |

---

### `PolicyRenewed` — policy renewed

**Topics:** `("niffyinsure", "PolicyRenewed", holder: Address)`

```json
{
  "version": 1,
  "policy_id": 1,
  "premium": "500000",
  "new_end_ledger": 3336967,
  "old_coverage_type": "Basic",
  "new_coverage_type": "Standard",
  "old_coverage": "50000000",
  "new_coverage": "100000000"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `old_coverage_type` | CoverageTier | Coverage tier before renewal |
| `new_coverage_type` | CoverageTier | Coverage tier applied for the renewed term |
| `old_coverage` | string (stroops) | Coverage amount before renewal |
| `new_coverage` | string (stroops) | Coverage amount applied for the renewed term |

---

### `policy_terminated` — policy terminated

**Topics:** `("niffyinsure", "policy_terminated", holder: Address, policy_id: u32)`

```json
{
  "reason_code": 1,
  "terminated_by_admin": 0,
  "open_claim_bypass": 0,
  "open_claims": 0,
  "at_ledger": 1234600
}
```

| `reason_code` | Meaning |
|---------------|---------|
| 1 | VoluntaryCancellation |
| 2 | LapsedNonPayment |
| 3 | UnderwritingVoid |
| 4 | FraudOrMisrepresentation |
| 5 | RegulatoryAction |
| 6 | AdminOverride |

---

### `policy_expired` — policy expiry detected

Emitted at most once per `(holder, policy_id, expiry_ledger)` term, either by the
`process_expired` keeper entrypoint or by `renew_policy` when called on an already-expired policy.
May be emitted with a delay relative to the actual expiry ledger if no keeper call occurred at that ledger.

**Topics:** `("niffyinsure", "policy_expired", holder: Address, policy_id: u32)`

```json
{
  "expiry_ledger": 2285767,
  "reported_at_ledger": 2285800
}
```

| Field | Type | Description |
|-------|------|-------------|
| `expiry_ledger` | u32 (ledger) | Ledger at which the policy actually expired |
| `reported_at_ledger` | u32 (ledger) | Ledger when the event was emitted (may differ from expiry_ledger) |

> **Deduplication:** the backend notification service must deduplicate on `policy_id` to handle delayed keeper calls.

---

### `policy_transferred` — policy ownership transferred

Emitted when `transfer_policy` moves policy ownership from one holder to another.

**Topics:** `("niffyinsure", "policy_transferred", policy_id: u32, old_holder: Address, new_holder: Address)`

| Field | Type | Description |
|-------|------|-------------|
| `version` | u32 | Event schema version |
| `at_ledger` | u32 (ledger) | Ledger when ownership transferred |

---

### `BeneficiaryUpdated` — payout beneficiary changed

Emitted when a holder sets or changes their designated payout beneficiary.

**Topics:** `("niffyinsure", "BeneficiaryUpdated", holder: Address, policy_id: u32)`

```json
{
  "version": 1,
  "old_beneficiary": "G...",
  "new_beneficiary": "G...",
  "at_ledger": 1234700
}
```

| Field | Type | Description |
|-------|------|-------------|
| `old_beneficiary` | string (G…) \| null | Previous beneficiary; null if unset |
| `new_beneficiary` | string (G…) | New beneficiary address |

---

## Admin / config events  (`namespace = "niffyins"`)

| Event | Topics | Key payload fields |
|-------|--------|--------------------|
| `tbl_upd` | `(NS, "tbl_upd")` | `table_version: u32` |
| `asset_set` | `(NS, "asset_set", asset)` | `allowed: 0\|1`, `symbol_hint: string`, `decimals: u32` |
| `adm_prop` | `(NS, "adm_prop", old_admin, new_admin)` | `version` only |
| `adm_acc` | `(NS, "adm_acc", old_admin, new_admin)` | `version` only |
| `adm_can` | `(NS, "adm_can", admin, cancelled_pending)` | `version` only |
| `adm_tok` | `(NS, "adm_tok")` | `old_token`, `new_token` |
| `adm_paus` | `(NS, "adm_paus", admin)` | `paused: 0\|1` |
| `adm_drn` | `(NS, "adm_drn", admin)` | `recipient`, `amount` (stroops) |
| `quorum_updated` | `("niffyinsure", "quorum_updated")` | `old_bps: u32`, `new_bps: u32` |
| `GracePeriodUpdated` | `("niffyinsure", "GracePeriodUpdated", admin)` | `old_ledgers: u32`, `new_ledgers: u32` |
| `asset_premium_table_set` | `("niffyinsure", "asset_premium_table_set", asset)` | `table_version: u32`, `cleared: u32` |

### `quorum_updated` — DAO quorum threshold changed

**Topics:** `("niffyinsure", "quorum_updated")`

```json
{
  "version": 1,
  "old_bps": 5000,
  "new_bps": 6000
}
```

Does not retroactively affect claims already in `Processing`.

---

### `asset_premium_table_set` — asset-specific premium table changed

Emitted by `admin_set_asset_premium_table` when an asset-specific premium table
is set or cleared. `cleared = 1` means the asset falls back to the global table.

**Topics:** `("niffyinsure", "asset_premium_table_set", asset: Address)`

| Field | Type | Description |
|-------|------|-------------|
| `version` | u32 | Event schema version |
| `table_version` | u32 | Stored multiplier table version, or `0` when cleared |
| `cleared` | u32 | `1` when removed, `0` when stored |

---

### `GracePeriodUpdated` — renewal grace period changed

**Topics:** `("niffyinsure", "GracePeriodUpdated", admin: Address)`

```json
{
  "version": 1,
  "old_ledgers": 720,
  "new_ledgers": 1440
}
```

| Field | Type | Description |
|-------|------|-------------|
| `old_ledgers` | u32 | Previous grace period in ledgers |
| `new_ledgers` | u32 | New grace period in ledgers |

---

## Versioning & migration

1. `SCHEMA_VERSION` in `events.rs` and `events.schema.ts` must stay in sync.
2. A version bump is **required** when any field is removed or its type changes.
3. The `EVENT_PARSERS` table in `events.schema.ts` maps `version → parser`; add a new entry for each bump and keep old entries for historical replay.
4. CI regression tests in `events.test.ts` will fail on shape changes — this is intentional.

---

## What is NOT in events

- Raw IPFS URLs (use `image_hash` to look up off-chain).
- Claim description text.
- Voter lists (derive from `vote_cast` stream).
- PII of any kind.

---

## Read-only entrypoints

These entrypoints are callable via Soroban simulation without authentication.
They perform **no storage reads or writes** and are safe to call repeatedly.

### `version` — deployed contract semver

Returns the semver string stamped at build time from `Cargo.toml` (e.g. `"0.1.0"`).
No events emitted; no state mutation; no auth required.

| Property | Value |
|----------|-------|
| Auth required | None |
| State mutation | None |
| Return type | `String` — pure semver (`MAJOR.MINOR.PATCH`), no network or environment prefix |
| Callable via simulation | Yes |

**Backend usage:** the deployment registry calls `version()` via simulation immediately
after each deploy and records the result. If the returned value does not match the
expected `CARGO_PKG_VERSION` baked into the release artifact, the registry logs an error
and the deploy pipeline should halt and alert.

```
GET /chain/contract-version?source_account=G…
→ { "version": "0.1.0", "minResourceFee": "…" }
```
