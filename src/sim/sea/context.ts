/**
 * What the sea needs from content (Book 2 section 09): the nodes at their chart positions, the
 * edges with Book 10's base watches, exposure and winter, the encounter tables with Book 10's
 * weights, the landings, the words, and the ship's definitions. Built once from loaded content.
 */
import type { Id } from '../../core/ids.ts';
import type { TimeBalance } from '../../content/balance.ts';
import { parseSeaBalance } from '../../content/seaBalance.ts';
import type { SeaBalance, WinterRule } from '../../content/seaBalance.ts';
import type { SeaDef, SeaEntryDef, SeaLandingDef, SeaWord } from '../../content/seaSchema.ts';
import type { ShipDefs } from '../ship/ship.ts';

export interface SeaNodeDef {
  readonly id: Id;
  readonly kind: 'PLACE' | 'WAYPOINT' | 'HAZARD';
  readonly pos: { readonly x: number; readonly y: number };
}

/** Book 2 section 09's SeaEdge, as built. */
export interface SeaEdge {
  readonly id: Id;
  readonly a: Id;
  readonly b: Id;
  readonly baseWatches: number;
  readonly exposure: 0 | 1 | 2 | 3;
  readonly tideGate?: { readonly passableAt: 'SLACK' | 'FLOOD' | 'EBB'; readonly at: Id };
  readonly hazards: readonly Id[];
  readonly known: boolean;
  readonly winter: WinterRule;
  readonly encounterTable: Id;
}

export interface EncounterEntry extends SeaEntryDef {
  readonly weight: number;
}

export interface SeaContext {
  readonly b: SeaBalance;
  readonly time: TimeBalance;
  readonly ship: ShipDefs;
  readonly home: Id;
  readonly nodes: ReadonlyMap<Id, SeaNodeDef>;
  readonly edges: ReadonlyMap<Id, SeaEdge>;
  /** Each node's edges, in content order. */
  readonly byNode: ReadonlyMap<Id, readonly SeaEdge[]>;
  readonly tables: ReadonlyMap<Id, readonly EncounterEntry[]>;
  readonly landings: ReadonlyMap<Id, SeaLandingDef>;
  readonly words: Readonly<Record<SeaWord, string>>;
  /** The fact the launch sets (the boat afloat at the end of Chapter 1). */
  readonly launchedFact: string;
  /** The chapters in order (the active one filters encounters). */
  readonly chapters?: readonly Id[];
}

/** Builds the sea's context. `chart` is content/launch.json's seaMap (places and hazards). */
export function seaContext(args: {
  readonly sea: SeaDef;
  readonly chart: {
    readonly places: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
    readonly hazards: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  };
  readonly balance: unknown;
  readonly time: TimeBalance;
  readonly ship: ShipDefs;
  readonly launchedFact: string;
  /** Tests may give their own numbers (a test encounter table). */
  readonly b?: SeaBalance;
}): SeaContext {
  const b = args.b ?? parseSeaBalance(args.balance);
  const nodes = new Map<Id, SeaNodeDef>();
  for (const n of args.sea.nodes) {
    const pos = n.kind === 'HAZARD' ? args.chart.hazards[n.id] : args.chart.places[n.id];
    if (pos === undefined) throw new Error(`sea: no chart position for ${n.id}`);
    nodes.set(n.id, { id: n.id, kind: n.kind, pos: { x: pos.x, y: pos.y } });
  }
  const edges = new Map<Id, SeaEdge>();
  const byNode = new Map<Id, SeaEdge[]>();
  for (const e of args.sea.edges) {
    const row = b.routes.get(e.id);
    if (row === undefined) throw new Error(`sea: Book 10 has no route ${e.id}`);
    const edge: SeaEdge = {
      id: e.id,
      a: e.a,
      b: e.b,
      baseWatches: row.baseWatches,
      exposure: row.exposure,
      ...(e.tideGate === undefined ? {} : { tideGate: e.tideGate }),
      hazards: e.hazards,
      known: e.known,
      winter: row.winter,
      encounterTable: e.encounterTable,
    };
    edges.set(e.id, edge);
    for (const end of [e.a, e.b]) byNode.set(end, [...(byNode.get(end) ?? []), edge]);
  }
  const tables = new Map<Id, EncounterEntry[]>();
  for (const [id, table] of Object.entries(args.sea.tables)) {
    const weights = b.weights.get(id);
    tables.set(
      id,
      table.entries.map((e) => ({ ...e, weight: weights?.get(e.key) ?? 0 })),
    );
  }
  return {
    b,
    time: args.time,
    ship: args.ship,
    home: args.sea.home,
    nodes,
    edges,
    byNode,
    tables,
    landings: new Map(args.sea.landings.map((l) => [l.place, l])),
    words: args.sea.words as Record<SeaWord, string>,
    launchedFact: args.launchedFact,
  };
}

/** The other end of an edge. */
export function otherEnd(edge: SeaEdge, node: Id): Id {
  return edge.a === node ? edge.b : edge.a;
}
