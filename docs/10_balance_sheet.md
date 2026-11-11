# Oar and Ember, Book 10: Balance Sheet

*Every tuning number in one place: time, food, fuel, cargo, ships, combat, stamina, perception, people, buildings, the ideal progression, the homestead threat schedule, the mainland, the wilderness, dungeons, the living world, assaults, the home without the steerer and exploration density.*

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
| Sneak | 1.75 | Noise x0.25 |
| Walk | 2.0 | Default (2.0 since the art-direction pass: 3.5 read as running on 32 x 40 people) |
| Run | 6.0 | The sprint; drains stamina (section 06, Stamina in traversal) |
| Carry | 1.8 | Lot or person; attacks disabled |
| Charge (heavy) | 1.5 | While holding a heavy |
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

## 06 / Combat timings
### Weapons (ticks at 60 Hz)
| Weapon | Reach tiles | Combo | Windup | Active | Recovery | Chain window | Damage | vs shield | Stamina |
|---|---|---|---|---|---|---|---|---|---|
| Spear | 1.7 | 2 | 14 | 6 | 16 | 10 | 22 | 8 | 14 |
| Axe | 1.1 | 3 | 16 | 6 | 20 | 10 | 26 | 22 | 18 |
| Sword | 1.25 | 3 | 11 | 5 | 13 | 9 | 22 | 10 | 12 |
| Seax | 0.75 | 3 | 8 | 4 | 9 | 8 | 14 | 4 | 8 |
| Dane axe | 1.4 | 2 | 24 | 7 | 26 | 12 | 40 | 35 | 26 |
| Bow | 8.3 | 1 | 30 draw | - | 20 | - | 18 | 6 | 10 |
| Thrown spear | 5 | 1 | 18 | - | 22 | - | 24 | 12 | 16 |

### Charged heavy
| Key | Value |
|---|---|
| level1At | 18 ticks held: damage x1.5, vs shield x1.5, tell: glint |
| level2At | 45 ticks held: damage x2.0, guard break (unblockable, parryable), tell: flash and sound |
| maxHold | 90 ticks, then auto-release |
| releaseRecovery | Weapon recovery + 10 ticks |
| staminaCost | Weapon stamina x1.5 (L1), x2.0 (L2) |

### Defence
| Key | Value |
|---|---|
| parryStartup | 2 ticks |
| parryWindow | 8 ticks (option: up to 12) |
| parryRecoveryOnMiss | 18 ticks |
| parryCost | 8 stamina, refunded on success |
| parryStagger | Attacker staggered 36 ticks; riposte damage x1.5 |
| blockArc | 120 degrees front |
| blockCost | 0.6 x the attack's shield damage |
| guardBreak | Stamina empty while blocking: 40 ticks broken |
| dodge | 20 stamina; 20 ticks; invulnerable ticks 4 to 13; 1.5 tiles |
| shove | 12 stamina; breaks block; target staggered 20 ticks |
| turnLock | Facing locked from windup start to recovery end |

### Vitality, stamina and armour
| Key | Value |
|---|---|
| vitality | 100 for the steerer and adult residents |
| stamina | 100; regenerates 25 per second after 36 ticks without spending; half while blocking |
| padded | -10% all damage |
| mail | -30% cut, -15% thrust and missiles |
| helmet | Head-blow critical chance halved |
| bloodiedBelow | 50% vitality |
| downed | Downed allies do not bleed out (design addendum 2.3 section 7); see Downed and carried |
| secondWind | 5 seconds; adjacent ally lifts the steerer to 25 vitality; once per scene |
| dismemberChance | 35% on killing blows from heavy axe, Dane axe or sword |
| finisherHold | 24 ticks |
| hitStop | 3 ticks |

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
| Key | Value |
|---|---|
| sprintEmpty | Drops to a walk until 25 stamina is regained |
| heavyCarryEmpty | Sets the load down; can lift again at 25 stamina |
| climbEmpty | Slides down 1 tile per second to the last ledge or the foot of the route; a slide of more than 2 tiles costs 10 vitality per tile beyond 2 |
| swimEmpty | Starts to sink: 6 s to reach water no deeper than the waist band, then drowning at 10 vitality per second; reaching the shallows ends it |
| waistWadeEmpty | Speed factor x0.5 again until 25 stamina is regained |

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

## 07 / Enemies, wildlife and perception
### Archetypes
| Archetype | Vitality | Armour | Weapons | Behaviour |
|---|---|---|---|---|
| Civilian (farmer, keeper, trader) | 60 | None | Tool or seax | Flees, hides, pleads; fights if cornered |
| Monk | 50 | None | None | Flees to tower or church; claims sanctuary |
| Guard | 100 | Padded | Spear and shield | Holds posts, raises alarm |
| Warrior | 110 | Padded, sometimes mail | Axe or sword and shield | Fights in line, flanks |
| Raider (Crowwick) | 100 | Padded | Axe, spear | Aggressive, loots, rarely surrenders |
| Archer | 80 | None | Bow, seax | Keeps distance, falls back |
| Huscarl (Orm) | 130 | Mail, helmet | Sword or Dane axe | Disciplined, holds formation |
| Outlaw | 90 | None | Mixed | Ambushes, flees when hurt |
| Draugr | 160 | Resists stagger | Grip and blows | Slow, relentless at night; returns until its anchor is resolved |
| Wolf | 50 | None | Bite | Packs of 3 to 5; circles; flees at half pack lost |
| Boar | 120 | Hide | Charge | Charges when cornered; drops 40 rd of meat |
| Each-uisce | 300 | Supernatural | Drag into water | Avoid or bind; violence only drives it off |

### Perception (tiles)
| Key | Value |
|---|---|
| sightDay | 15 |
| sightDusk | 9 |
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

### Cohesion and surrender
| Key | Value |
|---|---|
| groupCohesionStart | 100 |
| allyKilled | -20 |
| allyDowned | -10 |
| leaderKilled | -15 |
| outnumberedTwoToOne | -10 per 10 seconds |
| surrenderBelow | 30 |
| fleeBelow | 20 |
| noQuarterAfter | 2 known `SURRENDERED_KILLED` deeds by the household |

### Occupied Skarvholm garrison (late game)
| Post | Strength | Notes |
|---|---|---|
| Broch fort | Kolgrím the Burner and 9 huscarls, 3 dogs | Captives held inside; dogs hear with three times the normal noise radius |
| Barracks (old longhouse) | 12 raiders | Asleep at night unless the horn sounds |
| Watch cairn on Rook Hill | 2, a horn and a beacon | If the horn sounds and they live 60 s more, they light the beacon: Orm's fleet sails 5 days early |
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

## 08 / People, skills and wounds
### Skills
| Key | Value |
|---|---|
| levels | 0 to 5 |
| xpPerWorkerDay | 1 in the skill used |
| xpToLevel | 10 for 2, 30 for 3, 60 for 4, 100 for 5 (cumulative) |
| outputMultiplier | 0.6 + 0.15 x level (0.6 at 0, 1.35 at 5) |
| playerTimingBonus | Up to +25% task output for good timing |

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
| `PROMISE_KEPT` | 0 | 0 | 0 | 0 | 0 | +3 |
| `PROMISE_BROKEN` | 0 | 0 | 0 | 0 | 0 | -4 |
| Resident left behind | 0 | -1 | 0 | -4 | 0 | -1 |
| Crew member died | 0 | 0 | 0 | -2 | 0 | 0 |
| Retreat with everyone alive | 0 | +1 | -2 | +2 | 0 | 0 |

Revision 2.3 (decision DC-6): taking captives in a fight is ordinary dealing (Mercy objects to cruelty towards captives, not to capture); theft from the household's own stores is judged more harshly than open plunder abroad. `delta = sum(weight x valence x witness x culture)` in friendship, clamped to -15 and +15 per deed; witness factor 1.0 present, 0.6 told by a trusted tie, 0.3 rumour. Kári and any resident with Glory 3 and no Mercy treat `CIVILIAN_KILLED` Glory as +1. (Revision 2.2: these deltas, which moved the single regard, now move friendship; fear has its own table below.)

### Deed reactions by culture
*The witness's culture weighs a deed first (the `culture` factor in the delta above, and a fear or shame response), then their values, traits and stance (design addendum 2.3 section 2; Book 6 section 01). Positive is approval; the words are how they say it.*

| Deed | Norse | Gaels | Church | Keepers | Saltvik |
|---|---|---|---|---|---|
| `KILLING` in open fight | x1.0 (honourable if bold) | x1.5 against (an act of war; éraic owed) | x1.2 against (a sin, though kings do it) | x0.5 (the sea's business) | x1.0 (bad for trade) |
| `THEFT` | x1.0; the Glory-minded scorn it | x0.8 against (less grave than burning) | x1.0 against (a sin) | x1.0 against (taking without giving) | x1.5 against (cheating the bargain) |
| `CIVILIAN_KILLED` | x1.0 against (no glory, bad luck, vengeance) | x2.0 against (outrage; éraic by rank) | x2.0 against (a grave sin) | x1.5 against (blood on the shore) | x1.5 against |
| `SURRENDERED_KILLED` | x1.5 against (níð-worthy shame) | x1.5 against | x2.0 against (murder) | x1.5 against (oath-breaking) | x1.5 against |
| `KILLING_HIDDEN` (proposal) | x2.0 against (murder) | x1.5 against | x1.5 against | x0 | x1.0 against |
| `HOSPITALITY_BROKEN` (proposal) | x2.0 against | x2.0 against (the briugu's curse) | x1.5 against | x1.5 against | x2.0 against |
| `SACRILEGE` at a church | x0.2 against (bad luck to the superstitious) | x1.5 against | x3.0 against (the worst of crimes) | x0 | x0.5 against |
| `SACRILEGE` at an old shrine or mound | x1.5 against (the land-spirits) | x1.0 against (the aos sí remember) | x1.0 for (a good work) | x2.0 against | x0.5 against |
| `BLOOD_PRICE_PAID` / `BLOOD_PRICE_TAKEN` (proposal) | x1.0 for; Glory 2 or more against | x1.5 for | x1.0 for | x0 | x1.5 for |
| `HOSTAGE_TAKEN` | x0 (ordinary dealing) | x0 | x0 | x0 | x0 |
| `PROMISE_BROKEN` | x1.5 against | x2.0 against (sureties ruined) | x1.5 against (a sin) | x3.0 against | x2.0 against |
| `RITES_DENIED` (proposal) | x1.5 against (invites draugar) | x1.0 against | x2.0 against (the soul denied) | x1.5 against | x1.0 against |
| `CHALLENGE_REFUSED` (proposal) | x1.5 against (cowardice; níð) | x1.0 against | x1.0 for (righteous) | x0 | x0 |

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
| Keen-eyed | Sight +2 tiles at sea and on watch; spots ambush signs 3 tiles sooner |
| Sea-sick | Work x0.8 at sea; x1.05 on land |
| Storyteller or singer | Happiness +5 for everyone at the fire |
| Grudge-holder | Grudges never fade; friendship lost to a slight x1.5 |
| Diligent / Lazy | Unsupervised work x1.1 / x0.85 |

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
| Workshop | 6 x 5 | 3 timber | 4 | Carpentry, tools, shields |
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
*Each hands-on action takes game time and only a little stamina, so the day is the real cost of working and work stays a bonus (Book 1 section 18).*

| Task | Game minutes per action | Stamina per action |
|---|---|---|
| Gather driftwood | 20 | 1 |
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
| Mend nets | 20 | 0 |
| Herd | 30 | 1 |
| Milk | 15 | 0 |
| Shear | 20 | 1 |
| Cook | 30 | 0 |
| Tend wounds | 20 | 0 |
| Repair the ship | 30 | 2 |
| Gather shellfish, seaweed or eggs | 20 | 1 |
| Train | 30 | 3 |

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
| 6 | Chapter 1 done; boat launched | 4 | 0 | Wreck kit: 2 axes, Runa's tools, 2 spears, 2 shields, Bran's axe, Thorkel's sword (or buried), knives, a line | T1, 1 fitting | Sail shelter, fire | 8 to 10 days runway |
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
| 121 to 150 | The coast's answer (Book 6 scenario 8) | Ledger | Precursors 5 days ahead | Raid, arson, interdict or envoy | Settle or defend |
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
| 256 to 270 | Orm's fleet and the finale | Always | The washer at the ford | 6 to 10 ships; two fewer if the Naust ships were burned; 5 days earlier if the beacon was lit | Everything prepared |

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
*Rolled per crossing (proposal values, for tuning after playtests).*

| Key | Value |
|---|---|
| wanderers | 50% of crossings meet wandering people (travellers, pilgrims, pedlars, herders, charcoal burners, patrols, outlaws, a lost traveller, a fleeing thrall, a hunting party) |
| hostileDay | 20% of crossings by day meet a hostile encounter (bandits, outlaws, wolves, a boar, a hostile patrol) |
| hostileNight | 33% of crossings at night |
| winterWolves | Hostile chance x1.5 on the High Pass and the moor road in winter |
| hostileFaction | Hostile chance x2 on a route held by a faction hostile to the household |
| cargo | Hostile chance x1.5 when carrying cargo or driving cattle |
| cleared | Hostile chance x0.5 once the household has driven out the route's outlaws |
| ambushSign | Every ambush shows a sign (a fallen tree, crows rising, a stretch gone quiet, fresh tracks) at least 6 tiles ahead; a keen-eyed companion sees it 3 tiles sooner |

### Shortest journeys
*Computed from the Network by `src/sim/travel/journeys.ts` (a test checks every row). Hours by land, the fastest chain of road legs and routes, without modifiers.*

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
| waystation | A safe camp with a small store at one camp spot per route (proposal): 6 timber, 2 stone, 4 worker-days; stores 10 lots; night risk x0.25 |

## 16 / Dungeons and equipment
| Reward | Dungeon | Effect | Cost |
|---|---|---|---|
| Ceo, the mist-spear | Black Wood souterrain | In fog and at night, thrusts pass through shields; otherwise a spear | Each Samhain the hill-folk call for a service; Christian residents' happiness -5 while it is kept at home |
| Barrow mail | The Barrow-King's mound | -40% cut, -25% thrust and missiles; immune to stagger | 20% a night of a draugr drawn near the steerer; Ottar's family claim it (Saltvik friendship -20 if worn there) |
| The bog torc | The Drowned Trackway | The dead cannot see the steerer beyond 2 tiles; flooded bog walked at walking speed | Fires warm half as fast; 10% a cold night of cold sickness |
| A Frankish sword | Outlaws' hill-fort | Sword damage x1.25 and recovery 4 ticks shorter | Worn at Dún Fiach it is an accusation: Dún Fiach hostile until settled |
| The Cailleach's maul | The Cailleach's Cave | The heavy attack shatters shields; water it strikes freezes (an ice bridge for 120 s; bog frozen for 10 tiles round) | Works only in autumn and winter; used in summer, a storm within 3 days |
| The kelpie bridle | Loch Carn (quest) | Summons the water-horse to cross lochs, bogs and rivers at 7 tiles per second | Kept near water at night: 25% a night that the horse drowns its rider unless the steerer refuses it |

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
| Saltvik knarr | About every 10 days in the sailing season | Iron, salt and cloth; buys hides, wool and fish; leads |
| Gaelic pedlar | Every 6 days once the household is on the mainland | Needles, dyes, small goods and news |
| Wandering smith | Once a season | Repairs and a weapon to order |
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
| wildernessArea | At least one secret, one resource worth the trip, one story and one danger |
| change | Every area changes with season and tide |
| objective | The current goal is always shown |

## 21 / Controls and camera
*Mouse-first controls in the style of a farming RPG, with keyboard-only and gamepad play kept whole (Book 2 section 21; Book 7 section 14, Camera feel). The logical viewport, tiles and sight ranges are unchanged.*

| Key | Value |
|---|---|
| hotbarSlots | 12 |
| hotbarKeys | 1 to 9, 0, minus and equals; or the mouse wheel |
| toolReach | 1.5 tiles: the steerer's tile and the eight around it |
| interactReach | 2 tiles |
| castReach | 5 tiles (casting a line, throwing an item) |
| meleeAim | Towards the cursor, snapped to the nearest of the four facings |
| missileAim | Free aim at the cursor with an aim line while drawing a bow or holding a thrown spear |
| keyboardTarget | The tile in front of the steerer's facing |
| gamepadDeadZone | 0.2 of the right stick's travel |
| gamepadCursor | The right stick sets the target tile within reach in its direction; while aiming, it aims freely |
| lookAheadScale | 0.35 x the cursor's distance from the steerer |
| lookAheadMax | 3 tiles |
| lookAheadAiming | 5 tiles while aiming a bow or thrown spear |
| lookAheadDeadZone | 0.5 tiles: no look-ahead while the cursor is this close |
| cameraHalfLife | 0.18 s, critically damped, in sub-pixel space |
| cameraSnap | The drawn offset is whole logical pixels, changed only when the smoothed offset moves 0.5 px past it (hysteresis), so it never flickers between two pixels |

## 22 / Story gates
*The story moves only through major events the player chooses to start; the calendar keeps running (design addendum 2.3 section 4; Book 4 section 08). Typical days are a guide for a well-paced player, never a deadline.*

| Gate (proposal) | Typical day | Readiness screen shows |
|---|---|---|
| The launch (end of Chapter 1) | 6 | The boat's repairs, crew, stores |
| The Carrick raid | 12 to 15 | Crew, ship, plan, equipment |
| The reply to Asgrim | 118 to 120 | Silver, allies, the household's answer |
| The defence of Skarvholm | 121 to 150 | Watch, walls, weapons, warning |
| The household council | About 180 | Stores, the island's state, the two sites |
| The move ashore | 181 to 210 | Ships, cargo, the site secured |
| The Gathering | 211 to 240 | Allies, demands, offers |
| The Return to Skarvholm | 241 to 252 | Crew, equipment, keys, the checkpoint |
| The final battle | 256 to 270 | Allies, ships, the Cup |

| Key | Value |
|---|---|
| waiting | A dated story event waits at its gate; the calendar, seasons, crops and winter go on |
| pressure | While a gate waits past its typical day: a demand grows 10% every 10 days, and one rumour spreads every 5 days; pressure never starts a gate |
| warning | Every readiness screen says plainly that the gate is a point of no return |

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
*Some residents and enemies, never the steerer (design addendum 2.3 section 11; Book 7). Proposal values.*

| Key | Value |
|---|---|
| poise | Light attacks do not stagger a heavy fighter |
| windup | +4 ticks on every attack |
| damage | x1.2 |
| runSpeed | x0.9 |
| carrySpeed | x1.15 carrying loads and downed allies |
| runStamina | Running drains x1.25 |
| share | About one in six generated people |

