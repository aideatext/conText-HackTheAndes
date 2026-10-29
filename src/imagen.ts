/**
 * Achica la foto en el navegador antes de subirla.
 *
 * Claude mira las imagenes a unos 1.600 pixeles por lado: una foto de celular de
 * 7 MB no le muestra nada mas que una de 300 KB, y si tarda mucho mas en subir con
 * mala senal y le pesa mas al servidor del plan gratis. Si algo falla, se sube la
 * original: achicar es una mejora, nunca un requisito.
 */
const LADO_MAX = 1600;
const YA_LIVIANA = 1.5 * 1024 * 1024;

export async function reducirFoto(file: File): Promise<File> {
  // GIF puede ser animado y PDF/texto no son fotos: van tal cual.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size <= YA_LIVIANA) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Fondo blanco: un PNG transparente pasado a JPEG quedaria negro.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
