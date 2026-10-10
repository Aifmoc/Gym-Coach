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

## Diseño v37 y vuelta a v36

Navegación principal: Hoy, Dieta, Progreso y Más. Más conserva Registro, Semana,
Check-in, Plan y Datos. Registro reúne el ejercicio, objetivos, series y descanso;
el estado verde sigue vinculado al slot/configuración de cada ejecución. Los códigos
internos siguen en exportaciones y configuración avanzada, pero no en las tarjetas.
Dieta empieza con los restantes calculados desde los objetivos guardados y el log;
viaje/social no inventa un objetivo de energía, y un exceso se muestra como tal.

La copia `v36/` conserva el código de la versión anterior y usa las mismas claves
de datos locales, borrador y cuenta. «Volver a v36» en Más o Datos guarda la
preferencia únicamente en este dispositivo. La v36 permite «Volver a v37».
No hay migración de estructura ni caducidad para probar el diseño. Sus service
workers tienen ámbitos y cachés distintos; navegar a v36 no sustituye el shell v37.

```sh
node --test tests/*.test.cjs
```

La rama `version-36` apunta al commit `3d8ff712c736e1985dffde77170c5fa213ce9e95`
como referencia independiente para una reversión completa del despliegue.

## v39: objetivos recuperados y sincronización corregida

Sin runs diarios. Los informes de v38 quedan como archivo de lectura y no
sustituyen las prescripciones de Registro. Se conserva el diseño aprobado de v37.

Los registros antiguos sin slot se resuelven en memoria solo cuando la rutina
es identificable por el día guardado, la sesión o un ejercicio único. Los casos
ambiguos siguen requiriendo asignar día. Las etiquetas explícitas «Polea fuera»
y «Fuera» comparten contexto; dentro/fuera, ubicaciones y unidades distintas
permanecen separadas. No se reescriben cargas, series ni variantes históricas.
Cada ejercicio carga su propia configuración, sin heredar la del anterior.

Los objetivos importados posteriores a la última ejecución comparable se usan
hasta finalizar el ejercicio. A partir de una ejecución nueva, la app calcula
el siguiente objetivo desde esa referencia, aunque una sesión antigua fuese mejor.
Un objetivo consumido se identifica antes de añadir la nueva ejecución. La carga
base ausente permanece vacía y no se convierte en cero al recuperar configuración.

La sincronización compara JSON por contenido: PostgreSQL jsonb puede reordenar
campos sin que eso constituya un conflicto. Diferencias reales siguen pausando
las escrituras y conservan ambas copias. Una descarga actualiza el resumen y
aplaza los formularios activos hasta salir de ellos, conservando las series en
curso. El cliente corregido también está disponible con el diseño v36.

Validación: regresiones de objetivos y de dos dispositivos con respuesta JSONB,
consumo de objetivos, estados verdes y duración. Las pruebas no contienen datos
personales. Publicación automática ejecuta las pruebas antes del despliegue.

## v40: selección de ejercicios y conflictos visibles

Buscar un ejercicio, escribir un nombre inequívoco o tocarlo en la rutina carga
su propio slot y configuración. Un ejercicio de otra jornada conserva su esquema
de series; Registro permite elegir su rutina explícitamente. Los borradores en
curso conservan la configuración elegida al recargar.

La sincronización actualiza los resúmenes incluso durante un borrador activo.
«Sincronizar ahora» vuelve a comprobar un conflicto pendiente y muestra los
valores del dispositivo y de la nube si persiste. El estado previo se edita en
el registro por fecha; su copia dentro de la sesión se reconstruye desde ese
registro antes de comparar revisiones antiguas. Una copia desactualizada no
bloquea la cuenta; las diferencias reales conservan la elección y recuperación.

### Corrección de almacenamiento local (10 de octubre)

Las copias de recuperación, los checkpoints y las versiones en conflicto se
guardan en IndexedDB para que sus duplicados del histórico no llenen localStorage
e impidan sincronizar las comidas nuevas. Las copias antiguas se migran después
de confirmar la transacción; un fallo conserva la copia original y pausa la
sincronización. Los registros actuales, los borradores y la cuenta mantienen sus
claves. La descarga de recuperación conserva el acceso a las copias migradas.
La corrección también está incluida en el diseño v36.
