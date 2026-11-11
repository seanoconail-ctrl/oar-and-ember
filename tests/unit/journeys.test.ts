/**
 * Journeys on the mainland (design addendum 2.3 section 3): Book 10 section 14's shortest journey
 * times are what the network gives, so the table can never drift from the network it is built on.
 */
import { describe, expect, it } from 'vitest';
import { parseNetwork, shortestJourney } from '../../src/sim/travel/journeys.ts';
import { repoFile } from './books.ts';

const tables = (
  JSON.parse(repoFile('content/balance.json')) as {
    tables: Record<string, Record<string, Record<string, string>[]>>;
  }
).tables['theMainlandJourneys'];
const legs = parseNetwork(tables?.['network'] ?? []);
const journeys = tables?.['shortestJourneys'] ?? [];

describe('mainland journeys (Book 10 section 14)', () => {
  it('has the network and a journey time for every pair of sites', () => {
    expect(legs.length).toBeGreaterThan(30);
    expect(journeys).toHaveLength(120);
  });

  it('gives every shortest journey exactly the time the network computes', () => {
    for (const row of journeys) {
      const j = shortestJourney(legs, row['From'] ?? '', row['To'] ?? '');
      expect(j, `${row['From']} to ${row['To']}`).not.toBeNull();
      expect(j?.hours, `${row['From']} to ${row['To']}`).toBe(Number(row['Hours']));
    }
  });

  it('makes every inland site reachable only by crossing a route on foot', () => {
    const west = [
      'Carrick Strand',
      'Carrick Landing',
      'Ardcarn',
      'Loch Carn',
      'Kilbrecc farms',
      'Kilbrecc',
    ];
    for (const site of ['Móin Mhór', 'Sliabh Carn', 'The Mound Field', 'The Black Wood heart'])
      for (const from of west)
        expect(
          shortestJourney(legs, from, site)?.routes.length ?? 0,
          `${from} to ${site}`,
        ).toBeGreaterThan(0);
  });

  it('names the routes a journey crosses', () => {
    const j = shortestJourney(legs, 'Ardcarn', 'Móin Mhór');
    expect(j?.routes).toEqual(['The Black Wood path']);
    expect(j?.hours).toBe(5.5);
  });
});
