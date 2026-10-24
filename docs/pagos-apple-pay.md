# Apple Pay (pendiente, no se construyó)

Revisado el 24 de octubre de 2026, al lanzar el 50 % del primer mes por dejar la tarjeta lista (0043).

## Por qué no está

- **Tilopay**: su SDK muestra Apple Pay solo para **pagos únicos**:
  - pide una cuenta en producción;
  - el dominio exacto (`www.bananaburn.app`) debe estar certificado por Tilopay, pidiéndolo a soporte@tilopay.com;
  - el comprador usa Safari con Apple Pay configurado.

  La documentación no dice que se pueda guardar el token de Apple Pay para cobrar después. Nuestro flujo guarda la tarjeta hoy y cobra al terminar la prueba (y cada mes después), así que con Apple Pay no podríamos hacer el cobro del día 7 ni las renovaciones.
- **ONVO**: su documentación pública no menciona Apple Pay.

## Qué haría falta

1. Que Tilopay confirme por escrito si un pago con Apple Pay deja un token reutilizable para cobros recurrentes (COF / processRecurrentPayment), y con qué datos vuelve.
2. Certificar `www.bananaburn.app` con Tilopay para Apple Pay.
3. Integrar el SDK de Tilopay en la página (hoy usamos su página de pago), con `apple_pay = 1` en `init.methods`, y confirmar cada pago en el servidor con `POST /api/v1/consult`.
4. Si no hay token reutilizable, la única opción honesta sería pagar con Apple Pay el plan completo en el momento (sin prueba con tarjeta lista), lo que cambia la oferta.
