/**
 * Guarda el material que sube el estudiante para que siga visible durante toda
 * la conversacion y al recargar la pagina.
 *
 * En Azure: Blob Storage con Managed Identity (sin claves). El contenedor es privado
 * y una regla de ciclo de vida borra los archivos a los 7 dias: son fotos de menores,
 * no hay razon para conservarlas mas.
 * En AWS (S3_BUCKET definido): bucket privado y cifrado; una regla de ciclo de
 * vida borra `materiales/` al dia. Es lo que usa conText en Render.
 * En local, sin S3_BUCKET ni AZURE_STORAGE_BLOB_ENDPOINT, se guardan en memoria.
 */
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET?.trim() || null;
const s3 = bucket ? new S3Client({}) : null;
if (bucket) console.log(`[blob] S3 activo (${bucket})`);

const CONTAINER = 'materiales';

let container: ContainerClient | null = null;
let ready: Promise<void> | null = null;

const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT?.trim();
if (bucket) {
  // S3 manda; Azure no se abre aunque quede la variable.
} else if (endpoint) {
  const service = new BlobServiceClient(endpoint, new DefaultAzureCredential());
  container = service.getContainerClient(CONTAINER);
  ready = container
    .createIfNotExists()
    .then(() => {
      console.log('[blob] Azure Blob Storage activo');
    })
    .catch((err: any) => {
      console.warn('[blob] no se pudo preparar el contenedor, se sigue en memoria:', err?.message);
      container = null;
    });
} else {
  console.log('[blob] sin S3_BUCKET ni AZURE_STORAGE_BLOB_ENDPOINT: el material vive solo en memoria');
}

/** Respaldo en memoria para desarrollo local. */
const memoria = new Map<string, { buffer: Buffer; mime: string }>();

export interface StoredMaterial {
  blobName: string;
  mime: string;
  size: number;
}

export async function saveMaterial(
  sessionId: string,
  buffer: Buffer,
  mime: string,
  originalName: string,
): Promise<StoredMaterial> {
  const ext = (originalName.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? '').toLowerCase();
  // El prefijo "materiales/" es el que mira la regla de borrado a 7 dias.
  const blobName = `materiales/${sessionId}${ext}`;
  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: blobName, Body: buffer, ContentType: mime }));
      return { blobName, mime, size: buffer.length };
    } catch (err: any) {
      console.warn('[blob] S3: fallo al subir, se guarda en memoria:', err?.message);
      memoria.set(blobName, { buffer, mime });
      return { blobName, mime, size: buffer.length };
    }
  }

  if (container) {
    try {
      await ready;
      await container.getBlockBlobClient(blobName).uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mime },
      });
      return { blobName, mime, size: buffer.length };
    } catch (err: any) {
      console.warn('[blob] fallo al subir, se guarda en memoria:', err?.message);
    }
  }

  memoria.set(blobName, { buffer, mime });
  return { blobName, mime, size: buffer.length };
}

/** Borra el archivo del estudiante. Se usa al reiniciar la sesion. */
export async function deleteMaterial(blobName: string): Promise<void> {
  memoria.delete(blobName);
  if (s3 && bucket) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: blobName }));
    } catch (err: any) {
      console.warn('[blob] S3: no se pudo borrar el material:', err?.message);
    }
    return;
  }
  if (!container) return;
  try {
    await ready;
    await container.getBlockBlobClient(blobName).deleteIfExists();
  } catch (err: any) {
    console.warn('[blob] no se pudo borrar el material:', err?.message);
  }
}

export async function loadMaterial(
  blobName: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const enMemoria = memoria.get(blobName);
  if (enMemoria) return enMemoria;

  if (s3 && bucket) {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: blobName }));
      const buffer = Buffer.from(await r.Body!.transformToByteArray());
      return { buffer, mime: r.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  if (!container) return null;
  try {
    await ready;
    const blob = container.getBlockBlobClient(blobName);
    const buffer = await blob.downloadToBuffer();
    const props = await blob.getProperties();
    return { buffer, mime: props.contentType ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}
