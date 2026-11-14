import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const OUT = '/tmp/claude-0/-home-user-oar-and-ember/16c80e56-1f62-56fa-a317-d501a042e90d/scratchpad/shots';
const server = await createServer({ root: '/home/user/oar-and-ember', server: { port: 5391, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto('http://localhost:5391/?capture&quality=full&view=play&name=Ash&body=A&camp=broch&crew=1&launch=done&time=10:00&zone=ZONE_SK_STRAND&dev');
  await page.waitForSelector('canvas#screen[data-state=play]', { timeout: 60000 });
  const step = (n: number, ms = 40) => page.evaluate(([n, ms]) => { for (let i = 0; i < n; i++) (window as any).oeStep(ms); }, [n, ms] as const);
  const attr = (k: string) => page.locator('.oe-overlay').getAttribute(`data-${k}`);
  await step(5);
  await page.keyboard.press('KeyM');
  await step(3);
  console.log('sea', await attr('sea'), 'menu', await attr('menu'));
  await page.screenshot({ path: `${OUT}/plot.png` });
  await page.locator('[data-panel=plot] [data-place=SITE_CARRICK]').click();
  await step(2);
  await page.screenshot({ path: `${OUT}/plot-carrick.png` });
  console.log(await page.locator('[data-panel=plot]').innerText());
  await page.locator('[data-panel=plot] [data-action=sail]').click();
  await step(3);
  console.log('after sail', await attr('sea'), await attr('sea-status'), await attr('day'), await attr('time'));
  await page.screenshot({ path: `${OUT}/choice.png` });
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 80; i++) {
    await step(5, 50);
    if (i % 5 === 0) console.log(i, await attr('sea'), await attr('sea-status'), await attr('sea-watches'), await attr('sea-token'), await page.evaluate(() => { const w = (window as any).oeWorld; return `${w.calendar.day} ${w.calendar.minuteOfDay}`; }));
    if (i === 12) await page.screenshot({ path: `${OUT}/sail.png` });
    if ((await attr('sea')) === 'landing') break;
  }
  await page.screenshot({ path: `${OUT}/landing.png` });
  console.log(await page.locator('.oe-sea').innerText().catch(() => 'none'));
  await page.locator('[data-panel=landing] [data-action=stay]').click();
  await step(3);
  for (let i = 0; i < 80 && (await attr('sea')) !== 'landing'; i++) await step(5, 50);
  console.log('2nd', await page.locator('.oe-sea').innerText().catch(() => 'none'));
  await page.screenshot({ path: `${OUT}/landing2.png` });
  await page.locator('[data-panel=landing] [data-action=stay]').click();
  await step(3);
  console.log('stay', await attr('sea'), await attr('sea-status'), await attr('sea-at'));
  await page.locator('[data-panel=plot] [data-place=ABBEY_KILBRECC]').click().catch(() => console.log('no kilbrecc'));
  await step(2);
  console.log(await page.locator('.oe-sea').innerText().catch(() => 'none'));
  await page.screenshot({ path: `${OUT}/anchored.png` });
  await page.locator('[data-panel=plot] [data-action=home]').click();
  for (let i = 0; i < 80; i++) { await step(5, 50); if ((await attr('sea')) === '' ) break; }
  console.log('home', await attr('sea'), await attr('sea-status'), await page.evaluate(() => (window as any).oeWorld.onFoot?.zone));
  await page.screenshot({ path: `${OUT}/home.png` });
  const t0 = Date.now(); await step(20, 40); console.log('frameMs', await attr('frame-ms'), (Date.now() - t0) / 20);
} finally { await browser.close(); await server.close(); }
