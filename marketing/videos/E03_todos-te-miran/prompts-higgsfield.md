# E03: prompts de Higgsfield (solo imágenes fijas)

Una imagen fija por toma, nunca video: la animación se hace en código (`proyecto/`). Cada bloque se copia y se pega tal cual.

## Antes de generar

1. Formato: vertical 9:16, la mayor resolución disponible (2K o más), porque el render acerca la cámara hasta 1.7 veces.
2. Sube estas referencias en cada generación:
   - **Coach Banana:** `marketing/instagram/recursos/coach-banana-oficial.png`.
   - **El Nuevo:** un cuadro de V02 donde se vea de cuerpo entero. *No está en el repositorio* (ver "Lo que falta" en el README).
   - **Coach Platanita (solo T4):** su imagen oficial de Higgsfield. *No está en el repositorio.*
   - **El gym:** una toma del gym de V02, o la imagen del gym del condominio de la landing `/condominios` (la de Coach Banana con el celular, `IMG.hero` en `src/app/condominios/page.tsx`). *El archivo no está en el repositorio.* Usa la misma referencia en las seis tomas para que el gym no cambie.
3. Guarda cada imagen como `proyecto/tomas/T1.png` a `T6.png` y corre `npm run render`.
4. Si un mono queda en otro lugar, corrige su posición en `TOMAS` de `proyecto/escenas.mjs`; los globos y la cámara se ajustan solos.

Los números entre paréntesis (por ejemplo, 50 % del ancho y 50 % del alto) dicen dónde tiene que quedar la cabeza de cada mono. El tercio de arriba queda libre: ahí van los textos.

## T1: El Nuevo en la puerta del gym (0 a 4 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: a small, modern residential condo gym in Latin America, same gym as the attached gym reference: light wood floor, a dumbbell rack, two machines, a wall of mirrors, a large window with tropical greenery, warm morning light, clean neutral tones with subtle banana-yellow accents. The gym is empty except for one character. Character: El Nuevo, a chubby young chimpanzee in a plain gray hoodie and a blue backpack, exactly as in the attached El Nuevo reference. He stands frozen just inside the gym doorway, facing the camera, shoulders up, hands gripping the backpack straps, eyes glancing sideways, nervous and self-conscious. Full body, medium-wide shot, centered; his head is at 50% of the width and 50% of the height. The upper third of the frame is calm, empty wall and ceiling with no objects. No humans, no other animals or monkeys, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## T2: Pared de espejos (4 a 8 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: the same small modern condo gym as the attached gym reference, seen toward a long wall of floor-to-ceiling mirrors, light wood floor, warm morning light, neutral tones with subtle banana-yellow accents. Character: El Nuevo, a chubby young chimpanzee in a plain gray hoodie and a blue backpack, exactly as in the attached El Nuevo reference, standing at the left, looking around with wide, worried eyes. The mirrors reflect him five or six times from slightly different angles, so the room feels full of eyes, but every reflection is El Nuevo himself. His real head is at 30% of the width and 52% of the height; the reflections spread across the rest of the frame at the same height. The upper third of the frame is calm mirror frame and wall with no objects. No humans, no other animals or monkeys, no other reflections, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## T3: Coach Banana le pone la mano en el hombro (8 a 10 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: the same small modern condo gym as the attached gym reference, dumbbell rack and window with tropical greenery in the background, warm morning light. Characters: Coach Banana, a muscular chimpanzee with a yellow headband, yellow sleeveless top, black shorts with a yellow stripe, yellow wristbands, white sneakers and a long curled tail, exactly as in the attached reference; and El Nuevo, a chubby young chimpanzee in a plain gray hoodie and a blue backpack, exactly as in the attached El Nuevo reference. Coach Banana stands at the right and rests one hand on El Nuevo's shoulder with a calm, warm smile; El Nuevo, at the left, looks up at him, a bit relieved. Medium shot, both from the knees up. El Nuevo's head is at 34% of the width and 54% of the height; Coach Banana's head is at 66% of the width and 46% of the height. The upper third of the frame is calm, empty wall with no objects. No humans, no other animals or monkeys, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## T4: Gym abierto, Coach Platanita al fondo en lo suyo (10 a 14 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: the same small modern condo gym as the attached gym reference, wide shot with depth, light wood floor, machines, dumbbell rack, window with tropical greenery, warm morning light. Characters: in the background at the left, Coach Platanita, a brown female monkey with a pink bow on her head, pink sports top, pink leggings and white sneakers, exactly as in the attached Platanita reference, doing a one-arm dumbbell row on a bench with over-ear headphones, eyes on her own set, fully focused, not looking at anyone; her head is at 27% of the width and 48% of the height. In the foreground at the right, seen in three-quarter view from behind: El Nuevo, a chubby young chimpanzee in a plain gray hoodie and a blue backpack (head at 68% of the width and 60% of the height), peeking at her nervously, and Coach Banana, a muscular chimpanzee with a yellow headband, yellow sleeveless top, black shorts, yellow wristbands and a long tail (head at 86% of the width and 52% of the height), relaxed. Keep Coach Platanita sharp and large enough to fill the frame when cropped to the left half. The upper third of the frame is calm wall and ceiling with no objects. No humans, no other animals or monkeys, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## T5: La primera serie de El Nuevo (16 a 18 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: the same small modern condo gym as the attached gym reference, mirror wall and window in the background, warm morning light. Characters: El Nuevo, a chubby young chimpanzee in a plain gray hoodie (backpack off, resting on the floor beside him), exactly as in the attached El Nuevo reference, at the center doing a goblet squat with one light dumbbell held at his chest, good form, focused and determined face, a small proud smile. Behind him at the right, Coach Banana, a muscular chimpanzee with a yellow headband, yellow sleeveless top, black shorts, yellow wristbands and a long tail, watches his form and gives a thumbs up. El Nuevo's head is at 50% of the width and 50% of the height; Coach Banana's head is at 80% of the width and 44% of the height. Full body. The upper third of the frame is calm, empty wall with no objects. No humans, no other animals or monkeys, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## T6: Choque de puños (18 a 20 s)

```
Vertical 9:16 still image, 2K. Flat 2D cartoon illustration with bold dark-brown outlines and cel shading, exactly the same art style as the attached Coach Banana reference. Setting: the same small modern condo gym as the attached gym reference, slightly out of focus behind them, warm morning light. Characters: El Nuevo, a chubby young chimpanzee in a plain gray hoodie and a blue backpack, exactly as in the attached El Nuevo reference, at the left, slightly sweaty and smiling, confident now; and Coach Banana, a muscular chimpanzee with a yellow headband, yellow sleeveless top, black shorts, yellow wristbands and a long tail, exactly as in the attached reference, at the right, smiling. They bump fists in the middle of the frame. Medium shot from the waist up. El Nuevo's head is at 32% of the width and 52% of the height; Coach Banana's head is at 68% of the width and 46% of the height. The upper third of the frame is calm, empty wall with no objects. No humans, no other animals or monkeys, no text, no letters, no logos, no brand names, no watermark, no emojis.
```

## Cierre (20 a 23 s): no se genera

Usa la pose oficial "señala" de Coach Banana (`COACH_POSE.senala` en `src/lib/aprende.ts`), con fondo transparente, guardada en `marketing/videos/E03_todos-te-miran/assets/coach-banana-senala.png`. Mientras no esté, el cierre usa la pose de pie de `public/brand/mascota-sola.webp`.
