/**
 * Stage 14, work package C's presentation for the play view (src/scenes/playView.ts calls it
 * through small hooks, kept off the per-frame budget): the island's props drawn in the scene in
 * view, the drowned's lines and the puzzles' information lines and sounds, and the journal's pages
 * (Book 7 section 10; decision S14-25): the current aim with the side aims under it, the Finds page
 * with each kind's count and its words, and the region map (src/scenes/regionMap.ts).
 *
 * Presentation only: it reads the simulation's state and events, never changes them.
 */
import type { CollectibleKind } from '../content/islandSchema.ts';
import type { Content } from '../content/registry.ts';
import type { Id } from '../core/ids.ts';
import { collectible, collectedCounts } from '../sim/land/collectibles.ts';
import { islandProps } from '../sim/land/island.ts';
import type { IslandContext, IslandEvent } from '../sim/land/island.ts';
import { openSideAims } from '../sim/narrative/sideAims.ts';
import type { WorldState } from '../sim/world.ts';
import type { LoadedAtlas } from './atlases.ts';
import { MAP_H, MAP_W, RegionMap } from './regionMap.ts';
import type { PixelAtlas } from './seaChart.ts';
import { pixelAtlas } from './seaVoyage.ts';

/** The map's names in its own brown ink: the palette's earth ramp (Book 7 section 03). */
const INK = '#40322B';

export const JOURNAL_PAGES = ['aim', 'finds', 'map'] as const;
export type JournalPage = (typeof JOURNAL_PAGES)[number];

/** The place name of each scene and area on the map (the save's names, and the new scenes'). */
const PLACE_KEYS: Readonly<Record<string, string>> = {
  ZONE_SK_STRAND: 'place.name.sk_wreck_strand',
  ZONE_SK_MACHAIR: 'place.name.sk_machair',
  ZONE_SK_HAGSEAT: 'place.name.sk_hagseat',
  ZONE_SK_CAIRN: 'place.name.sk_cairn',
  ZONE_SK_SEALCAVE: 'place.name.sk_tidecave',
  ZONE_SK_GEO: 'place.name.sk_geo',
  ZONE_SK_CLIFFS: 'place.name.sk_eagle',
  ZONE_SK_ROOK: 'place.name.sk_rookhill',
  ZONE_SK_BOG: 'place.name.sk_bog',
  ZONE_SK_NAUST: 'place.name.sk_naust',
  ZONE_SK_SKERRY: 'place.name.sk_skerry',
  ZONE_SK_KELDA: 'place.name.sk_kelda',
  ZONE_SK_GREYMEN: 'place.name.sk_greymen',
  ZONE_SK_SEALCAVE_DEEP: 'ui.journal.map.deep',
  ZONE_SK_CAIRN_IN: 'ui.journal.map.cairn_in',
};

export interface IslandViewHooks {
  readonly doc: Document;
  readonly content: Content;
  readonly ctx: IslandContext;
  readonly atlases: ReadonlyMap<string, LoadedAtlas>;
  readonly t: (key: string, vars?: Record<string, string>) => string;
  /** A speech line, "Name: words". */
  readonly say: (text: string, now: number) => void;
  /** An information line by its string key. */
  readonly inform: (key: string, text: string, now: number) => void;
  /** A sound event (content/audio.json events). */
  readonly sound: (event: string) => void;
  readonly reducedMotion: () => boolean;
}

export class IslandView {
  readonly #h: IslandViewHooks;
  #page: JournalPage = 'aim';
  #open = false;
  #map: RegionMap | null = null;
  #canvas: HTMLCanvasElement | null = null;
  readonly #inking = new Map<Id, number>();
  /** Scenes found since the map was last looked at: inked with a stroke when it next is. */
  readonly #pending = new Set<Id>();
  #propsAt = { tick: -1, zone: '' };
  #props: { sheet: string; frame: string; x: number; y: number }[] = [];

  constructor(h: IslandViewHooks) {
    this.#h = h;
    h.doc.addEventListener('keydown', (ev) => {
      if (!this.#open) return;
      // The journal's pages turn with the arrow keys, as its foot says (or a click on a tab).
      const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (step === 0) return;
      this.turn(step);
      ev.preventDefault();
    });
  }

  get page(): JournalPage {
    return this.#page;
  }

  /** The journal is closed: its keys no longer turn the page. */
  close(): void {
    this.#open = false;
  }

  /** Turns the journal's page (wrapping round). */
  turn(step: number): void {
    const i = JOURNAL_PAGES.indexOf(this.#page);
    this.#page = JOURNAL_PAGES[(i + step + JOURNAL_PAGES.length) % JOURNAL_PAGES.length] ?? 'aim';
  }

  /** The island's things drawn in a scene now (recomputed once a tick, not every frame). */
  props(
    world: WorldState,
    zone: Id,
  ): readonly { sheet: string; frame: string; x: number; y: number }[] {
    if (this.#propsAt.tick !== world.tick || this.#propsAt.zone !== zone) {
      this.#props = islandProps(world, this.#h.ctx, zone);
      this.#propsAt = { tick: world.tick, zone };
    }
    return this.#props;
  }

  /** A simulation event this view shows or plays. */
  event(e: IslandEvent | { readonly type: string }, now: number): void {
    const h = this.#h;
    const ev = e as IslandEvent;
    switch (ev.type) {
      case 'ISLAND_SPOKE':
        h.say(
          h.t('caption.format.subtitle', { speaker: h.t(ev.speakerKey), line: h.t(ev.lineKey) }),
          now,
        );
        return;
      case 'ISLAND_INFO':
        h.inform(ev.key, h.t(ev.key), now);
        if (ev.sound !== undefined) h.sound(ev.sound);
        return;
      case 'ZONE_DISCOVERED':
        this.#pending.add(ev.zone);
        return;
      default:
        return;
    }
  }

  // ------------------------------------------------------------------------- the journal

  /** A string that changes when the journal's page must be built again. */
  journalKey(world: WorldState): string {
    const region = world.regions[this.#h.ctx.region];
    return [
      this.#page,
      openSideAims(world, this.#h.ctx).join(','),
      (region?.collected ?? []).length,
      (region?.discoveredZones ?? []).join(','),
    ].join('|');
  }

  /** The journal's open page (after `aim`, the current aim's line): tabs, then the page. */
  journal(world: WorldState, aim: HTMLElement, open: boolean): HTMLElement[] {
    this.#open = open;
    const h = this.#h;
    const doc = h.doc;
    const tabs = doc.createElement('p');
    tabs.className = 'oe-journal-tabs';
    for (const page of JOURNAL_PAGES) {
      const tab = doc.createElement('button');
      tab.type = 'button';
      tab.className = page === this.#page ? 'oe-journal-tab on' : 'oe-journal-tab';
      tab.dataset['page'] = page;
      tab.textContent = h.t(`ui.journal.tab.${page}`);
      // The interface's style (Book 7 section 10): plain words, the open page underlined.
      tab.style.cssText = `background:none;border:none;color:inherit;font:inherit;cursor:pointer;margin-right:1em;padding:0;text-decoration:${page === this.#page ? 'underline' : 'none'};opacity:${page === this.#page ? '1' : '0.7'}`;
      tab.addEventListener('click', () => {
        this.#page = page;
      });
      tabs.append(tab);
    }
    const foot = doc.createElement('p');
    foot.className = 'oe-journal-turn';
    foot.textContent = h.t('ui.journal.tabs', { prev: '←', next: '→' });
    const body =
      this.#page === 'aim'
        ? this.#aimPage(world, aim)
        : this.#page === 'finds'
          ? this.#findsPage(world)
          : this.#mapPage(world);
    return [tabs, ...body, foot];
  }

  #aimPage(world: WorldState, aim: HTMLElement): HTMLElement[] {
    const h = this.#h;
    const side = openSideAims(world, h.ctx);
    if (side.length === 0) return [aim];
    const head = h.doc.createElement('p');
    head.className = 'oe-journal-side-title';
    head.textContent = h.t('ui.journal.side.title');
    const list = h.doc.createElement('ul');
    list.className = 'oe-journal-side';
    for (const key of side) {
      const li = h.doc.createElement('li');
      li.textContent = h.t(key);
      list.append(li);
    }
    return [aim, head, list];
  }

  #findsPage(world: WorldState): HTMLElement[] {
    const h = this.#h;
    const doc = h.doc;
    const out: HTMLElement[] = [];
    const counts = collectedCounts(world, h.ctx);
    let any = false;
    for (const c of counts) {
      if (c.total === 0 && c.found === 0) continue;
      const head = doc.createElement('p');
      head.className = 'oe-finds-kind';
      head.dataset['kind'] = c.kind;
      head.textContent = h.t('ui.journal.finds.count', {
        kind: h.t(`ui.journal.kind.${c.kind.toLowerCase() as Lowercase<CollectibleKind>}`),
        n: String(c.found),
        total: String(c.total),
      });
      out.push(head);
      if (c.keys.length === 0) continue;
      any = true;
      const list = doc.createElement('ul');
      list.className = 'oe-finds-list';
      for (const key of c.keys) {
        const def = collectible(h.ctx, key);
        if (def === undefined) continue;
        const li = doc.createElement('li');
        li.textContent = h.t(def.journalKey);
        list.append(li);
      }
      out.push(list);
    }
    if (!any) {
      const none = doc.createElement('p');
      none.textContent = h.t('ui.journal.finds.none');
      out.push(none);
    }
    return out;
  }

  #regionMap(): RegionMap {
    if (this.#map !== null) return this.#map;
    const pixels = new Map<string, PixelAtlas>();
    for (const name of ['ui_regionmap', 'ui_regionmap_pin']) {
      const a = this.#h.atlases.get(name);
      if (a !== undefined) pixels.set(name, pixelAtlas(this.#h.doc, a));
    }
    this.#map = new RegionMap(pixels, this.#h.ctx.island.regionMap);
    return this.#map;
  }

  #mapPage(world: WorldState): HTMLElement[] {
    const h = this.#h;
    const doc = h.doc;
    const title = doc.createElement('p');
    title.className = 'oe-map-title';
    title.textContent = h.t('ui.journal.map.title');
    const wrap = doc.createElement('div');
    wrap.className = 'oe-region-map';
    wrap.style.position = 'relative';
    const canvas = doc.createElement('canvas');
    canvas.width = MAP_W;
    canvas.height = MAP_H;
    canvas.style.width = '100%';
    canvas.style.imageRendering = 'pixelated';
    wrap.append(canvas);
    this.#canvas = canvas;
    const map = this.#regionMap();
    const seconds = performance.now() / 1000;
    for (const z of this.#pending) this.#inking.set(z, seconds);
    this.#pending.clear();
    for (const id of world.regions[h.ctx.region]?.discoveredZones ?? []) {
      const at = map.labelAt(id);
      const key = PLACE_KEYS[id];
      if (at === null || key === undefined) continue;
      const label = doc.createElement('span');
      label.className = 'oe-map-label';
      label.dataset['zone'] = id;
      label.textContent = h.t(key);
      label.style.position = 'absolute';
      label.style.left = `${(at.x / MAP_W) * 100}%`;
      label.style.top = `${(at.y / MAP_H) * 100}%`;
      label.style.transform = 'translate(-50%, -50%)';
      // Brown ink on the vellum, the caption font, no glow (Book 7 section 10).
      label.style.color = INK;
      label.style.textShadow = 'none';
      label.style.fontSize = '0.8em';
      label.style.whiteSpace = 'nowrap';
      label.style.pointerEvents = 'none';
      wrap.append(label);
    }
    this.frame(world, performance.now());
    return [title, wrap];
  }

  /** Each frame the journal is open on the map: the pen strokes and the pin. */
  frame(world: WorldState, now: number): void {
    const canvas = this.#canvas;
    if (!this.#open || this.#page !== 'map' || !canvas?.isConnected) return;
    const onFoot = world.onFoot;
    const tile = onFoot === null ? 24 : (this.#h.ctx.maps.get(onFoot.zone)?.tile ?? 24);
    const seconds = now / 1000;
    for (const [z, since] of this.#inking) if (seconds - since > 5) this.#inking.delete(z);
    const rgba = this.#regionMap().compose({
      discovered: world.regions[this.#h.ctx.region]?.discoveredZones ?? [],
      here:
        onFoot === null
          ? null
          : { zone: onFoot.zone, x: onFoot.player.x / tile, y: onFoot.player.y / tile },
      inking: this.#inking,
      seconds,
      reduced: this.#h.reducedMotion(),
    });
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const img = ctx.createImageData(MAP_W, MAP_H);
    img.data.set(rgba);
    ctx.putImageData(img, 0, 0);
  }
}
