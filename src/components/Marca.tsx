/**
 * La marca y las acreditaciones, como en aideatext.ai.
 *
 * El sello de NVIDIA trae su propio fondo blanco y su propio marco negro
 * —es una placa—, asi que no lleva borde ni fondo de esta hoja, y su `alt`
 * no va vacio: aqui no hay un texto al lado que diga "NVIDIA Inception",
 * asi que con alt="" la credencial desapareceria para quien no ve la imagen.
 */
import { useT } from '../i18n';

export function Marca() {
  const t = useT();
  // Cabecera estandar de AIdeaText (IDENTIDAD.md §5, repo aideatext-identidad):
  // logotipo y sello al MISMO alto, el logotipo enlaza a la portada.
  return (
    <div className="flex min-w-0 items-center gap-3">
      <a href="https://aideatext.ai" className="flex shrink-0 transition-opacity hover:opacity-80">
        <img
          src="/img/logo-aideatext.png"
          width={156}
          height={156}
          alt="AIdeaText"
          className="h-11 w-11 sm:h-12 sm:w-12"
        />
      </a>
      {/* Las dos credenciales van juntas: la leyenda no las separa. */}
      <img
        src="/img/nvidia-inception-color.svg"
        width={500}
        height={216}
        alt="NVIDIA Inception"
        className="hidden h-12 w-auto shrink-0 sm:block"
      />
      <div className="min-w-0 sm:border-l sm:border-borde sm:pl-3.5">
        <h1 className="titular text-xl leading-tight tracking-tight sm:text-[1.35rem]">conText</h1>
        <p className="mt-0.5 truncate text-xs text-tinta-suave">
          {t.marca.lema}
        </p>
      </div>
    </div>
  );
}

/**
 * El aviso de marca de NVIDIA. Va en el pie porque es donde no estorba y
 * donde se conserva: es la condicion de uso del sello que lleva la cabecera.
 */
export function AvisoNvidia() {
  return (
    <p className="text-[10px] leading-snug text-tinta-suave/70">
      © {new Date().getFullYear()} NVIDIA. NVIDIA, the NVIDIA logo, and NVIDIA Inception are
      trademarks and/or registered trademarks of NVIDIA Corporation in the U.S. and other countries.
    </p>
  );
}
