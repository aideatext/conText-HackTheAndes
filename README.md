# conText

**Un estudiante de secundaria sube una foto de su cuaderno, conversa con un tutor socrático sobre
ese material, y ve en tiempo real el grafo de las ideas que está conectando — distinguiendo qué
vino del material y qué construyó él.**

Hack the Andes 2026 · Track 03 (Educación Escolar) · Claude Opus 5 en Azure AI Foundry

🔗 **App: https://context.aideatext.ai**
📊 **Uso real:** `/api/stats` · ❤️ **Salud:** `/healthz`

---

## 1. Qué es

conText no resuelve tareas. Hace lo contrario: obliga a pensarlas.

El estudiante trae su propio material (una foto del cuaderno, un PDF, un texto). conText lo lee,
y a partir de ahí conversa: una pregunta a la vez, en español peruano, frases cortas. Mientras
conversa, un segundo modelo extrae las ideas del turno y las dibuja como un grafo que crece en vivo.
El material se queda a la vista durante toda la conversación: la foto tal cual, el PDF con su
primera página dibujada.

**Material no es sólo texto.** Una foto de un objeto cotidiano también se piensa. Ante un vaso
apoyado en la bandeja de CD de una computadora, conText no busca letras: extrae *"uso distinto al
previsto"*, *"la gente adapta los objetos"*, *"portavasos improvisado"*, *"¿qué necesidad resuelve
este uso?"*. Es el "ordenamiento conceptual" de la tesis que sostiene el proyecto (§2), aplicado a
la tecnología que el estudiante tiene delante.

El grafo distingue tres orígenes por color:

| Color | Origen | Significa |
|---|---|---|
| Tinta suave | `material` | Estaba en el archivo que subiste |
| **Azul** `#0b7ec5` | `estudiante` | **Lo pensaste tú** |
| Rojo `#ae0025` | `tutor` | Lo introdujo el tutor |

El azul y el rojo son los dos colores del logotipo de AIdeaText — *AIdea* en azul, *Text* en rojo —,
así que el grafo lleva la marca puesta mientras separa quién pensó cada idea.

El interruptor **"Mis conexiones"** deja solo las azules. Esa vista es el producto: el estudiante
ve, literalmente, cuánto de ese mapa es suyo.

Debajo del grafo hay cuatro indicadores en su propio lenguaje: *ideas que conectaste tú*,
*conexiones entre ideas*, *la idea que más conecta*, *ideas aún sueltas*.

## 2. Por qué, y para quién

**Usuario:** estudiante de secundaria en el Perú. No es un tablero para docentes.

- **ENLA 2024:** 32,8 % de 4.º de primaria alcanza nivel satisfactorio en lectura; 24,9 % en 6.º.
  El problema no es el acceso a información, es conectarla.
- **Tesis de Manuel Vargas (ESAN, 2011, Los Olivos):** los estudiantes aprendieron la tecnología
  solos o entre pares y *nunca* reconocieron a la escuela como ese espacio; el significado dominante
  fue la frustración. La recomendación fue un "ordenamiento conceptual" — una red de categorías que
  haga explícitos los significados. conText pone esa red en manos del estudiante, en vivo.
- **Por qué no un tablero docente:** el docente promedio no fue formado para interpretar datos. El
  grafo lo lee mejor quien lo construye.
- **Evidencia de diseño:** el tutor socrático frente al no socrático se probó con 122 estudiantes de
  14–16 años; el feedback con LLM aumenta la revisión del propio texto en 459 estudiantes de
  secundaria; [Attali et al., AIME-Con 2026](https://aclanthology.org/2026.aimecon-main.30.pdf)
  muestra transferencia del aprendizaje.

## 3. Arquitectura

```
Navegador (React 19 + Vite + D3)        Azure Container Apps (Node 22, Express 5)       Azure
────────────────────────────────        ─────────────────────────────────────────       ─────
foto / PDF / txt ──POST /api/material──► MIME real → bloque image|document|text ───────► AI Foundry
                                         Claude (visión / PDF nativo)                    claude-opus-5
                                         → resumen + nodos origin=material                ▲
                                         guarda el archivo ──────────────────────────► Blob Storage
chat o dictado ────POST /api/turn ─────► 1) tutor socrático en streaming  ────────────────┤  (7 días)
   (SSE)                                 2) extractor del grafo (JSON validado con zod) ──┘
   ◄── token… | graph_delta | metrics    3) fusiona, calcula métricas y persiste ───────► Table Storage
"el tutor habla" ──POST /api/voz ──────► SSML → es-PE-CamilaNeural ──────────────────► AI Speech
GET  /api/session/:id        (reanudar)                                                    (7 días)
POST /api/session/retomar    (volver desde el JSON que te llevaste)
DEL  /api/session/:id        (borrar todo, ahora)
POST /api/qatom/grafo        (lo que conText vende: texto → grafo, por llamada)
GET  /api/stats              (uso público)   ·   GET /healthz
```

Una sola imagen Docker: Express sirve `dist/` y la API en el mismo origen.

**Dos llamadas al modelo por turno, con roles distintos.** El tutor conversa; el extractor
estructura. Separarlos es lo que permite que el grafo crezca aunque el tutor responda en prosa, y
que el `origin` de cada idea sea honesto.

### Credenciales: cero claves

| | Local | Producción |
|---|---|---|
| Foundry | `az login` → `DefaultAzureCredential` | Managed Identity + rol *Cognitive Services User* |
| Table Storage | `az login` | Managed Identity + rol *Storage Table Data Contributor* |
| Blob Storage | `az login` | Managed Identity + rol *Storage Blob Data Contributor* |
| AI Speech | `az login` | Managed Identity + rol *Cognitive Services Speech User* |
| Registro de contenedores | — | Managed Identity + rol *AcrPull* |

La cuenta de almacenamiento tiene `allowSharedKeyAccess=false`: **no existe** una cadena de conexión
con clave que robar. El `.env.example` no tiene valores. El bundle del navegador no contiene ni el
nombre del recurso. El Dockerfile no tiene `ARG` ni `ENV` de secretos.

> El repo base inyectaba `GEMINI_API_KEY` en el bundle del navegador vía `vite.config.ts`. Eso se
> eliminó: hoy **todas** las llamadas al modelo salen del servidor.

### Robustez

- El extractor devuelve JSON; si falla, **un reintento**; si vuelve a fallar, se emite un
  `graph_delta` vacío y la conversación continúa. El chat nunca se rompe por el grafo.
- Validación con zod: ids normalizados a slug sin tildes, enlaces a nodos inexistentes descartados,
  máximo 8 nodos nuevos por turno, deduplicación por id y por etiqueta.
- Errores de Foundry (429 / 529 / timeout / permisos) se traducen a un mensaje en español que un
  escolar entiende. `maxRetries: 3`, timeout de 60 s.
- `helmet` con CSP, rate limit por IP (30 turnos / 5 min, 20 archivos / 10 min), validación de MIME
  y límite de 10 MB.
- Sesiones adheridas en el ingress y `min-replicas 1`.

## 4. Tu sesión es tuya

conText guarda lo mínimo y lo dice sin letra chica, en la propia pantalla:

- **Guardar sesión** baja un JSON con la conversación, el grafo y el resumen.
- **Retomar** vuelve a abrir ese JSON donde lo dejaste. El grafo se revalida al entrar con el mismo
  zod que valida al modelo: es un archivo que viene de fuera y no se confía en él.
- **Borrar todo** elimina del servidor la conversación, el grafo y el archivo, en el momento.
- Lo que no se borra a mano **caduca solo a los 7 días**: las sesiones por un barrido periódico, los
  archivos por una regla de ciclo de vida del propio Blob Storage. Sin caducidad, "el servidor
  olvida" sería mentira para quien se va sin pulsar el botón.

Y **"Llevarme mi resumen"** arma un PDF con la foto, el resumen, los indicadores, el grafo, la lista
de lo que pensó el estudiante y la conversación completa. Se construye entero en el navegador con
`pdf-lib`: el material no vuelve a salir hacia ningún servicio.

## 5. Lo que conText vende en Qatom

[Qatom](https://www.qatom.ai/hack-the-andes) es el riel de comercio agéntico del hackathon: una API
se vuelve un ítem de catálogo que otro agente descubre, pide y paga por llamada.

conText pone a la venta **su capacidad, no las conversaciones de nadie**:

```
POST /api/qatom/grafo     { "texto": "..." }  →  { nodes: [...], links: [...] }
GET  /api/qatom/contrato  el esquema de entrada y salida, en abierto
```

Un agente manda un texto y recibe el grafo de razonamiento validado: ideas tipadas (concepto,
afirmación, evidencia, ejemplo, pregunta) y las relaciones entre ellas (apoya, contradice, causa,
ejemplifica, se relaciona con, responde a). Es lo que un resumen no da: **la estructura del
argumento**. Sobre un texto de minería informal, el grafo devuelve el `contradice` entre "única
fuente de ingreso" y "destrucción del bosque" — el nudo del dilema, explícito.

Dos decisiones que importan:

- **No se vende ningún dato de ningún estudiante.** Ni conversaciones, ni grafos, ni material. Se
  vende la capacidad de estructurar un argumento, que es nuestra.
- La ruta de pago responde **404 y no 401** sin el token de cumplimiento: quien no pagó no debería
  ni enterarse de que la ruta existe. El token vive en los secretos del Container App.

"Nadie paga por una idea" deja de ser cierto cuando la idea tiene contrato, precio y recibo.

## 6. Qué **no** hace (y por qué)

- **No califica.** No pone notas ni puntajes.
- **No redacta por el estudiante.** Si le piden "hazme la tarea", explica su papel y propone el
  primer paso. Está probado como criterio de aceptación.
- **No sube audio ni video.** El estudiante dicta en vivo con la Web Speech API (`es-PE`) y nada de
  audio viaja al servidor. El tutor sí tiene voz: la neuronal `es-PE-CamilaNeural` de Azure AI
  Speech, sintetizada en el servidor con la misma identidad administrada. Si ese recurso falla, el
  navegador lee con su propia voz y la conversación no se queda muda.
- **No hay vista docente, ni integración con SIAGIE, ni Google Drive.** El repo base tenía OAuth de
  Drive con tokens en `localStorage` y `postMessage(..., '*')`: se eliminó entero.
- **No hay voz en tiempo real tipo llamada.** El repo base usaba la Gemini Live API; no hay
  equivalente en Foundry y el grafo casi no crecía en modo audio.

## 7. Correr en local

```bash
cp .env.example .env     # completa ANTHROPIC_FOUNDRY_RESOURCE
az login                 # de aquí sale la credencial; no hay claves
npm install
npm run dev              # http://localhost:3000
```

Pruebas en navegador real (escritorio y móvil, incluye los criterios de aceptación):

```bash
node scripts/fixtures.mjs        # genera el material de prueba
node scripts/smoke.mjs   [url]   # los criterios de aceptación, escritorio y móvil
node scripts/material.mjs [url]  # el material sigue visible y sobrevive a recargar
node scripts/voz.mjs     [url]   # el tutor habla con Azure Speech
node scripts/pdf.mjs     [url]   # "Llevarme mi resumen" produce el PDF
node scripts/sesion.mjs  [url]   # guardar, borrar y retomar la sesión
```

Sin `[url]` corren contra `http://localhost:3000`.

## 8. Desplegar

```powershell
az group create -n rg-context-hackandes -l eastus
az acr build -r <registro> -t context-aideatext:v1 .
az containerapp create -n context-aideatext -g rg-context-hackandes `
  --environment context-aideatext-env --image <registro>.azurecr.io/context-aideatext:v1 `
  --registry-server <registro>.azurecr.io --registry-identity system --system-assigned `
  --ingress external --target-port 3000 --min-replicas 1 --max-replicas 3 `
  --env-vars ANTHROPIC_FOUNDRY_RESOURCE=<recurso> CLAUDE_DEPLOYMENT=claude-opus-5 NODE_ENV=production

# roles (sin claves)
$p = az containerapp show -n context-aideatext -g rg-context-hackandes --query identity.principalId -o tsv
az role assignment create --assignee $p --role "Cognitive Services User"       --scope <id-del-recurso-foundry>
az role assignment create --assignee $p --role "Storage Table Data Contributor" --scope <id-del-storage>
az role assignment create --assignee $p --role "Storage Blob Data Contributor"  --scope <id-del-storage>
az role assignment create --assignee $p --role "Cognitive Services Speech User" --scope <id-del-speech>
az role assignment create --assignee $p --role "AcrPull"                        --scope <id-del-registro>
```

El recurso de Speech necesita subdominio propio (`--custom-domain`): es lo que exige la
autenticación con Entra ID. Y el token de Qatom va como secreto del Container App, nunca en el repo:

```powershell
az containerapp secret set -n context-aideatext -g rg-context-hackandes --secrets qatom-token=<token>
az containerapp update     -n context-aideatext -g rg-context-hackandes --set-env-vars QATOM_TOKEN=secretref:qatom-token
```

### Dominio propio

En el DNS (aquí Cloudflare, `aideatext.ai`), **con el proxy desactivado** — en modo proxy el CNAME
resuelve a IPs de Cloudflare, Azure no valida el dominio y además el stream SSE del chat se puede
bufferear:

| Tipo | Nombre | Contenido |
|---|---|---|
| `CNAME` | `context` | `<app>.<entorno>.eastus.azurecontainerapps.io` |
| `TXT` | `asuid.context` | el `customDomainVerificationId` del Container App |

```powershell
az containerapp hostname add  -n context-aideatext -g rg-context-hackandes --hostname context.aideatext.ai
az containerapp hostname bind -n context-aideatext -g rg-context-hackandes --hostname context.aideatext.ai `
  --environment context-aideatext-env --validation-method CNAME   # certificado gestionado, gratis
```

Si el dominio tiene registros CAA, deben permitir a `digicert.com`, que es quien emite el
certificado gestionado de Azure.

## 9. Origen

Derivado de [aideatext/Discovery-conText](https://github.com/aideatext/Discovery-conText)
(commit `c6d7372`). Se conservó la idea del grafo de fuerzas en D3 y la fusión incremental de nodos.
Se reemplazó el motor (Gemini → Claude en Foundry), el esquema del grafo (entidades de investigación
→ esquema pedagógico), la persistencia (`conversations.json` en disco, que devolvía las
conversaciones de todos a cualquiera → Table Storage por sesión) y toda la capa de credenciales.

Licencia Apache-2.0.
