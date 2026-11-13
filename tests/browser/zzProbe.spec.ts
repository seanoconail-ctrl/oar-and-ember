import { expect, test } from '@playwright/test';
import { startPlay, step } from './strand.ts';

interface W {
  tick: number;
  people: Record<string, { status: string }>;
  onFoot: {
    carrying: string | null;
    player: { x: number; y: number };
    battle: { engaged: boolean; over: boolean } | null;
    actors: Record<
      string,
      {
        x: number;
        y: number;
        pose: string;
        fight?: { vitality: number; dead: unknown; f: { state: string; since: number } };
      }
    >;
  };
}

test('probe: lift downed Bran in the fold', async ({ page }) => {
  test.setTimeout(120_000);
  await startPlay(page, 'A', 'capture&kit=seax&camp=broch&time=10:00&zone=ZONE_SK_CAIRN&at=30,30');
  await step(page, 30);
  const before = await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: W }).oeWorld;
    const b = w.onFoot.actors['C_BRAN'];
    return { bran: b && { x: b.x / 24, y: b.y / 24, pose: b.pose }, keys: Object.keys(w.onFoot.actors), engaged: w.onFoot.battle?.engaged };
  });
  console.log(JSON.stringify(before));
  // Walk into view so the fight starts.
  for (let i = 0; i < 40; i++) {
    const engaged = await page.evaluate(() => (window as unknown as { oeWorld: W }).oeWorld.onFoot.battle?.engaged === true);
    if (engaged) break;
    await page.keyboard.down('KeyD');
    await step(page, 2);
    await page.keyboard.up('KeyD');
  }
  await step(page, 20);
  const staged = await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: W }).oeWorld;
    for (const id of ['E_WRECKER_KETILL', 'E_WRECKER_SVART', 'E_WRECKER_CONN']) {
      const a = w.onFoot.actors[id];
      if (a?.fight === undefined) continue;
      a.fight.vitality = 0;
      a.fight.f.state = 'dead';
      a.fight.f.since = w.tick;
      a.fight.dead = { tick: w.tick, piece: null, dir: 0 };
      a.pose = 'dead';
      const p = w.people[id];
      if (p) p.status = 'dead';
    }
    const b = w.onFoot.actors['C_BRAN'];
    if (b?.fight !== undefined) {
      b.fight.vitality = 0;
      b.fight.f.state = 'downed';
      b.fight.f.since = w.tick;
    }
    if (b) b.pose = 'down';
    const bp = w.people['C_BRAN'];
    if (bp) bp.status = 'downed';
    if (b) {
      w.onFoot.player.x = b.x - 16;
      w.onFoot.player.y = b.y;
    }
    return { bran: b && { x: b.x / 24, y: b.y / 24, f: b.fight?.f.state } };
  });
  console.log(JSON.stringify(staged));
  await step(page, 10);
  await page.keyboard.press('KeyE');
  const t0 = Date.now();
  for (let i = 0; i < 30; i++) {
    const s = Date.now();
    await step(page, 2);
    const d = Date.now() - s;
    if (d > 2000) console.log('slow frame', i, d);
  }
  const after = await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: W }).oeWorld;
    return { carrying: w.onFoot.carrying, tick: w.tick };
  });
  console.log(JSON.stringify(after), Date.now() - t0);
  // Walk with him.
  for (const k of ['KeyA', 'KeyS', 'KeyW', 'KeyD']) {
    await page.keyboard.down(k);
    await step(page, 10);
    await page.keyboard.up(k);
  }
  const moved = await page.evaluate(() => {
    const w = (window as unknown as { oeWorld: W }).oeWorld;
    return { carrying: w.onFoot.carrying, x: w.onFoot.player.x / 24, y: w.onFoot.player.y / 24, tick: w.tick };
  });
  console.log(JSON.stringify(moved));
  expect(true).toBe(true);
});
