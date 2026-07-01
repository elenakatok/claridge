import { Fragment, useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { submitLeadOutcome, submitConfirmation, type CallArgs } from '../api'
import { labelFor } from '@mygames/game-engine/roles'
import {
  claridgeConfig,
  claridgeSchema,
  validateContractSums,
  FIELD_LABELS,
  formatField,
  type OutcomeField as FieldDef,
  type OutcomeSchema,
} from '../gameConfig'

// ── Types ─────────────────────────────────────────────────────────────────────

type Confirmation = 'pending' | 'confirmed' | 'rejected'
type OutcomeFields = Record<string, unknown>

type GroupData = {
  status: string
  lead_outcome: OutcomeFields | null
  lead_reported_at: object | null
  confirmations: Record<string, Confirmation>
  // 3-role participant arrays — matching claridgeGameDef composition {claridge:1, tolemite:1, bard:1}
  claridge_participants: string[]
  tolemite_participants: string[]
  bard_participants: string[]
  lead_participant_id: string
  reset_count: number | undefined
  agreement_reached: boolean | null
}

type Props = {
  groupId: string
  participantId: string
  gameInstanceId: string
  isLead: boolean
  args: CallArgs
  onComplete: () => void
}

// ── Role determination — iterate all 3 participant arrays, no 2-way ternary ──

function deriveRoleKey(groupData: GroupData, participantId: string): string {
  if (groupData.claridge_participants.includes(participantId)) return 'claridge'
  if (groupData.tolemite_participants.includes(participantId)) return 'tolemite'
  if (groupData.bard_participants.includes(participantId)) return 'bard'
  // Fallback: unknown role — should not happen in a correctly seeded group.
  return 'claridge'
}

// ── Schema-driven form helpers ─────────────────────────────────────────────────

export type FormValues = Record<string, string | boolean>

function defaultFormValues(): FormValues {
  const out: FormValues = {}
  for (const field of claridgeSchema) {
    if (field.type === 'integer' || field.type === 'decimal') out[field.key] = ''
    else if (field.type === 'enum')    out[field.key] = ''   // no default — required pick
    else if (field.type === 'text')    out[field.key] = ''
    else                               out[field.key] = false
  }
  return out
}

type ParseOk  = { ok: true;  outcome: OutcomeFields }
type ParseErr = { ok: false; error: string }

export function parseForm(values: FormValues, schema: OutcomeSchema = claridgeSchema): ParseOk | ParseErr {
  const outcome: OutcomeFields = {}
  for (const field of schema) {
    const lbl = FIELD_LABELS[field.key] ?? field.key
    if (field.type === 'integer') {
      const raw = values[field.key] as string
      const n   = Number(raw)
      if (raw === '' || isNaN(n) || !Number.isInteger(n)) {
        return { ok: false, error: `${lbl} is required.` }
      }
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
        return { ok: false, error: `${lbl} must be between ${field.min ?? 0} and ${field.max ?? 0}.` }
      }
      outcome[field.key] = n
    } else if (field.type === 'decimal') {
      const raw = values[field.key] as string
      const n   = Number(raw)
      if (raw === '' || isNaN(n) || !Number.isFinite(n)) {
        return { ok: false, error: `${lbl} is required.` }
      }
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
        return { ok: false, error: `${lbl} must be between ${field.min ?? 0} and ${field.max ?? 0}.` }
      }
      if (field.step !== undefined && field.step > 0) {
        const q = n / field.step
        if (Math.abs(q - Math.round(q)) > 1e-9) return { ok: false, error: `${lbl} must be in steps of ${field.step}.` }
      }
      outcome[field.key] = n
    } else if (field.type === 'enum') {
      // Required pick — no default; submission invalid if unselected.
      const v = values[field.key] as string
      if (!field.options.includes(v)) {
        return { ok: false, error: `${lbl} is required — choose an option.` }
      }
      outcome[field.key] = v
    } else if (field.type === 'text') {
      // Optional free-text — blank is valid, stored as '' (never undefined), excluded from scoring.
      outcome[field.key] = (values[field.key] as string) ?? ''
    } else {
      outcome[field.key] = values[field.key]
    }
  }
  // Claridge cross-field constraint: T + B = C on each side.
  const sumError = validateContractSums(outcome)
  if (sumError) return { ok: false, error: sumError }
  return { ok: true, outcome }
}

// ── Sub-component: renders one schema field as an input ────────────────────────

export function SchemaField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef
  value: string | boolean
  onChange: (v: string | boolean) => void
  disabled: boolean
}) {
  const lbl = FIELD_LABELS[field.key] ?? field.key

  if (field.type === 'integer') {
    return (
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>{lbl}</label>
        <input
          type="number" min={field.min} max={field.max} step={1}
          value={value as string}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        />
        <span style={{ fontSize: '0.8rem', color: '#888' }}>{field.min ?? 0} – {field.max ?? 0}</span>
      </div>
    )
  }

  if (field.type === 'decimal') {
    return (
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>{lbl}</label>
        <input
          type="number" min={field.min} max={field.max} step={field.step ?? 'any'}
          value={value as string}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        />
        <span style={{ fontSize: '0.8rem', color: '#888' }}>{field.min ?? 0} – {field.max ?? 0}</span>
      </div>
    )
  }

  if (field.type === 'enum') {
    return (
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>{lbl}</label>
        <select
          value={value as string}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={inputStyle}
        >
          <option value="" disabled>— select —</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div style={fieldRowStyle}>
        <label style={fieldLabelStyle}>Notes</label>
        <textarea
          value={value as string}
          placeholder="Optional — any terms not captured above"
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          style={{ ...inputStyle, maxWidth: '100%', resize: 'vertical' as const }}
        />
      </div>
    )
  }

  // boolean → checkbox
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <input
        type="checkbox"
        id={`field-${field.key}`}
        checked={value as boolean}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: 18, height: 18 }}
      />
      <label htmlFor={`field-${field.key}`} style={fieldLabelStyle}>{lbl}</label>
    </div>
  )
}

// ── Claridge contract grid — 3 parties (rows) × 2 columns (Past | Future) ──────
// PRESENTATION ONLY. Each cell maps to the exact schema key the scoring reads —
// C_past/C_future, T_past/T_future, B_past/B_future — so the submitted outcome
// object is byte-identical to the old stacked form. Do NOT rename these keys.
// Columns: Past sales first (left), Future sales (right). Values are royalty %.

const GRID_COLUMNS = [
  { side: 'past',   header: 'Past sales' },
  { side: 'future', header: 'Future sales' },
] as const

const GRID_ROWS = [
  { label: 'Claridge pays',     keys: { past: 'C_past', future: 'C_future' } },
  { label: 'Tolemite receives', keys: { past: 'T_past', future: 'T_future' } },
  { label: 'BARD receives',     keys: { past: 'B_past', future: 'B_future' } },
] as const

// The shared Notes field (unchanged) — rendered below the grid.
export const NOTES_FIELD = claridgeSchema.find(f => f.key === 'notes') as FieldDef

// Exported so the instructor Reports editor renders the identical grid (no duplication).
export function ContractGrid({
  formValues,
  onChange,
  disabled,
}: {
  formValues: FormValues
  onChange: (key: string, v: string) => void
  disabled: boolean
}) {
  return (
    // Wrapper scrolls horizontally on a narrow screen rather than breaking the grid.
    <div style={gridWrapStyle}>
      <div style={gridStyle}>
        {/* Header row: empty corner + column headers */}
        <div />
        {GRID_COLUMNS.map(col => (
          <div key={col.side} style={gridColHeaderStyle}>
            {col.header}
            <span style={gridUnitStyle}>royalty %</span>
          </div>
        ))}

        {/* One row per party */}
        {GRID_ROWS.map(row => (
          <Fragment key={row.label}>
            <div style={gridRowLabelStyle}>{row.label}</div>
            {GRID_COLUMNS.map(col => {
              const key = row.keys[col.side]
              return (
                <div key={key} style={gridCellStyle}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={(formValues[key] as string) ?? ''}
                    onChange={e => onChange(key, e.target.value)}
                    disabled={disabled}
                    aria-label={`${row.label} — ${col.header} (royalty %)`}
                    style={gridInputStyle}
                  />
                  <span style={gridPctStyle}>%</span>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Sub-component: renders the outcome as a summary card ───────────────────────

function OutcomeCard({ outcome }: { outcome: OutcomeFields }) {
  return (
    <div style={outcomeCardStyle}>
      {claridgeSchema.map(field => (
        <div key={field.key} style={outcomeRowStyle}>
          <span style={outcomeLabelStyle}>{FIELD_LABELS[field.key] ?? field.key}</span>
          <span>{formatField(field, outcome[field.key])}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OutcomeReporting({
  groupId,
  participantId,
  gameInstanceId,
  isLead,
  args,
  onComplete,
}: Props) {
  const [groupData,     setGroupData]     = useState<GroupData | null>(null)
  const [formValues,    setFormValues]    = useState<FormValues>(defaultFormValues)
  const [pendingDeal,   setPendingDeal]   = useState<OutcomeFields | null>(null)
  const [pendingNoDeal, setPendingNoDeal] = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [formError,     setFormError]     = useState<string | null>(null)
  const [actionError,   setActionError]   = useState<string | null>(null)

  const calledComplete  = useRef(false)
  const onCompleteRef   = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    return onSnapshot(
      doc(db, 'game_instances', gameInstanceId, 'groups', groupId),
      snap => {
        if (!snap.exists()) return
        const d = snap.data() as GroupData
        setGroupData(d)
        if (d.status === 'completed' && !calledComplete.current) {
          calledComplete.current = true
          onCompleteRef.current()
        }
        if (d.lead_reported_at == null && d.status === 'reporting') {
          setFormValues(defaultFormValues())
          setFormError(null)
          setActionError(null)
          setPendingDeal(null)
          setPendingNoDeal(false)
        }
      },
    )
  }, [groupId, gameInstanceId])

  const withSubmit = (fn: () => Promise<unknown>) => {
    setSubmitting(true)
    setActionError(null)
    fn()
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Something went wrong.')
      })
      .finally(() => setSubmitting(false))
  }

  const handleFieldChange = (key: string, v: string | boolean) => {
    setFormValues(prev => ({ ...prev, [key]: v }))
    setFormError(null)
  }

  const handleSubmitForm = () => {
    const result = parseForm(formValues)
    if (!result.ok) { setFormError(result.error); return }
    setPendingDeal(result.outcome)
    setFormError(null)
  }

  const handleNoDeal = () => {
    setPendingNoDeal(true)
    setFormError(null)
    setActionError(null)
  }

  const handleCancelPending = () => {
    setPendingDeal(null)
    setPendingNoDeal(false)
  }

  const handleConfirmDeal = () => {
    const outcome = pendingDeal
    setPendingDeal(null)
    withSubmit(() => submitLeadOutcome(args, outcome))
  }

  const handleConfirmNoDeal = () => {
    setPendingNoDeal(false)
    withSubmit(() => submitLeadOutcome(args, null))
  }

  const handleConfirm = () => withSubmit(() => submitConfirmation(args, true))
  const handleReject  = () => withSubmit(() => submitConfirmation(args, false))

  if (!groupData) {
    return <main style={mainStyle}><p>Loading…</p></main>
  }

  const { status, lead_outcome, lead_reported_at, confirmations } = groupData
  const resetCount = groupData.reset_count ?? 0

  const roleKey   = deriveRoleKey(groupData, participantId)
  const roleLabel = labelFor(claridgeConfig, roleKey)

  const confirmedCount = Object.values(confirmations ?? {}).filter(v => v === 'confirmed').length
  const totalCount     = Object.keys(confirmations ?? {}).length

  if (status === 'deadlocked') {
    return (
      <main style={mainStyle}>
        <p style={subtitleStyle}>You are {roleLabel}</p>
        <h1 style={h1Style}>Instructor intervention needed</h1>
        <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#555' }}>
          Your group could not agree after 5 attempts. Your instructor will enter the outcome manually.
          Stay on this screen.
        </p>
      </main>
    )
  }

  if (status === 'completed') {
    return (
      <main style={mainStyle}>
        <p style={subtitleStyle}>You are {roleLabel}</p>
        <h1 style={h1Style}>Outcome locked</h1>
        {groupData.agreement_reached && lead_outcome != null ? (
          <OutcomeCard outcome={lead_outcome} />
        ) : (
          <p style={{ fontSize: '1.05rem', color: '#555' }}>No deal reached.</p>
        )}
      </main>
    )
  }

  if (isLead) {
    if (pendingDeal != null) {
      return (
        <main style={mainStyle}>
          <p style={subtitleStyle}>You are {roleLabel}</p>
          <h1 style={h1Style}>Confirm outcome</h1>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#555' }}>You entered:</p>
          <OutcomeCard outcome={pendingDeal} />
          <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Is that correct?</p>
          {actionError && <p style={errorStyle}>{actionError}</p>}
          <div style={btnRowStyle}>
            <button onClick={handleConfirmDeal} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Yes, submit'}
            </button>
            <button onClick={handleCancelPending} disabled={submitting} style={ghostBtnStyle}>
              No, go back
            </button>
          </div>
        </main>
      )
    }

    if (pendingNoDeal) {
      return (
        <main style={mainStyle}>
          <p style={subtitleStyle}>You are {roleLabel}</p>
          <h1 style={h1Style}>Confirm no deal</h1>
          <p style={{ marginBottom: '1rem' }}>
            Submit <strong>no deal</strong> — confirm your group could not settle and goes to court?
          </p>
          {actionError && <p style={errorStyle}>{actionError}</p>}
          <div style={btnRowStyle}>
            <button onClick={handleConfirmNoDeal} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Yes, no deal'}
            </button>
            <button onClick={handleCancelPending} disabled={submitting} style={ghostBtnStyle}>
              No, go back
            </button>
          </div>
        </main>
      )
    }

    if (lead_reported_at != null) {
      return (
        <main style={mainStyle}>
          <p style={subtitleStyle}>You are {roleLabel}</p>
          <h1 style={h1Style}>Waiting for your group</h1>
          {lead_outcome != null
            ? <OutcomeCard outcome={lead_outcome} />
            : <p style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>You reported: <strong>No deal</strong></p>}
          <p style={{ color: '#555' }}>
            {confirmedCount} of {totalCount} group member{totalCount !== 1 ? 's' : ''} confirmed.
          </p>
          {actionError && <p style={errorStyle}>{actionError}</p>}
        </main>
      )
    }

    return (
      <main style={mainStyle}>
        <p style={subtitleStyle}>You are {roleLabel}</p>
        <h1 style={h1Style}>Report outcome</h1>
        {resetCount > 0 && (
          <div style={resetBannerStyle}>
            A group member disagreed — coordinate and re-enter the outcome.
          </div>
        )}
        <p style={{ fontSize: '0.9rem', color: '#555', marginBottom: '1rem', lineHeight: 1.5 }}>
          In each column, Tolemite + BARD must equal what Claridge pays (T + B = C).
        </p>
        <div style={{ marginBottom: '1rem' }}>
          <ContractGrid
            formValues={formValues}
            onChange={handleFieldChange}
            disabled={submitting}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <SchemaField
            field={NOTES_FIELD}
            value={(formValues['notes'] as string) ?? ''}
            onChange={v => handleFieldChange('notes', v)}
            disabled={submitting}
          />
        </div>
        {formError   && <p style={errorStyle}>{formError}</p>}
        {actionError && <p style={errorStyle}>{actionError}</p>}
        <div style={btnRowStyle}>
          <button onClick={handleSubmitForm} disabled={submitting}>
            Review &amp; submit
          </button>
          <button onClick={handleNoDeal} disabled={submitting} style={ghostBtnStyle}>
            No deal
          </button>
        </div>
      </main>
    )
  }

  // ── Non-lead view ─────────────────────────────────────────────────────────────

  if (lead_reported_at == null) {
    return (
      <main style={mainStyle}>
        <p style={subtitleStyle}>You are {roleLabel}</p>
        <h1 style={h1Style}>Waiting for the outcome</h1>
        <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: '#555' }}>
          {resetCount > 0
            ? 'A disagreement was logged. The lead is re-entering the outcome.'
            : 'Your group lead is reporting the negotiation result. Stay on this page.'}
        </p>
      </main>
    )
  }

  const myConf = confirmations[participantId]

  if (myConf === 'pending') {
    return (
      <main style={mainStyle}>
        <p style={subtitleStyle}>You are {roleLabel}</p>
        <h1 style={h1Style}>Confirm the outcome</h1>
        {lead_outcome != null ? (
          <>
            <p style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: '#555' }}>
              Your lead reported:
            </p>
            <OutcomeCard outcome={lead_outcome} />
          </>
        ) : (
          <p style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
            Your lead reported: <strong>No deal</strong>
          </p>
        )}
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>Does this match what you negotiated?</p>
        {actionError && <p style={errorStyle}>{actionError}</p>}
        <div style={btnRowStyle}>
          <button onClick={handleConfirm} disabled={submitting}>
            {submitting ? '…' : 'Confirm'}
          </button>
          <button onClick={handleReject} disabled={submitting} style={ghostBtnStyle}>
            Reject
          </button>
        </div>
      </main>
    )
  }

  return (
    <main style={mainStyle}>
      <p style={subtitleStyle}>You are {roleLabel}</p>
      <h1 style={h1Style}>Waiting for your group</h1>
      {lead_outcome != null
        ? <OutcomeCard outcome={lead_outcome} />
        : <p style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>You confirmed: <strong>No deal</strong></p>}
      <p style={{ color: '#555' }}>
        {confirmedCount} of {totalCount} member{totalCount !== 1 ? 's' : ''} confirmed.
      </p>
    </main>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const mainStyle = { padding: '2rem', maxWidth: '640px', margin: '0 auto', fontFamily: 'sans-serif' }
const h1Style = { marginTop: 0 }
const subtitleStyle = { color: '#555', marginTop: 0, marginBottom: '1.25rem' }
const errorStyle = { color: '#c00', marginBottom: '0.75rem' }
const resetBannerStyle = { color: '#c00', background: '#fff5f5', padding: '0.6rem 0.8rem', borderRadius: 4, marginBottom: '1rem', fontSize: '0.95rem' }
const btnRowStyle = { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' as const, alignItems: 'center' }
const ghostBtnStyle = { background: 'none', border: '1px solid #ccc' }
const outcomeCardStyle = { background: '#f0f7ff', border: '1px solid #b3d4f5', borderRadius: 4, padding: '0.75rem 1rem', marginBottom: '1rem' }
const outcomeRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }
const outcomeLabelStyle = { color: '#555', marginRight: '1rem' }
const fieldRowStyle = { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem', marginBottom: '1rem' }
const fieldLabelStyle = { fontSize: '0.9rem', fontWeight: 600, color: '#333' }
const inputStyle = { fontSize: '1rem', padding: '0.4rem 0.6rem', border: '1px solid #ccc', borderRadius: 4, maxWidth: '16rem' }

// ── Contract-grid styles (3 rows × 2 cols) ──────────────────────────────────────
const gridWrapStyle = { overflowX: 'auto' as const, WebkitOverflowScrolling: 'touch' as const, paddingBottom: '0.25rem' }
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(8.5rem, max-content) minmax(6.5rem, 1fr) minmax(6.5rem, 1fr)',
  columnGap: '0.75rem',
  rowGap: '0.6rem',
  alignItems: 'center' as const,
  minWidth: '20rem',
}
const gridColHeaderStyle = {
  display: 'flex', flexDirection: 'column' as const,
  fontSize: '0.9rem', fontWeight: 700, color: '#333',
  paddingBottom: '0.3rem', borderBottom: '2px solid #e2e8f0',
}
const gridUnitStyle = { fontSize: '0.72rem', fontWeight: 400, color: '#888' }
const gridRowLabelStyle = { fontSize: '0.9rem', fontWeight: 600, color: '#333', paddingRight: '0.5rem' }
const gridCellStyle = { position: 'relative' as const }
const gridInputStyle = {
  fontSize: '1rem', padding: '0.4rem 1.8rem 0.4rem 0.6rem',
  border: '1px solid #ccc', borderRadius: 4, width: '100%', boxSizing: 'border-box' as const,
}
const gridPctStyle = {
  position: 'absolute' as const, right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
  color: '#888', fontSize: '0.9rem', pointerEvents: 'none' as const,
}
