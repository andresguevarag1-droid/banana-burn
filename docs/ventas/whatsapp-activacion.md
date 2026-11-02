# WhatsApp personal de Andrés: primer entreno

Objetivo: ayudar a que quien se registró termine su primer entreno en 72 horas. El pago viene después.

Andrés elige el mensaje según lo que la persona haya hecho y lo manda personalmente desde su WhatsApp, uno a uno. Sustituir `[Nombre]` antes de enviarlo. Cada bloque es un mensaje completo; los saltos indican líneas del texto, aunque WhatsApp puede ajustarlas al ancho de pantalla.

Escuchar primero y responder a lo que cuente. Si no quiere seguir o no responde, dejarle espacio; no insistir ni programar envíos. Usar «Vi que empezaste» solo cuando se haya confirmado que abrió un entreno sin terminarlo.

## 1. Se registró y todavía no ha entrenado

```text
Hola, [Nombre], soy Andrés de Banana Burn. ¿Qué te frenó para hacer tu primer entreno?
Te dejo el de 12 min en casa, sin equipo, por si te sirve:
https://bananaburn.app/app/entreno?casa=1
```

## 2. Abrió un entreno y se salió

```text
Hola, [Nombre], soy Andrés de Banana Burn.
Vi que empezaste, ¿algo no se entendió?
Si quieres, lo vemos juntos por aquí.
```

## 3. Entrenó una vez

```text
Hola, [Nombre], soy Andrés de Banana Burn. Felicidades por terminar tu primer entreno.
¿Te ayudo a armar tu semana?
```

## 4. Respuestas a objeciones

### «No tengo tiempo»

```text
Te entiendo. El primer entreno en casa dura 12 min: https://bananaburn.app/app/entreno?casa=1
¿En qué momento de tu día te sería más fácil hacerle espacio?
```

### «No tengo gym»

```text
Puedes hacer el primer entreno en casa, sin equipo: https://bananaburn.app/app/entreno?casa=1
¿Quieres que te ayude a empezar?
```

### «Ya pagué otra app»

```text
Está bien aprovechar lo que ya pagaste; no tienes que cambiarte.
¿Qué te gustaría resolver con tus entrenos que todavía te cuesta?
```

### «Es caro»

```text
Entiendo, tiene que caber en tu presupuesto. No hace falta decidir un pago ahora.
¿Quieres probar el primer entreno y luego ver si te sirve?
```

### «No sé usar máquinas»

```text
Podemos empezar sin máquinas, en casa: https://bananaburn.app/app/entreno?casa=1
¿Cuál ejercicio te genera dudas? Lo vemos juntos.
```

## 5. Registro para pasar a la oficina

Completar después de conversar. Usar un alias interno, sin teléfonos, datos de salud ni capturas del chat. Resumir lo que dijo la persona sin inventar respuestas; no pegar conversaciones privadas en el repositorio. La tabla es una plantilla para el registro interno de la oficina.

| Fecha | Alias | Estado al escribirle | Qué dijo / qué lo frenó | Ayuda que dio Andrés | Qué cambiar en la app (hipótesis) | Responsable / siguiente paso | ¿Terminó su primer entreno en 72 h desde el registro? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |

Al pasar el resumen a la oficina, agrupar las barreras que se repitan y proponer el cambio concreto que permita avanzar. Separar lo que dijo la persona de la hipótesis del equipo.

Medición: este documento mueve **registro → primer entreno terminado**. Revisar `workout_open`, `workout_first_set` y `workout_saved` de `funnel_events` para localizar el abandono; contar el primer `workout_saved` dentro de las 72 h desde el registro. Marcar «pendiente» si aún no vence la ventana y «no aplica» para quien ya había entrenado antes del mensaje. Comparar el porcentaje antes y después del contacto sin atribuirle por sí solo todo el cambio a WhatsApp.

Enlace verificado en `src/app/(app)/app/entreno/page.tsx`: `?casa=1` activa la variante inicial en casa cuando corresponde. La persona debe entrar con su cuenta; si el enlace la lleva al inicio de sesión, pedirle que vuelva a abrirlo después de entrar. No prometer ese entreno inicial a quien ya lo terminó.
