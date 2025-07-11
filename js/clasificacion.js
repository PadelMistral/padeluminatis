import { db } from './firebase-config.js';
import { 
  collection, doc, getDocs, onSnapshot, 
  writeBatch, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const tablaClasificacion = document.getElementById("tabla-clasificacion");

// MODAL para mostrar últimos partidos
let modal, modalContent, partidosEquipo = [], partidoIndex = 0;

function crearModal() {
  if (document.getElementById('modal-partidos')) return;
  modal = document.createElement('div');
  modal.id = 'modal-partidos';
  modal.className = '';
  modal.style = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2000;display:flex;align-items:center;justify-content:center;`;
  modal.innerHTML = `<div id="modal-content" style="background:#23262e;padding:2.2rem 1.5rem 1.5rem 1.5rem;border-radius:18px;min-width:320px;max-width:95vw;min-height:180px;max-height:80vh;box-shadow:0 8px 40px #000a;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;">
    <button id="cerrar-modal" style="position:absolute;top:0.7rem;right:1.2rem;background:none;border:none;font-size:1.7rem;color:#bfa13a;cursor:pointer;">&times;</button>
    <div id="modal-body"></div>
    <div style="display:flex;align-items:center;gap:1.5rem;margin-top:1.2rem;">
      <button id="prev-partido" style="background:none;border:none;font-size:2rem;color:#bfa13a;cursor:pointer;">&#8592;</button>
      <span id="contador-modal" style="color:#bfa13a;font-weight:600;font-size:1.1rem;"></span>
      <button id="next-partido" style="background:none;border:none;font-size:2rem;color:#bfa13a;cursor:pointer;">&#8594;</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>modal.classList.add('abierto'), 10);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
  document.getElementById('cerrar-modal').onclick = cerrarModal;
  document.getElementById('prev-partido').onclick = () => mostrarPartido(partidoIndex-1);
  document.getElementById('next-partido').onclick = () => mostrarPartido(partidoIndex+1);
}

function cerrarModal() {
  if (modal) {
    modal.classList.remove('abierto');
    modal.classList.add('cerrando');
    setTimeout(()=>{ if(modal) modal.remove(); }, 350);
  }
  partidosEquipo = [];
  partidoIndex = 0;
}

function mostrarPartido(idx) {
  if (!partidosEquipo.length) return;
  partidoIndex = (idx+partidosEquipo.length)%partidosEquipo.length;
  const p = partidosEquipo[partidoIndex];
  const body = document.getElementById('modal-body');
  if (!body) return;

  // Formatear fecha
  let fechaStr = p.fecha;
  if (fechaStr && typeof fechaStr === 'object' && fechaStr.toDate) {
    fechaStr = p.fecha.toDate().toLocaleString('es-ES');
  } else if (fechaStr && typeof fechaStr === 'string' && fechaStr.length > 8) {
    try { fechaStr = new Date(fechaStr).toLocaleString('es-ES'); } catch(e) {}
  }

  // Procesar sets y ganador
  let setsHTML = '', marcadorSets = '', marcadorPuntos = '', ganador = '', colorGanador = '', totalP1 = 0, totalP2 = 0, setsP1 = 0, setsP2 = 0;
  if (p.resultado && typeof p.resultado === 'object') {
    const set1 = p.resultado.set1 || { puntos1: 0, puntos2: 0 };
    const set2 = p.resultado.set2 || { puntos1: 0, puntos2: 0 };
    const set3 = p.resultado.set3 || { puntos1: 0, puntos2: 0 };
    let mostrarSet3 = true;
    // Determinar si hay ganador tras dos sets
    if (((set1.puntos1 > set1.puntos2 && set2.puntos1 > set2.puntos2) ||
         (set1.puntos2 > set1.puntos1 && set2.puntos2 > set2.puntos1)) &&
        set3.puntos1 === 0 && set3.puntos2 === 0) {
      mostrarSet3 = false;
    }
    const sets = mostrarSet3 ? [set1, set2, set3] : [set1, set2];
    setsHTML = sets.map((s, i) => {
      totalP1 += s.puntos1;
      totalP2 += s.puntos2;
      if (s.puntos1 > s.puntos2) setsP1++;
      else if (s.puntos2 > s.puntos1) setsP2++;
      return `<div style="margin-bottom:2px; font-size:1.05em; letter-spacing:0.5px;">Set ${i+1}: <b style='color:#bfa13a;'>${s.puntos1}</b> - <b style='color:#bfa13a;'>${s.puntos2}</b></div>`;
    }).join('');
    marcadorSets = `<div class="marcador-sets" style="font-size:1.13em;margin:0.5em 0 0.2em 0;"><b>Marcador sets:</b> <span style="color:#bfa13a;">${setsP1} - ${setsP2}</span></div>`;
    marcadorPuntos = `<div class="marcador-puntos" style="font-size:1.08em;margin-bottom:0.5em;"><b>Puntos totales:</b> <span style="color:#7fa6c7;">${totalP1} - ${totalP2}</span></div>`;
    if (setsP1 > setsP2) { ganador = p.equipoLocal; colorGanador = '#bfa13a'; }
    else if (setsP2 > setsP1) { ganador = p.equipoVisitante; colorGanador = '#bfa13a'; }
    else { ganador = 'Empate'; colorGanador = '#7fa6c7'; }
  }

  // Distinguir equipo seleccionado y rival
  let equipoSeleccionado = window.__equipoSeleccionado || null;
  if (!equipoSeleccionado && window.__ultimoEquipoId) equipoSeleccionado = window.__ultimoEquipoId;
  if (!equipoSeleccionado) equipoSeleccionado = p.equipoLocal;

  // Determinar cuál es el equipo seleccionado y el rival
  let nombreLocal = p.equipoLocal;
  let nombreVisitante = p.equipoVisitante;
  let colorLocal = '#bfa13a';
  let colorVisitante = '#7fa6c7';
  let esLocalSeleccionado = false;
  if (equipoSeleccionado === p.equipoLocal) {
    esLocalSeleccionado = true;
  } else if (equipoSeleccionado === p.equipoVisitante) {
    [colorLocal, colorVisitante] = [colorVisitante, colorLocal];
    esLocalSeleccionado = false;
  }

  // Estructura horizontal equipos y puntos
  let equiposLinea = `
    <div class="modal-equipos-linea">
      <div class="modal-equipo-nombre" style="color:${colorLocal}">${nombreLocal}</div>
      <div class="modal-puntos" style="color:${colorLocal}">${totalP1}</div>
      <div class="modal-vs">vs</div>
      <div class="modal-puntos" style="color:${colorVisitante}">${totalP2}</div>
      <div class="modal-equipo-nombre" style="color:${colorVisitante}">${nombreVisitante}</div>
    </div>
  `;

  // Jornada visual
  let jornadaLabel = '';
  if (partidosEquipo.length > 0) {
    if (partidoIndex === 0) {
      jornadaLabel = '<span style="color:#bfa13a;font-weight:700;font-size:1.05em;">Último partido</span>';
    } else if (partidoIndex === 1) {
      jornadaLabel = '<span style="color:#7fa6c7;font-weight:700;font-size:1.05em;">Penúltimo partido</span>';
    } else {
      jornadaLabel = `<span style="color:#bfa13a;font-size:1.01em;font-weight:600;">Jornada ${partidosEquipo.length - partidoIndex}</span>`;
    }
  }

  // Ganador visual elegante
  let ganadorHTML = '';
  if (ganador === 'Empate') {
    ganadorHTML = `<div class="ganador-modal empate"><span>Partido empatado</span></div>`;
  } else {
    ganadorHTML = `<div class="ganador-modal"><i class="fas fa-trophy"></i> <span>Ganador: ${ganador}</span></div>`;
  }

  body.innerHTML = `
    <div style="text-align:center;margin-bottom:1rem;">
      ${jornadaLabel}
      <div style="font-size:0.9em;color:#7fa6c7;margin-top:0.3em;">${fechaStr}</div>
    </div>
    ${equiposLinea}
    ${setsHTML}
    ${marcadorSets}
    ${marcadorPuntos}
    ${ganadorHTML}
  `;

  document.getElementById('contador-modal').textContent = `${partidoIndex + 1}/${partidosEquipo.length}`;
}

// Modifica cargarPartidosEquipo para guardar el equipo seleccionado
async function cargarPartidosEquipo(equipoId) {
  window.__equipoSeleccionado = null;
  window.__ultimoEquipoId = equipoId;
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const equiposMap = {};
  equiposSnap.forEach(docu => {
    equiposMap[docu.id] = docu.data().nombre;
  });
  const calendarioSnap = await getDocs(collection(db, "calendario"));
  let partidos = [];
  let jornadas = [];
  let jornadaNum = 0;
  for (const jornadaDoc of calendarioSnap.docs) {
    jornadaNum++;
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;
      if (eventoSeleccionado && partido.eventoId !== eventoSeleccionado) continue;
      if (partido.equipoLocal === equipoId || partido.equipoVisitante === equipoId) {
        partidos.push({
          fecha: partido.fecha || '',
          equipoLocal: equiposMap[partido.equipoLocal] || 'Equipo Local',
          equipoVisitante: equiposMap[partido.equipoVisitante] || 'Equipo Visitante',
          resultado: partido.resultado,
          jornada: jornadaNum
        });
      }
    }
  }
  partidos = partidos.sort((a, b) => {
    const fechaA = a.fecha && a.fecha.toDate ? a.fecha.toDate().toISOString() : (a.fecha instanceof Date ? a.fecha.toISOString() : (typeof a.fecha === 'string' ? a.fecha : ''));
    const fechaB = b.fecha && b.fecha.toDate ? b.fecha.toDate().toISOString() : (b.fecha instanceof Date ? b.fecha.toISOString() : (typeof b.fecha === 'string' ? b.fecha : ''));
    return fechaB.localeCompare(fechaA);
  });
  partidosEquipo = partidos.slice(0,9);
  partidoIndex = 0;
  crearModal();
  mostrarPartido(0);
}

// 1. Obtener mapa de equipos con inicialización de campos (añadimos PG y PP)
async function obtenerEquiposMap() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const map = {};
  equiposSnap.forEach(docu => {
    map[docu.id] = {
      id: docu.id,
      nombre: docu.data().nombre,
      puntos: 0,
      partidosJugados: 0,
      partidosGanados: 0,  // Nuevo campo
      partidosPerdidos: 0, // Nuevo campo
      setsGanados: 0,
      setsPerdidos: 0,
      juegosGanados: 0,
      juegosPerdidos: 0
    };
  });
  return map;
}

// 2. Calcular clasificación (añadimos conteo de PG y PP)
async function calcularClasificacion(equiposMap) {
  const calendarioSnap = await getDocs(collection(db, "calendario"));
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;
      if (eventoSeleccionado && partido.eventoId !== eventoSeleccionado) continue;
      const local = equiposMap[partido.equipoLocal];
      const visitante = equiposMap[partido.equipoVisitante];
      if (!local || !visitante) {
        console.warn("Equipo local o visitante no encontrado", partido.equipoLocal, partido.equipoVisitante);
        continue;
      }
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

// 3. Guardar clasificación en Firestore (añadimos PG y PP)
async function guardarClasificacion(clasificacion) {
  const batch = writeBatch(db);
  const clasificacionRef = collection(db, "clasificacion");

  // Eliminar anteriores
  const snapshot = await getDocs(clasificacionRef);
  snapshot.forEach(doc => batch.delete(doc.ref));

  // Agregar nueva clasificación
  clasificacion.forEach((equipo, index) => {
    const docRef = doc(clasificacionRef, equipo.id);
    batch.set(docRef, {
      posicion: index + 1,
      nombre: equipo.nombre,
      partidosJugados: equipo.partidosJugados,
      partidosGanados: equipo.partidosGanados,  // Nuevo campo
      partidosPerdidos: equipo.partidosPerdidos, // Nuevo campo
      puntos: equipo.puntos,
      setsGanados: equipo.setsGanados,
      setsPerdidos: equipo.setsPerdidos,
      juegosGanados: equipo.juegosGanados,
      juegosPerdidos: equipo.juegosPerdidos,
      ultimaActualizacion: serverTimestamp()
    });
  });

  await batch.commit();
}

// 4. Mostrar la clasificación en la tabla HTML (versión simplificada sin animaciones en cascada)
function mostrarClasificacion(clasificacion) {
  const tbody = tablaClasificacion.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = clasificacion.map((eq, rowIndex) => {
    let borde = '';
    let clases = 'fila-equipo';
    if (rowIndex < 4) {
      clases += ' top-4';
      borde = '<span class="borde-posicion"></span>';
    }
    if (rowIndex === clasificacion.length - 2) {
      clases += ' descenso penultimo';
      borde = '<span class="borde-posicion"></span>';
    }
    if (rowIndex === clasificacion.length - 1) {
      clases += ' descenso ultimo';
      borde = '<span class="borde-posicion"></span>';
    }
    return `
      <tr class="${clases}">
        <td style="text-align: center; font-weight: 600; color: #e5e5e5;">${rowIndex + 1}</td>
        <td data-equipo-id="${eq.id}" style="padding:0; border:none; background:none;">
          <div class="equipo-nombre-div${rowIndex < 4 ? ' top-4-div top-4-div-' + (rowIndex+1) : ''}${rowIndex === clasificacion.length-2 ? ' descenso-div penultimo-div' : ''}${rowIndex === clasificacion.length-1 ? ' descenso-div ultimo-div' : ''}">${borde}${eq.nombre}</div>
        </td>
        <td style="text-align: center; color: #e5e5e5;">${eq.partidosJugados}</td>
        <td style="text-align: center;">
          <span style="color: #4CAF50; font-weight: bold;">${eq.partidosGanados}</span> /
          <span style="color: #f44336; font-weight: bold;">${eq.partidosPerdidos}</span>
        </td>
        <td style="${(eq.juegosGanados - eq.juegosPerdidos) >= 0 ? 'color: #4CAF50;' : 'color: #f44336;'} text-align: center; font-weight: 600;">
          ${(eq.juegosGanados - eq.juegosPerdidos) >= 0 ? '+' : ''}${eq.juegosGanados - eq.juegosPerdidos}
        </td>
        <td><span class="col-puntos" style="font-weight: 700; font-size: 1.1em;">${eq.puntos}</span></td>
      </tr>
    `;
  }).join('');
}

// Delegación de eventos para el click en el nombre del equipo
setTimeout(() => {
  const tbody = tablaClasificacion.querySelector('tbody');
  if (tbody) {
    tbody.addEventListener('click', function(e) {
      let target = e.target;
      while (target && target.nodeName !== 'TD') target = target.parentElement;
      if (target && target.hasAttribute('data-equipo-id')) {
        const equipoId = target.getAttribute('data-equipo-id');
        cargarPartidosEquipo(equipoId);
      }
    });
  }
}, 0);

// 5. Inicializar escuchas y lógica general
async function iniciar() {
  // Escuchar cambios en "calendario"
  onSnapshot(collection(db, "calendario"), async () => {
    const equiposMap = await obtenerEquiposMap();
    const clasificacion = await calcularClasificacion(equiposMap);
    await guardarClasificacion(clasificacion);
  });

  // Escuchar cambios en "clasificacion"
  onSnapshot(collection(db, "clasificacion"), (snapshot) => {
    const clasificacion = [];
    snapshot.forEach(doc => clasificacion.push({ ...doc.data(), id: doc.id }));
    mostrarClasificacion(clasificacion.sort((a, b) => a.posicion - b.posicion));
  });
}

iniciar();

window.cargarPartidosEquipo = cargarPartidosEquipo;

// 1. Obtener usuario actual y eventos en los que participa
async function cargarEventosUsuario() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return [];
  const eventosSnap = await getDocs(collection(db, 'eventos'));
  // Solo eventos donde el usuario está en participantes
  return eventosSnap.docs
    .filter(doc => (doc.data().participants || []).some(p => p.id === user.uid))
    .map(doc => ({ id: doc.id, nombre: doc.data().name }));
}

async function rellenarSelectEventos() {
  const select = document.getElementById('select-evento');
  select.innerHTML = '<option value="">Selecciona un evento</option>';
  const eventos = await cargarEventosUsuario();
  eventos.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = ev.nombre;
    select.appendChild(opt);
  });
}

// 2. Filtrar clasificación y partidos por evento seleccionado
let eventoSeleccionado = null;
document.addEventListener('DOMContentLoaded', async () => {
  await rellenarSelectEventos();
  document.getElementById('select-evento').addEventListener('change', async (e) => {
    eventoSeleccionado = e.target.value;
    if (eventoSeleccionado) {
      // Aquí deberás adaptar la lógica de cargarPartidosEquipo y calcularClasificacion
      // para que solo usen los partidos del evento seleccionado
      // Por ahora, puedes mostrar un mensaje de prueba:
      alert('Evento seleccionado: ' + e.target.options[e.target.selectedIndex].text);
      // TODO: Filtrar partidos y clasificación por eventoSeleccionado
    }
  });
});

// Al cambiar el select de evento, actualizar la clasificación
const selectEvento = document.getElementById('select-evento');
if (selectEvento) {
  selectEvento.addEventListener('change', async (e) => {
    eventoSeleccionado = e.target.value;
    const equiposMap = await obtenerEquiposMap();
    const clasificacion = await calcularClasificacion(equiposMap);
    mostrarClasificacion(clasificacion);
  });
}

// --- INICIO LÓGICA AVANZADA DE PUNTUACIÓN Y MODAL ---

// 1. Lógica avanzada de cálculo de puntos y desglose
function calcularPuntosAvanzado({nivel, puntosRanking, rivalNivel, rivalPuntos, companeroNivel, companeroPuntos, tipo, margen, resultado, racha, experiencia, localia, inactividad, rivalidad}) {
    // Fórmula base: 500 + (nivel * 10 * 2)
    let base = 500 + (nivel * 10 * 2);
    let dificultadRival = (rivalPuntos - puntosRanking) / 100;
    let dificultadCompanero = (companeroPuntos - puntosRanking) / 200;
    let factorTipo = tipo === 'liga' ? 1 : tipo === 'reto' ? 1.2 : tipo === 'amistoso' ? 0.8 : 1;
    let factorMargen = margen >= 2 ? 1.2 : margen === 1 ? 1.0 : 0.8;
    let factorResultado = resultado === 'victoria' ? 1 : -1;
    let factorRacha = racha >= 3 ? 1.1 : racha <= -2 ? 0.9 : 1;
    let factorExperiencia = experiencia > 20 ? 1.05 : 1;
    let factorLocalia = localia ? 1.03 : 1;
    let factorInactividad = inactividad > 30 ? 0.95 : 1;
    let factorRivalidad = rivalidad ? 1.07 : 1;
    let puntos = base * (1 + dificultadRival + dificultadCompanero) * factorTipo * factorMargen * factorResultado * factorRacha * factorExperiencia * factorLocalia * factorInactividad * factorRivalidad;
    let puntosFinal = Math.round(puntos / 100);
    let desglose = [
        {nombre:'Base', valor:base},
        {nombre:'Dificultad rival', valor:dificultadRival.toFixed(2)},
        {nombre:'Dificultad compañero', valor:dificultadCompanero.toFixed(2)},
        {nombre:'Tipo partido', valor:factorTipo},
        {nombre:'Margen', valor:factorMargen},
        {nombre:'Resultado', valor:factorResultado},
        {nombre:'Racha', valor:factorRacha},
        {nombre:'Experiencia', valor:factorExperiencia},
        {nombre:'Localía', valor:factorLocalia},
        {nombre:'Inactividad', valor:factorInactividad},
        {nombre:'Rivalidad', valor:factorRivalidad},
        {nombre:'Total', valor:puntosFinal}
    ];
    return {puntos:puntosFinal, desglose};
}

// 2. Procesar partidos y construir historial avanzado para cada jugador/equipo
// (Esta función debe llamarse tras cargar todos los datos de usuarios, equipos y partidos)
// ... (Aquí iría la lógica de procesamiento, integración y guardado del historial en cada objeto de jugador/equipo)
//
// 3. Al mostrar la tabla, añadir flechas y puntos verdes/rojos solo para los jugadores/equipos del último partido
//
// 4. Al hacer clic en un jugador/equipo, mostrar el modal avanzado con historial y desglose
//
// --- FIN LÓGICA AVANZADA DE PUNTUACIÓN Y MODAL ---

// --- INICIO LÓGICA AVANZADA COMPLETA ---

// 2. Procesar partidos y construir historial avanzado para cada jugador/equipo
async function procesarHistorialAvanzado() {
    // Cargar usuarios, equipos y partidos
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    const equiposSnap = await getDocs(collection(db, 'equipos'));
    const calendarioSnap = await getDocs(collection(db, 'calendario'));
    let usuarios = {};
    usuariosSnap.forEach(doc => {
        const data = doc.data();
        usuarios[doc.id] = {
            id: doc.id,
            nombre: data.nombreUsuario || data.email,
            nivel: parseFloat(data.nivel) || 2.0,
            puntosRanking: 500 + ((parseFloat(data.nivel) || 2.0) * 10 * 2),
            puntosNivel: 0,
            partidos: 0,
            victorias: 0,
            history: []
        };
    });
    let equipos = {};
    equiposSnap.forEach(doc => {
        equipos[doc.id] = doc.data().jugadores;
    });
    let partidos = [];
    for (const jornadaDoc of calendarioSnap.docs) {
        const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
        for (const partidoDoc of partidosSnap.docs) {
            const partido = partidoDoc.data();
            if (!partido.resultado) continue;
            partidos.push({ ...partido, id: partidoDoc.id });
        }
    }
    // Ordenar partidos por fecha si existe
    partidos = partidos.sort((a, b) => {
        const fa = a.fecha?.toDate ? a.fecha.toDate() : (a.fecha instanceof Date ? a.fecha : new Date(a.fecha));
        const fb = b.fecha?.toDate ? b.fecha.toDate() : (b.fecha instanceof Date ? b.fecha : new Date(b.fecha));
        return fa - fb;
    });
    // Procesar partidos y actualizar historial de cada usuario
    for (const partido of partidos) {
        const equipo1 = partido.equipoLocal;
        const equipo2 = partido.equipoVisitante;
        const jugadores1 = equipos[equipo1] || [];
        const jugadores2 = equipos[equipo2] || [];
        let sets1 = 0, sets2 = 0;
        Object.values(partido.resultado).forEach(set => {
            if ((set.puntos1 || 0) > (set.puntos2 || 0)) sets1++;
            else if ((set.puntos2 || 0) > (set.puntos1 || 0)) sets2++;
        });
        const ganadores = sets1 > sets2 ? jugadores1 : jugadores2;
        const perdedores = sets1 > sets2 ? jugadores2 : jugadores1;
        const tipo = partido.tipo || 'liga';
        // Calcular margen de victoria/derrota
        const margen = Math.abs(sets1 - sets2);
        // Procesar cada jugador
        for (const jugador of [...ganadores, ...perdedores]) {
            const user = usuarios[jugador];
            if (!user) continue;
            const companero = (ganadores.includes(jugador) ? ganadores : perdedores).find(j => j !== jugador);
            const rivales = (ganadores.includes(jugador) ? perdedores : ganadores);
            const rivalNiveles = rivales.map(r => usuarios[r]?.nivel || 2.0);
            const rivalPuntos = rivales.map(r => usuarios[r]?.puntosRanking || 500).reduce((a,b)=>a+b,0)/rivales.length;
            const companeroNivel = usuarios[companero]?.nivel || 2.0;
            const companeroPuntos = usuarios[companero]?.puntosRanking || 500;
            const resultado = ganadores.includes(jugador) ? 'victoria' : 'derrota';
            // Factores extra (puedes expandir según reglas)
            const racha = user.history.length > 0 ? (user.history[user.history.length-1].resultado === 'victoria' ? (user.history[user.history.length-1].racha || 0) + 1 : (user.history[user.history.length-1].racha || 0) - 1) : 0;
            const experiencia = user.history.length;
            const localia = equipo1 === partido.equipoLocal;
            const inactividad = 0; // Puedes calcular días desde el último partido
            const rivalidad = false; // Puedes marcar si hay rivalidad especial
            // Calcular puntos y desglose
            const { puntos, desglose } = calcularPuntosAvanzado({
                nivel: user.nivel,
                puntosRanking: user.puntosRanking,
                rivalNivel: rivalNiveles[0],
                rivalPuntos: rivalPuntos,
                companeroNivel: companeroNivel,
                companeroPuntos: companeroPuntos,
                tipo,
                margen,
                resultado,
                racha,
                experiencia,
                localia,
                inactividad,
                rivalidad
            });
            const puntosAntes = user.puntosRanking;
            user.puntosRanking += puntos;
            user.nivel = Math.max(1, user.nivel + (puntos > 0 ? 0.05 : -0.05));
            user.partidos++;
            if (resultado === 'victoria') user.victorias++;
            user.history.push({
                partidoId: partido.id,
                fecha: partido.fecha,
                rival: rivales.map(r => usuarios[r]?.nombre || 'Desconocido'),
                companero: usuarios[companero]?.nombre || 'Desconocido',
                resultado,
                puntosRankingAntes: puntosAntes,
                puntosRankingDespues: user.puntosRanking,
                nivel: user.nivel,
                desglose,
                racha,
                experiencia,
                margen
            });
        }
    }
    // Guardar historial avanzado global para uso en la tabla y modal
    window.__usuariosAvanzado = usuarios;
}

// Llamar a procesarHistorialAvanzado al cargar la página
procesarHistorialAvanzado();

// Al hacer clic en un jugador/equipo, mostrar el modal avanzado con historial y desglose
function mostrarModalAvanzado(jugadorId) {
    const user = window.__usuariosAvanzado?.[jugadorId];
    if (!user) return;
    ensureModal();
    document.getElementById('modalPlayerName').textContent = user.nombre;
    document.getElementById('modalPlayerLevel').textContent = `Nivel actual: ${user.nivel.toFixed(2)}`;
    document.getElementById('modalPlayerPoints').textContent = `Puntos Ranking: ${user.puntosRanking.toFixed(2)}`;
    let html = '';
    if (user.history && user.history.length > 0) {
        user.history.slice().reverse().forEach((partido, idx) => {
            html += `<div style="margin-bottom:18px; border-bottom:1px solid #444; padding-bottom:10px;">
                <div style="font-weight:bold; color:#ffcc00;">Partido ${user.history.length - idx} (${new Date(partido.fecha).toLocaleDateString('es-ES')})</div>
                <div><b>Rivales:</b> ${Array.isArray(partido.rival) ? partido.rival.join(' & ') : partido.rival}</div>
                <div><b>Compañero:</b> ${partido.companero}</div>
                <div><b>Resultado:</b> <span style="color:${partido.resultado==='victoria'?'#2ecc71':'#e74c3c'}; font-weight:bold;">${partido.resultado}</span></div>
                <div><b>Nivel:</b> ${partido.nivel !== undefined ? partido.nivel.toFixed(2) : ''}</div>
                <div><b>Puntos Ranking antes:</b> ${partido.puntosRankingAntes.toFixed(2)}</div>
                <div><b>Puntos Ranking después:</b> ${partido.puntosRankingDespues.toFixed(2)}</div>
                <div><b>Δ Puntos Ranking:</b> <span style="color:${(partido.puntosRankingDespues-partido.puntosRankingAntes)>=0?'#2ecc71':'#e74c3c'}; font-weight:bold;">${(partido.puntosRankingDespues-partido.puntosRankingAntes).toFixed(2)}</span></div>
                <div style="margin-top:8px;">
                    <b>Factores:</b>
                    <ul style="margin:0; padding-left:18px;">
                        ${(partido.desglose||[]).map(f=>`<li>${f.nombre}: <span style='color:#ffcc00;'>${f.valor}</span></li>`).join('')}
                    </ul>
                </div>
            </div>`;
        });
    } else {
        html = '<div style="color:#bdc3c7;">No hay historial de partidos disponible.</div>';
    }
    document.getElementById('modalHistory').innerHTML = html;
    document.getElementById('playerModal').style.display = 'flex';
}

// Añadir evento a las filas de la tabla para mostrar el modal avanzado
setTimeout(() => {
    const tbody = document.getElementById('rankingBody');
    if (!tbody) return;
    Array.from(tbody.children).forEach((tr, idx) => {
        tr.onclick = () => {
            const sortedPlayers = Object.values(window.__usuariosAvanzado).sort((a, b) => b.puntosRanking - a.puntosRanking);
            mostrarModalAvanzado(sortedPlayers[idx].id);
        };
    });
}, 1000);
// --- FIN LÓGICA AVANZADA COMPLETA ---


