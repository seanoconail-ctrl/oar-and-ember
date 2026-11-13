/**
 * How people are drawn (Book 2 section 19, Book 7 section 07): a body sheet with its layer sheets
 * (clothing, cloak, helmet, weapon...), composited at draw time in each facing's order, all on the
 * same frames and foot anchor. The layer files are assets/art/layers/*.layers.json.
 */
import type { Id } from '../core/ids.ts';
import type { BodyModel } from '../sim/world.ts';

/** A person's layer file: sheets per facing, first drawn first (furthest back). */
export interface LayerFile {
  readonly name: string;
  readonly layers: Readonly<Record<string, readonly string[]>>;
}

export interface PersonLook {
  /** The body sheet: its anims and shadow are the person's. */
  readonly body: string;
  /** Sheets per facing in draw order, the body among them. */
  readonly layers: Readonly<Record<string, readonly string[]>>;
}

export interface PeopleLook {
  readonly steerer: PersonLook;
  /** Per person id, e.g. C_HILD. */
  readonly people: Readonly<Record<Id, PersonLook>>;
}

/**
 * The steerer's look by body model: the approved outfit, with no helmet (Book 7 section 07: the
 * steerer starts with none). Hild in her woad dress.
 */
export const STEERER_LOOKS: Readonly<Record<BodyModel, string>> = {
  A: 'steerer_a',
  B: 'steerer_b',
};
export const PERSON_LOOKS: Readonly<Record<Id, string>> = {
  C_HILD: 'hild',
  // Stage 9: the three wreck-scavengers.
  E_WRECKER_KETILL: 'wrecker_ketill',
  E_WRECKER_SVART: 'wrecker_svart',
  E_WRECKER_CONN: 'wrecker_conn',
  // Stage 10: the three found in the searches, and Thorkel's body.
  C_ODDI: 'oddi',
  C_BRAN: 'bran',
  C_RUNA: 'runa',
  C_THORKEL: 'thorkel',
};

/** Things carried like people (Stage 10: the chests), drawn from one prop sheet in every facing. */
export const CARRIED_LOOKS: Readonly<Record<Id, string>> = {
  ITEM_THORKEL_CHEST: 'prop_chest_thorkel',
  ITEM_RUNA_TOOLS: 'prop_chest_runa',
  // Stage 11: the repairs' three loads.
  ITEM_BOARDS: 'prop_boards',
  ITEM_RIGGING: 'prop_rigging',
  ITEM_STEERING_OAR: 'prop_steering_oar',
  // Design addendum 2.4: the ship's silver in its strongbox, and the stores from the mast.
  ITEM_SHIP_SILVER: 'prop_strongbox',
  ITEM_MAST_STORES: 'prop_stores_bundle',
};

export function personLook(file: LayerFile): PersonLook {
  const body = Object.values(file.layers)
    .flat()
    .find((n) => n.startsWith('actor_'));
  if (body === undefined) throw new Error(`${file.name}: no body sheet among its layers`);
  return { body, layers: file.layers };
}

/** The look of the steerer (by body model) and of the people the zones place. */
export function peopleLook(
  files: ReadonlyMap<string, LayerFile>,
  bodyModel: BodyModel,
): PeopleLook {
  const look = (name: string): PersonLook => {
    const file = files.get(name);
    if (file === undefined) throw new Error(`No layer file ${name}.layers.json`);
    return personLook(file);
  };
  const people: Record<Id, PersonLook> = {};
  for (const [id, name] of Object.entries(PERSON_LOOKS)) people[id] = look(name);
  for (const [id, sheet] of Object.entries(CARRIED_LOOKS))
    people[id] = { body: sheet, layers: { s: [sheet], n: [sheet], e: [sheet], w: [sheet] } };
  return { steerer: look(STEERER_LOOKS[bodyModel]), people };
}

/** Weapon layers drawn only while the steerer owns the item (decision DD-6: no starting bow). */
export const OWNED_LAYERS: readonly { readonly layer: RegExp; readonly item: Id }[] = [
  { layer: /^layer_weapon_bow_/, item: 'ITEM_BOW' },
  { layer: /^layer_weapon_seax_/, item: 'ITEM_SEAX' },
];

/**
 * A person's look without the weapon layers of items they do not own: the steerer's bow is drawn
 * on their back only once the bow has been picked up, everywhere the steerer is drawn.
 */
export function withOwned(look: PersonLook, owns: (item: Id) => boolean): PersonLook {
  const hidden = OWNED_LAYERS.filter((o) => !owns(o.item));
  if (hidden.length === 0) return look;
  const layers: Record<string, readonly string[]> = {};
  for (const [facing, sheets] of Object.entries(look.layers))
    layers[facing] = sheets.filter((s) => !hidden.some((h) => h.layer.test(s)));
  return { body: look.body, layers };
}

/** Whether the steerer has an item: in a hotbar slot or in the inventory. */
export function steererOwns(
  player: {
    readonly hotbar: { readonly slots: readonly (Id | null)[] };
    readonly inventory: Readonly<Record<Id, number>>;
  },
  item: Id,
): boolean {
  return player.hotbar.slots.includes(item) || (player.inventory[item] ?? 0) > 0;
}

/** A shield layer and its slung twin (people48.py: layer_shield_back_ beside layer_shield_round_). */
const SHIELD_LAYER = 'layer_shield_round_';

/**
 * A fighter's look with the shield slung on the back (decision DE-14: Svart fights the dusk fight
 * with the spear in both hands): the shield layer swapped for its slung twin where the art has one
 * (`has`), so what is drawn matches the simulation's shield (none in hand, nothing blocked).
 */
export function withSlungShield(look: PersonLook, has: (sheet: string) => boolean): PersonLook {
  const swap = (sheet: string): string => {
    if (!sheet.startsWith(SHIELD_LAYER)) return sheet;
    const slung = `layer_shield_back_${sheet.slice(SHIELD_LAYER.length)}`;
    return has(slung) ? slung : sheet;
  };
  const layers: Record<string, readonly string[]> = {};
  for (const [facing, sheets] of Object.entries(look.layers)) layers[facing] = sheets.map(swap);
  return { body: look.body, layers };
}

/**
 * Whether a fighter's shield is slung: it has none in hand and never had one broken (a split or
 * worn-out shield is gone, not slung).
 */
export function shieldSlung(f: {
  readonly shield: boolean;
  readonly shieldBreaks: number;
}): boolean {
  return !f.shield && f.shieldBreaks === 0;
}

/** Whether a fighter's shield broke (Book 10 shieldBreaks): it is dropped, so not drawn on it. */
export function shieldGone(f: {
  readonly shield: boolean;
  readonly shieldBreaks: number;
}): boolean {
  return !f.shield && f.shieldBreaks > 0;
}

/** A fighter's look with its shield layers taken off (a broken shield lies on the ground). */
export function withoutShield(look: PersonLook): PersonLook {
  const layers: Record<string, readonly string[]> = {};
  for (const [facing, sheets] of Object.entries(look.layers))
    layers[facing] = sheets.filter(
      (n) => !n.startsWith(SHIELD_LAYER) && !n.startsWith('layer_shield_back_'),
    );
  return { body: look.body, layers };
}
