# Migrar conText de Azure a AWS

Guía de trabajo, no un resumen. Cada paso se puede ejecutar y verificar.

**Estado al escribirla:** conText corre en Azure (Container Apps + AI Foundry + Table/Blob Storage +
AI Speech) en `https://context.aideatext.ai`. Nada de esto borra esa instalación: la migración se
hace en paralelo y el dominio se mueve al final, cuando AWS ya pasa las cinco suites de prueba.

---

## 1. Qué cambia, pieza por pieza

| conText en Azure | Equivalente en AWS | Dificultad |
|---|---|---|
| Claude Opus en **AI Foundry** (`@anthropic-ai/foundry-sdk`) | **Amazon Bedrock** (`@anthropic-ai/bedrock-sdk`) | Baja — cambia el cliente, no las llamadas |
| **Managed Identity** + roles RBAC | **IAM role** de la tarea (cadena de credenciales del SDK) | Baja — misma idea, sin claves |
| **Container Apps** | **App Runner** | Baja — imagen → URL pública con TLS |
| **Azure Container Registry** | **ECR** | Baja |
| **Table Storage** (`sessions`) | **DynamoDB** | Media — cambia el cliente y el modelo de datos |
| **Blob Storage** (`materiales`) | **S3** | Baja |
| Caducidad: barrido propio + *lifecycle* del blob | **TTL nativo de DynamoDB** + *lifecycle* de S3 | Baja — y queda **mejor** que en Azure |
| **AI Speech** `es-PE-CamilaNeural` | **Polly** — *no hay voz peruana* | **Alta: ver §2** |
| Secreto del Container App (`qatom-token`) | **Secrets Manager** | Baja |
| Dominio + certificado gestionado | **App Runner custom domain + ACM** | Baja |
| Log Analytics | **CloudWatch Logs** | Baja — sale gratis con App Runner |

**Lo que no falta nada:** de todo lo que conText usa del modelo —mensajes, streaming, visión, PDF
nativo, *prompt caching*— Bedrock lo soporta todo. Lo que Bedrock **no** tiene (Batches, Files API,
*server-side fallbacks*, fast mode, Managed Agents, web search del servidor) conText no lo usa.

---

## 2. El único hueco real: la voz peruana

Azure sintetiza con `es-PE-CamilaNeural`. **Polly no tiene español de Perú.** Según la lista oficial
de voces de AWS, el español disponible es:

| Código | Voces |
|---|---|
| `es-ES` | Conchita, Lucia, Alba, Enrique |
| `es-MX` | **Mia**, **Andrés** (neurales) |
| `es-US` | Lupe, Penélope, Miguel, Pedro |

No es un detalle cosmético: el tutor le habla a un escolar peruano, y el acento es parte de que
suene como alguien de su mundo y no como un doblaje. Tres salidas, en orden de lo que yo haría:

1. **Híbrido (recomendado).** Todo a AWS menos la voz, que se queda en Azure AI Speech. El recurso
   de Speech es barato, ya está creado y la llamada es un `fetch` autenticado. Se pierde la pureza
   de "todo en una nube"; se conserva el producto.
2. **Polly con `es-MX` (Mia, neural).** Es el acento más cercano de los disponibles. Hay que
   probarlo con estudiantes antes de darlo por bueno: "mexicano" no es "neutro" para un oído
   peruano.
3. **Otro proveedor de voz** (ElevenLabs y similares tienen español peruano). Añade un tercero y una
   clave de API, que es justo lo que conText evitó en todo lo demás.

Decidir esto **antes** de migrar: es lo único que cambia el producto, no la infraestructura.

---

## 3. Antes de empezar

```bash
# AWS CLI (no está instalado en la PC del hackathon)
winget install --id Amazon.AWSCLI -e

aws configure sso          # o aws configure con un usuario IAM
aws sts get-caller-identity
```

**Pedir acceso al modelo.** En la consola de Bedrock → *Model access* → habilitar los modelos de
Anthropic en la región elegida. Sin esto, la primera llamada falla con `AccessDeniedException` y
parece un problema de permisos IAM cuando no lo es.

**Región.** `us-east-1` tiene la mayor disponibilidad de modelos. Desde Lima la latencia es
aceptable (~60-80 ms más que Azure East US, que es donde está hoy).

```bash
export AWS_REGION=us-east-1
export CUENTA=$(aws sts get-caller-identity --query Account --output text)
export PROYECTO=context
```

---

## 4. Infraestructura base

```bash
# Registro de imágenes
aws ecr create-repository --repository-name $PROYECTO --region $AWS_REGION

# Sesiones: DynamoDB, con TTL nativo (mejor que el barrido que hacemos en Azure)
aws dynamodb create-table \
  --table-name $PROYECTO-sessions \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION

aws dynamodb update-time-to-live \
  --table-name $PROYECTO-sessions \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --region $AWS_REGION

# Material: S3 privado, con borrado a los 7 días
aws s3api create-bucket --bucket $PROYECTO-materiales-$CUENTA --region $AWS_REGION
aws s3api put-public-access-block --bucket $PROYECTO-materiales-$CUENTA \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-lifecycle-configuration \
  --bucket $PROYECTO-materiales-$CUENTA \
  --lifecycle-configuration file://infra/aws/s3-lifecycle.json

# Secreto de Qatom
aws secretsmanager create-secret --name $PROYECTO/qatom-token \
  --secret-string "<el token>" --region $AWS_REGION
```

El rol de la tarea está en [`infra/aws/iam-task-role.json`](../infra/aws/iam-task-role.json) y la
política de permisos en [`infra/aws/iam-task-policy.json`](../infra/aws/iam-task-policy.json).
Reemplazar `CUENTA`, `REGION` y `PROYECTO` antes de aplicar:

```bash
aws iam create-role --role-name $PROYECTO-task \
  --assume-role-policy-document file://infra/aws/iam-task-role.json
aws iam put-role-policy --role-name $PROYECTO-task \
  --policy-name $PROYECTO-permisos --policy-document file://infra/aws/iam-task-policy.json
```

> **El principio que no se negocia:** igual que en Azure, **cero claves**. El SDK de AWS resuelve
> credenciales por la cadena estándar y en App Runner eso es el rol de la instancia. Si alguien
> propone poner `AWS_ACCESS_KEY_ID` en una variable de entorno, es exactamente el error que este
> proyecto eliminó del repo base.

---

## 5. El modelo: Foundry → Bedrock

```bash
npm uninstall @anthropic-ai/foundry-sdk @azure/identity
npm install @anthropic-ai/bedrock-sdk
```

`server/claude.ts` queda así. **Las llamadas no cambian**: `claude.messages.create` y
`claude.messages.stream` tienen la misma firma, así que `extract.ts`, `material.ts`, `qatom.ts` e
`index.ts` no se tocan.

```ts
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';

// En Bedrock los ids llevan el prefijo `anthropic.`
export const MODEL = process.env.CLAUDE_MODEL ?? 'anthropic.claude-opus-5-5';

// Sin credenciales en el código: en App Runner las pone el rol de la instancia,
// igual que la Managed Identity en Container Apps.
export const claude = new AnthropicBedrockMantle({
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  maxRetries: 3,
  timeout: 60_000,
});
```

`textOf()` y `friendlyError()` se quedan **tal cual**: el filtrado de bloques `thinking` antes del
`text` aplica igual, y los códigos 429/529 son los mismos.

**El caching se conserva tal cual.** Bedrock soporta *prompt caching*, así que los
`cache_control` del extractor, del material y del tutor siguen funcionando sin cambios — y son lo
que hoy ahorra el 53 % de los tokens de entrada. Un detalle: la integración antigua de Bedrock
(Opus 4.6 y anteriores) rechaza el `cache_control` de nivel superior con un 400; con el cliente
Mantle y Opus 5.5 no aplica, pero si alguien baja de modelo, el del tutor es el que rompería.

Dos avisos:

- Usar el cliente **`AnthropicBedrockMantle`**, no `AnthropicBedrock` a secas: ese es el camino
  antiguo por `bedrock-runtime` / `InvokeModel`.
- Si se aprovecha para subir de `claude-opus-5` a `claude-opus-5-5`, revisar que el código no
  desactive el pensamiento ni fuerce `tool_choice`: en Opus 5.5 ambas cosas devuelven 400. conText
  no hace ninguna de las dos, así que el cambio de modelo es limpio.

---

## 6. Sesiones: Table Storage → DynamoDB

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

El contrato de `server/store.ts` no cambia (`getSession`, `persist`, `deleteSession`, `stats`); solo
el cuerpo. Lo relevante:

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const tabla = process.env.DYNAMODB_TABLE;            // context-sessions
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SIETE_DIAS = 7 * 24 * 60 * 60;

export async function persist(session: Session): Promise<void> {
  session.updatedAt = new Date().toISOString();
  memory.set(session.sessionId, session);
  if (!tabla) return;
  await doc.send(new PutCommand({
    TableName: tabla,
    Item: {
      sessionId: session.sessionId,
      payload: JSON.stringify(session),
      turns: session.turns,
      nodes: session.graph.nodes.length,
      updatedAt: session.updatedAt,
      // TTL nativo: DynamoDB borra el registro solo. Esto reemplaza sweepExpired().
      expiresAt: Math.floor(Date.now() / 1000) + SIETE_DIAS,
    },
  }));
}
```

**Lo que mejora:** `sweepExpired()` y su `setInterval` cada seis horas **se eliminan**. DynamoDB
caduca los registros por sí mismo con el atributo `expiresAt`. Es menos código nuestro sosteniendo
una promesa que le hacemos al estudiante.

**Un aviso sobre `stats()`:** hoy hace un recorrido de toda la tabla. Un `Scan` en DynamoDB se paga
por lectura y crece con el uso. Mientras sean cientos de sesiones da igual; si conText despega,
cambiarlo por un contador atómico (`UpdateExpression` con `ADD`) en un único registro `#contadores`.

---

## 7. Material: Blob Storage → S3

```bash
npm install @aws-sdk/client-s3
```

`server/blob.ts`, mismo contrato (`saveMaterial`, `loadMaterial`, `deleteMaterial`):

```ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({});

export async function saveMaterial(sessionId, buffer, mime, originalName) {
  const ext = (originalName.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? '').toLowerCase();
  const blobName = `materiales/${sessionId}${ext}`;   // el prefijo que mira el lifecycle
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: blobName, Body: buffer, ContentType: mime,
  }));
  return { blobName, mime, size: buffer.length };
}
```

Al leer, `GetObjectCommand` devuelve un stream: `await res.Body.transformToByteArray()` da el
`Buffer`. El bucket sigue **privado**; el archivo se sirve por `GET /api/material/:id/archivo` como
hoy. No usar URLs prefirmadas: expondrían el material fuera de la sesión.

---

## 8. La voz: AI Speech → Polly (leer §2 antes)

```bash
npm install @aws-sdk/client-polly
```

```ts
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

const polly = new PollyClient({});
const VOZ = process.env.POLLY_VOICE ?? 'Mia';   // es-MX neural: lo más cercano a es-PE

const res = await polly.send(new SynthesizeSpeechCommand({
  Text: ssml,                 // el mismo SSML; escapar igual que hoy
  TextType: 'ssml',
  VoiceId: VOZ,
  Engine: 'neural',
  LanguageCode: 'es-MX',
  OutputFormat: 'mp3',
}));
const audio = Buffer.from(await res.AudioStream.transformToByteArray());
```

La caché de audio y el respaldo a la voz del navegador se quedan igual: si Polly falla, 503 y el
navegador lee con su propia voz.

---

## 9. Despliegue: Container Apps → App Runner

```bash
# Imagen (el Dockerfile actual sirve sin cambios)
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $CUENTA.dkr.ecr.$AWS_REGION.amazonaws.com
docker build -t $PROYECTO .
docker tag $PROYECTO:latest $CUENTA.dkr.ecr.$AWS_REGION.amazonaws.com/$PROYECTO:v1
docker push $CUENTA.dkr.ecr.$AWS_REGION.amazonaws.com/$PROYECTO:v1

aws apprunner create-service --cli-input-json file://infra/aws/apprunner-service.json
```

El `Dockerfile` **no se toca**: ya expone 3000, corre sin privilegios y no tiene `ARG`/`ENV` de
secretos. App Runner da TLS y URL pública igual que Container Apps.

**Sesiones adheridas.** En Azure activamos *sticky sessions* para que la caché en memoria de cada
réplica no sirva datos viejos. App Runner **no** tiene afinidad de sesión. Dos opciones: una sola
instancia mientras el uso sea bajo (lo más simple y lo que haría para empezar), o quitar la caché en
memoria de `store.ts` y leer siempre de DynamoDB — más llamadas, pero sin estado local.

Para la primera:

```bash
aws apprunner create-auto-scaling-configuration   --auto-scaling-configuration-name $PROYECTO-una-instancia   --max-size 1 --min-size 1 --region $AWS_REGION
# y pasar el ARN devuelto como --auto-scaling-configuration-arn en create-service
```

---

## 10. El dominio

```bash
aws apprunner associate-custom-domain \
  --service-arn <arn> --domain-name context.aideatext.ai
```

Devuelve los registros de validación. En Cloudflare, **con el proxy desactivado (nube gris)**, por
lo mismo que en Azure: el proxy rompe la validación y, sobre todo, puede bufferear el stream SSE del
chat y el tutor dejaría de escribirse palabra por palabra.

El CAA del dominio ya permite `amazon.com`? **Verificarlo antes**: hoy la lista incluye
`letsencrypt.org`, `digicert.com`, `sectigo.com`, `ssl.com`, `pki.goog`, `globalsign.com` y
`comodoca.com`. ACM emite con **Amazon Trust Services**, así que hay que añadir:

```
aideatext.ai.  CAA  0 issue "amazon.com"
```

Sin ese registro, ACM se queda esperando validación y el error no dice que la causa sea el CAA.

---

## 11. Verificación: las mismas cinco suites

No hay migración terminada hasta que esto pase contra la URL de AWS:

```bash
node scripts/smoke.mjs    https://<url-de-app-runner>
node scripts/material.mjs https://<url-de-app-runner>
node scripts/voz.mjs      https://<url-de-app-runner>
node scripts/pdf.mjs      https://<url-de-app-runner>
node scripts/sesion.mjs   https://<url-de-app-runner>
```

Y a mano, lo que las suites no cubren:

- [ ] `GET /healthz` → `ok:true, voz:true, qatom:true`
- [ ] `POST /api/qatom/grafo` sin token → **404** (no 401)
- [ ] Subir un video → **415** con mensaje claro; 11 MB → **413**
- [ ] "Hazme la tarea" → el tutor no la hace
- [ ] Borrar todo → el archivo pasa de 200 a **404**
- [ ] `git grep` del token de Qatom en el repo → **nada**

---

## 12. Orden de corte

1. Levantar AWS en paralelo; Azure sigue sirviendo el dominio.
2. Pasar las cinco suites contra la URL de App Runner.
3. Mover `context.aideatext.ai` en Cloudflare al CNAME de App Runner.
4. **Dejar Azure encendido 48 h.** Revertir es cambiar un CNAME.
5. Recién entonces: `az group delete -n rg-context-hackandes --yes`.

Las sesiones vivas **no se migran**: caducan a los 7 días y el estudiante que quiera conservar la
suya ya tiene el botón "Guardar sesión" que baja el JSON. Es justo para lo que se construyó.

---

## 13. Lo que cuesta

Para el orden de magnitud de conText (decenas de sesiones al día), lo que domina es Bedrock; el
resto son centavos:

| Servicio | Nota |
|---|---|
| Bedrock | Por token. Es el 90 % de la factura. Precios de partner, distintos de los de Anthropic |
| App Runner | Por vCPU/hora y GB/hora; cobra también la instancia aprovisionada en reposo |
| DynamoDB | Pago por petición; a este volumen, centavos |
| S3 | Centavos — y los objetos se borran a los 7 días |
| Polly | Por carácter sintetizado; la caché de audio que ya existe reduce bastante |
| Secrets Manager | ~0,40 USD por secreto al mes |

**El ahorro real no está en la nube, está en el modelo:** activar *prompt caching* en el system
prompt del tutor (que es fijo y largo) y bajar el `effort` del extractor, que no necesita el máximo.
Eso se puede hacer hoy mismo en Azure, sin esperar a AWS.
