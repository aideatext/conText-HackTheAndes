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

## 1. Límite de prueba

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

**Qué falta decidir y aplicar:**

- [ ] **Tope de extensión del material.** Un máximo de caracteres del texto extraído, por encima de
      los 10 MB de archivo. Afecta a `server/material.ts` y al PDF nativo.
- [ ] **Tope de sesión.** Por turnos totales o por minutos desde el primer turno. Vive en
      `server/store.ts` (la sesión ya se persiste) y se comprueba en `/api/turn`.
- [ ] **Mensaje al alcanzarlo**, en español y sin jerga, con la invitación a escribir a
      **first.contact@aideatext.ai**. Mismo tono que los errores de Foundry ya traducidos en
      `server/claude.ts`.

**Decidido (25 oct 2026):** se limita por **extensión + turnos totales**, no por tiempo de reloj.
conText existe para que alguien piense despacio; un cronómetro castiga exactamente la conducta que
el producto quiere provocar, y además es imposible de explicar sin sonar a demo mezquina. La
extensión y los turnos son honestos: se cuentan, se ven venir y se dicen de antemano.

Números de partida, a confirmar al implementar: **~15.000 caracteres** de texto extraído por
material (unas 8 páginas) y **20 turnos** por sesión.

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
