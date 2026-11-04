// Motor local sin servicios externos. `check` no carga canvas ni produce medios.
import { existsSync, readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { CONFIG, FPS, versiones, linea } from './escenas.mjs';
const aqui = dirname(fileURLToPath(import.meta.url));
const repo = join(aqui, '../../../..');
const salida = join(aqui, '..');
const cuenta = s => s.trim().split(/\s+/).length;
for (const nombre of Object.keys(versiones)) {
  const escenas = linea(nombre);
  assert.equal(escenas[0].inicio, 0);
  assert.equal(escenas.length, nombre === 'reel' ? CONFIG.escenas.length : 7);
  assert.ok(nombre === 'reel' ? versiones[nombre].duracion >= 15 && versiones[nombre].duracion <= 25 : versiones[nombre].duracion === 15);
  for (const e of escenas) {
    assert.notEqual(e.tipo, 'pendiente', 'No quedan capturas pendientes');
    if (e.archivo) assert.ok(existsSync(join(repo, e.archivo)), e.archivo);
    assert.ok(cuenta(e.texto + (e.etiqueta ? ` ${e.etiqueta}` : '') + (e.tipo === 'pendiente' ? ` Pendiente de captura ${e.captura}` : '')) <= 8, `${e.id}: más de 8 palabras`);
    const d = e.fin - e.inicio;
    assert.ok(e.tipo === 'cierre' ? d === 3 : d >= 1.5 && d <= 2.5);
    assert.ok(Number.isInteger(e.inicio * FPS) && Number.isInteger(e.fin * FPS));
  }
}
assert.ok(existsSync(join(repo, CONFIG.captura)), 'Falta captura real');
const modo = process.argv[2] ?? 'todo';
assert.ok(['todo', 'check', 'reel', 'anuncio', 'portada', 'hoja'].includes(modo));
if (modo === 'check') {
  console.log(`${CONFIG.slug}: tiempos, palabras y captura OK; sin renderizar.`);
} else {
  const require = createRequire(import.meta.url);
  const pose = join(repo, 'marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png');
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
  const original = await loadImage(readFileSync(join(repo, CONFIG.captura)));
  const medios = new Map();
  for (const e of CONFIG.escenas.filter(e => e.archivo)) {
    if (medios.has(e.archivo)) continue;
    if (e.tipo === 'video') {
      // C3 graba un viewport 390×844 en un lienzo 780×1688; quitar solo el gris vacío.
      const temporal = mkdtempSync(join(tmpdir(), 'bb-c3-'));
      try {
        const extraer = spawnSync(require('@ffmpeg-installer/ffmpeg').path,
          ['-v', 'error', '-i', join(repo, e.archivo), '-vf', 'crop=390:844:0:0,fps=30', join(temporal, '%03d.png')]);
        assert.equal(extraer.status, 0, extraer.stderr?.toString());
        const frames = [];
        for (const f of readdirSync(temporal).sort()) frames.push(await loadImage(readFileSync(join(temporal, f))));
        assert.ok(frames.length >= 60, 'C3 debe cubrir la escena');
        medios.set(e.archivo, frames);
      } finally { rmSync(temporal, { recursive: true, force: true }); }
    } else medios.set(e.archivo, await loadImage(readFileSync(join(repo, e.archivo))));
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
      contain(ctx, coach, 230, 300, 620, 660);

      const press = local >= 1.5 && local < 1.8 ? 1 - .03 * Math.sin((local-1.5)/.3*Math.PI) : 1;
      ctx.save(); ctx.translate(540, 1120); ctx.scale(press, press); ctx.translate(-540, -1120);
      box(ctx, 70, 1030, 940, 180, 90, C.ink);
      texto(ctx, e.texto, 1060, 840, 44, C.paper, 130); ctx.restore();
      contain(ctx, logo, 470, 1300, 140, 140);
    } else {
      // Gancho totalmente visible en el cuadro 0; otras entradas duran 300 ms.
      const k = e.id === 't1' ? 1 : ease(local/.3);
      ctx.globalAlpha = k; ctx.translate(0, (1-k)*32);
      if (e.tipo === 'telefono' || e.tipo === 'video') {
        texto(ctx, e.texto, 270, 900, 70, C.ink, 190);
        box(ctx, 110, 510, 860, 1040, 42, C.ink);
        if (e.texto === 'Sabes cuánto te falta') {
          ctx.drawImage(original, 0, 110, 780, 105, 130, 950, 820, 110);
        } else {
          const medio = e.archivo ? medios.get(e.archivo) : captura;
          const imagen = Array.isArray(medio) ? medio[Math.min(medio.length - 1, Math.floor(local * FPS))] : medio;
          // Ancho real de interfaz: 820 px (76 % del cuadro), sin deformar.
          // Si es alta, recorrerla completa dentro del teléfono. Se mantienen
          // el inicio y el final 0.35 s; C3 empieza por el botón del toque.
          const ancho = 820, alto = 1000, x = 130, y = 530;
          const escala = ancho / imagen.width;
          const altura = imagen.height * escala;
          const recorrido = Math.max(0, altura - alto);
          const pausaInicial = e.tipo === 'video' ? 1.2 : .35;
          const avance = Math.max(0, Math.min(1, (local - pausaInicial) / (e.fin - e.inicio - pausaInicial - .35)));
          const posicion = e.tipo === 'video' ? 1 - avance : avance;
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, ancho, alto); ctx.clip();
          ctx.drawImage(imagen, x, y + Math.max(0, (alto-altura)/2) - recorrido*posicion, ancho, altura);
          ctx.restore();
        }
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
    const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1080x1920', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'fast', '-threads', '2', '-movflags', '+faststart', join(salida, CONFIG.slug+sufijo+'.mp4')], { stdio: ['pipe','inherit','inherit'] });
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
  if (['todo', 'portada'].includes(modo)) writeFileSync(join(salida, 'portada.png'), cuadro('reel', 0).toBuffer('image/png'));
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
    // Inicio, centro y final permiten revisar toda captura con recorrido.
    const pantallas = linea('reel').filter(e => ['telefono', 'video'].includes(e.tipo));
    const detalle = createCanvas(1080, pantallas.length*520), dc = detalle.getContext('2d');
    dc.fillStyle = C.paper; dc.fillRect(0,0,detalle.width,detalle.height);
    pantallas.forEach((e, fila) => {
      [.3, (e.fin-e.inicio)/2, e.fin-e.inicio-.02].forEach((t, col) => {
        const x = col*360+45, y = fila*520;
        dc.drawImage(cuadro('reel', e.inicio+t), x, y, 270, 480);
        dc.font = '600 18px Jakarta600'; dc.fillStyle = C.ink;
        dc.fillText(`${e.id} / ${(e.inicio+t).toFixed(2)}s`, x, y+505);
      });
    });
    writeFileSync(join(salida, CONFIG.slug+'_hoja-recorrido.png'), detalle.toBuffer('image/png'));
  }
}
