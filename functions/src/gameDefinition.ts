import type { Outcome, OutcomeSchema, RoleConfig } from '@mygames/game-engine'
import type { GameDefinition } from '@mygames/game-server'
// Shared latecomer joinability (Latecomer_Placement_Spec_v1 §3.1) — one predicate for all five negotiation games.
import { negotiationIsJoinable } from '@mygames/game-server'

// ── Role config ───────────────────────────────────────────────────────────────
// Frozen role keys: 'claridge', 'tolemite', 'bard'. The C.K. Claridge patent
// settlement: Claridge (C) is the defendant who pays the settlement royalty;
// Tolemite (T) owns the patent; BARD (B) is the licensee. One of each per group.

export const claridgeConfig: RoleConfig = {
  roles: [
    { key: 'claridge', label: 'Claridge', short: 'C' },
    { key: 'tolemite', label: 'Tolemite', short: 'T' },
    { key: 'bard',     label: 'BARD',     short: 'B' },
  ],
}

// ── Outcome schema (the settlement contract) ─────────────────────────────────
// Six decimal royalty-point fields in TWO constrained pairs, plus the shared
// optional Notes text field. C sets the royalty rate it pays on each side
// (future, past); T and B split that rate. The split must SUM to C on each side:
//   T_future + B_future = C_future   and   T_past + B_past = C_past
// That cross-field constraint is NOT expressible in OutcomeSchema (per-field only),
// so it is enforced in validateContractSums() — see updateGroupContract (server)
// and the outcome form / inline editor (client). Range 0–100 (royalty points / %).
export const claridgeSchema: OutcomeSchema = [
  { key: 'C_future', type: 'decimal', min: 0, max: 100 },  // Claridge pays — future
  { key: 'T_future', type: 'decimal', min: 0, max: 100 },  // Tolemite share — future
  { key: 'B_future', type: 'decimal', min: 0, max: 100 },  // BARD share — future
  { key: 'C_past',   type: 'decimal', min: 0, max: 100 },  // Claridge pays — past
  { key: 'T_past',   type: 'decimal', min: 0, max: 100 },  // Tolemite share — past
  { key: 'B_past',   type: 'decimal', min: 0, max: 100 },  // BARD share — past
  { key: 'notes',    type: 'text' },                       // optional free-text; blank = ''
]

// ── Cross-field constraint (T + B = C on each side) ──────────────────────────
// Shared by the server (updateGroupContract) and the client form/editor so the
// message is identical everywhere. Tolerance 1e-6 absorbs decimal float noise.
const SUM_TOLERANCE = 1e-6

export function validateContractSums(outcome: Record<string, unknown>): string | null {
  const num = (k: string) => Number(outcome[k])
  const cf = num('C_future'), tf = num('T_future'), bf = num('B_future')
  const cp = num('C_past'),   tp = num('T_past'),   bp = num('B_past')
  if ([cf, tf, bf, cp, tp, bp].some(n => !Number.isFinite(n))) return null  // per-field validation handles non-numbers
  if (Math.abs(tf + bf - cf) > SUM_TOLERANCE) {
    return 'Future side: Tolemite + BARD must equal Claridge’s royalty rate (T_future + B_future = C_future).'
  }
  if (Math.abs(tp + bp - cp) > SUM_TOLERANCE) {
    return 'Past side: Tolemite + BARD must equal Claridge’s royalty rate (T_past + B_past = C_past).'
  }
  return null
}

// ── Score sense (all value-sense — higher raw_score = better for that role) ──
// Claridge pays, so its raw_score is negative; among Claridges, a higher (less
// negative) score is better → 'value' sense. Tolemite/BARD want more → 'value'.
export const claridgeScoreSense: Record<string, 'value' | 'cost'> = {
  claridge: 'value',
  tolemite: 'value',
  bard:     'value',
}

// ── Scoring (spec-locked; weighted average, future 2/3, past 1/3) ────────────
//   C_score = −( (2/3)·C_future + (1/3)·C_past )   (negative: Claridge pays)
//   T_score =    (2/3)·T_future + (1/3)·T_past
//   B_score =    (2/3)·B_future + (1/3)·B_past
// Conservation: with T+B=C on each side, C_score + T_score + B_score = 0 for every
// valid contract (used as an internal sanity assertion in the conformance test).
// No-deal (null outcome) → 0 for every role, which also satisfies 0+0+0=0; the
// instructor enters simulated court outcomes via the inline editor (no auto-zero
// special-casing needed — see updateGroupContract / scoreAndRecord).

const FUTURE_W = 2 / 3
const PAST_W = 1 / 3

// Round to 3 decimals: reproduces the frozen conformance vector exactly and keeps
// stored scores clean; immaterial to the z-score distribution.
function round3(x: number): number {
  return Math.round(x * 1000) / 1000
}

function weighted(future: number, past: number): number {
  return FUTURE_W * future + PAST_W * past
}

export function computeScoreBreakdown(
  roleKey: string,
  outcome: Outcome | null,
  _configData?: Record<string, unknown>,
): { value_or_cost: number; raw_score: number } {
  // No-deal / walk-away: zero for every role (stays in the scored pool).
  if (outcome === null) return { value_or_cost: 0, raw_score: 0 }

  if (roleKey === 'claridge') {
    const cost = weighted(Number(outcome['C_future'] ?? 0), Number(outcome['C_past'] ?? 0))
    return { value_or_cost: round3(cost), raw_score: round3(-cost) }
  }
  if (roleKey === 'tolemite') {
    const value = weighted(Number(outcome['T_future'] ?? 0), Number(outcome['T_past'] ?? 0))
    return { value_or_cost: round3(value), raw_score: round3(value) }
  }
  if (roleKey === 'bard') {
    const value = weighted(Number(outcome['B_future'] ?? 0), Number(outcome['B_past'] ?? 0))
    return { value_or_cost: round3(value), raw_score: round3(value) }
  }
  return { value_or_cost: 0, raw_score: 0 }
}

export function computeRawScore(
  roleKey: string,
  outcome: Outcome | null,
  configData?: Record<string, unknown>,
): number {
  return computeScoreBreakdown(roleKey, outcome, configData).raw_score
}

// ── GameDefinition ───────────────────────────────────────────────────────────

export const claridgeGameDef: GameDefinition = {
  game_id: 'claridge',
  roles:   claridgeConfig,
  scoreSense: claridgeScoreSense,
  composition: { claridge: 1, tolemite: 1, bard: 1 },
  outcomeSchema: claridgeSchema,
  computeRawScore,
  computeScoreBreakdown,
  reservations: { claridge: 0, tolemite: 0, bard: 0 },
  corsOrigins: ['https://claridge.mygames.live'],
  classroom: { callbackSecretId: 'claridge_v1' },
  // Latecomer auto-placement (spec §3.1). Joinable = group not yet negotiating.
  // No onPlace: negotiation placement is group_id only (audit 0b).
  isJoinable: negotiationIsJoinable,

  configFields: [
    { key: 'claridge_role_name', kind: 'string', default: 'Claridge' },
    { key: 'tolemite_role_name', kind: 'string', default: 'Tolemite' },
    { key: 'bard_role_name',     kind: 'string', default: 'BARD'     },
    // One shared public case document (no per-role packets) — all three roles link it.
    { key: 'claridge_sheet_url', kind: 'url', default: '/role-info/claridge.pdf' },
    { key: 'tolemite_sheet_url', kind: 'url', default: '/role-info/claridge.pdf' },
    { key: 'bard_sheet_url',     kind: 'url', default: '/role-info/claridge.pdf' },
  ],

  roleInfoLinks: [
    { roleKey: 'claridge', links: [{ key: 'claridge_sheet_url', label: 'Case document' }] },
    { roleKey: 'tolemite', links: [{ key: 'tolemite_sheet_url', label: 'Case document' }] },
    { roleKey: 'bard',     links: [{ key: 'bard_sheet_url',     label: 'Case document' }] },
  ],

  // ── Knowledge-check + prep questions (from Claridge_KC_Questions_v1.md) ──────
  // Graded denominator is 5 for every role: Q2–Q6 are role_target 'all' static MC.
  // Q1 is the role-ID gate (one per role, grading 'assigned_role', NEVER counted in
  // the numerator/denominator). Q7 is an open-response prep reflection (ungraded).
  prepDefaults: [
    // ── Q1 — Role-ID gates (system, one per role; ungraded) ───────────────────
    {
      field: 'kc_gate_claridge', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'claridge',
      prompt: 'What is your role in the negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'claridge', label: 'Claridge (the defendant settling the patent suit)' },
        { value: 'tolemite', label: 'Tolemite (the patent owner)' },
        { value: 'bard',     label: 'BARD (the licensee)' },
      ],
      explanation: 'You are Claridge, the defendant negotiating the settlement royalty it will pay.',
    },
    {
      field: 'kc_gate_tolemite', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'tolemite',
      prompt: 'What is your role in the negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'claridge', label: 'Claridge (the defendant settling the patent suit)' },
        { value: 'tolemite', label: 'Tolemite (the patent owner)' },
        { value: 'bard',     label: 'BARD (the licensee)' },
      ],
      explanation: 'You are Tolemite, the patent owner negotiating your share of the settlement.',
    },
    {
      field: 'kc_gate_bard', type: 'mc', system: true,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'assigned_role', role_target: 'bard',
      prompt: 'What is your role in the negotiation?',
      placeholder: '', order: 0, hidden: false, deletable: false,
      options: [
        { value: 'claridge', label: 'Claridge (the defendant settling the patent suit)' },
        { value: 'tolemite', label: 'Tolemite (the patent owner)' },
        { value: 'bard',     label: 'BARD (the licensee)' },
      ],
      explanation: 'You are BARD, the licensee negotiating your share of the settlement.',
    },

    // ── Q2 — graded MC (case facts: the Varacil market) ───────────────────────
    {
      field: 'kc_market_varacil', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'bard66_clar11', role_target: 'all',
      prompt: 'Which of the following correctly specifies the market for Varacil?',
      placeholder: '', order: 10, hidden: false, deletable: false,
      options: [
        { value: 'bard66_clar11', label: 'BARD holds about 66% of the market and Claridge about 11%; Tolemite licenses its Varacil patent to BARD.' },
        { value: 'clar66_bard11', label: 'Claridge holds about 66% of the market and BARD about 11%; Tolemite licenses its Varacil patent to Claridge.' },
        { value: 'tol_makes',     label: 'Tolemite manufactures and sells Varacil directly; BARD and Claridge are only distributors.' },
        { value: 'equal_thirds',  label: 'BARD, Claridge and Tolemite each hold roughly one-third of the Varacil market.' },
      ],
      explanation: 'BARD is the dominant seller of Varacil (about two-thirds of the market) and Claridge a much smaller participant (about one-tenth); Tolemite is the patent owner that licenses the Varacil patent to BARD rather than making the drug itself.',
    },

    // ── Q3 — graded MC (case facts: the upheld-patent royalty split) ──────────
    {
      field: 'kc_royalty_split', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'tol40_bard60', role_target: 'all',
      prompt: 'If the patent is upheld, how is the 10% royalty split between Tolemite and BARD?',
      placeholder: '', order: 11, hidden: false, deletable: false,
      options: [
        { value: 'tol40_bard60', label: 'Tolemite gets 40% of the total royalty and BARD gets 60%.' },
        { value: 'tol60_bard40', label: 'Tolemite gets 60% of the total royalty and BARD gets 40%.' },
        { value: 'even_split',   label: 'Tolemite and BARD split the royalty evenly, 50/50.' },
        { value: 'tol_all',      label: 'Tolemite takes the entire 10% royalty; BARD receives nothing.' },
      ],
      explanation: 'Of the 10% royalty payable when the patent is upheld, Tolemite receives 40% of the total and BARD the remaining 60%.',
    },

    // ── Q4 — graded MC (case analysis: Schilling’s "4% lost advantage") ───────
    {
      field: 'kc_lost_advantage', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'price_drop', role_target: 'all',
      prompt: 'Schilling’s "4% lost competitive advantage" is best defined as:',
      placeholder: '', order: 12, hidden: false, deletable: false,
      options: [
        { value: 'price_drop',    label: 'the amount Schilling assumes BARD will drop its Varacil price by if Tolemite loses in court.' },
        { value: 'royalty_cut',   label: 'the reduction in the royalty rate Tolemite would accept to settle out of court.' },
        { value: 'market_share',  label: 'the share of the Varacil market Claridge expects to gain from BARD over the next year.' },
        { value: 'legal_cost',    label: 'the fraction of expected legal costs each party avoids by settling rather than litigating.' },
      ],
      explanation: 'The "4% lost competitive advantage" is Schilling’s estimate of how far BARD would cut its Varacil price if Tolemite were to lose the patent suit — a price drop that erodes the competitive advantage the patent confers.',
    },

    // ── Q5 — graded MC (reading: "3-D Negotiation", scanning widely) ──────────
    {
      field: 'kc_3d_scanning', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'interests_batnas_relations', role_target: 'all',
      prompt: 'According to "3-D Negotiation", a party that "scans widely" should map which of the following?',
      placeholder: '', order: 13, hidden: false, deletable: false,
      options: [
        { value: 'interests_batnas_relations', label: 'The parties’ interests and BATNAs, the cost and difficulty of agreement with each, and the crucial relationships among them — who influences whom and who would find it costly to oppose an emerging deal.' },
        { value: 'only_at_table',              label: 'Only the positions of the parties currently seated at the table, since anyone not present cannot affect the deal.' },
        { value: 'price_only',                 label: 'Only the price each party is willing to accept, because every other issue ultimately reduces to price.' },
        { value: 'legal_precedent',            label: 'Only the legal precedents a court would apply, since the law determines the outcome regardless of the parties’ interests.' },
      ],
      explanation: 'Scanning widely means looking beyond the table: mapping all the relevant parties’ interests and BATNAs, how hard or costly agreement with each would be, and the web of relationships — who influences whom, and who could block or would find it costly to oppose a deal as it takes shape.',
    },

    // ── Q6 — graded MC (reading: "3-D Negotiation", sequence & publicity) ─────
    {
      field: 'kc_3d_sequence', type: 'mc', system: false,
      category: 'knowledge_check', format: 'multiple_choice',
      grading: 'static', correct_value: 'info_leakage', role_target: 'all',
      prompt: 'In "3-D Negotiation", why does controlling the sequence of linked talks — and whether their results become public — matter?',
      placeholder: '', order: 14, hidden: false, deletable: false,
      options: [
        { value: 'info_leakage',   label: 'Because revealing the order or outcome of one negotiation can hand valuable information to a later counterpart, so deciding what each party learns and when can strongly influence the final outcome.' },
        { value: 'fairness_rule',  label: 'Because negotiation etiquette requires that all linked talks be conducted in alphabetical order and disclosed to every party at once.' },
        { value: 'legal_required', label: 'Because the law requires that the results of linked negotiations be made public in the order in which the talks were held.' },
        { value: 'no_effect',      label: 'It does not really matter; the sequence and publicity of linked talks have no bearing on the substance of any individual deal.' },
      ],
      explanation: 'Linked negotiations leak information: what one counterpart learns about the order or the result of an earlier talk can shift their expectations and leverage in a later one. Deliberately choosing the sequence and what becomes public — what each party learns and when — is therefore a lever on the eventual outcome.',
    },

    // ── Q7 — open-response prep reflection (ungraded; all roles) ──────────────
    {
      field: 'prep_approach', type: 'text', system: false,
      category: 'preparation', format: 'text', role_target: 'all',
      prompt: 'How do you plan to approach the other side? Describe, in broad strokes, the strategy you intend to use in this negotiation.',
      placeholder: '', order: 20, hidden: false, deletable: true,
    },
  ],

  content: {
    infoPDFs:      {} as Record<string, { private: string; public?: string }>,
    kcQuestions:   [],
    prepQuestions: [],
    scenarioText:  {},
  },
}

// ── Frozen conformance vector (spec-verified ground truth) ────────────────────
// Each case satisfies T+B=C on both sides and C_score + T_score + B_score = 0.

export type ConformanceCase = {
  label: string
  outcome: Outcome
  expectedClaridge: number
  expectedTolemite: number
  expectedBard: number
}

export const CONFORMANCE_VECTOR: ConformanceCase[] = [
  {
    label: 'Case 1: future C7/T2/B5, past C5/T1/B4',
    outcome: { C_future: 7, T_future: 2, B_future: 5, C_past: 5, T_past: 1, B_past: 4 },
    expectedClaridge: -6.333, expectedTolemite: 1.667, expectedBard: 4.667,
  },
  {
    label: 'Case 2: future C5/T4/B1, past C3/T1/B2',
    outcome: { C_future: 5, T_future: 4, B_future: 1, C_past: 3, T_past: 1, B_past: 2 },
    expectedClaridge: -4.333, expectedTolemite: 3.000, expectedBard: 1.333,
  },
  {
    label: 'Case 3: future C2/T0/B2, past C8/T4/B4',
    outcome: { C_future: 2, T_future: 0, B_future: 2, C_past: 8, T_past: 4, B_past: 4 },
    expectedClaridge: -4.000, expectedTolemite: 1.333, expectedBard: 2.667,
  },
  {
    label: 'Case 4: future C0/T0/B0, past C6/T1/B5',
    outcome: { C_future: 0, T_future: 0, B_future: 0, C_past: 6, T_past: 1, B_past: 5 },
    expectedClaridge: -2.000, expectedTolemite: 0.333, expectedBard: 1.667,
  },
]
