import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { InstructorDashboard as SharedDashboard, type DeadlockResolutionProps, type OutcomeFields } from '@mygames/game-ui'
import { auth, functions, rtdb } from '../firebase'
import { claridgeConfig, validateContractSums } from '../gameConfig'

// ── Role labels from game config ──────────────────────────────────────────────

const roleLabels = Object.fromEntries(
  claridgeConfig.roles.map(r => [r.key, r.label])
)

// ── Deadlock resolution control ───────────────────────────────────────────────
// For Claridge a deadlock means the parties went to court: the instructor enters
// the simulated court terms here as the agreed settlement (T + B = C on each side).

const CONTRACT_FIELDS = [
  { key: 'C_future', label: 'Claridge rate — future (C)' },
  { key: 'T_future', label: 'Tolemite share — future (T)' },
  { key: 'B_future', label: 'BARD share — future (B)' },
  { key: 'C_past',   label: 'Claridge rate — past (C)' },
  { key: 'T_past',   label: 'Tolemite share — past (T)' },
  { key: 'B_past',   label: 'BARD share — past (B)' },
] as const

function ClaridgeDeadlockControl({ submitting, error, onSubmit }: DeadlockResolutionProps) {
  const blank = Object.fromEntries(CONTRACT_FIELDS.map(f => [f.key, ''])) as Record<string, string>
  const [vals,    setVals]    = useState<Record<string, string>>(blank)
  const [notes,   setNotes]   = useState('')
  const [noDeal,  setNoDeal]  = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const handleSubmit = () => {
    if (noDeal) { onSubmit({ no_deal: true }); return }
    const outcome: OutcomeFields = { notes }
    for (const f of CONTRACT_FIELDS) {
      const n = Number(vals[f.key])
      if (vals[f.key] === '' || isNaN(n) || !isFinite(n)) { setLocalErr(`${f.label} is required.`); return }
      outcome[f.key] = n
    }
    const sumError = validateContractSums(outcome)
    if (sumError) { setLocalErr(sumError); return }
    setLocalErr(null)
    onSubmit(outcome)
  }

  const inputStyle: React.CSSProperties = {
    fontSize: '0.875rem', padding: '0.3rem 0.5rem', borderRadius: 3, border: '1px solid #ccc', width: '9rem',
  }
  const fieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {!noDeal && (
        <>
          {CONTRACT_FIELDS.map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={{ fontSize: '0.875rem', minWidth: '12rem' }}>{f.label}</label>
              <input
                type="number" step="any" placeholder="e.g. 7"
                value={vals[f.key]}
                onChange={e => { setVals(prev => ({ ...prev, [f.key]: e.target.value })); setLocalErr(null) }}
                style={inputStyle} disabled={submitting}
              />
            </div>
          ))}
          <div style={fieldStyle}>
            <label style={{ fontSize: '0.875rem', minWidth: '12rem' }}>Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ ...inputStyle, width: '16rem' }} disabled={submitting}
            />
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '…' : noDeal ? 'Confirm No Deal' : 'Lock Deal'}
        </button>
        <button onClick={() => { setNoDeal(v => !v); setLocalErr(null) }} disabled={submitting} style={{ background: 'none', border: '1px solid #ccc' }}>
          {noDeal ? 'Enter court terms instead' : 'No deal'}
        </button>
      </div>
      {(localErr || error) && <p style={{ color: '#c00', fontSize: '0.8rem', margin: 0 }}>{localErr ?? error}</p>}
    </div>
  )
}

// ── Submit instructor outcome ─────────────────────────────────────────────────

async function submitInstructorOutcome(groupId: string, outcome: OutcomeFields): Promise<void> {
  const fn = httpsCallable(functions, 'submitInstructorOutcome')
  await fn({ group_id: groupId, outcome })
}

// ── Page component ────────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  return (
    <SharedDashboard
      title="Instructor Dashboard — Claridge"
      roleLabels={roleLabels}
      DeadlockResolutionControl={ClaridgeDeadlockControl}
      submitInstructorOutcome={submitInstructorOutcome}
      functions={functions}
      auth={auth}
      rtdb={rtdb}
      settingsRoute="/settings"
      reportsRoute="/reports"
      scoreAndRecord={{ callableName: 'scoreAndRecord', label: 'Score & Record' }}
    />
  )
}
