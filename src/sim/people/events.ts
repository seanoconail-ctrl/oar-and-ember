/** What the people systems report (Stage 8): the play view shows and sounds them. */
import type { Id } from '../../core/ids.ts';
import type { ActivityKind, JobKind } from '../world.ts';

export type PeopleEvent =
  /** A line in a person's voice: a bark (its category), a warning step, or talk. */
  | {
      readonly type: 'PERSON_SPOKE';
      readonly person: Id;
      readonly lineKey: string;
      readonly bark?: string;
    }
  | { readonly type: 'RESIDENT_JOINED'; readonly person: Id }
  | { readonly type: 'ACTIVITY_CHANGED'; readonly person: Id; readonly activity: ActivityKind }
  | { readonly type: 'TRAIT_DISCOVERED'; readonly person: Id; readonly trait: string }
  | {
      readonly type: 'BAND_CHANGED';
      readonly person: Id;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly type: 'WARNING_STEP';
      readonly person: Id;
      readonly track: 'FRIENDSHIP' | 'HAPPINESS';
      readonly step: number;
    }
  | { readonly type: 'MEAL_TAKEN'; readonly person: Id; readonly hot: boolean }
  /** A pressing topic: the resident comes to the steerer to raise it. */
  | { readonly type: 'RESIDENT_APPROACHED'; readonly person: Id; readonly topic: string }
  | { readonly type: 'TALK_STARTED'; readonly person: Id; readonly kind: 'TALK' | 'SCENE' }
  | { readonly type: 'TALK_ENDED'; readonly person: Id }
  | { readonly type: 'TALK_INFO'; readonly key: string }
  | { readonly type: 'JOB_ASSIGNED'; readonly person: Id; readonly job: JobKind }
  | {
      readonly type: 'JOB_REFUSED';
      readonly person: Id;
      readonly job: JobKind;
      readonly reason: JobRefusal;
    }
  | { readonly type: 'DISPUTE_RAISED'; readonly scene: Id; readonly parties: readonly Id[] }
  | { readonly type: 'JUDGEMENT_GIVEN'; readonly scene: Id; readonly outcome: string };

/** Why a resident will not take a job (reason codes the interface words). */
export type JobRefusal = 'BED_BOUND' | 'REFUSES' | 'NO_SUCH_JOB' | 'ALREADY' | 'NOT_A_RESIDENT';
