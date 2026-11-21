// Inline the built JS and CSS into dist/index.html so the page ships as one file plus data.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dir = 'dist';
let html = readFileSync(`${dir}/index.html`, 'utf8');
html = html.replace(/<script type="module" crossorigin src="(?:\.\/|\/)?(assets\/[^"]+\.js)"><\/script>/g,
  (_, p) => `<script type="module">${readFileSync(`${dir}/${p}`, 'utf8').replace(/<\/script/g, '<\\/script')}</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="(?:\.\/|\/)?(assets\/[^"]+\.css)">/g,
  (_, p) => `<style>${readFileSync(`${dir}/${p}`, 'utf8')}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')
  .replace(/<!doctype html>|<\/?html[^>]*>|<\/?head>|<\/?body>|<meta name="viewport"[^>]*>/gi, '');
html = '<meta charset="utf-8">\n' + html.replace(/<meta charset[^>]*>/gi, '');
writeFileSync(`${dir}/index.html`, html);
console.log('inlined', (html.length / 1e6).toFixed(2), 'MB;', readdirSync(`${dir}/assets`).join(', '));
