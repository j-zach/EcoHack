// Build ../package/index.html: one offline file with the simulation data embedded.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const keys = ['amazon', 'budongo', 'osa', 'uk'];
const blobs = keys.map((k) => `<script type="application/json" id="data-${k}">${readFileSync(`public/data/${k}.json`, 'utf8').replace(/<\//g, '<\\/')}</script>`).join('\n');
const page = readFileSync('dist/index.html', 'utf8').replace('<script type="module">', `${blobs}\n<script type="module">`);
mkdirSync('../package', { recursive: true });
writeFileSync('../package/index.html', `<!doctype html>\n<html lang="en">\n${page}\n</html>\n`);
console.log('package/index.html', (page.length / 1e6).toFixed(1), 'MB');
