import { type RoleConfig } from '@mygames/game-engine/roles'
import { type OutcomeField, type OutcomeSchema } from '@mygames/game-engine/outcome'

export type { RoleConfig, OutcomeField, OutcomeSchema }

export const claridgeConfig: RoleConfig = {
  roles: [
    { key: 'claridge', label: 'Claridge', short: 'C' },
    { key: 'tolemite', label: 'Tolemite', short: 'T' },
    { key: 'bard',     label: 'BARD',     short: 'B' },
  ],
}

// Mirrors functions/src/gameDefinition.ts. Six decimal royalty-point fields in two
// constrained pairs (T + B = C on each side) + the optional Notes text field.
export const claridgeSchema: OutcomeSchema = [
  { key: 'C_future', type: 'decimal', min: 0, max: 100 },  // Claridge pays — future
  { key: 'T_future', type: 'decimal', min: 0, max: 100 },  // Tolemite share — future
  { key: 'B_future', type: 'decimal', min: 0, max: 100 },  // BARD share — future
  { key: 'C_past',   type: 'decimal', min: 0, max: 100 },  // Claridge pays — past
  { key: 'T_past',   type: 'decimal', min: 0, max: 100 },  // Tolemite share — past
  { key: 'B_past',   type: 'decimal', min: 0, max: 100 },  // BARD share — past
  { key: 'notes',    type: 'text' },                       // optional free-text; blank = ''
]

export const FIELD_LABELS: Readonly<Record<string, string>> = {
  C_future: 'Claridge rate — future (C)',
  T_future: 'Tolemite share — future (T)',
  B_future: 'BARD share — future (B)',
  C_past:   'Claridge rate — past (C)',
  T_past:   'Tolemite share — past (T)',
  B_past:   'BARD share — past (B)',
  notes:    'Notes',
}

// ── Cross-field constraint (T + B = C on each side) ──────────────────────────
// Client mirror of functions/src/gameDefinition.ts validateContractSums — keeps the
// outcome form, the deadlock control, and the Reports inline editor in sync with the
// server. Returns an error string, or null when both sides balance.
const SUM_TOLERANCE = 1e-6

export function validateContractSums(outcome: Record<string, unknown>): string | null {
  const num = (k: string) => Number(outcome[k])
  const cf = num('C_future'), tf = num('T_future'), bf = num('B_future')
  const cp = num('C_past'),   tp = num('T_past'),   bp = num('B_past')
  if ([cf, tf, bf, cp, tp, bp].some(n => !Number.isFinite(n))) return null
  if (Math.abs(tf + bf - cf) > SUM_TOLERANCE) {
    return 'Future side: Tolemite + BARD must equal Claridge’s royalty rate (T + B = C).'
  }
  if (Math.abs(tp + bp - cp) > SUM_TOLERANCE) {
    return 'Past side: Tolemite + BARD must equal Claridge’s royalty rate (T + B = C).'
  }
  return null
}

export function formatField(field: OutcomeField, value: unknown): string {
  if (field.type === 'integer') return (value as number).toLocaleString('en-US')
  if (field.type === 'decimal') return (value as number).toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (field.type === 'enum')    return value as string
  if (field.type === 'boolean') return (value as boolean) ? 'Yes' : 'No'
  return String(value)
}
