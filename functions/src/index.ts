import { onRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import {
  makeGetInstructorSession,
  makeAssignRole,
  makeCompletePrep,
  makeConfirmReady,
  makeGenerateAttendanceCode,
  makeVerifyAttendanceCode,
  makeGetRoster,
  makeSyncRoster,
  makeTriggerMatching,
  makeStartNegotiation,
  makeSubmitLeadOutcome,
  makeSubmitConfirmation,
  makeSubmitInstructorOutcome,
  makeFinalizeInstance,
  makePushResultsToClassroom,
  makeGetGameConfig,
  makeUpdateGameConfig,
  validateKCGate,
  makeGetStudentPrepQuestions,
  makeGetDebriefQuestions,
  makeSubmitKnowledgeCheck,
  makeSubmitStaticKnowledgeCheckQuestion,
  makeGetInfoUrls,
} from '@mygames/game-server'
import { claridgeGameDef } from './gameDefinition'

admin.initializeApp()

// ── KC gate validation (cold-start; loud failure if gate is misconfigured) ────
const _kcGateError = validateKCGate(
  claridgeGameDef.roles.roles.map(r => r.key),
  claridgeGameDef.prepDefaults ?? [],
)
if (_kcGateError) throw new Error(`Claridge KC gate validation failed: ${_kcGateError}`)

// ── Game endpoints (onCall, via game-server factories + Claridge definition) ──

export const getInstructorSession  = makeGetInstructorSession(claridgeGameDef)
export const assignRole             = makeAssignRole(claridgeGameDef)
export const completePrep           = makeCompletePrep(claridgeGameDef)
export const confirmReady           = makeConfirmReady(claridgeGameDef)
export const generateAttendanceCode = makeGenerateAttendanceCode(claridgeGameDef)
export const verifyAttendanceCode   = makeVerifyAttendanceCode(claridgeGameDef)
export const getRoster              = makeGetRoster(claridgeGameDef)
export const syncRoster             = makeSyncRoster(claridgeGameDef)
export const triggerMatching            = makeTriggerMatching(claridgeGameDef)
export const startNegotiation           = makeStartNegotiation(claridgeGameDef)
export const submitLeadOutcome          = makeSubmitLeadOutcome(claridgeGameDef)
export const submitConfirmation         = makeSubmitConfirmation(claridgeGameDef)
export const submitInstructorOutcome    = makeSubmitInstructorOutcome(claridgeGameDef)
export const finalizeInstance       = makeFinalizeInstance(claridgeGameDef)
export const pushResultsToClassroom = makePushResultsToClassroom(claridgeGameDef)
export const getGameConfig          = makeGetGameConfig(claridgeGameDef)
export const updateGameConfig       = makeUpdateGameConfig(claridgeGameDef)
export const getStudentPrepQuestions            = makeGetStudentPrepQuestions(claridgeGameDef)
export const getDebriefQuestions                = makeGetDebriefQuestions(claridgeGameDef)
export const submitKnowledgeCheck               = makeSubmitKnowledgeCheck(claridgeGameDef)
export const submitStaticKnowledgeCheckQuestion = makeSubmitStaticKnowledgeCheckQuestion(claridgeGameDef)
export const getInfoUrls                        = makeGetInfoUrls(claridgeGameDef)
export { getReportData } from './getReportData'
export { updateGroupContract } from './updateGroupContract'
export { scoreAndRecord } from './scoreAndRecord'

// ── Non-game onRequest endpoints ──────────────────────────────────────────────

const CORS_ORIGINS = new Set(['https://claridge.mygames.live'])

export const health = onRequest((req, res) => {
  const origin = req.headers.origin ?? ''
  if (CORS_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') { res.status(204).send(''); return }
  res.json({ ok: true, game: 'claridge' })
})

// Emulator-only dev seed functions.
export { seedMatchTest, seedGroupForTest } from './seedFunctions'
