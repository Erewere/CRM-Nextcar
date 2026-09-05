# Nextcar CRM — cómo se trabaja en este proyecto

Este archivo lo lee Claude al abrir esta carpeta. Luis puede editarlo: **lo que
diga aquí manda sobre lo que Claude suponga.**

## Con quién estás hablando

Luis es el dueño del producto, **no es programador**. Explícale en lenguaje de
quien vende autos, no de quien escribe código: qué va a ver distinto en
pantalla, no cómo se llama la función. Si algo se rompió, dilo claro y sin
adornos.

Es un CRM multiagencia de venta de seminuevos, en producción, con clientes de
pago dentro. **Cada cambio llega a gente que está vendiendo autos hoy.**

## Quién sube los cambios: tú, no Luis

**Los cambios los subes tú, desde esta carpeta.** Luis decidió que se trabaje
así. **No le pidas que entre a GitHub a copiar, pegar o commitear a mano** —
lo estuvo haciendo y no hace falta.

El flujo es: editas aquí → `npm run lint` y `npm run build` → commit →
`git push origin main`. Hostinger despliega solo. Luego lo compruebas en vivo
y le dices en una línea qué subió.

`main` acepta empujes directos, así que **compilar antes no es opcional**: no
hay nadie más entre tu push y sus clientes.

**Avísale antes de subir**, no después, cuando el cambio toque datos de
verdad: escribir o borrar en Firestore, pagos, permisos, roles, o cualquier
cosa que necesite publicar reglas a mano.

### Si no alcanzas esta carpeta

Si corres en otra máquina y esta ruta no existe, **no tienes las credenciales
de Luis y no vas a poder empujar por más permiso que te dé**. En ese caso **no
lo mandes a GitHub**: dale el parche completo —el diff o el archivo entero—
para que se lo pase a una sesión que sí esté en su Mac, y ahí se aplica,
se compila y se sube.

Ruta de la carpeta:
`/Users/luisfj/Library/CloudStorage/GoogleDrive-luisfj@gmail.com/Mi unidad/NEXTCAR/App CRM Nextcar`

### Antes de ramificar o subir, ponte al día

`git fetch origin main` **siempre** antes de empezar. Hay varias sesiones
trabajando sobre este repo y Google AI Studio también publica aquí. Si
`origin/main` avanzó, haz `git merge --ff-only origin/main` y **comprueba que
lo tuyo y lo de los demás siguen ahí** antes de construir encima.

## Compilar y desplegar

```bash
npm run lint        # tsc --noEmit, no escribe nada
npm run build       # vite build + esbuild de server.ts -> dist/server.cjs
npm run test:rules  # reglas de Firestore contra el emulador (necesita Java 21)
```

Hay CI en `.github/workflows/ci.yml`: revisa tipos, compila y corre las
pruebas de reglas **en cada PR y en cada push a `main`**. Empujar directo no
lo salta, solo lo corre después — así que si rompes algo, te enteras por
correo de GitHub en vez de antes. Razón de más para compilar tú primero.

**Compila siempre antes de subir.** Un `tsc` limpio es lo que separa un cambio
bueno de una pantalla en blanco para sus clientes.

Desplegar es `git push origin main`. Hostinger lo detecta y publica solo en
**1 a 2.5 minutos**. No hay más pasos.

### node_modules es un atajo que puede desaparecer

`node_modules` es un enlace a `/private/tmp/claude-501/.../nextcar-libs/`,
fuera de Google Drive a propósito (si no, Drive sincronizaría miles de
archivos sin sentido). macOS limpia `/private/tmp` de vez en cuando.

Si `npm run build` falla diciendo que no encuentra un módulo, **el proyecto no
está roto**: hay que reinstalar en esa carpeta. No borres el enlace ni
instales dentro de Drive.

Hay Node de verdad en la Mac (`~/.local/node/bin`, v24). Si `node` no aparece,
añádelo al PATH; no digas que no se puede compilar.

## Verificar que de verdad llegó

**Nunca digas "desplegado" sin comprobarlo en vivo.** Este proyecto tiene
historial de cambios que parecían subidos y no lo estaban.

- **Compara por contenido, no por el hash del bundle.** Hostinger compila con
  sus propias dependencias, así que su hash **no** coincide con el de tu build
  local. Que sea distinto no significa nada.
- Busca **textos que ve el usuario**, no nombres de variables — la
  minificación borra los nombres.
- Descarga el bundle a un archivo con `curl -o` y busca ahí. Los acentos y
  emojis rompen la comparación si lo pasas por tubería.
- Incluye **un marcador de control que sí debe seguir apareciendo**. Si todos
  dan cero, probablemente descargaste el archivo equivocado.
- Para endpoints borrados: **404 contra 401**. Una ruta que ya no existe da
  404; una que existe y pide sesión da 401. Ese contraste es la prueba.

## Lo que el despliegue NO toca

**Las reglas de Firestore no se publican con el push.** El `firestore.rules`
del repo ya se prueba en CI (`tests/firestore-rules.test.ts` verifica el
aislamiento entre agencias), así que el archivo es fiable — pero **seguir en
el repo no es estar en vivo**. Lo único que las publica es hacerlo a mano en
la consola de Firebase, en la pestaña "Seguridad" **de esa base de datos**, no
del proyecto.

Si un cambio necesita reglas nuevas, **dilo explícitamente**: es un paso
manual que solo puede hacer Luis, y hasta que lo haga el cambio está a medias
aunque el despliegue diga que terminó.

## Trampas que ya costaron tiempo aquí

**Código correcto en un camino por el que no pasa nadie.** Ya pasó tres veces:
arreglos del embudo móvil mientras el botón no estaba en el menú; el correo de
invitación enganchado a un endpoint que la pantalla no llamaba; rediseñar
`VehiclePrint.tsx` cuando el botón usaba otra ruta. **Al tocar un endpoint o
una función, comprueba que la interfaz de verdad la llame.**

**Una venta vive en tres documentos** — el trato, el contacto y el vehículo.
Eso es el diseño, no un error. Limpiar uno solo no la borra, y escribir en el
vehículo sin comprobar quién es el comprador contamina datos de otro cliente.

**Antes de tocar un motor de puntuación, mídelo.** Corre casos concretos y
guarda el "antes". Convierte "está muy sensible" en qué regla falla.

**Google AI Studio también publica en este repo.** Puede traer un refactor que
borre semanas de trabajo. Revisa su commit antes de construir encima, y usa un
solo carril por cambio para que no se pisen.

**Ante un informe de fallo con causas propuestas, compruébalas contra el
código.** Llegó uno con cinco causas y ninguna era la buena: suponían una
arquitectura que este CRM no tiene.

## Datos del proyecto

- **Repo:** https://github.com/Erewere/CRM-Nextcar — `main` despliega solo
- **Producción:** https://crm.erewere.com (Hostinger Node.js App, entrada
  `dist/server.cjs`, preset Express)
- **Proyecto Firebase:** `gen-lang-client-0561602821`
- **Base de datos:** `ai-studio-e65d5185-219a-4e1d-a330-044b1109696a` —
  **no** es `(default)`, y hay otras parecidas en la misma cuenta
- **Agencia Nextcar:** `k77PpUc4SKDVCps2qSDw`
- **Correo saliente:** Resend, dominio `nextcar.erewere.com` verificado.
  Plantillas en `src/lib/plantillasCorreo.ts`
- **Firma de los correos:** "Equipo Nextcar", WhatsApp 461 239 9969,
  contacto@erewere.com

## Secretos

**No generes ni pegues llaves ni tokens en la conversación.** Las crea Luis en
el panel que corresponda y las pega en Hostinger. Si necesitas comprobar que
una variable está puesta, hay endpoints que responden sí-o-no sin exponer el
valor (por ejemplo `/api/correo/estado`).

Al guardar variables en Hostinger, **recarga la página para confirmar que
guardaron** — ese panel falla en silencio.
