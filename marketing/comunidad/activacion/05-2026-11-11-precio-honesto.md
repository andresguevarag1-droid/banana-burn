# 05. Cuánto cuesta: precio honesto

BORRADOR. Pendiente de aprobación escrita de Andrés. Instagram y Facebook. Se fija arriba del perfil de Instagram.

| Campo | Valor |
| --- | --- |
| Fecha y hora | Miércoles 11 de noviembre de 2026, 20:00 Costa Rica |
| Formato | Carrusel de 4 láminas, 1080 × 1350, fijado en el perfil |
| Para quién | Quien quiere saber el precio antes de registrarse |
| Gancho | «$9.99 al mes. O $59.99 al año» |
| Llamada a la acción | Prueba 7 días gratis: regístrate y haz tu primer entreno hoy (12 min, también en casa) |
| Enlace | https://bananaburn.app |
| Paso del embudo | Registro (quita la duda del precio) y, después, pago |

Reemplaza «Qué plan elegir» de Business Suite (7:00 p. m. del 11 nov), que se borra (fila 16 de la lista).

## Láminas

1. Fondo banana. «$9.99 al mes. O $59.99 al año.» Debajo, cuerpo: «USD, IVA incluido.»
2. Fondo paper. Dos tarjetas lado a lado:
   - **Entreno**: $9.99 al mes o $59.99 al año.
   - **Entreno + Nutrición**: $14.99 al mes o $89.99 al año.
   Lo que Entreno no incluye (nutrición) va tachado en su tarjeta. Pie de lámina: «USD, IVA incluido.»
3. Fondo paper. «Primeros 7 días gratis, sin tarjeta.» Debajo: «Si guardas tu tarjeta antes del primer cobro, tu primer mes mensual va al 50 %: $4.99 o $7.49. Una vez por cuenta. No aplica al anual.»
4. Fondo banana. «Antes de pagar, haz tu primer entreno.» Botón ink «Empieza 7 días gratis en bananaburn.app». Cuerpo: «12 min, también en casa.»

No escribir «equivale a $5 al mes» ni ningún precio por mes del anual: choca con el primer mes al 50 % y la app no lo muestra (`src/lib/plans.ts`). Si se quiere hablar de ahorro, usar el que muestra la app: ahorras $59.89 al año con Entreno y $89.89 con Entreno + Nutrición.

## Pie de foto

Precio claro: Entreno cuesta $9.99 al mes o $59.99 al año. Entreno + Nutrición, $14.99 al mes o $89.99 al año. USD, IVA incluido.

Empiezas con 7 días gratis y sin tarjeta. Si guardas tu tarjeta antes del primer cobro, tu primer mes mensual va al 50 % (una vez por cuenta, no aplica al anual).

Antes de pagar, prueba: regístrate y haz tu primer entreno hoy (12 min, también en casa). bananaburn.app

#BananaBurn #EntrenadorPersonal #Fuerza #PrimerEntreno #EntrenaEnCasa

## Medición

Alcance, guardados y clics de enlace a las 24 h; cuentas nuevas del día y, desde el 18 nov, cobros con status 'succeeded' en `trial_charges` de esas cohortes (agregado, sin atribuir a la pieza). Resultado: por medir.
