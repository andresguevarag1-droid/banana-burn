import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PLANS, TRIAL_DAYS } from './plans';
import { usd2 as money } from './num';

const base = join(process.cwd(), 'marketing/videos');
const slugs = ['E01_empieza-antes-de-enero', 'E02_regalate-un-ano', 'E03_primera-semana-del-ano', 'E04_que-hace-distinto-banana-burn'];

describe('paquetes de enero #184', () => {
  it('mantiene netos y precios del documento alineados con planes', () => {
    const doc = readFileSync(join(base, 'E01-E04_medicion.md'), 'utf8');
    for (const plan of PLANS) {
      for (const billing of ['mes', 'anual'] as const) {
        const price = plan.price[billing];
        expect(doc).toContain(money(price));
        for (const rate of [0.039, 0.0425]) {
          const net = price / 1.13 - price * rate - 0.35;
          expect(doc).toContain(money(net));
          expect(doc).toContain(money(net * 100));
        }
      }
    }
    expect(TRIAL_DAYS).toBe(7);
    expect(doc).toContain("trial_charges.status = 'succeeded'");
    expect(doc).toContain('sin UTMs');
  });

  for (const slug of slugs) {
    it(`${slug}: guion y proyecto usan el mismo texto y recursos reales`, () => {
      const source = readFileSync(join(base, slug, 'proyecto/escenas.mjs'), 'utf8');
      const config = JSON.parse(source.slice(source.indexOf('{'), source.indexOf(';\nexport const FPS')));
      const doc = readFileSync(join(base, slug, 'guion.md'), 'utf8');
      expect(existsSync(join(process.cwd(), config.captura))).toBe(true);
      expect(config.escenas).toHaveLength(9);
      for (const scene of config.escenas) {
        expect(doc).toContain(scene.texto);
        expect(`${scene.texto} ${scene.etiqueta ?? ''}`.trim().split(/\s+/).length).toBeLessThanOrEqual(8);
      }
      expect(config.escenas.at(-1).texto).toBe('Empieza 7 días gratis en bananaburn.app');
      expect(config.escenas.some((s: {tipo: string}) => s.tipo === 'telefono')).toBe(true);
    });
  }
});
