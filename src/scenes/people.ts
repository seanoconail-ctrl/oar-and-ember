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
export const PERSON_LOOKS: Readonly<Record<Id, string>> = { C_HILD: 'hild' };

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
  return { steerer: look(STEERER_LOOKS[bodyModel]), people };
}

/** Weapon layers drawn only while the steerer owns the item (decision DD-6: no starting bow). */
export const OWNED_LAYERS: readonly { readonly layer: RegExp; readonly item: Id }[] = [
  { layer: /^layer_weapon_bow_/, item: 'ITEM_BOW' },
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
