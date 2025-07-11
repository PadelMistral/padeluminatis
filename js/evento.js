import { db } from './firebase-config.js';
import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

// Obtener el id del evento de la URL
function getEventoIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

let filtroTipo = 'all';
let _evento = null;
let _partidos = [];

document.getElementById('tipo-filtro-evento').addEventListener('change', (e) => {
  filtroTipo = e.target.value;
  renderizarTodo();
});

function filtrarPartidosPorTipo(partidos, tipo) {
  if (tipo === 'all') return partidos;
  return partidos.filter(p => p.tipo === tipo || p.type === tipo);
}

function renderizarTodo() {
  if (!_evento || !_partidos.length) return;
  mostrarResumenEvento(_evento);
  mostrarEstadisticasEvento(_evento, filtrarPartidosPorTipo(_partidos, filtroTipo));
  mostrarClasificacionEvento(_evento, filtrarPartidosPorTipo(_partidos, filtroTipo));
  mostrarPartidosEvento(filtrarPartidosPorTipo(_partidos, filtroTipo));
  mostrarDatosPersonales(_evento, filtrarPartidosPorTipo(_partidos, filtroTipo));
}

async function cargarEvento() {
  const eventoId = getEventoIdFromUrl();
  if (!eventoId) {
    document.getElementById('evento-resumen').innerHTML = '<p>No se ha especificado ningún evento.</p>';
    return;
  }
  const eventoDoc = await getDoc(doc(db, 'eventos', eventoId));
  if (!eventoDoc.exists()) {
    document.getElementById('evento-resumen').innerHTML = '<p>Evento no encontrado.</p>';
    return;
  }
  _evento = eventoDoc.data();
  const partidos = await cargarPartidosEvento(eventoId);
  _partidos = partidos;
  renderizarTodo();
}

function mostrarResumenEvento(evento) {
  document.getElementById('evento-resumen').innerHTML = `
    <h2>${evento.name}</h2>
    <p><b>Tipo:</b> ${evento.type === 'league' ? 'Liga' : 'Torneo'}</p>
    <p><b>Formato:</b> ${evento.format}</p>
    <p><b>Fechas:</b> ${evento.startDate ? evento.startDate.split('T')[0] : ''} - ${evento.endDate ? evento.endDate.split('T')[0] : ''}</p>
    <p><b>Nivel permitido:</b> ${evento.minLevel} a ${evento.maxLevel}</p>
    <p><b>Estado:</b> ${evento.status === 'completed' ? 'Finalizado' : 'En curso'}</p>
    <p><b>Descripción:</b> ${evento.description || ''}</p>
  `;
}

async function cargarPartidosEvento(eventoId) {
  const calendarioSnap = await getDocs(collection(db, 'calendario'));
  let partidos = [];
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (partido.eventoId === eventoId) {
        partidos.push({ ...partido, id: partidoDoc.id, jornadaId: jornadaDoc.id });
      }
    }
  }
  return partidos;
}

function mostrarEstadisticasEvento(evento, partidos) {
  const jugados = partidos.filter(p => p.resultado).length;
  const pendientes = partidos.length - jugados;
  document.getElementById('evento-estadisticas').innerHTML = `
    <h3>Estadísticas</h3>
    <p><b>Participantes:</b> ${evento.participants ? evento.participants.length : 0}</p>
    <p><b>Partidos jugados:</b> ${jugados}</p>
    <p><b>Partidos pendientes:</b> ${pendientes}</p>
  `;
}

async function obtenerEquiposMap() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const map = {};
  equiposSnap.forEach(docu => {
    map[docu.id] = {
      id: docu.id,
      nombre: docu.data().nombre,
      puntos: 0,
      partidosJugados: 0,
      partidosGanados: 0,
      partidosPerdidos: 0,
      setsGanados: 0,
      setsPerdidos: 0,
      juegosGanados: 0,
      juegosPerdidos: 0
    };
  });
  return map;
}

function calcularClasificacionEvento(equiposMap, partidos) {
  for (const partido of partidos) {
    if (!partido.resultado) continue;
    const local = equiposMap[partido.equipoLocal];
    const visitante = equiposMap[partido.equipoVisitante];
    if (!local || !visitante) continue;
    local.partidosJugados++;
    visitante.partidosJugados++;
    let setsLocal = 0, setsVisitante = 0;
    let juegosLocal = 0, juegosVisitante = 0;
    Object.values(partido.resultado)
      .filter(set => set && typeof set.puntos1 === 'number' && typeof set.puntos2 === 'number')
      .filter(set => !(set.puntos1 === 0 && set.puntos2 === 0))
      .forEach(set => {
        if (set.puntos1 > set.puntos2) setsLocal++;
        else if (set.puntos2 > set.puntos1) setsVisitante++;
        juegosLocal += set.puntos1 || 0;
        juegosVisitante += set.puntos2 || 0;
      });
    local.setsGanados += setsLocal;
    local.setsPerdidos += setsVisitante;
    local.juegosGanados += juegosLocal;
    local.juegosPerdidos += juegosVisitante;
    visitante.setsGanados += setsVisitante;
    visitante.setsPerdidos += setsLocal;
    visitante.juegosGanados += juegosVisitante;
    visitante.juegosPerdidos += juegosLocal;
    if (setsLocal > setsVisitante) {
      local.puntos += 2;
      local.partidosGanados++;
      visitante.puntos += 1;
      visitante.partidosPerdidos++;
    } else if (setsVisitante > setsLocal) {
      visitante.puntos += 2;
      visitante.partidosGanados++;
      local.puntos += 1;
      local.partidosPerdidos++;
    } else {
      local.puntos += 1;
      visitante.puntos += 1;
    }
  }
  return Object.values(equiposMap).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    const diffSetsA = a.setsGanados - a.setsPerdidos;
    const diffSetsB = b.setsGanados - b.setsPerdidos;
    if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
    const diffJuegosA = a.juegosGanados - a.juegosPerdidos;
    const diffJuegosB = b.juegosGanados - b.juegosPerdidos;
    return diffJuegosB - diffJuegosA;
  });
}

async function mostrarClasificacionEvento(evento, partidos) {
  const equiposMap = await obtenerEquiposMap();
  const clasificacion = calcularClasificacionEvento(equiposMap, partidos);
  const tabla = `
    <table class="tabla-clasificacion">
      <thead>
        <tr>
          <th>Pos</th>
          <th>Equipo</th>
          <th>PJ</th>
          <th>PG / PP</th>
          <th>Dif.</th>
          <th style="text-align: center;">Puntos</th>
        </tr>
      </thead>
      <tbody>
        ${clasificacion.map((eq, i) => `
          <tr>
            <td style="text-align: center; font-weight: 600; color: #e5e5e5;">${i + 1}</td>
            <td>${eq.nombre}</td>
            <td style="text-align: center; color: #e5e5e5;">${eq.partidosJugados}</td>
            <td style="text-align: center;"><span style="color: #4CAF50; font-weight: bold;">${eq.partidosGanados}</span> / <span style="color: #f44336; font-weight: bold;">${eq.partidosPerdidos}</span></td>
            <td style="${(eq.juegosGanados - eq.juegosPerdidos) >= 0 ? 'color: #4CAF50;' : 'color: #f44336;'} text-align: center; font-weight: 600;">${(eq.juegosGanados - eq.juegosPerdidos) >= 0 ? '+' : ''}${eq.juegosGanados - eq.juegosPerdidos}</td>
            <td><span class="col-puntos" style="font-weight: 700; font-size: 1.1em;">${eq.puntos}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('evento-clasificacion').innerHTML = `<h3>Clasificación</h3>${tabla}`;
}

function mostrarPartidosEvento(partidos) {
  document.getElementById('evento-partidos').innerHTML = `
    <h3>Partidos</h3>
    <ul>
      ${partidos.map(p => `<li>${p.equipoLocal} vs ${p.equipoVisitante} (${p.resultado ? 'Jugado' : 'Pendiente'})</li>`).join('')}
    </ul>
  `;
}

function mostrarDatosPersonales(evento, partidos) {
  // Aquí se puede mostrar el rendimiento del usuario, compañero, victorias, etc.
  document.getElementById('evento-personal').innerHTML = `
    <h3>Tu rendimiento</h3>
    <div>(Próximamente: victorias, partidos jugados, compañero, etc.)</div>
  `;
}

cargarEvento(); 