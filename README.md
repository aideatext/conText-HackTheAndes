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

El grafo distingue tres orígenes por color:

| Color | Origen | Significa |
|---|---|---|
| Gris pizarra | `material` | Estaba en el archivo que subiste |
| **Azul** | `estudiante` | **Lo pensaste tú** |
| Ámbar | `tutor` | Lo introdujo el tutor |

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
chat o dictado ────POST /api/turn ─────► 1) tutor socrático en streaming  ────────────────┤
   (SSE)                                 2) extractor del grafo (JSON validado con zod) ──┘
   ◄── token… | graph_delta | metrics    3) fusiona, calcula métricas y persiste ───────► Table Storage
GET /api/session/:id  (reanudar)                                                           (sessions)
GET /api/stats        (uso público)
GET /healthz
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

## 4. Qué **no** hace (y por qué)

- **No califica.** No pone notas ni puntajes.
- **No redacta por el estudiante.** Si le piden "hazme la tarea", explica su papel y propone el
  primer paso. Está probado como criterio de aceptación.
- **No sube audio ni video.** La voz es dictado en vivo en el navegador (Web Speech API, `es-PE`) y
  lectura en voz alta (`speechSynthesis`). Nada de audio viaja al servidor.
- **No hay vista docente, ni integración con SIAGIE, ni Google Drive.** El repo base tenía OAuth de
  Drive con tokens en `localStorage` y `postMessage(..., '*')`: se eliminó entero.
- **No hay voz en tiempo real tipo llamada.** El repo base usaba la Gemini Live API; no hay
  equivalente en Foundry y el grafo casi no crecía en modo audio.

## 5. Correr en local

```bash
cp .env.example .env     # completa ANTHROPIC_FOUNDRY_RESOURCE
az login                 # de aquí sale la credencial; no hay claves
npm install
npm run dev              # http://localhost:3000
```

Pruebas en navegador real (escritorio y móvil, incluye los criterios de aceptación):

```bash
node scripts/fixtures.mjs          # genera material de prueba
node scripts/smoke.mjs             # contra local
node scripts/smoke.mjs <url>       # contra la URL pública
```

## 6. Desplegar

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
az role assignment create --assignee $p --role "AcrPull"                        --scope <id-del-registro>
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

## 7. Origen

Derivado de [aideatext/Discovery-conText](https://github.com/aideatext/Discovery-conText)
(commit `c6d7372`). Se conservó la idea del grafo de fuerzas en D3 y la fusión incremental de nodos.
Se reemplazó el motor (Gemini → Claude en Foundry), el esquema del grafo (entidades de investigación
→ esquema pedagógico), la persistencia (`conversations.json` en disco, que devolvía las
conversaciones de todos a cualquiera → Table Storage por sesión) y toda la capa de credenciales.

Licencia Apache-2.0.
