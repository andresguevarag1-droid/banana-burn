import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
const source = readFileSync(new URL('./carga.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace('export const options', 'const options')
  .replace('export default function', 'function journey') + '\njourney();';
function run(overrides = {}) {
  const calls: { url: string; body?: string }[] = [];
  const context = {
    __ENV: { BASE_URL: 'http://localhost:3000', SUPABASE_URL: 'http://127.0.0.1:54321',
      TEST_SUPABASE_URL: 'http://127.0.0.1:54321', TEST_PASSWORD: 'synthetic-placeholder', ANON_KEY: 'public-placeholder', WORKOUT_ACTION_ID: 'build-id', ...overrides },
    __VU: 1, encoding: { b64encode: () => 'synthetic-cookie' },
    Rate: class { add() {} }, check: (value: unknown) => !!value,
    fail: (label: string) => { throw new Error(label); }, sleep() {},
    http: {
      get(url: string) { calls.push({ url }); return { status: 200 }; },
      cookieJar: () => ({ set() {} }),
      post(url: string, body: string) {
        calls.push({ url, body });
        return { status: 200, body: '1:{"ok":true}', json: (key?: string) => key === 'id' ? 'synthetic-id' : key === 'demo' ? false : { access_token: 'placeholder' } };
      },
    },
  };
  vm.runInNewContext(source, context);
  return calls;
}
describe('carga protocol and destination guard', () => {
  it('rejects production, unconfirmed previews and different databases before HTTP', () => {
    expect(() => run({ BASE_URL: 'https://bananaburn.app' })).toThrow('Solo localhost');
    expect(() => run({ BASE_URL: 'https://preview.vercel.app' })).toThrow('Solo localhost');
    expect(() => run({ TEST_SUPABASE_URL: 'http://other' })).toThrow('Falta configuración');
  });
  it('visits pages and sends synthetic series and GPS through real endpoints', () => {
    const calls = run();
    expect(calls.map((c) => c.url)).toEqual([
      'http://localhost:3000/', 'http://127.0.0.1:54321/auth/v1/token?grant_type=password',
      'http://localhost:3000/app', 'http://localhost:3000/app/entreno',
      'http://localhost:3000/app/entreno', 'http://localhost:3000/app/correr', 'http://localhost:3000/api/carreras',
    ]);
    expect(JSON.parse(calls[4].body!)[0].exercises[0].sets).toHaveLength(2);
    expect(JSON.parse(calls[6].body!).segments[0]).toHaveLength(121);
  });
});
