/**
 * La marca y las acreditaciones, como en aideatext.ai.
 *
 * El sello de NVIDIA trae su propio fondo blanco y su propio marco negro
 * —es una placa—, asi que no lleva borde ni fondo de esta hoja, y su `alt`
 * no va vacio: aqui no hay un texto al lado que diga "NVIDIA Inception",
 * asi que con alt="" la credencial desapareceria para quien no ve la imagen.
 */

export function Marca() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/img/logo-aideatext.png"
        width={156}
        height={156}
        alt="AIdeaText"
        className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
      />
      {/* Las dos credenciales van juntas: la leyenda no las separa. */}
      <img
        src="/img/nvidia-inception-color.svg"
        width={500}
        height={216}
        alt="NVIDIA Inception"
        className="hidden h-9 w-auto shrink-0 sm:block"
      />
      <div className="min-w-0 sm:border-l sm:border-borde sm:pl-3">
        <h1 className="titular text-lg leading-none tracking-tight sm:text-xl">conText</h1>
        <p className="mt-0.5 truncate text-xs text-tinta-suave">
          Piensa tus ideas en voz alta y míralas conectarse.
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
