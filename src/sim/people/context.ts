/**
 * What the people systems read (Stage 8): Book 10's people numbers, the household's day and jobs,
 * what residents say, the scenes, and each person's content.
 */
import { parseTimeBalance } from '../../content/balance.ts';
import type { TimeBalance } from '../../content/balance.ts';
import { parseStaminaBalance } from '../../content/homeBalance.ts';
import { parsePeopleBalance } from '../../content/peopleBalance.ts';
import type { PeopleBalance } from '../../content/peopleBalance.ts';
import type {
  Content,
  HouseholdDef,
  PersonDef,
  SceneDef,
  TalkDef,
} from '../../content/registry.ts';
import type { Id } from '../../core/ids.ts';

export type Block = 'SLEEP' | 'MEAL' | 'WORK' | 'EVENING';

export interface PeopleContext {
  readonly b: PeopleBalance;
  readonly household: HouseholdDef;
  readonly talk: TalkDef | null;
  readonly scenes: readonly SceneDef[];
  readonly defs: ReadonlyMap<Id, PersonDef>;
  readonly time: TimeBalance;
  /** Minute of the day by which someone without a meal is hungry (Book 10 section 06). */
  readonly hungryAt: number;
  /** The day's blocks, by the minute of the day each starts, in order through the day. */
  readonly blocks: readonly { readonly block: Block; readonly from: number }[];
  /** Ticks in a real second (the bark clock). */
  readonly ticksPerSecond: number;
}

export function minutesOf(clock: string): number {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
}

export function peopleContext(
  content: Pick<Content, 'household' | 'talk' | 'scenes' | 'people' | 'balance'>,
  ticksPerSecond = 60,
): PeopleContext | null {
  const household = content.household;
  if (household === null) return null;
  return {
    b: parsePeopleBalance(content.balance),
    household,
    talk: content.talk,
    scenes: content.scenes,
    defs: content.people,
    time: parseTimeBalance(content.balance),
    hungryAt: parseStaminaBalance(content.balance).hungryAt,
    blocks: household.schedule
      .map((s) => ({ block: s.block, from: minutesOf(s.from) }))
      .sort((a, b) => a.from - b.from),
    ticksPerSecond,
  };
}

/** The block of the day at a minute after midnight, and the minute it began. */
export function blockAt(ctx: PeopleContext, minuteOfDay: number): { block: Block; from: number } {
  let current = ctx.blocks[ctx.blocks.length - 1] ?? { block: 'EVENING' as Block, from: 0 };
  for (const b of ctx.blocks) if (minuteOfDay >= b.from) current = b;
  return current;
}
