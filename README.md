# Gym Coach

PWA de entrenamiento y nutrición. Los datos locales se conservan en
`gymCoachDiegoV1`; una actualización de la aplicación no cambia esa clave.

## Sincronización privada

El cliente funciona con Supabase Auth (correo y contraseña) y una fila privada
por usuario. Sigue funcionando sin conexión. Guarda automáticamente, sincroniza
al volver a la aplicación y comprueba cambios cada 30 segundos mientras está
visible. Los borradores de series y de platos permanecen en su dispositivo.

Activación, una sola vez por el administrador:

1. Crear un proyecto Supabase y aplicar `supabase/schema.sql`.
2. Activar email/password. Se puede configurar el Site URL y los redirects con
   `https://aifmoc.github.io/Gym-Coach/`. La app también permite confirmar el correo
   pegando el enlace de confirmación, sin depender del redirect del servidor.
3. Rellenar `cloud-config.js` con la URL del proyecto y su **publishable key**
   (o una anon key heredada). Nunca usar una secret key ni service-role key.
4. Incrementar la versión de los assets y del service worker al cambiar la
   configuración, y publicar todos los archivos de forma conjunta.
5. Entrar primero desde el móvil que contiene los registros actuales. La primera
   cuenta vacía recibe esa copia. En el PC, entrar con la misma cuenta descarga
   los datos, guardando antes una copia local de recuperación.

Sin proyecto configurado la aplicación muestra expresamente que la sincronización
no está activada. No existe ningún servidor ficticio ni copia de los registros
en el repositorio como mecanismo de sincronización.

Los cambios independientes se combinan mediante comparación con la última copia
sincronizada y guardado con número de revisión. Un cambio coincidente pausa las
escrituras y conserva ambas versiones para recuperación; la decisión del usuario
afecta a los campos que entran en conflicto. Las sesiones se agrupan por fecha y
los ejercicios por ID. Las referencias a alimentos se normalizan antes de viajar
para que una reordenación del catálogo no cambie los ingredientes de un plato.

## Validación

```sh
node tests/gym-coach-v32.test.cjs
node tests/gym-coach-v33.test.cjs
node --test tests/cloud-sync.test.cjs
```

En v35 está conectado el proyecto privado `uqwpsogabzpbbfvifbmq` (región eu-west-1).
La migración está aplicada y se comprobaron contra el servidor real el aislamiento
de cuentas, la prohibición de cambiar el propietario, y el guardado con revisión.
Las pruebas reales con dos clientes comprobaron Auth, subida inicial, descarga,
combinación de cambios independientes, rechazo de revisiones antiguas y renovación
de sesión. Los tests del repositorio usan una API simulada. La cuenta se crea desde
Datos en el móvil que tiene los registros; es distinta de la cuenta administradora
de Supabase y de la contraseña de la base de datos.

## Duración registrada (v36)

El informe diario, con o sin prompt, incluye el tiempo entre el primer y el último
dato del entreno en Registro. El primer cambio en reps, carga, RIR o notas
inicia el registro; confirmar una serie o finalizar un ejercicio actualiza
el final. Abrir la app, elegir un ejercicio, consultar el informe y sincronizar no
añaden tiempo. Los descansos entre anotaciones están incluidos. Los tiempos se
guardan al introducir datos, sobreviven a recargas y se sincronizan entre dispositivos.
Las sesiones sin horas registradas indican «no disponible»; no se inventa su duración.

```sh
node --test tests/training-duration.test.cjs
```
