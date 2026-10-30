# Programa de referidos: piezas del lanzamiento

| Pieza | Archivo |
| --- | --- |
| Texto para compartir desde la app (WhatsApp y otras redes) | [compartir.md](compartir.md) |
| Correo "Invita a 3 amigos y gana 1 mes gratis" | [correo-invita-y-gana.md](correo-invita-y-gana.md) |
| Página de reglas | [reglas.md](reglas.md) |

**Qué métrica mueve:** costo por cliente que paga. Los registros por referido no tienen costo de anuncio; cada uno que paga baja el promedio del mes. Métricas de control: cuentas que comparten su enlace, registros por referido, % que se activan en 7 días y % que compran el plan anual.

## UTMs

Todas las piezas usan `utm_source=referido` y `utm_campaign=invita-y-gana`. Cambia `utm_medium`:

| Pieza | utm_medium | utm_content |
| --- | --- | --- |
| Texto de WhatsApp | whatsapp | |
| Texto de otras redes | redes | |
| Correo, envío de lanzamiento | email | lanzamiento |
| Correo, ciclo de vida | email | segundo-entreno |
| Página de reglas | reglas | |

## Oferta contra código (revisado el 30 de octubre de 2026)

La oferta (3 amigos = 1 mes; plan anual = 1 trimestre) **coincide** con `src/lib/referrals.ts` (`REF_GROUP_SIZE = 3`, `REF_BASE_MONTHS = 1`, `REF_ANNUAL_MONTHS = 3`) y con `_referral_settle` y `referral_annual_paid` en `0025_regalos_referidos.sql`. Lo que la frase corta de la oferta no dice y las reglas sí aclaran:

1. **El trimestre reemplaza al mes, no se suma.** Un grupo con compra anual da 3 meses en total (1 + 2 si la compra llega después), no 4. Una sola subida por grupo aunque compren dos.
2. **La compra anual sola no da el trimestre.** Hace falta que ese grupo de 3 se complete, y la persona que compró tiene que activarse en sus primeros 7 días. Si compra anual y nunca se activa, no cuenta (queda "anotado" para siempre).
3. **Tope de 12 recompensas en 365 días** (`REF_MAX_REWARDS_YEAR`). La oferta no lo menciona; la app y las reglas sí.
4. **El plan del mes gratis** es Entreno si quien invita tiene Entreno y Entreno + Nutrición en cualquier otro caso.

## Diferencias del código que hay que resolver (no las toqué)

1. **Los UTM no llegan al registro.** `src/app/r/[code]/route.ts` redirige a `/entrar?modo=registro` y descarta los parámetros del enlace, y `referralLink()` arma el enlace sin UTM. Para que los UTM de estas piezas se midan, la ruta tiene que pasar los `utm_*` a `/entrar` y `referralLink()`/`shareMessage()` tienen que usar los textos de `compartir.md`. Mientras tanto, los registros por referido se cuentan desde la tabla `referrals`.
2. **El texto que comparte la app hoy es otro.** `shareMessage()` dice "rutina hecha para mí, con el peso de cada serie"; los textos nuevos están en `compartir.md` (dos versiones, una por canal).
3. **Solo ONVO confirma la compra anual.** `referral_annual_paid` se llama únicamente desde el webhook de ONVO (`src/lib/billing.ts`). Si en algún momento se vende el anual por App Store o Google Play, esa compra no subirá el grupo a trimestre.
4. **Familias en la misma casa pueden quedar "En revisión".** Si quien invita y su invitado usan la misma red y el mismo dominio de correo (por ejemplo, los dos con Gmail en el wifi de la casa), el invitado queda en revisión hasta que un admin lo apruebe o compre el anual. Con el lanzamiento puede crecer la cola del panel.
