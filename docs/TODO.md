# TODO

Lo pendiente, con el porqué. Lo cerrado se borra de aquí y se cuenta en el README.

---

## Contexto: dos pruebas reales que llegaron desde fuera

En **MeasureCamp Mexico City 2026 (24 oct 2026)** aparecieron los dos primeros usuarios que no son
del equipo, y ninguno es el usuario de diseño:

1. **Un cliente potencial** que revisa **propuestas y planes de negocio**. Su problema: saber si el
   documento está bien escrito y si tiene algo atractivo. Va a probar conText; si le sirve, llama.
2. **Una estudiante** que va a invitar a varios amigos a usar conText para **desarrollar sus
   ensayos**.

conText no se diseñó para ninguna de las dos cosas: el Track 03 es estudiante de secundaria, y eso
no se mueve (ver la decisión del 18 oct sobre posicionamiento). Pero es la **puerta de entrada** a
los servicios de AIdeaText, y por eso se deja probar.

Lo que esto obliga: una prueba abierta sin tope no es una prueba, es un servicio gratis. Y gente de
fuera del aula sube documentos con nombres, montos y razones sociales dentro.

---

## 1. Límite de prueba — hecho (25 oct 2026)

**Qué hay hoy** — frena la ráfaga, no el uso prolongado:

| Límite | Dónde |
|---|---|
| 10 MB por archivo | `server/material.ts:10` (`MAX_BYTES`) |
| 1 MB de cuerpo JSON | `server/index.ts:54` |
| 30 turnos / 5 min por IP | `server/index.ts:56-62` |
| 20 archivos / 10 min por IP | `server/index.ts:189-190` |
| Caducidad a 7 días | `server/store.ts:155` |

Un plan de negocio de 40 páginas pasa sin problema, y una sesión puede durar indefinidamente
mientras se respete el ritmo por IP. Falta el tope de *cuánto*, no de *qué tan rápido*.

**Decidido (25 oct 2026):** se limita por **extensión + turnos totales**, no por tiempo de reloj.
conText existe para que alguien piense despacio; un cronómetro castiga exactamente la conducta que
el producto quiere provocar, y además es imposible de explicar sin sonar a demo mezquina. La
extensión y los turnos son honestos: se cuentan, se ven venir y se dicen de antemano.

**Hecho (25 oct 2026)** — los topes viven en [`shared/limites.ts`](../shared/limites.ts), que leen
el servidor y el navegador de la misma fuente:

- [x] **15.000 caracteres** de texto. Antes se recortaba en silencio a 60.000 y el estudiante creía
      que se había leído todo; ahora se rechaza y se dice cuántos traía.
- [x] **8 páginas** de PDF, contadas con `pdf-lib`. Si el PDF no se deja abrir no se bloquea: ya
      pasó por el tope de 10 MB y quien decide si lo entiende es el modelo.
- [x] **20 turnos** por sesión, comprobados en `/api/turn` **antes** de abrir el SSE, para que el
      error llegue como JSON y el cliente lo muestre tal cual.
- [x] Los tres se anuncian en pantalla antes de chocar: los de material bajo la caja de subida, el
      de turnos como aviso desde que quedan 5.
- [x] Suite: `npx tsx scripts/limites.mjs`.

**Lo que este tope no es.** Es por *sesión*, y empezar otra es gratis: basta con "Borrar todo", otro
navegador, o editar el `turns` del JSON que se lleva el usuario (`/api/session/retomar` lo acepta
tal cual). No se cerró ese hueco porque no hay nada que cerrar sin identificar a la gente, y eso
contradice la promesa de la portada. Contra el volumen real el freno sigue siendo el rate limit por
IP. El tope es una señal honesta, no una barrera.

## 2. Leyenda de uso seguro y anónimo — hecho (25 oct 2026)

Quien sube un plan de negocio no es un escolar con la foto de su cuaderno. Se dice antes de que
suba nada, no en letra chica.

- [x] **Antes de subir el material** (`src/components/MaterialPanel.tsx`): aviso sobre el área de
      carga — quitar nombres, montos, direcciones y razones sociales, y subir el texto en **.txt**.
- [x] **Qué pasa con lo que subes**, en el mismo aviso: nada queda en el servidor tras **Borrar
      todo**, y lo que no se borre caduca solo a los 7 días.
- [x] **Contacto** en el pie, junto al contador de uso (`src/App.tsx`):
      **first.contact@aideatext.ai**

El objetivo es que la experiencia sea **segura y anónima**, y que se note que lo es.

---

> Nota: el contador público (`/api/stats`) cuenta usuarios reales. Si se prueba contra
> https://context.aideatext.ai hay que borrar esas sesiones después.
