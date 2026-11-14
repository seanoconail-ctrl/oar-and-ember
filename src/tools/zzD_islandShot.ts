// node shot.ts ZONE x y [time] [extra]: a still and the motion share with the camera still.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { continuousMotion } from '/home/user/oar-and-ember/src/tools/art/motion.ts';
import { decodePng } from '/home/user/oar-and-ember/src/tools/art/png.ts';
const [zone, x, y, time = '14:00', extra = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5179/?view=play&name=Ash&body=A&quality=full&camp=broch&crew=1&time=${time}&zone=${zone}&at=${x},${y}${extra}`);
await page.locator('canvas#screen[data-state="play"]').waitFor({ timeout: 60000 });
await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
await page.waitForTimeout(3000);
const dir = '/tmp/claude-0/-home-user-oar-and-ember/16c80e56-1f62-56fa-a317-d501a042e90d/scratchpad/z/';
const first = await page.screenshot({ path: `${dir}${zone}-${x}-${y}.png` });
const shots: Uint8Array[] = [decodePng(first).data];
for (let i = 0; i < 32; i++) { await page.waitForTimeout(120); shots.push(decodePng(await page.screenshot()).data); }
const share = continuousMotion(shots, 640, 360).share;
console.log(`${zone} (${x},${y}): motion ${(share * 100).toFixed(1)}%; zone ${await page.locator('.oe-overlay').getAttribute('data-zone')}; errors ${JSON.stringify(errors.slice(0, 3))}`);
await browser.close();
