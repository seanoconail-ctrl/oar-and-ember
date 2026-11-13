import { CampBot } from './campBot.ts';
import * as cr from './chapterRun.ts';
import { telemetryReport } from '../../sim/narrative/telemetry.ts';
let last: any = null;
const orig = CampBot.prototype.step;
CampBot.prototype.step = function (this: CampBot, n?: number) {
  last = (this as any).sim?.state ?? last;
  return orig.call(this, n);
};
const pace = process.argv[2] === 'bot' ? cr.BOT_PACE : cr.HUMAN_PACE;
try {
  cr.playChapter('chapter-1', pace);
  console.log('completed');
} catch (e) {
  console.log('stopped:', String(e).split('\n')[0]);
}
if (last) {
  const r = telemetryReport(last);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  console.log('played', fmt(r.now), 'held', fmt(r.held));
  for (const m of r.marks) {
    const at = last.telemetry.marks[m.key];
    console.log(
      m.key.padEnd(17),
      fmt(m.seconds).padEnd(7),
      at
        ? `day ${at.day} ${String(Math.floor(at.minute / 60)).padStart(2, '0')}:${String(at.minute % 60).padStart(2, '0')}`
        : '',
    );
  }
}
