// Record README media from ../package/index.html. Usage: node record.mjs [landscape|sampler]
import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE = `file://${resolve('../package/index.html')}`;
const OUT = resolve('../media');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(name, hash, size, script, { clip, fps = 12, speed = 1, gifT = 20 } = {}) {
  const tmp = resolve(`.frames-${name}`);
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true }); mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  await page.setViewport({ width: size[0], height: size[1], deviceScaleFactor: 1 });
  await page.goto(`${PAGE}#${hash}`, { waitUntil: 'load' });
  const cdp = await page.createCDPSession();
  let n = 0;
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    writeFileSync(`${tmp}/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await sleep(1500);
  const t0 = Date.now();
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
  await script(page);
  await cdp.send('Page.stopScreencast');
  const secs = (Date.now() - t0) / 1000, rate = (n / secs).toFixed(2);
  await browser.close();
  const crop = clip ? `crop=${clip.w}:${clip.h}:${clip.x}:${clip.y},` : '';
  const vf = `${crop}setpts=PTS/${speed},fps=${fps}`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', rate, '-i', `${tmp}/%05d.jpg`, '-vf', `${vf},scale=1280:-2`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', `${OUT}/${name}.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-t', String(gifT), '-i', `${OUT}/${name}.mp4`, '-vf', `fps=8,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, `${OUT}/${name}.gif`]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(name, `${n} frames in ${secs.toFixed(0)}s (${rate} fps)`);
}

const click = (page, sel) => page.click(sel);
const which = process.argv[2];

if (!which || which === 'landscape') {
  await record('landscape', 'landscape', [1440, 900], async (page) => {
    await page.evaluate(() => scrollTo(0, document.querySelector('.rtabs').getBoundingClientRect().top + scrollY - 70));
    await sleep(2500);
    for (const [layer, round, wait] of [['unc', '0', 2500], ['unc', '2', 2500], ['unc', '9', 2500], ['pred', '9', 2500], ['truth', '9', 2500], ['habitat', '9', 2000]]) {
      await click(page, `#layers [data-l="${layer}"]`); await click(page, `#rounds [data-r="${round}"]`); await sleep(wait);
    }
  });
}
if (!which || which === 'sampler') {
  await record('sampler', 'field', [1440, 900], async () => { await sleep(72000); }, { speed: 2, gifT: 22 });
}
