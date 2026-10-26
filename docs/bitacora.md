# Bitácora de conText

El [README](../README.md) cuenta **qué es** conText hoy. Esto cuenta **cómo llegó a serlo**: las
tres jornadas de trabajo, las decisiones que las cambiaron de rumbo y las que se tomaron y luego se
desandaron. Está escrito a partir de los 24 commits del repo, no de memoria.

**App:** https://context.aideatext.ai · **Origen:**
[aideatext/Discovery-conText](https://github.com/aideatext/Discovery-conText) (commit `c6d7372`)

| Jornada | Fecha | Commits | Qué quedó |
|---|---|---|---|
| 1 · El hackathon | 17–18 oct 2026 | 18 | La app entera, pública y con dominio propio |
| 2 · Portabilidad y coste | 20 oct 2026 | 3 | Guía de migración a AWS y 53 % menos tokens de entrada |
| 3 · Los primeros usuarios | 25 oct 2026 | 3 | Topes de prueba, aviso de privacidad y medición perpetua |

---

## Jornada 1 — 17 y 18 de octubre: de un repo ajeno a una app pública

Seis horas y media desde el primer commit (19:20) hasta la app con dominio propio (21:32 del día
siguiente). Se partió de `Discovery-conText`, que era un prototipo de investigación con Gemini.

**Lo primero fue quitar, no añadir.** El repo base inyectaba `GEMINI_API_KEY` en el bundle del
navegador vía `vite.config.ts`, tenía OAuth de Google Drive con tokens en `localStorage` y
`postMessage(..., '*')`, y guardaba las conversaciones en un `conversations.json` en disco que
devolvía las conversaciones de todos a cualquiera. Todo eso se eliminó entero antes de escribir
nada nuevo.

Lo que se conservó: la idea del grafo de fuerzas en D3 y la fusión incremental de nodos.

**Lo que se construyó, en orden:**

1. **Bloque 1** (`997738b`) — Express con `@anthropic-ai/foundry-sdk` y `DefaultAzureCredential`,
   el tutor socrático en streaming SSE, el esquema del grafo pedagógico validado con zod.
2. **Bloque 2** (`9456d63`) — el extractor del grafo por turno. Dos llamadas al modelo con roles
   distintos: el tutor conversa, el extractor estructura. Separarlos es lo que permite que el grafo
   crezca aunque el tutor responda en prosa.
3. **Bloque 3** (`a514efe`) — `/api/material` con imagen, PDF nativo y texto.
4. **Bloques 4 y 5** (`19fb8fe`, `77bd90a`) — Container Apps en `eastus`, identidad administrada y
   **cero claves**: la cuenta de almacenamiento tiene `allowSharedKeyAccess=false`, así que no
   existe una cadena de conexión que robar.
5. **Bloque 6** (`087c23c`) — el README para el jurado.

**Después del despliegue vinieron los seis cambios que hicieron el producto**, y casi todos salieron
de mirar la app funcionando:

- `bcb1b65` — **la foto de un objeto cotidiano también es material para pensar.** Ante un vaso
  apoyado en la bandeja de CD de una computadora, conText no busca letras: extrae *"uso distinto al
  previsto"*, *"la gente adapta los objetos"*. Es el "ordenamiento conceptual" de la tesis que
  sostiene el proyecto, aplicado a la tecnología que el estudiante tiene delante.
- `77ca872` — el material se queda a la vista durante toda la conversación, no sólo al subirlo.
- `65a964e` — el tutor habla, con la voz neuronal peruana `es-PE-CamilaNeural`. El acento importa:
  es parte de que el tutor suene como alguien del mundo del estudiante.
- `5b810f8` — "Llevarme mi resumen" arma el PDF **entero en el navegador** con `pdf-lib`: el
  material no vuelve a salir hacia ningún servicio.
- `f26650f`, `72f2710` — la identidad gráfica. El azul y el rojo del grafo son los del logotipo
  —*AIdea* en azul, *Text* en rojo—, así que el grafo lleva la marca puesta mientras separa quién
  pensó cada idea.
- `1e44122` — **"Tu sesión es tuya"**: llevártela, retomarla o borrarla.

### La decisión que sostiene todo lo demás

De `1e44122`, textualmente: *las sesiones que nadie toca caducan a los 7 días, igual que los
archivos; sin eso, decir que el servidor olvida sería mentira para quien se va sin pulsar el botón.*

Esa frase es el criterio con el que se resolvió todo lo que vino después. Cada vez que apareció la
tentación de guardar algo "por si acaso", la prueba fue si la promesa de la portada seguía siendo
cierta después de guardarlo.

Un detalle técnico que vale la pena recordar: al **retomar**, el grafo se revalida con el mismo zod
que valida al modelo, porque ese JSON viene de fuera y no se confía en él. Y `normalizeDelta` tuvo
que aceptar un tope de nodos configurable: retomar no es un turno nuevo, es un grafo entero que
vuelve, y el límite de 8 nodos por turno lo habría recortado.

### Qatom: qué se vende, exactamente

`eacf9b5` y `6adc5b3`. conText pone a la venta **su capacidad, no las conversaciones de nadie**:
`POST /api/qatom/grafo` convierte un texto en grafo de razonamiento, por llamada.

Dos decisiones:

- **No se vende ningún dato de ningún estudiante.** Ni conversaciones, ni grafos, ni material.
- La ruta de pago responde **404 y no 401** sin el token: quien no pagó no debería ni enterarse de
  que la ruta existe.

> **Un giro que se desandó.** En la madrugada del 18 se propuso mover conText a usuarios
> universitarios, porque eso habilitaría vender conversaciones en el mercado de ideas. Al poner al
> lado la nota de Fase 1 —el Track 03 exige usuario escolar, **no** universidad— quedó claro que el
> giro tiraba abajo el 75 % técnico de la rúbrica. Se volvió a secundaria. Vender material de
> escolares no se sostiene ante un jurado ni ante un padre, y la promesa de "el servidor olvida"
> sería falsa si el servidor guardara para revender. Si la idea vuelve, el camino limpio es un
> producto aparte para mayores de edad, no un cambio de usuario en conText.

---

## Jornada 2 — 20 de octubre: portabilidad y coste

**`c087b37` · Paquete de migración a AWS.** [`docs/migracion-aws.md`](migracion-aws.md) mapea pieza
por pieza: Foundry→Bedrock, Container Apps→App Runner, Table Storage→DynamoDB, Blob→S3,
Speech→Polly, ACR→ECR, con las políticas IAM en [`infra/aws/`](../infra/aws/).

El hueco real, dicho sin maquillar: **Polly no tiene voz peruana** (sólo es-ES, es-MX y es-US), y el
acento es parte del producto. Se evaluaron tres salidas, con la híbrida —voz en Azure— como
recomendada.

Dos trampas que cuestan horas si se descubren en caliente: hay que pedir acceso al modelo en la
consola de Bedrock (falla como si fuera un problema de IAM), y el CAA de `aideatext.ai` no permite
`amazon.com`, así que ACM se queda esperando validación sin decir por qué.

**`f5b7ffe` · Caching de prompts: 53 % menos tokens de entrada.** Medido, no supuesto — y el
resultado **dio vuelta el plan propuesto**.

El mínimo cacheable en `claude-opus-5` son 512 tokens, y por debajo no cachea sin avisar. Contar los
prompts con el tokenizador real (`scripts/medir.mjs`) mostró esto:

| Prompt | Tokens | ¿Cachea? |
|---|---|---|
| tutor | 402–445 | **no llega al mínimo** |
| extractor | 542 | sí |
| material | 1123 | sí |

Cachear el `system` del tutor —que era el plan— no habría hecho nada. Lo que sí crece es su
conversación, que se reenvía entera en cada turno; ahí se usó `cache_control` de nivel superior.
Desde el turno 2, el tutor paga 2 tokens de entrada sin cachear. A/B de 5 turnos: **7978 → 3723
tokens-equivalentes, 53,3 % menos.**

Sobre el `effort`: se midió antes de tocarlo. `medium` da el mismo grafo que `high`; `low` extraía
una idea menos en uno de cada tres casos, y en un producto cuyo valor **es** el grafo creciendo, esa
idea importa. Quedó en `medium`.

---

## Jornada 3 — 25 de octubre: los primeros usuarios reales

En **MeasureCamp Mexico City (24 oct)** aparecieron los dos primeros usuarios fuera del equipo, y
ninguno es el usuario de diseño:

1. **Quien revisa propuestas y planes de negocio** y quiere saber si están bien escritos y si tienen
   algo atractivo.
2. **Una estudiante** que iba a invitar a varios amigos para desarrollar sus ensayos.

conText **no cambió de usuario** —sigue siendo secundaria, Track 03—, pero es la puerta de entrada a
los servicios de AIdeaText, y por eso se deja probar. Eso trajo tres problemas a la vez.

### `9e9e759` — Decirlo antes, no después

Quien sube un plan de negocio no es un escolar con la foto de su cuaderno: trae nombres, montos y
razones sociales dentro. El aviso va **sobre el área de carga**, antes de que suba nada: quitar los
datos sensibles, y si lo que trae es un texto, en `.txt`.

Una versión intermedia repetía la promesa de privacidad tres veces en una sola pantalla; se recortó,
porque eso se lee a desconfianza y no a transparencia. Lo que pasa con lo subido lo cuenta
*"Tu sesión es tuya"*, al pie de la misma columna, junto al botón que lo cumple.

Las dos cajas que tocan los datos de quien prueba comparten un filo rojo al 30 % —el rojo del
logotipo—, para que se reconozcan de un vistazo.

### `d34e38e` — Una prueba sin tope no es una prueba

Lo que ya existía (30 turnos/5 min y 20 archivos/10 min por IP) frena la **ráfaga**, no el
**volumen**: un plan de negocio de 40 páginas entraba entero y la sesión no tenía fin.

Los topes viven en [`shared/limites.ts`](../shared/limites.ts), que leen el servidor y el navegador
de la misma fuente: **15.000 caracteres**, **8 páginas** de PDF, **20 turnos** por sesión.

**No se limitó por tiempo de reloj**, y es la decisión que más se discutió. Un cronómetro castigaría
justo la conducta que conText existe para provocar —pensar despacio— y además es imposible de
explicar sin sonar a demo mezquina. La extensión y los turnos se cuentan, se ven venir y se dicen de
antemano.

De paso se arregló una mentira silenciosa: el texto se recortaba a 60.000 caracteres **sin avisar**,
así que quien subía un documento largo creía que conText lo había leído entero.

> **Lo que este tope no es.** Es por sesión, y empezar otra es gratis: *Borrar todo*, otro navegador,
> o editar el `turns` del JSON que el usuario se lleva. No se cerró ese hueco porque no hay forma de
> cerrarlo sin identificar a la gente. El tope es una señal honesta, no una barrera.

### `a2b0eff` — Medir sin saber de quién

La pregunta era dónde mirar para ver si alguien está usando conText. La respuesta honesta era: en
ningún sitio útil.

`/api/stats` salía de contar las filas **vivas** de la tabla de sesiones, y como caducan a los 7
días **el número bajaba solo**. Lo que iba a servir de evidencia de tracción se autodestruía. Log
Analytics estaba activo, pero el servidor sólo escribe arranque y errores.

[`server/uso.ts`](../server/uso.ts) anota en una tabla aparte que el barrido no toca: `inicio`,
`conversa`, `turno`, `material`, `borrado`, `tope`. `inicio` cuenta cargas de página —rebotes y
rastreadores incluidos—; `conversa` se emite en el primer turno de cada sesión. Son dos números
distintos a propósito.

**Lo que no se guarda es la parte que importa:** ni el `sessionId`, ni el texto, ni el nombre del
archivo. Guardar el id dejaría, después de *Borrar todo*, un rastro atado al identificador que el
navegador todavía tiene en `localStorage`: la promesa sería falsa por un tecnicismo. La suite
comprueba que el informe no contenga ningún UUID.

Para saber si probó **ese** prospecto sin saber quién es, el enlace de invitación lleva etiqueta
(`/?ref=plan-negocio`), normalizada a `[a-z0-9-]` y 24 caracteres. El desglose no es público:
`/api/uso` responde 404 sin `USO_TOKEN`, mismo criterio que Qatom.

**Un fallo que apareció por el camino:** `stats()` y `sweepExpired()` listaban la tabla **sin
filtrar partición**. Tal como estaba, cualquier fila nueva se habría contado como sesión y el
barrido habría intentado borrarla.

---

## Las decisiones que no se tomaron

| Lo que no se hizo | Por qué |
|---|---|
| Mover el producto a universitarios | Tiraba abajo el 75 % técnico de la rúbrica del Track 03 |
| Vender conversaciones o grafos de estudiantes | No se sostiene ante un jurado ni ante un padre, y haría falsa la promesa de que el servidor olvida |
| Un tablero para docentes | El docente promedio no fue formado para interpretar datos; el grafo lo lee mejor quien lo construye |
| Limitar la prueba por tiempo de reloj | Castigaría el pensar despacio, que es justo lo que el producto busca |
| Identificar a los usuarios para medir mejor | Contradice la portada; se mide el hecho, nunca de quién fue |
| Voz en tiempo real tipo llamada | El repo base usaba Gemini Live; no hay equivalente en Foundry y el grafo casi no crecía en modo audio |

## El estado hoy

| | |
|---|---|
| Despliegue | Azure Container Apps, `rg-context-hackandes`, `eastus` |
| Imagen / revisión | `context-aideatext:v11` · `context-aideatext--0000012` |
| Modelo | `claude-opus-5` en AI Foundry (`manuelvarale-7544-resource`) |
| Credenciales | Identidad administrada en todo. Cero claves |
| Suites | `smoke`, `material`, `voz`, `pdf`, `sesion`, `limites`, `uso` |

Lo que falta está en [`docs/TODO.md`](TODO.md). Lo más relevante: **"Llevarme mi resumen" no se
mide**, porque el PDF se arma entero en el navegador y el servidor no se entera — y es la señal de
interés más fuerte que hay.

> Los eventos de uso son perpetuos a propósito: **no se prueba contra producción.** Una sola pasada
> inflaría para siempre el contador que existe para mostrar gente real.
