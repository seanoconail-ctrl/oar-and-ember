/**
 * The developer menu's chart (Book 2 section 09; decision S13-11): every route and every place of
 * the sea map known, so every edge can be sailed in tests and from the menu. It marks the world as
 * a developer command does (`dev.used`).
 */
import { setFact } from '../ledger/ledger.ts';
import { FACT_DEV } from '../dev.ts';
import type { WorldState } from '../world.ts';
import type { SeaContext } from './context.ts';

export function chartAll(world: WorldState, ctx: SeaContext): void {
  setFact(world, FACT_DEV, true);
  for (const edge of ctx.edges.values()) world.knowledge.routes[edge.id] = 'KNOWN';
  for (const node of ctx.nodes.values())
    if (node.kind === 'PLACE') world.knowledge.places[node.id] = 'KNOWN';
}
