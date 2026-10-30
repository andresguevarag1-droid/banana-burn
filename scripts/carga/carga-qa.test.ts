import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { hitLimit } from '@/lib/security/limits';
import { normalizeWorkout } from '@/app/(app)/app/entreno/validate';
import { processUpload } from '@/lib/runs';

vi.mock('@/lib/supabase/admin', () => ({ adminClient: () => null }));

const script = readFileSync(new URL('./carga.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export const options', 'const options')
  .replace('export default function', 'function journey');

describe('QA: carga sostenida y contratos de escritura', () => {
  it('completa la rampa y HOLD documentados sin agotar el límite de GPS', async () => {
    // Un VU activado al inicio de la rampa de cinco minutos, seguido por diez de HOLD.
    // HTTP instantáneo representa un preview rápido; solo sleep avanza el reloj.
    let now = Date.UTC(2026, 9, 30, 12);
    const start = now;
    const uploads: number[] = [];
    const context = vm.createContext({
      __ENV: { SUPABASE_URL: 'http://127.0.0.1:54321', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
        TEST_PASSWORD: 'synthetic-placeholder', ANON_KEY: 'public-placeholder', WORKOUT_ACTION_ID: 'test-build',
        VUS: '1000', RAMP: '5m', HOLD: '10m' },
      __VU: 1, Date: class extends Date { static now() { return now; } },
      encoding: { b64encode: () => 'synthetic-cookie' }, Rate: class { add() {} },
      check: Boolean, fail: (label: string) => { throw new Error(label); },
      sleep: (seconds: number) => { now += seconds * 1000; },
      http: {
        get: () => ({ status: 200 }), cookieJar: () => ({ set() {} }),
        post: (url: string, body: string) => {
          if (url.endsWith('/app/entreno')) expect(normalizeWorkout(JSON.parse(body)[0])).not.toBeNull();
          if (url.endsWith('/api/carreras')) {
            expect(processUpload(JSON.parse(body).segments)).not.toBeNull();
            uploads.push(now);
          }
          return { status: 200, body: '1:{"ok":true}',
            json: (key?: string) => key === 'id' ? 'synthetic-id' : key === 'demo' ? false : { access_token: 'placeholder' } };
        },
      },
    });
    vm.runInContext(script, context);
    while (now - start < 900_000) vm.runInContext('journey()', context);
    const rejected: number[] = [];
    for (const [i, at] of uploads.entries()) {
      if (!(await hitLimit('carreras:guardar', 'qa53-sustained-vu', { db: null, now: at })).ok) rejected.push(i + 1);
    }
    expect(rejected, 'Las carreras de la corrida documentada deben quedar dentro del límite real').toEqual([]);
  });
});

const seed = readFileSync(new URL('./seed.mjs', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
async function seedWith(overrides = {}, createError = false) {
  const created: unknown[] = [], profiles: unknown[] = [];
  await vm.runInNewContext(`(async () => { ${seed} })()`, {
    process: { env: { SUPABASE_URL: 'http://127.0.0.1:54321', TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
      CONFIRM_DISPOSABLE: 'yes', TEST_PASSWORD: 'synthetic-placeholder', USERS: '2', ...overrides } },
    console: { log() {} },
    createClient: () => ({ auth: { admin: { createUser: async (user: unknown) => {
      created.push(user); return { data: { user: { id: 'synthetic-id' } }, error: createError ? {} : null };
    } } }, from: () => ({ update: (profile: unknown) => {
      profiles.push(profile); return { eq: async () => ({ error: null }) };
    } }) }),
  });
  return { created, profiles };
}

describe('QA: semilla sintética', () => {
  it('crea únicamente las cuentas sintéticas y completa sus perfiles', async () => {
    const result = await seedWith();
    expect(result.created).toMatchObject([
      { email: 'carga-0001@example.invalid', email_confirm: true },
      { email: 'carga-0002@example.invalid', email_confirm: true },
    ]);
    expect(result.profiles).toHaveLength(2);
    expect(result.profiles).toEqual(expect.arrayContaining([expect.objectContaining({ onboarded: true, plan: 'pro' })]));
  });
  it('rechaza bases no confirmadas y tamaños inválidos', async () => {
    await expect(seedWith({ CONFIRM_DISPOSABLE: 'no' })).rejects.toThrow('Confirma');
    await expect(seedWith({ TEST_SUPABASE_URL: 'http://different.invalid' })).rejects.toThrow('Confirma');
    for (const USERS of ['0', '1001', '1.5']) await expect(seedWith({ USERS })).rejects.toThrow('USERS');
  });
  it('se detiene si una cuenta ya existe', async () => {
    await expect(seedWith({}, true)).rejects.toThrow('usa un proyecto vacío');
  });
});
