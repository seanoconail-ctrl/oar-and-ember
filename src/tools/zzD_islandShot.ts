// Package D scratch (not for commit): stills of a zone at a season and tide.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
const ROOT = '/home/user/oar-and-ember';
const OUT = '/tmp/claude-0/-home-user-oar-and-ember/16c80e56-1f62-56fa-a317-d501a042e90d/scratchpad/pkgD/shots';
const shots = process.argv.slice(2);
const server = await createServer({
  root: ROOT,
  server: { port: 5297 },
  logLevel: 'error',
  plugins: [{ name: 'lenient', transform: (code: string, id: string) => (id.includes('bundledContent') ? code.replace('throw new Error(', 'console.warn(') : null) }],
});
await server.listen();
const browser = await chromium.launch();
try {
  for (const spec of shots) {
    const [name, query] = spec.split('|');
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    page.on('pageerror', (e) => console.error('page error:', e.message.slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text().slice(0, 400)); });
    await page.goto(`http://localhost:5297/?quality=full&view=play&name=Ash&body=A&capture&${query}`);
    await page.waitForFunction(() => document.querySelector('canvas#screen')?.getAttribute('data-state') === 'play', null, { timeout: 240_000 });
    await page.addStyleTag({ content: '.oe-overlay { visibility: hidden !important; }' });
    await page.evaluate(() => { const w = window as unknown as { oeStep: (ms: number, d?: boolean) => void }; for (let i = 0; i < 80; i++) w.oeStep(50, i === 79); });
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await page.close();
    console.log('shot', name);
  }
} finally {
  await browser.close();
  await server.close();
}
