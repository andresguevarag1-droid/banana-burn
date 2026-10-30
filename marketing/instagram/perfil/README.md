# Perfil de @bananaburnapp: nombre, bio y destacados

Propuesta para corregir el perfil (issue #8). Nada de esto está publicado ni cambiado en el perfil real: Andrés aprueba y lo cambia él.

## Nombre del perfil (máximo 30 caracteres)

El campo "Nombre" de Instagram entra en la búsqueda, así que lleva la marca bien escrita (hoy dice "Banana Burns") y una palabra clave. El usuario @bananaburnapp no cambia.

| Opción | Texto | Caracteres |
| --- | --- | --- |
| **A (la apuesta)** | `Banana Burn \| Entrenador` | 24 |
| B | `Banana Burn \| Entrenador app` | 28 |
| C | `Banana Burn \| Rutina de gym` | 27 |

Apuesto por **A**: "entrenador" es lo que la gente busca cuando quiere que alguien le diga qué hacer, y coincide con la frase de apoyo "Tu entrenador personal en el celular". "Banana Burn | Entrenador en tu celular" (el ejemplo del issue) tiene 38 caracteres y no entra.

## Bio (máximo 150 caracteres)

Cada salto de línea cuenta como 1 carácter. El texto de la bio no es un enlace en Instagram: `https://bananaburn.app` va además en el campo "Sitio web".

**Bio A (la apuesta), 132 caracteres**

```
Tu entrenador personal en el celular.
Bajaste de peso: ahora gana músculo y no lo recuperes.
Empieza 7 días gratis en bananaburn.app
```

**Bio B, 142 caracteres**

```
Qué entrenar, con cuánto peso y cuántas repeticiones.
Para quien bajó de peso y quiere verse firme.
7 días gratis, sin tarjeta: bananaburn.app
```

Las dos dicen qué es, para quién y llevan el CTA con "7 días gratis". Apuesto por **A**: abre con la promesa que ya usa la marca, habla directo a quien bajó de peso y cierra con un verbo. B es más concreta sobre el producto; sirve para probarla 2 semanas después y comparar visitas al sitio en las estadísticas del perfil.

"sin tarjeta" (bio B) solo es cierto desde el 1 de noviembre de 2026, cuando termina la beta. Ninguna menciona IA ni dice "banano".

## Destacados (1080 x 1920)

Cinco portadas en el orden en que deben ir: Empieza, Condominios, GLP-1, Running y Temporadas. Solo paper #FFF8E3, banana #FFD60A e ink #1B1505, Plus Jakarta Sans, sin emojis ni transparencias.

| Variante | Portadas | Vista en el perfil |
| --- | --- | --- |
| **A (la apuesta)**: fondo banana, icono ink | `destacados/a/png/` | `destacados/vista-perfil-a.png` |
| B: fondo ink, icono banana | `destacados/b/png/` | `destacados/vista-perfil-b.png` |

Apuesto por **A**: es el amarillo de la marca y la foto de perfil (icono ink) ya es oscura; cinco círculos amarillos junto a ella se reconocen de lejos. B es la alternativa si el feed termina siendo muy amarillo.

- El icono queda dentro del círculo central que recorta Instagram; "BANANA BURN" arriba y el nombre abajo quedan fuera del recorte y solo se ven en el archivo.
- La portada de GLP-1 lleva "No sustituye la indicación de tu médico."
- Al subir: Editar destacado > Editar portada > elegir el PNG y dejar el círculo centrado. El nombre de cada destacado se escribe igual que en la portada.

### Fuente editable

`destacados/generar.mjs` dibuja las portadas en código y escribe el SVG editable (`svg/`) y el PNG final (`png/`) de cada variante. Usa las fuentes de `src/app/og`. Desde la raíz del repo:

```
npm i --no-save --prefix /tmp/resvg @resvg/resvg-js@2
RESVG_DIR=/tmp/resvg node marketing/instagram/perfil/destacados/generar.mjs
```

Para cambiar un texto, un icono o el orden, edita `COVERS` o `ICONS` en el script y vuelve a correrlo.

## Lo que falta de parte de Andrés

1. Elegir nombre, bio y variante de portadas (o decir "las apuestas").
2. Confirmar que el campo "Sitio web" del perfil apunta a `https://bananaburn.app` (o a la LinkApp, si prefieres llevar ahí el tráfico).
3. Contenido para cada destacado: las portadas están, pero cada uno necesita al menos 1 historia adentro. Propongo usar las historias "Nuevo hoy" ya programadas de cada tema; dime si las archivo así.
4. Si la cuenta es de empresa, elegir la categoría "Aplicación" o "Salud y bienestar"; dime cuál está hoy.
