/**
 * On-screen text, design addendum 2.5 section 2 (Book 2 section 18; Book 8 section 10; Book 10
 * section 21, "On-screen text"; decisions DF-11 to DF-15 and the user's DF-80): the caption view
 * (one information line and one speech line, never stacked; repeats suppressed; fights show only
 * speech and safety lines, with one line held for after), the text audit over every caption string
 * and sound, tutorial prompts and tooltips fading, and the cursor hidden in cinematic moments.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseTextBalance } from '../../src/content/presentationBalance.ts';
import { cinematicNow, CursorGate } from '../../src/scenes/cursor.ts';
import { CaptionDirector, inFight } from '../../src/ui/captions.ts';
import { PromptFade, TipLife } from '../../src/ui/prompts.ts';
import { auditInfo, NOTICE_REFUSALS } from '../../src/ui/textAudit.ts';
import type { InfoClass } from '../../src/ui/textAudit.ts';
import { loadBalanceJson } from '../../src/tools/content/loadBalance.ts';
import { loadContentFromDisk } from '../../src/tools/content/loadContentFiles.ts';

const tb = parseTextBalance(loadBalanceJson());
const { content } = loadContentFromDisk();

describe('Book 10 section 21, "On-screen text"', () => {
  it('reads every timing as the book writes it', () => {
    expect(tb.infoLines).toBe(1);
    expect(tb.speechLines).toBe(1);
    expect(tb.crossFadeSeconds).toBe(0.15);
    expect(tb.repeatSeconds).toBe(20);
    expect(tb.infoHoldSeconds).toBe(2.5);
    expect(tb.speechHold).toEqual({ base: 1, perChar: 0.05, min: 2, max: 5 });
    expect(tb.fadeOutSeconds).toBe(0.4);
    expect(tb.fadeInSeconds).toBe(0.15);
    expect(tb.placePercent).toBe(16);
    expect([tb.fightTiles, tb.fightBlowSeconds]).toEqual([12, 4]);
    expect([tb.heldDelaySeconds, tb.heldMaxAgeSeconds]).toEqual([1, 8]);
    expect([tb.promptFadeSeconds, tb.promptBackSeconds, tb.moveDoneTiles]).toEqual([0.5, 2, 2]);
    expect([tb.tipSeconds, tb.tipUses, tb.refusalSeconds]).toEqual([8, 2, 1.2]);
  });
});

/** Runs a director over frames of 1/60 s, returning what shows each frame. */
function frames(d: CaptionDirector, from: number, to: number, fight = false) {
  const out = [];
  for (let t = from; t <= to + 1e-9; t += 1 / 60) out.push({ t, ...d.update(t, fight) });
  return out;
}

describe('the caption view (DF-11)', () => {
  it('shows at most one information line and one speech line, however many arrive at once', () => {
    const d = new CaptionDirector(tb);
    for (let i = 0; i < 12; i++) {
      d.info(`Sound ${i}`, 'SOUND', 1);
      d.info(`Story ${i}`, 'STORY', 1);
      d.speech(`Hild: Line ${i}`, 1);
    }
    const f = d.update(1, false);
    expect(f.info?.text).toBe('Story 11');
    expect(f.speech?.text).toBe('Hild: Line 11');
    expect(f.outgoing).toHaveLength(0);
  });

  it('a new line replaces the old with a short cross-fade: they never stack or queue', () => {
    const d = new CaptionDirector(tb);
    d.speech('Hild: One.', 0);
    d.update(0, false);
    d.speech('Hild: Two.', 0.5);
    const f = d.update(0.5, false);
    expect(f.speech?.text).toBe('Hild: Two.');
    expect(f.outgoing.map((o) => o.text)).toEqual(['Hild: One.']);
    // The old line has faded out within the cross-fade; nothing waits to come back.
    const later = d.update(0.5 + tb.crossFadeSeconds + 0.01, false);
    expect(later.outgoing).toHaveLength(0);
    expect(frames(d, 0.7, 10).some((x) => x.speech?.text === 'Hild: One.')).toBe(false);
  });

  it('fades in and out at Book 10 timings: information 2.5 s, speech by its length', () => {
    const d = new CaptionDirector(tb);
    d.info('Surf breaking on the rocks', 'SOUND', 0);
    d.speech('Hild: Here! Over here, past the rocks!', 0);
    expect(d.update(0, false).info?.alpha).toBe(0);
    expect(d.update(0.15, false).info?.alpha).toBeCloseTo(1);
    expect(d.update(2.5, false).info?.alpha).toBe(1);
    expect(d.update(2.7, false).info?.alpha).toBeCloseTo(0.5);
    expect(d.update(2.95, false).info).toBeNull();
    // 38 characters: 1 + 0.05 x 38 = 2.9 s.
    expect(d.update(2.9, false).speech?.alpha).toBe(1);
    expect(d.update(3.31, false).speech).toBeNull();
  });

  it('suppresses a repeat within 20 s, and shows it again after', () => {
    const d = new CaptionDirector(tb);
    d.info("The water's too deep", 'SAFETY', 0);
    d.update(0, false);
    d.update(5, false);
    d.info("The water's too deep", 'SAFETY', 5);
    expect(d.update(5, false).info).toBeNull();
    d.info("The water's too deep", 'SAFETY', 21);
    expect(d.update(21, false).info?.text).toBe("The water's too deep");
  });

  it('never lets a lower class cut a higher one short while it holds', () => {
    const d = new CaptionDirector(tb);
    d.info('A horn call from the north', 'SAFETY', 0);
    d.update(0, false);
    d.info('Trouble at the fire', 'STORY', 1);
    expect(d.update(1, false).info?.text).toBe('A horn call from the north');
    d.info('Nothing that way', 'SAFETY', 1.5);
    expect(d.update(1.5, false).info?.text).toBe('Nothing that way');
  });

  it('in a fight shows only speech and safety lines, and one held line after it', () => {
    const d = new CaptionDirector(tb);
    d.update(0, true);
    d.info('Bran is safe at the camp', 'STORY', 0.5);
    d.info('Trouble at the fire', 'STORY', 0.6);
    d.speech('Ketill: There!', 0.6);
    let f = d.update(0.6, true);
    expect(f.info).toBeNull();
    expect(f.speech?.text).toBe('Ketill: There!');
    expect(f.held).toBe('Trouble at the fire');
    d.info('Nothing that way', 'SAFETY', 1);
    f = d.update(1, true);
    expect(f.info?.text).toBe('Nothing that way');
    // The fight ends at 3 s: the held line shows 1 s later, still fresh.
    d.update(3, false);
    expect(d.update(3.3, false).info?.text).toBe('Nothing that way');
    f = d.update(4.01, false);
    expect(f.info?.text).toBe('Trouble at the fire');
  });

  it('drops the held line if it is 8 s old when the fight ends', () => {
    const d = new CaptionDirector(tb);
    d.update(0, true);
    d.info('Conn is safe at the camp', 'STORY', 0.1);
    d.update(0.1, true);
    d.update(9, false);
    expect(d.update(10.1, false).info).toBeNull();
    expect(d.update(10.1, false).held).toBeNull();
  });

  it('turns information lines off apart from speech (Book 2 section 21)', () => {
    const d = new CaptionDirector(tb);
    d.showInfo = false;
    d.info('Hild, calling from the west', 'DIRECTION', 0);
    d.speech('Hild: Here!', 0);
    const f = d.update(0, false);
    expect(f.info).toBeNull();
    expect(f.speech?.text).toBe('Hild: Here!');
  });

  it('never shows more than one of each, nor a non-safety line in a fight, over random streams', () => {
    const classes: InfoClass[] = ['SAFETY', 'DIRECTION', 'STORY', 'SOUND'];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            dt: fc.double({ min: 0, max: 3, noNaN: true }),
            kind: fc.constantFrom('info', 'speech', 'none'),
            cls: fc.constantFrom(...classes),
            text: fc.integer({ min: 0, max: 6 }),
            fight: fc.boolean(),
          }),
          { maxLength: 60 },
        ),
        (events) => {
          const d = new CaptionDirector(tb);
          let t = 0;
          for (const e of events) {
            t += e.dt;
            if (e.kind === 'info') d.info(`line ${e.text}`, e.cls, t);
            if (e.kind === 'speech') d.speech(`Hild: line ${e.text}`, t);
            const f = d.update(t, e.fight);
            const live = [f.info, f.speech].filter((x) => x !== null);
            if (live.length > 2) return false;
            if (f.info !== null && f.info.kind !== 'info') return false;
            if (f.speech !== null && f.speech.kind !== 'speech') return false;
            if (e.fight && f.info !== null && f.info.cls !== 'SAFETY') return false;
            if (f.outgoing.some((o) => o.alpha > 1)) return false;
          }
          return true;
        },
      ),
    );
  });

  it("knows a fight by Book 10's inFight: an alert hostile within 12 tiles, or a blow in 4 s", () => {
    expect(inFight([{ alert: true, tiles: 11.9 }], 99, tb)).toBe(true);
    expect(inFight([{ alert: true, tiles: 12.5 }], 99, tb)).toBe(false);
    expect(inFight([{ alert: false, tiles: 2 }], 99, tb)).toBe(false);
    expect(inFight([], 3.9, tb)).toBe(true);
    expect(inFight([], 4.1, tb)).toBe(false);
  });
});

describe('the text audit (Book 8 section 10; DF-13, DF-80)', () => {
  const captionKeys = [...content.strings.keys()].filter(
    (k) =>
      k.startsWith('caption.') &&
      !k.startsWith('caption.format.') &&
      !k.startsWith('caption.direction.'),
  );

  it('has a verdict for every caption string and every sound caption', () => {
    const cueKeys = (content.audio?.cues ?? []).flatMap((c) => c.captionKey ?? []);
    const unlisted = [...new Set([...captionKeys, ...cueKeys])].filter(
      (k) => auditInfo(k).show === false && (auditInfo(k) as { why: string }).why === 'UNLISTED',
    );
    expect(unlisted).toEqual([]);
  });

  it('never shows a combat or missile sound, in any mode (DF-80): the drawn twin is the cue', () => {
    const combat = (content.audio?.cues ?? [])
      .filter((c) =>
        /^SFX_(LIGHT|HEAVY|HIT|BLOCK|PARRY|GUARD|CHARGE|DODGE|SHOVE|GRUNT|STEERER_BREATH|RIPOSTE|LUNGE|BACKSTAB|SIDESTEP|ALERT|GORE|DOWNED|BODY|WEAPON|BOW|ARROW|SPEAR|QUIVER)/.test(
          c.id,
        ),
      )
      .map((c) => c.captionKey ?? '');
    expect(combat.length).toBeGreaterThan(20);
    for (const k of combat) {
      const v = auditInfo(k);
      // The arrow from out of sight alone is kept, and only when the presentation says the shooter
      // is unseen (never from the router's sound).
      if (k === 'caption.sfx.arrow_flight')
        expect(v).toEqual({ show: true, cls: 'SAFETY', unseenOnly: true });
      else expect(v.show, k).toBe(false);
    }
    // A combat sound the combat rebuild adds later is not listed, so it is never shown either.
    expect(auditInfo('caption.sfx.telegraph_heavy').show).toBe(false);
    expect(auditInfo('caption.sfx.some_new_fight_sound').show).toBe(false);
  });

  it('keeps, cuts and merges as the audit table says', () => {
    const verdict = (k: string): string => {
      const v = auditInfo(k);
      return v.show ? v.cls : v.why;
    };
    expect(verdict('caption.voice.hild_calling')).toBe('DIRECTION');
    expect(verdict('caption.voice.approach')).toBe('CUT');
    expect(verdict('caption.search.chest_lost')).toBe('STORY');
    expect(verdict('caption.search.neck_gale')).toBe('SAFETY');
    expect(verdict('caption.info.surrender')).toBe('CUT');
    expect(verdict('caption.info.flee')).toBe('CUT');
    expect(verdict('caption.info.brought_home')).toBe('STORY');
    expect(verdict('caption.info.finish_warning')).toBe('SAFETY');
    expect(verdict('caption.info.second_wind')).toBe('SAFETY');
    expect(verdict('ui.heal.bind')).toBe('CUT');
    expect(verdict('caption.edge.deep')).toBe('SAFETY');
    expect(verdict('caption.door.open')).toBe('CUT');
    expect(verdict('caption.action.net_parts')).toBe('CUT');
    expect(verdict('caption.cold.storm')).toBe('CUT');
    expect(verdict('caption.cold.shout')).toBe('MERGED');
    expect(verdict('caption.hag.light')).toBe('DIRECTION');
    expect(verdict('caption.hag.whisper')).toBe('STORY');
    expect(verdict('caption.hag.hush')).toBe('CUT');
    expect(verdict('caption.hag.gust')).toBe('CUT');
    expect(verdict('caption.music.hearth')).toBe('CUT');
    expect(verdict('caption.stinger.horn')).toBe('SAFETY');
    expect(verdict('caption.stinger.dispute')).toBe('STORY');
    expect(verdict('caption.stinger.chapter_end')).toBe('CUT');
    expect(verdict('caption.tell.draugr')).toBe('SAFETY');
    expect(verdict('caption.sfx.tell_ran')).toBe('SAFETY');
    expect(verdict('caption.sfx.task_cook')).toBe('CUT');
    expect(verdict('caption.repair.oar_seen')).toBe('STORY');
    expect(verdict('caption.repair.oar_taken')).toBe('CUT');
    expect(verdict('caption.rites.gather')).toBe('CUT');
    expect(verdict('caption.launch.afloat')).toBe('CUT');
    expect(verdict('caption.amb.strand')).toBe('CUT');
    // The prompt line's notices are refusal words now.
    for (const key of Object.values(NOTICE_REFUSALS)) expect(content.strings.has(key)).toBe(true);
  });

  it('counts the audit: how many caption strings are kept, cut and merged', () => {
    const tally: Record<string, number> = {};
    for (const k of captionKeys) {
      const v = auditInfo(k);
      const key = v.show ? 'KEEP' : v.why;
      tally[key] = (tally[key] ?? 0) + 1;
    }
    console.log(`audit over ${captionKeys.length} caption strings: ${JSON.stringify(tally)}`);
    expect(
      (tally['KEEP'] ?? 0) + (tally['CUT'] ?? 0) + (tally['MERGED'] ?? 0) + (tally['COMBAT'] ?? 0),
    ).toBe(captionKeys.length);
  });
});

describe('tutorial prompts and tooltips (DF-12)', () => {
  it('fade out during a narrative line, come back 2 s after it, and go for good once done', () => {
    const p = new PromptFade(tb);
    let t = 0;
    const run = (until: number, wanted: boolean, quiet: boolean): number => {
      let a = 0;
      for (; t < until - 1e-9; t += 1 / 60) a = p.update(t, wanted, quiet);
      return a;
    };
    expect(run(1, true, false)).toBe(1);
    // A speech line shows: faded out within promptFade (0.5 s), never blinking off.
    const mid = run(1.25, true, true);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(run(1.6, true, true)).toBe(0);
    // Quiet ends at 3 s; the prompt stays away 2 s more, then fades back in.
    run(3, true, true);
    expect(run(4.9, true, false)).toBe(0);
    expect(run(5.6, true, false)).toBe(1);
    p.done();
    expect(run(6.2, true, false)).toBe(0);
    expect(run(20, true, false)).toBe(0);
  });

  it('a tooltip shows 8 s of play (not counting time hidden), or until used twice', () => {
    const tip = new TipLife(tb);
    let t = 0;
    for (; t < 4; t += 1 / 60) tip.update(t, false);
    // Hidden for 10 s by a talk: its time does not run.
    for (; t < 14; t += 1 / 60) tip.update(t, true);
    expect(tip.over).toBe(false);
    for (; t < 25; t += 1 / 60) tip.update(t, false);
    expect(tip.over).toBe(true);
    const used = new TipLife(tb);
    for (t = 0; t < 1; t += 1 / 60) used.update(t, false);
    used.used();
    used.used();
    for (; t < 2; t += 1 / 60) used.update(t, false);
    expect(used.over).toBe(true);
  });
});

describe('the cursor in cinematic moments (DF-15)', () => {
  it('is hidden through the cold open, the black and the waking until the first input, and scenes', () => {
    const base = {
      phase: 'PLAY' as const,
      gettingUp: true,
      scene: false,
      rites: false,
      launch: false,
    };
    expect(cinematicNow({ ...base, phase: 'COLD_OPEN' })).toBe(true);
    expect(cinematicNow({ ...base, phase: 'WAKING', gettingUp: false })).toBe(true);
    expect(cinematicNow({ ...base, phase: 'WAKING', gettingUp: true })).toBe(false);
    expect(cinematicNow({ ...base, scene: true })).toBe(true);
    expect(cinematicNow({ ...base, rites: true })).toBe(true);
    expect(cinematicNow({ ...base, launch: true })).toBe(true);
    expect(cinematicNow(base)).toBe(false);
  });

  it('shows again on the first mouse movement once control returns, or when a pointer use is offered', () => {
    const g = new CursorGate();
    expect(g.update(true, false)).toBe(true);
    g.mouseMoved();
    expect(g.update(true, false)).toBe(true);
    expect(g.update(false, false)).toBe(true);
    g.mouseMoved();
    expect(g.update(false, false)).toBe(false);
    expect(g.update(true, false)).toBe(true);
    expect(g.update(false, true)).toBe(false);
  });
});
