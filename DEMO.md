# Guion de la demo — 5 minutos

URL: **https://context.aideatext.ai** · Plan B: vídeo grabado (ver al final)

Antes de empezar: abrir la página **en el celular y en la laptop**, y tener a mano la foto del vaso
en la bandeja de CD y el PDF de la papa.

---

## 0 · Antes de hablar (30 s de preparación, sin público)

- [ ] `https://context.aideatext.ai/healthz` responde `ok:true, voz:true, qatom:true`
- [ ] Pulsar **Borrar todo** para empezar limpio
- [ ] Activar **"El tutor habla"**
- [ ] Conexión: si el wifi del venue falla, pasar a datos móviles

---

## 1 · El problema, en una frase (30 s)

> "ENLA 2024: 32,8 % de cuarto de primaria llega a nivel satisfactorio en lectura. El problema de
> nuestros estudiantes no es el acceso a la información — la tienen toda en el bolsillo. Es
> conectarla. Y nadie les enseña a ver cómo conectan."

---

## 2 · El momento que vende: la foto del vaso (90 s)

Subir `test_img-1-vaso_computadora.png`.

> "Esto no es una página de cuaderno. Es un vaso apoyado en la bandeja de CD de una computadora, en
> una cabina de internet. Veamos qué hace conText con algo que no tiene una sola letra."

Señalar el resumen y los nodos que aparecen: *uso distinto al previsto*, *la gente adapta los
objetos*, *portavasos improvisado*.

> "Mi tesis de 2011 encontró que los estudiantes aprendían tecnología solos, y que el significado
> dominante era la frustración. La recomendación era un ordenamiento conceptual. Esto es esa red,
> en vivo, en manos del estudiante."

Escribir: **"Esa foto la tomé en la cabina de internet de mi barrio. Todos ponen el vaso ahí."**

Dejar que el tutor responda **en voz alta** y señalar el grafo creciendo mientras habla.

---

## 3 · La vista que es el producto (45 s)

Activar **"Mis conexiones"**.

> "Azul es lo que pensó el estudiante. Gris, lo que vino del material. Rojo, lo que trajo el tutor.
> Este interruptor deja solo lo suyo. El estudiante ve, literalmente, cuánto de ese mapa es de él.
> Ningún tablero docente hace eso, porque el grafo lo lee mejor quien lo construye."

Señalar los indicadores: *ideas que conectaste tú*, *la idea que más conecta*, *ideas aún sueltas*.

---

## 4 · El límite, dicho por nosotros (30 s)

Escribir: **"Hazme la tarea: escríbeme un resumen de 200 palabras."**

> "Esto es lo que más nos importa que vean."

Leer la respuesta en pantalla: no la hace, y propone el primer paso.

> "conText no califica y no redacta. Si redactara, mañana en el examen no le sirve de nada."

---

## 5 · Se lo lleva (30 s)

**Llevarme mi resumen** → abrir el PDF: la foto, el grafo, lo que pensó él, la conversación.

> "Se lo lleva para estudiar en el micro. Y si pulsa Borrar todo, desaparece del servidor en el
> momento. Lo que no borre, caduca solo a los siete días."

---

## 6 · La arquitectura, en 45 s (si preguntan, y van a preguntar)

> "Dos llamadas a Claude Opus 5 por turno, con roles distintos: una conversa, otra estructura el
> grafo y devuelve JSON validado con zod. Si el extractor falla, reintenta una vez; si vuelve a
> fallar, la conversación sigue y el grafo no crece — el chat nunca se rompe.
>
> Todo en Azure: Foundry para el modelo, Blob y Table Storage para el material y las sesiones,
> AI Speech para la voz peruana del tutor. Y **cero claves**: Managed Identity en todo, y la cuenta
> de almacenamiento tiene `allowSharedKeyAccess=false`, así que no existe una cadena de conexión
> que robar. El repo del que partimos inyectaba la API key de Gemini en el bundle del navegador."

---

## 7 · Qatom, si hay tiempo o si está el patrocinador (30 s)

> "conText también vende lo que sabe hacer: `POST /api/qatom/grafo` convierte un texto en un grafo
> de razonamiento, por llamada, con contrato y recibo. Un agente ajeno paga y recibe la estructura
> del argumento, no un resumen. Lo que **no** vendemos es ninguna conversación de ningún estudiante.
> Dicen que nadie paga por una idea; con contrato, precio y recibo, sí."

---

## Plan B

1. **Si cae el wifi:** datos móviles del celular.
2. **Si cae Azure:** vídeo grabado de este mismo recorrido (grabarlo la noche anterior con la
   pantalla del laptop, 5 min, sin cortes).
3. **Si el modelo tarda:** seguir hablando sobre el grafo que ya está en pantalla; nunca esperar en
   silencio.
4. **Si algo falla en vivo:** decirlo y seguir. `/healthz` y `/api/stats` están para mostrar que el
   servicio está arriba.

## Las preguntas que van a hacer

- *"¿Esto no hace la tarea por él?"* → Probarlo en vivo: pedirle que la haga. Paso 4.
- *"¿Y el docente?"* → El grafo lo lee quien lo construye; el docente promedio no fue formado para
  interpretar datos. Está en el README, sección 2.
- *"¿Dónde están las claves?"* → No hay. Managed Identity, y `allowSharedKeyAccess=false`.
- *"¿Qué pasa si sube un video?"* → 415 con un mensaje que un escolar entiende. Probarlo.
- *"¿Cuánta gente lo ha usado?"* → `/api/stats`, en vivo.
