/**
 * The wreck-scavengers as ordinary outlaws, for the tests of the mechanics they were measured on
 * (Stage 9, combat v2, design addendum 2.5): the user's third playtest made Svart and Ketill
 * Chapter 1's teaching foes (decision DG-9), whose guard turns everything outside their lesson.
 * The teaching rule itself is tested in tests/unit/pt3combat.test.ts; met outside Chapter 1 they
 * fight as ordinary outlaws (Book 10 "Teaching foes"), as here.
 */
import type { CombatDef } from '../../src/content/registry.ts';

export function plainFighters(fighters: CombatDef['fighters']): CombatDef['fighters'] {
  return fighters.map((f) => {
    const rest = { ...f };
    delete rest.teaching;
    return rest;
  });
}
