/**
 * Small, typed validators for content files (Book 2 section 04: one schema per content type,
 * validated at load). Every problem is reported with its file, its path inside the file and a
 * reason, and references are collected so they can be resolved once every file has loaded.
 */
import { idPrefix } from '../core/ids.ts';
import type { IdPrefix } from '../core/ids.ts';

export interface Issue {
  readonly file: string;
  readonly path: string;
  readonly reason: string;
}

export type RefKind =
  | 'place'
  | 'hazard'
  | 'region'
  | 'zone'
  | 'person'
  | 'faction'
  | 'hull'
  | 'fitting'
  | 'string'
  | 'balance:hull'
  | 'balance:fitting';

export interface Ref {
  readonly kind: RefKind;
  readonly id: string;
  readonly file: string;
  readonly path: string;
}

export interface Ctx {
  readonly file: string;
  readonly issues: Issue[];
  readonly refs: Ref[];
}

/** Returns the parsed value, or null after recording an issue. */
export type Check<T> = (value: unknown, path: string, ctx: Ctx) => T | null;

function problem(ctx: Ctx, path: string, reason: string): null {
  ctx.issues.push({ file: ctx.file, path: path === '' ? '(root)' : path, reason });
  return null;
}

function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return typeof value === 'object' ? 'an object' : typeof value;
}

export const text: Check<string> = (value, path, ctx) =>
  typeof value === 'string' && value.trim() !== ''
    ? value
    : problem(ctx, path, `expected text, found ${describe(value)}`);

export function int(min: number, max: number): Check<number> {
  return (value, path, ctx) =>
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? value
      : problem(
          ctx,
          path,
          `expected a whole number from ${min} to ${max}, found ${describe(value)}`,
        );
}

export function oneOf<const T extends string>(options: readonly T[]): Check<T> {
  return (value, path, ctx) =>
    typeof value === 'string' && (options as readonly string[]).includes(value)
      ? (value as T)
      : problem(ctx, path, `expected one of ${options.join(', ')}, found ${describe(value)}`);
}

/** A well-formed ID with one of `prefixes`. */
export function id(prefixes: readonly IdPrefix[]): Check<string> {
  return (value, path, ctx) => {
    if (typeof value !== 'string')
      return problem(ctx, path, `expected an ID, found ${describe(value)}`);
    const prefix = idPrefix(value);
    if (prefix === null)
      return problem(ctx, path, `"${value}" is not a well-formed ID (Book 2 section 04)`);
    if (!prefixes.includes(prefix)) {
      return problem(
        ctx,
        path,
        `"${value}" should start with ${prefixes.map((p) => `${p}_`).join(' or ')}`,
      );
    }
    return value;
  };
}

/** A reference to something defined elsewhere, resolved after loading. */
export function ref(kind: RefKind): Check<string> {
  return (value, path, ctx) => {
    if (typeof value !== 'string' || value === '') {
      return problem(ctx, path, `expected a ${kind} reference, found ${describe(value)}`);
    }
    ctx.refs.push({ kind, id: value, file: ctx.file, path });
    return value;
  };
}

export function arrayOf<T>(item: Check<T>): Check<T[]> {
  return (value, path, ctx) => {
    if (!Array.isArray(value))
      return problem(ctx, path, `expected a list, found ${describe(value)}`);
    const out: T[] = [];
    value.forEach((v, i) => {
      const parsed = item(v, `${path}[${i}]`, ctx);
      if (parsed !== null) out.push(parsed);
    });
    // Keep the valid items so later checks still run; the issues list decides pass or fail.
    return out;
  };
}

/** A record keyed by `key` with values checked by `item`. */
export function recordOf<T>(key: Check<string>, item: Check<T>): Check<Record<string, T>> {
  return (value, path, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return problem(ctx, path, `expected an object, found ${describe(value)}`);
    }
    const out: Record<string, T> = {};
    let ok = true;
    for (const [k, v] of Object.entries(value)) {
      const parsedKey = key(k, `${path}.${k}`, ctx);
      const parsed = item(v, `${path}.${k}`, ctx);
      if (parsedKey === null || parsed === null) ok = false;
      else out[parsedKey] = parsed;
    }
    return ok ? out : null;
  };
}

type Shape = Record<string, Check<unknown>>;
type Parsed<S extends Shape> = { [K in keyof S]: S[K] extends Check<infer T> ? T : never };

/**
 * An object with exactly the fields of `shape`; fields named in `optional` may be absent.
 * Unknown fields are reported, so a misspelt key never passes silently.
 */
export function object<S extends Shape, O extends keyof S = never>(
  shape: S,
  optional: readonly O[] = [],
): Check<Omit<Parsed<S>, O> & Partial<Pick<Parsed<S>, O>>> {
  return (value, path, ctx) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return problem(ctx, path, `expected an object, found ${describe(value)}`);
    }
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let ok = true;
    for (const key of Object.keys(input)) {
      if (!(key in shape)) {
        problem(ctx, `${path}.${key}`, `unknown field "${key}"`);
        ok = false;
      }
    }
    for (const [key, check] of Object.entries(shape)) {
      const where = path === '' ? key : `${path}.${key}`;
      if (input[key] === undefined) {
        if (!(optional as readonly string[]).includes(key)) {
          problem(ctx, where, 'missing');
          ok = false;
        }
        continue;
      }
      const parsed = check(input[key], where, ctx);
      if (parsed === null) ok = false;
      else out[key] = parsed;
    }
    return ok ? (out as Omit<Parsed<S>, O> & Partial<Pick<Parsed<S>, O>>) : null;
  };
}
