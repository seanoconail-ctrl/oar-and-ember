/**
 * Journeys on the mainland (design addendum 2.3 section 3; Book 10 section 14). The mainland is a
 * network of sites and the ends of wilderness routes: road legs between them pass off screen and
 * cost game time; a route must be crossed on foot. The shortest journey between two sites is a
 * shortest path over this network, in game hours. Pure: no state, no randomness.
 */

export type LegKind = 'Road' | 'Route';

export interface Leg {
  readonly from: string;
  readonly to: string;
  readonly kind: LegKind;
  /** Game hours along the leg (a route's direct path). */
  readonly hours: number;
}

export interface Journey {
  readonly hours: number;
  /** The routes crossed on foot, in order (no repeats). */
  readonly routes: readonly string[];
  readonly via: readonly string[];
}

/** The route a node belongs to, for nodes named like "The plank road (west end)". */
export function routeOf(node: string): string | null {
  const m = /^(.*) \((?:north|south|east|west) (?:end|branch)\)$/.exec(node);
  return m === null ? null : (m[1] ?? null);
}

/** Reads Book 10's "Network" rows (From, To, Kind, Hours). Throws on a malformed row. */
export function parseNetwork(rows: readonly Record<string, string>[]): Leg[] {
  return rows.map((r, i) => {
    const kind = r['Kind'];
    const hours = Number(r['Hours']);
    if ((kind !== 'Road' && kind !== 'Route') || !Number.isFinite(hours) || hours <= 0)
      throw new Error(`network row ${i}: kind "${kind ?? ''}", hours "${r['Hours'] ?? ''}"`);
    return { from: r['From'] ?? '', to: r['To'] ?? '', kind, hours };
  });
}

/** The shortest journey from `from` to `to` over the legs (both directions), or null. */
export function shortestJourney(legs: readonly Leg[], from: string, to: string): Journey | null {
  const next = new Map<string, Leg[]>();
  for (const leg of legs) {
    next.set(leg.from, [...(next.get(leg.from) ?? []), leg]);
    next.set(leg.to, [...(next.get(leg.to) ?? []), { ...leg, from: leg.to, to: leg.from }]);
  }
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, Leg>();
  const open = new Set([from]);
  while (open.size > 0) {
    let node = '';
    let d = Infinity;
    for (const n of open) {
      const v = best.get(n) ?? Infinity;
      if (v < d || (v === d && n < node)) {
        node = n;
        d = v;
      }
    }
    open.delete(node);
    if (node === to) break;
    for (const leg of next.get(node) ?? []) {
      const nd = d + leg.hours;
      if (nd < (best.get(leg.to) ?? Infinity) - 1e-9) {
        best.set(leg.to, nd);
        prev.set(leg.to, leg);
        open.add(leg.to);
      }
    }
  }
  const total = best.get(to);
  if (total === undefined) return null;
  const via: string[] = [to];
  const routes: string[] = [];
  for (let at = to; at !== from;) {
    const leg = prev.get(at);
    if (leg === undefined) break;
    if (leg.kind === 'Route') {
      const r = routeOf(leg.from) ?? routeOf(leg.to);
      if (r !== null && routes[0] !== r) routes.unshift(r);
    }
    at = leg.from;
    via.unshift(at);
  }
  return { hours: Math.round(total * 100) / 100, routes, via };
}
