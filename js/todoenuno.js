import { auth, db } from './firebase-config.js';
import { 
  collection, doc, getDoc, getDocs, query, where, onSnapshot, addDoc,
  Timestamp, orderBy, limit, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const usernameElement = document.getElementById('username');
const rankingPositionElement = document.querySelector('[data-bind="ranking.position"]');
let matchesPlayedElement = document.querySelector('[data-bind="stats.points"]');
let winsElement = document.querySelector('[data-bind="stats.wins"]');
let winRateElement = document.querySelector('[data-bind="stats.winRate"]');
let lastMatchContainer = document.getElementById('last-match-container');
const nextMatchElement = document.getElementById('next-match');
const upcomingMatchesList = document.getElementById('upcoming-matches-list');
const challengeAction = document.querySelector('.action-card.challenge');
const resultsAction = document.querySelector('.action-card.results');
const notificationsAction = document.querySelector('.action-card:nth-child(3)');
const searchPlayerAction = document.querySelector('.action-card:nth-child(4)');
const toggleMatchFilter = document.getElementById('toggle-match-filter');
const toggleMatchFilterAll = document.getElementById('toggle-match-filter-all');
const togglePendingFilter = document.getElementById('toggle-pending-filter');
const togglePendingFilterAll = document.getElementById('toggle-pending-filter-all');
const toggleStatsLiga = document.getElementById('toggle-stats-liga');
const toggleStatsAmistosos = document.getElementById('toggle-stats-amistosos');
const toggleStatsRetos = document.getElementById('toggle-stats-retos');
const toggleStatsTorneos = document.getElementById('toggle-stats-torneos');
const rankingStatusElement = document.getElementById('ranking-status');

let usuarioActual = null;
let equipoUsuario = null;
let filtroActual = 'mis-partidos';
let filtroPendientesActual = 'mis-partidos';
let filtroEstadisticasActual = 'liga';
let usuariosMap = {};

async function cargarUsuariosMap() {
  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  usuariosMap = {};
  usuariosSnap.forEach(doc => {
    const data = doc.data();
    usuariosMap[doc.id] = data.nombreUsuario || data.nombre || data.email || doc.id;
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (!userDoc.exists()) throw new Error("Usuario no registrado");
      usuarioActual = { ...user, ...userDoc.data() };
      usernameElement.textContent = usuarioActual.nombreUsuario || usuarioActual.email.split('@')[0];
      await cargarUsuariosMap();
      await obtenerEquipoUsuario();
      if (equipoUsuario) {
        await cargarEstadisticas();
        cargarProximosPartidos();
        configurarEventListeners();
      }
    } catch (error) {
      console.error("Error al cargar datos del usuario:", error);
    }
  } else {
    window.location.href = "index.html";
  }
});

async function obtenerEquipoUsuario() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  for (const doc of equiposSnap.docs) {
    const data = doc.data();
    if (data.jugadores.includes(usuarioActual.uid)) {
      equipoUsuario = { id: doc.id, ...data };
      break;
    }
  }
}

async function cargarEstadisticas() {
  matchesPlayedElement.textContent = '';
  winsElement.textContent = '';
  winRateElement.textContent = '';
  lastMatchContainer.textContent = '';
  rankingPositionElement.textContent = '';
  
  const welcomeCard = document.querySelector('.welcome-card');
  welcomeCard.classList.add('loading');
  
  const quickStats = document.querySelector('.quick-stats');
  quickStats.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Cargando estadísticas...</p>
    </div>
  `;
  
  try {
    switch (filtroEstadisticasActual) {
      case 'liga': await cargarEstadisticasLiga(); break;
      case 'amistosos': await cargarEstadisticasAmistosos(); break;
      case 'retos': await cargarEstadisticasRetos(); break;
      case 'torneos': await cargarEstadisticasTorneos(); break;
      default: await cargarEstadisticasLiga();
    }
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
    quickStats.innerHTML = `
      <div class="loading-spinner-container">
        <p>Error al cargar estadísticas</p>
        <p style="font-size: 0.8rem; color: var(--accent-color);">Inténtalo de nuevo más tarde</p>
      </div>
    `;
  } finally {
    welcomeCard.classList.remove('loading');
  }
}

async function cargarEstadisticasLiga() {
  let partidosJugados = 0;
  let victorias = 0;
  let ultimoPartido = null;
  
  const calendarioSnap = await getDocs(collection(db, "calendario"));
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;
      if (partido.tipo && partido.tipo !== 'liga') continue;
      
      const esLocal = partido.equipoLocal === equipoUsuario.id;
      const esVisitante = partido.equipoVisitante === equipoUsuario.id;
      if (!esLocal && !esVisitante) continue;
      
      partidosJugados++;
      
      let setsMiEquipo = 0;
      let setsRival = 0;
      
      Object.values(partido.resultado)
        .filter(set => set && typeof set.puntos1 === 'number' && typeof set.puntos2 === 'number')
        .filter(set => !(set.puntos1 === 0 && set.puntos2 === 0))
        .forEach(set => {
          const puntos1 = set.puntos1 || 0;
          const puntos2 = set.puntos2 || 0;
          if (esLocal) {
            if (puntos1 > puntos2) setsMiEquipo++; else setsRival++;
          } else {
            if (puntos2 > puntos1) setsMiEquipo++; else setsRival++;
          }
        });
      
      if (setsMiEquipo > setsRival) victorias++;
      
      const fechaPartido = partido.fecha?.toDate?.() || new Date();
      if (!ultimoPartido || fechaPartido > ultimoPartido.fecha) {
        const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
        const rivalDoc = await getDoc(doc(db, "equipos", rivalId));
        
        ultimoPartido = {
          fecha: fechaPartido,
          rival: rivalDoc.exists() ? rivalDoc.data().nombre : "Equipo desconocido",
          resultado: `${setsMiEquipo}-${setsRival}`
        };
      }
    }
  }
  
  actualizarUIEstadisticas(partidosJugados, victorias, ultimoPartido, 'Posición en la Clasificación');
  await calcularPosicionClasificacion();
}

async function cargarEstadisticasAmistosos() {
  let partidosJugados = 0;
  let victorias = 0;
  let ultimoPartido = null;
  try {
    const partidosAmistososSnap = await getDocs(collection(db, "partidosAmistosos"));
    for (const partidoDoc of partidosAmistososSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;
      // Filtra por UID directo (array de strings o de objetos)
      const jugadores = Array.isArray(partido.jugadores) ? partido.jugadores.map(j => typeof j === 'string' ? j : j.id || j.uid) : [];
      if (!jugadores.includes(usuarioActual.uid)) continue;
      partidosJugados++;
      if (partido.resultado.ganador === usuarioActual.uid) {
        victorias++;
      }
      const fechaPartido = partido.fecha?.toDate?.() || new Date();
      if (!ultimoPartido || fechaPartido > ultimoPartido.fecha) {
        ultimoPartido = {
          fecha: fechaPartido,
          rival: "Equipo Amistoso",
          resultado: partido.resultado.score || "6-4, 6-3"
        };
      }
    }
  } catch (error) {
    console.error('Error al cargar estadísticas de amistosos:', error);
  }
  if (partidosJugados === 0) {
    mostrarMensajeSinPartidos('amistoso');
    return;
  }
  actualizarUIEstadisticas(partidosJugados, victorias, ultimoPartido, 'Amistosos Ganados');
}

async function cargarEstadisticasRetos() {
  let partidosJugados = 0;
  let victorias = 0;
  let ultimoPartido = null;
  try {
    const partidosRetosSnap = await getDocs(collection(db, "partidosReto"));
    for (const partidoDoc of partidosRetosSnap.docs) {
      const partido = partidoDoc.data();
      if (!partido.resultado) continue;
      // Filtra por UID directo (array de strings o de objetos)
      const jugadores = Array.isArray(partido.jugadores) ? partido.jugadores.map(j => typeof j === 'string' ? j : j.id || j.uid) : [];
      if (!jugadores.includes(usuarioActual.uid)) continue;
      partidosJugados++;
      if (partido.resultado.ganador === usuarioActual.uid) {
        victorias++;
      }
      const fechaPartido = partido.fecha?.toDate?.() || new Date();
      if (!ultimoPartido || fechaPartido > ultimoPartido.fecha) {
        ultimoPartido = {
          fecha: fechaPartido,
          rival: "Equipo Reto",
          resultado: partido.resultado.score || "6-4, 6-3"
        };
      }
    }
  } catch (error) {
    console.error('Error al cargar estadísticas de retos:', error);
  }
  if (partidosJugados === 0) {
    mostrarMensajeSinPartidos('reto');
    return;
  }
  actualizarUIEstadisticas(partidosJugados, victorias, ultimoPartido, 'Retos Ganados');
}

async function cargarEstadisticasTorneos() {
  let partidosJugados = 0;
  let victorias = 0;
  let ultimoPartido = null;
  let posicionTorneo = 'No participó';
  
  try {
    const torneosSnap = await getDocs(collection(db, "torneos"));
    
    for (const torneoDoc of torneosSnap.docs) {
      const torneo = torneoDoc.data();
      const partidosSnap = await getDocs(collection(db, `torneos/${torneoDoc.id}/partidos`));
      
      for (const partidoDoc of partidosSnap.docs) {
        const partido = partidoDoc.data();
        if (!partido.resultado) continue;
        
        const participo = partido.jugador1 === usuarioActual.uid || partido.jugador2 === usuarioActual.uid;
        if (!participo) continue;
        
        partidosJugados++;
        
        if (partido.resultado.ganador === usuarioActual.uid) {
          victorias++;
        }
        
        const fechaPartido = partido.fecha?.toDate?.() || new Date();
        if (!ultimoPartido || fechaPartido > ultimoPartido.fecha) {
          const rival = partido.jugador1 === usuarioActual.uid ? partido.jugador2 : partido.jugador1;
          ultimoPartido = {
            fecha: fechaPartido,
            rival: rival,
            resultado: partido.resultado.score || "6-4, 6-3"
          };
        }
      }
      
      if (partidosJugados > 0) {
        if (victorias === partidosJugados) {
          posicionTorneo = 'Campeón';
        } else if (victorias >= partidosJugados * 0.75) {
          posicionTorneo = 'Finalista';
        } else if (victorias >= partidosJugados * 0.5) {
          posicionTorneo = 'Semifinalista';
        } else {
          posicionTorneo = 'Eliminado en grupos';
        }
      }
    }
  } catch (error) {
    console.error('Error al cargar estadísticas de torneos:', error);
  }
  
  actualizarUIEstadisticas(partidosJugados, victorias, ultimoPartido, posicionTorneo);
}

function actualizarUIEstadisticas(partidosJugados, victorias, ultimoPartido, posicionTexto) {
  const quickStats = document.querySelector('.quick-stats');
  quickStats.innerHTML = `
    <div class="stat-item">
      <i class="fas fa-clipboard-check"></i>
      <span class="stat-value" data-bind="stats.points">${partidosJugados}</span>
      <span class="stat-label">Partidos Jugados</span>
    </div>
    <div class="stat-item">
      <i class="fas fa-check-circle"></i>
      <span class="stat-value" data-bind="stats.wins">${victorias}</span>
      <span class="stat-label">Victorias</span>
    </div>
    <div class="stat-item">
      <i class="fas fa-percentage"></i>
      <span class="stat-value" data-bind="stats.winRate">${partidosJugados > 0 ? `${victorias}/${partidosJugados}` : "0/0"}</span>
      <span class="stat-label">Victorias-Derrotas</span>
    </div>
    <div class="stat-item">
      <i class="fas fa-calendar-plus"></i>
      <span id="last-match-container">
        ${ultimoPartido ? `
          <span class="stat-value">${ultimoPartido.resultado}</span>
          <span class="stat-label">vs ${ultimoPartido.rival}</span>
        ` : '<span class="stat-value">-</span>'}
      </span>
      <span class="stat-label">Ultimo Partido</span>
    </div>
  `;
  
  if (rankingStatusElement) {
    rankingStatusElement.innerHTML = `${posicionTexto}: <span data-bind="ranking.position">-</span>`;
  }
}

async function calcularPosicionClasificacion() {
  const equiposMap = {};
  const equiposSnap = await getDocs(collection(db, "equipos"));
  equiposSnap.forEach(doc => {
    equiposMap[doc.id] = {
      id: doc.id,
      nombre: doc.data().nombre,
      puntos: 0,
      partidosJugados: 0,
      setsGanados: 0,
      setsPerdidos: 0,
      juegosGanados: 0,
      juegosPerdidos: 0
    };
  });

  const calendarioSnap = await getDocs(collection(db, "calendario"));
  
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
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
        visitante.puntos += 1;
      } else if (setsVisitante > setsLocal) {
        visitante.puntos += 2;
        local.puntos += 1;
      } else {
        local.puntos += 1;
        visitante.puntos += 1;
      }
    }
  }

  const equiposOrdenados = Object.values(equiposMap).sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.setsGanados !== a.setsGanados) return b.setsGanados - a.setsGanados;
    return b.juegosGanados - a.juegosGanados;
  });

  const posicion = equiposOrdenados.findIndex(equipo => equipo.id === equipoUsuario.id) + 1;
  rankingPositionElement.textContent = posicion > 0 ? posicion : '-';
}

function obtenerNombresJugadores(jugadores) {
  if (!Array.isArray(jugadores)) return '';
  return jugadores.map(j => {
    if (typeof j === 'string') return usuariosMap[j] || j;
    if (j.id) return usuariosMap[j.id] || j.nombre || j.id;
    return j.nombre || j.displayName || j;
  }).join(' & ');
}

// Helper para obtener nombreUsuario a partir de UID
function getNombreUsuario(uid) {
  if (!uid) return '';
  if (usuariosMap && usuariosMap[uid]) return usuariosMap[uid];
  return uid;
}

// Modifica la visualización de partidos pendientes y añadir resultado para mostrar nombreUsuario
function obtenerNombresEquipos(jugadores) {
  if (!Array.isArray(jugadores)) return { local: '', visitante: '' };
  const nombresLocal = jugadores.slice(0,2).map(jugadorId => getNombreUsuario(jugadorId));
  const nombresVisitante = jugadores.slice(2,4).map(jugadorId => getNombreUsuario(jugadorId));
  return {
    local: nombresLocal.join(' & '),
    visitante: nombresVisitante.join(' & ')
  };
}

function cargarProximosPartidos() {
  nextMatchElement.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Cargando próximos partidos...</p>
    </div>
  `;
  upcomingMatchesList.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Cargando partidos pendientes...</p>
    </div>
  `;

  onSnapshot(collection(db, "calendario"), async (snapshot) => {
    const partidosLiga = [];
    for (const jornadaDoc of snapshot.docs) {
      const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
      for (const partidoDoc of partidosSnap.docs) {
        const partido = partidoDoc.data();
        if (partido.resultado) continue;
        const [localDoc, visitanteDoc] = await Promise.all([
          getDoc(doc(db, "equipos", partido.equipoLocal)),
          getDoc(doc(db, "equipos", partido.equipoVisitante))
        ]);
        const local = localDoc.exists() ? localDoc.data().nombre : "Equipo desconocido";
        const visitante = visitanteDoc.exists() ? visitanteDoc.data().nombre : "Equipo desconocido";
        partidosLiga.push({
          id: partidoDoc.id,
          jornadaId: jornadaDoc.id,
          fecha: partido.fecha?.toDate?.() || new Date(),
          local,
          visitante,
          tipo: 'liga',
          equipoLocalId: partido.equipoLocal,
          equipoVisitanteId: partido.equipoVisitante
        });
      }
    }
    // Amistosos
    const amistososSnap = await getDocs(query(collection(db, 'partidosAmistosos'), where('estado', '==', 'pendiente')));
    const partidosAmistosos = amistososSnap.docs.map(docA => {
      const p = docA.data();
      const equipos = obtenerNombresEquipos(p.jugadores);
      return {
        id: docA.id,
        fecha: p.fecha?.toDate?.() || new Date(),
        tipo: 'amistoso',
        jugadores: p.jugadores,
        creador: p.creador,
        local: equipos.local,
        visitante: equipos.visitante,
        equipoLocalId: '',
        equipoVisitanteId: '',
        jornadaId: ''
      };
    });
    // Retos
    const retosSnap = await getDocs(query(collection(db, 'partidosReto'), where('estado', '==', 'pendiente')));
    const partidosRetos = retosSnap.docs.map(docR => {
      const p = docR.data();
      const equipos = obtenerNombresEquipos(p.jugadores);
      return {
        id: docR.id,
        fecha: p.fecha?.toDate?.() || new Date(),
        tipo: 'reto',
        jugadores: p.jugadores,
        creador: p.creador,
        local: equipos.local,
        visitante: equipos.visitante,
        equipoLocalId: '',
        equipoVisitanteId: '',
        jornadaId: ''
      };
    });
    // Unificar y ordenar
    let todosLosPartidos = [...partidosLiga, ...partidosAmistosos, ...partidosRetos];
    todosLosPartidos.sort((a, b) => a.fecha - b.fecha);
    // Filtros
    const partidosPendientes = todosLosPartidos.filter(p => {
      if (filtroActual === 'mis-partidos') {
        if (p.tipo === 'liga') {
          return p.equipoLocalId === equipoUsuario?.id || p.equipoVisitanteId === equipoUsuario?.id;
      } else {
          return (p.jugadores || []).includes(usuarioActual.uid) || p.creador === usuarioActual.uid;
        }
      }
      return true;
    });
    // Próximo partido
    const proximoPartido = partidosPendientes[0] || todosLosPartidos[0];
    if (proximoPartido) {
      let equipo1 = proximoPartido.local;
      let equipo2 = proximoPartido.visitante;
      let tipoBadge = proximoPartido.tipo ? proximoPartido.tipo.toUpperCase() : 'LIGA';
      nextMatchElement.innerHTML = `
        <div class="vs-container">
          <div class="team">
            <div class="team-logo"></div>
            <div class="team-name">${equipo1}</div>
          </div>
          <div class="match-info">
            <div class="match-date">
              <i class="fas fa-calendar"></i>
              ${proximoPartido.fecha.toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="match-vs">VS</div>
            <div class="match-type-badge ${proximoPartido.tipo}">${tipoBadge}</div>
          </div>
          <div class="team">
            <div class="team-logo"></div>
            <div class="team-name">${equipo2}</div>
          </div>
        </div>
      `;
    } else {
      nextMatchElement.innerHTML = `<p class="no-matches">No hay partidos programados</p>`;
    }
    // Lista de partidos pendientes
    upcomingMatchesList.innerHTML = partidosPendientes.length > 0
      ? partidosPendientes.map(p => {
          let equipo1 = p.local;
          let equipo2 = p.visitante;
          let tipoBadge = p.tipo ? p.tipo.toUpperCase() : 'LIGA';
          return `
            <div class="match-item">
              <span class="match-date">${p.fecha.toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span class="match-vs">${equipo1}${equipo2 ? ' vs ' + equipo2 : ''}</span>
              <span class="match-type-badge ${p.tipo}">${tipoBadge}</span>
            </div>
          `;
        }).join('')
      : `<p class="no-matches">No hay partidos pendientes</p>`;
  });
}

function configurarEventListeners() {
  // Solo dejar la lógica de otros botones globales (ver calendario, ver clasificación, etc.)
  const btnVerCalendario = document.getElementById('btn-ver-calendario');
  if (btnVerCalendario) {
    btnVerCalendario.addEventListener('click', () => {
      window.location.href = 'calendario.html';
    });
  }
  const btnVerClasificacion = document.getElementById('btn-ver-clasificacion');
  if (btnVerClasificacion) {
    btnVerClasificacion.addEventListener('click', () => {
      window.location.href = 'clasificacion.html';
    });
  }
  upcomingMatchesList.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-report')) {
      const button = e.target.closest('.btn-report');
      const jornadaId = button.dataset.jornada;
      const partidoId = button.dataset.partido;
      await reportarResultado(jornadaId, partidoId);
    }
  });
  if (toggleMatchFilter) {
    toggleMatchFilter.addEventListener('click', () => {
      filtroActual = 'mis-partidos';
      toggleMatchFilter.classList.add('active');
      toggleMatchFilterAll.classList.remove('active');
      cargarProximosPartidos();
    });
  }
  if (toggleMatchFilterAll) {
    toggleMatchFilterAll.addEventListener('click', () => {
      filtroActual = 'todos-partidos';
      toggleMatchFilterAll.classList.add('active');
      toggleMatchFilter.classList.remove('active');
      cargarProximosPartidos();
    });
  }
  if (togglePendingFilter) {
  togglePendingFilter.addEventListener('click', () => {
    filtroPendientesActual = 'mis-partidos';
    togglePendingFilter.classList.add('active');
    togglePendingFilterAll.classList.remove('active');
    cargarProximosPartidos();
  });
  }
  if (togglePendingFilterAll) {
  togglePendingFilterAll.addEventListener('click', () => {
    filtroPendientesActual = 'todos-partidos';
    togglePendingFilterAll.classList.add('active');
    togglePendingFilter.classList.remove('active');
    cargarProximosPartidos();
    });
  }
}

async function cargarEquiposParaModal() {
  const equiposSnap = await getDocs(collection(db, "equipos"));
  const selectLocal = document.getElementById('equipo-local');
  const selectVisitante = document.getElementById('equipo-visitante');
  
  selectLocal.innerHTML = '<option value="">Selecciona equipo local</option>';
  selectVisitante.innerHTML = '<option value="">Selecciona equipo visitante</option>';
  
  equiposSnap.forEach(doc => {
    const equipo = doc.data();
    selectLocal.innerHTML += `<option value="${doc.id}">${equipo.nombre}</option>`;
    selectVisitante.innerHTML += `<option value="${doc.id}">${equipo.nombre}</option>`;
  });
}

async function cargarJugadoresParaModal(modal) {
  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  const jugadoresList = modal.querySelector('#jugadores-list');
  
  jugadoresList.innerHTML = '';
  usuariosSnap.forEach(doc => {
    const usuario = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.text = usuario.nombre;
    jugadoresList.appendChild(option);
  });
}

async function crearPartidoLiga(fecha, equipoLocal, equipoVisitante) {
  try {
    const partidoData = {
      tipo: 'liga',
      fecha: fecha,
      equipoLocal: equipoLocal,
      equipoVisitante: equipoVisitante,
      estado: 'pendiente',
      creadorId: usuarioActual.uid,
      fechaCreacion: serverTimestamp()
    };

    await addDoc(collection(db, "partidos"), partidoData);
  } catch (error) {
    console.error("Error al crear partido de liga:", error);
    throw error;
  }
}

async function crearPartidoAmistoso(fecha) {
  try {
    const partidoData = {
      tipo: 'amistoso',
      fecha: fecha,
      jugadores: [{
        id: usuarioActual.uid,
        nombre: usuarioActual.nombre
      }],
      estado: 'abierto',
      creadorId: usuarioActual.uid,
      fechaCreacion: serverTimestamp()
    };

    await addDoc(collection(db, "partidosAmistosos"), partidoData);
  } catch (error) {
    console.error("Error al crear partido amistoso:", error);
    throw error;
  }
}

async function mostrarDetallesJugador(jugadorId, modal) {
  const detallesContainer = modal.querySelector('.jugador-detalles');
  const statsContainer = detallesContainer.querySelector('.stats-container');
  const ultimosPartidosContainer = detallesContainer.querySelector('.ultimos-partidos');

  const jugadorDoc = await getDoc(doc(db, "usuarios", jugadorId));
  const jugador = jugadorDoc.data();

  const partidosQuery = query(
    collection(db, "partidos"),
    where("jugadores", "array-contains", jugadorId),
    orderBy("fecha", "desc"),
    limit(5)
  );
  const partidosSnap = await getDocs(partidosQuery);

  statsContainer.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Partidos Jugados</span>
      <span class="stat-value">${jugador.partidosJugados || 0}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Victorias</span>
      <span class="stat-value">${jugador.victorias || 0}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Derrotas</span>
      <span class="stat-value">${jugador.derrotas || 0}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Posición</span>
      <span class="stat-value">${jugador.posicion || '--'}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Compañero Frecuente</span>
      <span class="stat-value">${jugador.companeroFrecuente || '--'}</span>
    </div>
  `;

  ultimosPartidosContainer.innerHTML = '<h4>Últimos Partidos</h4>';
  partidosSnap.forEach(doc => {
    const partido = doc.data();
    ultimosPartidosContainer.innerHTML += `
      <div class="partido-item">
        <span class="fecha">${partido.fecha.toDate().toLocaleDateString()}</span>
        <span class="resultado">${partido.resultado || 'Pendiente'}</span>
      </div>
    `;
  });
}

async function enviarMensaje(jugadorId, mensaje) {
  try {
    const mensajeData = {
      emisorId: usuarioActual.uid,
      receptorId: jugadorId,
      mensaje: mensaje,
      fecha: serverTimestamp(),
      leido: false
    };

    await addDoc(collection(db, "mensajes"), mensajeData);
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    throw error;
  }
}

async function reportarResultado(jornadaId, partidoId) {
  const partidoDoc = await getDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`));
  if (!partidoDoc.exists()) return;
  
  const partido = partidoDoc.data();
  const rivalId = partido.equipoLocal === equipoUsuario.id 
    ? partido.equipoVisitante 
    : partido.equipoLocal;
  
  const rivalDoc = await getDoc(doc(db, "equipos", rivalId));
  const rivalNombre = rivalDoc.exists() ? rivalDoc.data().nombre : "Equipo desconocido";
  
  const resultado = prompt(`Ingresa el resultado contra ${rivalNombre} (formato: 6-4,4-6,6-3)`);
  if (!resultado) return;
  
  try {
    const sets = resultado.split(',').map(s => s.trim());
    if (sets.length < 2 || sets.length > 3) throw new Error("Formato inválido");
    
    const resultadoParseado = {};
    sets.forEach((set, i) => {
      const [puntos1, puntos2] = set.split('-').map(Number);
      if (isNaN(puntos1) || isNaN(puntos2)) throw new Error("Formato inválido");
      resultadoParseado[`set${i+1}`] = { puntos1, puntos2 };
    });
    
    await addDoc(collection(db, "incidencias"), {
      tipo: "resultado",
      usuarioId: usuarioActual.uid,
      equipoId: equipoUsuario.id,
      jornadaId,
      partidoId,
      resultadoPropuesto: resultadoParseado,
      fecha: Timestamp.now(),
      estado: "pendiente",
      mensaje: `El usuario ${usuarioActual.nombreUsuario} reportó este resultado`
    });
    
    alert("✅ Incidencia creada. Un administrador revisará tu reporte.");
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  }
}

function mostrarMensajeSinPartidos(tipo) {
  const quickStats = document.querySelector('.quick-stats');
  let texto = 'No has disputado ningún partido aún';
  if (tipo === 'amistoso') texto = 'No has disputado ningún partido amistoso aún';
  if (tipo === 'reto') texto = 'No has disputado ningún reto aún';
  quickStats.innerHTML = `
    <div class="stat-item" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;">
      <i class="fas fa-info-circle" style="font-size:2.2em;margin-bottom:0.5em;"></i>
      <span class="stat-value">0</span>
      <span class="stat-label" style="text-align:center;">${texto}</span>
    </div>
  `;
}

// 2. Acciones de quick-actions
function crearModal(html) {
  const modal = document.createElement('div');
  modal.className = 'modal-quickaction';
  modal.innerHTML = `<div class="modal-quickaction-bg"></div><div class="modal-quickaction-content">${html}</div>`;
  document.body.appendChild(modal);
  // Bloquear scroll de fondo
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-quickaction-bg').onclick = () => { modal.remove(); document.body.style.overflow = ''; };
  // Cerrar con la X
  const closeBtn = modal.querySelector('.close-modal');
  if (closeBtn) closeBtn.onclick = () => { modal.remove(); document.body.style.overflow = ''; };
  // Scroll automático al centro del modal (por si acaso)
  setTimeout(() => {
    const content = modal.querySelector('.modal-quickaction-content');
    if (content) {
      content.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
    }
  }, 50);
  return modal;
}

function centrarModalQuickaction() {
  const style = document.createElement('style');
  style.innerHTML = `
    .modal-quickaction {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: all;
      overflow: hidden;
      background: none;
    }
    .modal-quickaction-bg {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(16,24,44,0.92);
      backdrop-filter: blur(2.5px);
      z-index: 1;
    }
    .modal-quickaction-content {
      position: relative;
      z-index: 2;
      background: var(--modal-bg, rgba(26,42,53,0.97));
      border-radius: 18px;
      min-width: 340px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 80px rgba(0,0,0,0.9);
      border: 1.5px solid rgba(212,175,55,0.25);
      padding: 2.2em 1.7em 1.5em 1.7em;
      font-family: var(--font-main, 'Poppins',sans-serif);
      color: var(--text-color,#fff);
      animation: modalFadeIn 0.35s cubic-bezier(.4,1.6,.6,1);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
    }
    @keyframes modalFadeIn {from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
    .modal-quickaction-content h3 {
      margin-top:0;margin-bottom:1.1em;
      font-size:1.35em;
      font-family: var(--font-heading,'Montserrat',sans-serif);
      color: var(--primary-color,#E9C46A);
      letter-spacing:0.5px;
      text-align:center;
      font-weight:700;
      text-shadow:0 2px 12px #0006;
    }
    .modal-quickaction-content ul {padding-left:0;list-style:none;}
    .modal-quickaction-content li {margin-bottom:1.2em;background:rgba(255,255,255,0.03);border-radius:12px;padding:0.7em 1em;box-shadow:0 2px 8px #0002;}
    .modal-quickaction-content button {
      background: var(--gradient-gold, linear-gradient(135deg,#E9C46A,#d4a42c));
      color: #23262e;
      border: none;
      border-radius: 12px;
      padding: 0.45em 1.2em;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      margin-top:0.7em;
      box-shadow: 0 2px 8px #E9C46A33;
      transition: background 0.2s, transform 0.2s;
    }
    .modal-quickaction-content button:hover {background: var(--btn-hover, #FFD700);transform:translateY(-2px);}
    .modal-quickaction-content input[type='text'] {
      width:100%;padding:0.6em 1em;margin-bottom:1.2em;
      border-radius:10px;border:1px solid #E9C46A44;
      background: var(--input-bg,#15203A);
      color:var(--text-color,#fff);
      font-size:1em;
      outline:none;
      transition: border 0.2s;
    }
    .modal-quickaction-content input[type='text']:focus {border:1.5px solid #E9C46A;}
    .modal-quickaction-content .usuario-item {
      padding:0.7em 0.3em;cursor:pointer;border-bottom:1px solid #2223;
      border-radius:8px;transition:background 0.2s;
      font-size:1.08em;
    }
    .modal-quickaction-content .usuario-item:hover {background:rgba(233,196,106,0.08);}
    .modal-quickaction-content .close-modal {
      position:absolute;top:10px;right:18px;font-size:1.5em;cursor:pointer;color:#E9C46A;transition:color 0.2s;z-index:10;
    }
    .modal-quickaction-content .close-modal:hover {color:#E76F51;}
    .modal-quickaction-content p {text-align:center;font-size:1.08em;line-height:1.6;margin:1.2em 0;}
    .modal-quickaction-content small {display:block;text-align:center;color:#E9C46A99;margin-top:0.5em;}
    @media (max-width: 600px) {
      .modal-quickaction-content {min-width: 90vw;max-width: 98vw;padding: 1.2em 0.5em;}
    }
  `;
  document.head.appendChild(style);
}
centrarModalQuickaction();

// Helpers para acciones
async function obtenerPartidosPendientesUsuario() {
  // Devuelve partidos pendientes del usuario (liga, amistoso, reto)
  let partidos = [];
  // Liga
  const calendarioSnap = await getDocs(collection(db, 'calendario'));
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (partido.resultado) continue;
      if (partido.equipoLocal === equipoUsuario?.id || partido.equipoVisitante === equipoUsuario?.id || (partido.jugadores||[]).includes(usuarioActual.uid)) {
        // Obtener nombre de equipo
        let local = 'Equipo';
        let visitante = 'Equipo';
        try {
          const [localDoc, visitanteDoc] = await Promise.all([
            getDoc(doc(db, 'equipos', partido.equipoLocal)),
            getDoc(doc(db, 'equipos', partido.equipoVisitante))
          ]);
          local = localDoc.exists() ? localDoc.data().nombre : partido.equipoLocal;
          visitante = visitanteDoc.exists() ? visitanteDoc.data().nombre : partido.equipoVisitante;
        } catch {}
        partidos.push({
          id: partidoDoc.id,
          tipo: 'liga',
          jornadaId: jornadaDoc.id,
          local,
          visitante,
          fecha: partido.fecha?.toDate?.() || new Date()
        });
      }
    }
  }
  // Amistosos
  const amistososSnap = await getDocs(query(collection(db, 'partidosAmistosos'), where('estado', '==', 'pendiente')));
  amistososSnap.forEach(docA => {
    const p = docA.data();
    if ((p.jugadores||[]).includes(usuarioActual.uid) || p.creador === usuarioActual.uid) {
      const equipos = obtenerNombresEquipos(p.jugadores);
      partidos.push({
        id: docA.id,
        tipo: 'amistoso',
        local: equipos.local,
        visitante: equipos.visitante,
        fecha: p.fecha?.toDate?.() || new Date()
      });
    }
  });
  // Retos
  const retosSnap = await getDocs(query(collection(db, 'partidosReto'), where('estado', '==', 'pendiente')));
  retosSnap.forEach(docR => {
    const p = docR.data();
    if ((p.jugadores||[]).includes(usuarioActual.uid) || p.creador === usuarioActual.uid) {
      const equipos = obtenerNombresEquipos(p.jugadores);
      partidos.push({
        id: docR.id,
        tipo: 'reto',
        local: equipos.local,
        visitante: equipos.visitante,
        fecha: p.fecha?.toDate?.() || new Date()
      });
    }
  });
  // Ordenar por fecha
  partidos.sort((a, b) => a.fecha - b.fecha);
  return partidos;
}

async function obtenerUsuariosParaBusqueda() {
  const usuariosSnap = await getDocs(collection(db, 'usuarios'));
  return usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Modal para añadir resultado desde home
window.abrirModalResultadoQuick = async function(partidoId, tipo, jornadaId) {
  // Obtener datos del partido para mostrar nombres
  let equipo1 = '', equipo2 = '', fecha = '';
  if (tipo === 'liga') {
    // Buscar en calendario
    const jornadaSnap = await getDoc(doc(db, 'calendario', jornadaId));
    if (jornadaSnap.exists()) {
      const partidosSnap = await getDocs(collection(db, `calendario/${jornadaId}/partidos`));
      const partidoDoc = partidosSnap.docs.find(d => d.id === partidoId);
      if (partidoDoc) {
        const p = partidoDoc.data();
        // Obtener nombre de equipo
        let local = 'Equipo';
        let visitante = 'Equipo';
        try {
          const [localDoc, visitanteDoc] = await Promise.all([
            getDoc(doc(db, 'equipos', p.equipoLocal)),
            getDoc(doc(db, 'equipos', p.equipoVisitante))
          ]);
          local = localDoc.exists() ? localDoc.data().nombre : p.equipoLocal;
          visitante = visitanteDoc.exists() ? visitanteDoc.data().nombre : p.equipoVisitante;
        } catch {}
        equipo1 = local;
        equipo2 = visitante;
        fecha = p.fecha?.toDate?.().toLocaleString('es-ES') || '';
      }
    }
  } else {
    // Buscar en amistosos/reto
    let snap = null;
    if (tipo === 'amistoso') snap = await getDoc(doc(db, 'partidosAmistosos', partidoId));
    if (tipo === 'reto') snap = await getDoc(doc(db, 'partidosReto', partidoId));
    if (snap && snap.exists()) {
      const p = snap.data();
      const equipos = obtenerNombresEquipos(p.jugadores);
      equipo1 = equipos.local;
      equipo2 = equipos.visitante;
      fecha = p.fecha?.toDate?.().toLocaleString('es-ES') || '';
    }
  }
  let html = `<h3>Añadir resultado</h3>
    <div class='vs-container' style='justify-content:center;gap:2em;margin-bottom:1em;'>
      <div class='team-name' style='font-weight:700;color:#E9C46A;'>${equipo1}</div>
      <div class='match-vs' style='font-size:1.3em;color:#E76F51;'>VS</div>
      <div class='team-name' style='font-weight:700;color:#2A9D8F;'>${equipo2}</div>
    </div>
    <small>${fecha}</small>
    <form id='form-resultados-quick'>
      <div style='display:flex;gap:1em;justify-content:center;'>
        <div><label>Set 1</label><input type='number' id='set1-local' min='0' max='7' required style='width:3em;'> - <input type='number' id='set1-visitante' min='0' max='7' required style='width:3em;'></div>
        <div><label>Set 2</label><input type='number' id='set2-local' min='0' max='7' required style='width:3em;'> - <input type='number' id='set2-visitante' min='0' max='7' required style='width:3em;'></div>
        <div><label>Set 3</label><input type='number' id='set3-local' min='0' max='7' style='width:3em;'> - <input type='number' id='set3-visitante' min='0' max='7' style='width:3em;'></div>
      </div>
      <button type='submit' style='margin-top:1em;'>Guardar resultado</button>
      <span class='close-modal' onclick='this.closest(".modal-quickaction").remove()' style='position:absolute;top:10px;right:18px;font-size:1.5em;cursor:pointer;'>&times;</span>
    </form>`;
  const modal = crearModal(html);
  modal.querySelector('#form-resultados-quick').onsubmit = async (e) => {
    e.preventDefault();
    const set1Local = parseInt(modal.querySelector('#set1-local').value) || 0;
    const set1Visitante = parseInt(modal.querySelector('#set1-visitante').value) || 0;
    const set2Local = parseInt(modal.querySelector('#set2-local').value) || 0;
    const set2Visitante = parseInt(modal.querySelector('#set2-visitante').value) || 0;
    const set3Local = parseInt(modal.querySelector('#set3-local').value) || 0;
    const set3Visitante = parseInt(modal.querySelector('#set3-visitante').value) || 0;
    const resultado = {
      set1: { puntos1: set1Local, puntos2: set1Visitante },
      set2: { puntos1: set2Local, puntos2: set2Visitante }
    };
    if (set3Local > 0 || set3Visitante > 0) {
      resultado.set3 = { puntos1: set3Local, puntos2: set3Visitante };
    }
    resultado.fechaGuardado = serverTimestamp();
    try {
      if (tipo === 'liga') {
        await updateDoc(doc(db, `calendario/${jornadaId}/partidos/${partidoId}`), { resultado });
      } else if (tipo === 'amistoso') {
        await updateDoc(doc(db, 'partidosAmistosos', partidoId), { resultado });
      } else if (tipo === 'reto') {
        await updateDoc(doc(db, 'partidosReto', partidoId), { resultado });
      }
      modal.remove();
      alert('Resultado guardado correctamente');
      cargarProximosPartidos();
    } catch (error) {
      alert('Error al guardar resultado: ' + error.message);
    }
  };
};

// MODAL NUEVO RETO estilo calendario
window.abrirModalNuevoReto = async function() {
  // Cargar usuarios y equipos
  const usuariosSnap = await getDocs(collection(db, 'usuarios'));
  const usuarios = usuariosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const equiposSnap = await getDocs(collection(db, 'equipos'));
  const equipos = equiposSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Contenido HTML igual a calendario (sin el contenedor modal-general)
  let html = `
    <div class="modal-header">
      <h3><i class="fas fa-plus-circle"></i> Crear Partido</h3>
      <span class="close-modal" style="cursor:pointer;">&times;</span>
    </div>
    <div class="modal-body">
      <div class="match-type-selector">
        <button class="match-type-btn active" data-type="liga"><i class="fas fa-trophy"></i> Liga</button>
        <button class="match-type-btn" data-type="amistoso"><i class="fas fa-handshake"></i> Amistoso</button>
        <button class="match-type-btn" data-type="reto"><i class="fas fa-fire"></i> Reto</button>
      </div>
      <form id="form-crear-partido-liga" class="match-form form-liga active">
        <div class="form-group">
          <label for="select-rival-liga"><i class="fas fa-users"></i> Equipo Rival:</label>
          <select id="select-rival-liga" required class="select-liga">
            <option value="">Selecciona un equipo rival</option>
            ${equipos.filter(e=>e.id!==equipoUsuario?.id).map(e=>`<option value='${e.id}'>${e.nombre}</option>`).join('')}
          </select>
          <small class="form-help">Solo se muestran equipos con los que aún no has jugado</small>
        </div>
        <button type="submit" class="btn-guardar btn-liga"><i class="fas fa-plus"></i> Crear Partido Liga</button>
      </form>
      <form id="form-crear-partido-amistoso" class="match-form form-amistoso" style="display:none;">
        <div class="form-group">
          <label><i class="fas fa-star"></i> Nivel (opcional):</label>
          <div class="nivel-personalizado">
            <input type="number" id="nivel-minimo-amistoso" min="1" max="5" placeholder="1" />
            <span>-</span>
            <input type="number" id="nivel-maximo-amistoso" min="1" max="5" placeholder="5" />
            <span>/ 5</span>
          </div>
          <small class="form-help">Rango de nivel permitido para unirse (1-5)</small>
        </div>
        <div class="form-group">
          <label><i class="fas fa-users"></i> Añadir usuarios al partido:</label>
          <div class="tennis-court-container">
            <div class="tennis-court padel-grid">
              <div class="court-player-slot" data-pos="1"></div>
              <div class="court-player-slot" data-pos="2"></div>
              <div class="court-player-slot" data-pos="3"></div>
              <div class="court-player-slot" data-pos="4"></div>
            </div>
          </div>
        </div>
        <button type="submit" class="btn-guardar btn-amistoso"><i class="fas fa-plus"></i> Crear Partido Amistoso</button>
      </form>
      <form id="form-crear-partido-reto" class="match-form form-reto" style="display:none;">
        <div class="form-group">
          <label><i class="fas fa-star"></i> Nivel (opcional):</label>
          <div class="nivel-personalizado">
            <input type="number" id="nivel-minimo-reto" min="1" max="5" placeholder="1" />
            <span>-</span>
            <input type="number" id="nivel-maximo-reto" min="1" max="5" placeholder="5" />
            <span>/ 5</span>
          </div>
          <small class="form-help">Rango de nivel permitido para aceptar el reto (1-5)</small>
        </div>
        <div class="form-group">
          <label><i class="fas fa-users"></i> Añadir usuarios al partido:</label>
          <div class="tennis-court-container">
            <div class="tennis-court padel-grid">
              <div class="court-player-slot" data-pos="1"></div>
              <div class="court-player-slot" data-pos="2"></div>
              <div class="court-player-slot" data-pos="3"></div>
              <div class="court-player-slot" data-pos="4"></div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label for="family-points-apuesta"><i class="fas fa-coins"></i> Family Points a apostar:</label>
          <input type="number" id="family-points-apuesta" min="1" value="10" required />
          <small class="form-help">Family points que apostarás. El ganador obtendrá estos puntos</small>
        </div>
        <button type="submit" class="btn-guardar btn-reto"><i class="fas fa-fire"></i> Lanzar Reto</button>
      </form>
    </div>
  `;

  // Mostrar usando crearModal (modal-quickaction)
  const modal = crearModal(html);

  // Tabs de tipo de partido
  const tipoBtns = modal.querySelectorAll('.match-type-btn');
  const forms = modal.querySelectorAll('.match-form');
  tipoBtns.forEach(btn => {
    btn.onclick = () => {
      tipoBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      forms.forEach(f=>f.classList.remove('active'));
      if (btn.dataset.type==='liga') {
        modal.querySelector('.form-liga').style.display='block';
        modal.querySelector('.form-amistoso').style.display='none';
        modal.querySelector('.form-reto').style.display='none';
        modal.querySelector('.form-liga').classList.add('active');
      } else if (btn.dataset.type==='amistoso') {
        modal.querySelector('.form-liga').style.display='none';
        modal.querySelector('.form-amistoso').style.display='block';
        modal.querySelector('.form-reto').style.display='none';
        modal.querySelector('.form-amistoso').classList.add('active');
      } else {
        modal.querySelector('.form-liga').style.display='none';
        modal.querySelector('.form-amistoso').style.display='none';
        modal.querySelector('.form-reto').style.display='block';
        modal.querySelector('.form-reto').classList.add('active');
      }
    };
  });

  // Lógica para slots de jugadores (amistoso/reto)
  function renderSlots(formId) {
    const form = modal.querySelector(formId);
    const slots = form.querySelectorAll('.court-player-slot');
    slots.forEach((slot, idx) => {
      slot.innerHTML = '';
      if (idx === 0) {
        slot.innerHTML = `<div class='jugador-casilla-info'><span class='jugador-nombre destacado'>${usuarioActual.nombreUsuario||usuarioActual.nombre||usuarioActual.email}</span></div>`;
        slot.classList.add('ocupado');
      } else {
        slot.classList.remove('ocupado');
        slot.onclick = async () => {
          // Selector de usuario
          const select = document.createElement('select');
          select.innerHTML = `<option value=''>Selecciona jugador</option>` + usuarios.filter(u=>u.id!==usuarioActual.uid).map(u=>`<option value='${u.id}'>${u.nombreUsuario||u.nombre||u.email}</option>`).join('');
          select.onchange = () => {
            if (select.value) {
              slot.innerHTML = `<div class='jugador-casilla-info'><span class='jugador-nombre'>${usuarios.find(u=>u.id===select.value).nombreUsuario||usuarios.find(u=>u.id===select.value).nombre||usuarios.find(u=>u.id===select.value).email}</span><button class='btn-quitar-jugador'>&times;</button></div>`;
              slot.classList.add('ocupado');
              slot.querySelector('.btn-quitar-jugador').onclick = (e) => {
                e.stopPropagation();
                renderSlots(formId);
              };
            }
          };
          slot.innerHTML = '';
          slot.appendChild(select);
        };
      }
    });
  }
  renderSlots('#form-crear-partido-amistoso');
  renderSlots('#form-crear-partido-reto');

  // Crear partido LIGA
  modal.querySelector('#form-crear-partido-liga').onsubmit = async (e) => {
    e.preventDefault();
    const rival = modal.querySelector('#select-rival-liga').value;
    if (!rival) return alert('Selecciona un equipo rival');
    await crearPartidoLiga(new Date(), equipoUsuario.id, rival);
    modal.remove();
    document.body.style.overflow = '';
    alert('Partido de liga creado correctamente');
    cargarProximosPartidos();
  };
  // Crear partido AMISTOSO
  modal.querySelector('#form-crear-partido-amistoso').onsubmit = async (e) => {
    e.preventDefault();
    const slots = modal.querySelectorAll('#form-crear-partido-amistoso .court-player-slot');
    const jugadores = [usuarioActual.uid];
    slots.forEach((slot, idx) => {
      if (idx > 0 && slot.classList.contains('ocupado')) {
        const nombre = slot.querySelector('.jugador-nombre').textContent;
        const user = usuarios.find(u=>u.nombreUsuario===nombre||u.nombre===nombre||u.email===nombre);
        if (user) jugadores.push(user.id);
      }
    });
    if (jugadores.length<2) return alert('Debes añadir al menos un jugador más');
    await addDoc(collection(db, 'partidosAmistosos'), {
      jugadores,
      fecha: new Date(),
      creador: usuarioActual.uid,
      estado: 'pendiente',
      tipo: 'amistoso',
      maxJugadores: 4,
      createdAt: serverTimestamp()
    });
    modal.remove();
    document.body.style.overflow = '';
    alert('Partido amistoso creado correctamente');
    cargarProximosPartidos();
  };
  // Crear partido RETO
  modal.querySelector('#form-crear-partido-reto').onsubmit = async (e) => {
    e.preventDefault();
    const slots = modal.querySelectorAll('#form-crear-partido-reto .court-player-slot');
    const jugadores = [usuarioActual.uid];
    slots.forEach((slot, idx) => {
      if (idx > 0 && slot.classList.contains('ocupado')) {
        const nombre = slot.querySelector('.jugador-nombre').textContent;
        const user = usuarios.find(u=>u.nombreUsuario===nombre||u.nombre===nombre||u.email===nombre);
        if (user) jugadores.push(user.id);
      }
    });
    if (jugadores.length<2) return alert('Debes añadir al menos un jugador más');
    const fp = parseInt(modal.querySelector('#family-points-apuesta').value)||10;
    await addDoc(collection(db, 'partidosReto'), {
      jugadores,
      fecha: new Date(),
      creador: usuarioActual.uid,
      estado: 'pendiente',
      tipo: 'reto',
      maxJugadores: 4,
      familyPoints: fp,
      createdAt: serverTimestamp()
    });
    modal.remove();
    document.body.style.overflow = '';
    alert('Reto creado correctamente');
    cargarProximosPartidos();
  };
};

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error al establecer persistencia de sesión:', error);
});

document.addEventListener('DOMContentLoaded', () => {
  // Asignar eventos a los action-card de quick-actions
  const quickActions = document.querySelector('.quick-actions');
  if (!quickActions) return;
  const actionCards = quickActions.querySelectorAll('.action-card');
  if (actionCards.length >= 4) {
    actionCards[0].onclick = () => { window.abrirModalNuevoReto(); };
    // Reportar resultado
    actionCards[1].onclick = async () => {
      const partidos = await obtenerPartidosPendientesUsuario();
      if (!partidos.length) {
        crearModal('<h3>Partidos pendientes</h3><p>No tienes partidos pendientes para reportar resultado.</p><span class="close-modal" onclick="this.closest(\'.modal-quickaction\').remove()">&times;</span>');
        return;
      }
      let html = '<h3>Partidos pendientes</h3><ul>';
      partidos.forEach(p => {
        html += `<li><b>${p.local} vs ${p.visitante}</b><br><small>${p.fecha.toLocaleString('es-ES')}</small><br><button onclick=\"window.abrirModalResultadoQuick('${p.id}','${p.tipo}','${p.jornadaId||''}')\">Añadir resultado</button></li>`;
      });
      html += '</ul><span class="close-modal" onclick="this.closest(\'.modal-quickaction\').remove()">&times;</span>';
      crearModal(html);
    };
    // Notificaciones
    actionCards[2].onclick = () => {
      crearModal('<h3>Notificaciones</h3><p>No disponible, en breves estará.</p><span class="close-modal" onclick="this.closest(\'.modal-quickaction\').remove()">&times;</span>');
    };
    // Buscar jugador
    actionCards[3].onclick = async () => {
      const usuarios = await obtenerUsuariosParaBusqueda();
      let html = `<h3>Buscar jugador</h3><input type='text' id='buscador-usuario' placeholder='Buscar por nombre...'><div id='lista-usuarios-buscar'>`;
      usuarios.forEach(u => {
        html += `<div class='usuario-item' data-uid='${u.id}'>${u.nombreUsuario || u.nombre || u.email}</div>`;
      });
      html += `</div><span class="close-modal" onclick="this.closest(\'.modal-quickaction\').remove()">&times;</span>`;
      const modal = crearModal(html);
      const input = modal.querySelector('#buscador-usuario');
      const lista = modal.querySelector('#lista-usuarios-buscar');
      input.oninput = () => {
        const val = input.value.toLowerCase();
        lista.querySelectorAll('.usuario-item').forEach(div => {
          div.style.display = div.textContent.toLowerCase().includes(val) ? '' : 'none';
        });
      };
      lista.querySelectorAll('.usuario-item').forEach(div => {
        div.onclick = () => {
          window.location.href = `perfil-usuario.html?uid=${div.dataset.uid}`;
        };
      });
    };
  }
});