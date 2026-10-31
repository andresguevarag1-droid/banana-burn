# feat(marketing): producir Reel R12 con cierre real de Temporada 1

Entrega Reel de 21 s, corte de 15 s, portada y proyecto reproducible para recordar el cierre de inscripciones del 22 de noviembre de 2026. Gancho desde el cuadro 0, máximo ocho palabras por pantalla, cambios cada 1.5 a 2 s y cierre de tres segundos con Coach Banana señalando. Sin audio, contadores ni escasez artificial.

Embudo: mueve visitas a `/temporadas` hacia registros completos e inscripciones. Sirve a Mateo para la landing y a Martín para evaluar el contenido. Meta de gancho: reproducciones de 3 s / impresiones ≥ 30 %. Medir clics al enlace, visitas de destino, `CompleteRegistration` al terminar bienvenida y compras reales de temporada. La prueba de la app y la compra de temporada se distinguen en el pie de foto.

Contribución a 100 usuarios de pago: seguir la cohorte hasta primer pago y segundo mes. Contar cuentas únicas con `trial_charges.status='succeeded'` o suscripción de pago vigente, excluyendo testers y cortesías; una vista o un registro no cuenta como pago. No afirmar atribución individual al Reel: la app hoy no conserva UTM de visitas sin `?ref=`. Usar métricas de plataforma y destino como agregados; atribución de cohorte depende de instrumentación posterior. No se inventa un referido para saltar esa limitación.

Destino propuesto para el enlace aprobado: `https://bananaburn.app/temporadas?utm_source=instagram&utm_medium=organic_social&utm_campaign=temporada1_nov2026&utm_content=r12`. Es solo una propuesta, no un enlace publicado ni garantía de atribución en Supabase.

La versión corta no autoriza inversión. R12 queda fuera del plan actual de Meta Ads; publicar, enviar o cambiar campañas requiere aprobación escrita de Andrés. Ventana propuesta: 16 a 22 de noviembre, con fecha confirmada antes de uso.

Validación: `npm run verificar` en el proyecto y checks del repositorio, registrados en `validacion.md`. Revisar hoja visual, portada recortada y reproducción de ambos MP4.

Refs #74
