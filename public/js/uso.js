// Panel privado de uso: pide /api/uso con el token y pinta la tabla por día.
const COLS = [
  ['inicios', 'Visitas'], ['conversaron', 'Conversaron'], ['turnos', 'Turnos'], ['nodos', 'Ideas'],
  ['materiales', 'Materiales'], ['xml', 'XML'], ['png', 'PNG'], ['pdf', 'PDF'],
  ['retomas', 'Retomas'], ['borrados', 'Borrados'], ['topes', 'Topes'],
];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tabla(el, primera, filas) {
  const cab = `<thead><tr><th>${primera}</th>${COLS.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead>`;
  const cuerpo = filas.map(([k, c]) =>
    `<tr><td>${esc(k)}</td>${COLS.map(([n]) => `<td>${c[n] ?? 0}</td>`).join('')}</tr>`).join('');
  el.innerHTML = cab + `<tbody>${cuerpo || `<tr><td colspan="${COLS.length + 1}">Sin datos todavía</td></tr>`}</tbody>`;
}

async function cargar(token) {
  $('estado').textContent = 'Cargando…';
  const r = await fetch('/api/uso', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) {
    $('estado').textContent = 'Token incorrecto (o USO_TOKEN no está configurado en Render).';
    sessionStorage.removeItem('usoToken');
    return;
  }
  const d = await r.json();
  sessionStorage.setItem('usoToken', token);
  $('estado').textContent = `Datos desde ${d.desde ? d.desde.slice(0, 10) : '—'} · almacenamiento: ${d.persistencia}`;
  const t = d.total;
  $('totales').innerHTML = [['XML descargados', t.xml], ['PDF descargados', t.pdf], ['PNG descargados', t.png],
    ['Retomas', t.retomas], ['Conversaron', t.conversaron], ['Turnos', t.turnos], ['Ideas', t.nodos]]
    .map(([n, v]) => `<div class="tarjeta"><b>${v ?? 0}</b><span>${n}</span></div>`).join('');
  tabla($('dias'), 'Día', Object.entries(d.porDia).sort((a, b) => b[0].localeCompare(a[0])));
  tabla($('refs'), 'Campaña', Object.entries(d.porRef).sort((a, b) => (b[1].inicios ?? 0) - (a[1].inicios ?? 0)));
  $('resultado').hidden = false;
}

$('acceso').addEventListener('submit', (e) => { e.preventDefault(); cargar($('token').value.trim()); });
const guardado = sessionStorage.getItem('usoToken');
if (guardado) cargar(guardado);
