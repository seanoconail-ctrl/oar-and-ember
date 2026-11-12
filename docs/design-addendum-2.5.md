# Oar and Ember: Design Addendum 2.5

Date: 12 November 2026. From the user's second playtest. Approved by the user. Builds on 2.2 to
2.4 and wins where they conflict. Integrate into the named books, then treat the books as the
source of truth.

Replaces from 2.4: the light-attack-into-dodge cancel (there are no cancels now), and the
Exhausted rule (section 1.3 here).

---

## 1. Combat: methodical, weighty, committed (Books 1, 2, 7, 10)

**Target feel:** a blend of Morbid: The Seven Acolytes, Tunic and Hyper Light Drifter, made
slower, more realistic and more methodical, with the weight, pacing and punishment of Dark Souls
or HEMA sparring. Combat is about spatial awareness, managing distance, stamina and absolute
commitment to every action. It is never about fast reflexes, button-mashing or floating around
the screen. Current combat is too stiff: it must feel heavy and deliberate, not rigid.

### 1.1 Commitment and state locks (no animation cancelling)
- Every action has three strict phases: **wind-up** (startup), **active** (hitbox live) and
  **recovery**.
- Once started, the character is **locked**: no moving, turning, dodging or blocking until
  recovery ends. This applies to the player and the AI alike.
- **A missed attack leaves the attacker highly vulnerable.**

### 1.2 Grounded, weighty movement
- Characters accelerate to full speed and decelerate to a stop. No instant starts or stops.
- **Starting a melee attack drops movement to zero.** An attack may include a fixed short step
  forward during its active frames, but never a slide or drift.

### 1.3 The stamina economy
- Stamina governs everything: swinging, dodging and taking hits on a block all cost stamina.
- **Exhausted** at zero: no attacking, dodging or blocking, and movement at half speed, until
  stamina refills to a minimum threshold (Book 10).
- Fights follow a rhythm: engage, retreat to recover stamina, engage again.

### 1.4 Deliberate defence
- **Parry is predictive, not reactive.** It has its own wind-up, active and recovery frames. It
  must be started during the enemy's wind-up so that its active frames overlap the enemy's
  active frames. A successful parry stuns the attacker (then the riposte from 2.4). A mistimed
  parry leaves the parrier open.
- **Blocking:** holding a shield up halves movement speed. Each hit on the shield drains stamina
  by the attack's power. If a block takes stamina to zero, the guard breaks with a large stagger.
- **Dodging:** a short, stamina-heavy dash with a brief invincibility window in the middle,
  followed by a punishing recovery, so it can't be spammed.

### 1.5 AI with intent and distance
- AI runs on a **state machine with cooldowns**. It decides at intervals, not every frame, so
  enemies never jitter or shuffle.
- Enemies keep **strict distance thresholds**.
- **Melee enemies** circle just outside their attack range and wait for the player to miss and
  enter recovery before stepping in. They never swarm mindlessly.
- **Archers** need a clear line of sight and stand completely still to draw. If the player gets
  too close, they dash away once, reset and re-evaluate, or switch to a melee weapon if cornered.

### 1.6 Telegraphs: reads, not text
- Combat is read through **sight and sound only**. No combat text, no damage numbers, no text
  log.
- Every enemy attack has an **exaggerated telegraph** during its wind-up: a big draw-back of the
  weapon, a subtle one-frame sprite flash, a distinct sound (a sharp breath, steel scraping).
  Heavier attacks have longer, bigger tells.
- 2.4's awareness marks ("?" and "!") are **off by default**; awareness is shown by barks and
  body language.

## 2. On-screen text: much less of it (Books 2, 8)

Text announcements currently stack up and cover the action, and most are no use.
- **Audit every on-screen message** and cut any that the picture or sound already conveys.
- **At most one caption line and one speech line** on screen at once. New lines replace old
  ones; they never stack. Repeated messages are suppressed.
- Captions sit **at the bottom of the screen, clear of the action**, and fade quickly.
- **During fights, only speech barks show.** Information captions wait until the fight ends,
  unless they matter for safety (for example, "Nothing that way").
- **Tutorial prompts** (such as "W A S D to move") fade out during story beats and dialogue, and
  disappear once the player has done the thing. They never sit alongside narrative lines.

## 3. The storm opening (Books 4, 7, 11)

- **Hide the mouse cursor** during cinematic and non-interactive moments.
- **Lightning:** sudden flashes that briefly light the ship, the sea and the land, with thunder
  after. **Rolling fog and mist** over the water. No flat, uniform blue: light varies.
- **Camera motion:** a slow, subtle sway with the pitching sea.
- **Water:** animated foam, big waves breaking against the hull, spray, and the ship visibly
  pitching and rolling.

## 4. Oddi (Book 5): still broken

Oddi got stuck, unresponsive on the sand after his rescue, in the user's playthrough. This is a
**priority fix**. Find the cause, not just the symptom. Add a scenario test that plays the rescue
several ways (different times of day, different routes, the steerer leaving straight away) and
checks that every rescued person walks to camp, works, eats, sleeps under the shelter and
responds to talk. Run it for every rescued person.

## 5. Decision log entries
- No animation cancelling: wind-up, active and recovery locks for everyone; missed attacks are
  punished.
- Acceleration and deceleration; no movement while attacking.
- Exhausted at zero stamina: no attack, dodge or block, half speed until a threshold.
- Predictive parry with its own frames; blocking halves speed; dodge with a mid-dash
  invincibility window and a punishing recovery.
- AI on a state machine with cooldowns; strict distance thresholds; archers stand to shoot.
- Combat is read by sight and sound only; exaggerated telegraphs; awareness marks off by default.
- On-screen text cut back: no stacking, one caption and one speech line at most.
- Storm opening: hidden cursor, lightning, fog, camera sway, rough water and a pitching ship.
