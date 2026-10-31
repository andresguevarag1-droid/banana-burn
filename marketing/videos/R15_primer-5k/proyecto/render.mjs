// Motor local sin servicios externos. `check` no carga canvas ni produce medios.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { CONFIG, FPS, versiones, linea } from './escenas.mjs';
const aqui = dirname(fileURLToPath(import.meta.url));
const repo = join(aqui, '../../../..');
const salida = join(aqui, '..');
const cuenta = s => s.trim().split(/\s+/).length;
for (const nombre of Object.keys(versiones)) {
  const escenas = linea(nombre);
  assert.equal(escenas[0].inicio, 0);
  assert.equal(escenas.length, 9);
  assert.ok(versiones[nombre].duracion >= 15 && versiones[nombre].duracion <= 25);
  for (const e of escenas) {
    assert.ok(cuenta(e.texto + (e.etiqueta ? ` ${e.etiqueta}` : '')) <= 8, `${e.id}: más de 8 palabras`);
    const d = e.fin - e.inicio;
    assert.ok(e.tipo === 'cierre' ? d === 3 : d >= 1.5 && d <= 2.5);
    assert.ok(Number.isInteger(e.inicio * FPS) && Number.isInteger(e.fin * FPS));
  }
  if (['R11'].some(id => CONFIG.slug.startsWith(id))) {
    assert.ok(escenas.some(e => e.texto === 'No sustituye la indicación de tu médico.'));
  }
}
assert.ok(existsSync(join(repo, CONFIG.captura)), 'Falta captura real');
const modo = process.argv[2] ?? 'todo';
assert.ok(['todo', 'check', 'reel', 'anuncio', 'portada', 'hoja'].includes(modo));
if (modo === 'check') {
  console.log(`${CONFIG.slug}: tiempos, palabras, advertencias y captura OK; sin renderizar.`);
} else {
  const require = createRequire(import.meta.url);
  const pose = join(salida, 'assets/coach-banana-senala.png');
  assert.ok(existsSync(pose), 'Falta assets/coach-banana-senala.png oficial. Solicitar a Andrés; no sustituir.');
  const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
  for (const peso of [600, 800]) {
    assert.ok(GlobalFonts.registerFromPath(join(repo, `src/app/og/jakarta-${peso}.woff`), `Jakarta${peso}`), 'No se pudo cargar Plus Jakarta Sans');
  }
  let captura = await loadImage(readFileSync(join(repo, CONFIG.captura)));
  if (CONFIG.recorte) {
    const { x, y, w, h } = CONFIG.recorte;
    assert.ok(x >= 0 && y >= 0 && x+w <= captura.width && y+h <= captura.height);
    const recorte = createCanvas(w, h);
    recorte.getContext('2d').drawImage(captura, x, y, w, h, 0, 0, w, h);
    captura = recorte;
  }
  const coach = await loadImage(readFileSync(pose));
  const logo = await loadImage(readFileSync(join(repo, 'public/icons/logo.svg')));
  const W = 1080, H = 1920;
  const C = { paper: '#FFF8E3', banana: '#FFD60A', ink: '#1B1505' };
  // Resolver x(t) de cubic-bezier(0.23,1,0.32,1) para obtener y(t).
  function ease(x) {
    x = Math.max(0, Math.min(1, x));
    let lo = 0, hi = 1;
    const b = (t, a, c) => 3 * a * t * (1-t)**2 + 3 * c * t*t*(1-t) + t**3;
    for (let i = 0; i < 24; i++) {
      const t = (lo + hi) / 2;
      if (b(t, .23, .32) < x) lo = t; else hi = t;
    }
    return b((lo + hi) / 2, 1, 1);
  }
  function box(ctx, x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  // No separa palabras ni reduce por debajo de 38 px; falla si el texto no cabe.
  function texto(ctx, text, y, ancho = 900, size = 88, color = C.ink, maxAlto = 500) {
    let lines;
    for (; size >= 38; size -= 2) {
      ctx.font = `800 ${size}px Jakarta800`;
      lines = [''];
      for (const word of text.split(/\s+/)) {
        const i = lines.length - 1, test = [lines[i], word].filter(Boolean).join(' ');
        if (ctx.measureText(test).width > ancho && lines[i]) lines.push(word);
        else lines[i] = test;
      }
      if (lines.every(s => ctx.measureText(s).width <= ancho) && lines.length * size * 1.2 <= maxAlto) break;
    }
    assert.ok(size >= 38, 'Texto no cabe');
    assert.ok(y >= 250 && y + lines.length * size * 1.2 <= 1570, 'Texto fuera de zona segura');
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = color;
    lines.forEach((s, i) => ctx.fillText(s, W/2, y + i * size * 1.2));
  }
  function contain(ctx, img, x, y, w, h) {
    const scale = Math.min(w/img.width, h/img.height);
    ctx.drawImage(img, x+(w-img.width*scale)/2, y+(h-img.height*scale)/2, img.width*scale, img.height*scale);
  }
  function cuadro(nombre, tiempo) {
    const escenas = linea(nombre);
    const e = escenas.find(s => tiempo >= s.inicio && tiempo < s.fin) ?? escenas.at(-1);
    const local = tiempo - e.inicio;
    const c = createCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = e.id === 't1' ? C.banana : C.paper; ctx.fillRect(0, 0, W, H);
    // Recorte defensivo para que toda entrada permanezca en la zona segura.
    ctx.save(); ctx.beginPath(); ctx.rect(60, 250, 960, 1320); ctx.clip();
    if (e.tipo === 'cierre') {
      contain(ctx, coach, 200, 300, 680, 680);
      const press = local >= 1.5 && local < 1.8 ? 1 - .03 * Math.sin((local-1.5)/.3*Math.PI) : 1;
      ctx.save(); ctx.translate(540, 1120); ctx.scale(press, press); ctx.translate(-540, -1120);
      box(ctx, 70, 1030, 940, 180, 90, C.ink);
      texto(ctx, e.texto, 1060, 840, 44, C.paper, 130); ctx.restore();
      contain(ctx, logo, 470, 1300, 140, 140);
    } else {
      // Gancho totalmente visible en el cuadro 0; otras entradas duran 300 ms.
      const k = e.id === 't1' ? 1 : ease(local/.3);
      ctx.globalAlpha = k; ctx.translate(0, (1-k)*32);
      if (e.tipo === 'telefono') {
        texto(ctx, e.texto, 300, 900, 76, C.ink, 190);
        texto(ctx, e.etiqueta, 505, 900, 38, C.ink, 46);
        box(ctx, 300, 550, 480, 1000, 42, C.ink);
        contain(ctx, captura, 316, 566, 448, 968);
      } else {
        texto(ctx, e.texto, 620, 900, 100, C.ink, 500);
        // Barra decorativa sin cifras: no es un contador de resultados.
        box(ctx, 180, 1250, 720 * (.85 + .15 * Math.min(1, local/2)), 16, 8, C.ink);
      }
    }
    ctx.restore(); return c;
  }
  async function video(nombre) {
    const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
    const sufijo = nombre === 'anuncio' ? '_15s' : '';
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1080x1920', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', join(salida, CONFIG.slug+sufijo+'.mp4')], { stdio: ['pipe','inherit','inherit'] });
    let error;
    ff.stdin.on('error', e => { error = e; });
    const fin = new Promise((resolve, reject) => {
      ff.on('error', reject);
      ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg: ${code}`)));
    });
    // Observar desde el inicio para evitar rechazos sin capturar si falla el proceso.
    fin.catch(() => {});
    try {
      for (let i = 0; i < versiones[nombre].duracion * FPS; i++) {
        if (error) throw error;
        const rgba = cuadro(nombre, i/FPS).getContext('2d').getImageData(0,0,W,H).data;
        if (!ff.stdin.write(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength))) await once(ff.stdin, 'drain');
      }
      ff.stdin.end(); await fin;
    } catch (e) { ff.kill(); throw e; }
  }
  if (['todo', 'reel'].includes(modo)) await video('reel');
  if (['todo', 'anuncio'].includes(modo)) await video('anuncio');
  if (['todo', 'portada'].includes(modo)) writeFileSync(join(salida, CONFIG.slug+'_portada.png'), cuadro('reel', 0).toBuffer('image/png'));
  if (['todo', 'hoja'].includes(modo)) {
    const c = createCanvas(1080, 3*520), ctx = c.getContext('2d');
    ctx.fillStyle = C.paper; ctx.fillRect(0,0,c.width,c.height);
    linea('reel').forEach((e,i) => {
      const x = (i%3)*360+45, y = Math.floor(i/3)*520;
      ctx.drawImage(cuadro('reel', e.inicio+(e.id==='t1'?0:1)), x, y, 270, 480);
      ctx.strokeStyle = C.ink; ctx.setLineDash([4,4]); ctx.strokeRect(x,y+62.5,270,330); ctx.setLineDash([]);
      ctx.font = '600 18px Jakarta600'; ctx.fillStyle = C.ink;
      ctx.fillText(`${e.inicio}-${e.fin}s / ${cuenta(e.texto + (e.etiqueta ? ` ${e.etiqueta}` : ''))} palabras`, x, y+505);
    });
    writeFileSync(join(salida, CONFIG.slug+'_hoja-revision.png'), c.toBuffer('image/png'));
  }
}
