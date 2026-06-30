# Claridge — Knowledge Check Questions (v1)

Canonical source for the Claridge knowledge-check + prep questions. The
authoritative copy that ships lives in `functions/src/gameDefinition.ts`
(`claridgeGameDef.prepDefaults`); this document is the human-readable mirror.

## Structure & grading

- **3 roles:** Claridge (C, defendant/payer), Tolemite (T, patent owner), BARD (B, licensee). One of each per group.
- **Q1 — role gate** (one per role, `grading: 'assigned_role'`, `system: true`): asks the student to identify their own role. NEVER counted in the KC numerator/denominator (same convention as Vivo/Hawks).
- **Q2–Q6 — graded MC** (`grading: 'static'`, `role_target: 'all'`): the same five questions for every role. **Graded denominator = 5.**
- **Q7 — open-response prep reflection** (`category: 'preparation'`, `format: 'text'`, `role_target: 'all'`): ungraded.
- Explanations are **shuffle-safe** — they never reference an answer by letter or position.

The correct option is marked **✓** below.

---

## Q1 — Role gate (ungraded; one per role)

**Prompt:** *What is your role in the negotiation?*

Options (all three roles shown to every student; the correct answer is the student's own assigned role):

- Claridge (the defendant settling the patent suit)
- Tolemite (the patent owner)
- BARD (the licensee)

---

## Q2 — The Varacil market (graded)

**Prompt:** *Which of the following correctly specifies the market for Varacil?*

- ✓ **BARD holds about 66% of the market and Claridge about 11%; Tolemite licenses its Varacil patent to BARD.**
- Claridge holds about 66% of the market and BARD about 11%; Tolemite licenses its Varacil patent to Claridge.
- Tolemite manufactures and sells Varacil directly; BARD and Claridge are only distributors.
- BARD, Claridge and Tolemite each hold roughly one-third of the Varacil market.

**Explanation:** BARD is the dominant seller of Varacil (about two-thirds of the market) and Claridge a much smaller participant (about one-tenth); Tolemite is the patent owner that licenses the Varacil patent to BARD rather than making the drug itself.

---

## Q3 — The upheld-patent royalty split (graded)

**Prompt:** *If the patent is upheld, how is the 10% royalty split between Tolemite and BARD?*

- ✓ **Tolemite gets 40% of the total royalty and BARD gets 60%.**
- Tolemite gets 60% of the total royalty and BARD gets 40%.
- Tolemite and BARD split the royalty evenly, 50/50.
- Tolemite takes the entire 10% royalty; BARD receives nothing.

**Explanation:** Of the 10% royalty payable when the patent is upheld, Tolemite receives 40% of the total and BARD the remaining 60%.

---

## Q4 — Schilling's "4% lost competitive advantage" (graded)

**Prompt:** *Schilling's "4% lost competitive advantage" is best defined as:*

- ✓ **the amount Schilling assumes BARD will drop its Varacil price by if Tolemite loses in court.**
- the reduction in the royalty rate Tolemite would accept to settle out of court.
- the share of the Varacil market Claridge expects to gain from BARD over the next year.
- the fraction of expected legal costs each party avoids by settling rather than litigating.

**Explanation:** The "4% lost competitive advantage" is Schilling's estimate of how far BARD would cut its Varacil price if Tolemite were to lose the patent suit — a price drop that erodes the competitive advantage the patent confers.

---

## Q5 — "3-D Negotiation": scanning widely (graded)

**Prompt:** *According to "3-D Negotiation", a party that "scans widely" should map which of the following?*

- ✓ **The parties' interests and BATNAs, the cost and difficulty of agreement with each, and the crucial relationships among them — who influences whom and who would find it costly to oppose an emerging deal.**
- Only the positions of the parties currently seated at the table, since anyone not present cannot affect the deal.
- Only the price each party is willing to accept, because every other issue ultimately reduces to price.
- Only the legal precedents a court would apply, since the law determines the outcome regardless of the parties' interests.

**Explanation:** Scanning widely means looking beyond the table: mapping all the relevant parties' interests and BATNAs, how hard or costly agreement with each would be, and the web of relationships — who influences whom, and who could block or would find it costly to oppose a deal as it takes shape.

---

## Q6 — "3-D Negotiation": sequence & publicity of linked talks (graded)

**Prompt:** *In "3-D Negotiation", why does controlling the sequence of linked talks — and whether their results become public — matter?*

- ✓ **Because revealing the order or outcome of one negotiation can hand valuable information to a later counterpart, so deciding what each party learns and when can strongly influence the final outcome.**
- Because negotiation etiquette requires that all linked talks be conducted in alphabetical order and disclosed to every party at once.
- Because the law requires that the results of linked negotiations be made public in the order in which the talks were held.
- It does not really matter; the sequence and publicity of linked talks have no bearing on the substance of any individual deal.

**Explanation:** Linked negotiations leak information: what one counterpart learns about the order or the result of an earlier talk can shift their expectations and leverage in a later one. Deliberately choosing the sequence and what becomes public — what each party learns and when — is therefore a lever on the eventual outcome.

---

## Q7 — Approach reflection (open response; ungraded)

**Prompt:** *How do you plan to approach the other side? Describe, in broad strokes, the strategy you intend to use in this negotiation.*

Free-text. Shown to every role; not graded. Surfaced on the instructor Reports page as a per-question response export.

---

## The settlement contract (for reference)

Six decimal royalty-point fields in two constrained pairs, plus optional Notes:

- **Future side:** `C_future`, `T_future`, `B_future` with **`T_future + B_future = C_future`**
- **Past side:** `C_past`, `T_past`, `B_past` with **`T_past + B_past = C_past`**

Scoring (weighted average; future weight 2/3, past weight 1/3):

```
C_score = −( (2/3)·C_future + (1/3)·C_past )    # negative: Claridge pays
T_score =    (2/3)·T_future + (1/3)·T_past
B_score =    (2/3)·B_future + (1/3)·B_past
```

Conservation: with T+B=C on each side, `C_score + T_score + B_score = 0`.

**No-deal rule:** a group that fails to settle goes to court. The instructor enters the simulated court terms as a real contract via the Reports-page inline editor (`updateGroupContract`), which scores normally — there is no Claridge-specific auto-zero.
