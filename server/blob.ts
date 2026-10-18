/**
 * Guarda el material que sube el estudiante para que siga visible durante toda
 * la conversacion y al recargar la pagina.
 *
 * En Azure: Blob Storage con Managed Identity (sin claves). El contenedor es privado
 * y una regla de ciclo de vida borra los archivos a los 7 dias: son fotos de menores,
 * no hay razon para conservarlas mas.
 * En local, sin AZURE_STORAGE_BLOB_ENDPOINT, se guardan en memoria.
 */
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const CONTAINER = 'materiales';

let container: ContainerClient | null = null;
let ready: Promise<void> | null = null;

const endpoint = process.env.AZURE_STORAGE_BLOB_ENDPOINT?.trim();
if (endpoint) {
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
  console.log('[blob] sin AZURE_STORAGE_BLOB_ENDPOINT: el material vive solo en memoria');
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

export async function loadMaterial(
  blobName: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const enMemoria = memoria.get(blobName);
  if (enMemoria) return enMemoria;

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
