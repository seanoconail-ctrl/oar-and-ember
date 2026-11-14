/**
 * The conditions Chapter 1's aims are written with (Book 2 section 16, AimDef; decisions DE-23
 * and DE-24), and their validator for content/opening.json. A condition reads the world: a fact, an
 * item owned, a thing at its home, the calendar, a repair, a gate, a resident; the progress of an
 * aim reads, besides, what the steerer carries, works at, talks to, or where they stand.
 */
import type { Check } from './schema.ts';

export type AimCondition =
  | { readonly fact: string; readonly is?: string | number | boolean }
  | { readonly not: AimCondition }
  | { readonly any: readonly AimCondition[] }
  | { readonly has: string }
  | { readonly home: string }
  | { readonly after: { readonly day: number; readonly minute: number } }
  | { readonly repair: 'HULL' | 'RIGGING' | 'STEERING_OAR' }
  | { readonly gateStarted: string }
  | { readonly resident: string }
  /** Progress only: carrying something; at a place (while carrying something). */
  | { readonly carrying: string }
  | {
      readonly near: {
        readonly zone: string;
        readonly x: number;
        readonly y: number;
        readonly r: number;
      };
      readonly carrying?: string;
    }
  | { readonly zone: string }
  /** Progress only: a store growing; a hands-on action under way; a talk with someone. */
  | { readonly store: string }
  | { readonly working: string }
  | { readonly talking: string };

const KEYS = [
  'fact',
  'not',
  'any',
  'has',
  'home',
  'after',
  'repair',
  'gateStarted',
  'resident',
  'carrying',
  'near',
  'zone',
  'store',
  'working',
  'talking',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates one condition (recursively), recording each problem with its path. */
export const aimCondition: Check<AimCondition> = (value, path, ctx) => {
  const bad = (reason: string): null => {
    ctx.issues.push({ file: ctx.file, path, reason });
    return null;
  };
  if (!isRecord(value)) return bad('a condition must be an object');
  const key = KEYS.find((k) => k in value);
  if (key === undefined) return bad(`a condition needs one of ${KEYS.join(', ')}`);
  const v = value[key];
  switch (key) {
    case 'not':
      return aimCondition(v, `${path}.not`, ctx) === null ? null : (value as AimCondition);
    case 'any': {
      if (!Array.isArray(v) || v.length === 0) return bad('"any" needs a list of conditions');
      const ok = v.every((c, i) => aimCondition(c, `${path}.any[${i}]`, ctx) !== null);
      return ok ? (value as AimCondition) : null;
    }
    case 'after':
      if (!isRecord(v) || typeof v['day'] !== 'number' || typeof v['minute'] !== 'number')
        return bad('"after" needs a day and a minute of the day');
      return value as AimCondition;
    case 'near':
      if (
        !isRecord(v) ||
        typeof v['zone'] !== 'string' ||
        typeof v['x'] !== 'number' ||
        typeof v['y'] !== 'number' ||
        typeof v['r'] !== 'number'
      )
        return bad('"near" needs a zone, x, y and r (tiles)');
      return value as AimCondition;
    case 'repair':
      if (v !== 'HULL' && v !== 'RIGGING' && v !== 'STEERING_OAR')
        return bad('"repair" is HULL, RIGGING or STEERING_OAR');
      return value as AimCondition;
    default:
      if (typeof v !== 'string') return bad(`"${key}" needs a string`);
      return value as AimCondition;
  }
};
