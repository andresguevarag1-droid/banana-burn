// Ejecutar después de npm ci en cada proyecto y de renderizar.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = new URL('./', import.meta.url);
for (const slug of readdirSync(base).filter(s => /^N0[123]_/.test(s))) {
  const proyecto = new URL(`${slug}/proyecto/`, base);
  const require = createRequire(new URL('render.mjs', proyecto));
  const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
  const { versiones } = await import(new URL('escenas.mjs', proyecto));
  const check = spawnSync(process.execPath, [new URL('render.mjs', proyecto).pathname, 'check'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  for (const [nombre, version] of Object.entries(versiones)) {
    const archivo = new URL(`${slug}/${slug}${nombre === 'anuncio' ? '_15s' : ''}.mp4`, base).pathname;
    const info = spawnSync(ffmpeg, ['-i', archivo], { encoding: 'utf8' }).stderr;
    const tiempo = info.match(/Duration: (\d+):(\d+):([\d.]+)/);
    assert.ok(tiempo, archivo);
    assert.equal(Number(tiempo[1])*3600 + Number(tiempo[2])*60 + Number(tiempo[3]), version.duracion);
    assert.match(info, /Video: h264/);
    assert.match(info, /yuv420p/);
    assert.match(info, /1080x1920/);
    assert.match(info, /30 fps/);
    const decode = spawnSync(ffmpeg, ['-v', 'error', '-i', archivo, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(decode.status, 0, decode.stderr);
    assert.equal(decode.stderr, '', archivo);
    console.log(`${slug} ${nombre}: ${version.duracion}s, H.264, 1080x1920, 30 fps, decodificación completa OK`);
  }
}
