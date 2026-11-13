# Oar and Ember, Book 10: Balance Sheet

*Every tuning number in one place: time, food, fuel, cargo, ships, combat, stamina, perception, people, buildings, the ideal progression, the homestead threat schedule, the mainland, the wilderness, dungeons, the living world, assaults, the home without the steerer, exploration density, the opening, guidance and feel of design addendum 2.4 (section 25), and the commitment, frame data, AI, on-screen text and storm of design addendum 2.5 (sections 06, 07, 21 and 25).*

Numbers drift when they live in seven books. This book is the single source. The tables here are exported as `balance.json`, which the game reads; nothing is hard-coded.

**How to use:** Change a number here first, then regenerate `balance.json`, then record the change and its reason in the decision log. Other books may quote these values for readability but this book wins any disagreement. All values are starting points for tuning after the user's playtests.

_Starting values, not tested balance. Units: game hours and days, real seconds, tiles of 24 px, ticks at 60 Hz, ration-days (rd) of food, loads of fuel and hay, lots of cargo, ounces (oz) of silver._


## 01 / How to use this sheet
*One table per concern. Every table has a stable name that becomes a key in `balance.json`.*

- The export takes each table under a level-two heading and writes it as an array of rows keyed by the column names.
- Code reads values by key (for example `balance.combat.weapons[SPEAR].windup`); content refers to keys, never to literal numbers.
- Tests in Book 2 check that the game's behaviour matches these tables: frame data, travel times, spoilage, food runway, ship stats.
- Changing a value that a test asserts requires changing the test in the same commit, with a decision-log entry.

## 02 / Time and travel
### Clock
| Key | Value | Notes |
|---|---|---|
| secondsPerHour | 50 | Real seconds per game hour on foot |
| dayStart | 06:00 | Waking time |
| dayEnd | 02:00 | Collapse if still awake |
| activeDayMinutes | 16.7 | Real minutes from 06:00 to 02:00 |
| sleepAfter | 18:00 | Earliest time a bed ends the day |
| collapsePenalty | Wake 08:00, stamina max -30 for the day | |
| dayLengthOption | 0.75 to 1.5 | Multiplier on secondsPerHour |
| watchHours | 6 | Morning, Day, Evening, Night |
| seaWatchAnimSeconds | 4 | Real seconds per watch on the sea map |

### Daylight
| Season | Light from | Dark from |
|---|---|---|
| Spring | 06:30 | 20:00 |
| Summer | 04:30 | 23:00 |
| Autumn | 07:00 | 19:00 |
| Winter | 08:30 | 16:00 |

### Tide
| Key | Value | Notes |
|---|---|---|
| alternation | Flood and ebb each watch | Low water at the end of each ebb watch |
| phaseShift | 1 watch every 3 days | |
| springTideDays | 1, 2, 3 and 16, 17, 18 of each season | |
| tidalGroundWindow | 3 game hours around low water | 2.5 real minutes |
| springLowExtra | Causeways and deep caves open only on spring tide days | |

### Movement on foot (tiles per second)
| Mode | Speed | Notes |
|---|---|---|
| Sneak | 1.2 | A slow crouching walk, toggled (combat v2: section 07, "Sneaking"; decision DE-9); its noise is section 07's noiseSneak by the ground |
| Walk | 2.0 | Default (2.0 since the art-direction pass: 3.5 read as running on 32 x 40 people) |
| Run | 6.0 | The sprint; drains stamina (section 06, Stamina in traversal). Running turns the body to the way of travel and breaks the combat stance's facing (section 06, "Stance and lock-on") |
| Carry | 1.8 | Lot or person; attacks disabled |
| Climb | 1.0 | On marked climbing routes; drains stamina |
| Wade | 2.0 | Walking speed in water before the depth band's speed factor (Water depth bands) |
| Swim | 1.2 | Deep water where swimming is allowed; drains stamina |

### Water depth bands
*Depth is the still water level (the calendar's tide, never the drawn swash) over the zone's ground height, in the height field's units (Book 7 section 14, Water: the flats lie at 0.02 to 0.14 and the foreshore at 0.15 to 1). A band holds from the row above it up to, but not including, its "Depth up to" value; any water at all is at least wet.*

| Band | Depth up to | Sprite masked (px) | Speed factor | Stamina per second | Notes |
|---|---|---|---|---|---|
| Wet | 0.012 | 0 | 1.0 | 0 | Wet sand and swash; no change but footprints fill with water |
| Ankle | 0.05 | 3 | 0.9 | 0 | Feet hidden; a ripple ring on every step |
| Knee | 0.14 | 12 | 0.7 | 0 | Splashes on entering and on every running step |
| Waist | 0.30 | 22 | 0.5 | 4 | Carrying and fighting are harder: carry speed x0.6, attack recovery x1.3 |
| Deep | Deeper | Swimming | Swim speed | 8 | Swimming only where allowed; elsewhere deep water is the edge of the walkable ground |

### Water effects
| Key | Value |
|---|---|
| rippleOnStep | One ring per step in ankle, knee and waist water |
| rippleStanding | One ring every 1.2 s while standing in water |
| rippleLife | 0.9 s, growing to 10 px across |
| splash | On entering knee or waist water, and on every running step in it |
| dripAfterKnee | 4 s of dripping and a sprite one ramp step darker after leaving knee water |
| dripAfterWaist | 8 s after leaving waist or deep water |
| sprayAroundWader | One spray burst every 2.5 s round a person standing in the surf line |
| streamBand | Ankle: a stream crossing open ground is ankle deep unless the tide over it is deeper |

### Sea travel
| Key | Value |
|---|---|
| watchesFormula | baseWatches x 3 / effectiveSpeed |
| windFactorRunning | 1.2 |
| windFactorBroadReach | 1.0 |
| windFactorBeam | 0.8 |
| windFactorCloseHauled | 0.5 |
| windFactorAgainst | 0 (row) |
| rowingFactor | oarSpeed x rowersPresent / rowingCrew x 0.8 |
| storesPerPersonPerWatch | 0.25 rd |
| forecastAccuracy | 0.8 |

### Routes (base watches at speed 3)
| Route | Base watches | Exposure | Notes |
|---|---|---|---|
| Skarvholm to Carrick | 2 | 2 | |
| Skarvholm to Saltvik | 3 | 2 | |
| Skarvholm to Kilbrecc | 3 | 2 | |
| Skarvholm to Crowwick | 2 | 1 | |
| Skarvholm to the Cauldron | 1 | 3 | Tide gate: slack only |
| Cauldron to Glen Arra | 1 | 2 | Saves about two watches |
| Crowwick to Glen Arra | 2 | 1 | |
| Crowwick to Inis Rón | 2 | 1 | |
| Carrick to Kilbrecc | 1 | 1 | Coastal |
| Kilbrecc to Dún Fiach | 2 | 1 | Coastal |
| Carrick to Saltvik | 2 | 1 | Coastal |
| Saltvik to Crowwick | 2 | 2 | |
| Skarvholm to Blue Men's Sound | 3 | 3 | Winter closed |
| Blue Men's Sound to Kaldness | 3 | 3 | Winter closed |

## 03 / Food, fuel and seasons
### Consumption
| Key | Value |
|---|---|
| foodPerPersonPerDay | 1 rd (residents, player, hostages) |
| rationFull | 1.0: no penalty |
| rationShort | 0.75: morale -1 band per 5 days, healing -25% |
| rationHungry | 0.5: morale -1 band per 3 days, healing -50%, work -20% |
| rationStarving | 0: sickness risk +10% per day, death risk after 5 days |

### Food items
| Item | Food value | Keeps | Notes |
|---|---|---|---|
| Grain lot | 50 rd | 1 year in a storehouse; loses 10% per season without | One cargo slot |
| Fresh fish | 1 rd per fish | 2 days | |
| Dried fish | 0.8 of fresh | 1 season | Racks, 3 dry days |
| Smoked fish or meat | 0.9 of fresh | 2 seasons | Smoke-house, 1 day, 1 fuel per 20 rd |
| Salted fish or meat | 1.0 of fresh | 1 year | 1 salt lot per 60 rd |
| Preserved lot | 40 rd | As its method | One cargo slot |
| Eggs | 4 rd per climb | 5 days | Spring days 10 to 40 |
| Milk and cheese | See livestock | Cheese 1 season | |

### Gathering and fishing (per worker-day at skill 2)
| Source | Spring | Summer | Autumn | Winter |
|---|---|---|---|---|
| Fishing from shore | 3 | 4 | 3 | 1 (calm days only) |
| Fishing from the boat (2 crew) | 5 | 6 | 4 | 0 |
| Shellfish and seaweed | 2 per low-tide window | 2 | 2 | 1 |
| Driftwood | 1 load per search | 1 | 2 after storms | 3 after storms |

### Work and the wreck camp
*Added for Stage 7 (decisions S7-4 to S7-7): what a worker-day is, what the first camp starts with, and the tutorial guard.*

| Key | Value | Notes |
|---|---|---|
| workerDay | 8 game hours of work | The rates above are per worker-day; a resident at work adds them by the game minute, the player by the action |
| wreckStores | 6 rd of salt fish | A split cask among the salvage heaps in the broch at S0 |
| driftwoodSearchesPerWorkerDay | 2 searches | A resident's worker-day walking the weed lines brings in what 2 of the steerer's searches do (the Driftwood row above): the near tidelines are soon picked over, so a day's search gives 2 loads in spring and summer, 4 in autumn and 6 in winter after storms (decision S8-29) |
| campFuel | 0 loads | The first fire needs driftwood gathered first (Book 4 Chapter 1 beat 2) |
| fireLight | 1 load of driftwood | Laid and lit in the fire ring; the camp fire then burns houseFuelPerDay (Fuel and hay) like a heated house |
| tutorialGuard | No starvation and no spoilage before tutorialComplete | tutorialComplete is set at the launch, the end of Chapter 1 (Book 1 section 03: no starvation timer while the player is learning) |
| mastStores | 4 rd of salt fish and the ship's cauldron | The stores bundle lashed high on the broken mast at the western outcrop (Book 9 section 03), shot down with the bow into the shallows (wadeable at any tide, decision DF-82) and carried up as one load (decision DE-19). The cauldron goes to the fire as a prop |
| shelterRaise | One hands-on action by the steerer: 6 real seconds, 30 game minutes, 2 stamina | At Hild's word on walking up to the camp (Book 4 Chapter 1): the sail is hauled up between the oars, the ropes tighten and the cloth fills and settles, and the S0 shelter is up at once. The Buildings row's 1 worker-day is for residents raising one without the steerer (decision DE-20) |
| bindingsAtCamp | 2 linen bindings | In the salvage at the camp (S0), for binding wounds in a fight (section 06, "Health, stamina and healing") |

### Driftwood finds
*Added from the user's playtest note (decisions PT-2 and PT-3): the steerer does not work driftwood, but finds it. Pieces lie in a variety of spots on Wreck Strand, are picked up with a plain interact and a short stoop, and the sea brings more each dawn. A dawn's pieces bring what one search did (the Driftwood row above: 1 load), more in autumn and winter, so the camp fire (houseFuelPerDay) is kept with some over. Gathering driftwood as a day's work stays a resident's job (driftwoodSearchesPerWorkerDay).*

| Key | Value | Notes |
|---|---|---|
| spots | 12 spots on Wreck Strand | Along the high-tide line at both ends, under the bank, among the rocks of both outcrops and by the wreck's stern (content/camp.json, the DRIFTWOOD sites) |
| firstDawn | A piece at every spot | The storm that wrecked the ship left the strand strewn: 6 loads, enough to light the first fire (fireLight) once 2 pieces are fetched up to the broch |
| piecesPerDawn | Spring 2, summer 2, autumn 3, winter 4 | Washed up again at dawn at spots picked bare, never more than the spots picked bare (1, 1, 1.5 and 2 loads a day against the fire's 0.5, 0.2, 0.5 and 1.0) |
| afterStorm | 2 times the season's pieces | At the dawn after a storm. Storms come with the weather (Stage 13); until then every dawn is a calm one |
| loadsPerPiece | 0.5 loads | Added to the camp's store of driftwood as soon as it is picked up |
| pickUp | 5 game minutes and 0 stamina; the steerer stoops for 0.8 real seconds | No timing ring and no press: one gather loop, then the minutes pass |

### Barley and kale
| Key | Value |
|---|---|
| skarvholmPlots | 4 (6 after clearing; 2 more worker-days each) |
| seedPerPlot | 25 rd of grain |
| sowWindow | Spring days 1 to 25; -4% yield per day late after day 20 |
| sowLabour | 2 worker-days per plot |
| weedLabour | 1 worker-day per plot in summer; unweeded -30% |
| harvestWindow | Autumn days 61 to 75 |
| harvestLabour | 3 worker-days per plot |
| yieldPerPlot | 150 rd (3 grain lots); bad summer -30% |
| overripe | -50% after day 80; lost after day 90 |
| kaleGarden | 1 rd per day in summer and autumn |

### Livestock
| Animal | Milk per day | Slaughter | Winter needs | Notes |
|---|---|---|---|---|
| Cow | 1.5 spring and summer, 0.75 autumn, 0 winter | 80 rd | 0.15 hay per day and a byre | Without byre: condition falls, death after 15 days |
| Sheep | 0.25 summer | 15 rd | 0.03 hay per day | Graze machair; 1 wool lot per 6 sheep at shearing |
| Starting flock | 6 half-wild sheep on Skarvholm | | | |

### Fuel and hay
| Key | Value |
|---|---|
| peatCut | 5 loads per worker-day, spring and summer |
| peatDry | 20 dry days before use |
| houseFuelPerDay | Summer 0.2, spring and autumn 0.5, winter 1.0 |
| forgeFuel | 1 load per working day |
| coldEffect | No fuel in a winter house: vitality max -10, sickness +5% per day, healing -50% |
| hayCut | 3 loads per worker-day, summer days 31 to 60; needs 3 dry days |

### Sickness
| Condition | Daily risk per resident |
|---|---|
| Baseline | 0.2% |
| Autumn | +0.5% |
| Winter | +1% |
| Cold | +5% |
| Hungry | +3% |
| Wounded | +2% |
| Crowded (over 10 in one house) | +1% |
| With a healer caring | x0.5 |

### Winter preparation formula
```
food needed  = 30 days x mouths + 25% reserve
fuel needed  = 30 x heated houses x 1.0 + smoke-house and forge use
hay needed   = 30 x (cows x 0.15 + sheep x 0.03)
Example, day 90 with 15 mouths, 2 houses, 3 cows, 12 sheep:
food 563 rd   fuel 75 loads   hay 25 loads
```

## 04 / Cargo, trade and silver
### Cargo values (oz of silver at a fair market)
| Lot or item | Value | Slots |
|---|---|---|
| Grain lot | 2 | 1 |
| Preserved fish or meat lot | 2 | 1 |
| Salt lot | 3 | 1 |
| Iron lot | 6 | 1 |
| Timber lot | 2 | 1 |
| Tar lot | 3 | 1 |
| Wool lot | 3 | 1 |
| Cloth lot | 8 | 1 |
| Dye lot | 6 | 1 |
| Hides lot | 4 | 1 |
| Silver lot (hacksilver) | 20 | 1 |
| Church plate | 30 | 1 |
| Wine lot | 12 | 1 |
| Cow | 5 | 2 (pen) |
| Sheep (pen of 3) | 3 | 2 |
| Amber necklace | 6 | 0 |
| Silver arm-ring | 12 | 0 |

### Price modifiers
| Condition | Effect |
|---|---|
| Recognised stolen goods at an honest buyer | -30% and a `SAIL_SEEN` |
| Sold quietly through Ottar | -20% cut |
| Lúnasa fair | +10% sale prices |
| Local scarcity or glut | +50% or -50% |
| Faction hostile | No trade |

### Weapons, armour and tools (buy price)
| Item | Price | Notes |
|---|---|---|
| Spear | 2 | |
| Shield | 1 | |
| Axe | 3 | |
| Seax | 2 | |
| Bow and arrows | 3 | |
| Arrows (a dozen) | 1 | Sold by the dozen; the bow is sold with a quiver of 6 |
| Helmet | 10 | |
| Mail shirt | 40 | |
| Sword | 24 | Not forgeable on Skarvholm |
| Dane axe | 12 | |
| Tool head (axe, adze, sickle, spade) | 1 | |
| Fishing net | 2 | |

### Wages, debts and payments
| Key | Value |
|---|---|
| hiredOarsman | 1 oz per voyage-day plus one share |
| sellsword | 3 oz per day |
| kolbeinnDebt | 30 oz |
| asaDebt | 40 oz |
| ransomDonnchad | 60 oz |
| ransomOrdinary | 15 oz |
| carrickTribute | 20 oz (the hidden silver lot) |
| ormTribute | One tenth of all plunder plus one hostage |
| shareSystem | Plunder split: household 60%, crew shares 40% (affects Gain regard) |

## 05 / Ship statistics and costs
### Hulls
| Hull | Length tiles | Oars | Berths | Rowing crew | Cargo | Draft | Sea | Oar | Sail | Integrity | Slots |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Coastal boat | 7 | 6 | 8 | 4 | 4 | Shallow | 2 | 2 | 3 | 100 | 3 |
| T2 Karvi | 12 | 16 | 18 | 10 | 10 | Shallow | 3 | 3 | 4 | 180 | 5 |
| T3a Snekkja | 18 | 26 | 30 | 16 | 8 | Medium | 3 | 5 | 4 | 240 | 6 |
| T3b Knarr | 13 | 4 | 10 | 4 | 24 | Deep | 5 | 1 | 4 | 260 | 5 |

### Hull costs
| Hull | Buy | Build materials | Build labour |
|---|---|---|---|
| T2 Karvi | 160 oz | 14 timber, 4 iron, 3 tar, 2 cloth | 40 worker-days, boatwright skill 3 |
| T3a Snekkja | 420 oz | 26 timber, 8 iron, 5 tar, 4 cloth | 90 worker-days, boatwright skill 4 |
| T3b Knarr | 320 oz | 22 timber, 6 iron, 5 tar, 4 cloth | 70 worker-days, boatwright skill 4 |

### Fittings
| Fitting | Cost | Self-built | Effect | Drawback |
|---|---|---|---|---|
| Extended hold | 12 oz | 1 timber, 1 iron, 3 worker-days | Cargo +2 (+1 on T1) | Oar -1; rowing crew +1 |
| Raised bow platform | 10 oz | 2 timber, 2 worker-days | Boarding defence +20%; archers +3 tiles | Cargo -1 |
| Shield rack | 4 oz | 1 timber | Missile hits -40% with shields up; intimidation +1 | Identification +0.2 |
| Grapnels and planks | 8 oz | 2 iron | Grapple contest +25% | Cargo -1 |
| Awning and stores | 8 oz | 2 cloth | Stores +4 days; light wounds heal at sea | Cargo -1 |
| Bailing station | 5 oz | 1 timber | Storm and hull damage -25% | Cargo -1 |
| Towing gear | 4 oz | 1 timber | Tow a boat for +2 cargo | Speed -1 while towing |
| Better sail and rigging | 30 oz | 3 cloth, 1 tar | Sail +1; close-hauled factor 0.65 | Wear +50% without a shipwright |
| Carved beast-head | 12 oz | 4 worker-days, carving skill 3 | Intimidation +1 | Offends land-spirits and locals if not unshipped |
| Gilt weather-vane | 40 oz | 1 silver lot | Trade prices +5%; forecast 0.9 | Identification +0.3 |

### Refits, wear and repair
| Key | Value |
|---|---|
| shallowDraft | 20 oz or 2 timber and 4 worker-days; sea -1, cargo -1 |
| doubledStrakes | 30 oz or 3 timber, 1 iron, 6 worker-days; integrity +30%, oar -1 |
| recaulk | 1 tar, 2 worker-days; wear to 0 |
| wearPerWatchAtSea | 1 |
| wearPerBattle | 5 |
| wearLeak | At 50: oar -1 |
| wearSailRisk | At 80: 10% per storm watch of sail damage |
| maintenance | Shipwright removes 10 wear per worker-day |
| repair | 1 timber per 25 integrity; 1 worker-day per 20 |
| stormDamage | 5 x storm strength x exposure / seaworthiness per watch |

### Chapter 1 repairs
*Added for Stage 11 (decisions S11-4 to S11-12): the coastal boat's three repairs and its first fitting (Book 4 section 08, beats 4 and 5). Labour is in worker-days (section 03, workerDay: 8 game hours), added by whoever works on the boat at their skill: a resident with the shipwright's job, or the steerer by hand. Every material is one load found in the world and carried to the boat, never a count to gather (Book 3 Stage 11, check 3). The hull patch's materials and labour are the Carpentry row "Hull patch (Chapter 1)" (section 09). Cutting the rigging free of the wreck on the skerry (at low water) and taking a fitting off are each one "Repair the ship" action (section 09, Homestead tasks: 30 game minutes, 2 stamina); a fitting taken off is fitted again for its labour again.*

| Key | Value | Notes |
|---|---|---|
| wreckedIntegrity | 30 | The coastal boat as found, drawn up on Wreck Strand: strakes sprung and stove in; it cannot float |
| patchedIntegrity | 80 | Patched with the salvaged boards; the patch is made good with iron after the first raid (Book 6 section 03) |
| rigging | 1 worker-day | Stepping the mast and setting up the salvaged rigging on the boat |
| shipOar | 0.125 worker-day | Lashing a steering oar to its boss on the quarter |
| carveOar | 2 worker-days | Runa carves a new steering oar from the wreck's yard; only a carpenter of skill 2 or more can (Book 4: "over two days") |
| fitHold | 1 worker-day | The extended hold, made from salvage (hides, lashings and the wreck's thwarts): Chapter 1 has no iron |
| fitBowPlatform | 1 worker-day | The raised bow platform, made from the wreck's timber |
| oarFood | 3 rd | Salt fish the wreck-scavengers take for their steering oar at Seal Cave, if they will talk |

## 06 / Combat timings
*Combat v2 (design addendum 2.4; decisions DE-1 to DE-13), built in the 2.4 rework: the combat v1 rows it replaced (the Weapons table, parryStagger, blockCost, turnLock, hitStagger, the stamina row's regeneration, padded, mail and hitStop) were removed in the same change, with the parsers moved to the v2 keys (decision DE-13). The tables from "Charged heavy" to "Stamina capacity" hold from Stage 9; those from "Stance and lock-on" are combat v2's. **Design addendum 2.5** (decisions DF-1 to DF-6, DF-9 and DF-10) makes every action commit with wind-up, active and recovery ticks and no cancels, adds acceleration, a new exhausted state, a predictive parry, a slower block and a costlier dodge, and reads combat by sight and sound only; its tables are the last nine of this section, from "Commitment" to "Dodge". The rows they replaced were removed when 2.5 was built, with the parsers moved to the new keys in the same change (decision DF-19).*

### Charged heavy
| Key | Value | Notes |
|---|---|---|
| level1At | 18 ticks held: damage x1.5, vs shield x1.5, tell: glint |  |
| level2At | 45 ticks held: damage x2.0, guard break (unblockable, parryable), tell: flash and sound |  |
| maxHold | 90 ticks, then auto-release |  |
| staminaCost | Weapon stamina x1.5 (L1), x2.0 (L2) |  |

### Defence
*From Stage 9. The parry's reward is "Parry and riposte", the block's cost and the guard break "Guard", and the facing "Stance and lock-on" (combat v2).*

| Key | Value | Notes |
|---|---|---|
| parryCost | 8 stamina, refunded on success |  |
| blockArc | 120 degrees front |  |
| shove | 12 stamina; breaks block; target staggered 20 ticks | Its stamina and stagger stand; its frames are "Frame data" (Unarmed, Shove). |

### Fight rules
*How the frame data is played (Stage 9, decisions S9-2 to S9-6; the frames are "Frame data", design addendum 2.5). Starting values, for tuning after playtests. A hit wears poise rather than staggering ("Poise"); blockNeedsShield also covers the Dane axe (Weapon rules, daneAxeHands).*

| Key | Value | Notes |
|---|---|---|
| strikeArc | 100 degrees in front: a strike meets everyone within its reach there |  |
| bodyRadius | 0.3 tiles: reach is measured to the near edge of the body a strike meets |  |
| blockStun | 10 ticks: a blow taken on the shield rocks the guard |  |
| chargeFromPress | A melee press starts the charge (the raised weapon is the tell); released before level1At it is a light attack whose windup counts from the press |  |
| chainWindow | A light attack pressed in the last chain-window ticks of a strike's recovery follows when the recovery ends; no recovery is skipped | Kept: each light's chain window is in "Frame data". The queued light starts only when the recovery has ended (no cancels, design addendum 2.5). |
| dodgeWay | With no direction held, a dodge goes straight back from the facing |  |
| guardBreakHit | A level-2 charge that meets a raised shield breaks the guard and lands |  |
| blockNeedsShield | Only a shield blocks; without one the block key does nothing and says so |  |
| missileDamage | An arrow or thrown spear that strikes a body deals its weapon's damage (section 06; iron heads as listed, bone heads x0.85); one stopped by a shield costs the block its vs-shield damage x the block cost |  |

### Vitality, stamina and armour
*From Stage 9. Stamina is "Health, stamina and healing", armour "Weapon rules" and the hitstop "Hit reactions" (combat v2).*

| Key | Value |
|---|---|
| vitality | 100 for the steerer and adult residents |
| helmet | Head-blow critical chance halved |
| bloodiedBelow | 50% vitality |
| downed | Downed allies do not bleed out (design addendum 2.3 section 7); see Downed and carried |
| secondWind | 5 seconds; adjacent ally lifts the steerer to 25 vitality; once per scene |
| dismemberChance | 35% on killing blows from heavy axe, Dane axe or sword |
| finisherHold | 24 ticks |

### Downed and carried
| Key | Value |
|---|---|
| safePlaces | The boat, the village, or on a journey a safe camp or a waystation |
| broughtHome | A downed ally carried to a safe place before the scene ends lives, with a serious wound (section 08, Wounds) |
| leftBehind | A downed ally left at the end of a scene is captured by enemies who take captives (Norse raiders, Gaelic lords, Orm's men, the Church's hired swords) and killed by the rest (outlaws in a hurry, wolves, the dead) |
| carrySpeed | The carry speed (section 02); the carrier cannot fight while carrying |
| finishWarning | Berserkers and named cruel enemies may finish the downed, after a visible 3 s warning (a raised weapon, a shout) |
| ransomRescue | Captives can be rescued or ransomed later (section 04, Wages, debts and payments) |
| ransMercy | The Rán's mercy option prevents unscripted crew deaths; scripted deaths still happen |

### Stamina in traversal
| Activity | Drain per second | Notes |
|---|---|---|
| Walk, sneak, ordinary carry | 0 | Ordinary carrying is one lot or a light load |
| Run (sprint) | 3 | 5 while in combat |
| Heavy carry | 2 | A person or a heavy lot (iron, a quern stone, a chest) |
| Waist-deep wading | 4 | Water depth bands |
| Climb | 6 | Marked routes only |
| Swim | 8 | Deep water where allowed |
| Regeneration | 0 while climbing or swimming | Elsewhere as the stamina row (half while waist deep) |

### Running out of stamina
| Key | Value | Notes |
|---|---|---|
| heavyCarryEmpty | Sets the load down; can lift again at 25 stamina |  |
| climbEmpty | Slides down 1 tile per second to the last ledge or the foot of the route; a slide of more than 2 tiles costs 10 vitality per tile beyond 2 |  |
| swimEmpty | Starts to sink: 6 s to reach water no deeper than the waist band, then drowning at 10 vitality per second; reaching the shallows ends it |  |
| waistWadeEmpty | Speed factor x0.5 again until 25 stamina is regained |  |

### Stamina capacity
*The bar's maximum, shown as its length, with each reason named on screen (Book 8 section 10 wording).*

| Condition | Max change | Reason shown | Ends when |
|---|---|---|---|
| Cold | -20 | Cold | 1 game hour by a fire or in a heated house, or a hot meal |
| Hungry | -15 | Hungry | A meal; applies when no meal has been eaten since waking by 14:00 |
| Starving | -35 | Starving | Two meals; applies after a whole day without food (replaces Hungry) |
| Light wound | -10 | Wounded | The wound heals (section 08, Wounds) |
| Serious wound | -30 | Badly wounded | The wound heals |
| Sick | -25 | Sick | Recovery (section 03, Sickness) |
| Short sleep | -15 | Tired | A full rest; applies after less than 6 game hours of sleep |
| No sleep | -30 | Exhausted | A full rest (the clock's collapse penalty) |
| A hard day's work | -10 | Worn out from work | Sleep; applies after more than 8 game hours of tasks in a day |
| Feast | +10 | Well fed (shown as a gain) | The next day ends |
| minimumMax | 40 | | The maximum never falls below 40 |
| fullRest | 8 game hours of sleep in a bed, or 7 at a good camp | | |
| hotMeal | Removes Hungry and Cold | | |
| warmFire | Removes Cold after 1 game hour within 3 tiles | | |

### Stance and lock-on
*Combat v2 (design addendum 2.4 section 1; decisions DE-2 and DE-3). Speeds are shares of the walking speed of section 02.*

| Key | Value | Notes |
|---|---|---|
| stance | A melee weapon, a shield or a bow in hand (selected in the hotbar) puts the steerer in the combat stance, facing the cursor; with a gamepad, the right stick; in keyboard-only play, the way last moved | With nothing in hand, a tool or an item selected, there is no stance and walking turns the body as before |
| turnRate | 720 degrees per second | How fast the stance turns towards the cursor or the locked target |
| forward | 1.0 x walking speed | Moving within 70 degrees of the faced direction |
| strafe | 0.85 x walking speed | Moving 70 to 110 degrees off the faced direction |
| backOff | 0.7 x walking speed | Moving more than 110 degrees off it: backing away while still facing the enemy |
| runBreaksFacing | Running turns the body to the way of travel; the back is open until the run ends and the stance turns back at turnRate | Running stays the sprint of section 06, "Stamina in traversal" |
| lockOnRange | 8 tiles | The nearest enemy in front (within lockOnCone) is taken first, else the nearest within range |
| lockOnCone | 90 degrees | |
| lockOnSwitch | Another press while locked takes the next enemy within range, clockwise from the one locked | |
| lockOnRelease | Holding the key 0.4 s; the target dead, downed or surrendered; the target beyond 12 tiles, or out of sight for 2 s | |
| lockOnFacing | While locked, the stance always faces the target; the cursor still aims bows and thrown spears | |
| lockOnCamera | The look-ahead points at the target and is 0.5 of the way to it, capped at lookAheadAiming (section 21) | The camera centres between the steerer and the target |
| drawnFacing | The body is drawn in the nearest of the four authored facings; strikes, shields and backs use the true facing | No new sprite directions (decision DE-2) |

### Weapon movesets
*Combat v2: how every weapon is played (decision DE-4). Ticks at 60 Hz; reach in tiles to the near edge of the body struck (Fight rules, bodyRadius). Damage is before armour; its type is how mail takes it (Weapon rules). Poise damage wears down the target's poise (Poise). Stamina is per swing, per bash or per draw. Every move's ticks (wind-up, active, recovery, miss recovery, step and chain window) are "Frame data" (design addendum 2.5; decision DF-10).*

| Weapon | Reach | Speed | Combo | Damage | Type | vs shield | Poise damage | Stamina | Strength | Weakness |
|---|---|---|---|---|---|---|---|---|---|---|
| Unarmed | 1.0 | Fast | 1 | 0 | Blow | 0 | 20 | 12 | The use action is the shove: pushes 0.4 tiles, breaks a block, makes space | No damage worth having |
| Seax | 0.8 | Fast | 3 | 23 | Cut | 4 | 10 | 9 | Quick combos; the fastest riposte; the best backstab; cuts ropes, lashings and nets | Short reach; its charged heavy never breaks a guard |
| Hand axe | 1.1 | Medium | 3 | 34 | Cut | 22 | 20 | 15 | Its heavy hooks a shield aside and opens the guard | Short reach |
| Spear | 1.8 | Medium | 2 | 30 | Thrust | 8 | 15 | 14 | Keeps foes at bay; thrusts past a shield's edge; can be thrown | Weak once a foe is inside its reach; slow to recover from a miss |
| Spear, thrown | 5 | Planted | 1 | 38 | Thrust | 12 | 25 | 16 | Reach and a big hit, loosed standing still (section 21) | The spear is gone until it is picked up |
| Sword | 1.3 | Medium to fast | 3 | 30 | Cut | 10 | 15 | 12 | Balanced; the widest parry window; the strongest riposte | Rare and costly |
| Dane axe | 1.6 | Slow | 2 | 56 | Cut | 40 | 45 | 26 | Huge stagger; its heavy breaks guards and splits shields | Two hands, no shield; long recovery; easy to punish |
| Club or hammer | 1.2 | Slow | 2 | 40 | Blow | 16 | 38 | 20 | Stagger; works through mail | Slow; short combos |
| Shield | 0.9 | Fast | 1 | 0 | Blow | 0 | 25 | 12 | Blocks the front 120 degrees; stops arrows; the bash is the shove, made with the shield | Each block drains stamina (Guard); can be broken or hooked |
| Hunting bow | 8.3 | Planted | 1 | 30 | Thrust | 6 | 12 | 10 | Silent (noise 1 tile); x2 against the unaware (Sneak attacks) | Cannot move while drawn; poor against shields |

### Weapon rules
*Combat v2: what each weapon does besides its numbers, and armour against the three kinds of damage (decision DE-4). Weapon choice changes how a fight is played, not just the damage.*

| Key | Value | Notes |
|---|---|---|
| axeHook | A hand axe's charged heavy (level 1 or more) that meets a raised shield hooks it aside: the blocker's guard is open for 30 ticks and its next block costs double |  |
| spearEdge | A spear thrust blocked by a single shield still lands 40% of its damage past the shield's edge (none against a shield wall) |  |
| spearKeep | A spear hit pushes the one struck back 0.3 tiles |  |
| spearInside | Against a foe nearer than 0.7 tiles, a spear does x0.5 damage and its windup is 6 ticks longer |  |
| swordParry | A sword widens the parry window by 4 ticks |  |
| daneAxeGuard | Every Dane axe heavy breaks a guard (as a level-2 charge does); at level 2 it splits the shield it meets, which breaks and is dropped |  |
| daneAxeHands | Two hands: no shield with it; it parries but cannot block |  |
| seaxGuard | A seax's level-2 charge does not break a guard |  |
| seaxCuts | Only a blade cuts ropes, lashings and nets; the seax does it fastest (section 25, cutHold) |  |
| mailCut | Mail: -40% from cuts |  |
| mailThrust | Mail: -25% from thrusts and missiles |  |
| mailBlow | Mail: -10% from blows |  |
| padded | Padded: -10% from everything |  |
| shieldBreaks | A shield breaks after 3 guard breaks, or at once to a Dane axe's split; a broken shield is dropped |  |

### Lunge
*Combat v2: lunging attacks close distance at a cost, with a readable tell (decision DE-4).*

| Key | Value | Notes |
|---|---|---|
| lungeWhen | An attack pressed while running towards the faced direction, or at a locked target farther off than the weapon's reach |  |
| lungeDistance | 1.2 tiles covered during the windup (spear 1.5; Dane axe and club 1.0); the seax and bare hands do not lunge |  |
| lungeTell | A step and a dip of the shoulders, 10 ticks before the windup starts, with its own sound | Kept for the steerer's lunge. An enemy's lunge tell is 20 ticks ("Telegraphs"). |
| lungeStamina | The attack's stamina + 8 |  |

### Parry and riposte
*Combat v2: the parry keeps its window, and its reward grows (decision DE-5).*

| Key | Value | Notes |
|---|---|---|
| parryHitstop | 14 ticks on both fighters, with a bright spark and a sharp ring |  |
| parryOpen | The parried attacker reels open for 60 ticks |  |
| riposteReach | The weapon's reach + 0.3 tiles: the riposter steps in |  |
| riposteTicks | Seax 18, sword 24, spear 26, hand axe 28, club 32, Dane axe 34: a heavy, distinct animation that cannot be interrupted; bare hands give a shove instead |  |
| riposteDamage | x3.0 the weapon's damage (sword x3.5); it ignores poise and cannot be blocked |  |
| riposteFrames | The riposte's ticks are 40% windup (the riposter steps in over it), then the weapon's active ticks, then the rest as recovery (decision DE-37) | Kept: "Frame data" lists the same ticks for each weapon's riposte. |

### Poise
*Combat v2: every fighter has poise; hits wear it down, and when it breaks they stagger (decision DE-5).*

| Key | Value |
|---|---|
| poiseOrdinary | 30: the steerer, the household and most people |
| poiseHeavy | 60: the heavy build (section 24) |
| poiseArmour | +5 padded; +15 mail |
| poiseCharged | A charged heavy deals x1.5 its weapon's poise damage at level 1 and x2.0 at level 2 |
| poiseRegen | 20 a second, after 90 ticks without a hit |
| poiseBreak | Stagger for 30 ticks, open to any attack; the poise then refills to full |
| knockdown | A hit that breaks poise with 40 poise damage or more knocks down: 50 ticks on the ground, then 20 to get up |

### Guard
*Combat v2: blocking costs stamina, and a broken guard leaves the blocker open (decision DE-5).*

| Key | Value | Notes |
|---|---|---|
| blockCost | 0.6 x the attack's vs-shield damage + 4 stamina a block |  |
| blockRegen | Half regeneration while the shield is up (as combat v1) |  |
| guardBreak | Stamina empty while blocking, a level-2 charge, an axe hook or a Dane axe heavy: the guard is broken and the blocker open for 50 ticks | Kept for a level-2 charge, an axe hook and a Dane axe heavy. A block that empties the bar breaks the guard with "Block"'s larger stagger (guardBreakEmpty). |
| blockArrows | A raised shield stops arrows and thrown spears from the front 120 degrees; they stick in the board (section 21, shieldBlock) |  |

### Hit reactions
*Combat v2: hits land with weight, on both sides (decision DE-7). Hitstop freezes both fighters' ticks of state together, so it is part of the simulation and replays exactly; everyone else carries on. Knockback is in logical pixels, in the hit's direction.*

| Key | Value |
|---|---|
| hitstopClean | 4 ticks for a clean hit (seax 3; club and Dane axe 5) |
| hitstopHeavy | 7 ticks: a charged heavy, a lunge or a backstab |
| hitstopRiposte | 10 ticks |
| hitstopParry | 14 ticks (Parry and riposte) |
| hitstopBlock | 1 tick |
| knockbackLight | 2 px |
| knockbackHeavy | 4 px: a charged heavy or a lunge |
| knockbackRiposte | 6 px: a riposte, a backstab or a knockdown |
| flinch | A hit that does not break poise flinches the body for 8 ticks (drawn), without stopping what it is doing |
| stagger | 30 ticks when poise breaks (Poise) |
| flash | 1 frame on the one hit |
| shakeHeavy | 2 px for 8 ticks: a heavy hit, or a hit of 25 damage or more taken by the steerer |
| shakeRiposte | 3 px for 12 ticks: a riposte or a backstab. No shake for light hits, and none with reduced motion |

### Health, stamina and healing
*Combat v2 (decision DE-8). Less health for most enemies, stamina that pauses before it refills and runs out, and healing that takes time and leaves the healer open.*

| Key | Value | Notes |
|---|---|---|
| steererVitality | 100 (unchanged) |  |
| residentVitality | 100 for adult residents (unchanged) |  |
| enemyVitality | Each archetype's vitality (section 07, Archetypes): about 25% less than combat v1, so the first scavengers (Outlaw, 68) fall to three clean seax hits or one riposte |  |
| staminaMax | 100 |  |
| staminaRegen | 25 a second after 48 ticks without spending; half while blocking |  |
| bindWound | 2.5 real seconds kneeling; uses 1 binding; restores 25 vitality, up to the maximum less wounds |  |
| eat | 2 real seconds; uses 1 carried ration; restores 10 vitality and 30 stamina |  |
| healInterrupt | A hit, a dodge, a block, a run or a step of more than half a tile ends it, and the binding or ration is lost |  |
| healCarry | Up to 5 bindings and 3 carried rations (each 1 rd taken from the stores) |  |
| bindingsFound | 2 in the camp's salvage (section 03, bindingsAtCamp) and 3 in Thorkel's chest |  |
| afterFight | As combat v1: vitality comes back to its maximum less light wounds when the fight ends and on waking (decision S9-15) |  |

### Bars
*Combat v2: health and stamina as two bars (decision DE-8).*

| Key | Value |
|---|---|
| barsPlace | Health above stamina, top left |
| barsFade | Outside a fight, a bar at full fades out 3 s after it last changed, over 0.5 s; both show at once whenever a fight starts or either changes |
| enemyBar | A thin health bar over the locked target, and over any enemy for 4 s after it was last hit |

### Commitment
*Design addendum 2.5 section 1.1 (decision DF-1): every action has three strict phases, and once begun it is played to its end, by the steerer and by everyone else. Starting values, for tuning after playtests.*

| Key | Value | Notes |
|---|---|---|
| phases | Every action has wind-up ticks (the start, and the tell), active ticks (the hitbox, the parry or the guard live) and recovery ticks | Attacks in "Frame data" and "Enemy attacks"; the parry, block and dodge in their own tables; a bow's draw, loose and recovery; healing as "Health, stamina and healing" |
| locked | From the first wind-up tick to the last recovery tick the fighter cannot move, turn, dodge, block, parry or start another action | Player and AI alike. A light pressed in a chain window is queued and starts only when the recovery has ended |
| noCancels | No action becomes another before its recovery ends | A held charge can only be released (it swings); a drawn bow can only be loosed or let down, and letting it down plays the bow's recovery. Replaces dodgeCancel |
| facing | The facing is set at the first wind-up tick and held to the end of recovery: towards the locked target while locked on, otherwise towards the cursor or the stick | A target that steps aside after the press makes the attack miss. Replaces attackTurn; locked-on attacks go towards the enemy (decision DF-81, the user's ruling) |
| stopOnAttack | The first wind-up tick of any melee attack (a charge included) sets the fighter's speed to zero at once | The only ground an attack covers is its step, and a lunge's strides ("Movement and acceleration") |
| step | Each attack steps forward its fixed distance ("Frame data", Step) evenly over its active ticks | Drawn as a planted step of the leading foot; never a slide or a drift |
| missRecovery | An attack whose active ticks meet no one adds its miss recovery ("Frame data", Miss recovery) | A missed attack leaves the attacker highly vulnerable. Replaces missRecovery and spearMiss |
| punish | A hit on a fighter in a miss recovery, a mistimed parry's recovery, a dodge's recovery or a broken guard is a punish: hitstopHeavy (7 ticks) and x1.5 the blow's poise damage | Shown by the hit's weight, never by text |
| needsStamina | An action that costs stamina starts only with stamina above 0; its cost may take the bar to 0, which exhausts the fighter ("Exhausted") | |
| interrupt | A hit that breaks poise (a stagger or a knockdown) ends any action; a flinch does not | As "Poise" and "Hit reactions" |

### Frame data
*Every move of every weapon, in ticks at 60 Hz (design addendum 2.5; decisions DF-1 and DF-10). These replace the Windup, Active and Recovery columns of "Weapon movesets"; reach, damage, poise damage and the weapon rules stand. **Weight** is the move's class for its telegraph and sound ("Telegraphs"). A heavy is a charge released at level 1 and a charged heavy one released at level 2 ("Charged heavy"): their Wind-up is the swing after the release, and the hold before it is wind-up too. A lunge's Wind-up comes after its 10-tick tell (Lunge), and covers the lunge distance in drawn strides. Miss recovery is added when the active ticks meet no one ("-": the move starts only on a target in reach). Step is the ground covered evenly over the active ticks, in tiles. Stamina is the move's cost (a heavy x1.5 and a charged heavy x2.0 the weapon's, "Charged heavy"; a lunge +8). A chain window queues the next light (Fight rules, chainWindow). The heavy build adds 4 ticks to every wind-up (section 24).*

| Weapon | Move | Weight | Wind-up | Active | Recovery | Miss recovery | Step | Stamina | Chain window |
|---|---|---|---|---|---|---|---|---|---|
| Seax | Light 1 | Light | 10 | 4 | 14 | 8 | 0.15 | 9 | 8 |
| Seax | Light 2 | Light | 10 | 4 | 14 | 8 | 0.15 | 9 | 8 |
| Seax | Light 3 | Light | 13 | 5 | 20 | 10 | 0.2 | 9 | - |
| Seax | Heavy | Heavy | 12 | 5 | 24 | 12 | 0.25 | 14 | - |
| Seax | Charged heavy | Charged | 14 | 5 | 28 | 14 | 0.3 | 18 | - |
| Seax | Riposte | Heavy | 7 | 4 | 7 | - | 0.3 | 9 | - |
| Seax | Backstab | Heavy | 12 | 4 | 14 | - | 0.2 | 9 | - |
| Hand axe | Light 1 | Light | 16 | 6 | 22 | 12 | 0.2 | 15 | 10 |
| Hand axe | Light 2 | Light | 16 | 6 | 22 | 12 | 0.2 | 15 | 10 |
| Hand axe | Light 3 | Light | 20 | 6 | 28 | 14 | 0.25 | 15 | - |
| Hand axe | Heavy | Heavy | 18 | 6 | 30 | 16 | 0.3 | 23 | - |
| Hand axe | Charged heavy | Charged | 20 | 7 | 34 | 18 | 0.35 | 30 | - |
| Hand axe | Lunge | Charged | 16 | 6 | 30 | 12 | 1.2 | 23 | - |
| Hand axe | Riposte | Heavy | 11 | 6 | 11 | - | 0.3 | 15 | - |
| Hand axe | Backstab | Heavy | 16 | 6 | 18 | - | 0.2 | 15 | - |
| Spear | Light 1 | Light | 15 | 6 | 20 | 18 | 0.25 | 14 | 10 |
| Spear | Light 2 | Light | 17 | 6 | 24 | 18 | 0.25 | 14 | - |
| Spear | Heavy | Heavy | 18 | 7 | 28 | 20 | 0.35 | 21 | - |
| Spear | Charged heavy | Charged | 20 | 7 | 32 | 22 | 0.4 | 28 | - |
| Spear | Lunge | Charged | 16 | 6 | 28 | 18 | 1.5 | 22 | - |
| Spear | Riposte | Heavy | 10 | 6 | 10 | - | 0.3 | 14 | - |
| Spear | Backstab | Heavy | 16 | 6 | 18 | - | 0.2 | 14 | - |
| Spear, thrown | Throw | Heavy | 18 | 2 | 24 | - | 0 | 16 | - |
| Sword | Light 1 | Light | 12 | 5 | 16 | 10 | 0.2 | 12 | 9 |
| Sword | Light 2 | Light | 12 | 5 | 16 | 10 | 0.2 | 12 | 9 |
| Sword | Light 3 | Light | 15 | 5 | 22 | 12 | 0.25 | 12 | - |
| Sword | Heavy | Heavy | 15 | 6 | 26 | 14 | 0.3 | 18 | - |
| Sword | Charged heavy | Charged | 17 | 6 | 30 | 16 | 0.35 | 24 | - |
| Sword | Lunge | Charged | 13 | 5 | 24 | 10 | 1.2 | 20 | - |
| Sword | Riposte | Heavy | 10 | 5 | 9 | - | 0.3 | 12 | - |
| Sword | Backstab | Heavy | 16 | 5 | 19 | - | 0.2 | 12 | - |
| Dane axe | Light 1 | Heavy | 24 | 7 | 32 | 20 | 0.3 | 26 | 12 |
| Dane axe | Light 2 | Heavy | 28 | 7 | 36 | 20 | 0.3 | 26 | - |
| Dane axe | Heavy | Charged | 28 | 8 | 40 | 24 | 0.4 | 39 | - |
| Dane axe | Charged heavy | Charged | 32 | 8 | 44 | 26 | 0.45 | 52 | - |
| Dane axe | Lunge | Charged | 24 | 7 | 40 | 20 | 1.0 | 34 | - |
| Dane axe | Riposte | Heavy | 14 | 7 | 13 | - | 0.3 | 26 | - |
| Dane axe | Backstab | Heavy | 16 | 7 | 17 | - | 0.2 | 26 | - |
| Club or hammer | Light 1 | Heavy | 20 | 6 | 26 | 16 | 0.25 | 20 | 10 |
| Club or hammer | Light 2 | Heavy | 23 | 6 | 30 | 16 | 0.25 | 20 | - |
| Club or hammer | Heavy | Charged | 24 | 7 | 34 | 20 | 0.35 | 30 | - |
| Club or hammer | Charged heavy | Charged | 27 | 7 | 38 | 22 | 0.4 | 40 | - |
| Club or hammer | Lunge | Charged | 20 | 6 | 34 | 16 | 1.0 | 28 | - |
| Club or hammer | Riposte | Heavy | 13 | 6 | 13 | - | 0.3 | 20 | - |
| Club or hammer | Backstab | Heavy | 16 | 6 | 18 | - | 0.2 | 20 | - |
| Unarmed | Shove | Light | 8 | 3 | 16 | 6 | 0.1 | 12 | - |
| Shield | Bash | Light | 8 | 3 | 16 | 8 | 0.15 | 12 | - |
| Hunting bow | Draw, loose, recover | Light | 30 | 2 | 20 | - | 0 | 10 | - |

### Enemy attacks
*What an enemy's attack looks like to the steerer (design addendum 2.5 section 1.6; decisions DF-9 and DF-10). An enemy uses its weapon's "Frame data", except that no wind-up is shorter than the telegraph floor for its weight ("Telegraphs"): a light's wind-up is lengthened, and a heavy's or charged heavy's hold is lengthened, so the whole telegraph (hold and swing) is at least the floor. The rows give the result. Active, recovery, miss recovery, step and stamina are the weapon's. The heavy build adds 4 ticks to each wind-up (section 24); Svart's dusk heavy adds svartWindup (section 07). The beasts and the dead have their own attacks.*

| Attack | Weight | Wind-up | Active | Recovery | Miss recovery | Step | Stamina | Tell | Used by |
|---|---|---|---|---|---|---|---|---|---|
| Seax light | Light | 28 | 4 | 14 | 8 | 0.15 | 9 | A sharp breath; the blade drawn back to the hip | Conn, civilians, outlaws, an archer's sidearm |
| Seax heavy | Heavy | 36 (hold 24, swing 12) | 5 | 24 | 12 | 0.25 | 14 | Steel scraping; the blade drawn back high | Outlaws |
| Hand axe light | Light | 28 | 6 | 22 | 12 | 0.2 | 15 | A sharp breath; the axe drawn back over the shoulder | Warriors, raiders, Ketill |
| Hand axe heavy | Heavy | 36 (hold 18, swing 18) | 6 | 30 | 16 | 0.3 | 23 | A grunt and the haft's creak; the axe raised high, held | Warriors, raiders, Ketill (it hooks a shield) |
| Spear light | Light | 28 | 6 | 20 | 18 | 0.25 | 14 | A sharp breath; the spear drawn back along the arm | Guards, raiders, Svart |
| Spear heavy | Heavy | 36 (hold 18, swing 18) | 7 | 28 | 20 | 0.35 | 21 | Steel scraping; the spear drawn right back, the weight on the back foot | Guards, raiders, Svart (48 at the dusk, svartWindup) |
| Spear charged heavy | Charged | 65 (hold 45, swing 20) | 7 | 32 | 22 | 0.4 | 28 | The charge's creak, then its ring; the spear drawn back and trembling | Guards, raiders |
| Sword light | Light | 28 | 5 | 16 | 10 | 0.2 | 12 | A sharp breath; the blade drawn back across the body | Warriors, huscarls |
| Sword heavy | Heavy | 36 (hold 21, swing 15) | 6 | 26 | 14 | 0.3 | 18 | Steel scraping; the blade raised high, held | Warriors, huscarls |
| Dane axe light | Heavy | 36 | 7 | 32 | 20 | 0.3 | 26 | A grunt and the haft's creak; the axe swung back behind the shoulder | Huscarls |
| Dane axe heavy | Charged | 48 (hold 20, swing 28) | 8 | 40 | 24 | 0.4 | 39 | A long grunt, steel scraping; the axe raised over the head and held | Huscarls (it breaks a guard) |
| Club or hammer light | Heavy | 36 | 6 | 26 | 16 | 0.25 | 20 | A grunt and a creak of wood; the club drawn back low | Outlaws, the Crowwick men |
| Club or hammer heavy | Charged | 48 (hold 24, swing 24) | 7 | 34 | 20 | 0.35 | 30 | A long grunt; the club raised over the head and held | Outlaws, the Crowwick men |
| Lunge | Charged | 48 (tell 20, strides 28) | The weapon's | The weapon's lunge recovery | The weapon's | The lunge distance | The weapon's + 8 | A scuff of feet and a drawn breath; the shoulders dip | Any enemy with a lunging weapon, from beyond its reach |
| Shove or shield bash | Light | 28 | 3 | 16 | 8 | 0.15 | 12 | A grunt; the shoulder or shield turned in | Anyone |
| Bow | Light | 42 (settle 6, draw 36) | 2 | 20 | - | 0 | 10 | The bow raised, the string's creak growing | Archers, Conn ("Archers", section 07) |
| Spear, thrown | Heavy | 36 | 2 | 24 | - | 0 | 16 | The spear raised back over the shoulder, the arm held | Raiders, guards |
| Draugr blow | Heavy | 36 | 7 | 30 | 20 | 0.3 | 0 | Dripping that quickens; the arm drawn back | The draugr (the dead do not tire) |
| Draugr grip | Charged | 48 | 8 | 40 | 24 | 0.3 | 0 | Both arms raised, a wet rattle; cannot be blocked or parried, only dodged | The draugr |
| Wolf bite | Light | 28 | 4 | 24 | 16 | 0.5 | 10 | A low growl, the body crouched | Wolves (a leaping bite) |
| Boar charge | Charged | 48 | 30 | 40 | 30 | Up to 4 tiles over the active ticks | 20 | Snorting and pawing, the head lowered; cannot be parried; a shield takes it as a level-2 charge | Boar |
| Each-uisce drag | Charged | 60 | 10 | 60 | 30 | 0 | 0 | The water bulging, a gurgle; only dodged (Book 4: bind or avoid) | The each-uisce |

### Telegraphs
*Combat is read by sight and sound only: no combat text, no damage numbers and no log (design addendum 2.5 section 1.6; decision DF-9). Every enemy attack has an exaggerated tell in its wind-up; heavier attacks have longer, bigger tells.*

| Key | Value | Notes |
|---|---|---|
| floorLight | 28 ticks | The least wind-up of an enemy's light attack: seax, hand axe, spear and sword lights, the shove and the bash, a wolf's bite |
| floorHeavy | 36 ticks | Dane axe and club lights, every heavy (hold and swing together), a thrown spear, the draugr's blow |
| floorCharged | 48 ticks | Charged heavies, the Dane axe and club heavies, lunges, grips and the boar's charge (the each-uisce 60) |
| floorDraw | 42 ticks | An enemy archer's settle and draw before it looses |
| enemyLungeTell | 20 ticks | An enemy's lunge tell, before its strides (the steerer's stays lungeTell, 10) |
| drawBack | 3 px for a light, 5 px for a heavy, 7 px for a charged attack | How far the weapon is drawn back past its ready pose; a heavy or charged attack holds still at the top for its last 6 wind-up ticks before the swing |
| flash | 1 frame, 28 ticks before the first active tick | A subtle flash on the attacker's body and weapon, two palette steps lighter, never white. At the same lead for every attack, so from the flash to a well-timed parry press is always 15 to 22 ticks ("Parry"). With reduced flashes the weapon's ink edge brightens for that frame instead |
| sound | At the flash, panned to the attacker, louder with the weight | A sharp breath (light); steel scraping (a bladed heavy or charged); a grunt and a creak of wood (an axe, club or Dane axe heavy); the charge's creak (level 1) and ring (level 2); a scuff and a drawn breath (lunge); the bow's creak (draw); a growl, a snort and pawing, a wet rattle or a gurgle for the beasts and the dead (Book 11 section 07) |
| enemyStrings | One attack per opening; warriors, raiders and huscarls may follow with a second light, which has its own full telegraph | No enemy chains three |
| steererTells | The steerer's own attacks use "Frame data" without the floors; they are drawn with the same draw-back, and their sound is a breath | The steerer has no voice (Book 11 section 08) |
| noText | No caption, number, word or log entry reports a hit, a block, a parry, damage or a state in a fight | The bars, the lock-on mark and the hit reactions are the only interface in a fight (Book 8 section 10) |

### Movement and acceleration
*Grounded, weighty movement (design addendum 2.5 section 1.2; decision DF-2). No instant starts or stops: speed eases towards the speed wanted at full speed divided by the ticks to full speed each tick, and down at full speed divided by the ticks to stop, so a reversal slows through a stop. Speeds are section 02's and "Stance and lock-on"'s.*

| Mode | To full speed | To stop | Speed | Notes |
|---|---|---|---|---|
| Walk | 9 ticks | 6 ticks | Walk | |
| Run | 24 ticks | 18 ticks | Run | From standing; from a walk 15 ticks. The run's two-frame stop (Book 7 section 17) plays over the stop |
| Sneak | 12 ticks | 6 ticks | Sneak | |
| Back off | 12 ticks | 7 ticks | backOff | |
| Strafe | 11 ticks | 7 ticks | strafe | |
| Blocking | 12 ticks | 6 ticks | 0.5 x the speed the way moved | Walk, strafe or back off with the shield up; no running ("Block") |
| Exhausted | 15 ticks | 8 ticks | 0.5 x the speed the way moved | No running ("Exhausted") |
| Carry | 18 ticks | 12 ticks | Carry | |
| Charging or attacking | - | 0 ticks: stops at once | 0 | "Commitment"; replaces Charge (heavy) |
| In mail | x1.25 the ticks | x1.25 the ticks | | |
| Heavy build | x1.25 the ticks | x1.25 the ticks | | In mail as well, x1.5 |

### Exhausted
*Stamina governs everything (design addendum 2.5 section 1.3; decision DF-3). Fights take a rhythm: engage, back away to recover, engage again. Replaces exhausted ("Health, stamina and healing") and sprintEmpty ("Running out of stamina").*

| Key | Value | Notes |
|---|---|---|
| exhaustedAt | 0 stamina, by any cost | An attack, a parry, a shove, a dodge, a block's drain or running |
| exhaustedLocks | No attack, parry, shove, dodge, block or run | A raised shield drops; a block that empties the bar is a guard break ("Block"). Binding a wound and eating are allowed |
| exhaustedSpeed | 0.5 x the speed the way moved | "Movement and acceleration" |
| exhaustedUntil | 30% of the current maximum | 30 at a full 100; the bar shows the threshold as a notch while exhausted |
| regenDelay | 48 ticks after the last cost | As staminaRegen ("Health, stamina and healing") |
| exhaustedRegenDelay | 60 ticks after reaching 0 | |
| regenRate | 25 a second; 20 a second while exhausted | Half while blocking (staminaRegen) |
| exhaustedFor | 2.5 real seconds from 0 at a full maximum | 1 s of delay and 1.5 s of refill: long enough to be punished |
| exhaustedLook | The exhausted idle (Book 7 section 01: bent, blowing hard) and a hard breathing sound; no word on screen | The refusal word "Too spent" is cut (Book 8 section 10) |
| everyone | Enemies and the crew are exhausted by the same rule; the dead do not tire | Their stamina is 100 (staminaMax) |
| traversal | Climbing, swimming and waist-deep wading keep their own empty-bar rules ("Running out of stamina"), which come first | |

### Parry
*Predictive, not reactive (design addendum 2.5 section 1.4; decision DF-4). The parry has its own frames, and must be started during the enemy's wind-up so that its active ticks meet the blow. Replaces parryStartup, parryWindow and parryRecoveryOnMiss (Defence).*

| Key | Value | Notes |
|---|---|---|
| parryWindup | 6 ticks | The shield or blade comes up; nothing is parried yet |
| parryActive | 8 ticks (option: up to 12); a sword +4 | As the old window and swordParry |
| parryRecovery | 18 ticks after the active ticks, when nothing was parried | The mistimed parry leaves the parrier open: a hit then is a punish ("Commitment") |
| parryOverlap | A blow is parried when its first active tick that would meet the parrier falls within the parrier's active ticks, inside blockArc | A blow that lands during the parry's wind-up or recovery hits |
| parryTiming | So a parry is pressed 6 to 13 ticks before the blow's first active tick: in the attacker's wind-up, 15 to 22 ticks after its flash ("Telegraphs") | With the option at 12, 6 to 17 ticks before |
| parryStun | The attacker is stunned (parried) for parryOpen, 60 ticks, after parryHitstop (14 ticks on both) | "Parry and riposte" |
| parrySettle | On a parry the parrier's remaining active and recovery ticks become a 6-tick settle; then it may riposte | A riposte's wind-up starts inside the stun ("Frame data") |
| parryStamina | 8, refunded on a parry | Defence, parryCost |
| parryNot | Missiles, the draugr's grip, the boar's charge and the each-uisce's drag cannot be parried | |

### Block
*Deliberate defence (design addendum 2.5 section 1.4; decision DF-5). A raised shield halves speed; each hit drains stamina by the attack's power, and a guard emptied breaks with a large stagger.*

| Key | Value | Notes |
|---|---|---|
| blockRaise | 6 ticks | The shield comes up; the guard is live from the 7th tick |
| blockLower | 6 ticks after the key is let go | |
| blockSpeed | 0.5 x the speed the way moved | "Movement and acceleration" |
| blockDrain | Guard's blockCost: 0.6 x the attack's vs-shield damage + 4 stamina a hit | So the drain follows the blow's power: a level-1 charge's vs shield is x1.5 ("Charged heavy") |
| blockStun | 10 ticks a hit | Fight rules, blockStun |
| guardBreakEmpty | 60 ticks of stagger, knocked back 4 px, the shield arm flung wide; then exhausted | A hit that takes the blocker's stamina to 0 |
| guardBreakOther | A level-2 charge, an axe hook or a Dane axe heavy break the guard as Guard says (open 50 ticks) | |
| blockArc | 120 degrees front | Defence |

### Dodge
*A short, stamina-heavy dash with a brief invulnerable middle and a punishing recovery, so it cannot be spammed (design addendum 2.5 section 1.4; decision DF-6). Replaces dodge (Defence).*

| Key | Value | Notes |
|---|---|---|
| dodgeStart | 4 ticks | A dip and a push-off; not invulnerable |
| dodgeDash | 12 ticks covering 1.25 tiles, eased out | The way held, else straight back (Fight rules, dodgeWay) |
| dodgeInvulnerable | Dash ticks 4 to 9 (ticks 8 to 13 of the dodge): 6 ticks | |
| dodgeRecovery | 18 ticks, feet planted, no action | A hit then is a punish ("Commitment") |
| dodgeTotal | 34 ticks | |
| dodgeStamina | 30 | |

## 07 / Enemies, wildlife and perception
### Archetypes
*Vitality is combat v2's, about 25% less than combat v1 gave every enemy but the each-uisce (decision DE-8). Reach is each archetype's: armed people use their weapon's (section 06, "Weapon movesets"), beasts and the dead their own (decision DE-4).*

| Archetype | Vitality | Armour | Weapons | Behaviour | Reach |
|---|---|---|---|---|---|
| Civilian (farmer, keeper, trader) | 45 | None | Tool or seax | Flees, hides, pleads; fights if cornered | A tool 1.0; a seax 0.8 |
| Monk | 38 | None | None | Flees to tower or church; claims sanctuary | None |
| Guard | 75 | Padded | Spear and shield | Holds posts, raises alarm | Spear 1.8 |
| Warrior | 82 | Padded, sometimes mail | Axe or sword and shield | Fights in line, flanks | Hand axe 1.1 or sword 1.3 |
| Raider (Crowwick) | 75 | Padded | Axe, spear | Aggressive, loots, rarely surrenders | Hand axe 1.1 or spear 1.8 |
| Archer | 60 | None | Bow, seax | Keeps distance; stops, draws and looses, then moves (section 21, Missiles); falls back | Bow 8.3; seax 0.8 |
| Huscarl (Orm) | 98 | Mail, helmet | Sword or Dane axe | Disciplined, holds formation | Sword 1.3 or Dane axe 1.6 |
| Outlaw | 68 | None | Mixed | Ambushes, flees when hurt | Their weapon's |
| Draugr | 120 | Resists stagger | Grip and blows | Slow, relentless at night; returns until its anchor is resolved | Grip 0.9 |
| Wolf | 38 | None | Bite | Packs of 3 to 5; circles; flees at half pack lost | Bite 0.7 |
| Boar | 90 | Hide | Charge | Charges when cornered; drops 40 rd of meat | Charge 1.0 |
| Each-uisce | 300 | Supernatural | Drag into water | Avoid or bind; violence only drives it off | Drag 1.2 |

### Perception (tiles)
| Key | Value |
|---|---|
| sightDay | 15 |
| sightDusk | 9 |
| duskSpan | 60 minutes either side of first light and of dark count as dusk (Stage 9, decision S9-23) |
| sightNightUnlit | 5 |
| sightInLight | Full day range inside a light radius |
| fogFactor | 0.5 |
| heightBonus | x1.5 from watch posts and hilltops |
| sightCone | 110 degrees |
| noiseSneak | 0.5 |
| noiseWalk | 2 |
| noiseRun | 5 |
| noiseCombat | 10 |
| noiseShout | 14 |
| noiseHorn | 60 |
| noiseDog | 20 (dogs hear at 20 and bark) |
| surfaceShingle | Noise x1.5 |
| surfaceSand | Noise x0.7 |
| memorySeconds | 20 |
| torchLightRadius | 4 tiles |
| surfaceGrass | Noise x0.5 (grass, machair and heather: soft; combat v2, decision DE-9) |
| surfaceRock | Noise x1.0 |
| surfaceWater | Noise x1.3 (wading) |
| rainFactor | 0.7: sight in rain (combat v2) |
| rainNoise | 0.6: noise heard in rain (combat v2) |

### Cohesion and surrender
| Key | Value |
|---|---|
| groupCohesionStart | 100 |
| allyKilled | -20 |
| allyDowned | -10 |
| leaderKilled | -15 |
| memberBloodied | -10: a member falls below half vitality (Stage 9, decision S9-8) |
| outnumberedTwoToOne | -10 per 10 seconds |
| surrenderBelow | 30 |
| fleeBelow | 20 |
| noQuarterAfter | 2 known `SURRENDERED_KILLED` deeds by the household |

### Fighters' habits
*How the enemy and the crew fight (Stage 9, decision S9-7; design addendum 2.5, decision DF-7): perception 10 times a second and fighting choices by "AI states" and "AI decisions", on the `ai` stream. Starting values, for tuning after playtests.*

| Key | Value | Notes |
|---|---|---|
| awarenessEvery | 6 ticks: a fighter's awareness (Awareness) fills and decays 10 times a second | Fighting choices are made every decisionInterval ("AI decisions") |
| reactChance | 45%: a fighter who sees an attacker's tell defends before the blow lands | Kept. A fighter's parry follows "Parry"'s predictive frames like anyone's, so it parries only blows whose wind-up gives it time; otherwise it blocks or backs off. |
| reactTicks | 6 ticks after the tell at the soonest |  |
| parryShare | 35% of a fighter's defences are parries when a shield is held; all are parries without one |  |
| heavyChance | 20% of a fighter's attacks are charged heavies, held to level 1, or to level 2 against a raised shield |  |
| archerRange | 4 to 7 tiles: an archer keeps this far from its target and shoots from there |  |
| archerArrows | 8 arrows in an enemy archer's quiver |  |
| searchSeconds | 8: a fighter who loses sight of its target goes to where it was last known and searches |  |
| crewFollow | 2.5 tiles behind the steerer |  |
| crewProtect | 4 tiles: a protector fights anyone who comes this near the one it protects |  |
| orderLapse | 60 s: a crew order lapses after this long with no fight under way, and the resident goes back to their day |  |
| attackTokens | 1: at most this many of one side are in an attack on one target at once (a charge, a strike's windup and active frames, a bow drawn); the rest close, flank and threaten until it is over. Warbands 2 (Stage 19) (Stage 9, decision S9-29) |  |
| tokenRest | 2 s: when the last attack on a target ends, the next of that side waits this long before it starts one (S9-29) |  |
| closeIn | 0.85: a fighter closes to this share of its reach before it strikes |  |
| runAt | 3 tiles: a fighter further than this from its target runs to it |  |
| crewRunAt | 5 tiles: a follower further than this behind the steerer runs |  |
| guardHeld | 40 ticks: a defender who raises its shield against a charge holds it this long past the charge's longest hold |  |
| fledAt | 9 tiles: one who flees and stops this far from the steerer (cornered or lost) is gone from the zone, as one out of sight is |  |

### Occupied Skarvholm garrison (late game)
| Post | Strength | Notes |
|---|---|---|
| Broch fort | Kolgrím the Burner and 9 huscarls, 3 dogs | Captives held inside; dogs hear with three times the normal noise radius |
| Barracks (old longhouse) | 12 raiders | Asleep at night unless the horn sounds |
| Watch cairn on Rook Hill | 2, a horn and a beacon | If the horn sounds and they live 60 s more, they light the beacon: it brings Orm's attack, the final battle, 5 days earlier and raises the pressure faster, while the final battle remains a gate (section 22) |
| Hermit's cell | 1 sentry at night | Sees down into Gull Geo |
| Naust Cove ships | 2 ships, 6 on watch | Crews join a fight 120 s after the horn; ships can be burned |
| The dig at the cairn | Gróa, 4 guards, 6 conscripted diggers | Diggers are civilians |
| Patrol | 3 | One loop every 240 s |
| Stakes in the drowned strand | Wreck Strand | A hull landing there at high tide takes 20 integrity damage |

### Hostility and evidence
| Key | Value |
|---|---|
| hostileOnSightAt | Faction regard -60 or a known `CIVILIAN_KILLED` deed |
| waryAt | Faction regard -30 |
| identificationLinkThreshold | 0.5 |
| bodyFoundNearSettlement | Next morning |
| bodyFoundWilderness | 3 to 10 days |
| offshoreFishermanChance | 25% per daytime raid on a coast |
| droppedGearPoints | 0.3 per recognisable item |

### Awareness
*Combat v2: enemies see in a cone from where they face, shortened by darkness and weather, and hear noise; awareness moves from unaware to suspicious to alert (design addendum 2.4 section 1; decision DE-9). Sight ranges and the cone are the Perception rows above.*

| Key | Value |
|---|---|
| states | Unaware, suspicious, alert |
| fillNear | 100 a second while the steerer is seen within 3 tiles |
| fillFar | 20 a second at the edge of sight range, in proportion between |
| fillNoise | +30 for each noise heard within its radius (Perception: noise by action, x the ground) |
| footfall | 0.5 s: a moving actor's footsteps are one noise each half second, heard within its radius (Perception, by gait and ground) (decision DE-38) |
| suspiciousAt | 30: the actor says so ("Who's there?"), turns to the last thing seen or heard and goes to look (searchSeconds) |
| alertAt | 100: the actor fights, flees, warns or raises the alarm, by its kind |
| decay | 10 a second after 3 s with nothing seen or heard; an alert actor stays alert for memorySeconds |
| marks | A small "?" over the head while suspicious and a "!" for 2 s on turning alert; an option, off by default (design addendum 2.5: awareness shows by barks and body language; decision DF-9) |

### Sneaking
*Combat v2: a toggle for a slow, quiet crouching walk; the ground matters, and tall grass, shadow, night and rain hide (decision DE-9).*

| Key | Value |
|---|---|
| sneakToggle | The sneak key toggles the crouching walk; running or a fight ends it |
| sneakSpeed | 1.2 tiles per second (section 02, Sneak) |
| sneakNoise | noiseSneak (Perception) x the ground: shingle loud, grass soft, as the surface rows |
| tallGrass | A sneaking actor in tall grass, dune grass or among peat banks is not seen beyond 2 tiles |
| shadow | A sneaking actor at dusk or night, outside every light pool, is seen at half the sight range |
| rain | Sight x rainFactor and noise x rainNoise for everyone in rain (Perception) |

### Sneak attacks
*Combat v2: striking an unaware enemy from behind (decision DE-9).*

| Key | Value |
|---|---|
| backstab | A melee strike from within 60 degrees of a target's back, on a target that is unaware, or suspicious and not facing the striker |
| backstabKill | Kills outright any foe whose vitality (Archetypes) is 75 or less (civilians, monks, guards, raiders, archers, outlaws, wolves) |
| backstabDamage | Otherwise x4 the weapon's damage (seax x6), ignoring poise |
| backstabTicks | 40 ticks (seax 30): a heavy, distinct animation; the striker is committed to it |
| backstabFrames | As riposteFrames: 40% of its ticks wind up, then the weapon's active ticks, the rest recovery (decision DE-37) |
| backstabNoise | 4 tiles: a short struggle |
| unawareMissile | x2 damage from an arrow or thrown spear that strikes an unaware target, which cannot dodge it |

### Self-preservation
*Combat v2: enemies want to live, and fight like it (design addendum 2.4 section 1; decision DE-6). They work with the attack tokens and flanking of Fighters' habits.*

| Key | Value |
|---|---|
| holdOff | The reach of the one they face + 0.4 tiles: a fighter waits just outside it, circling at strafe speed, steps in to attack and steps out again |
| stepOut | Within 20 ticks after its own recovery a fighter steps back out to holdOff |
| feint | 10% of a melee fighter's attack starts are feints: the tell with no swing |
| longReach | Facing a weapon at least 0.5 tiles longer than its own, a fighter waits a further 0.3 tiles out and lunges in |
| shortReach | Facing a seax or bare hands, a fighter crowds in to 0.7 of its own reach |
| woundedAt | Below 50% vitality a fighter grows cautious: patience x1.5, it defends 20 points more often, backs off 1.5 tiles between attacks, and calls once for help (a shout) |
| retreatAt | Below 30% vitality it falls back towards the nearest friend within 8 tiles; cohesion still breaks groups (Cohesion and surrender: flee, beg or surrender) |
| pressers | 1 or 2 of a group press the attack (attackTokens: 1, warbands 2); the rest circle 2.5 to 4 tiles out, flank or hang back |
| avoid | Deep water, cliff edges within 1 tile, and fire within 1.5 tiles |
| leash | 20 tiles from their own ground: they follow no further, and go back |
| remember | 3 days: a group the steerer fought and left greets the steerer again as an enemy, without warnings |
| leaveIfStronger | Scavengers and thieves leave when the vitality of the steerer's side within 8 tiles is twice theirs or more |
| awareDodge | 25%: an aware fighter that sees the shooter sidesteps an arrow or thrown spear, with a 6-tick tell; never while attacking, blocking, staggered or drawing |
| sidestepMove | After its tell a sidestep moves across the missile's path as a dodge does (section 06, Defence: its distance and ticks), and the missile it reads passes it (decision DE-39) |

### Warnings
*Combat v2: scavengers, thieves and wary locals warn before they fight (decision DE-11). Guards of a hostile faction still attack on sight (Hostility and evidence).*

| Key | Value |
|---|---|
| warnAt | 8 tiles: the first warning, once the steerer is seen |
| warnAgain | 5 tiles: the second |
| lastStep | 3 tiles: the last ("One more step and you'll bleed."); any nearer starts the fight |
| drawnWeapon | A weapon taken in hand within warnAt starts the fight after one more warning |
| warnGap | At least 3 real seconds between warnings |
| walkAway | Beyond 12 tiles the warners go back to what they were doing |

### The scavengers at dusk
*Chapter 1's first fight, built to teach and to feel good (design addendum 2.4 section 6; decisions DE-14 and DE-15). Two of the three wreck-scavengers strip the wreck's stern on Wreck Strand at the first dusk while Ketill watches the fold (Book 6 section 18).*

| Key | Value |
|---|---|
| when | From 18:30 on day 1 until dark (20:00 in spring); then they leave for the fold |
| who | Svart (spear) and Conn (bow and seax), at the stern at the strand's east end (Book 9 section 03) |
| svartWindup | +12 ticks on Svart's charged heavy, with its tell drawn large and sounded, so the first parry lands |
| svartHeavies | 60% of Svart's attacks are charged heavies in this fight |
| svartShield | His shield stays on his back while he works, so he fights with the spear in both hands until the fold |
| connFlees | Conn flees to the fold when Svart falls (dead, downed or surrendered), or when Conn is hit |
| foodBargain | 2 rd of salt fish from the camp's stores: they take it and go |
| checkpoint | An autosave before it (Book 2 section 20) |

### AI states
*AI with intent and distance (design addendum 2.5 section 1.5; decision DF-7). A fighter runs a state machine with cooldowns and decides at intervals ("AI decisions"), never every tick, so enemies never jitter or shuffle. Melee enemies circle just outside their attack range and wait for the steerer to miss before stepping in; they never swarm. It works with the attack tokens of "Fighters' habits" and the rules of "Self-preservation", and Book 2 section 13 holds the contract. The last column is the least time in the state (its cooldown) unless the fighter is hit hard (staggered or knocked down) or its target falls.*

| State | Enters when | Does | Least time |
|---|---|---|---|
| Idle | No hostile is alert to it, or the fight has ended | Its day: work, guard, patrol, or warn (Warnings) | 30 ticks |
| Approach | Alert to a target farther off than its engage distance ("Distances by archetype") | Walks towards the target, running beyond runAt; a guard keeps to its post's leash | 30 ticks |
| Circle | Within engage distance | Strafes round the target at its circle radius, facing it, at strafe speed; turns back at most once each 90 ticks; keeps out of a friend's line of attack | 45 ticks |
| Wait for opening | In Circle and holding an attack token (attackTokens) | Holds at its circle radius, shield up if it has one, and watches; steps in on an opening it can take, or when its patience runs out | 20 ticks |
| Attack | An opening it can take, or its patience run out | One closing step to its attack range at walking speed, then one attack (a second for warriors, raiders and huscarls; "Telegraphs", enemyStrings), or a lunge from beyond reach; feints at the feint share (Self-preservation) | Until its recovery ends ("Commitment") |
| Retreat | Its attack has ended, or the target has stepped inside its circle radius | Backs off to its circle radius at back-off speed, within stepOut (Self-preservation) | 30 ticks |
| Recover stamina | Its stamina is below its archetype's recover-at share | Backs off to its circle radius + 2 tiles, shield lowered to refill at the full rate unless the target closes; back to Circle at 70% | 60 ticks |
| Flee or surrender | Cohesion or wounds break it (Cohesion and surrender; Self-preservation, retreatAt) | Flees, begs or surrenders as before; cornered, it surrenders (decision DE-41) | To the fight's end |

### AI decisions
*How a fighter chooses (design addendum 2.5 section 1.5; decision DF-7). Starting values, for tuning after playtests.*

| Key | Value | Notes |
|---|---|---|
| decisionInterval | 15 ticks: a fighter chooses its state 4 times a second | Each fighter's first choice is offset by 0 to 14 ticks on the `ai` stream, so a group never decides in step. Awareness fills every awarenessEvery (Fighters' habits) |
| circleRadius | The larger of its own attack range and the reach of the one it faces, + its circle margin | "Distances by archetype"; with holdOff (Self-preservation) as the least |
| opening | The target in a miss recovery, a mistimed parry's recovery, a dodge's recovery, a broken guard, a stagger or a knockdown; exhausted, healing or drawing a bow; or with its back turned | Read from what the fighter can see (the target's drawn state), never hidden numbers |
| takeOpening | It steps in only if it can walk to its attack range and finish its wind-up before the opening ends; otherwise it keeps waiting | A melee enemy waits for the steerer's recovery before stepping in |
| attackCooldown | 45 ticks after its own recovery ends before the same fighter starts another attack | Replaces attackGap with patience |
| patience | By archetype ("Distances by archetype"); x1.5 when wounded (woundedAt) | How long it waits in Wait for opening before it attacks, or feints, anyway |
| turnAround | It changes its circling direction at most once each 90 ticks, and never steps back and forth within one decision | Its facing turns at turnRate ("Stance and lock-on") |
| sameRules | Fighters obey "Commitment", "Movement and acceleration", "Exhausted", "Parry", "Block" and "Dodge" exactly as the steerer does | Only the telegraph floors are theirs alone ("Telegraphs") |

### Distances by archetype
*Strict distance thresholds (design addendum 2.5 section 1.5; decision DF-7), in tiles to the near edge of the body (Fight rules, bodyRadius). Engage is where a fighter stops approaching and starts to circle; its circle radius is the larger of its attack range and the reach it faces, plus its margin; Recover at is the stamina share below which it backs off to recover. Attack range is the weapon's reach (section 06, "Weapon movesets"; Archetypes, Reach), closed to closeIn of it before the strike.*

| Archetype | Engage | Circle margin | Attack range | Recover at | Patience | Notes |
|---|---|---|---|---|---|---|
| Civilian | 3 | 0.3 | Their tool or seax | 40% | 2.0 to 3.0 s | Fights only when cornered |
| Guard | 6 | 0.5 | Spear 1.8 | 35% | 2.5 to 4.0 s | Holds its post (leash); shield up while it waits |
| Warrior | 5 | 0.4 | Hand axe 1.1 or sword 1.3 | 30% | 2.0 to 3.0 s | Two in a string |
| Raider (Crowwick) | 5 | 0.3 | Hand axe 1.1 or spear 1.8 | 25% | 1.2 to 2.0 s | The most aggressive; two in a string |
| Huscarl | 6 | 0.4 | Sword 1.3 or Dane axe 1.6 | 30% | 1.8 to 3.0 s | Disciplined: keeps its place in a line; two in a string |
| Outlaw (and the wreck-scavengers) | 5 | 0.4 | Their weapon's | 40% | 2.0 to 3.5 s | Svart (spear), Ketill (hand axe, heavy build); Conn is an archer ("Archers") |
| Archer | Its shooting range ("Archers") | - | Bow; seax 0.8 when cornered | 40% | - | "Archers" |
| Draugr | 8 | - | Grip 0.9 | Never | - | Does not circle or tire: walks steadily in and strikes in range |
| Wolf | 7 | 0.8 | Bite 0.7 | 30% | 1.0 to 2.0 s | The pack circles at 2 to 3 tiles; one bites at a time (attackTokens) |
| Boar | 5 | - | Charge 1.0 | - | - | Charges when cornered or hurt; turns and charges again 2 s after a charge ends |
| Each-uisce | 3 from the water's edge | - | Drag 1.2 | - | - | Book 4: avoid or bind |

### Archers
*Archers need a clear line of sight and stand completely still to draw; brought too close, they dash away once, then reset, re-evaluate, or draw a sidearm when cornered (design addendum 2.5 section 1.5; decision DF-8). Replaces fallBackFrom (Fighters' habits).*

| Key | Value | Notes |
|---|---|---|
| shootFrom | 4 to 7 tiles (archerRange) | It walks to a spot in this band with a clear line before it draws |
| lineOfSight | A clear line from the bow to the target's body: no cover, closed door or friend in the way (section 21, Missiles, coverBlock) | Without one it does not draw; it moves to a spot that has one |
| standStill | It settles for 6 ticks, then draws and looses ("Enemy attacks", Bow) and recovers for 20 ticks, all standing completely still | It moves only between shots |
| tooClose | 3 tiles | |
| dashAway | Once: a hop back away from the target, 2 tiles over 18 ticks, 25 stamina, not invulnerable | Drawn with the dodge frames |
| reset | 12 ticks after the dash, then it re-evaluates: beyond tooClose it shoots again; within it, it is cornered | |
| dashOnce | At most one dash in 6 real seconds | Too close again within that, it is cornered |
| cornered | Deep water, a cliff edge, a wall or the zone's edge within 1.5 tiles behind it, or the target still within tooClose after the dash | It draws its sidearm (20 ticks; a seax) and fights in melee as an outlaw for the rest of the fight (decision DE-41) |
| noArrows | Out of arrows it draws its sidearm the same way | Section 13 of Book 2 |

## 08 / People, skills and wounds
### Skills
| Key | Value |
|---|---|
| levels | 0 to 5 |
| xpPerWorkerDay | 1 in the skill used |
| xpToLevel | 10 for 2, 30 for 3, 60 for 4, 100 for 5 (cumulative) |
| outputMultiplier | 0.6 + 0.15 x level (0.6 at 0, 1.35 at 5) |
| playerTimingBonus | Up to +25% task output for good timing, on the timed tasks only (Hands-on action, timedTasks: fishing from the shore) |
| startingSkills | 2 in each skill Book 5 names for a person; the steerer 1 in every homestead task; 0 otherwise |

### Friendship deltas by deed (valence per value point)
| Deed | Gain | Mercy | Glory | Kin | Faith | Word |
|---|---|---|---|---|---|---|
| `THEFT` | +2 | +1 | -1 | 0 | 0 | 0 |
| `THREAT` | +2 | -1 | +1 | 0 | 0 | 0 |
| `TRIBUTE_TAKEN` | +2 | +1 | -1 | 0 | 0 | 0 |
| `FAIR_TRADE` | +1 | +1 | -1 | 0 | 0 | +2 |
| `KILLING` | 0 | -2 | +2 | 0 | 0 | 0 |
| `CIVILIAN_KILLED` | 0 | -4 | -1 | 0 | -1 | -1 |
| `SURRENDERED_KILLED` | 0 | -4 | -1 | 0 | 0 | -3 |
| `SPARED` | 0 | +3 | -1 | 0 | 0 | +1 |
| `BURNING` | -1 | -3 | +1 | 0 | 0 | 0 |
| `SEED_TAKEN` | +1 | -2 | 0 | 0 | 0 | 0 |
| `SEED_LEFT` | -1 | +2 | 0 | 0 | 0 | 0 |
| `SACRED_TAKEN` | +2 | 0 | +1 | 0 | -4 (same faith) | 0 |
| `SACRILEGE` | 0 | -1 | 0 | 0 | -3 (same faith) | 0 |
| `RESCUE` | -1 | +3 | 0 | +1 | 0 | 0 |
| `HOSTAGE_TAKEN` | +1 | 0 | 0 | 0 | 0 | 0 |
| Captive harmed | 0 | -3 | -1 | 0 | -1 | -2 |
| Theft from the household's own stores | -2 | 0 | -1 | -3 | 0 | -3 |
| `KILLING_HIDDEN` | 0 | -2 | -2 | 0 | 0 | -3 |
| `HOSPITALITY_BROKEN` | 0 | -1 | -1 | -1 | -1 | -4 |
| `BLOOD_PRICE_PAID` | -1 | +1 | -1 | +1 | 0 | +2 |
| `BLOOD_PRICE_TAKEN` | +1 | +1 | -1 | +1 | 0 | +2 |
| `RITES_DENIED` | 0 | -1 | 0 | -2 | -3 | 0 |
| `CHALLENGE_REFUSED` | 0 | +1 | -3 | 0 | 0 | 0 |
| `PROMISE_KEPT` | 0 | 0 | 0 | 0 | 0 | +3 |
| `PROMISE_BROKEN` | 0 | 0 | 0 | 0 | 0 | -4 |
| Resident left behind | 0 | -1 | 0 | -4 | 0 | -1 |
| Crew member died | 0 | 0 | 0 | -2 | 0 | 0 |
| Retreat with everyone alive | 0 | +1 | -2 | +2 | 0 | 0 |

Revision 2.3 (decision DC-6): taking captives in a fight is ordinary dealing (Mercy objects to cruelty towards captives, not to capture); theft from the household's own stores is judged more harshly than open plunder abroad. `delta = sum(weight x valence x witness x culture)` in friendship, clamped to -15 and +15 per deed; witness factor 1.0 present, 0.6 told by a trusted tie, 0.3 rumour. Kári and any resident with Glory 3 and no Mercy treat the Glory valence of `CIVILIAN_KILLED` as 0: there is no glory in killing farmers, and no shame to a drengr either (decision DD-2). (Revision 2.2: these deltas, which moved the single regard, now move friendship; fear has its own table below.)

### Deed weighing
*The numbers of the formula above, as a table so the game reads them (decision S8-2).*

| Key | Value |
|---|---|
| deedClamp | -15 to +15 friendship per deed |
| witnessPresent | 1.0 |
| witnessToldByTie | 0.6 |
| witnessRumour | 0.3 |
| drengr | Glory 3 and no Mercy: the Glory valence of CIVILIAN_KILLED is 0 |

### Deed reactions by culture
*The witness's culture weighs a deed first (the `culture` factor in the delta above, and a fear or shame response), then their values, traits and stance (design addendum 2.3 section 2; Book 6 section 01). Positive is approval; the words are how they say it.*

| Deed | Norse | Gaels | Church | Keepers | Saltvik |
|---|---|---|---|---|---|
| `KILLING` in open fight | x1.0 (honourable if bold) | x1.5 against (an act of war; éraic owed) | x1.2 against (a sin, though kings do it) | x0.5 (the sea's business) | x1.0 (bad for trade) |
| `THEFT` | x1.0; the Glory-minded scorn it | x0.8 against (less grave than burning) | x1.0 against (a sin) | x1.0 against (taking without giving) | x1.5 against (cheating the bargain) |
| `CIVILIAN_KILLED` | x1.0 against (no glory, bad luck, vengeance) | x2.0 against (outrage; éraic by rank) | x2.0 against (a grave sin) | x1.5 against (blood on the shore) | x1.5 against |
| `SURRENDERED_KILLED` | x1.5 against (níð-worthy shame) | x1.5 against | x2.0 against (murder) | x1.5 against (oath-breaking) | x1.5 against |
| `KILLING_HIDDEN` | x2.0 against (murder) | x1.5 against | x1.5 against | x0 | x1.0 against |
| `HOSPITALITY_BROKEN` | x2.0 against | x2.0 against (the briugu's curse) | x1.5 against | x1.5 against | x2.0 against |
| `SACRILEGE` at a church | x0.2 against (bad luck to the superstitious) | x1.5 against | x3.0 against (the worst of crimes) | x0 | x0.5 against |
| `SACRILEGE` at an old shrine or mound | x1.5 against (the land-spirits) | x1.0 against (the aos sí remember) | x1.0 for (a good work) | x2.0 against | x0.5 against |
| `BLOOD_PRICE_PAID` / `BLOOD_PRICE_TAKEN` | x1.0 for; Glory 2 or more against | x1.5 for | x1.0 for | x0 | x1.5 for |
| `HOSTAGE_TAKEN` | x0 (ordinary dealing) | x0 | x0 | x0 | x0 |
| `PROMISE_BROKEN` | x1.5 against | x2.0 against (sureties ruined) | x1.5 against (a sin) | x3.0 against | x2.0 against |
| `RITES_DENIED` | x1.5 against (invites draugar) | x1.0 against | x2.0 against (the soul denied) | x1.5 against | x1.0 against |
| `CHALLENGE_REFUSED` | x1.5 against (cowardice; níð) | x1.0 against | x1.0 for (righteous) | x0 | x0 |

People of mixed birth (Bran, Senán, Áine, much of Saltvik) take the stronger of their two cultures' factors.

### Traits
| Trait | Effect |
|---|---|
| Berserk | When wounded (30%) or when a friend falls (50%), goes berserk for 20 s: ignores orders, attacks the nearest enemy (including the surrendering, and farmers in reach), damage x1.3, defence x0.7; the deeds count against the household |
| Cowardly | Breaks when cohesion falls below 40 (others at 25); 25% to flee a losing fight; happiness -10 on night raids |
| Superstitious | 50% to refuse a task or voyage after a bad omen; panics at supernatural signs (cohesion -20); insists on rites |
| Brave | Cohesion +20; volunteers for danger |
| Greedy | Pockets 5% of loot; plunder-share disputes x2 |
| Pious (a faith) | Prays 15 game minutes a day; reactions to sacrilege x2, and to its own faith's cruelty x1.5 |
| Hot-tempered | Starts disputes x1.5; 20% to come to blows |
| Gentle | Disputes among those watching x0.5; friendship lost over a killing x1.5 |
| Drinker | Drinks at feasts and in hard times; work x0.7 the morning after |
| Light-fingered | Takes one small item from the stores every 6 days, unless watched |
| Keen-eyed | Sight +2 tiles at sea and on watch; spots ambush signs 3 tiles sooner; remarks on a secret entrance within 4 tiles (section 20) |
| Sea-sick | Work x0.8 at sea; x1.05 on land |
| Storyteller or singer | Happiness +5 for everyone at the fire |
| Grudge-holder | Grudges never fade; friendship lost to a slight x1.5 |
| Diligent / Lazy | Unsupervised work x1.1 / x0.85 |

### Traits per person
*A heading of its own since Stage 8, so both tables reach balance.json (decision S8-2).*

| Key | Value |
|---|---|
| traitsPerPerson | 2 to 4; one or two shown at once, the rest discovered over 5 to 20 days |

### Likes and dislikes
| Key | Value |
|---|---|
| likeMet | Happiness +5 that day (a liked food, activity, place, weather or person) |
| dislikeMet | Happiness -5 that day |
| likedGift | Friendship +3 (as a gift that suits them) |
| dislikedGift | Friendship -2 |
| perPerson | 3 to 5 likes and 2 to 3 dislikes |

### Relationships
| Key | Value |
|---|---|
| friends | Two residents become friends at +40 between them, rivals at -40 (shared events move it: a shared fight +8, a meal together +1, a dispute lost to the other -10) |
| mentor | A resident two skill levels above another, after 10 days working beside them |
| drinkingCompanions | After three feasts drinking together |
| griefOfFriend | A friend's death: happiness -25 x1.5 |
| rivalDisputes | Disputes between rivals x2 |
| noRomance | No romance ties form; existing marriages and family ties remain |

### Stances
| Key | Value |
|---|---|
| kinds | Conventional, sceptical, cynical, transgressive (Book 5) |
| shift | After a strong event (a deed worth 15 or more friendship, a tie's death, a bargain), at most once per 30 days |

### Happiness, friendship and fear
| Key | Value |
|---|---|
| happiness | 0 to 100; starts at 60 |
| friendship | -100 to 100; starts at 0, or 20 for a resident with a tie to the steerer |
| fear | 0 to 100; starts at 0 |
| workOutput | Output x (0.8 + 0.4 x happiness / 100) |
| unhappyDisputes | Below 25 happiness, disputes are twice as likely |
| loyal | Friendship 40 or more: volunteers for danger, defends the steerer, stays in hard times |
| leaves | Friendship -40 or less with fear below 30: starts the request to leave |
| fearfulObedience | Fear 60 or more with friendship below 0: obeys any order with 15% worse quality; 5% a day of deserting or betraying while the steerer is away or wounded |
| devotion | Fear 60 or more with friendship 40 or more: fierce devotion (never deserts; Glory deeds x1.5) |
| happinessDrift | Moves 10% of the way to the day's target each game hour, from a base of 50 |
| fearDecay | -1 a day with no new fear |
| friendshipDecay | None |
| warningSpacing | Two days between steps of the warning flow (remark, complaint, refusal, request to leave) |

### Happiness inputs
| Input | Effect on the day's target |
|---|---|
| Fed (a meal and a hot meal) | +15 |
| Hungry | -20 |
| Warm at night | +10 |
| Cold at night | -15 |
| Slept in a bed | +5 |
| Safe (no threat today) | +5 |
| Success (a raid home, a harvest in, a building finished) | +10 for 3 days |
| Grief (a tie died) | -25, fading over 7 days |
| Festival or feast | +20 for 2 days |
| Treated well today (praise, help, a gift) | +5 to +10 |
| Treated badly today (punished, shamed, overworked) | -10 to -20 |

### Friendship from care and time
| Source | Friendship |
|---|---|
| A gift that suits them | +3, at most once per 5 days |
| Time spent (a real conversation, an hour working beside them) | +1, at most +3 a day |
| Tending their wound | +4 |
| A request fulfilled | +5 small, +10 personal, +15 dangerous |
| A request refused | -2 small, -5 personal or dangerous |

### Fear deltas
| Deed or act | Fear (x witness) | Notes |
|---|---|---|
| `KILLING` seen | +2 | |
| `CIVILIAN_KILLED` | +8 | |
| `SURRENDERED_KILLED` | +10 | |
| A punishment | +6 to the punished, +3 to those watching | Disputes |
| A threat to a resident | +8 | Friendship -5 |
| A display of strength (a duel won, a champion killed) | +4 | |
| Harming a resident | +15 | Friendship -20 |

### Friendship bands
| Band | From |
|---|---|
| Devoted | 70 |
| Loyal | 40 |
| Content | 10 |
| Uneasy | -10 |
| Resentful | -40 |
| Estranged | below -40 |

### Wounds
| Severity | Recovery | Effect |
|---|---|---|
| Light | 2 days | -10 vitality max |
| Serious | 6 days | Cannot fight; half work |
| Grave | 14 days | Bed-bound; needs care; 10% death risk without care |
| Maimed | Permanent | A trait (lost eye, stiff hand) with a skill penalty |
| Untended | No recovery | A wound begins to heal only once it has been tended (Tend wounds, section 09); its recovery counts from that day |

### The three searches
*Added for Stage 10 (decisions S10-7 to S10-10), changed by design addendum 2.4 (decisions DE-16 to DE-22): the numbers of Chapter 1's three searches (Book 4 section 08, beat 13). Where they move friendship they are the person's own reaction to how they were found, as a reply's are (Conversation replies), besides any deed the ledger weighs. Oddi's dilemma is now over the ship's silver, in its strongbox; Thorkel's own chest is locked, and is carried up to the camp on the first day (decision DE-17).*

| Key | Value | Notes |
|---|---|---|
| oddiCall | 9 tiles | Oddi calls out when the steerer comes this near him on Wreck Strand and asks for the ship's silver, in its iron-bound strongbox a little along the shingle; the wreck-scavengers take it the moment he is set down safe (anywhere above the tide line, on the strand or off it: his rescue, decision DE-85), or when the steerer leaves the strand without it once he has called |
| chestSilver | 4 oz | The ship's hack-silver in the strongbox: what the wreck-scavengers take for Thorkel's body, or for the steering oar (Book 10 section 04 prices it) |
| chestFirst | Oddi +3 friendship | The strongbox carried off the strand before he is set down safe: the haul saved (Gain). Lifted first, he says he will wait (decision DE-85) |
| chestLost | Oddi -3 friendship | The strongbox left for the scavengers to take |
| limp | 0.9 tiles per second | How fast a rescued person with a serious leg wound walks home under their own power (Runa) |
| parley | 30 real seconds | Wreck-scavengers who see the steerer come with empty hands, not running, hold and talk this long before they lose patience; a weapon taken in hand, a blow or a threat ends it at once |
| guard | 3 tiles | Bran fights any foe who comes this near Thorkel's body, and goes back to it between |
| offering | Runa +5 friendship | The Cailleach given her due at the Hag's Seat (Faith in the old powers) |
| cliffPath | Runa -3 friendship | The cliff path taken with the stone still weeping: the rite left undone |
| searchesPlaced | The first dusk: 19:00 on day 1 | Oddi, Bran (with Ketill watching the fold) and Runa are where they are found from then on; Hild names them at the first-night fire, for the morning (decision DE-16) |
| keyFromBody | Given when Thorkel is laid on his bier, or taken from his body wherever it lies | However Bran's search ends (fight, sneak, bargain or lost), Thorkel's key reaches the steerer: from Bran at the bier, else by interacting with the body (decision DE-18) |
| runaSafe | The camp, the shelter or the boat | Runa's tool chest set down at any of these lets her ask where it is, the next time the steerer talks to her (decision DE-21) |
| runaTruth | Runa +2 friendship | The true place told |
| runaLie | Runa -3 friendship per point of her Word | A false place told is found out when she goes to look, on her next walk past it and at most a day later; it counts against Word (her Word 2: -6) |
| rescueGetUp | 4 real seconds | A rescued person set down gets up after this, walks to the camp (at the limp speed if hurt), takes up work, eats and sleeps under the shelter; no one is left sitting where they were found (decision DE-22) |
| rescueHome | Reaches the camp's fire within 3 game hours of getting up | Whatever the time of day, the route taken home or what the steerer does next (leaving the zone at once, sleeping, fighting); checked by the rescue scenario test (Book 2 section 23; decision DF-18) |
| rescueStuck | 30 real seconds | A rescued person who is awake and not in talk, work, a meal or a scene, and has neither moved nor changed what they are doing for this long, is stuck: the rescue scenario test fails |

### Thorkel's rites
*Added for Stage 11 (decisions S11-13 to S11-16): Thorkel's rites, optional and recommended by Hild (Book 4 section 08, beat 6), once his body lies on its bier by the broch. Like the searches' numbers, these are the household's own reaction to the rite, besides anything the ledger weighs.*

| Key | Value | Notes |
|---|---|---|
| ritesValue | +2 friendship per point | Each resident's Kin and Faith points, when Thorkel is given his rites in either form |
| ritesGuard | Bran +3 friendship | Bran kept the body for this |
| ritesHappiness | +10 happiness | Everyone at the rite: the grief eased, for the day |
| seaGold | -1 friendship per point | Each resident's Gain points, when Thorkel's gold ring goes into the sea with him |
| settingStones | 2 game hours | The household lays the stones of the ship-setting on the machair before the rite begins |
| riteLength | 60 game minutes | The rite itself, from the gathering to the last word |

### The household day and talk
*Added for Stage 8 (decisions S8-1 to S8-30): barks, conversation, schedules and the warning flow. Starting values, for tuning after playtests.*

| Key | Value | Notes |
|---|---|---|
| barkEarshot | 10 tiles | A resident barks only when the steerer is in the same zone within this distance |
| idleBarkEvery | 75 to 150 real seconds | Between one resident's barks, drawn on the people stream; a bark with a cause (a wound, the work, the weather) waits the same |
| barkSameSpeaker | 10 real minutes | No identical bark from the same speaker within this time (Book 8 section 08) |
| barkSameLine | 1 real minute | No two speakers repeat the same line within this time (Book 8 section 08) |
| topicsPerTalk | 3 | Up to three topics in a conversation (Book 8 section 09) |
| topicRest | 2 days | A topic talked through is not offered again for this long; a wound's topic comes back when the wound changes (tended, healed) |
| approachTiles | 5 tiles | A resident with a pressing topic (an untended wound, a fresh grief, a scene) comes to the steerer to raise it when this close, once per topic |
| lowHappiness | Below 25 for a whole day | Starts the happiness steps of the warning flow (Book 8 section 11, "Happiness low") |
| supervised | The steerer in the same zone within 12 tiles | Diligent and lazy change work only without supervision (Traits) |
| workingBeside | Within 4 tiles, both at work | An hour of it counts as time spent (Friendship from care and time) |
| lightFingeredTake | 1 rd of food | The small item a light-fingered resident takes from the stores (Traits); it is hidden in their bedding |
| lightFingeredWatched | The steerer awake in the home zone | Unless watched (Traits): a theft is tried when the thief goes to bed; residents on watch arrive with the watch (Stage 19) |

### Conversation replies
*Added for Stage 8 (decision S8-12): what a reply in a conversation does, by its kind. Each uses a row above.*

| Reply | Effect |
|---|---|
| Talk | Time spent: friendship +1, at most +3 a day (Friendship from care and time) |
| Warm | Treated well today: happiness +5 |
| Glad | Treated well today: happiness +10 (a kindness that suits a like) |
| Cold | Treated badly today: happiness -10 |
| Punished | Treated badly today: happiness -10; a punishment (Fear deltas) |
| Shamed | Treated badly today: happiness -20; a punishment (Fear deltas) |
| Threat | A threat to a resident (Fear deltas) |

## 09 / Buildings, tools and crafting
### Buildings
| Building | Footprint tiles | Materials | Worker-days | Capability |
|---|---|---|---|---|
| Sail shelter in the broch | Broch | Salvaged sail | 1 | Shelter for 6 |
| Longhouse | 16 x 6 | 10 timber, 1 iron | 12 | Housing 10; hearth; morale +1 |
| Second house | 14 x 6 | 8 timber, 1 iron | 10 | Housing 8 |
| Boatshed (naust) | 14 x 5 | 6 timber | 8 | Ship maintenance, winter lay-up, refits, hull building |
| Forge | 6 x 5 | 1 timber, 1 iron, stone | 4 | Smithing |
| Drying racks | 8 x 5 | 2 timber | 2 | Dry fish |
| Smoke-house | 6 x 5 | 3 timber | 4 | Smoke fish and meat |
| Storehouse | 8 x 4 | 5 timber, 1 iron | 6 | No grain loss; capacity 40 lots |
| Byre | 10 x 5 | 5 timber | 6 | Winter shelter for 6 cattle |
| Watch cairn | Rook Hill | Stone | 4 | One watch of warning when manned |
| Workshop | 6 x 5 | 3 timber | 4 | Carpentry, tools, shields, fletching (section 21, Arrows) |
| Shrine, cross or hammer-post | 4 x 3 | 1 timber | 2 | Faith morale for those it suits |
| Palisade (mainland) | Per 2 tiles | 1 timber | 1 | Defence |
| Gate and watch platform | 4 x 2 | 3 timber, 1 iron | 4 | Defence, sight x1.5 |
| removalRefund | | 50% of materials | | |

### Smithing (per iron lot at the forge)
| Product | Yield | Labour | Skill |
|---|---|---|---|
| Tool heads | 4 | 1 worker-day | 1 |
| Spearheads | 6 | 1 worker-day | 1 |
| Axe heads | 2 | 1 worker-day | 2 |
| Boat rivets | 30 | 1 worker-day | 1 |
| Helmet | 1 (needs 1 lot) | 3 worker-days | 3 |
| Mail shirt | 1 (needs 4 lots) | 20 worker-days | 4 |
| Sword | 1 (needs 2 lots) | 10 worker-days | 5, mainland forge only |

### Carpentry
| Product | Materials | Labour |
|---|---|---|
| Shield | 1 timber per 3, hides | 1 worker-day per 3 |
| Spear shafts | 1 timber per 6 | 0.5 worker-day |
| Fishing net | 1 wool lot per 2 | 1 worker-day |
| Hull patch (Chapter 1) | 4 boards, 30 rivets | 2 worker-days |

### Homestead tasks: time and stamina
*Each hands-on action takes game time and only a little stamina, so the day is the real cost of working and work stays a bonus (Book 1 section 18). Driftwood is not worked by the steerer: it is picked up where the sea leaves it ("Driftwood finds", section 03; decision PT-2), and walking the weed lines for it is a resident's job.*

| Task | Game minutes per action | Stamina per action |
|---|---|---|
| Fish from the shore | 30 | 1 |
| Fell a tree | 45 | 3 |
| Split timber | 20 | 2 |
| Cut peat | 30 | 2 |
| Sow a strip | 30 | 1 |
| Weed | 20 | 1 |
| Water the kale garden | 15 | 1 |
| Harvest a strip | 30 | 2 |
| Thresh | 30 | 2 |
| Build (hammer, raise a beam, thatch) | 30 | 2 |
| Smith | 30 | 2 |
| Carpentry | 30 | 1 |
| Fletch arrows | 30 | 1 |
| Mend nets | 20 | 0 |
| Herd | 30 | 1 |
| Milk | 15 | 0 |
| Shear | 20 | 1 |
| Cook | 30 | 0 |
| Tend wounds | 20 | 0 |
| Repair the ship | 30 | 2 |
| Gather shellfish, seaweed or eggs | 20 | 1 |
| Train | 30 | 3 |
| Light a fire | 10 | 0 |

### Hands-on action
*Added for Stage 7 (decision S7-8), changed from the user's playtest note (decision PT-1): how a player's action plays. Book 2 section 07: a menial task is a plain action, its work loop playing with no timing ring and no press, adding work at the player's skill. Only the timed tasks keep a timed press, whose good timing adds up to playerTimingBonus; missing it never ruins the catch.*

| Key | Value |
|---|---|
| actionSeconds | 2.5 real seconds while the work loop plays; the task's game minutes pass at its end |
| timedTasks | Fish from the shore only; every other task is a plain action |
| timingMark | 1.5 real seconds into a timed action |
| timingWindow | 0.3 real seconds either side of the mark earns the full playerTimingBonus, falling to none 0.3 s further out |

### Disputes
| Key | Value |
|---|---|
| minimumResidents | 10 |
| interval | Every 5 to 8 days; twice as often while average happiness is below 25 |
| kinds | Theft, insults, a fight, shirking, a share of plunder, belief (whose shrine), an old grudge, a debt, a broken promise |
| ignoredFor | 2 days: both parties' happiness -5 a day and 20% a day of a fight |

### Dispute judgements
| Judgement | Favoured party | Other party | Those watching | Cost |
|---|---|---|---|---|
| Take a side | Friendship +6, happiness +5 | Friendship -8, happiness -10 | Friendship +2 or -2 by whether the side fits their values | None |
| Compromise | Friendship +2, happiness +2 | Friendship +2, happiness +2 | Word +1 | None |
| Punish | | Fear +6, friendship -10 | Fear +3 | None |
| Pay compensation | Friendship +4 | Friendship +4 | Gain-minded -1 | 1 to 3 oz |
| Call a household thing | Follows the vote | Follows the vote | Friendship +3 for Word and Kin | 1 game hour of every resident's time |
| Ignore | Happiness -5 | Happiness -5 | | The dispute may return within 3 days |

### Requests and quests
| Key | Value |
|---|---|
| requestInterval | About every 12 days from a resident with friendship 10 or more; leaders at friendship 20 or more |
| sizes | Small (a day or two at home), personal (a voyage or a mainland trip), dangerous (a fight or a killing) |
| expires | Small after 10 days, personal after 30; dangerous never, but friendship -1 a week while open after 30 days |
| revengeKilling | A killing in a town is a deed: its guards turn hostile, the victim's kin start a feud, and the blood-price is 12 oz |
| otherWaysOut | A blood-price of 12 oz, a duel (hólmganga rules, section 13), exile (the target leaves the coast), or the truth (the quest ends with no deed) |

## 10 / Target progression for a good player
*An idealised path for a capable player who plans well. It sets balance targets; it is not a script, and never a deadline (design addendum 2.3 section 4: the story moves only through gates the player starts). Most players will be behind it in places and ahead in others.*

| Day | Milestone | Residents | Voyages (raids) | Tools and weapons | Ship | Buildings | Food and stores |
|---|---|---|---|---|---|---|---|
| 6 | Chapter 1 done; boat launched | 4 | 0 | The steerer's seax (found on Wreck Strand) and Thorkel's hunting bow (from his chest, section 21) and its arrows; wreck kit: 2 axes, Runa's tools, 2 spears, 2 shields, Bran's axe, Thorkel's sword (or buried), knives, a line | T1, 1 fitting | Sail shelter, fire | 8 to 10 days runway |
| 15 | First raid home | 5 (Eithne) | 1 (1) | +1 to 2 iron lots | T1, 1 fitting | Forge marked out | 30 days runway |
| 30 | Two raids and one trade; plots sown | 6 to 8 (Kolbeinn, Asa) | 3 (2) | Axes 3, adze, 2 sickles, 2 spades, 2 nets; spears for all, 5 shields, 2 axes, 1 sword, 1 helmet | T1, 2 fittings | Forge, racks, longhouse framed; 30 peat loads drying | 150 rd stored; 25 days runway |
| 45 | The Followers arrive | 12 to 13 | 5 (3) | Spears and shields for all fighters | T1, 3 fittings | Longhouse done, smoke-house; hay cutting begins | 200 rd; runway 15 days (more mouths) |
| 60 | End of Chapter 3; Nessa joined | 13 | 7 (4) | 3 helmets, 2 bows | First refit; 8 timber stockpiled for the karvi | Second house started, storehouse, byre, watch cairn; 2 cows, 8 sheep | 300 rd; 50 dry peat |
| 75 | Harvest in | 13 to 14 | 8 (5) | | Karvi bought or keel laid | All four plots harvested | +600 rd from barley |
| 90 | Winter ready | 14 | 9 (6) | 1 to 2 mail shirts, 4 helmets | Karvi acquired or 60% built; laid up in the boatshed | 2 houses, store, byre, smoke-house, racks, forge, workshop, shrine | 600 rd (40 days), 75 fuel, 25 hay |
| 120 | Winter survived | 14 to 15 | 9 | | Karvi launched if built | Repairs done | No deaths from cold or hunger; Yule feast held |
| 150 | First answer settled or beaten | 15 to 16 | 12 (8) | All fighters helmeted; 3 mail | Second hull planned | Defences on Skarvholm | 30 days runway |
| 180 | Council commits to a site | 16 | 14 | | Consort acquired | Mainland site scouted on foot | Island failing: water hauled |
| 210 | Mainland home defensible | 16 | 17 | Mainland forge: swords possible | Two ships | M2: hall, palisade, gate, boatshed | Most mainland sites known; four routes crossed |
| 240 | Council ends; Orm holds Skarvholm | 16 | 19 | | T3 hull | M2 complete | 4 allies committed, 1 conditional; 2 of 3 keys in hand or in reach |
| 250 | The Return: the Cup recovered | 16 | 20 (the Return) | | Flagship, consort, an allied ship | Beacon unlit; Orm's two ships burned | Compact renewed at Inis Rón |
| 270 | Finale | 16 plus allies | 21 | | | | |

### Gate checks against this table
- Build 2 (Stage 20): a scripted good-player run reaches the day-30 row within 10%.
- Stage 26: a household at the day-90 row survives winter with no deaths from cold or hunger; at half the stores it fails visibly, with warnings from day 70.
- Autoplay: the merciful policy reaches day 90 within 15% of the brutal policy's wealth and ahead of it on allies.

## 11 / Homestead threat schedule
*A rough schedule of what reaches the home. Most threats are conditional on the player's deeds and preparation; each has a warning and a counter.*

### Year 1 on Skarvholm
| Days | Threat | Condition | Warning | Scale | Counter |
|---|---|---|---|---|---|
| 3 to 6 | Wreck-scavengers return at night | Not dealt with in Chapter 1 | Lights in Seal Cave | 3 | Watch, fight, bargain |
| 8 to 14 | First storm | Always | Sky and swell a day ahead | Camp damage | Secure the sail roof; driftwood after |
| 18 to 28 | Crowwick skiff lands at Gull Geo to steal | Ulf's interest or 50% | Unknown sail at dusk from Rook Hill | 4 to 5 | A watcher at the cell; dogs later |
| From 20 | Thorkel's draugr on Wreck Strand at low-tide nights | No rites given | Wet footprints to the door | 1, escalating weekly | Rites; the promise he wants |
| 25 to 40 | Hollow Cairn disturbances | Cairn looted or insulted | Tools moved, milk soured | Losses | An offering; returning what was taken |
| 35 to 55 | Ulf's visit demanding a share | Household wealth over 40 oz or Oddi's debt | His sail two days before | 12 to 15 men | Pay, bargain, fight, or ally |
| 50 to 60 | Storm surge reaches the broch | Always | Spring tide forecast | Flooded stores if low | Raise stores; storehouse |
| 61 to 90 | Autumn storms (up to three) and fever | Always | Forecasts; coughs | Damage; sickness | Fuel, care, roofs |
| 70 to 85 | Asgrim's first visit | Always | Grey sails at anchor | 3 ships, demand only | Answer or delay |
| 86 to 94 | The Cailleach's washing | Always | Hag-cloud over the Cauldron | Severe storm | Ship in the boatshed; roofs |
| 91 | Samhain night | Always | The dead and hill-folk walk | Supernatural | Stay in, keep the fires, or bargain |
| 91 to 120 | Cold, hunger, long nights | Preparation | Morning report from day 70 | Deaths if unprepared | Winter stores |
| 100 to 115 | Desperate men in a calm window | `SEED_TAKEN` or Ardcarn hungry | A small boat seen at dusk | 4 to 6 | Watch, defend, feed them |
| 105 | Yule | Always | Feast | The draugr strongest if unresolved | Rites; the feast's morale |
| 118 to 120 | Asgrim returns for an answer | Always | Sails at Imbolc | Demand | Pay, refuse, deceive |

### Year 2 and the mainland
| Days | Threat | Condition | Warning | Scale | Counter |
|---|---|---|---|---|---|
| 121 to 150 | The coast's answer (Book 6 scenario 8) | Ledger | Precursors 5 days ahead; an attack on Skarvholm comes on its fixed night, after at least 7 days' warning (section 22) | Raid, arson, interdict or envoy | Settle or defend |
| 130 to 160 | Orm's scout ship probes | Always | A grey sail off Rook Hill | 1 ship | Hide strength or show it |
| About 140 | Storm-tide slumps Naust Cove | Always | Spring tide forecast | Landing lost | Move the boat; new slip |
| 150 to 180 | The spring fails at every spring tide; refugees | Always | Brackish water | Thirst, crowding | Haul water; shelter plans |
| 181 to 240 | Hostile guards on sight in wronged territory | Ledger | Region map shows hostile ground | Patrols of 3 to 6 | Avoid, sneak, settle |
| 181 to 240 | Wolves at night, worst in winter | Wilderness | Howls, tracks | Packs of 3 to 5 | Fires, fences, hunting |
| 181 to 240 | Outlaws on roads | Wilderness | Signs of a camp | 4 to 8 | Fight, pay, recruit |
| About 200 | Neighbours test the new home: cattle lifted | Always | Cattle restless at night | 6 to 10 | Watch, return in kind, negotiate |
| About 220 | Ulf's attack on the mainland home | Ulf hostile | His raven sail | 25 | Defences, allies |
| About 228 | Orm takes Skarvholm as a forward base | Always; outpost residents are taken captive | Smoke over the island, seen from the mainland | 2 ships, about 40 | Abandon, reinforce, or accept; rescue in the Return |
| 241 to 252 | The Return to Skarvholm (required) | Always | The Keepers' revelation and scouting reports | Garrison in section 07 | Book 6 scenario 9; section 13; checkpoint before landing; one retry before the household sets out for the final battle |
| 256 to 270 | Orm's fleet and the finale | Always | The washer at the ford | 6 to 10 ships; two fewer if the Naust ships were burned; typically 5 days earlier, with the pressure rising twice as fast, if the beacon was lit (still a gate, section 22) | Everything prepared |

## 12 / Guard rails
*Rules that must stay true whatever the numbers become.*

- A delegated, sensibly managed home survives a season without player input; the player's own work is always a bonus.
- Winter is survivable by a player who heeds the morning report from day 70.
- No approach to raiding dominates every measure; brutality pays quickly and costs later.
- Combat tells are always readable: at least 6 ticks between a tell and active frames.
- First departure within 45 to 60 minutes; combat inside 25.
- Supernatural events about one voyage in three or four; signs more often than encounters.
- No resource can go below zero, and every shortage is explained in words.

## 13 / The Return to Skarvholm
*Numbers for the late-game expedition (Book 6 scenario 9, Book 9 sections 08 and 09). It should be hostile and difficult.*

### Timers and rules
| Key | Value |
|---|---|
| ormTakesSkarvholm | Typically about day 228, after the move ashore (a gate) |
| returnWindow | Typically days 241 to 252; one retry before the household sets out for the final battle |
| hornToReinforcement | 360 s real after the horn |
| naustCrewsJoin | 120 s after the horn |
| beaconDelay | 60 s after the horn, if the cairn watch lives |
| patrolLoop | 240 s |
| falseHornDelay | 60 s (Thrand's signals) |
| surgeTidalGround | 180 s after the Cup is lifted |
| surgeSealCavePassage | 240 s |
| surgeCauseway | 300 s |
| surgeStrand | 480 s |
| liesToSeal | 3; the Door reopens at the next spring tide |
| wardenPerLie | One cairn warden per lie |
| retryGarrison | +50% fighters; dogs at the cell |
| holmgangaRule | Duel on the Skerry at low tide; three shields each; the loser's side yields the night |
| kolgrimFairDefeat | Garrison cohesion -30 for the night |
| firstAttemptTarget | Good-player autoplay recovers the Cup on the first attempt in no more than 60% of seeds |

### Late-game enemies
| Archetype | Vitality | Armour | Weapons | Behaviour |
|---|---|---|---|---|
| Kolgrím the Burner | 160 | Mail, helmet | Dane axe, torch | Aggressive; loves fire; accepts a public challenge |
| Garrison huscarl | 130 | Mail, helmet | Sword or spear and shield | Disciplined; holds the palisade |
| Gróa | 70 | None | Sea-light | Pulls targets within 6 tiles towards water at 1 tile per second; flees when hurt |
| Drowned digger | 90 | Resists stagger | Grip | Slow; banished by daylight or rites, not killed |
| Cairn warden | 200 | Cannot be killed | Blows that knock down | Driven back for 20 s by heavy blows; leaves when the truths are complete or the party leaves |

## 14 / The mainland: journeys
*Sites explored on foot, joined by road legs that pass off screen and by wilderness routes that must be crossed on foot (design addendum 2.3 section 3; Book 4 section 03, Book 9 section 10). Hours are game hours at 50 real seconds each.*

### Sites and routes
| ID | Place | Kind | Reached by ship |
|---|---|---|---|
| `MAIN_CARRICK_STRAND` | Carrick Strand | Site, home site A | Yes |
| `MAIN_CARRICK_LANDING` | Carrick Landing | Site | Yes |
| `MAIN_ARDCARN` | Ardcarn | Site | No |
| `MAIN_LOCH_CARN` | Loch Carn and Brigid's Well | Site | No |
| `MAIN_KILBRECC_FARMS` | The tenant farms | Site | No |
| `MAIN_KILBRECC` | Kilbrecc | Site | Yes |
| `MAIN_BLACKWOOD_EDGE` | The Black Wood path | Route | No |
| `MAIN_BLACKWOOD_HEART` | The Black Wood heart | Site, dungeon | No |
| `MAIN_MOIN_MHOR` | Móin Mhór: the turf village and bog edge | Site | No |
| `MAIN_PLANK_ROAD` | The plank road | Route | No |
| `MAIN_TRACKWAY` | The Drowned Trackway | Site, dungeon | No |
| `MAIN_SLIABH_CARN` | Sliabh Carn | Site | No |
| `MAIN_CAILLEACH_CAVE` | The Cailleach's Cave | Site, dungeon | No |
| `MAIN_HIGH_PASS` | The High Pass | Route | No |
| `MAIN_DUN_FIACH` | Dún Fiach | Site | Yes (its landing) |
| `MAIN_RIDGE_ROAD` | The Ridge Road | Route | No |
| `MAIN_FORD` | The river path and the Ford | Route | No |
| `MAIN_SALT_PANS` | Ottar's farms and salt pans | Site | Yes |
| `MAIN_SALTVIK` | Saltvik | Site | Yes |
| `MAIN_SALTNESS` | Saltness | Site, home site B | Yes |
| `MAIN_MOOR_ROAD` | The moor road | Route | No |
| `MAIN_MOUND_FIELD` | The Mound Field | Site, dungeon | No |

### Network
*A route's ends are nodes; a Route leg is crossed on foot along the route's direct path (exploring off it can double the time). A site off a route (the heart, the Trackway, the Mound Field) is reached partway along it.*

| From | To | Kind | Hours |
|---|---|---|---|
| Carrick Strand | Carrick Landing | Road | 0.5 |
| Carrick Landing | Ardcarn | Road | 0.5 |
| Ardcarn | Loch Carn | Road | 1 |
| Ardcarn | Kilbrecc farms | Road | 1 |
| Kilbrecc farms | Kilbrecc | Road | 0.5 |
| Ardcarn | The Black Wood path (south end) | Road | 2 |
| The Black Wood path (south end) | The Black Wood path (north end) | Route | 2.5 |
| The Black Wood path (south end) | The Black Wood heart | Route | 1.25 |
| The Black Wood path (north end) | The Black Wood heart | Route | 1.25 |
| The Black Wood path (north end) | Móin Mhór | Road | 1 |
| Móin Mhór | The plank road (west end) | Road | 0.5 |
| The plank road (west end) | The plank road (east end) | Route | 2 |
| The plank road (west end) | The Drowned Trackway | Route | 1 |
| The plank road (east end) | The Drowned Trackway | Route | 1 |
| The plank road (east end) | Sliabh Carn | Road | 0.5 |
| Sliabh Carn | The Cailleach's Cave | Road | 1 |
| Sliabh Carn | The High Pass (north end) | Road | 1 |
| The High Pass (north end) | The High Pass (south end) | Route | 2.5 |
| The High Pass (south end) | Dún Fiach | Road | 1 |
| Kilbrecc | The Ridge Road (west end) | Road | 1 |
| The Ridge Road (west end) | The Ridge Road (east end) | Route | 2 |
| The Ridge Road (west end) | The Ridge Road (south branch) | Route | 2 |
| The Ridge Road (east end) | The Ridge Road (south branch) | Route | 2 |
| The Ridge Road (east end) | Dún Fiach | Road | 0.5 |
| The Ridge Road (south branch) | The river path (north end) | Road | 1 |
| The river path (north end) | The river path (south end) | Route | 2 |
| The river path (south end) | Salt pans | Road | 1 |
| Salt pans | Saltvik | Road | 0.5 |
| Saltvik | Saltness | Road | 0.5 |
| Salt pans | The moor road (south end) | Road | 1 |
| The moor road (south end) | The moor road (north end) | Route | 2.5 |
| The moor road (south end) | The Mound Field | Route | 1.25 |
| The moor road (north end) | The Mound Field | Route | 1.25 |
| The moor road (north end) | Móin Mhór | Road | 1.5 |

### Journey modifiers
| Key | Value |
|---|---|
| night | Road legs x1.5 at night, and riskier |
| cargoOrCattle | x1.5 when driving cattle or carrying cargo |
| knownRoad | x0.8 on a road leg already travelled |
| kelpieBridle | Water crossings take half the time with the water-horse |
| blocks | A landslide, spate, snow or flood closes its leg until cleared, or forces the long way round |
| journeyEvent | 25% of road legs are interrupted by a short playable scene (travellers, bandits, wolves, weather, a wounded stranger, or a discovery that adds a point of interest) |
| dayPlan | A day (06:00 to 02:00, 20 game hours) fits one or two nearby sites; far sites need a camp on the way, or the ship |

### Route encounters
*Rolled per crossing (starting values, for tuning after playtests).*

| Key | Value |
|---|---|
| wanderers | 50% of crossings meet wandering people (travellers, pilgrims, pedlars, herders, charcoal burners, patrols, outlaws, a lost traveller, a fleeing thrall, a hunting party) |
| hostileDay | 20% of crossings by day meet a hostile encounter (bandits, outlaws, wolves, a boar, a hostile patrol) |
| hostileNight | 33% of crossings at night |
| winterWolves | Hostile chance x1.5 on the High Pass and the moor road in winter |
| hostileFaction | Hostile chance x2 on a route held by a faction hostile to the household |
| cargo | Hostile chance x1.5 when carrying cargo or driving cattle |
| cleared | Hostile chance x0.5 once the household has driven out the route's outlaws |
| waymarked | A waymarked route keeps a party on its path in fog and at night (no getting turned round); hostile chance x0.9 |
| ambushSign | Every ambush shows a sign (a fallen tree, crows rising, a stretch gone quiet, fresh tracks) at least 6 tiles ahead; a keen-eyed companion sees it 3 tiles sooner |

### Shortest journeys
*Computed from the Network by `src/sim/land/journeys.ts` (a test checks every row). Hours by land, the fastest chain of road legs and routes, without modifiers.*

| From | To | Hours |
|---|---|---|
| Carrick Strand | Carrick Landing | 0.5 |
| Carrick Strand | Ardcarn | 1 |
| Carrick Strand | Loch Carn | 2 |
| Carrick Strand | Kilbrecc farms | 2 |
| Carrick Strand | Kilbrecc | 2.5 |
| Carrick Strand | The Black Wood heart | 4.25 |
| Carrick Strand | Móin Mhór | 6.5 |
| Carrick Strand | The Drowned Trackway | 8 |
| Carrick Strand | Sliabh Carn | 9.5 |
| Carrick Strand | The Cailleach's Cave | 10.5 |
| Carrick Strand | Dún Fiach | 6 |
| Carrick Strand | Salt pans | 9.5 |
| Carrick Strand | Saltvik | 10 |
| Carrick Strand | Saltness | 10.5 |
| Carrick Strand | The Mound Field | 9.25 |
| Carrick Landing | Ardcarn | 0.5 |
| Carrick Landing | Loch Carn | 1.5 |
| Carrick Landing | Kilbrecc farms | 1.5 |
| Carrick Landing | Kilbrecc | 2 |
| Carrick Landing | The Black Wood heart | 3.75 |
| Carrick Landing | Móin Mhór | 6 |
| Carrick Landing | The Drowned Trackway | 7.5 |
| Carrick Landing | Sliabh Carn | 9 |
| Carrick Landing | The Cailleach's Cave | 10 |
| Carrick Landing | Dún Fiach | 5.5 |
| Carrick Landing | Salt pans | 9 |
| Carrick Landing | Saltvik | 9.5 |
| Carrick Landing | Saltness | 10 |
| Carrick Landing | The Mound Field | 8.75 |
| Ardcarn | Loch Carn | 1 |
| Ardcarn | Kilbrecc farms | 1 |
| Ardcarn | Kilbrecc | 1.5 |
| Ardcarn | The Black Wood heart | 3.25 |
| Ardcarn | Móin Mhór | 5.5 |
| Ardcarn | The Drowned Trackway | 7 |
| Ardcarn | Sliabh Carn | 8.5 |
| Ardcarn | The Cailleach's Cave | 9.5 |
| Ardcarn | Dún Fiach | 5 |
| Ardcarn | Salt pans | 8.5 |
| Ardcarn | Saltvik | 9 |
| Ardcarn | Saltness | 9.5 |
| Ardcarn | The Mound Field | 8.25 |
| Loch Carn | Kilbrecc farms | 2 |
| Loch Carn | Kilbrecc | 2.5 |
| Loch Carn | The Black Wood heart | 4.25 |
| Loch Carn | Móin Mhór | 6.5 |
| Loch Carn | The Drowned Trackway | 8 |
| Loch Carn | Sliabh Carn | 9.5 |
| Loch Carn | The Cailleach's Cave | 10.5 |
| Loch Carn | Dún Fiach | 6 |
| Loch Carn | Salt pans | 9.5 |
| Loch Carn | Saltvik | 10 |
| Loch Carn | Saltness | 10.5 |
| Loch Carn | The Mound Field | 9.25 |
| Kilbrecc farms | Kilbrecc | 0.5 |
| Kilbrecc farms | The Black Wood heart | 4.25 |
| Kilbrecc farms | Móin Mhór | 6.5 |
| Kilbrecc farms | The Drowned Trackway | 8 |
| Kilbrecc farms | Sliabh Carn | 8.5 |
| Kilbrecc farms | The Cailleach's Cave | 9.5 |
| Kilbrecc farms | Dún Fiach | 4 |
| Kilbrecc farms | Salt pans | 7.5 |
| Kilbrecc farms | Saltvik | 8 |
| Kilbrecc farms | Saltness | 8.5 |
| Kilbrecc farms | The Mound Field | 9.25 |
| Kilbrecc | The Black Wood heart | 4.75 |
| Kilbrecc | Móin Mhór | 7 |
| Kilbrecc | The Drowned Trackway | 8.5 |
| Kilbrecc | Sliabh Carn | 8 |
| Kilbrecc | The Cailleach's Cave | 9 |
| Kilbrecc | Dún Fiach | 3.5 |
| Kilbrecc | Salt pans | 7 |
| Kilbrecc | Saltvik | 7.5 |
| Kilbrecc | Saltness | 8 |
| Kilbrecc | The Mound Field | 9.25 |
| The Black Wood heart | Móin Mhór | 2.25 |
| The Black Wood heart | The Drowned Trackway | 3.75 |
| The Black Wood heart | Sliabh Carn | 5.25 |
| The Black Wood heart | The Cailleach's Cave | 6.25 |
| The Black Wood heart | Dún Fiach | 8.25 |
| The Black Wood heart | Salt pans | 7.25 |
| The Black Wood heart | Saltvik | 7.75 |
| The Black Wood heart | Saltness | 8.25 |
| The Black Wood heart | The Mound Field | 5 |
| Móin Mhór | The Drowned Trackway | 1.5 |
| Móin Mhór | Sliabh Carn | 3 |
| Móin Mhór | The Cailleach's Cave | 4 |
| Móin Mhór | Dún Fiach | 7.5 |
| Móin Mhór | Salt pans | 5 |
| Móin Mhór | Saltvik | 5.5 |
| Móin Mhór | Saltness | 6 |
| Móin Mhór | The Mound Field | 2.75 |
| The Drowned Trackway | Sliabh Carn | 1.5 |
| The Drowned Trackway | The Cailleach's Cave | 2.5 |
| The Drowned Trackway | Dún Fiach | 6 |
| The Drowned Trackway | Salt pans | 6.5 |
| The Drowned Trackway | Saltvik | 7 |
| The Drowned Trackway | Saltness | 7.5 |
| The Drowned Trackway | The Mound Field | 4.25 |
| Sliabh Carn | The Cailleach's Cave | 1 |
| Sliabh Carn | Dún Fiach | 4.5 |
| Sliabh Carn | Salt pans | 8 |
| Sliabh Carn | Saltvik | 8.5 |
| Sliabh Carn | Saltness | 9 |
| Sliabh Carn | The Mound Field | 5.75 |
| The Cailleach's Cave | Dún Fiach | 5.5 |
| The Cailleach's Cave | Salt pans | 9 |
| The Cailleach's Cave | Saltvik | 9.5 |
| The Cailleach's Cave | Saltness | 10 |
| The Cailleach's Cave | The Mound Field | 6.75 |
| Dún Fiach | Salt pans | 6.5 |
| Dún Fiach | Saltvik | 7 |
| Dún Fiach | Saltness | 7.5 |
| Dún Fiach | The Mound Field | 8.75 |
| Salt pans | Saltvik | 0.5 |
| Salt pans | Saltness | 1 |
| Salt pans | The Mound Field | 2.25 |
| Saltvik | Saltness | 0.5 |
| Saltvik | The Mound Field | 2.75 |
| Saltness | The Mound Field | 3.25 |

### Opening the map
| Key | Value |
|---|---|
| highPassClearing | A work party with axes and levers, 6 worker-days; or Fiachra's men after an alliance; or the Cailleach's maul |
| fordBridge | A homestead build at the ford: 8 timber, 6 worker-days; ends the spate closure for everyone |
| fordSpate | Spring days 1 to 20, and 2 days after each autumn storm |
| coldSnap | 15% a winter day, lasting 2 to 4 days; freezes the bog |

## 15 / Wilderness, hazards and camping
### Hazards
| Hazard | Sign | Numbers |
|---|---|---|
| Bog hole | Bright moss, bubbles | Speed x0.3; sinks after 8 s unless pulled out by a companion or a rope; 4 s to free |
| Spate river | Brown water, a roar | Swept downstream 2 tiles per second; 10 vitality every 4 s; swim drain x1.5 |
| Cliff and scree | Loose stones | A fall of more than 2 tiles costs 10 vitality per tile beyond 2; scree slides 1.5 tiles per second |
| Cold at night | Breath shows; shivering | Cold (stamina max -20) after 1 game hour outdoors without a fire on autumn and winter nights; 2 vitality a game hour after 3 hours in winter |
| Fog | Muffled sound | Sight 4 tiles; 30% a game hour of being turned round off a road without a guide |
| Wolves | Howls, tracks | Packs of 3 to 5 at night; by day too in winter |
| Boar | Rooted ground | 1 or 2; charge at 6 tiles per second |
| Outlaws | Signs of a camp | Ambushes of 4 to 8; roadblock toll 2 oz |
| Landslide | Cracks, trickling stones | 10% on a rainy day on scree routes; blocks the route for 3 days |
| Lightning | Thunder, hair on end | High ground in a storm: a strike within 6 tiles every 60 s; 40 vitality |
| The hill-folk's rules | Offerings, rings of stones | Breaking one: ill luck for 3 days (tasks -20%) |

### Camping
| Key | Value |
|---|---|
| needs | A bedroll and a fire, on ground that is not hostile |
| ends | The day; sleep until 06:00 |
| heals | One day's recovery for wounds; counts as a full rest at a good camp (section 06) |
| saves | When no enemy is aware and the ground is not hostile |
| nightRisk | A night event: 5% on a road, 15% in the wilderness, 25% deep in the wilderness; x1.5 in winter |
| riskReduction | A good fire x0.67, a companion on watch x0.67, a sheltered spot x0.75 (multiplied) |
| companionsOnFoot | Up to 2 friendly characters |
| waystation | A safe camp with a small store at one camp spot per route: 6 timber, 2 stone, 4 worker-days; stores 10 lots; night risk x0.25 |

## 16 / Dungeons and equipment
| Reward | Dungeon | Effect | Cost |
|---|---|---|---|
| Ceo, the mist-spear | Black Wood souterrain | In fog and at night, thrusts pass through shields; otherwise a spear | Each Samhain the hill-folk call for a service; Christian residents' happiness -5 while it is kept at home |
| Barrow mail | The Barrow-King's mound | -40% cut, -25% thrust and missiles; immune to stagger | 20% a night of a draugr drawn near the steerer; Ottar's family claim it (Saltvik friendship -20 if worn there) |
| The bog torc | The Drowned Trackway | The dead cannot see the steerer beyond 2 tiles; flooded bog walked at walking speed | Fires warm half as fast; 10% a cold night of cold sickness |
| A Frankish sword | Outlaws' hill-fort | Sword damage x1.25 and recovery 4 ticks shorter | Worn at Dún Fiach it is an accusation: Dún Fiach hostile until settled |
| The Cailleach's maul | The Cailleach's Cave | The heavy attack shatters shields; water it strikes freezes (an ice bridge for 120 s; bog frozen for 10 tiles round) | Works only in autumn and winter; used in summer, a storm within 3 days |
| The kelpie bridle | Loch Carn (quest) | Summons the water-horse to cross lochs, bogs and rivers at 7 tiles per second | Kept near water at night: 25% a night that the horse drowns its rider unless the steerer refuses it |

The four small dungeons behind the routes' secret entrances, and their rewards, are in section 20 ("Secret entrances").

## 17 / The living world
### Density and travellers
| Key | Value |
|---|---|
| roadEventInterval | A traveller or living event about every 60 s on a road or in a settlement |
| wildEventInterval | A creature, sign or event every 30 to 60 s in the wilderness |
| offScreenTick | Places and travellers off screen are simulated once a game hour |
| newsSpeed | News moves with its carrier, at walking speed between areas |
| travellerKinds | Pilgrims, monks, herders driving cattle, Fiachra's riders, a travelling poet, traders' carts, tinkers, fugitives, refugees |

### Visiting traders
| Trader | When | Brings |
|---|---|---|
| Saltvik knarr | About every 10 days in the sailing season | Iron, salt, cloth and arrows by the dozen; buys hides, wool and fish; leads |
| Gaelic pedlar | Every 6 days once the household is on the mainland | Needles, dyes, small goods and news |
| Wandering smith | Once a season | Repairs, a weapon to order and iron arrowheads |
| The sea-wife | 10% a calm day | Odd goods and a lead |
| Ulf's men | Every 15 days while stolen goods are held | Buy marked goods at 60% of value |

### Bandits
| Key | Value |
|---|---|
| campForms | When an area has gone unchecked for 20 days |
| ambush | 10% a day of road travel near a camp |
| farmRaids | After 10 more days unchecked |
| breaksUp | When its leader is killed or bought off, or after 40 days |

### Delayed consequences
| Key | Value |
|---|---|
| delay | 10 to 40 days after the deed, drawn per consequence from the campaign seed |
| forgotten | At least one in three delayed consequences comes from a person the household met only once |
| warning | A precursor 3 days before, when the steerer would know it (Book 1 section 06, Fairness) |

### Event deck
| Key | Value |
|---|---|
| size | About 40 events |
| interval | One every 5 to 10 days |
| repeats | Never: each fires at most once per campaign |
| never | During a tutorial, or two at once |

## 18 / Raid assaults
| Key | Value |
|---|---|
| battleSize | 10 to 30 a side |
| earlyAssault | Carrick in Chapter 2: the household's 5 or 6 against 4 defenders mustering to 10; later assaults on Carrick are sized as battleSize |
| muster | Defenders at the landing; +25% at 60 s (horns); archers at 90 s; +50% at 180 s (reinforcements) |
| shieldWall | Needs 4 or more; front arc 120 degrees; missiles -80% in the arc; moves at 0.5 tiles per second |
| charge | Cohesion -25 to the line it hits; 10 s before the next charge |
| hold | Defence +20%; no movement |
| volley | Archers loose together every 6 s |
| fallBack | The crew withdraws to the ships; pursuers at 0.8 speed |
| witnesses | Every survivor of an assault is a witness; retaliation comes 50% sooner |
| glory | Glory deeds count x1.5 in an assault |

## 19 / The homestead away
| Key | Value |
|---|---|
| awayEfficiency | 75% of the work done with the steerer home |
| stewardEfficiency | 90% with a steward of skill 3 or more |
| threats | Met by the watch, resolved with the residents' combat skills |
| report | Up to 12 queued events, most important first |
| neverStarves | The home never starves while food exists |
| wearAway | Buildings and the ship wear 1.5 times as fast while untended |
| disputesAway | Unjudged disputes escalate after 3 days |

## 20 / Exploration density
| Key | Value |
|---|---|
| stopInterval | Something worth stopping for every 20 to 30 s of walking |
| secrets | At least one real secret or small puzzle in every area |
| pointsOfInterest | One or two major points of interest per site, one per route; 4 to 8 minor ones per site or route, the best off the beaten track |
| wildernessArea | At least one secret, one resource worth the trip, one story and one danger |
| change | Every area changes with season and tide |
| objective | The current goal is always shown |

### Secret entrances
*Four wilderness routes hide a secret entrance to a small dungeon (decision DD-10; Book 4 section 03, Book 6 section 13, Book 9 section 14). Starting values, for tuning after playtests.*

| Entrance | Route | Hints | Reward and effect |
|---|---|---|---|
| The fallen-oak souterrain | The Black Wood path | A cross cut in a holly; a draught and mist at the roots; a dressed lintel for a keen-eyed companion; rumours | A boar-spear: a spear (section 06) whose point holds a charging boar, wolf or person at 1.7 tiles, stopping the charge, with thrust damage x1.5 against a charger; windup +4 ticks and combo 1. Lore: one answer for the riddling doors in the heart |
| The cave behind the falls | The High Pass | Dippers into the falls; the watchmen's chevron on the tower lintel and by the pool; a dark hollow behind the winter ice; rumours | A wolfskin cloak: the Cold reduction of the stamina bar is halved (-10 instead of -20, section 15); dogs notice the wearer at 1.5 times their range; Fiachra's riders are wary of a wearer they do not know. Lore: the brooch of Dún Fiach on the outlaws' leader |
| The heather barrow | The moor road | Spirals on a kerbstone; wheatears in the kerb; a draught at the gap; rumours | An iron helmet (section 06, `helmet`). Taken without leaving a weapon or 1 oz of silver in its place: `SACRED_TAKEN`, and 20% a night of the barrow-dead coming to a camp on the moor road until it is returned. Lore: what the Door of Three Truths asks |
| The otter-cave behind the weir | The river path and the Ford | Otters behind the weir; a ship cut in an alder; Cuán's story; rumours | A rune-cut yew bow: reach x1.25, damage x1.2, a 36-tick draw and stamina 14 (against the bow's 30 and 10, section 06); with 8 iron-headed arrows. Seen at Saltvik, its owner's kin claim it: returned, Saltvik regard +10; kept, Saltvik regard -10. Lore: the signs of a coming spate, which warn of the Ford's closing a day early |

| Key | Value |
|---|---|
| routesWithEntrances | 4 of the 6 routes: the Black Wood path, the High Pass, the river path and the moor road |
| rumoursPerEntrance | 3 in the line pools of travellers and minor characters |
| rumourWrong | 1 in 3: one of each entrance's three rumours is deliberately wrong, pointing to a harmless place |
| hintSeenFrom | Every hint sign is in view from a path on the approach |
| draughtShows | Within 3 tiles of the crack: stirring litter at any time; a breath of mist before 09:00 in autumn, winter and spring |
| keenEyedNotice | A keen-eyed companion within 4 tiles remarks on the entrance (section 08, Traits) |
| iceCurtain | The cave behind the falls in winter: 6 axe blows (90 game minutes, noise 10 tiles) or one blow of the Cailleach's maul |
| weirClosed | The otter-cave is closed while the Ford is in spate (section 14) |

## 21 / Controls and camera
*Mouse-first controls in the style of a farming RPG, with keyboard-only and gamepad play kept whole (Book 2 section 21; Book 7 section 14, Camera feel). The logical viewport, tiles and sight ranges are unchanged.*

| Key | Value |
|---|---|
| hotbarSlots | 12 |
| hotbarKeys | 1 to 9, 0, minus and equals; or the mouse wheel |
| toolReach | 1.5 tiles: the steerer's tile and the eight around it |
| interactReach | 2 tiles |
| castReach | 5 tiles (casting a line, throwing an item) |
| meleeAim | The combat stance faces the cursor or the locked target, and is drawn in the nearest of the four facings (section 06, "Stance and lock-on") |
| missileAim | Free aim at the cursor with an aim line while drawing a bow or holding a thrown spear |
| keyboardTarget | The tile in front of the steerer's facing |
| gamepadDeadZone | 0.2 of the right stick's travel |
| gamepadCursor | The right stick sets the target tile within reach in its direction; while aiming, it aims freely |
| lookAheadScale | 0.35 x the cursor's distance from the steerer |
| lookAheadMax | 3 tiles |
| lookAheadAiming | 5 tiles while aiming a bow or thrown spear |
| lookAheadDeadZone | 0.5 tiles: no look-ahead while the cursor is this close |
| cameraHalfLife | 0.18 s, critically damped, in sub-pixel space; the spring moves the camera's point in the world, not its offset from the steerer, so a turn or a stop eases out and back in rather than jerking (decision PT-0) |
| keyboardLeadHalfLife | 0.3 s: without a pointer, the lead in the direction of travel swings round and fades out over this half-life when the steerer turns or stops (decision PT-0) |
| cameraSnap | The drawn offset is whole logical pixels, changed only when the smoothed offset moves 0.5 px past it (hysteresis), so it never flickers between two pixels |

### Starting weapons
*The steerer wakes with nothing in hand (decision DD-6). Unarmed, they can only shove and dodge. Since design addendum 2.4 the seax is found on the way to Hild, and the bow is the reward of the Bran search, from Thorkel's locked chest (decisions DE-17 and DE-18).*

| Key | Value |
|---|---|
| startingHotbar | Empty |
| seaxFoundBy | 5 minutes of play: a seax glinting in the wreckage on the obvious path between the waking place and Hild, found before she is cut free (typically within 1.5 minutes, section 25) |
| bowFoundBy | 30 minutes of play: a hunting bow and a quiver with the starting arrows in Thorkel's locked chest at the camp, opened with the key from his body (the Bran search); typically 20 to 30 minutes in |
| startingArrows | 6 |
| pickupTooltip | Shown once per item kind when first picked up, naming its controls for the current input (mouse and keyboard, keyboard only, or gamepad); kept afterwards in the help pages |

### Missiles
*Bows and thrown spears are loosed standing still, by everyone: the steerer, crew and enemies (decision DD-7). Every shot is a visible projectile with travel time, a slight arc and a shadow; it can miss, is stopped by shields and cover, and sticks in what it hits (decision DD-9).*

| Key | Value |
|---|---|
| drawPlantsFeet | While a bow is drawn or a spear is held to throw, movement input is ignored; the steerer turns to the cursor and can only loose or cancel (right-click, Escape or pad B) |
| npcArcher | Stops, draws (the Book 10 section 06 draw time), looses, then moves; never moves with a drawn bow |
| minDraw | 12 ticks: released sooner, the draw is cancelled and no arrow is spent |
| arrowSpeed | 16 tiles per second |
| spearSpeed | 11 tiles per second |
| arcApex | 0.35 tiles of height at the weapon's full range (the Book 10 section 06 reach), in proportion for shorter shots; the shot lands where it was aimed, or flies on to its full range and falls |
| spreadFullDraw | 2 degrees either side for a bow at full draw (30 ticks); 3 for a thrown spear |
| spreadQuickDraw | 9 degrees either side at the minimum draw, narrowing evenly to the full-draw spread |
| shieldBlock | A shield held up (blocking, or a shield wall) stops a missile from the front 120 degrees; the missile sticks in the shield |
| coverBlock | Solid cover stops a missile below its height: rock, walls, the wreck's hull, standing stones and buildings stop every missile; low walls and stakes stop it only at the start and end of its arc (below 0.25 tiles of height) |
| stuckArrows | Stay where they stuck: in the ground for 1 game day, in props and bodies until the zone is left; at most 40 in a zone (the oldest goes first) |
| shadow | A soft 3 x 1 shadow on the ground under the missile, offset from it by its height |
| sweptHits | Every tick a missile checks the whole path it travelled against every body, shield and piece of cover, so a fast missile never passes through anyone; it hits whatever it touches first, before, during and after a fight (decision DE-10) |
| awareDodge | Aware fighters sometimes sidestep a missile (section 07, Self-preservation); the unaware cannot, and take x2 (section 07, Sneak attacks) |

### Arrows
*Arrows are an item with a count, separate from the bow (decision DD-8). No arrows, no shot.*

| Key | Value |
|---|---|
| quiverMax | 30 |
| recoverGround | 60% recoverable from sand, turf and earth; 40% break |
| recoverStone | 20% recoverable from rock and walls; 80% break |
| recoverBody | 50% recoverable from a person or animal hit (after the fight); 50% break |
| recoverShield | 40% recoverable from a shield; 60% break |
| recoverWater | 0%: an arrow into water is lost |
| fletching | 1 driftwood or timber shaft-blank, 2 feathers and 1 head (bone or iron) make 4 arrows in 0.5 game hours, fletching skill 1 or more |
| headDamage | Bone heads: damage x0.85 and vs shield x0.7; iron heads: as the bow in section 06 |
| finds | 1 to 4 arrows in a cache, a dead archer's quiver or a hunter's camp; traders sell them by the dozen (section 04) |

### On-screen text
*Much less text, and never stacked over the action (design addendum 2.5 section 2; decisions DF-11 to DF-13). Book 2 section 18 holds the rules and Book 8 section 10 the audit of every message. These timings replace `captionSeconds` in `content/audio.json` when built.*

| Key | Value | Notes |
|---|---|---|
| captionLines | 1 information line and 1 speech line at most | Information above speech, as before |
| captionReplace | A new line replaces the line of its kind at once, cross-fading over 0.15 real seconds | Lines never stack or queue, except the one line held in a fight (heldAfterFight) |
| captionRepeat | The same information line is not shown again within 20 real seconds | Speech repeats follow Book 8's bark rules (no identical bark from one speaker within ten minutes) |
| infoHold | 2.5 real seconds, then a 0.4 s fade | |
| speechHold | 1.0 real second + 0.05 s a character, from 2 to 5 real seconds, then a 0.4 s fade | Lines in the talk panel stay until the next |
| captionFadeIn | 0.15 real seconds | |
| captionPlace | Bottom centre, within the lowest 16% of the view, above the hotbar | Clear of the steerer, who is drawn near the middle of the view |
| inFight | Any hostile alert to the steerer within 12 tiles, or a blow struck or taken by the steerer in the last 4 real seconds | While so, only speech barks and safety lines show (Book 8 section 10) |
| heldAfterFight | One waiting information line is kept, the newest of the most important; it shows 1 real second after the fight ends if it is under 8 s old, else it is dropped | |
| infoPriority | Safety, then a call's direction, then story information, then a sound | When two information lines arrive together, the higher shows |
| promptFade | 0.5 real seconds | Tutorial prompts and pickup tooltips fade out, never blink off |
| promptQuiet | Tutorial prompts and pickup tooltips hide while a speech line, a story beat, a scene or a talk is showing, and come back 2 real seconds after it, unless done | They never share the screen with a narrative line |
| promptDone | A tutorial prompt goes for good once its action is done | Moving: 2 tiles walked. Use: the item used once. Its fade is promptFade |
| tipHold | A pickup tooltip shows for 8 real seconds of play, or until its controls have been used twice, then fades | Kept in the help pages (Book 2 section 21) |
| refusalHold | A refusal word beside the cursor shows for 1.2 real seconds | One at a time; a new one replaces it |

## 22 / Story gates
*The story moves only through major events the player chooses to start; the calendar keeps running (design addendum 2.3 section 4; Book 4 section 08). Typical days are a guide for a well-paced player, never a deadline. The one exception is the defence of Skarvholm, which comes on a fixed night (decision DD-3).*

### Gates
| Gate | Typical day | Readiness screen shows |
|---|---|---|
| The launch (end of Chapter 1) | 6 | The boat's repairs, crew, stores |
| The Carrick raid | 12 to 15 | Crew, ship, plan, equipment |
| The reply to Asgrim | 118 to 120 | Silver, allies, the household's answer |
| The defence of Skarvholm (fixed night: the one gate that does not wait) | 135 (see defenceNight) | Watch, walls, weapons, warning |
| The household council | About 180 | Stores, the island's state, the two sites |
| The move ashore | 181 to 210 | Ships, cargo, the site secured |
| The Gathering | 211 to 240 | Allies, demands, offers |
| The Return to Skarvholm | 241 to 252 | Crew, equipment, keys, the checkpoint |
| The final battle | 256 to 270 | Allies, ships, the Cup |

### Gate rules
| Key | Value |
|---|---|
| waiting | A dated story event waits at its gate; the calendar, seasons, crops and winter go on |
| pressure | While a gate waits past its typical day: a demand grows 10% every 10 days, and one rumour spreads every 5 days; pressure never starts a gate |
| warning | Every readiness screen says plainly that the gate is a point of no return |
| fixedDate | The defence of Skarvholm only, when the coast's answer is an attack: it comes on its night whatever the player does, and has no pressure because it never waits |
| defenceNight | Day 135; if the reply to Asgrim is given after day 125, 10 days after the reply |
| warningDays | 7: omens, scouts and Thrand (if he is with the household) warn at least 7 days before the night |
| heldHome | From the warning, the travel map and the sea map refuse any journey or voyage whose return would come after dusk on the night, and say why |
| broughtHome | A steerer away when the warning comes gets word and is home by dusk on the day of the night; the journey or voyage is cut short |
| readinessOpens | At dusk on the night; the attack comes at nightfall |
| beaconEarlier | The beacon lit in the Return brings the final battle's typical day 5 days earlier (it is still a gate) |
| beaconPressure | With the beacon lit, the final battle's pressure steps come twice as often (a demand grows 10% every 5 days; a rumour every 2.5 days) |

### The launch
*Added for Stage 12 (decisions S12-3 to S12-9): Chapter 1's gate. The boat lies drawn up on Wreck Strand; it is run down its skids into the water by the whole household and floats off only when the tide gives it water enough. Starting values, for tuning after the playtest.*

| Key | Value | Notes |
|---|---|---|
| floats | Knee | The boat floats off where the water at its keel, from stern to stem, is at least knee deep (section 02, Water depth bands); shallower, it grounds |
| skids | 8 tiles | How far down the shingle the household can run the boat on its skids; if it would still not float there, the tide is out and the launch waits for it |
| slideSpeed | 1.8 tiles a second | The household running the boat down its skids, at the carrying pace (section 02, Movement on foot) |
| rowSpeed | 1.2 tiles a second | Out from the strand under oars with the sail set: the coastal boat's oars (section 05) at a launching crew's first stroke |
| rowOut | 9 tiles | How far the boat goes out from the strand before the sea map opens |
| trialRow | 60 game minutes | Rowed round the skerry and back, then drawn up again above the tide: the time the launch takes from the day |
| tideLookahead | 24 game hours | How far ahead the readiness screen looks for water enough to float the boat off |
| storesShort | 3 days | Fewer days of food in store than this reads short on the readiness screen |

## 23 / Conversation depth
*The minimum for each major character (leaders, antagonists, residents, quest characters), checked by content lint (design addendum 2.3 section 2; Book 8).*

| Key | Value |
|---|---|
| greetings | One for each season and time of day (morning, day, evening, night): 16, plus feast days |
| topicTrees | At least 3 |
| deedReactions | At least 10 deed types |
| callbacks | At least 5 remembered events |
| voiceThresholds | Voice changes at friendship 40 and -40 and at fear 60 |
| minorLines | Minor characters: pools of 1 or 2 lines, by culture, season, time of day, weather and the household's deeds |

## 24 / Heavy build
*Some residents and enemies, never the steerer (design addendum 2.3 section 11; Book 7). Starting values, for tuning after playtests. Their poise is section 06's "Poise" (poiseHeavy 60), so light attacks rarely stagger a heavy fighter.*

| Key | Value |
|---|---|
| windup | +4 ticks on every attack |
| damage | x1.2 |
| runSpeed | x0.9 |
| carrySpeed | x1.15 carrying loads and downed allies |
| runStamina | Running drains x1.25 |
| share | About one in six generated people |


## 25 / The opening, guidance and feel
*Design addendum 2.4 sections 2 to 6 (decisions DE-16 to DE-30): the first minutes of Chapter 1, help for a stuck player, the world's feedback, doors, the Hag's Stone and the music's fades; and design addendum 2.5 section 3 (decisions DF-15 to DF-17): the storm of the cold open. Starting values, for tuning after playtests.*

### The first minutes
*Targets for a scripted new player, measured by the chapter's telemetry (decision S12-12): a chain of small wins, each with a payoff (design addendum 2.4 section 6).*

| Key | Value | Notes |
|---|---|---|
| coldOpen | 30 to 45 real seconds | Night and storm, the steerer at the steering oar as the boat breaks: played, with control within 5 s of the naming screen; then black, then waking in the shallows at dawn |
| firstInput | Within 10 real seconds of waking | Waking coughing in the surf; the first input gets the steerer up |
| hildCallBy | 15 real seconds after waking | Hild's first call from the net, with its direction caption |
| seaxBy | 1.5 minutes | The seax in the wreckage on the way to Hild (section 21, seaxFoundBy is the limit) |
| hildFreedBy | 2.5 minutes | Cut free and carried above the tide line |
| chestAtCampBy | 4 minutes | Thorkel's chest set down at its outline |
| firstFireBy | 5 minutes | Two pieces of driftwood fetched and the fire lit (section 03, fireLight) |
| shelterBy | 6 minutes | Hild walks up, and the sail shelter is raised (section 03, shelterRaise) |
| firstFight | The first dusk, about 12 minutes in | The scavengers at dusk (section 07); within Book 1's 25 minutes |
| hagLight | The first dusk | A pale light at the Hag's Seat, seen from the camp and the strand |
| bowBy | 20 to 30 minutes | Thorkel's chest opened (section 21, bowFoundBy is the limit) |
| cutHold | 1.5 real seconds | Holding use with a blade at the net (or a lashing): fibres fly as it goes; letting go keeps what is cut |
| netWaves | A wave breaks over Hild every 8 real seconds while she is in the net | Spray and a caption; it never harms her |
| hildWalksUp | When the first fire is lit | Hild sees the smoke and limps up from the strand at the limp speed (section 08); on arriving she gives the shelter aim |
| noMenus | 10 minutes | No menu and nothing longer than a tooltip to read in the first ten minutes of play |

### Guidance
*Aims come from people, not markers (design addendum 2.4 section 3; decisions DE-23 and DE-24). The lines are Book 8's (section 13, "Chapter 1 aims").*

| Key | Value | Notes |
|---|---|---|
| stuckFirst | 90 real seconds | With no progress on the current aim, a nearby person offers the aim's first hint in speech |
| stuckSecond | 90 real seconds more | The aim's second, clearer hint |
| stuckRepeat | Every 120 real seconds after that, at most 3 times | The second hint again, from whoever is nearest |
| hintNear | Within barkEarshot (section 08) | With no one that near, the hint comes as a distant call from the speaker, with an information caption naming the caller and the direction, if the speaker is in the steerer's zone or the next; otherwise it waits |
| callCarry | 24 tiles | How far a call is heard, and captioned with its direction |
| progress | A step towards the aim | Its object picked up, carried nearer or worked, or one of its places reached; walking about alone is not progress, and progress restarts the count |
| quiet | No hint in a fight, a scene, a conversation or a menu, or while a hostile is suspicious | |
| journal | The current aim, always, as one plain sentence | In the journal (Book 8 section 13); no quest markers on screen |

### World feedback
*Design addendum 2.4 section 4 (decisions DE-17 and DE-25).*

| Key | Value | Notes |
|---|---|---|
| edgeStopAngle | 45 degrees: pressing more than this into an edge or impassable ground stops the steerer at it | Pressing along it at a shallower angle moves along it at that angle's share of the speed, so a walk beside a shore is not caught; there is no sliding along an invisible wall |
| edgeCaptionAfter | 0.3 real seconds of pressing against it | Then its information caption: "Nothing that way", "The water's too deep" or "Too steep to climb" |
| edgeCaptionCooldown | 4 real seconds | At most one edge caption in this time |
| homeOutline | 10 tiles | A carried thing with a home at the camp shows a faint outline at its home while it is carried within this distance; set down within 1 tile of the outline, it settles into place there |

### Doors
*Every door and hide flap opens visibly (design addendum 2.4 section 4; decision DE-26). Book 2 section 10 holds the data; Book 9 lists the doors.*

| Key | Value | Notes |
|---|---|---|
| openTicks | 12 ticks (a hide or cloth flap 8) | Swinging open, with its sound |
| closeAfter | 2 real seconds after the doorway is clear | |
| closeTicks | 12 ticks (a flap 8) | |
| opensOn | Walking into it, interacting with it, or a click on it | Anyone walking through opens it: residents and enemies too |
| blocks | A closed door blocks movement, sight and missiles; an open one blocks nothing | |
| barred | A barred door opens only from the side its bar is on | Barring comes with the defences (Stage 19) |

### The weeping stone
*The Hag's Stone, the Cailleach's stone at the Hag's Seat: its effect, stronger and never explained (design addendum 2.4 section 4; Book 4 section 07; decision DE-28). The phases run in this order; the whole lasts 6 to 10 seconds.*

| Key | Value | Notes |
|---|---|---|
| near | 6 tiles | The effect plays the first time the steerer comes this near the stone while it weeps, and again as an offering is laid; at most once a visit to the headland |
| hush | 1 real second | The wind drops to silence and the birds go quiet |
| cold | 1.5 real seconds | The light shifts to a cold blue-green and the carved marks glow faintly |
| hold | 2.5 to 6.5 real seconds | Mist curls round the stone; a low drone and a whisper rise; the camera eases towards the stone; the hold's length is set by content for each showing (4 by default) |
| gust | 0.5 real seconds | A sudden gust, and everything returns |
| settle | 0.5 real seconds | The wind and the birds back as they were |
| cameraPull | 0.4 of the way to the stone, at most 2 tiles | Eased in over the cold phase and out over the gust |
| figure | Every second showing | A still figure stands at the edge of the view for 2 s, and is gone if the camera turns towards it |
| never | In a fight, or with a hostile aware | The effect waits, and no line ever explains it |

### Music fades
*Music arrives gently and leaves gently (design addendum 2.4 section 5; Book 11 section 03; decision DE-29).*

| Key | Value | Notes |
|---|---|---|
| fadeIn | 8 real seconds (6 to 10 by piece) | From silence, on a bar line |
| firstLayer | One layer | A piece begins with a single layer: a drone or one instrument |
| layersJoin | Over the first 20 to 30 real seconds | The other layers join one at a time, each on a bar line |
| fadeOut | 6 real seconds (4 to 8 by piece) | Whenever music stops |
| crossFade | The outgoing piece's fadeOut | A change between pieces cross-fades; the new one still starts with one layer |
| stingers | No fade | Stingers alone start and stop sharply |

### The storm
*The cold open made rough and alive (design addendum 2.5 section 3; decisions DF-15 to DF-17): a hidden cursor, lightning with thunder after, rolling fog and mist, light that varies, a camera that sways with the sea, foam, breaking waves, spray, and the ship pitching and rolling. Book 7 section 05 draws it and Book 11 section 07 sounds it. The cold open stays 30 to 45 seconds (coldOpen). Random choices use the presentation's own seeded stream, never the simulation's.*

| Key | Value | Notes |
|---|---|---|
| cursorHidden | The mouse cursor is hidden through the cold open, the black and the waking until the first input, and in every scene that takes control (the first night's fire, the rites, the launch) | Shown again on the first mouse movement once control returns, or when a pointer use is offered. The cold open is steered with the movement keys |
| lightningEvery | 6 to 14 real seconds between strikes | One scripted strike shows the skerry ahead about 25 s in, before the hull strikes |
| lightningFlash | Bright for 4 ticks, dim for 3, bright for 3, then fading over 0.4 real seconds | At most two flashes in any one second. The bright frames light the ship, the sea and the land to 70% of the day grade, with hard shadows thrown away from the strike |
| lightningReduced | With reduced flashes: one soft swell of light, 0.3 s up and 0.6 s down, at half strength | No flicker |
| thunderAfter | 0.6 to 3.0 real seconds after the flash, by the strike's distance | A near strike is sooner and louder; the roll lasts 2.5 to 4 real seconds |
| fog | Two layers of mist over the water, drifting downwind at 0.3 and 0.6 tiles a second | 20 to 45% cover in ordered dither, thickest low over the swells, torn open by gusts; it never hides the steerer or the steering oar |
| lightVaries | The night grade varies by 12% either way in drifting patches about 8 tiles across, moving with the wind at 1.5 tiles a second | Never a flat, uniform blue; the stern lantern's pool of 3 tiles swings with the ship |
| cameraSway | 3 px up and down over the pitch's period and 2 px side to side over the roll's | Whole pixels, eased; none with reduced motion. The strike on the skerry at the end keeps its own shake |
| pitch | The bow rises and falls up to 4 px, over 3.2 real seconds | The people on deck move with it and brace |
| roll | The hull drawn in three roll frames (to port, level, to starboard) over 5.4 real seconds | The mast's head sways 2 px with it |
| swells | Crests 3 to 4 tiles apart, rolling across at 1.2 tiles a second, with foam streaks animated along them | |
| breakingWaves | A wave breaks against the hull every 3 to 6 real seconds | A burst of 10 to 18 spray particles reaching 20 to 40 px up, falling back across the deck |
| greenWater | Green water comes over the side every 8 to 12 real seconds | As before (Book 7 section 05) |
| rain | 80 to 120 drops on screen, slanting 25 degrees downwind | |
| firstRain | A shower over the island from 20:00 on day 1 to 04:00 on day 2, once the sail is raised | Before weather comes (DF-21): presentation only, so the simulation's rain (sight and noise, section 07) is not yet applied. A light overlay of 40 to 60 drops, slanting 25 degrees, that never hides a threat (Book 7 section 08) |
| rainCloth | Drops bead on the sail cloth, up to 24 beads at once, each growing over 1.5 to 3 real seconds and then running down the cloth | Its patter and the drips from the edge are heard only under the sail (Book 11 section 07, rain on the sail cloth; decision DE-27) |
