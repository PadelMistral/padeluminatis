import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Definición de logros base (puedes ampliar hasta 200+)
const LOGROS_BASE = [
  // Platino (Muy difíciles)
  { id: 'campeon_liga', nombre: 'Campeón de Liga', descripcion: 'Gana una liga completa.', tipo: 'platino', icono: 'fa-crown', max: 1 },
  { id: 'leyenda', nombre: 'Leyenda Padeluminati', descripcion: 'Alcanza el máximo ranking de la liga.', tipo: 'platino', icono: 'fa-diamond', max: 1 },
  { id: 'invicto_temporada', nombre: 'Temporada Inmaculada', descripcion: 'Termina una temporada sin perder ningún partido.', tipo: 'platino', icono: 'fa-shield-alt', max: 1 },
  { id: 'victorias_platino', nombre: 'Conquistador', descripcion: 'Gana 250 partidos oficiales.', tipo: 'platino', icono: 'fa-trophy', max: 250 },
  { id: 'duo_invencible', nombre: 'Dúo Invencible', descripcion: 'Gana 100 partidos con el mismo compañero.', tipo: 'platino', icono: 'fa-users', max: 100 },
  { id: 'maestro_sets', nombre: 'Maestro de Sets', descripcion: 'Gana 500 sets oficiales.', tipo: 'platino', icono: 'fa-layer-group', max: 500 },
  { id: 'supercampeon', nombre: 'Supercampeón', descripcion: 'Gana 25 torneos oficiales.', tipo: 'platino', icono: 'fa-medal', max: 25 },
  { id: 'remontadas_epicas', nombre: 'El Rey de las Remontadas', descripcion: 'Gana 25 partidos tras perder el primer set.', tipo: 'platino', icono: 'fa-rocket', max: 25 },
  { id: 'victorias_perfectas', nombre: 'Aniquilador', descripcion: 'Gana 15 partidos por 6-0, 6-0.', tipo: 'platino', icono: 'fa-star', max: 15 },
  
  // Oro (Difíciles)
  { id: 'amistosos_oro', nombre: 'Rey de los Amistosos', descripcion: 'Gana 50 partidos amistosos.', tipo: 'oro', icono: 'fa-handshake-angle', max: 50 },
  { id: 'retador_oro', nombre: 'Retador de Élite', descripcion: 'Gana 25 retos.', tipo: 'oro', icono: 'fa-bolt', max: 25 },
  { id: 'victima_oro', nombre: 'Némesis', descripcion: 'Gana 25 veces al mismo rival.', tipo: 'oro', icono: 'fa-skull-crossbones', max: 25 },
  { id: 'asistencia_perfecta', nombre: 'Compromiso Total', descripcion: 'Asiste a 50 partidos sin faltar.', tipo: 'oro', icono: 'fa-calendar-check', max: 50 },
  { id: 'pareja_oro', nombre: 'Pareja de Oro', descripcion: 'Gana 30 partidos con el mismo compañero.', tipo: 'oro', icono: 'fa-user-friends', max: 30 },
  { id: 'racha_oro', nombre: 'Imparable', descripcion: 'Gana 15 partidos seguidos.', tipo: 'oro', icono: 'fa-fire', max: 15 },
  { id: 'comunicador_oro', nombre: 'Socialité', descripcion: 'Envía 500 mensajes en el chat.', tipo: 'oro', icono: 'fa-comments', max: 500 },
  { id: 'finalista_torneo', nombre: 'Finalista', descripcion: 'Llega a la final de un torneo oficial.', tipo: 'oro', icono: 'fa-trophy', max: 1 },

  // Plata (Cuestan un poco)
  { id: 'partidos_plata', nombre: 'Jugador Consagrado', descripcion: 'Juega 50 partidos oficiales.', tipo: 'plata', icono: 'fa-table-tennis-paddle-ball', max: 50 },
  { id: 'racha_plata', nombre: 'En Racha', descripcion: 'Gana 7 partidos seguidos.', tipo: 'plata', icono: 'fa-fire', max: 7 },
  { id: 'comunicador_plata', nombre: 'Conversador', descripcion: 'Envía 250 mensajes en el chat.', tipo: 'plata', icono: 'fa-comments', max: 250 },
  { id: 'asistencia_plata', nombre: 'Constancia', descripcion: 'Asiste a 25 partidos seguidos.', tipo: 'plata', icono: 'fa-calendar-check', max: 25 },
  { id: 'pareja_plata', nombre: 'Buena Pareja', descripcion: 'Gana 15 partidos con el mismo compañero.', tipo: 'plata', icono: 'fa-user-friends', max: 15 },
  { id: 'semifinalista_torneo', nombre: 'Semifinalista', descripcion: 'Llega a la semifinal de un torneo.', tipo: 'plata', icono: 'fa-trophy', max: 1 },
  { id: 'amistosos_plata', nombre: 'Jugador Amistoso', descripcion: 'Juega 25 partidos amistosos.', tipo: 'plata', icono: 'fa-handshake', max: 25 },
  { id: 'sets_plata', nombre: 'Dominio de Sets', descripcion: 'Gana 25 sets seguidos.', tipo: 'plata', icono: 'fa-layer-group', max: 25 },

  // Bronce (Medio fáciles)
  { id: 'primera_victoria', nombre: '¡A la saca!', descripcion: 'Gana tu primer partido oficial.', tipo: 'bronce', icono: 'fa-trophy', max: 1 },
  { id: 'primer_partido', nombre: 'Rompiendo el hielo', descripcion: 'Juega tu primer partido.', tipo: 'bronce', icono: 'fa-circle', max: 1 },
  { id: 'primer_reto', nombre: 'Te reto', descripcion: 'Juega tu primer reto.', tipo: 'bronce', icono: 'fa-bolt', max: 1 },
  { id: 'amistoso_inicial', nombre: 'De buen rollo', descripcion: 'Juega tu primer partido amistoso.', tipo: 'bronce', icono: 'fa-handshake', max: 1 },
  { id: 'primer_set_ganado', nombre: 'Este es mío', descripcion: 'Gana tu primer set.', tipo: 'bronce', icono: 'fa-layer-group', max: 1 },
  { id: 'primer_mensaje', nombre: 'Hola Mundo', descripcion: 'Envía tu primer mensaje en el chat.', tipo: 'bronce', icono: 'fa-comment', max: 1 },
  { id: 'primera_racha', nombre: 'Calentando motores', descripcion: 'Gana 3 partidos seguidos.', tipo: 'bronce', icono: 'fa-fire', max: 3 },
  { id: 'primera_derrota', nombre: 'Se aprende más', descripcion: 'Pierde tu primer partido oficial.', tipo: 'bronce', icono: 'fa-thumbs-down', max: 1 }
];

// Datos de prueba para mostrar las barras de progreso
const DATOS_PRUEBA = {
  'campeon_liga': { progreso: 0, completado: false },
  'leyenda': { progreso: 0, completado: false },
  'invicto_temporada': { progreso: 0, completado: false },
  'victorias_platino': { progreso: 45, completado: false },
  'duo_invencible': { progreso: 78, completado: false },
  'maestro_sets': { progreso: 234, completado: false },
  'supercampeon': { progreso: 8, completado: false },
  'remontadas_epicas': { progreso: 12, completado: false },
  'victorias_perfectas': { progreso: 3, completado: false },
  
  'amistosos_oro': { progreso: 23, completado: false },
  'retador_oro': { progreso: 15, completado: false },
  'victima_oro': { progreso: 8, completado: false },
  'asistencia_perfecta': { progreso: 32, completado: false },
  'pareja_oro': { progreso: 18, completado: false },
  'racha_oro': { progreso: 12, completado: false },
  'comunicador_oro': { progreso: 156, completado: false },
  'finalista_torneo': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-15') },
  
  'partidos_plata': { progreso: 28, completado: false },
  'racha_plata': { progreso: 5, completado: false },
  'comunicador_plata': { progreso: 89, completado: false },
  'asistencia_plata': { progreso: 18, completado: false },
  'pareja_plata': { progreso: 9, completado: false },
  'semifinalista_torneo': { progreso: 1, completado: true, fechaCompletado: new Date('2024-02-20') },
  'amistosos_plata': { progreso: 12, completado: false },
  'sets_plata': { progreso: 15, completado: false },
  
  'primera_victoria': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-10') },
  'primer_partido': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-05') },
  'primer_reto': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-08') },
  'amistoso_inicial': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-03') },
  'primer_set_ganado': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-06') },
  'primer_mensaje': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-02') },
  'primera_racha': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-12') },
  'primera_derrota': { progreso: 1, completado: true, fechaCompletado: new Date('2024-01-07') }
};

function getUidFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('uid');
}

function agruparPorRareza(logros) {
  return {
    platino: logros.filter(l => l.tipo === 'platino'),
    oro: logros.filter(l => l.tipo === 'oro'),
    plata: logros.filter(l => l.tipo === 'plata'),
    bronce: logros.filter(l => l.tipo === 'bronce'),
  };
}

async function cargarLogrosUsuario(uid) {
  try {
    // Intenta cargar desde Firebase
    const logrosRef = collection(db, `usuarios/${uid}/logros`);
    const snapshot = await getDocs(logrosRef);
    const logrosUsuario = {};
    snapshot.forEach(doc => {
      logrosUsuario[doc.id] = doc.data();
    });
    
    // Si no hay datos en Firebase, usa los datos de prueba
    if (Object.keys(logrosUsuario).length === 0) {
      console.log('No hay datos en Firebase, usando datos de prueba');
      return DATOS_PRUEBA;
    }
    
    return logrosUsuario;
  } catch (error) {
    console.log('Error cargando logros, usando datos de prueba:', error);
    return DATOS_PRUEBA;
  }
}

// Función para actualizar progreso de logros
async function actualizarProgresoLogro(uid, logroId, nuevoProgreso, datosAdicionales = {}) {
  try {
    const logroRef = doc(db, `usuarios/${uid}/logros`, logroId);
    const logroDoc = await getDoc(logroRef);
    
    const logro = LOGROS_BASE.find(l => l.id === logroId);
    if (!logro) return;

    const progresoActual = logroDoc.exists() ? logroDoc.data().progreso || 0 : 0;
    const progresoFinal = Math.min(logro.max, progresoActual + nuevoProgreso);
    const completado = progresoFinal >= logro.max;
    
    const datosLogro = {
      progreso: progresoFinal,
      completado: completado,
      ultimaActualizacion: new Date(),
      ...datosAdicionales
    };

    if (completado && !logroDoc.exists()) {
      datosLogro.fechaCompletado = new Date();
    }

    await setDoc(logroRef, datosLogro, { merge: true });
    
    // Mostrar notificación si se completó
    if (completado && progresoActual < logro.max) {
      mostrarNotificacionLogro(logro);
    }
    
    return datosLogro;
  } catch (error) {
    console.error('Error actualizando logro:', error);
  }
}

// Función para mostrar notificación de logro completado
function mostrarNotificacionLogro(logro) {
  const notificacion = document.createElement('div');
  notificacion.className = 'notificacion-logro';
  notificacion.innerHTML = `
    <div class="notificacion-contenido">
      <i class="fas ${logro.icono}"></i>
      <div>
        <h3>¡Logro Desbloqueado!</h3>
        <p>${logro.nombre}</p>
      </div>
    </div>
  `;
  
  // Estilos para la notificación
  notificacion.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
    border: 1px solid ${getColorRareza(logro.tipo)};
    border-radius: 10px;
    padding: 1rem;
    color: white;
    z-index: 10000;
    animation: slideInRight 0.5s ease-out;
    box-shadow: 0 0 20px ${getColorRareza(logro.tipo)}40;
  `;
  
  document.body.appendChild(notificacion);
  
  setTimeout(() => {
    notificacion.style.animation = 'slideOutRight 0.5s ease-in';
    setTimeout(() => notificacion.remove(), 500);
  }, 3000);
}

function getColorRareza(tipo) {
  const colores = {
    platino: '#e5e4e2',
    oro: '#ffd700',
    plata: '#c0c0c0',
    bronce: '#cd7f32'
  };
  return colores[tipo] || '#ffffff';
}

// Función para detectar y actualizar logros automáticamente
async function detectarYActualizarLogros(uid, tipoEvento, datos) {
  const logrosAActualizar = [];
  
  switch (tipoEvento) {
    case 'partido_ganado':
      // Logros de victorias
      logrosAActualizar.push(
        { id: 'victorias_platino', progreso: 1 },
        { id: 'primera_victoria', progreso: 1 }
      );
      
      // Logros de racha
      const rachaActual = await obtenerRachaActual(uid);
      if (rachaActual >= 3) logrosAActualizar.push({ id: 'primera_racha', progreso: 1 });
      if (rachaActual >= 7) logrosAActualizar.push({ id: 'racha_plata', progreso: 1 });
      if (rachaActual >= 15) logrosAActualizar.push({ id: 'racha_oro', progreso: 1 });
      
      // Logros de pareja
      if (datos.companero) {
        logrosAActualizar.push({ id: 'pareja_plata', progreso: 1 });
        logrosAActualizar.push({ id: 'pareja_oro', progreso: 1 });
        logrosAActualizar.push({ id: 'duo_invencible', progreso: 1 });
      }
      
      // Logros de sets
      if (datos.setsGanados) {
        logrosAActualizar.push({ id: 'sets_plata', progreso: datos.setsGanados });
        logrosAActualizar.push({ id: 'maestro_sets', progreso: datos.setsGanados });
      }
      
      // Logros de partidos jugados
      logrosAActualizar.push({ id: 'partidos_plata', progreso: 1 });
      
      break;
      
    case 'partido_amistoso':
      logrosAActualizar.push(
        { id: 'amistoso_inicial', progreso: 1 },
        { id: 'amistosos_plata', progreso: 1 },
        { id: 'amistosos_oro', progreso: 1 }
      );
      break;
      
    case 'reto_jugado':
      logrosAActualizar.push(
        { id: 'primer_reto', progreso: 1 },
        { id: 'retador_oro', progreso: 1 }
      );
      break;
      
    case 'mensaje_enviado':
      logrosAActualizar.push(
        { id: 'primer_mensaje', progreso: 1 },
        { id: 'comunicador_plata', progreso: 1 },
        { id: 'comunicador_oro', progreso: 1 }
      );
      break;
      
    case 'set_ganado':
      logrosAActualizar.push(
        { id: 'primer_set_ganado', progreso: 1 },
        { id: 'sets_plata', progreso: 1 },
        { id: 'maestro_sets', progreso: 1 }
      );
      break;
      
    case 'partido_perdido':
      logrosAActualizar.push({ id: 'primera_derrota', progreso: 1 });
      break;
  }
  
  // Actualizar todos los logros
  for (const logro of logrosAActualizar) {
    await actualizarProgresoLogro(uid, logro.id, logro.progreso, datos);
  }
}

// Función para obtener la racha actual del usuario
async function obtenerRachaActual(uid) {
  try {
    const userRef = doc(db, 'usuarios', uid);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data().rachaActual || 0 : 0;
  } catch (error) {
    console.error('Error obteniendo racha:', error);
    return 0;
  }
}

// Función para inicializar el seguimiento de logros
function inicializarSeguimientoLogros(uid) {
  // Escuchar cambios en el chat para detectar mensajes
  const chatRef = collection(db, 'chat');
  onSnapshot(chatRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.data().uid === uid) {
        detectarYActualizarLogros(uid, 'mensaje_enviado', {
          mensaje: change.doc.data().mensaje,
          timestamp: change.doc.data().timestamp
        });
      }
    });
  });
  
  // Aquí podrías añadir más listeners para otros eventos
  // como partidos, retos, etc.
}

function renderLogros(logros, logrosUsuario, modoPropio, rareza) {
  const lista = document.getElementById('logros-lista');
  lista.innerHTML = '';
  logros.forEach(logro => {
    if (!modoPropio && (!logrosUsuario[logro.id] || !logrosUsuario[logro.id].completado)) return; // Solo mostrar conseguidos en modo público
    const datos = logrosUsuario[logro.id] || { progreso: 0, completado: false };
    const completado = datos.completado;
    const progreso = datos.progreso || 0;
    const fecha = datos.fechaCompletado;
    const porcentaje = Math.min(100, Math.round((progreso / logro.max) * 100));
    const card = document.createElement('div');
    card.className = `logro-card ${logro.tipo} ${completado ? 'completado' : 'no-completado'}`;
    card.innerHTML = `
      <div class="logro-cuerpo">
        <div class="logro-icono"><i class="fas ${logro.icono}"></i></div>
        <div class="logro-info">
            <div class="logro-nombre">${logro.nombre}</div>
            <div class="logro-desc">${logro.descripcion}</div>
            ${completado && fecha ? `<div class="logro-fecha">Desbloqueado: ${new Date(fecha).toLocaleDateString()}</div>` : ''}
        </div>
      </div>
      <div class="logro-progreso-container">
          <div class="logro-progreso-bar" style="width:${porcentaje}%;"></div>
          <div class="logro-progreso-texto">
            ${completado ? '<i class="fas fa-trophy"></i>' : `<span class="logro-porcentaje">${porcentaje}%</span>`}
            <span>${progreso}/${logro.max}</span>
          </div>
      </div>
    `;
    lista.appendChild(card);
  });
}

async function main() {
  const uidUrl = getUidFromUrl();
  let modoPropio = false;
  let uid = null;
  
  try {
    await new Promise(resolve => onAuthStateChanged(auth, user => {
      if (!user && !uidUrl) {
        // Si no hay usuario autenticado y no hay UID en URL, usar modo demo
        uid = 'demo-user';
        modoPropio = false;
        console.log('Modo demo activado');
      } else {
        uid = uidUrl || user.uid;
        modoPropio = !uidUrl || uidUrl === user.uid;
      }
      resolve();
    }));
  } catch (error) {
    console.log('Error de autenticación, usando modo demo:', error);
    uid = 'demo-user';
    modoPropio = false;
  }
  
  // Cargar logros del usuario
  const logrosUsuario = await cargarLogrosUsuario(uid);
  
  // Inicializar seguimiento automático si es el usuario propio
  if (modoPropio && uid !== 'demo-user') {
    inicializarSeguimientoLogros(uid);
  }
  
  // Agrupar logros por rareza
  const agrupados = agruparPorRareza(LOGROS_BASE);
  
  // Render inicial (platino)
  renderLogros(agrupados.platino, logrosUsuario, modoPropio, 'platino');
  
  // Tabs
  document.querySelectorAll('.logros-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.logros-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const rareza = tab.dataset.rareza;
      renderLogros(agrupados[rareza], logrosUsuario, modoPropio, rareza);
    });
  });
}

// Añadir estilos CSS para las notificaciones
const estilosNotificacion = document.createElement('style');
estilosNotificacion.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .notificacion-logro .notificacion-contenido {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .notificacion-logro .notificacion-contenido i {
    font-size: 2rem;
  }
  
  .notificacion-logro .notificacion-contenido h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  
  .notificacion-logro .notificacion-contenido p {
    margin: 0.25rem 0 0 0;
    opacity: 0.8;
  }
`;
document.head.appendChild(estilosNotificacion);

main(); 