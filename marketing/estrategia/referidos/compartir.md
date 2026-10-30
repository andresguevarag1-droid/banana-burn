# Texto para compartir desde la app (Invita y gana)

Lo que la persona manda desde **Invita y gana** (`/app/referidos`). Hay dos versiones: una para WhatsApp y una para otras redes (Instagram, Facebook, TikTok, Telegram, correo).

**Qué métrica mueve:** registros que llegan por referido, con costo de anuncio $0. Cada referido que paga baja el **costo por cliente que paga** del mes. Métrica de control: % de registros por referido que se activan (terminan la bienvenida y un primer entreno o registro en sus primeros 7 días).

## Enlace

La app arma el enlace con el código de cada persona (`{codigo}`, 8 caracteres). Cada versión lleva su UTM:

| Versión | Enlace |
| --- | --- |
| WhatsApp | `https://bananaburn.app/r/{codigo}?utm_source=referido&utm_medium=whatsapp&utm_campaign=invita-y-gana` |
| Otras redes | `https://bananaburn.app/r/{codigo}?utm_source=referido&utm_medium=redes&utm_campaign=invita-y-gana` |

Ver "Pendiente en el código" al final: hoy el enlace de la app no lleva UTM y `/r/{codigo}` no los pasa al registro.

## Versión WhatsApp

Corto, de tú, como lo escribiría una persona. Sin número de teléfono: WhatsApp abre el selector de contactos (`https://wa.me/?text=...`).

```text
Estoy entrenando con Banana Burn. Me dice qué hacer cada día, con cuánto peso y cuántas repeticiones. Pruébala 7 días gratis con mi enlace, sin tarjeta:
https://bananaburn.app/r/{codigo}?utm_source=referido&utm_medium=whatsapp&utm_campaign=invita-y-gana
```

## Versión otras redes

Para historias, publicaciones o mensajes directos. Un poco más de contexto, porque quien lo lee no siempre conoce a quien comparte.

```text
Bajé de peso y ahora estoy reconstruyendo músculo con Banana Burn. Es como tener un entrenador personal en el celular: qué entrenar hoy, con cuánto peso y cómo hacer cada movimiento.
Si quieres empezar conmigo, tienes 7 días gratis y no pide tarjeta:
https://bananaburn.app/r/{codigo}?utm_source=referido&utm_medium=redes&utm_campaign=invita-y-gana
```

Variante neutra (si la persona no bajó de peso, o no quiere decirlo). La app puede ofrecer las dos y que la persona elija:

```text
Estoy entrenando con Banana Burn: es como tener un entrenador personal en el celular. Qué entrenar hoy, con cuánto peso y cómo hacer cada movimiento.
Si quieres empezar conmigo, tienes 7 días gratis y no pide tarjeta:
https://bananaburn.app/r/{codigo}?utm_source=referido&utm_medium=redes&utm_campaign=invita-y-gana
```

## Por qué así

- No menciona la recompensa de quien invita: el mensaje lo manda una persona a su gente, y "gano un mes si te registras" suena a venta. La recompensa se explica dentro de la app y en el correo.
- Promete solo lo que existe: prueba de 7 días sin tarjeta, rutina del día con peso y repeticiones.
- Sin IA, sin testimonios, sin escasez, sin emojis, sin números de WhatsApp. Habla en primera persona porque es la persona quien lo envía, no la marca.

## Pendiente en el código (para el PR)

1. `shareMessage()` en `src/lib/referrals.ts` arma el texto que hoy se comparte, y `referralLink()` devuelve el enlace `/r/{codigo}` **sin UTM**. Para usar estos textos hay que cambiar las dos funciones (y la prueba de `src/lib/referrals.test.ts`).
2. `src/app/r/[code]/route.ts` redirige a `/entrar?modo=registro` y **descarta cualquier parámetro** del enlace. Con el código de hoy, los UTM de esta tabla no llegan al registro ni al píxel. Hace falta que la ruta pase los `utm_*` a `/entrar`; mientras no esté, los registros por referido se miden por la tabla `referrals`, no por UTM.
