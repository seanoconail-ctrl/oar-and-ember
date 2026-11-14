/**
 * The user's fourth playtest, request 24 ("Most areas get one or two more points of interest, off
 * the obvious path"; decisions DH-115 to DH-121): `content/finds.json`, the small finds of
 * Skarvholm's Chapter 1 zones. Each lies off the obvious path, is drawn as a prop of its own
 * (`prop_finds`), and is looked at, read or taken with Interact: its sound plays and its
 * information caption shows, and what it gives (eggs for the stores, silver, a collectible, or only
 * its story) is Book 10's (section 20, "Chapter 1 finds"), read by src/content/findsBalance.ts.
 */
import { parseCollectibles } from './islandSchema.ts';
import { arrayOf, bool, object, oneOf, ref, text } from './schema.ts';
import type { Check } from './schema.ts';

type Out<C> = C extends Check<infer T> ? T : never;

const tiles: Check<number> = (v, path, ctx) =>
  typeof v === 'number' && v >= 0 && v <= 512
    ? v
    : (ctx.issues.push({ file: ctx.file, path, reason: 'expected a number from 0 to 512' }), null);

/** TAKE: picked up and gone (its taken frame stays); READ: looked at, read again at will. */
export const FIND_KINDS = ['TAKE', 'READ'] as const;

const findCheck = object(
  {
    key: text,
    zone: ref('zone'),
    x: tiles,
    y: tiles,
    kind: oneOf(FIND_KINDS),
    /** Its name in prompts ("Look at {name}", "Take {name}"). */
    nameKey: ref('string'),
    /** The information caption when it is found (Book 8: under eight words, no speaker). */
    captionKey: ref('string'),
    /** Its row in Book 10 section 20, "Chapter 1 finds". */
    balanceKey: text,
    /** The sound event played (content/audio.json events). */
    sound: text,
    /** Its frame of prop_finds before and after (a TAKE's taken frame). */
    frame: text,
    takenFrame: text,
    /** A glint on it until it is taken (Book 7 section 18): drawn in its frame's loop. */
    glint: bool,
    /** Why it is off the obvious path, for Book 9's table and the tests. */
    about: text,
  },
  ['takenFrame', 'glint'],
);

const findsCheck = object(
  {
    about: text,
    sheet: text,
    finds: arrayOf(findCheck),
    /** Stage 14: Skarvholm's collectibles (Book 2 section 10, CollectibleDef; src/content/islandSchema.ts). */
    collectiblesAbout: text,
    collectibles: parseCollectibles,
  },
  ['collectiblesAbout', 'collectibles'],
);

export type FindDef = Out<typeof findCheck>;
export type FindsDef = Out<typeof findsCheck>;

export const parseFinds = findsCheck;
