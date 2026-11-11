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
  zoneStrand: 'content/zones/zone_sk_strand.json',
  zoneMachair: 'content/zones/zone_sk_machair.json',
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
export const JOBS = ['FISHER', 'CAMP', 'DRIFTWOOD', 'BUILDER', 'REST'] as const;
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
export const MEMORY_KINDS = ['WOUND', 'DEATH', 'DEED', 'EVENT', 'JOB', 'SEASON', 'CARE'] as const;
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
    temporary: bool,
    piece: oneOf(['hearth', 'skarvholm', 'raid'] as const),
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
  },
  ['home'],
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
    use: oneOf(['AIM', 'MELEE', 'TOOL', 'AMMO'] as const),
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
  },
  ['quiver', 'after', 'glint'],
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
const MELEE_ROWS = ['Spear', 'Axe', 'Sword', 'Seax', 'Dane axe'] as const;
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
  },
  ['shield', 'bow', 'heavy', 'leader', 'finishesDowned'],
);
const crewArmsCheck = object(
  { weapon: id(['ITEM']), shield: bool, bow: bool, heavy: bool },
  ['weapon', 'shield', 'bow', 'heavy'],
);
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
  ['after'],
);
const safePlaceCheck = object({
  key: text,
  about: text,
  zone: ref('zone'),
  x: fraction(0, 512),
  y: fraction(0, 512),
  r: fraction(0.5, 40),
});
const combatCheck = object({
  about: text,
  weapons: recordOf(id(['ITEM']), combatWeaponCheck),
  fighters: arrayOf(fighterCheck),
  crew: recordOf(text, crewArmsCheck),
  encounters: arrayOf(encounterCheck),
  safePlaces: arrayOf(safePlaceCheck),
  barks: recordOf(ref('person'), recordOf(text, arrayOf(ref('string')))),
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
  /** Once she is safe, Hild names the bow in the wreck's stern, after this many seconds. */
  bowLine: ref('string'),
  bowLineSeconds: int(0, 60),
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
    /** The task's row in Book 10 section 09, "Homestead tasks: time and stamina". */
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
  },
  ['stages'],
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
const campCheck = object({
  about: text,
  home: ref('place'),
  zone: ref('zone'),
  beat: id(['BEAT']),
  shelter: object({ building: id(['BLD']), balanceRow: text }),
  sleepSeconds: fraction(0, 10),
  tasks: recordOf(id(['TASK']), taskCheck),
  sites: arrayOf(siteCheck),
  props: object({ S0: arrayOf(campPropCheck), S1: arrayOf(campPropCheck) }),
  woodpile: placeAt,
  people: recordOf(id(['C']), campPersonCheck),
  lines: recordOf(text, ref('string')),
  leadAfterSeconds: int(0, 60),
});

const spotCheck = object({
  zone: ref('zone'),
  x: fraction(0, 512),
  y: fraction(0, 512),
  facing: oneOf(['s', 'n', 'e', 'w'] as const),
});
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
    spots: arrayOf(spotCheck),
  },
  ['task', 'stages', 'spots'],
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
        memories: arrayOf(
          object({ kind: oneOf(MEMORY_KINDS), about: text, day: int(1, 999), tie: bool }, [
            'day',
            'tie',
          ]),
        ),
      },
      ['memories'],
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
};
const WHEN_KEYS = ['watch', 'activity', 'voice', 'wounded', 'grief', 'season'] as const;
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
  },
  ['state', 'about', 'season', 'missing', 'pressing', 'always'],
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

type Out<C> = C extends Check<infer T> ? T : never;
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
    if (cue.kind !== 'ambience') need('captionKey', 'a caption (Book 11 section 09)');
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
  const camp = campCheck(files.camp, '', ctx(CONTENT_FILES.camp));
  const household = householdCheck(files.household, '', ctx(CONTENT_FILES.household));
  const talk = talkCheck(files.talk, '', ctx(CONTENT_FILES.talk));
  const scenes = arrayOf(sceneCheck)(files.scenes, '', ctx(CONTENT_FILES.scenes)) ?? [];
  const combat = combatCheck(files.combat, '', ctx(CONTENT_FILES.combat));
  const zoneMaps = new Map<Id, ZoneMap>();
  const strand = checkZoneMap(files.zoneStrand);
  for (const [file, json] of [
    [CONTENT_FILES.zoneStrand, files.zoneStrand],
    [CONTENT_FILES.zoneMachair, files.zoneMachair],
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
      if (onFoot.items[p.item] === undefined)
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
        if (act !== undefined && act !== 'TEND') {
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
