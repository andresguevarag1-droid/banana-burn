import http from 'k6/http';
import encoding from 'k6/encoding';
import { check, fail, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const base = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const sb = (__ENV.SUPABASE_URL || '').replace(/\/$/, '');
const vus = Number(__ENV.VUS || 2);
const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base);
if (!local && (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(base) || __ENV.PREVIEW_URL !== base)) {
  throw new Error('Solo localhost o un preview .vercel.app confirmado con PREVIEW_URL');
}
if (!/^https?:\/\//.test(sb) || __ENV.TEST_SUPABASE_URL !== sb || !__ENV.TEST_PASSWORD || !__ENV.ANON_KEY || !__ENV.WORKOUT_ACTION_ID) {
  throw new Error('Falta configuración de proyecto Supabase desechable o Server Action');
}
if (!Number.isInteger(vus) || vus < 1 || vus > 1000) throw new Error('VUS debe ser 1..1000');
const errors = new Rate('journey_errors');
export const options = {
  scenarios: { journey: { executor: 'ramping-vus', startVUs: 0, stages: [
    { duration: __ENV.RAMP || '10s', target: vus },
    { duration: __ENV.HOLD || '30s', target: vus },
    { duration: '10s', target: 0 },
  ], gracefulRampDown: '30s' } },
  thresholds: { journey_errors: ['rate<0.01'], http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<3000'] },
};
function requireOK(ok, label) {
  const passed = check(ok, { [label]: (v) => !!v });
  errors.add(!passed);
  if (!passed) fail(label); // Nunca imprime cuerpos, sesiones ni credenciales.
}
function page(path) {
  const r = http.get(base + path, { redirects: 0, tags: { name: path } });
  requireOK(r.status === 200, path);
}
let session;
export default function () {
  page('/');
  if (!session) {
    const r = http.post(`${sb}/auth/v1/token?grant_type=password`, JSON.stringify({
      email: `carga-${String(__VU).padStart(4, '0')}@example.invalid`, password: __ENV.TEST_PASSWORD,
    }), { headers: { apikey: __ENV.ANON_KEY, 'Content-Type': 'application/json' }, tags: { name: 'login' } });
    requireOK(r.status === 200, 'login');
    session = r.json();
  }
  // Mismo formato base64url que @supabase/ssr; dividir evita cookies > 4 KB.
  const cookie = 'base64-' + encoding.b64encode(JSON.stringify(session), 'rawurl');
  const cookieName = `sb-${sb.split('//')[1].split('.')[0].split(':')[0]}-auth-token`;
  for (let i = 0; i < Math.ceil(cookie.length / 3000); i++) {
    http.cookieJar().set(base, cookie.length <= 3000 ? cookieName : `${cookieName}.${i}`, cookie.slice(i * 3000, (i + 1) * 3000));
  }
  page('/app');
  sleep(2);
  page('/app/entreno');
  const now = Date.now();
  const workout = { template: 'carga', startedAt: new Date(now - 600000).toISOString(), finishedAt: new Date(now).toISOString(), fun: 4,
    exercises: [{ id: 'squat', sets: [{ kg: 20, reps: 10, rir: 2 }, { kg: 20, reps: 10, rir: 2 }] }] };
  const w = http.post(base + '/app/entreno', JSON.stringify([workout]), { headers: {
    'Content-Type': 'text/plain;charset=UTF-8', 'Next-Action': __ENV.WORKOUT_ACTION_ID, Origin: base,
  }, tags: { name: 'guardar-series' } });
  requireOK(w.status === 200 && /"ok":true/.test(w.body) && !/"demo":true/.test(w.body), 'guardar series real');
  page('/app/correr');
  const segments = [Array.from({ length: 121 }, (_, i) => ({ t: now - 360000 + i * 3000, lat: i * 0.00008, lng: 0, acc: 5 }))];
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
  });
  const r = http.post(base + '/api/carreras', JSON.stringify({ clientId: uuid, segments }), {
    headers: { 'Content-Type': 'application/json', Origin: base }, tags: { name: 'guardar-gps' },
  });
  requireOK(r.status === 200 && !!r.json('id') && !r.json('demo'), 'guardar GPS real');
  sleep(30); // No saturar límites por usuario con carreras imposibles cada segundo.
}
