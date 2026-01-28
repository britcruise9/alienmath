# CLAUDE.md - Galactic CAPTCHA (Alien Math)

## Quick Reference
- **Repo**: https://github.com/britcruise9/alienmath
- **Live**: Deployed on Vercel (check vercel.json for config)
- **Stack**: Next.js (App Router), TypeScript, Tailwind CSS, HTML5 Canvas API
- **Deploy**: Push to `main` → Vercel auto-deploys. Use `vercel --prod` if only preview deploys.

---

## What This Is

An "Inverse Turing Test" puzzle game. An alien signal reaches Earth—an automated filter designed to ignore "background noise" civilizations. Players prove they're intelligent life by rebuilding mathematics from scratch **without human symbols** (no numbers, no words initially).

The interface is the **Alien Protocol**: bureaucratic, cold, indifferent. It views the player as a data packet to be evaluated.

---

## Current Game Flow

```
Pattern Game → Simple Balance → Color Balance → Nested Balance → [more muscles TBD]
```

- Auto-advances through levels on completion
- Navigation dots at top: ● filled = complete, ○ outlined = current, ◌ dim = locked
- Click completed dots to replay

---

## The 5 Math Muscles

Each tests a distinct cognitive prior (based on ARC-AGI / Chollet's core knowledge priors):

### I. SPACE (Geometry & Topology)
- **Concept**: Dimensionality, how space bounds/connects
- **Mechanics**: 
  - Triangulation: Drag 2D net nodes until it "pops" into 3D wireframe
  - Packing: Fit irregular artifacts into container (density/efficiency)

### II. QUANTITY (Arithmetic & Number Theory)
- **Concept**: "Atomic Theory of Numbers" — Primes vs Composites
- **Mechanic**: The Sharing Game (splitting energy blobs)
  - Composite blobs: Fluid, soft, split easily
  - Prime blobs: Crystalline, jagged, resist splitting with haptic feedback

### III. STRUCTURE (Algebra & Logic)
- **Concept**: Equals sign (=) as physical balance/equilibrium
- **Mechanics**:
  - The Scale: Add weights to restore horizontal balance
  - Graph Coloring: Connected nodes can't share same color (constraint satisfaction)

### IV. CHANGE (Calculus & Analysis)
- **Concept**: Rate of change, accumulation, prediction
- **Mechanic**: Trajectory/Time Scrubbing
  - Launch probe through gravity fields
  - Scrub time to see path divergence
  - Adjust velocity vector, visualized via "green phosphor" ghost trails

### V. UNCERTAINTY (Probability & Information)
- **Concept**: Bayesian inference—trusting patterns in incomplete data
- **Mechanic**: The Wager
  - Signal hidden in noise, spend "energy" to clear pixels
  - Bet early (high risk/reward) vs spend energy for certainty (lower score)

---

## Design Constraints

1. **Universal Language**: Math derived from first principles. No Arabic numerals or operators initially.
2. **The "Leapfrog" Loop**: Observe → Induct (form hypothesis) → Deduct (apply to new scenario)
3. **Tactile Feedback**: Wrong answers fail *physically* (prime blob shatters, scale tips violently)
4. **Non-Verbal**: Inspired by ST Math, Math Without Words. Bypass language centers.

---

## Aesthetic Direction

**"Green Phosphor Terminal" / CRT Simulation**

- Scanlines and chromatic aberration
- Ghosting trails for moving objects (motion history)
- Black background, glowing green/white wireframes
- Reference: ARC-AGI abstractions, Euclidea geometry, Osmos blobs

---

## The Human Element

**Voight-Kampff Questions**: Scattered throughout, the Protocol asks qualia-testing questions:
> "Describe the specific frustration of trying to thread a needle when your hands are cold."

These test for conscious experience (which AI cannot fake). Text input, logged for "analysis."

---

## Ending & Monetization

### Completion Flow:
1. **Cognitive Signature**: Radar chart of 5 muscles
2. **Intelligent Beings Registry**: Enter name on leaderboard (scored by efficiency, not just completion)

### Conversion Funnel:
- **Free**: First muscle (Pattern/Quantity) + partial fingerprint
- **Paid ($4.99)**: Remaining 4 muscles + full fingerprint + leaderboard
- **Premium**: Timed IQ test + "Unsolved Problems" + deep dives per muscle

---

## Key Files (likely structure)

```
/src
  /app
    /page.tsx          # Main entry
    /api/              # Any backend routes
  /components
    /GalacticGame.tsx  # Main game component
    /puzzles/          # Individual puzzle components
  /lib
    /gameState.ts      # Progression logic
```

---

## Deployment Checklist

1. `npm run build` — verify no errors
2. Push to `main` branch
3. Vercel auto-deploys (if not, check Settings > Git > Production Branch = "main")
4. Or force: `vercel --prod`

---

## References

- **ARC-AGI**: François Chollet's Abstraction and Reasoning Corpus
- **Cliff Pickover**: *The Alien IQ Test* (1997) — 41 puzzles framed as alien evaluation
- **ST Math**: JiJi the penguin, non-verbal math learning
- **James Tanton**: Math Without Words
