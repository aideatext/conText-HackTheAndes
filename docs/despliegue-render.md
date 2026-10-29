# conText en Render, y cómo volver a Azure

Guía de trabajo. Desde el 27 oct 2026 conText corre en **Render (plan Free)**, desplegado desde
GitHub, y el modelo va por la **API de Anthropic** con los créditos de Claude for Startups. Azure
queda fuera, pero el código no lo olvida: volver es cuestión de variables de entorno.

---

## 1. Qué cambió y qué se pierde

| | En Azure | En Render Free |
|---|---|---|
| Modelo | Claude en AI Foundry | API de Anthropic (créditos de startup) |
| Credencial de Claude | Managed Identity, cero claves | `ANTHROPIC_API_KEY` como secreto de Render |
| Sesiones y medición de uso | Table Storage | Memoria: se pierden al dormirse o redesplegar |
| Material subido | Blob Storage, caduca a 7 días | Memoria |
| Voz | AI Speech `es-PE-CamilaNeural` | La del navegador (el respaldo que ya existía) |
| Costo del hosting | Container Apps | 0 |
| Arranque | Inmediato | Se duerme sin visitas; la primera tarda en despertar |

Nada de esto toca el código de sesiones, material o voz: cada pieza ya caía a memoria o al navegador
cuando faltaba su variable `AZURE_*`. Por eso volver a Azure no requiere programar.

Lo que el estudiante no pierde: **"Guardar sesión"** baja el JSON y **retomar** lo reconstruye,
aunque el servidor se haya reiniciado.

## 2. El servicio en Render

*New → Web Service*, conectado al repo de GitHub.

| Campo | Valor |
|---|---|
| Branch | `main` (cada push despliega solo) |
| Language | Docker. El `Dockerfile` sirve sin cambios |
| Region | Virginia u Ohio, las más cercanas a Lima |
| Instance type | Free |
| Health check path | `/healthz` |

El puerto no se configura: Render pasa su `PORT` y el servidor lo lee.

**Variables de entorno:**

| Nombre | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de la Console, en el workspace `context-demo` |
| `CLAUDE_MODEL` | `claude-opus-5` |
| `NODE_ENV` | `production` |
| `USO_TOKEN` | Opcional: abre `/api/uso` |

Ninguna `AZURE_*` y ninguna `ANTHROPIC_ENTRA_AUDIENCE`.

> **La clave sólo vive en Render.** Ni en el repo, ni en la imagen, ni en un chat. El workspace
> `context-demo` lleva **límite de gasto**: es una demo abierta y los créditos se acaban. Si la
> clave se filtra, se revoca en la Console y se pega una nueva en Render.

## 3. Verificación

- [ ] `GET /healthz` → `ok: true`, `auth: "entorno"`, `voz: false`
- [ ] Un turno en la app → el tutor responde palabra por palabra (el SSE pasa por el proxy de Render)
- [ ] Subir una foto → el material se ve en la conversación
- [ ] `node scripts/smoke.mjs https://<servicio>.onrender.com`

Las suites `voz.mjs` y `uso.mjs` no aplican: sin Speech no hay voz del servidor, y `uso.mjs` se
niega a correr contra un despliegue.

## 4. El dominio

`context.aideatext.ai` apunta a Render desde el 27 oct 2026 (servicio `context-v2`, también en
`https://context-v2.onrender.com`). Así se hizo, y así se rehace:

1. En Render, *Settings → Custom Domains → Add* `context.aideatext.ai`.
2. En Cloudflare, el CNAME `context` → `context-v2.onrender.com`, **con el proxy desactivado (nube
   gris)**, por lo mismo que en Azure: el proxy puede bufferear el SSE y el tutor dejaría de
   escribirse palabra por palabra.
3. Render verifica y emite el certificado (Google Trust Services, que el CAA del dominio permite
   vía `pki.goog`). Lo renueva solo.

Verificado al mover: `/healthz` con `auth: "entorno"` y un turno transmitido en vivo por el dominio.

El TXT `asuid.context` de Cloudflare era la verificación de Azure: sobra mientras no se vuelva.
Para volver a Azure (§5), el CNAME `context` regresa al Container App y ese TXT se recrea.

## El despertador

El plan Free duerme el servicio tras unos 15 minutos sin visitas, y la primera visita después lo
encuentra arrancando: tarda medio minuto o recibe un **error 520** de Cloudflare. Pasó el 29 oct 2026.

[`.github/workflows/despertador.yml`](../.github/workflows/despertador.yml) visita `/healthz` cada 5
minutos. `/healthz` no cuenta como uso, así que el contador público no se infla.

> **No es confiable.** En sus primeras 8 horas GitHub lo corrió **una vez** por horario, no cerca de
> cien: las tareas programadas frecuentes se retrasan o se saltan. El 29 oct 2026 conText se volvió a
> dormir y una subida de foto recibió un 502 del proxy de Render. Lo que sí cumple es un monitor
> externo como **UptimeRobot** (gratis, cada 5 minutos, avisa por correo si cae), o el plan de pago,
> que no duerme. El de GitHub queda como respaldo.

Desde ese día la app además **se defiende sola** del arranque en frío: ante un 502, 503 o 504 del
proxy, la subida de material y el envío de un mensaje esperan y reintentan tres veces (4, 8 y 12 s)
antes de rendirse con un mensaje claro. Y las fotos se achican en el navegador a 1.600 px antes de
subir ([`src/imagen.ts`](../src/imagen.ts)): una foto de celular de 7 MB llega con unos 200 KB.

- **Horas:** encendido todo el mes son 744 de las 750 horas gratis **del workspace**. Alcanza sólo
  si conText es el único servicio gratuito; con otro, a fin de mes se suspenderían los dos.
- **Alarma:** si conText no responde tras tres intentos, la tarea falla y GitHub avisa por correo.
- **Si deja de correr:** GitHub desactiva las tareas programadas de un repo público tras 60 días
  sin actividad. Se reactiva en la pestaña *Actions* del repo.
- **Para apagarlo** (por ejemplo, al pasar a un plan de pago, que no duerme): *Actions →
  Despertador → Disable workflow*, o borrar el archivo.

---

## 5. Volver a Azure

Dos caminos, según qué se quiera recuperar.

### A. Azure con la API de Anthropic (recomendado)

El código de este commit ya lo soporta. Se conserva la API de Anthropic (los créditos) y vuelven la
persistencia, la voz peruana y las cero claves.

1. Federación de identidad: seguir [`claude-api-federacion.md`](claude-api-federacion.md). Deja
   `ANTHROPIC_ENTRA_AUDIENCE` y los IDs `ANTHROPIC_*` en el Container App.
2. Las variables de Azure que ya existían, con los mismos valores que tenía el Container App y
   sus roles de Managed Identity (README §8): `AZURE_TABLES_ENDPOINT`,
   `AZURE_STORAGE_BLOB_ENDPOINT` y `AZURE_SPEECH_ENDPOINT`. Para verlas antes de borrar nada:

   ```bash
   az containerapp show -n context-aideatext -g rg-context-hackandes \
     --query "properties.template.containers[0].env" -o table
   ```

3. **Sin** `ANTHROPIC_API_KEY`: con `ANTHROPIC_ENTRA_AUDIENCE` definida no se usa, pero no tiene
   por qué estar.
4. `/healthz` → `auth: "federacion-azure"`, `voz: true`.

### B. Azure con AI Foundry, tal como estaba

Para volver exactamente a la versión del hackathon, con el modelo facturado en Azure:

```bash
git checkout azure-foundry      # etiqueta del último commit en Foundry (a2b89ac)
```

Y desplegar como dice el README de esa versión (`ANTHROPIC_FOUNDRY_RESOURCE`,
`CLAUDE_DEPLOYMENT`, rol *Cognitive Services User*). Lo único que cambia respecto de hoy es
[`server/claude.ts`](../server/claude.ts) y la dependencia `@anthropic-ai/foundry-sdk`: si sólo se
quiere el cliente de Foundry sobre el código actual, basta con traer ese archivo de la etiqueta.

| Pieza | Volver = |
|---|---|
| Modelo en Foundry | `server/claude.ts` + `@anthropic-ai/foundry-sdk` de `azure-foundry` |
| Sesiones | `AZURE_TABLES_ENDPOINT` |
| Material | `AZURE_STORAGE_BLOB_ENDPOINT` |
| Voz peruana | `AZURE_SPEECH_ENDPOINT` |
| Hosting | Container Apps, README §8 |
