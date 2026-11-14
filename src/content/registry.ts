/**
 * Content loading (Book 2 section 04): one schema per content type, validated at load; every
 * cross-reference must resolve; every content ID must be in the ID registry (content/ids.json).
 * `loadContent` is pure: give it the parsed files, get back registries and a list of issues.
 */
import type { Id } from '../core/ids.ts';
import { parseIdRegistry } from './idRegistry.ts';
import type { IdRegistry } from './idRegistry.ts';
import { arrayOf, bool, id, int, object, oneOf, recordOf, ref, text } from './schema.ts';
import type { Check, Ctx, Issue, Ref, RefKind } from './schema.ts';
import { steererWordingProblems } from './steererWords.ts';
import { aimCondition } from './aimSchema.ts';
import { parseCompany, parseGuidance } from './companySchema.ts';
import { parseFinds } from './findsSchema.ts';
import { islandAudioCheck } from './islandAudioSchema.ts';
import { islandProblems, parseIsland, parsePuzzles } from './islandSchema.ts';
import type { IslandDef, PuzzlesDef } from './islandSchema.ts';
import type { FindsDef } from './findsSchema.ts';
import type { CompanyDef, GuidanceDef } from './companySchema.ts';
import { parseRaid, RAID_ACTIONS, RAID_WHEN } from './raidSchema.ts';
import { parseSea, seaProblems } from './seaSchema.ts';
import type { SeaDef } from './seaSchema.ts';
import { parseWreck, wreckProblems } from './wreckSchema.ts';
import type { WreckDef } from './wreckSchema.ts';
import type { RaidDef } from './raidSchema.ts';
import { captionProblems, isDialogueKey, modernMoralWordsIn, parseStringTable } from './strings.ts';
import { checkZoneMap } from './zoneMap.ts';
import type { ZoneMap } from './zoneMap.ts';
import type { StringTable } from './strings.ts';

export const CONTENT_FILES = {
  ids: 'content/ids.json',
  strings: 'content/strings/en.json',
  balance: 'content/balance.json',
  places: 'content/places.json',
  hazards: 'content/hazards.json',
  regions: 'content/regions.json',
  people: 'content/people.json',
  factions: 'content/factions.json',
  hulls: 'content/hulls.json',
  fittings: 'content/fittings.json',
  audio: 'content/audio.json',
  onFoot: 'content/onfoot.json',
  opening: 'content/opening.json',
  camp: 'content/camp.json',
  household: 'content/household.json',
  talk: 'content/talk.json',
  scenes: 'content/scenes.json',
  combat: 'content/combat.json',
  searches: 'content/searches.json',
  repairs: 'content/repairs.json',
  launch: 'content/launch.json',
  /** The user's fourth playtest (DH-40 onwards): the household's own life, and the guidance. */
  company: 'content/company.json',
  guidance: 'content/guidance.json',
  /** The user's fourth playtest (DH-115 onwards): the small finds off the paths (request 24). */
  finds: 'content/finds.json',
  /** A reason for the first raid (DH-130 to DH-159): needs, the skin boat, asking, the council. */
  raid: 'content/raid.json',
  /** Stage 14, work package C: the island's puzzles and secrets, and its nodes, marks and map. */
  puzzles: 'content/puzzles.json',
  island: 'content/island.json',
  /** Stage 13: the sea map's nodes, routes, encounter tables and landings (Book 2 section 09). */
  sea: 'content/sea.json',
  /** Stage 13, work package C: the wreck on Sgeir Dhubh (Book 6 section 19). */
  wreck: 'content/wreck.json',
  zoneStrand: 'content/zones/zone_sk_strand.json',
  zoneMachair: 'content/zones/zone_sk_machair.json',
  zoneHagseat: 'content/zones/zone_sk_hagseat.json',
  zoneCairn: 'content/zones/zone_sk_cairn.json',
  zoneSealcave: 'content/zones/zone_sk_sealcave.json',
  zoneSeaWreck: 'content/zones/zone_sea_wreck.json',
  zoneGeo: 'content/zones/zone_sk_geo.json',
  zoneSkerry: 'content/zones/zone_sk_skerry.json',
  zoneNaust: 'content/zones/zone_sk_naust.json',
} as const;

export type ContentFiles = { readonly [K in keyof typeof CONTENT_FILES]: unknown };

const PLACE_TYPES = [
  'HOME_ISLAND',
  'RAID_SITE',
  'FARM_SETTLEMENT',
  'MONASTERY',
  'RINGFORT',
  'HARBOUR',
  'FARMSTEADS',
  'SACRED_ISLAND',
  'RAIDERS_CAMP',
  'SEA_KING_SEAT',
  'HOME_SITE',
  'SKARVHOLM_PLACE',
] as const;
export const VALUES = ['GAIN', 'MERCY', 'GLORY', 'KIN', 'FAITH', 'WORD'] as const;
export const TIE_KINDS = [
  'KIN',
  'FRIEND',
  'RIVAL',
  'SPOUSE',
  'DEBT',
  'GRIEVANCE',
  'OATH',
  'MENTOR',
] as const;
/** Book 2 section 06: the codes people judge by, stances, traits and the kinds of liking. */
export const CODES = ['NORSE', 'GAELIC', 'CHURCH', 'KEEPERS', 'SALTVIK'] as const;
export const CODE_STANCES = ['CONVENTIONAL', 'SCEPTICAL', 'CYNICAL', 'TRANSGRESSIVE'] as const;
export const TRAITS = [
  'BERSERK',
  'COWARDLY',
  'SUPERSTITIOUS',
  'BRAVE',
  'GREEDY',
  'PIOUS',
  'HOT_TEMPERED',
  'GENTLE',
  'DRINKER',
  'LIGHT_FINGERED',
  'KEEN_EYED',
  'SEA_SICK',
  'STORYTELLER',
  'GRUDGE_HOLDER',
  'DILIGENT',
  'LAZY',
] as const;
export const FAITHS = ['OLD_GODS', 'CHRIST', 'LAND_SPIRITS', 'NONE'] as const;
export const LIKING_KINDS = ['FOOD', 'ACTIVITY', 'PLACE', 'WEATHER', 'PERSON', 'GIFT'] as const;
export const ORIGINS = ['NORSE', 'GAELIC', 'NORSE_GAELIC', 'KEEPERS', 'UNSTATED'] as const;
/** When a tendency runs in the day (Book 5 section 17), and where. */
export const TENDENCY_TIMES = ['DAWN', 'DUSK', 'EVENING', 'NIGHT', 'WORK', 'SEA'] as const;
export const TENDENCY_PLACES = ['SHORE', 'FIRE', 'DOOR', 'STORES', 'BOAT', 'HIGH', 'YARD'] as const;
export const TENDENCY_POSES = ['watch', 'sit', 'kneel', 'work'] as const;
/** Book 2 section 06: the schedule's blocks; a job's work fills WORK. */
export const SCHEDULE_BLOCKS = ['SLEEP', 'MEAL', 'WORK', 'EVENING'] as const;
export const JOBS = ['FISHER', 'CAMP', 'DRIFTWOOD', 'BUILDER', 'SHIPWRIGHT', 'REST'] as const;
/** Book 10 section 08, "Conversation replies". */
export const REPLIES = ['Talk', 'Warm', 'Glad', 'Cold', 'Punished', 'Shamed', 'Threat'] as const;
export const VOICES = ['NEUTRAL', 'WARM', 'COLD', 'AFRAID', 'DEVOTED'] as const;
export const WATCH_NAMES = ['MORNING', 'DAY', 'EVENING', 'NIGHT'] as const;
export const ACTIVITY_KINDS = [
  'SLEEP',
  'MEAL',
  'WORK',
  'EVENING',
  'TENDENCY',
  'LEAD',
  'SIT',
  'REST',
  'BED',
  'TALK',
  'SCENE',
  'REFUSE',
  'DARK',
  /** The user's fourth playtest (DH-44, DH-41): the night's watch by the fire; a wound being bound. */
  'WATCH',
  'TENDED',
] as const;
export const BARK_CATEGORIES = [
  'DANGER',
  'ORDER',
  'WOUND',
  'DISCOVERY',
  'REACTION',
  'WORK',
  'WEATHER',
  'IDLE',
] as const;
export const MEMORY_KINDS = [
  'WOUND',
  'DEATH',
  'DEED',
  'EVENT',
  'JOB',
  'SEASON',
  'CARE',
  // A reason for the first raid (DH-134): a topic offered while a need is felt (content/raid.json).
  'NEED',
] as const;
export const JUDGEMENTS = [
  'TAKE_SIDE',
  'COMPROMISE',
  'PUNISH',
  'COMPENSATE',
  'HOUSEHOLD_THING',
  'IGNORE',
] as const;
const PERSON_KINDS = ['PLAYER', 'RESIDENT', 'LEADER', 'RIVAL_CAPTAIN', 'ENEMY', 'HOSTAGE'] as const;
const ATTITUDES = ['NEUTRAL', 'WARY', 'UNKNOWN', 'RIVAL', 'DEMANDING'] as const;
const TIERS = ['T1', 'T2', 'T3A', 'T3B'] as const;
const SLOTS = [
  'BOW',
  'MIDSHIP',
  'STERN',
  'RIG',
  'GUNWALE',
  'BOW_IDENTITY',
  'MAST_IDENTITY',
] as const;

/** Each person kind and the ID prefix it must use (Book 2 section 04). */
const KIND_PREFIX = {
  PLAYER: 'P',
  RESIDENT: 'C',
  LEADER: 'L',
  RIVAL_CAPTAIN: 'R',
  ENEMY: 'E',
  HOSTAGE: 'H',
} as const;

const placeCheck = object(
  {
    id: id(['ISLE', 'TOWN', 'FORT', 'ABBEY', 'GLEN', 'CAMP', 'SITE', 'SK']),
    type: oneOf(PLACE_TYPES),
    nameKey: ref('string'),
    region: ref('region'),
  },
  ['region'],
);
const hazardCheck = object({ id: id(['HAZ']), nameKey: ref('string') });
const zoneCheck = object({ id: id(['ZONE']), terrain: text });
const regionCheck = object(
  {
    id: id(['REG']),
    nameKey: ref('string'),
    homeSites: arrayOf(ref('place')),
    zones: arrayOf(zoneCheck),
  },
  ['homeSites'],
);
const tieCheck = object({ to: ref('person'), kind: oneOf(TIE_KINDS) });
const traitCheck = object(
  {
    trait: oneOf(TRAITS),
    /** Shown at once, or discovered over time (Book 10 section 08, traitsPerPerson). */
    known: bool,
    /** Pious names its faith. */
    faith: oneOf(FAITHS),
    /** Revealed only by this event (Oddi's light-fingers, by the theft found). */
    revealedBy: oneOf(['THEFT_FOUND'] as const),
  },
  ['faith', 'revealedBy'],
);
/** Book 2 section 06, Liking: a ref is an ID (RES_, TASK_, C_ ...) or a tag for a later system. */
const likingCheck = object({ kind: oneOf(LIKING_KINDS), ref: text, known: bool });
const tendencyCheck = object({
  at: oneOf(TENDENCY_TIMES),
  place: oneOf(TENDENCY_PLACES),
  pose: oneOf(TENDENCY_POSES),
});
const personCheck = object(
  {
    id: id(['P', 'C', 'L', 'R', 'E', 'H']),
    kind: oneOf(PERSON_KINDS),
    nameKey: ref('string'),
    values: recordOf(oneOf(VALUES), int(1, 3)),
    home: ref('place'),
    faction: ref('faction'),
    ties: arrayOf(tieCheck),
    /** The skills Book 5 names for the person (Book 10 section 08, startingSkills). */
    skills: arrayOf(text),
    /** Stage 8 (Book 2 section 06; Book 5 sections 02, 16 and 17). */
    origin: oneOf(ORIGINS),
    codes: arrayOf(oneOf(CODES)),
    codeStance: oneOf(CODE_STANCES),
    faithTarget: oneOf(FAITHS),
    /** A tie to the steerer (Book 10 section 08: friendship starts at 20). */
    steererTie: oneOf(TIE_KINDS),
    traits: arrayOf(traitCheck),
    likes: arrayOf(likingCheck),
    dislikes: arrayOf(likingCheck),
    tendency: tendencyCheck,
  },
  [
    'values',
    'home',
    'faction',
    'ties',
    'skills',
    'origin',
    'codes',
    'codeStance',
    'faithTarget',
    'steererTie',
    'traits',
    'likes',
    'dislikes',
    'tendency',
  ],
);
const factionCheck = object({
  id: id(['FAC']),
  nameKey: ref('string'),
  home: ref('place'),
  startAttitude: oneOf(ATTITUDES),
});
const hullCheck = object({
  id: id(['HULL']),
  tier: oneOf(TIERS),
  balanceRow: ref('balance:hull'),
  nameKey: ref('string'),
  /** The hull's fitting slots in order (Book 7 section 03); as many as Book 10's Slots. */
  slots: arrayOf(oneOf(SLOTS)),
});
const fittingCheck = object({
  id: id(['FIT']),
  slot: oneOf(SLOTS),
  balanceRow: ref('balance:fitting'),
  nameKey: ref('string'),
});

export const AUDIO_BUSES = ['music', 'ambience', 'effects', 'voice', 'tells'] as const;
const cueCheck = object(
  {
    id: id(['MUS', 'SFX', 'AMB', 'VO']),
    kind: oneOf(['music', 'stinger', 'sfx', 'ambience'] as const),
    bpm: int(20, 240),
    beatsPerBar: int(2, 12),
    stems: arrayOf(oneOf(['bed', 'rhythm', 'melody', 'voice', 'danger'] as const)),
    lengthBeats: int(1, 32),
    bus: oneOf(AUDIO_BUSES),
    zones: arrayOf(ref('zone')),
    phases: arrayOf(oneOf(['dawn', 'day', 'dusk', 'night'] as const)),
    captionKey: ref('string'),
    /** Design addendum 2.5 (DF-80): a combat sound's drawn twin, in place of a caption. */
    drawn: text,
    temporary: bool,
    piece: oneOf(['hearth', 'skarvholm', 'raid', 'combat', 'ship', 'rites', 'sea'] as const),
    layers: recordOf(text, bool),
  },
  [
    'bpm',
    'beatsPerBar',
    'stems',
    'lengthBeats',
    'bus',
    'zones',
    'phases',
    'captionKey',
    'drawn',
    'piece',
    'layers',
  ],
);
const audioCheck = object(
  {
    about: text,
    captionSeconds: int(1, 10),
    stingerDuck: (v, path, ctx) =>
      typeof v === 'number' && v >= 0 && v <= 1
        ? v
        : (ctx.issues.push({ file: ctx.file, path, reason: 'expected a level from 0 to 1' }), null),
    cues: arrayOf(cueCheck),
    events: recordOf(text, id(['MUS', 'SFX', 'AMB', 'VO'])),
    /**
     * Home audio (Book 11 sections 03 and 12; Stage 7): the hearth theme plays for `playSeconds`
     * after `restSeconds` of ambience only, over and over, so at least a third of home time is
     * ambience only; the fire's crackle is full within `fireFullTiles` and silent from
     * `fireSilentTiles`.
     */
    home: object({
      restSeconds: int(10, 600),
      playSeconds: int(10, 600),
      fireFullTiles: int(0, 40),
      fireSilentTiles: int(1, 60),
    }),
    /**
     * Stage 10 (presentation, like `home`): the Kelda Spring heard full within `fullTiles` of its
     * pool and silent from `silentTiles`; the Hag's Seat's tell every `tellLeast` to `tellMost`
     * seconds while the stone weeps and the steerer is on the headland.
     */
    south: object({
      spring: object({
        zone: text,
        x: int(0, 512),
        y: int(0, 512),
        fullTiles: int(0, 40),
        silentTiles: int(1, 60),
      }),
      tellLeast: int(2, 120),
      tellMost: int(2, 120),
    }),
    /** Stage 14: the island's ambience by zone, area, season and hour (islandAudioSchema.ts). */
    island: islandAudioCheck,
  },
  ['home', 'south', 'island'],
);

const fraction =
  (min: number, max: number): Check<number> =>
  (v, path, ctx) =>
    typeof v === 'number' && v >= min && v <= max
      ? v
      : (ctx.issues.push({
          file: ctx.file,
          path,
          reason: `expected a number from ${min} to ${max}`,
        }),
        null);

const itemCheck = object(
  {
    nameKey: ref('string'),
    /**
     * The hotbar icon (a ui_icons state) and the target-tile glyph (a ui_cursor_glyph state; none
     * for an item aimed freely, which shows the aim line instead).
     */
    icon: text,
    glyph: text,
    use: oneOf(['AIM', 'MELEE', 'TOOL', 'AMMO', 'VALUABLE'] as const),
    /** The refusal word when there is nothing to use it on ("Nothing to cut", "No arrows"). */
    refusalKey: ref('string'),
    /** An aimed item's missile and the item each shot spends (Book 10 section 21). */
    missile: oneOf(['arrow', 'spear'] as const),
    ammo: id(['ITEM']),
    /** The tooltip shown the first time one is picked up, naming its controls. */
    tipKey: ref('string'),
    /** Used at castReach (Book 10 section 21: casting a line). */
    cast: bool,
  },
  ['glyph', 'missile', 'ammo', 'tipKey', 'cast'],
);

/** The Book 10 counts a pickup may take in place of its own count (design addendum 2.4). */
export const PICKUP_COUNTS: readonly string[] = ['bindingsAtCamp'];

const pickupCheck = object(
  {
    /** Unique within the zone; stable, as saves record what is still lying there. */
    key: text,
    zone: ref('zone'),
    item: id(['ITEM']),
    count: int(1, 99),
    /** Tile coordinates of its foot. */
    x: fraction(0, 512),
    y: fraction(0, 512),
    /** A quiver with Book 10's startingArrows comes with it. */
    quiver: bool,
    /** A fact that must be true before it shows. */
    after: text,
    glint: bool,
    /**
     * Design addendum 2.4: a Book 10 count in place of `count` ("bindingsAtCamp": the camp's
     * salvage bindings), so the number lives only in Book 10.
     */
    countFrom: text,
  },
  ['quiver', 'after', 'glint', 'countFrom'],
);

const coverCheck = object({
  w: int(1, 200),
  h: int(1, 200),
  material: oneOf(['wood', 'stone'] as const),
  tall: bool,
});

const onFootCheck = object({
  about: text,
  interactRadiusTiles: fraction(0.5, 4),
  footprint: object({ w: int(2, 24), h: int(1, 24) }),
  setDownReach: int(1, 48),
  /** What the steerer wakes with: hotbar slots from the first, and the one in hand. */
  hotbar: object({ about: text, start: arrayOf(id(['ITEM'])), selected: int(0, 11) }),
  items: recordOf(id(['ITEM']), itemCheck),
  /** The height a missile leaves the hand at, in pixels above the feet. */
  releaseHeightPx: int(0, 48),
  /** A person's body as a missile meets it, on the ground plane, in pixels. */
  missileHitBox: object({ w: int(2, 32), h: int(1, 16) }),
  /** Props that stop missiles, by sheet. */
  cover: recordOf(text, coverCheck),
  /** Items lying in zones at the start of a campaign. */
  pickups: arrayOf(pickupCheck),
  /** How long a pickup tooltip stays up, in seconds. */
  tipSeconds: int(1, 60),
});

/** Stage 9 (Book 2 sections 12 and 13): weapons, fighters, encounters, safe places and barks. */
const MELEE_ROWS = ['Seax', 'Hand axe', 'Spear', 'Sword', 'Dane axe', 'Club or hammer'] as const;
const combatWeaponCheck = object(
  {
    row: oneOf(MELEE_ROWS),
    /** The weapon layer's name (layer_weapon_<layer>_<build>). */
    layer: text,
    /** Killing blows that roll for dismemberment (Book 10 dismemberChance): heavies only, or any. */
    dismember: oneOf(['HEAVY', 'ANY'] as const),
  },
  ['dismember'],
);
const fighterCheck = object(
  {
    person: ref('person'),
    archetype: text,
    weapon: id(['ITEM']),
    shield: bool,
    bow: bool,
    heavy: bool,
    leader: bool,
    /** Named cruel enemies who finish the downed after a warning (Book 2 section 12). */
    finishesDowned: bool,
    look: text,
    /**
     * The user's third playtest (decision DG-9; Book 2 section 12's TeachingRule): a Chapter 1
     * teaching foe, beaten only by its lesson: PARRY (Svart) or RED, the red blow dodged (Ketill).
     */
    teaching: oneOf(['PARRY', 'RED'] as const),
    /** The voice pool their first-sight lines come from when they have none of their own (DG-8). */
    voice: oneOf(['NORSE', 'GAELIC'] as const),
  },
  ['shield', 'bow', 'heavy', 'leader', 'finishesDowned', 'teaching', 'voice'],
);
/** First-sight lines (decision DG-8; Book 8 section 07): a pool of warnings and one of taunts. */
const sightPoolCheck = object({ warn: arrayOf(ref('string')), taunt: arrayOf(ref('string')) });
/**
 * Overheard talk (decision DG-26; Book 10 "At the fold"): the exchanges a group plays while none of
 * them is aware of the steerer, each its speakers' lines in order, and who must be there for it.
 */
const talkExchangeCheck = object(
  {
    id: text,
    lines: arrayOf(object({ person: ref('person'), key: ref('string') })),
    needs: arrayOf(ref('person')),
    /**
     * The user's fourth playtest (DH-15): heard only while a story fact holds (`fact` set, or set
     * to `is`), or only while it does not (`unless`): who took the ship's silver.
     */
    fact: text,
    is: text,
    unless: text,
  },
  ['needs', 'fact', 'is', 'unless'],
);
const crewArmsCheck = object({ weapon: id(['ITEM']), shield: bool, bow: bool, heavy: bool }, [
  'weapon',
  'shield',
  'bow',
  'heavy',
]);
const encounterCheck = object(
  {
    id: id(['SCN']),
    zone: ref('zone'),
    /** A fact that must hold before the encounter is there. */
    after: text,
    /** Enemies who take the downed left behind as captives (Book 10 leftBehind). */
    takesCaptives: bool,
    /** The checkpoint saved as it begins (Book 1 section 15: checkpoints before major danger). */
    checkpoint: text,
    /**
     * Stage 10: they hold and talk with a steerer who comes with empty hands (Book 10 The three
     * searches, parley), rather than fight on sight.
     */
    parley: bool,
    /** Stage 10: people who fight on the household's side once it starts (Bran at the fold). */
    allies: arrayOf(ref('person')),
    /**
     * Combat v2 (Book 10 "Warnings", decision DE-11): scavengers, thieves and wary locals warn
     * before they fight, and leave when the steerer's side is clearly stronger.
     */
    warns: bool,
    /**
     * Combat v2 (Book 10 "The scavengers at dusk", decision DE-15): the encounter is the first
     * dusk's, there from its time until dark; its people go to the fold after it. Its bargain
     * is the camp's food.
     */
    dusk: bool,
    /** Who carries a shield on the back while working, and so fights without it (Svart at dusk). */
    shieldOnBack: arrayOf(ref('person')),
    /** Who is the tutorial's slow heavy (Svart at dusk: Book 10 svartWindup, svartHeavies). */
    teaches: ref('person'),
    /** Who runs when another of the band falls, or when hit at all (Conn at dusk: connFlees). */
    runsWhenFriendFalls: ref('person'),
    /**
     * The user's fourth playtest (Book 10 "Guarding and pursuit", decision DH-72): the ground or
     * thing the band guards, in tiles (the fold and Bran in it; the skiff in Seal Cave). A band
     * with a post rushes back to it when its foe is too far from it; one without pursues.
     */
    post: object({ x: fraction(0, 512), y: fraction(0, 512) }),
    members: arrayOf(
      object(
        {
          person: ref('person'),
          x: fraction(0, 512),
          y: fraction(0, 512),
          facing: oneOf(['s', 'n', 'e', 'w'] as const),
          task: id(['TASK']),
        },
        ['task'],
      ),
    ),
  },
  [
    'after',
    'parley',
    'allies',
    'warns',
    'dusk',
    'shieldOnBack',
    'teaches',
    'runsWhenFriendFalls',
    'post',
  ],
);
/**
 * Combat v2 (Book 10 "Sneaking", tallGrass): ground that hides a sneaking actor beyond Book 10's
 * distance (tall grass, dune grass, peat banks), as tile rectangles in a zone.
 */
const hideCheck = object({
  zone: ref('zone'),
  kind: oneOf(['tall grass', 'dune grass', 'peat banks'] as const),
  x0: int(0, 512),
  y0: int(0, 512),
  x1: int(0, 512),
  y1: int(0, 512),
});
const safePlaceCheck = object({
  key: text,
  about: text,
  zone: ref('zone'),
  x: fraction(0, 512),
  y: fraction(0, 512),
  r: fraction(0.5, 40),
});
const combatCheck = object(
  {
    about: text,
    weapons: recordOf(id(['ITEM']), combatWeaponCheck),
    fighters: arrayOf(fighterCheck),
    crew: recordOf(text, crewArmsCheck),
    encounters: arrayOf(encounterCheck),
    safePlaces: arrayOf(safePlaceCheck),
    hides: arrayOf(hideCheck),
    barks: recordOf(ref('person'), recordOf(text, arrayOf(ref('string')))),
    /** Presentation only (Book 7 section 12): corpse fading and stains by the gore setting. */
    gore: object({
      about: text,
      corpseFadeSeconds: object({ low: int(0, 3600), off: int(0, 3600) }),
      stainSeconds: object({ low: int(0, 3600), full: int(0, 36000) }),
    }),
    /**
     * The user's third playtest: first-sight pools by named enemy and by voice (decision DG-8), and
     * an encounter's overheard talk (decision DG-26).
     */
    sight: object({
      about: text,
      people: recordOf(ref('person'), sightPoolCheck),
      voices: recordOf(text, sightPoolCheck),
    }),
    talk: object({
      about: text,
      encounter: id(['SCN']),
      exchanges: arrayOf(talkExchangeCheck),
    }),
  },
  ['sight', 'talk'],
);

const facingAtR = object({
  x: fraction(0, 512),
  y: fraction(0, 512),
  facing: oneOf(['s', 'n', 'e', 'w'] as const),
});
const openingCheck = object({
  about: text,
  beat: id(['BEAT']),
  zone: ref('zone'),
  caller: ref('person'),
  firstCallSeconds: int(0, 60),
  callEverySeconds: int(1, 60),
  moveHintSeconds: int(1, 60),
  /** How the caller waits to be rescued: lying, or standing and calling. */
  callerPose: oneOf(['down', 'call'] as const),
  callLines: arrayOf(ref('string')),
  foundLine: ref('string'),
  safeLine: ref('string'),
  refusedLine: ref('string'),
  /** Design addendum 2.4's opening (decisions DE-16 to DE-30): src/sim/narrative/wreck.ts. */
  rework: object(
    {
      coldOpen: object({
        about: text,
        seconds: int(1, 120),
        strikeSeconds: int(1, 120),
        blackSeconds: int(1, 120),
        shoutEverySeconds: int(1, 60),
        shouts: arrayOf(ref('string')),
        captions: recordOf(text, ref('string')),
      }),
      waking: object({ about: text, getUpTicks: int(1, 600), coughCaption: ref('string') }),
      net: object({
        about: text,
        blades: arrayOf(id(['ITEM'])),
        lines: recordOf(text, ref('string')),
        captions: recordOf(text, ref('string')),
        promptKey: ref('string'),
        refusalKey: ref('string'),
        jokeSeconds: int(0, 60),
      }),
      chest: object({
        about: text,
        id: id(['ITEM']),
        zone: ref('zone'),
        at: facingAtR,
        home: object({ zone: ref('zone'), x: fraction(0, 512), y: fraction(0, 512), facing: text }),
        key: id(['ITEM']),
        lineAfterSafeSeconds: fraction(0, 60),
        line: ref('string'),
        lockedKey: ref('string'),
        openPromptKey: ref('string'),
        keyPromptKey: ref('string'),
        contents: arrayOf(
          object({ item: id(['ITEM']), count: int(1, 99), quiver: bool }, ['quiver']),
        ),
        bowLine: ref('string'),
        keyLine: ref('string'),
        captions: recordOf(text, ref('string')),
      }),
      mast: object({
        about: text,
        zone: ref('zone'),
        foot: object({ x: fraction(0, 512), y: fraction(0, 512) }),
        lashing: object({
          x: fraction(0, 512),
          y: fraction(0, 512),
          heightPx: int(0, 400),
          w: int(1, 64),
          h: int(1, 64),
        }),
        fall: facingAtR,
        bundle: id(['ITEM']),
        line: ref('string'),
        lineAfterSeconds: int(0, 60),
        captions: recordOf(text, ref('string')),
        campTiles: fraction(0.5, 20),
      }),
      camp: object(
        {
          about: text,
          reachTiles: fraction(0.5, 30),
          walkUp: ref('string'),
          walkUpTiles: fraction(0.5, 10),
          shelterUp: ref('string'),
          oldBoat: ref('string'),
          oldBoatTiles: fraction(0.5, 20),
          captions: recordOf(text, ref('string')),
          /** Where the folded sail and the three oars lie (Book 9 section 04), and Hild's seat. */
          sail: object({ x: fraction(0, 512), y: fraction(0, 512) }),
          hildSeat: facingAtR,
          /**
           * The user's third playtest (DG-12): Hild's word for each stage of the shelter (the frame
           * after her walk-up, the sail once it stands, the night's word under the lean-to, the second
           * morning's finishing and the finished shelter), how long a second line waits behind a
           * first (real seconds), and where she steadies the oars while the frame goes up.
           */
          frame: ref('string'),
          sailLine: ref('string'),
          night: ref('string'),
          finish: ref('string'),
          finished: ref('string'),
          nextLineSeconds: fraction(0.5, 20),
          steady: facingAtR,
          /**
           * The user's fourth playtest (DH-10, DH-11): the marked spot where the frame and the sail
           * are worked, beside the lean-to's bed and never on it (Book 9 section 04).
           */
          mark: object({ x: fraction(0, 512), y: fraction(0, 512) }),
        },
        ['mark'],
      ),
      /** The user's third playtest (DG-13): Hild points up the bank to the old tower, once safe. */
      broch: object({ about: text, line: ref('string'), afterSafeSeconds: fraction(0, 30) }),
      fireScene: object({
        about: text,
        fromMinute: int(0, 1439),
        nearTiles: fraction(0.5, 10),
        lines: arrayOf(ref('string')),
      }),
      hagLight: object({
        about: text,
        fromMinute: int(0, 1439),
        untilMinute: int(0, 1439),
        caption: ref('string'),
      }),
      hagStone: object({
        about: text,
        holds: arrayOf(fraction(0, 60)),
        captions: recordOf(text, ref('string')),
      }),
      runa: object({
        about: text,
        talk: text,
        places: recordOf(
          text,
          object({
            zone: ref('zone'),
            x: fraction(0, 512),
            y: fraction(0, 512),
            r: fraction(0, 40),
          }),
        ),
        checkTiles: fraction(0.5, 20),
        truth: ref('string'),
        lie: ref('string'),
      }),
      rescue: object({ about: text, people: arrayOf(ref('person')) }),
      life: object({ about: text, sealSinkTiles: fraction(0, 40), gullLiftTiles: fraction(0, 40) }),
      /**
       * The user's fourth playtest's story and scenes (decisions DH-10 to DH-39): the steerer's word
       * over a body, the strongbox taken in sight, Runa's reminder, and Hild's first-night lines once
       * her father is found. Its numbers are Book 10's ("Story and scenes").
       */
      story4: object({
        about: text,
        remarks: object({
          about: text,
          /** Thorkel's body (an actor, not a person of the household). */
          thorkel: text,
          thorkelLines: arrayOf(ref('string')),
          fallenLines: arrayOf(ref('string')),
        }),
        snatch: object({
          about: text,
          /** Which way the dune grass lies (he comes from it) and the edge he leaves by. */
          landward: oneOf(['n', 's', 'e', 'w'] as const),
          exit: oneOf(['n', 's', 'e', 'w'] as const),
          thieves: arrayOf(
            object({
              person: ref('person'),
              grab: ref('string'),
              caught: ref('string'),
              oddiShout: ref('string'),
              oddiSafe: ref('string'),
            }),
          ),
        }),
        runa: object({ about: text, lines: arrayOf(ref('string')) }),
        fireFound: object({ about: text, swap: recordOf(ref('string'), ref('string')) }),
      }),
    },
    ['story4'],
  ),
  /** Every aim of Chapter 1 (Book 2 section 16, AimDef; Book 8 section 13). */
  aims: arrayOf(
    object(
      {
        id: text,
        journalKey: ref('string'),
        opensWhen: arrayOf(aimCondition),
        doneWhen: arrayOf(aimCondition),
        progress: arrayOf(aimCondition),
        givenBy: object({ speaker: ref('person'), textKey: ref('string'), call: bool }, ['call']),
        hints: arrayOf(
          object(
            {
              speaker: ref('person'),
              textKey: ref('string'),
              canCall: bool,
              alt: object({ speaker: ref('person'), textKey: ref('string'), canCall: bool }),
              /**
               * The user's fourth playtest (DH-35): given only while these hold (where it helps);
               * otherwise the hint waits, its clock running on.
               */
              when: arrayOf(aimCondition),
            },
            ['alt', 'when'],
          ),
        ),
      },
      ['givenBy'],
    ),
  ),
});

const placeAt = object({ x: fraction(0, 512), y: fraction(0, 512) });
const facingAt = object({
  x: fraction(0, 512),
  y: fraction(0, 512),
  facing: oneOf(['s', 'n', 'e', 'w'] as const),
});
const STAGES = ['S0', 'S1'] as const;
const taskCheck = object(
  {
    nameKey: ref('string'),
    /**
     * The task's row in Book 10 section 09, "Homestead tasks: time and stamina", or "Driftwood
     * finds" for the driftwood pick-up (section 03; decision PT-2).
     */
    balanceRow: text,
    skill: text,
    /** The work loop animation the steerer and residents play (Book 7 section 07). */
    workLoop: oneOf(['gather', 'fish', 'kneel', 'build'] as const),
    /** The game event its sound is played by (content/audio.json events). */
    sound: text,
    output: id(['RES']),
    /** The item used to do it (selected in the hotbar). */
    tool: id(['ITEM']),
  },
  ['output', 'tool'],
);
const siteCheck = object(
  {
    key: text,
    zone: ref('zone'),
    kind: oneOf(['FIRE', 'BED', 'BUILD', 'STORES', 'DRIFTWOOD'] as const),
    x: fraction(0, 512),
    y: fraction(0, 512),
    stages: arrayOf(oneOf(STAGES)),
    /** How the site is drawn, a frame of prop_driftwood for a piece of driftwood (decision PT-5). */
    frame: text,
    /**
     * The user's fourth playtest (DH-100): the ground the site covers, in tiles of its zone (the
     * steerer's bed, 2 x 1 tiles, Book 7 section 01). Standing anywhere on it uses it.
     */
    area: object({
      x0: fraction(0, 512),
      y0: fraction(0, 512),
      x1: fraction(0, 512),
      y1: fraction(0, 512),
    }),
  },
  ['stages', 'frame', 'area'],
);
const campPropCheck = object(
  {
    sheet: text,
    frame: text,
    x: fraction(0, 512),
    y: fraction(0, 512),
    /** Lies flat on the ground (a fire ring, a hearth kerb): drawn under people and the fire. */
    flat: bool,
  },
  ['flat'],
);
const campPersonCheck = object({
  camp: facingAt,
  sleep: object({ S0: facingAt, S1: facingAt }),
  work: object({
    task: id(['TASK']),
    zone: ref('zone'),
    x: fraction(0, 512),
    y: fraction(0, 512),
    facing: oneOf(['s', 'n', 'e', 'w'] as const),
  }),
  leadWaitTiles: fraction(1, 20),
});
const campCheck = object(
  {
    about: text,
    home: ref('place'),
    zone: ref('zone'),
    beat: id(['BEAT']),
    shelter: object({ building: id(['BLD']), balanceRow: text }),
    sleepSeconds: fraction(0, 10),
    /** The region whose resource nodes keep the driftwood picked up (decision PT-4). */
    region: ref('region'),
    tasks: recordOf(id(['TASK']), taskCheck),
    sites: arrayOf(siteCheck),
    props: object({ S0: arrayOf(campPropCheck), S1: arrayOf(campPropCheck) }),
    woodpile: placeAt,
    people: recordOf(id(['C']), campPersonCheck),
    lines: recordOf(text, ref('string')),
    leadAfterSeconds: int(0, 60),
    /** Design addendum 2.4 (DE-22, DE-27): the beds under the raised lean-to, a fur each. */
    shelterBeds: arrayOf(facingAt),
  },
  ['shelterBeds'],
);

const spotCheck = object(
  {
    zone: ref('zone'),
    x: fraction(0, 512),
    y: fraction(0, 512),
    facing: oneOf(['s', 'n', 'e', 'w'] as const),
    /**
     * The user's fourth playtest (DH-60): how a job is worked at this spot, a standing work loop
     * (the task's own) or kneeling low (caulking a seam), so workers round the boat differ.
     */
    pose: oneOf(['work', 'kneel'] as const),
  },
  ['pose'],
);
const clock: Check<string> = (v, path, ctx) =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
    ? v
    : (ctx.issues.push({ file: ctx.file, path, reason: 'expected a time, HH:MM' }), null);
const jobCheck = object(
  {
    nameKey: ref('string'),
    /** The task worked (Book 2 section 07); REST has none. */
    task: id(['TASK']),
    /** The camp stages it can be done at (raising the shelter: S0 only). */
    stages: arrayOf(oneOf(STAGES)),
    /**
     * Stage 11: open only while there is such work (the boat's repairs and fitting); the user's
     * third playtest (DG-12): the shelter's finishing, from 06:00 on the second day.
     */
    needs: oneOf(['SHIP_WORK', 'SHELTER_FINISH'] as const),
    spots: arrayOf(spotCheck),
    /**
     * Design addendum 2.5 (DF-21, item 8): where a seriously wounded worker does this job seated,
     * off the steerer's work spot (Runa at the boat with her ankle).
     */
    hurtSpots: arrayOf(spotCheck),
  },
  ['task', 'stages', 'needs', 'spots', 'hurtSpots'],
);
const householdCheck = object({
  about: text,
  home: ref('place'),
  schedule: arrayOf(object({ block: oneOf(SCHEDULE_BLOCKS), from: clock })),
  /** How long a tendency takes, in game minutes. */
  tendencyMinutes: int(5, 240),
  jobs: recordOf(oneOf(JOBS), jobCheck),
  places: recordOf(oneOf(TENDENCY_PLACES), spotCheck),
  seats: arrayOf(spotCheck),
  beds: object({ S0: arrayOf(spotCheck), S1: arrayOf(spotCheck) }),
  /** Each resident's first job, and the memories they join with (the wreck, Thorkel's death). */
  people: recordOf(
    id(['C']),
    object(
      {
        job: oneOf(JOBS),
        /** Stage 11: the jobs they take up, in order, when their own has no work. */
        then: arrayOf(oneOf(JOBS)),
        /**
         * The jobs they take up first while there is such work and the stores hold the day's food
         * (DG-12, DG-56: Hild finishes the shelter on the second day, unless she must fish).
         */
        first: arrayOf(oneOf(JOBS)),
        memories: arrayOf(
          object({ kind: oneOf(MEMORY_KINDS), about: text, day: int(1, 999), tie: bool }, [
            'day',
            'tie',
          ]),
        ),
      },
      ['then', 'first', 'memories'],
    ),
  ),
});
const lineWhen = {
  watch: oneOf(WATCH_NAMES),
  activity: oneOf(ACTIVITY_KINDS),
  voice: oneOf(VOICES),
  wounded: bool,
  grief: bool,
  season: oneOf(['Spring', 'Summer', 'Autumn', 'Winter'] as const),
  /** The user's fourth playtest (DH-20): said only while these hold (the facts of the story). */
  when: arrayOf(aimCondition),
};
const WHEN_KEYS = ['watch', 'activity', 'voice', 'wounded', 'grief', 'season', 'when'] as const;
const greetingCheck = object({ key: ref('string'), ...lineWhen }, WHEN_KEYS);
const barkCheck = object(
  { key: ref('string'), category: oneOf(BARK_CATEGORIES), ...lineWhen },
  WHEN_KEYS,
);
const speakerCheck = object({
  greetings: arrayOf(greetingCheck),
  barks: arrayOf(barkCheck),
  /** Book 8 section 11: each step of the warning flow, in order, and the other turns of feeling. */
  warnings: object({
    FRIENDSHIP: arrayOf(ref('string')),
    HAPPINESS: arrayOf(ref('string')),
    FEAR: ref('string'),
    DEVOTION: ref('string'),
    RISING: arrayOf(ref('string')),
  }),
  jobs: object({
    ACCEPT: ref('string'),
    REFUSE: ref('string'),
    REST: ref('string'),
    UNABLE: ref('string'),
  }),
  exit: ref('string'),
});
const choiceCheck = object(
  {
    key: ref('string'),
    reply: oneOf(REPLIES),
    /** TEND starts tending the speaker's wound; JOB:<job> gives them that job. */
    act: text,
    next: text,
    end: bool,
  },
  ['act', 'next', 'end'],
);
const topicCheck = object(
  {
    id: text,
    speaker: ref('person'),
    memory: oneOf(MEMORY_KINDS),
    /** WOUND: untended or tended. */
    state: oneOf(['UNTENDED', 'TENDED'] as const),
    /** DEED, DEATH and EVENT: what the memory is about. */
    about: text,
    season: oneOf(['Spring', 'Summer', 'Autumn', 'Winter'] as const),
    /** Offered only while this person is still missing (a worry). */
    missing: ref('person'),
    priority: int(0, 9),
    /** Pressing: the speaker comes to the steerer to raise it (Book 10 approachTiles). */
    pressing: bool,
    /** Offered whenever its other conditions hold, without resting (work, the season). */
    always: bool,
    labelKey: ref('string'),
    root: text,
    /** The user's fourth playtest (DH-20): offered only while these hold (the facts of the story). */
    when: arrayOf(aimCondition),
    /** Chosen, it opens these words instead of the topic's own (DH-22: Hild's father's rites). */
    opens: text,
  },
  ['state', 'about', 'season', 'missing', 'pressing', 'always', 'when', 'opens'],
);
const nodeCheck = object({ line: ref('string'), choices: arrayOf(choiceCheck) });
const talkCheck = object({
  about: text,
  people: recordOf(id(['C']), speakerCheck),
  topics: arrayOf(topicCheck),
  nodes: recordOf(text, nodeCheck),
});
const sceneChoiceCheck = object(
  {
    key: ref('string'),
    judgement: oneOf(JUDGEMENTS),
    /** The fact the outcome is remembered by. */
    outcome: text,
    /** The food goes back to the stores. */
    returned: bool,
    /** A reply kind for the thief (Book 10 "Conversation replies"). */
    reply: oneOf(REPLIES),
    /** A like of the thief this meets (being trusted with a job). */
    like: text,
    /** Take a side: whose. */
    favour: oneOf(['THIEF', 'FINDER'] as const),
    thief: (v, path, ctx) => (v === null ? '' : ref('string')(v, path, ctx)),
    reaction: recordOf(id(['C']), ref('string')),
  },
  ['reply', 'like', 'favour'],
);
const sceneCheck = object({
  id: id(['BEAT']),
  about: text,
  kind: oneOf(['THEFT'] as const),
  thief: ref('person'),
  trait: oneOf(TRAITS),
  /** Fires from this night in the household (Book 5: "on the second night"). */
  nightsInHousehold: int(1, 30),
  from: clock,
  until: clock,
  finders: arrayOf(ref('person')),
  open: recordOf(text, ref('string')),
  excuse: ref('string'),
  witness: recordOf(id(['C']), ref('string')),
  choices: arrayOf(sceneChoiceCheck),
});

/** Stage 10: Chapter 1's three searches and the Hag's Seat's sign (content/searches.json). */
const FACINGS4 = ['s', 'n', 'e', 'w'] as const;
const atFacing = object({ x: fraction(0, 512), y: fraction(0, 512), facing: oneOf(FACINGS4) });
const atId = object({
  id: text,
  x: fraction(0, 512),
  y: fraction(0, 512),
  facing: oneOf(FACINGS4),
});
const tileRect = object({ x0: int(0, 512), y0: int(0, 512), x1: int(0, 512), y1: int(0, 512) });
const point = arrayOf(fraction(0, 512));
export const SEARCH_ACTIONS = [
  'SNEAK',
  'FIGHT',
  'BARGAIN',
  'LEAVE',
  'OFFER_CONFESSION',
  'OFFER_SEAX',
  'OFFER_BOW',
  // Stage 11: the boat's fitting and the steering oar (content/repairs.json).
  'FIT_HOLD',
  'FIT_BOW',
  'UNSHIP',
  'CARVE',
  'TRADE_SILVER',
  'TRADE_FOOD',
  'RITES_SETTING',
  'RITES_SEA',
  // Stage 12: the launch's readiness screen, from looking the boat over.
  'LAUNCH',
  // Design addendum 2.4 (decision DE-21): where the steerer says Runa's tool chest is.
  'RUNA_FIRE',
  'RUNA_SHELTER',
  'RUNA_BOAT',
  // A reason for the first raid (DH-130 to DH-159): ask where they came from, take the skin
  // boat's goods, and the council's four intents (content/raid.json).
  ...RAID_ACTIONS,
] as const;
export const SEARCH_WHEN = [
  'UNSEEN',
  'CHEST_SAVED',
  'HAS_SEAX',
  'HAS_BOW',
  // Stage 11.
  'FIT_FREE',
  'HAS_HOLD',
  'HAS_BOW_PLATFORM',
  'CAN_CARVE',
  'HAS_FOOD',
  // Stage 12: the launch is open (its gate).
  'GATE_OPEN',
  // A reason for the first raid: the skin boat's goods still in it.
  ...RAID_WHEN,
] as const;
const searchTalkCheck = object({
  id: text,
  with: text,
  reachTiles: fraction(0.5, 4),
  promptKey: ref('string'),
  open: ref('string'),
  choices: arrayOf(
    object(
      {
        key: ref('string'),
        when: oneOf(SEARCH_WHEN),
        reply: arrayOf(ref('string')),
        do: oneOf(SEARCH_ACTIONS),
        once: bool,
      },
      ['when', 'reply', 'do', 'once'],
    ),
  ),
});
const omenCheck = object({
  id: id(['OMEN']),
  power: id(['POWER']),
  zone: ref('zone'),
  about: text,
  sign: object({ what: text, seen: text, tell: id(['SFX']), caption: ref('string') }),
  rule: object({ what: text, told: ref('string') }),
  response: arrayOf(object({ do: text, what: text })),
  consequence: object({ what: text, fact: text, power: id(['POWER']), report: ref('string') }),
});
const searchesCheck = object({
  about: text,
  opensAfter: text,
  beat: id(['BEAT']),
  tell: ref('string'),
  oddi: object({
    beat: id(['BEAT']),
    zone: ref('zone'),
    person: ref('person'),
    at: atFacing,
    wound: text,
    chest: atId,
    checkpoint: text,
    lines: recordOf(text, ref('string')),
    info: recordOf(text, ref('string')),
  }),
  bran: object({
    beat: id(['BEAT']),
    zone: ref('zone'),
    person: ref('person'),
    at: atFacing,
    body: atId,
    encounter: id(['SCN']),
    over: object({ x: fraction(0, 512), y: fraction(0, 512) }),
    away: arrayOf(point),
    leave: arrayOf(point),
    bier: object({
      zone: ref('zone'),
      x: fraction(0, 512),
      y: fraction(0, 512),
      facing: oneOf(FACINGS4),
    }),
    lines: recordOf(text, ref('string')),
  }),
  runa: object({
    beat: id(['BEAT']),
    zone: ref('zone'),
    person: ref('person'),
    at: atFacing,
    wound: text,
    tools: atId,
    stone: object({ x: fraction(0, 512), y: fraction(0, 512) }),
    neck: tileRect,
    safe: tileRect,
    checkpoint: text,
    lines: recordOf(text, ref('string')),
    info: recordOf(text, ref('string')),
  }),
  talks: arrayOf(searchTalkCheck),
  omens: arrayOf(omenCheck),
});

/** Stage 11: Chapter 1's repairs, the first fitting and Thorkel's rites (content/repairs.json). */
const tileXY = object({ x: fraction(0, 512), y: fraction(0, 512) });
const zoneSpot = object({
  zone: ref('zone'),
  x: fraction(0, 512),
  y: fraction(0, 512),
  facing: oneOf(FACINGS4),
});
const riteCheck = object({
  zone: ref('zone'),
  x: fraction(0, 512),
  y: fraction(0, 512),
  around: arrayOf(point),
});
const repairsCheck = object({
  about: text,
  opensAfter: text,
  beat: id(['BEAT']),
  customise: id(['BEAT']),
  hull: ref('hull'),
  boat: object({
    zone: ref('zone'),
    x: fraction(0, 512),
    y: fraction(0, 512),
    look: tileXY,
    work: tileXY,
    layByTiles: fraction(1, 12),
    spots: arrayOf(zoneSpot),
  }),
  boards: object({
    id: id(['ITEM']),
    zone: ref('zone'),
    x: fraction(0, 512),
    y: fraction(0, 512),
    facing: oneOf(FACINGS4),
  }),
  rigging: object({
    id: id(['ITEM']),
    zone: ref('zone'),
    tangle: tileXY,
    cut: tileXY,
    lies: atFacing,
  }),
  oar: object({
    id: id(['ITEM']),
    zone: ref('zone'),
    skiff: tileXY,
    take: tileXY,
    encounter: id(['SCN']),
    carver: ref('person'),
    carveSkill: text,
    carveLevel: int(0, 5),
  }),
  fittings: arrayOf(ref('fitting')),
  rites: object({
    beat: id(['BEAT']),
    recommends: ref('person'),
    guard: ref('person'),
    body: text,
    setting: riteCheck,
    sea: riteCheck,
    reachTiles: fraction(1, 20),
    lines: object({ setting: arrayOf(ref('string')), sea: arrayOf(ref('string')) }),
    /** Hild's last word as the ring of foam fades (the user's third playtest, DG-14). */
    seaTaken: ref('string'),
    info: recordOf(text, ref('string')),
  }),
  lines: recordOf(text, ref('string')),
  info: recordOf(text, ref('string')),
  talks: arrayOf(searchTalkCheck),
});

/** Stage 12: the launch, Chapter 1's gate (content/launch.json). */
const xy = object({ x: fraction(0, 640), y: fraction(0, 360) });
const launchCheck = object({
  about: text,
  gate: id(['BEAT']),
  chapter: id(['CH']),
  next: id(['CH']),
  kind: oneOf(['RAID', 'EXPEDITION', 'DEFENCE', 'COUNCIL', 'VOYAGE', 'BATTLE'] as const),
  opensWhen: arrayOf(text),
  typicalDay: int(1, 300),
  checkpoint: text,
  chapterSave: text,
  speaker: ref('person'),
  readiness: arrayOf(
    object({
      kind: oneOf(['CREW', 'SHIP', 'STORES', 'ALLIES', 'EQUIPMENT', 'OTHER'] as const),
      measure: oneOf([
        'BOAT',
        'TIDE',
        'CREW',
        'FOOD',
        'WEAPONS',
        'ALLIES',
        'RITES',
        'COUNCIL',
      ] as const),
      labelKey: ref('string'),
    }),
  ),
  pointOfNoReturnKey: ref('string'),
  weapons: arrayOf(id(['ITEM'])),
  push: object({
    dy: fraction(-4, 0),
    steerer: fraction(-4, 4),
    crew: arrayOf(fraction(-4, 4)),
    boardDy: fraction(-4, 0),
  }),
  scene: object({
    heaveSeconds: fraction(0.5, 10),
    boardStaggerSeconds: fraction(0.1, 3),
    hoistSeconds: fraction(0.5, 10),
    strokeSeconds: fraction(0.5, 3),
    settleSeconds: fraction(0, 5),
  }),
  drawnUp: object({ steerer: atFacing, crew: arrayOf(point) }),
  lines: recordOf(text, ref('string')),
  info: recordOf(text, ref('string')),
  names: object({
    maxLength: int(8, 40),
    defaultKey: ref('string'),
    suggestions: arrayOf(ref('string')),
  }),
  marks: object({
    patterns: arrayOf(object({ key: text, nameKey: ref('string'), dyed: bool })),
    dyes: arrayOf(object({ key: text, nameKey: ref('string') })),
    likeness: arrayOf(object({ pattern: text, dye: text, noteKey: ref('string') }, ['dye'])),
  }),
  seaMap: object({
    rumoured: arrayOf(ref('place')),
    smoke: ref('place'),
    home: ref('place'),
    places: recordOf(ref('place'), xy),
    hazards: recordOf(ref('hazard'), xy),
  }),
});

type Out<C> = C extends Check<infer T> ? T : never;
export type LaunchDef = Out<typeof launchCheck>;
export type HouseholdDef = Out<typeof householdCheck>;
export type TalkDef = Out<typeof talkCheck>;
export type SpeakerDef = Out<typeof speakerCheck>;
export type TopicDef = Out<typeof topicCheck>;
export type TalkNode = Out<typeof nodeCheck>;
export type ChoiceDef = Out<typeof choiceCheck>;
export type SceneDef = Out<typeof sceneCheck>;
export type SceneChoiceDef = Out<typeof sceneChoiceCheck>;
export type JobDef = Out<typeof jobCheck>;
export type Spot = Out<typeof spotCheck>;
export type TraitDef = Out<typeof traitCheck>;
export type LikingDef = Out<typeof likingCheck>;
export type TendencyDef = Out<typeof tendencyCheck>;
export type OnFootDef = Out<typeof onFootCheck>;
export type CombatDef = Out<typeof combatCheck>;
export type SearchesDef = Out<typeof searchesCheck>;
export type SearchTalkDef = SearchesDef['talks'][number];
export type RepairsDef = Out<typeof repairsCheck>;
export type OmenDef = SearchesDef['omens'][number];
export type FighterDef = Out<typeof fighterCheck>;
export type EncounterDef = Out<typeof encounterCheck>;
export type OpeningDef = Out<typeof openingCheck>;
export type CampDef = Out<typeof campCheck>;
export type TaskDef = Out<typeof taskCheck>;
export type CampSite = Out<typeof siteCheck>;
export type CueDef = Out<typeof cueCheck>;
export type AudioTable = Out<typeof audioCheck>;
export type PlaceDef = Out<typeof placeCheck>;
export type HazardDef = Out<typeof hazardCheck>;
export type RegionDef = Out<typeof regionCheck>;
export type PersonDef = Out<typeof personCheck>;
export type FactionDef = Out<typeof factionCheck>;
export type HullDef = Out<typeof hullCheck>;
export type FittingDef = Out<typeof fittingCheck>;

export interface Content {
  readonly ids: IdRegistry;
  readonly strings: StringTable;
  readonly balance: unknown;
  readonly places: ReadonlyMap<Id, PlaceDef>;
  readonly hazards: ReadonlyMap<Id, HazardDef>;
  readonly regions: ReadonlyMap<Id, RegionDef>;
  readonly zones: ReadonlyMap<Id, RegionDef['zones'][number] & { readonly region: Id }>;
  readonly people: ReadonlyMap<Id, PersonDef>;
  readonly factions: ReadonlyMap<Id, FactionDef>;
  readonly hulls: ReadonlyMap<Id, HullDef>;
  readonly fittings: ReadonlyMap<Id, FittingDef>;
  readonly audio: AudioTable | null;
  readonly cues: ReadonlyMap<Id, CueDef>;
  readonly onFoot: OnFootDef | null;
  readonly opening: OpeningDef | null;
  readonly camp: CampDef | null;
  readonly household: HouseholdDef | null;
  readonly talk: TalkDef | null;
  readonly scenes: readonly SceneDef[];
  /** Stage 9: weapons, fighters, encounters, safe places and barks. */
  readonly combat: CombatDef | null;
  /** Stage 10: Chapter 1's three searches and the Hag's Seat's sign. */
  readonly searches: SearchesDef | null;
  /** Stage 11: Chapter 1's repairs, the first fitting and Thorkel's rites. */
  readonly repairs: RepairsDef | null;
  /** Stage 12: the launch, Chapter 1's gate. */
  readonly launch: LaunchDef | null;
  /** The user's fourth playtest (DH-40 onwards): hours, bindings, talk, the boat; guidance. */
  readonly company: CompanyDef | null;
  /** The user's fourth playtest: Chapter 1's small finds off the paths (DH-115). */
  readonly finds: FindsDef | null;
  /** Stage 14: the island's puzzles, secrets, the drowned and the side aims (content/puzzles.json). */
  readonly puzzles: PuzzlesDef | null;
  /** Stage 14: the resource nodes, discovery marks and the region map's layout (content/island.json). */
  readonly island: IslandDef | null;
  readonly guidance: GuidanceDef | null;
  /** A reason for the first raid (DH-130 to DH-159). */
  readonly raid: RaidDef | null;
  /** Stage 13: the sea map (Book 2 section 09). */
  readonly sea: SeaDef | null;
  /** Stage 13, work package C: the wreck on Sgeir Dhubh (Book 6 section 19). */
  readonly wreck: WreckDef | null;
  readonly zoneMaps: ReadonlyMap<Id, ZoneMap>;
}

function balanceRows(
  balance: unknown,
  section: string,
  table: string,
  column: string,
): Set<string> {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const rows = tables?.[section]?.[table];
  if (!Array.isArray(rows)) return new Set();
  return new Set(rows.map((r) => String((r as Record<string, unknown>)[column])));
}

function balanceTable(balance: unknown, section: string, table: string): Record<string, unknown>[] {
  const tables = (balance as { tables?: Record<string, Record<string, unknown>> } | null)?.tables;
  const rows = tables?.[section]?.[table];
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function toMap<T extends { id: Id }>(
  items: readonly T[] | null,
  file: string,
  issues: Issue[],
): Map<Id, T> {
  const map = new Map<Id, T>();
  (items ?? []).forEach((item, i) => {
    if (map.has(item.id))
      issues.push({ file, path: `[${i}].id`, reason: `"${item.id}" is defined twice` });
    map.set(item.id, item);
  });
  return map;
}

/** Validates every content file and resolves every reference. Usable only with no issues. */
export function loadContent(files: ContentFiles): { content: Content; issues: Issue[] } {
  const issues: Issue[] = [];
  const refs: Ref[] = [];
  const ctx = (file: string): Ctx => ({ file, issues, refs });

  const { registry: ids, problems } = parseIdRegistry(files.ids);
  for (const reason of problems)
    issues.push({ file: CONTENT_FILES.ids, path: '(registry)', reason });
  let strings: StringTable = new Map();
  try {
    strings = parseStringTable(files.strings, CONTENT_FILES.strings);
  } catch (error) {
    issues.push({ file: CONTENT_FILES.strings, path: '(root)', reason: (error as Error).message });
  }

  const places = toMap(
    arrayOf(placeCheck)(files.places, '', ctx(CONTENT_FILES.places)),
    CONTENT_FILES.places,
    issues,
  );
  const hazards = toMap(
    arrayOf(hazardCheck)(files.hazards, '', ctx(CONTENT_FILES.hazards)),
    CONTENT_FILES.hazards,
    issues,
  );
  const regionList = arrayOf(regionCheck)(files.regions, '', ctx(CONTENT_FILES.regions));
  const regions = toMap(regionList, CONTENT_FILES.regions, issues);
  const zones = new Map<Id, RegionDef['zones'][number] & { region: Id }>();
  for (const region of regionList ?? [])
    for (const zone of region.zones) zones.set(zone.id, { ...zone, region: region.id });
  const people = toMap(
    arrayOf(personCheck)(files.people, '', ctx(CONTENT_FILES.people)),
    CONTENT_FILES.people,
    issues,
  );
  const factions = toMap(
    arrayOf(factionCheck)(files.factions, '', ctx(CONTENT_FILES.factions)),
    CONTENT_FILES.factions,
    issues,
  );
  const hulls = toMap(
    arrayOf(hullCheck)(files.hulls, '', ctx(CONTENT_FILES.hulls)),
    CONTENT_FILES.hulls,
    issues,
  );
  const fittings = toMap(
    arrayOf(fittingCheck)(files.fittings, '', ctx(CONTENT_FILES.fittings)),
    CONTENT_FILES.fittings,
    issues,
  );

  const audio = audioCheck(files.audio, '', ctx(CONTENT_FILES.audio));
  const cues = toMap(audio?.cues ?? null, CONTENT_FILES.audio, issues);
  (audio?.cues ?? []).forEach((cue, i) => {
    const at = (field: string) => `cues[${i}].${field}`;
    const need = (field: keyof CueDef, why: string) => {
      if (cue[field] === undefined)
        issues.push({
          file: CONTENT_FILES.audio,
          path: at(field),
          reason: `${cue.kind} cues need ${why}`,
        });
    };
    if (cue.kind === 'music') {
      need('bpm', 'a tempo');
      need('beatsPerBar', 'a bar length');
      need('stems', 'stems');
    }
    if (cue.kind === 'stinger') need('lengthBeats', 'a length');
    if (cue.kind === 'sfx') need('bus', 'a bus');
    // Book 11 section 09: a caption for every gameplay-relevant sound.
    // Design addendum 2.5 (DF-80): a combat sound is never captioned; its drawn twin stands in.
    if (cue.kind !== 'ambience' && cue.drawn === undefined)
      need('captionKey', 'a caption (Book 11 section 09)');
  });
  for (const [event, cue] of Object.entries(audio?.events ?? {})) {
    if (!cues.has(cue))
      issues.push({
        file: CONTENT_FILES.audio,
        path: `events.${event}`,
        reason: `unknown cue "${cue}"`,
      });
  }

  // Book 8 section 03: no gendered word to or about the steerer.
  for (const [key, entry] of strings) {
    for (const reason of steererWordingProblems(entry.text, entry.tags))
      issues.push({ file: CONTENT_FILES.strings, path: key, reason });
    // Design addendum 2.3 section 10: speech and information captions.
    for (const reason of captionProblems(key, entry))
      issues.push({ file: CONTENT_FILES.strings, path: key, reason });
    // Design addendum 2.3 section 2: no modern moral vocabulary in dialogue.
    if (isDialogueKey(key))
      for (const word of modernMoralWordsIn(entry.text))
        issues.push({
          file: CONTENT_FILES.strings,
          path: key,
          reason: `dialogue uses the modern word "${word}" (Book 8: speak in period terms)`,
        });
  }

  const onFoot = onFootCheck(files.onFoot, '', ctx(CONTENT_FILES.onFoot));
  const opening = openingCheck(files.opening, '', ctx(CONTENT_FILES.opening));
  // Book 8 section 13 (decision DE-24): every Chapter 1 aim has a journal line and two hints.
  (opening?.aims ?? []).forEach((a, i) => {
    if (a.hints.length !== 2)
      issues.push({
        file: CONTENT_FILES.opening,
        path: `aims[${i}].hints`,
        reason: `aim "${a.id}" has ${a.hints.length} hints; Book 8 section 13 gives each two`,
      });
  });
  const camp = campCheck(files.camp, '', ctx(CONTENT_FILES.camp));
  const household = householdCheck(files.household, '', ctx(CONTENT_FILES.household));
  const talk = talkCheck(files.talk, '', ctx(CONTENT_FILES.talk));
  const scenes = arrayOf(sceneCheck)(files.scenes, '', ctx(CONTENT_FILES.scenes)) ?? [];
  const combat = combatCheck(files.combat, '', ctx(CONTENT_FILES.combat));
  const searches = searchesCheck(files.searches, '', ctx(CONTENT_FILES.searches));
  const repairs = repairsCheck(files.repairs, '', ctx(CONTENT_FILES.repairs));
  const launch = launchCheck(files.launch, '', ctx(CONTENT_FILES.launch));
  const company = parseCompany(files.company, '', ctx(CONTENT_FILES.company));
  const finds = parseFinds(files.finds, '', ctx(CONTENT_FILES.finds));
  const puzzles = parsePuzzles(files.puzzles, '', ctx(CONTENT_FILES.puzzles));
  const island = parseIsland(files.island, '', ctx(CONTENT_FILES.island));
  // Stage 14: every puzzle state, collectible and find a condition names is defined.
  for (const p of islandProblems(
    puzzles,
    finds?.collectibles ?? [],
    new Set((finds?.finds ?? []).map((f) => f.key)),
  ))
    issues.push({ file: CONTENT_FILES.puzzles, ...p });
  const guidance = parseGuidance(files.guidance, '', ctx(CONTENT_FILES.guidance));
  const raid = parseRaid(files.raid, '', ctx(CONTENT_FILES.raid));
  const sea = parseSea(files.sea, '', ctx(CONTENT_FILES.sea));
  const wreck = parseWreck(files.wreck, '', ctx(CONTENT_FILES.wreck));
  issues.push(...companyProblems(company, guidance, opening, talk));
  // Stage 10: every omen declares its four parts (Book 2 section 17; Book 4 section 07).
  searches?.omens.forEach((o, i) => {
    for (const part of ['sign', 'rule', 'response', 'consequence'] as const) {
      const v = o[part];
      if (Array.isArray(v) && v.length === 0)
        issues.push({
          file: CONTENT_FILES.searches,
          path: `omens[${i}].${part}`,
          reason:
            'every dangerous supernatural mechanic declares sign, rule, response and consequence',
        });
    }
  });
  // Stage 9: an encounter's member at work works a camp task (its loop is drawn).
  combat?.encounters.forEach((enc, i) => {
    enc.members.forEach((m, j) => {
      if (m.task !== undefined && camp?.tasks[m.task] === undefined)
        issues.push({
          file: CONTENT_FILES.combat,
          path: `encounters[${i}].members[${j}].task`,
          reason: `unknown camp task "${m.task}"`,
        });
    });
  });
  const zoneMaps = new Map<Id, ZoneMap>();
  const strand = checkZoneMap(files.zoneStrand);
  for (const [file, json] of [
    [CONTENT_FILES.zoneStrand, files.zoneStrand],
    [CONTENT_FILES.zoneMachair, files.zoneMachair],
    [CONTENT_FILES.zoneHagseat, files.zoneHagseat],
    [CONTENT_FILES.zoneCairn, files.zoneCairn],
    [CONTENT_FILES.zoneSealcave, files.zoneSealcave],
    [CONTENT_FILES.zoneSeaWreck, files.zoneSeaWreck],
    [CONTENT_FILES.zoneGeo, files.zoneGeo],
    [CONTENT_FILES.zoneSkerry, files.zoneSkerry],
    [CONTENT_FILES.zoneNaust, files.zoneNaust],
  ] as const) {
    const checked = checkZoneMap(json);
    for (const reason of checked.problems) issues.push({ file, path: '(map)', reason });
    if (checked.map === null) continue;
    zoneMaps.set(checked.map.zone, checked.map);
    if (!zones.has(checked.map.zone))
      issues.push({ file, path: 'zone', reason: `unknown zone "${checked.map.zone}"` });
    for (const who of Object.keys(checked.map.spawns)) {
      if (who !== 'P_STEERER' && !people.has(who))
        issues.push({ file, path: `spawns.${who}`, reason: `unknown person "${who}"` });
    }
  }
  // Every link leads to a zone with a map, which links back (Book 2 section 10, FootLink).
  for (const map of zoneMaps.values()) {
    for (const link of map.links ?? []) {
      const back = zoneMaps.get(link.to)?.links?.some((l) => l.to === map.zone) ?? false;
      if (!back)
        issues.push({
          file: `content/zones/${map.zone.toLowerCase()}.json`,
          path: `links.${link.edge}`,
          reason: `${link.to} has no map that links back to ${map.zone}`,
        });
    }
  }
  if (camp !== null) {
    for (const task of Object.keys(camp.tasks))
      if (!ids.byId.has(task))
        issues.push({
          file: CONTENT_FILES.camp,
          path: `tasks.${task}`,
          reason: `"${task}" is not in the ID registry (${CONTENT_FILES.ids})`,
        });
    const taskRows = balanceRows(
      files.balance,
      'buildingsToolsAndCrafting',
      'homesteadTasksTimeAndStamina',
      'Task',
    );
    // The driftwood pick-up's cost is Book 10's "Driftwood finds" (decision PT-2).
    taskRows.add('Driftwood finds');
    for (const [task, def] of Object.entries(camp.tasks)) {
      if (!taskRows.has(def.balanceRow))
        issues.push({
          file: CONTENT_FILES.camp,
          path: `tasks.${task}.balanceRow`,
          reason: `Book 10 section 09 has no task "${def.balanceRow}"`,
        });
      if (def.tool !== undefined && onFoot !== null && onFoot.items[def.tool] === undefined)
        issues.push({
          file: CONTENT_FILES.camp,
          path: `tasks.${task}.tool`,
          reason: `"${def.tool}" has no entry in ${CONTENT_FILES.onFoot} items`,
        });
    }
    if (!zoneMaps.has(camp.zone))
      issues.push({ file: CONTENT_FILES.camp, path: 'zone', reason: `no map for ${camp.zone}` });
  }
  if (onFoot !== null) {
    onFoot.hotbar.start.forEach((item, i) => {
      if (onFoot.items[item] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `hotbar.start[${i}]`,
          reason: `"${item}" has no entry in items`,
        });
    });
    onFoot.pickups.forEach((p, i) => {
      // A count from Book 10 is combat v2's carried count (bindings), which has no hotbar entry.
      if (p.countFrom !== undefined && !PICKUP_COUNTS.includes(p.countFrom))
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `pickups[${i}].countFrom`,
          reason: `"${p.countFrom}" is not a Book 10 count a pickup can take (${PICKUP_COUNTS.join(', ')})`,
        });
      else if (p.countFrom === undefined && onFoot.items[p.item] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `pickups[${i}].item`,
          reason: `"${p.item}" has no entry in items`,
        });
    });
    for (const [item, def] of Object.entries(onFoot.items))
      if (def.ammo !== undefined && onFoot.items[def.ammo] === undefined)
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `items.${item}.ammo`,
          reason: `"${def.ammo}" has no entry in items`,
        });
    for (const item of Object.keys(onFoot.items))
      if (!ids.byId.has(item))
        issues.push({
          file: CONTENT_FILES.onFoot,
          path: `items.${item}`,
          reason: `"${item}" is not in the ID registry (${CONTENT_FILES.ids})`,
        });
  }
  if (opening !== null && !ids.byId.has(opening.beat))
    issues.push({
      file: CONTENT_FILES.opening,
      path: 'beat',
      reason: `"${opening.beat}" is not in the ID registry (${CONTENT_FILES.ids})`,
    });
  if (opening !== null && strand.map !== null && strand.map.spawns[opening.caller] === undefined)
    issues.push({
      file: CONTENT_FILES.opening,
      path: 'caller',
      reason: `${opening.caller} has no spawn in ${opening.zone}`,
    });

  issues.push(...peopleProblems(people, ids, camp, household, talk, scenes));

  const hullRows = balanceRows(files.balance, 'shipStatisticsAndCosts', 'hulls', 'Hull');
  const fittingRows = balanceRows(files.balance, 'shipStatisticsAndCosts', 'fittings', 'Fitting');
  const known: Record<RefKind, (id: string) => boolean> = {
    place: (x) => places.has(x),
    hazard: (x) => hazards.has(x),
    region: (x) => regions.has(x),
    zone: (x) => zones.has(x),
    person: (x) => people.has(x),
    faction: (x) => factions.has(x),
    hull: (x) => hulls.has(x),
    fitting: (x) => fittings.has(x),
    string: (x) => strings.has(x),
    'balance:hull': (x) => hullRows.has(x),
    'balance:fitting': (x) => fittingRows.has(x),
  };
  const noun: Record<RefKind, string> = {
    place: 'place',
    hazard: 'hazard',
    region: 'region',
    zone: 'zone',
    person: 'person',
    faction: 'faction',
    hull: 'hull',
    fitting: 'fitting',
    string: 'string key',
    'balance:hull': 'Book 10 hull row',
    'balance:fitting': 'Book 10 fitting row',
  };
  for (const r of refs) {
    if (!known[r.kind](r.id))
      issues.push({ file: r.file, path: r.path, reason: `unknown ${noun[r.kind]} "${r.id}"` });
  }

  // Stage 13: the sea map agrees with Book 10's routes and weights, the chart and the registry.
  if (sea !== null) {
    const routeRows = new Map<string, { tideGateSlack: boolean }>();
    for (const r of balanceTable(files.balance, 'timeAndTravel', 'routes'))
      routeRows.set(String(r['ID']), { tideGateSlack: r['Notes'] === 'Tide gate: slack only' });
    const weights = new Map<string, Set<string>>();
    for (const r of balanceTable(files.balance, 'timeAndTravel', 'encounterWeights')) {
      const t = String(r['Table']);
      weights.set(t, (weights.get(t) ?? new Set<string>()).add(String(r['Encounter'])));
    }
    for (const p of seaProblems(sea, {
      places: new Set(places.keys()),
      hazards: new Set(hazards.keys()),
      chart: {
        places: new Set(Object.keys(launch?.seaMap.places ?? {})),
        hazards: new Set(Object.keys(launch?.seaMap.hazards ?? {})),
      },
      registered: (x) => ids.byId.has(x),
      routes: routeRows,
      weights,
    }))
      issues.push({ file: CONTENT_FILES.sea, path: p.path, reason: p.reason });
  }

  // Stage 13, work package C: the wreck agrees with the registry and Book 10's survivors.
  if (wreck !== null) {
    const survivors = Number(
      balanceTable(files.balance, 'timeAndTravel', 'theWreckWithSurvivors').find(
        (r) => r['Key'] === 'survivors',
      )?.['Value'] ?? NaN,
    );
    for (const p of wreckProblems(wreck, { registered: (x) => ids.byId.has(x), survivors }))
      issues.push({ file: CONTENT_FILES.wreck, path: p.path, reason: p.reason });
  }

  // Every content ID is a registered, stable ID.
  const defined: [string, Map<Id, { id: Id }>][] = [
    [CONTENT_FILES.places, places],
    [CONTENT_FILES.hazards, hazards],
    [CONTENT_FILES.regions, regions],
    [CONTENT_FILES.regions, zones],
    [CONTENT_FILES.people, people],
    [CONTENT_FILES.factions, factions],
    [CONTENT_FILES.hulls, hulls],
    [CONTENT_FILES.fittings, fittings],
    [CONTENT_FILES.audio, cues],
  ];
  for (const [file, map] of defined) {
    for (const key of map.keys()) {
      if (!ids.byId.has(key))
        issues.push({
          file,
          path: key,
          reason: `"${key}" is not in the ID registry (${CONTENT_FILES.ids})`,
        });
    }
  }

  // People: the ID prefix matches the kind, and ties go both ways.
  [...people.values()].forEach((p, i) => {
    const expected = KIND_PREFIX[p.kind];
    if (!p.id.startsWith(`${expected}_`)) {
      issues.push({
        file: CONTENT_FILES.people,
        path: `[${i}].kind`,
        reason: `a ${p.kind} needs an ID starting ${expected}_`,
      });
    }
    (p.ties ?? []).forEach((tie, t) => {
      const back =
        people.get(tie.to)?.ties?.some((b) => b.to === p.id && b.kind === tie.kind) ?? false;
      if (people.has(tie.to) && !back) {
        issues.push({
          file: CONTENT_FILES.people,
          path: `[${i}].ties[${t}]`,
          reason: `${tie.to} has no matching ${tie.kind} tie back to ${p.id}`,
        });
      }
    });
  });

  return {
    content: {
      ids,
      strings,
      balance: files.balance,
      places,
      hazards,
      regions,
      zones,
      people,
      factions,
      hulls,
      fittings,
      audio,
      cues,
      onFoot,
      opening,
      camp,
      household,
      talk,
      scenes,
      combat,
      searches,
      repairs,
      launch,
      company,
      guidance,
      finds,
      puzzles,
      island,
      raid,
      sea,
      wreck,
      zoneMaps,
    },
    issues,
  };
}

export function formatIssue(issue: Issue): string {
  return `${issue.file}: ${issue.path}: ${issue.reason}`;
}

/** Validates the audio table on its own (the browser bundles it without the other content). */
export function parseAudioTable(json: unknown): AudioTable {
  const issues: Issue[] = [];
  const audio = audioCheck(json, '', { file: CONTENT_FILES.audio, issues, refs: [] });
  if (audio === null || issues.length > 0) {
    throw new Error(
      `${CONTENT_FILES.audio}: ${issues.map((i) => `${i.path}: ${i.reason}`).join('; ')}`,
    );
  }
  return audio;
}

/**
 * The fourth playtest's people content (DH-40 onwards): every aim named has a definition, every
 * refuser's talk node exists, and every exchange's lines name one of its speakers.
 */
function companyProblems(
  company: CompanyDef | null,
  guidance: GuidanceDef | null,
  opening: OpeningDef | null,
  talk: TalkDef | null,
): Issue[] {
  const out: Issue[] = [];
  const aims = new Set((opening?.aims ?? []).map((a) => a.id));
  for (const aim of Object.keys(guidance?.nudges ?? {}))
    if (!aims.has(aim))
      out.push({ file: CONTENT_FILES.guidance, path: `nudges.${aim}`, reason: 'no such aim' });
  company?.care.refusers.forEach((r, i) => {
    if (talk !== null && talk.nodes[r.node] === undefined)
      out.push({
        file: CONTENT_FILES.company,
        path: `care.refusers[${i}].node`,
        reason: `no talk node "${r.node}"`,
      });
  });
  company?.exchanges.forEach((e, i) => {
    if (e.speakers.length < 2 || e.speakers.length > 3)
      out.push({
        file: CONTENT_FILES.company,
        path: `exchanges[${i}].speakers`,
        reason: 'an exchange has two or three speakers',
      });
    e.lines.forEach((l, j) => {
      if (l.by >= e.speakers.length)
        out.push({
          file: CONTENT_FILES.company,
          path: `exchanges[${i}].lines[${j}].by`,
          reason: 'names no speaker of the exchange',
        });
    });
  });
  return out;
}

/** The people's content (Stage 8): every reference between people, jobs, talk and scenes. */
function peopleProblems(
  people: ReadonlyMap<Id, PersonDef>,
  ids: IdRegistry,
  camp: CampDef | null,
  household: HouseholdDef | null,
  talk: TalkDef | null,
  scenes: readonly SceneDef[],
): Issue[] {
  const out: Issue[] = [];
  const PEOPLE_FILE = CONTENT_FILES.people;
  [...people.values()].forEach((p, i) => {
    const traits = p.traits ?? [];
    if (p.kind === 'RESIDENT' && (traits.length < 2 || traits.length > 4))
      out.push({
        file: PEOPLE_FILE,
        path: `[${i}].traits`,
        reason: `a resident has two to four traits (Book 5 section 17), not ${traits.length}`,
      });
    traits.forEach((t, k) => {
      if ((t.trait === 'PIOUS') !== (t.faith !== undefined))
        out.push({
          file: PEOPLE_FILE,
          path: `[${i}].traits[${k}]`,
          reason: 'PIOUS names its faith, and only PIOUS does',
        });
    });
    if ((p.codes?.length ?? 1) > 2 || p.codes?.length === 0)
      out.push({ file: PEOPLE_FILE, path: `[${i}].codes`, reason: 'one code, or two' });
    for (const [which, list] of [
      ['likes', p.likes ?? []],
      ['dislikes', p.dislikes ?? []],
    ] as const)
      list.forEach((l, k) => {
        const looksLikeId = /^(RES|TASK|ITEM|C|L|R|E|H|ZONE|SK|MAIN)_/.test(l.ref);
        if (looksLikeId && !ids.byId.has(l.ref) && !people.has(l.ref))
          out.push({
            file: PEOPLE_FILE,
            path: `[${i}].${which}[${k}].ref`,
            reason: `"${l.ref}" is not in the ID registry`,
          });
      });
  });
  if (household !== null) {
    for (const [job, def] of Object.entries(household.jobs))
      if (def.task !== undefined && camp !== null && camp.tasks[def.task] === undefined)
        out.push({
          file: CONTENT_FILES.household,
          path: `jobs.${job}.task`,
          reason: `"${def.task}" is not a task of ${CONTENT_FILES.camp}`,
        });
    for (const id of Object.keys(household.people))
      if (!people.has(id))
        out.push({ file: CONTENT_FILES.household, path: `people.${id}`, reason: 'no such person' });
  }
  if (talk !== null) {
    const nodes = new Set(Object.keys(talk.nodes));
    talk.topics.forEach((t, i) => {
      if (!nodes.has(t.root))
        out.push({
          file: CONTENT_FILES.talk,
          path: `topics[${i}].root`,
          reason: `no node "${t.root}"`,
        });
    });
    for (const [nid, node] of Object.entries(talk.nodes))
      node.choices.forEach((c, k) => {
        const at = `nodes.${nid}.choices[${k}]`;
        if (c.next !== undefined && !nodes.has(c.next))
          out.push({ file: CONTENT_FILES.talk, path: `${at}.next`, reason: `no node "${c.next}"` });
        const act = c.act;
        // TEND_PERSUADED: a refused binding taken up again on the refuser's own terms (DH-42).
        if (act !== undefined && act !== 'TEND' && act !== 'TEND_PERSUADED') {
          const job = /^JOB:([A-Z]+)$/.exec(act)?.[1];
          if (job === undefined || household?.jobs[job as (typeof JOBS)[number]] === undefined)
            out.push({
              file: CONTENT_FILES.talk,
              path: `${at}.act`,
              reason: `unknown act "${act}"`,
            });
        }
      });
    for (const id of Object.keys(talk.people))
      if (!people.has(id))
        out.push({ file: CONTENT_FILES.talk, path: `people.${id}`, reason: 'no such person' });
  }
  scenes.forEach((sc, i) => {
    if (!ids.byId.has(sc.id))
      out.push({
        file: CONTENT_FILES.scenes,
        path: `[${i}].id`,
        reason: `"${sc.id}" is not in the ID registry (${CONTENT_FILES.ids})`,
      });
    if (sc.open['none'] === undefined)
      out.push({ file: CONTENT_FILES.scenes, path: `[${i}].open.none`, reason: 'missing' });
    for (const f of sc.finders)
      if (sc.open[f] === undefined || sc.witness[f] === undefined)
        out.push({
          file: CONTENT_FILES.scenes,
          path: `[${i}].finders`,
          reason: `${f} has no opening and witness line`,
        });
  });
  return out;
}
