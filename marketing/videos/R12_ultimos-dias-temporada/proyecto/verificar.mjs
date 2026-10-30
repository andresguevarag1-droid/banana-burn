import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {REEL, ANUNCIO, FPS, linea, palabras} from './escenas.mjs';
// La fecha publicitaria debe seguir coincidiendo con las reglas de la temporada.
const seasons=readFileSync(new URL('../../../../src/lib/seasons.ts',import.meta.url),'utf8');
assert(seasons.includes('export const T1_START = "2026-11-09"'));
assert(/enrollUntil: addDaysIso\(startsOn, 13\)/.test(seasons));
assert(/endsOn: addDaysIso\(startsOn, SEASON_WEEKS \* 7 - 1\)/.test(seasons));
const require=createRequire(import.meta.url);
const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
const salida=fileURLToPath(new URL('../',import.meta.url));
for(const v of [REEL,ANUNCIO]) {
 const escenas=linea(v); assert.equal(escenas[0].inicio,0); assert.equal(escenas[0].id,'gancho');
 assert.equal(escenas.at(-1).id,'cierre');
 for(const e of escenas){assert(palabras(e.texto)<=8);const d=e.fin-e.inicio; assert(e.id==='cierre'?d===3:d>=1.5&&d<=2.5);}
 const info=execFileSync(ffmpeg,['-v','info','-i',salida+v.archivo,'-f','null','-'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 // Decode all frames, then inspect actual stream metadata.
 void info;
 let meta='';try{execFileSync(ffmpeg,['-hide_banner','-i',salida+v.archivo],{stdio:'pipe'});}catch(e){meta=e.stderr.toString();}
 assert(/Video: h264/.test(meta));assert(meta.includes('1080x1920'));assert(meta.includes(`${FPS} fps`));assert(!meta.includes('Audio:'));
 const m=meta.match(/Duration: (\d+):(\d+):([\d.]+)/); assert(m);assert.equal(+m[1]*3600 + +m[2]*60 + +m[3],v.duracion);
 console.log(`${v.archivo}: decodificación completa correcta, ${v.duracion}s, H.264 1080x1920 30fps, sin audio`);
}
const png=readFileSync(salida+'R12_ultimos-dias-temporada_portada.png');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920);
console.log('Textos, tiempos y portada correctos. La zona segura y el gancho requieren también revisión visual.');
