# Decision Record — Puck Visual Direction

**Date:** 2026-06-30
**Status:** Accepted
**Supersedes:** none

> This is the **why**. The living, binding standard (tokens, type, layout, voice)
> is [`docs/design/README.md`](./README.md) — edit that, not this. This record is
> immutable rationale.

## Context

Puck needs a visual identity. Two sister projects set the poles: **Eclipse Con**
is a standard marketing landing page; **CandyStore** is neobrutalism. Puck is
neither — it's a **phone-first schedule + reminder companion** whose hero is the
schedule itself. Requirement from the product owner: **clean and very
phone-friendly.**

## Options considered

1. **Departure board** (time-led, utilitarian-clean) — refs: Transit, Citymapper,
   Luma, Sched. Maximally legible and phone-native; risk of reading cold.
2. **Pocket festival guide** (warm, editorial, playful) — refs: DICE, Resident
   Advisor, Partiful. Fun and discovery-led; hard to keep "clean" at phone density.
3. **Calm software** (Scandinavian restraint) — refs: Linear, Notion Calendar,
   Things 3. Clean by default, but risks looking templated/AI-generic.

## Decision

Adopt the **Transit app** aesthetic — _friendly but still serious_ — as the
locked model. Rationale: Transit's **functional color system** (each line a hue;
one hot "now" signal) maps almost 1:1 onto Puck's tracks/stages and reminders,
and it is the cleanest path to "vivid but trustworthy + phone-first." The product
owner reviewed Transit directly and confirmed it as the best style.

We keep Transit's **system** but give Puck its **own fingerprint** so it is not a
reskin: an **iris/indigo** brand anchor (nod to _A Midsummer Night's Dream_), a
pinned **"now" card**, and the **Puck messenger-sprite + 40-minute orbit**
reminder moment.

## Consequences

- Sub-project #2 (`apps/web`) builds `globals.css` and components from the tokens
  in [`README.md`](./README.md) — no re-litigating the direction.
- Color is constrained to **track + status** meaning only; decorative color is a
  guideline violation.
- Reference screenshots of Transit (390px viewport) are archived in
  [`./assets/`](./assets) as the canonical visual reference.

## Reference

- Transit — https://transitapp.com
- Captured: `assets/transit-hero.png`, `assets/transit-departure-board.png`,
  `assets/transit-lines-now-signal.png`
