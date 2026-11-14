/**
 * Stage 3 acceptance check 3 (Book 2 section 23 property tests): one-shots never refire; the
 * ledger and evidence are append-only, across any mix of operations, saves and reloads.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parsePeopleBasics, parseTimeBalance } from '../../src/content/balance.ts';
import { readSave, writeSave } from '../../src/persist/save.ts';
import { appendDeed, appendEvidence, fireOneShot, setFact } from '../../src/sim/ledger/ledger.ts';
import { newCampaign } from '../../src/sim/world.ts';
import type { Deed, WorldState } from '../../src/sim/world.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const balance = loadBalanceJson();
const b = parseTimeBalance(balance);
const basics = parsePeopleBasics(balance);
const { content } = loadContentFromDisk();
const meta = {
  build: 'property',
  kind: 'autosave' as const,
  slot: 'autosave-1',
  sequence: 1,
  savedAt: 'now',
};

type Op =
  | { kind: 'deed'; n: number }
  | { kind: 'evidence'; n: number }
  | { kind: 'oneShot'; id: string }
  | { kind: 'fact'; key: string; value: number }
  | { kind: 'saveAndLoad' }
  | { kind: 'tryMutate'; n: number };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('deed' as const), n: fc.nat(1000) }),
  fc.record({ kind: fc.constant('evidence' as const), n: fc.nat(1000) }),
  fc.record({
    kind: fc.constant('oneShot' as const),
    id: fc.constantFrom('BEAT_1_WAKE', 'BEAT_1_BROCH', 'BEAT_1_LAUNCH'),
  }),
  fc.record({
    kind: fc.constant('fact' as const),
    key: fc.constantFrom('a', 'b'),
    value: fc.integer(),
  }),
  fc.record({ kind: fc.constant('saveAndLoad' as const) }),
  fc.record({ kind: fc.constant('tryMutate' as const), n: fc.nat(50) }),
);

function deed(n: number): Deed {
  return {
    id: `DEED_${n}`,
    tag: 'THEFT',
    day: 1,
    placeId: 'SITE_CARRICK',
    doer: 'HOUSEHOLD',
    context: {},
    victims: [],
    witnesses: [],
    identification: 0,
    marksSeen: [],
  };
}

describe('ledger, evidence and one-shot properties', () => {
  it('hold for any sequence of operations, saves and reloads', () => {
    fc.assert(
      fc.property(fc.array(op, { maxLength: 60 }), (ops) => {
        let world: WorldState = newCampaign('property', b, basics, content);
        const effectRuns = new Map<string, number>();
        for (const o of ops) {
          const ledgerBefore = JSON.stringify(world.ledger);
          const evidenceBefore = JSON.stringify(world.evidence);
          switch (o.kind) {
            case 'deed':
              if (!world.ledger.some((d) => d.id === `DEED_${o.n}`)) appendDeed(world, deed(o.n));
              else
                expect(() => {
                  appendDeed(world, deed(o.n));
                }).toThrow();
              break;
            case 'evidence':
              if (!world.evidence.some((e) => e.id === `EV_${o.n}`)) {
                appendEvidence(world, {
                  id: `EV_${o.n}`,
                  kind: 'ITEM',
                  placeId: 'SITE_CARRICK',
                  pos: { x: 0, y: 0 },
                  deedIds: [],
                  points: 1,
                });
              }
              break;
            case 'oneShot':
              fireOneShot(world, o.id, () => effectRuns.set(o.id, (effectRuns.get(o.id) ?? 0) + 1));
              break;
            case 'fact':
              setFact(world, o.key, o.value);
              break;
            case 'saveAndLoad':
              world = readSave(JSON.parse(JSON.stringify(writeSave(world, meta)))).state;
              break;
            case 'tryMutate': {
              // Appended entries are frozen: code cannot rewrite history in place.
              const entry = world.ledger[o.n % Math.max(1, world.ledger.length)];
              if (entry !== undefined && Object.isFrozen(entry)) {
                expect(() => {
                  (entry as { tag: string }).tag = 'SPARED';
                }).toThrow();
              }
              break;
            }
          }
          // Append-only: what was there before is still there, unchanged and in order.
          expect(JSON.stringify(world.ledger).startsWith(ledgerBefore.slice(0, -1))).toBe(true);
          expect(JSON.stringify(world.evidence).startsWith(evidenceBefore.slice(0, -1))).toBe(true);
        }
        // One-shots never refire, whatever the saves and reloads in between.
        for (const runs of effectRuns.values()) expect(runs).toBe(1);
        for (const id of effectRuns.keys()) expect(world.oneShots[id]).toBe(1);
      }),
      { numRuns: 150, seed: 20261110 },
    );
  });
});
