# Oar and Ember: Design Addendum 2.4

Date: 12 November 2026. From the user's playtest of the opening. Approved by the user. Builds
on Addenda 2.2 and 2.3 and wins where they conflict. Integrate it into the books named in each
section, then treat the books as the source of truth. Items marked PROPOSAL go in unless the
user vetoes them.

Replaces one earlier instruction: the hunting bow no longer arrives in the first fifteen
minutes (see section 2).

---

## 1. Combat v2: weighty, deliberate, Souls-like (Books 1, 2, 7, 10, 11)

**Feel target:** few hits, and every hit matters. Fights are about reading the enemy, managing
distance and stamina, and punishing mistakes. Hits land with weight on both sides. Fights are
short and decisive, not long trades of damage.

### Facing, lock-on and backing away
- **Combat stance:** with a weapon drawn, the steerer faces the mouse cursor. Moving away backs
  off while still facing the enemy; moving sideways strafes.
- **Lock-on:** a key (and middle mouse) locks onto the nearest enemy in front; another press
  switches targets. While locked, the steerer always faces the target, and the camera's
  look-ahead centres between them.
- **Speeds (PROPOSAL; numbers in Book 10):** backing off at about 70% of walking speed,
  strafing at about 85%. Running breaks facing: turning to run exposes your back.
- **Attacks commit:** once an attack starts, it can't be turned far or cancelled, except a light
  attack into a dodge in its first few frames. Recovery frames can be punished. A missed swing
  matters.

### Distance and reach
- Every weapon and every enemy has a **reach**. Spacing is the core of a fight: stay just
  outside the enemy's reach, step in after they miss, step out after you strike.
- Longer weapons outrange shorter ones but are weak once an enemy gets inside their reach.
- Lunging attacks close distance, at a stamina cost and with a readable tell.

### Parry, poise and stagger
- **Parry:** keep Book 10's window, but make the reward bigger. A successful parry gives a
  bright spark, a sharp sound and a long hitstop, then the enemy reels open for a **riposte**: a
  heavy, distinct animation for big damage.
- **Poise:** every fighter has poise. Hits wear it down; when it breaks, they stagger.
  Heavy-build fighters have more. Light attacks rarely stagger; heavy attacks and ripostes do.
- **Guard:** blocking costs stamina. A guard break leaves the blocker open.

### Weapons with different strengths (PROPOSAL; numbers in Book 10)
| Weapon | Reach | Speed | Stamina | Strength | Weakness |
|---|---|---|---|---|---|
| Unarmed | Touch | Fast | Low | Shove to make space | No damage worth having |
| Seax (long knife) | Short | Fast | Low | Quick combos, fast ripostes, best sneak attacks; cuts ropes and nets | Short reach; can't break a guard |
| Hand axe | Short to medium | Medium | Medium | The heavy attack hooks a shield aside and opens the guard | Short reach |
| Spear | Long | Medium | Medium | Keeps enemies at bay; thrusts past a shield's edge; can be thrown | Weak when an enemy gets inside; slow to recover from a miss |
| Sword (rare) | Medium | Medium to fast | Medium | Balanced; the widest parry window; strong ripostes | Rare and costly |
| Dane axe (two hands) | Long | Slow | High | Huge stagger; breaks guards and splits shields | No shield; long recovery; easy to punish |
| Club or hammer | Medium | Slow | High | Stagger; works through mail | Slow; short combos |
| Shield | n/a | n/a | Per block | Blocks, shield bash, stops arrows | Drains stamina; can be broken or hooked |
| Hunting bow | Range | Planted | Per draw | Silent; strong against unaware targets | Can't move while drawn; poor against shields |

Mail reduces cuts more than blows. Weapon choice should change how a fight is played, not just
the damage numbers.

### Enemies with self-preservation
Enemies want to live, and fight like it:
- They **hold distance** just outside your reach, circle, step in to attack and step out again,
  and occasionally feint.
- They **respect weapons:** they keep away from a long spear and crowd someone with a seax.
- When **wounded**, they grow cautious: guard more, attack less, back away, call for help and
  retreat towards their friends.
- When morale breaks, they **flee, beg or surrender** (as already designed).
- In groups, **one or two press the attack** while the others circle, flank or hang back. They
  neither queue politely nor pile in all at once.
- They avoid deep water, cliff edges and fire, and won't follow you far from their own ground,
  though they remember you.
- **Scavengers and thieves want loot, not death.** They warn first, and they leave if you're
  clearly stronger.

### Hit reactions (Book 7)
- **Hitstop:** a brief freeze on contact, about 3 to 5 ticks for a clean hit, longer on heavy
  attacks and ripostes, and very short on blocked hits.
- **Flinch and knockback** in the direction of the hit (2 to 6 px). A stagger when poise breaks;
  a knockdown and get-up on the biggest hits.
- **A one-frame flash** on the victim, blood spray in the hit's direction with a decal, and
  sparks on mail and shields.
- **Layered sound:** the impact (flesh, mail or shield wood) plus a grunt or cry.
- **Camera shake** only for heavy hits, ripostes and big hits taken by the steerer.
- **Deaths vary** by weapon and hit direction, and bodies settle naturally.
- The steerer gets the same treatment.

### Health, stamina and healing
- **Less health:** most enemies have about 25% less than now. The first scavengers die to about
  three clean seax hits or one riposte. Enemies still hit hard, so fights end quickly either
  way.
- **Separate bars:** health and stamina are two bars, top left. They show during combat and
  fade out after a few seconds at full outside it. A thin health bar shows over the locked or
  recently hit enemy (PROPOSAL).
- **Stamina:** used by attacks, blocks, dodges and running. It pauses briefly before refilling.
  When exhausted, you can't dodge and swing slowly.
- **Healing takes time and leaves you open:** binding a wound or eating is a short animation
  that can be interrupted, limited by what you carry.

### Arrows, shields and dodges
- **Fix: arrows must hit every time they touch a body**, whatever the combat state, before,
  during and after a fight. Use swept collision (checking the whole path each tick) so fast
  arrows never pass through anyone.
- **Shields block arrows:** the arrow sticks in the shield with a thunk.
- **Aware enemies sometimes dodge:** a visible sidestep, with a short tell. Unaware enemies
  can't dodge, and take extra damage.

### Sneaking and sneak attacks
- **Sneak:** a toggle for a slow, quiet crouching walk. Footsteps are quieter, and the ground
  matters (shingle is loud, grass is soft). Tall grass, shadow, night and rain hide you.
- **Perception:** enemies see in a cone from where they face, shortened by darkness and weather,
  and hear noise. Awareness moves from unaware to suspicious ("Who's there?") to alert, shown by
  barks, body language and a small mark above the head (PROPOSAL: "?" then "!", which can be
  turned off).
- **Sneak attacks:** striking an unaware enemy from behind is a backstab, a heavy, distinct
  animation that kills weak enemies outright. An arrow into an unaware enemy does extra damage.

### Warnings before a fight
- Scavengers, thieves and wary locals **warn before attacking**: "Keep out of this." "This
  wreck is ours. Walk on." "One more step and you'll bleed." Walking closer, or drawing a weapon,
  starts the fight. Walking away, or bargaining, can avoid it.
- Guards of hostile factions still attack on sight, as already designed.

### Death and saves
Because the steerer's death is game over and fights are now deadlier, the game **autosaves at
safe checkpoints** (before each set-piece fight, on reaching camp, on waking). A death costs a
couple of minutes, not twenty.

## 2. Chapter 1 opening changes (Books 4, 6, 9)

### Hild in the net, and the seax
- Hild is **tangled in a net from the wreck**, waist-deep among the rocks (shown with the wading
  art), with the waves washing over her.
- **The seax** lies glinting in the wreckage on the obvious path between the steerer and Hild.
  Picking it up shows its tooltip.
- **Cutting her free** is a short hold-to-cut action, with fibres flying and her gasp of relief.
- If the player reaches her without the seax, she says so: "The net, I can't get out of it.
  Find something sharp! Father's seax was in the stern."

### Thorkel's chest, the key and the bow
- **Thorkel's chest is locked.** On first finding it, Hild explains its purpose: "Father's
  chest. Get it up to the camp. He wore the key round his neck."
- At camp, a carried object with a home there shows a **faint outline where it belongs** (here,
  by the shelter). Setting it down there makes it the camp's chest.
- **The key is on Thorkel's body,** reached through the Bran search however it is resolved.
- **Opening the chest** gives the **hunting bow and a quiver of arrows**, Thorkel's chart
  fragment and a few of his things. The bow is the reward of that search, about 20 to 30 minutes
  into play. Its pickup shows the bow tooltip.
- **The bow's first use (PROPOSAL):** a bundle of the ship's stores (salt fish and a cauldron) is
  lashed high on the broken mast, stranded on a rock out of reach. Shooting through the lashing
  drops it into the shallows to wade out and collect. This teaches aiming and firing from a
  standing position, and rewards the player with food.
  Alternative if that doesn't fit the beats: a hare or seabird for the first proper meal.

### Runa's chest
- Runa asks for her tool chest to be moved to safety. Once it has been moved anywhere safe
  (camp, the shelter, the boat), talking to her lets her ask **"Where have you put it?"**
- The player tells her: the true place, or a lie. The truth satisfies her. A lie is found out
  when she goes to look, and counts against Word.

### Arrival at camp and the sail shelter
- **The first time the steerer reaches the camp site, Hild walks up** and gives the next aim in
  speech: "Get the sail up between those oars, before the rain comes."
- **Raising the sail shelter is visible:** the sail is hauled up between the oars, the ropes
  tighten, the cloth fills and settles, with a sound and an italic caption.

### Oddi
- **Fix:** after being rescued, Oddi gets up after a moment, goes to camp, takes on work, eats,
  and sleeps under the shelter at night. Every rescued person does the same. He is never left
  sitting where he was found.

## 3. Guidance, as organic as possible (Books 2, 8)

- **Speech first:** aims come from people, not markers. Distant shouts carry direction, shown
  with italic captions ("Hild, calling from the west"). Companions remark on what's next, and
  people walk up to the steerer at key moments.
- **The world points the way:** gulls circling the wreck, a glint in the wreckage, smoke from a
  fire, tracks in the sand.
- **Stuck help, escalating gently:**
  1. After about 90 seconds with no progress on the current aim, a nearby person offers a hint
     in speech.
  2. After a while longer, a clearer one.
  3. The current aim is always written in the journal, as one sentence in plain English, for
     the player who wants it. No on-screen quest markers.
- Hint lines follow Book 8's period voice and are written for every Chapter 1 aim.

## 4. World feedback fixes (Books 2, 4, 7, 9)

- **"Nothing that way":** walking into an edge or impassable ground stops the steerer cleanly,
  with no sliding along invisible walls. A short italic caption explains, in context: "Nothing
  that way." "The water's too deep." "Too steep to climb." It shows at most once every few
  seconds.
- **Doors open:** every door and hide flap visibly opens, with animation and sound, when walked
  into or clicked, and closes behind after a moment. Closed doors block movement and sight.
  Other people use doors too. Doors can be barred later, for defences.
- **The shelter interior must be inviting:** warm firelight and glow, the sail cloth's weave and
  the wind moving its edges, hides and furs for bedding, the salvaged chests and barrels, oars
  and gear stowed, clothes drying, smoke curling, rain sounds on the cloth. It must meet the
  Stage 6 art standard.
- **The Hag's Stone effect, stronger and ambiguous:**
  - The wind drops to silence and the birds go quiet.
  - The light shifts cold blue-green, and the carved marks glow faintly.
  - Mist curls round the stone, and a low drone and whisper rise in the sound.
  - The camera eases towards the stone, and something may stand at the edge of sight.
  - Then a sudden gust, and everything returns.
  - The whole effect lasts 6 to 10 seconds, and it is never explained.

## 5. Music fades (Book 11)

- **Gradual onset:** music fades in over about 6 to 10 seconds and starts with a single layer (a
  drone or one instrument). The other layers join over the first 20 to 30 seconds.
- **Fade out:** music fades out over about 4 to 8 seconds whenever it stops. Changes between
  pieces cross-fade. Only stingers start or stop sharply.
- Stretches of silence between pieces are welcome, Stardew-style.

## 6. Making the first few minutes fun and satisfying (Books 4, 6; PROPOSAL)

1. **A playable cold open (30 to 45 seconds):** night, storm, the steerer at the steering oar as
   the boat breaks; then black, then waking in the shallows at dawn. It shows the stakes and
   that the sea is the enemy. Control within seconds still holds.
2. **Something to do within ten seconds:** waking coughing in the surf; the first input gets the
   steerer up. Hild's call comes within fifteen seconds.
3. **A chain of small wins in the first five minutes,** each with a payoff:
   - the seax (tooltip);
   - cutting Hild free as the waves rise (relief, and a joke from her);
   - the chest dragged up the beach;
   - the first fire: sparks from the flint, the flame taking, the music arriving gently;
   - the shelter going up.
4. **A first fight built to teach and feel great,** at dusk on the first day:
   - Two scavengers are stripping the wreck. They warn you off.
   - One has a slow, obvious wind-up, so the first parry lands and earns a big riposte with
     hitstop.
   - When he falls, his friend runs: self-preservation shown at once.
   - The player can instead walk away, bargain with food, or sneak through the dune grass for a
     backstab.
5. **Curiosity rewarded at once:** a silver arm-ring in a rock pool just off the path; a seal
   watching from the water; crabs scuttling; gulls lifting as you pass.
6. **Every action is tactile:** animation, sound and particles for each one. Rope fibres, flint
   sparks, sand puffs, splashes.
7. **The long goal is visible early:** the broken boat lies on the rocks below the camp. Hild:
   "Father would've had her floating by the next tide."
8. **A mystery by dusk:** a strange light at the Hag's Seat on the first evening.
9. **No menus and no long reading in the first ten minutes;** tooltips stay short.
10. **A first-night fire scene:** Hild's grief and gallows humour, ending with clear aims for
    the morning: "Oddi was by the stern when she broke. Bran went after Father."

## 7. Decision log entries
- Combat v2: lock-on and facing, reach and spacing, weapon movesets, poise, bigger parry rewards,
  self-preserving enemies, strong hit reactions, less enemy health, separate bars, interruptible
  healing, sneaking and backstabs, warnings before fights, checkpoint autosaves.
- Arrows always register hits; shields block them; aware enemies sometimes dodge.
- Hild is freed from a net with the seax; Thorkel's chest is locked and holds the bow; the bow's
  first use is a puzzle shot; Runa asks where her chest is.
- Organic guidance with escalating stuck help and a journal line; no quest markers.
- "Nothing that way" captions; working doors; an inviting shelter interior; a stronger, ambiguous
  Hag's Stone effect.
- Music fades in gradually and fades out.
- The first-five-minutes plan in section 6.
