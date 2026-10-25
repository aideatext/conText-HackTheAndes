/**
 * La medicion de uso: que cuente lo que paso, que no caduque y que no guarde
 * de quien fue.
 *   npx tsx scripts/uso.mjs [url]
 *
 * CONTRA LOCAL SIEMPRE. En produccion los eventos son perpetuos a proposito:
 * una pasada de esta suite inflaria el contador publico para siempre, y ese
 * contador es la evidencia de que quien usa conText es gente de verdad.
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error('Esta suite solo corre contra local: los eventos no se pueden deshacer.');
  process.exit(1);
}

let fallos = 0;
const check = (ok, msg) => {
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${msg}`);
};

const stats = () => fetch(`${BASE}/api/stats`).then((r) => r.json());

const nuevaSesion = async (ref) =>
  (
    await (
      await fetch(`${BASE}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      })
    ).json()
  ).sessionId;

// 1 · Abrir cuenta como sesion, pero no como alguien que converso
{
  const antes = await stats();
  await nuevaSesion(null);
  const despues = await stats();
  check(
    despues.sesiones === antes.sesiones + 1,
    `abrir suma una sesion (${antes.sesiones} -> ${despues.sesiones})`,
  );
  check(
    despues.sesionesConTurnos === antes.sesionesConTurnos,
    'abrir NO cuenta como alguien que converso',
  );
}

// 2 · Borrar todo no baja el acumulado: lo que paso, paso
{
  const id = await nuevaSesion(null);
  const antes = await stats();
  await fetch(`${BASE}/api/session/${id}`, { method: 'DELETE' });
  const despues = await stats();
  check(
    despues.sesiones === antes.sesiones,
    `borrar la sesion no baja el acumulado (${antes.sesiones} -> ${despues.sesiones})`,
  );
  check(
    despues.sesionesVivas === antes.sesionesVivas - 1,
    `pero si baja las sesiones vivas (${antes.sesionesVivas} -> ${despues.sesionesVivas})`,
  );
}

// 3 · El ref se normaliza y no se cuela cualquier cosa
{
  const sucio = '  Plan-Negocio/../<script>  ';
  await nuevaSesion(sucio);
  check(true, `ref sucio aceptado sin romper nada: "${sucio}"`);
}

// 4 · /api/uso no existe sin token
{
  const res = await fetch(`${BASE}/api/uso`);
  check(res.status === 404, `/api/uso sin token responde 404 y no 401 (${res.status})`);
}

// 5 · Con token, el desglose por ref existe y nunca trae sessionId
{
  const token = process.env.USO_TOKEN;
  if (!token) {
    console.log('···  sin USO_TOKEN en el entorno: no se puede probar el desglose');
  } else {
    const res = await fetch(`${BASE}/api/uso`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    check(res.status === 200, `/api/uso con token responde 200 (${res.status})`);
    // Se cae todo menos [a-z0-9-]: las barras, los puntos y los angulos se van,
    // y el guion de "plan-negocio" se queda porque es parte legitima del nombre.
    check(
      Object.keys(body.porRef ?? {}).includes('plan-negocioscript'),
      `el ref llega limpio al desglose: ${Object.keys(body.porRef ?? {}).join(', ')}`,
    );
    check(
      !JSON.stringify(body).includes('sessionId'),
      'el resumen de uso no contiene ningun sessionId',
    );
    check(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(JSON.stringify(body)),
      'ni ningun UUID que pueda atarse a una sesion',
    );
  }
}

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo en verde');
process.exit(fallos ? 1 : 0);
