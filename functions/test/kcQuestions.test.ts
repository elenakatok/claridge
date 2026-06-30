import { describe, it, expect } from 'vitest'
import { validateQuestionSemantics, validateKCGate, parsePrepTextQuestions } from '@mygames/game-server'
import { claridgeGameDef } from '../src/gameDefinition'

const ROLES = claridgeGameDef.roles.roles.map(r => r.key)
const questions = claridgeGameDef.prepDefaults!

describe('Claridge prepDefaults — structural integrity', () => {
  it('parses as valid PrepTextQuestion[] (no type/field errors)', () => {
    expect(parsePrepTextQuestions(questions)).not.toBeNull()
  })

  it('passes validateQuestionSemantics', () => {
    expect(validateQuestionSemantics(questions)).toBeNull()
  })

  it('passes validateKCGate for all three roles', () => {
    expect(validateKCGate(ROLES, questions)).toBeNull()
  })

  it('has no duplicate field names', () => {
    const fields = questions.map(q => q.field)
    expect(new Set(fields).size).toBe(fields.length)
  })
})

describe('Claridge prepDefaults — per-role question counts (symmetric)', () => {
  for (const role of ['claridge', 'tolemite', 'bard']) {
    it(`${role}: 1 gate + 5 graded MC + 1 reflection = 7 visible`, () => {
      const v = questions.filter(q => q.role_target === role || q.role_target === 'all')
      expect(v).toHaveLength(7)
      expect(v.filter(q => q.grading === 'assigned_role' && q.system)).toHaveLength(1)
      expect(v.filter(q => q.grading === 'static' && q.category === 'knowledge_check')).toHaveLength(5)
      expect(v.filter(q => q.category === 'preparation')).toHaveLength(1)
    })
  }
})

describe('Claridge prepDefaults — graded MC flags', () => {
  const graded = questions.filter(q => q.grading === 'static')

  it('there are exactly 5 graded MC questions (denominator 5)', () => {
    expect(graded).toHaveLength(5)
  })

  it('all graded questions are system:false, deletable:false, role_target all', () => {
    for (const q of graded) {
      expect(q.system).toBe(false)
      expect(q.deletable).toBe(false)
      expect(q.role_target).toBe('all')
    }
  })

  it('all graded questions have correct_value matching one of their options', () => {
    for (const q of graded) {
      const vals = (q.options ?? []).map(o => o.value)
      expect(vals).toContain(q.correct_value)
    }
  })

  it('all graded questions have explanation text', () => {
    for (const q of graded) {
      expect(typeof q.explanation).toBe('string')
      expect(q.explanation!.length).toBeGreaterThan(0)
    }
  })

  it('no explanation references a positional label (shuffle-safe)', () => {
    const positional = /\b(option [abcde]|choice [abcde]|answer [abcde]|\(a\)|\(b\)|\(c\)|\(d\)|\(e\)|first option|second option|third option|fourth option|fifth option|sixth option)\b/i
    for (const q of graded) {
      if (q.explanation) expect(q.explanation).not.toMatch(positional)
    }
  })
})

describe('Claridge prepDefaults — gate + reflection flags', () => {
  const gates = questions.filter(q => q.grading === 'assigned_role')
  const reflect = questions.filter(q => q.category === 'preparation')

  it('one gate per role, system:true, deletable:false, no correct_value, options = all 3 roles', () => {
    expect(gates).toHaveLength(3)
    for (const g of gates) {
      expect(g.system).toBe(true)
      expect(g.deletable).toBe(false)
      expect(g.correct_value).toBeUndefined()
      const vals = (g.options ?? []).map(o => o.value)
      expect(vals).toContain('claridge')
      expect(vals).toContain('tolemite')
      expect(vals).toContain('bard')
    }
  })

  it('reflection questions are text, deletable, ungraded', () => {
    for (const q of reflect) {
      expect(q.format).toBe('text')
      expect(q.deletable).toBe(true)
      expect(q.grading).toBeUndefined()
      expect(q.correct_value).toBeUndefined()
    }
  })
})
