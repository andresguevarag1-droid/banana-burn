// Solo proyecto desechable. No guarda contraseñas, llaves ni sesiones en disco.
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL;
if (!url || process.env.TEST_SUPABASE_URL !== url || process.env.CONFIRM_DISPOSABLE !== 'yes') {
  throw new Error('Confirma el proyecto desechable con TEST_SUPABASE_URL y CONFIRM_DISPOSABLE=yes');
}
const count = Number(process.env.USERS || 2);
if (!Number.isInteger(count) || count < 1 || count > 1000 || !process.env.TEST_PASSWORD) throw new Error('USERS 1..1000 y TEST_PASSWORD requeridos');
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (let i = 1; i <= count; i++) {
  const { data, error } = await sb.auth.admin.createUser({ email: `carga-${String(i).padStart(4, '0')}@example.invalid`,
    password: process.env.TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Carga sintética' } });
  if (error) throw new Error(`No se pudo crear usuario sintético ${i}; usa un proyecto vacío`);
  const { error: profileError } = await sb.from('profiles').update({ onboarded: true, plan: 'pro', health_consent_at: new Date().toISOString() }).eq('id', data.user.id);
  if (profileError) throw new Error(`No se pudo configurar perfil ${i}`);
}
console.log(`Creados ${count} usuarios sintéticos. Elimina el proyecto al terminar.`);
