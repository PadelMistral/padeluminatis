// js/home.js
import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { crearNotificacion, notificarNuevoPartido } from './notificaciones.js';

// Elementos del DOM
const usernameElement = document.getElementById('username');
const partidosJugadosElement = document.getElementById('partidos-jugados');
const victoriasElement = document.getElementById('victorias');
const porcentajeElement = document.getElementById('porcentaje');
const tendenciaElement = document.getElementById('tendencia');
const localTeamNameElement = document.getElementById('local-team-name');
const visitorTeamNameElement = document.getElementById('visitor-team-name');
const matchDateElement = document.getElementById('match-date');

// Variables globales
let usuarioActual = null;
let modalNuevoReto = null;
let modalBuscarJugador = null;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeFirebaseService();

    const user = getCurrentUser();
    const userData = await getCurrentUserData();
    const userTeam = getUserTeam();

    if (!user || !userData || !userData.aprobado) {
      console.log('Usuario no autenticado, no aprobado o sin datos. Redirigiendo.');
      window.location.href = 'index.html';
      return;
    }

    // Actualizar nombre de usuario
    if (usernameElement) {
      usernameElement.textContent = userData.nombreUsuario || userData.nombre || userData.email.split('@')[0];
    }

    // Cargar estadísticas
    if (userTeam) {
      const statsDoc = await getDocument('estadisticas', userTeam.id);
      if (statsDoc) {
        if (partidosJugadosElement) partidosJugadosElement.textContent = statsDoc.partidosJugados || 0;
        if (victoriasElement) victoriasElement.textContent = statsDoc.victorias || 0;
        if (porcentajeElement) porcentajeElement.textContent = `${statsDoc.porcentaje || 0}%`;
        if (tendenciaElement) tendenciaElement.textContent = statsDoc.tendencia || '+0';
      }
    }

    // Variables globales
    usuarioActual = {
      ...user,
      ...userData
    };

    // Inicializar modales y cargar datos
    inicializarModales();
    cargarPartidosPendientes();
    cargarNotificaciones();
    configurarEventListeners();
    configurarFiltrosHome();
    cargarProximoPartido();

    // Establecer persistencia de sesión
    setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.error('Error al establecer persistencia de sesión:', error);
    });

  } catch (error) {
    console.error('Error general en home.js:', error);
    window.location.href = 'index.html';
  }
});

// Funciones de Firebase
function getCurrentUser() {
    return auth.currentUser;
}

async function getCurrentUserData() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        return null;
    }
}

async function initializeFirebaseService() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                resolve(user);
            } else {
                resolve(null);
            }
        }, reject);
    });
}

// Función para cargar los datos del usuario
async function cargarDatosUsuario(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Actualizar el nombre de usuario en la interfaz
            const usernameElements = document.querySelectorAll('.username');
            usernameElements.forEach(element => {
                element.textContent = userData.username || 'Usuario';
            });
            return userData;
        }
        return null;
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        return null;
    }
}

// Función para inicializar los modales
function inicializarModales() {
    // Crear el modal de nuevo reto
    modalNuevoReto = document.createElement('div');
    modalNuevoReto.className = 'modal';
    modalNuevoReto.id = 'modal-nuevo-reto';
    modalNuevoReto.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Crear Nuevo Reto</h2>
            <div class="tipo-partido-selector">
                <button class="btn-tipo active" data-tipo="liga">Liga</button>
                <button class="btn-tipo" data-tipo="amistoso">Amistoso</button>
            </div>
            <form id="form-nuevo-reto">
                <div class="form-group">
                    <label for="equipo-rival">Equipo Rival</label>
                    <select id="equipo-rival" required>
                        <option value="">Selecciona un equipo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="fecha-partido">Fecha del Partido</label>
                    <input type="datetime-local" id="fecha-partido" required>
                </div>
                <div class="form-group">
                    <label>Jugadores</label>
                    <div class="jugadores-grid">
                        <div class="jugador-slot" data-posicion="1">
                            <span>Jugador 1</span>
                        </div>
                        <div class="jugador-slot" data-posicion="2">
                            <span>Jugador 2</span>
                        </div>
                        <div class="jugador-slot" data-posicion="3">
                            <span>Jugador 3</span>
                        </div>
                        <div class="jugador-slot" data-posicion="4">
                            <span>Jugador 4</span>
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn-submit">Crear Reto</button>
            </form>
        </div>
    `;

    // Crear el modal de búsqueda de jugador
    modalBuscarJugador = document.createElement('div');
    modalBuscarJugador.className = 'modal';
    modalBuscarJugador.id = 'modal-buscar-jugador';
    modalBuscarJugador.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <h2>Buscar Jugador</h2>
            <div class="search-container">
                <input type="text" id="search-jugador" placeholder="Buscar jugador...">
                <select id="jugadores-list" size="5">
                    <option value="">Selecciona un jugador</option>
                </select>
            </div>
            <div class="jugador-detalles" style="display: none;">
                <div class="stats-container">
                    <div class="stat-item">
                        <div class="stat-value" id="partidos-jugados">0</div>
                        <div class="stat-label">Partidos Jugados</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="partidos-ganados">0</div>
                        <div class="stat-label">Partidos Ganados</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="winrate">0%</div>
                        <div class="stat-label">Winrate</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="nivel">0</div>
                        <div class="stat-label">Nivel</div>
                    </div>
                </div>
                <div class="ultimos-partidos">
                    <h3>Últimos Partidos</h3>
                    <div id="ultimos-partidos-list"></div>
                </div>
                <div class="mensaje-container">
                    <textarea id="mensaje-jugador" placeholder="Escribe un mensaje..."></textarea>
                    <button id="enviar-mensaje">Enviar Mensaje</button>
                </div>
            </div>
        </div>
    `;

    // Agregar los modales al DOM
    document.body.appendChild(modalNuevoReto);
    document.body.appendChild(modalBuscarJugador);

    // Configurar los event listeners
    configurarEventListeners();
}

function configurarEventListeners() {
    // Botón Nuevo Reto
    const btnNuevoReto = document.getElementById('btn-nuevo-reto');
    if (btnNuevoReto) {
        btnNuevoReto.addEventListener('click', () => {
            if (modalNuevoReto) {
                modalNuevoReto.style.display = 'flex';
                modalNuevoReto.classList.add('active');
                cargarEquipos();
            }
        });
    }

    // Botón Buscar Jugador
    const btnBuscarJugador = document.getElementById('btn-buscar-jugador');
    if (btnBuscarJugador) {
        btnBuscarJugador.addEventListener('click', () => {
            if (modalBuscarJugador) {
                modalBuscarJugador.style.display = 'flex';
                modalBuscarJugador.classList.add('active');
                cargarJugadores();
            }
        });
    }

    // Cerrar modales
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        });
    });

    // Selector de tipo de partido
    if (modalNuevoReto) {
        modalNuevoReto.querySelectorAll('.btn-tipo').forEach(btn => {
            btn.addEventListener('click', () => {
                modalNuevoReto.querySelectorAll('.btn-tipo').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // Formulario de nuevo reto
    const formNuevoReto = modalNuevoReto.querySelector('#form-nuevo-reto');
    if (formNuevoReto) {
        formNuevoReto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tipo = modalNuevoReto.querySelector('.btn-tipo.active').dataset.tipo;
            const fecha = new Date(modalNuevoReto.querySelector('#fecha').value);
            
            try {
                if (tipo === 'liga') {
                    const equipoLocal = modalNuevoReto.querySelector('#equipo-local').value;
                    const equipoVisitante = modalNuevoReto.querySelector('#equipo-visitante').value;
                    await crearPartidoLiga(fecha, equipoLocal, equipoVisitante);
                } else {
                    await crearPartidoAmistoso(fecha);
                }
                
                modalNuevoReto.style.display = 'none';
                modalNuevoReto.classList.remove('active');
                cargarPartidosPendientes();
            } catch (error) {
                console.error('Error al crear partido:', error);
                alert('Error al crear el partido. Por favor, inténtalo de nuevo.');
            }
        });
    }

    // Búsqueda de jugadores
    if (modalBuscarJugador) {
        const searchInput = modalBuscarJugador.querySelector('#search-jugador');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const jugadoresList = modalBuscarJugador.querySelector('#jugadores-list');
                if (jugadoresList) {
                    const jugadores = Array.from(jugadoresList.options);
                    jugadores.forEach(option => {
                        const nombre = option.text.toLowerCase();
                        option.style.display = nombre.includes(searchTerm) ? '' : 'none';
                    });
                }
            });
        }

        // Selección de jugador
        const jugadoresList = modalBuscarJugador.querySelector('#jugadores-list');
        if (jugadoresList) {
            jugadoresList.addEventListener('change', (e) => {
                const jugadorId = e.target.value;
                if (jugadorId) {
                    mostrarDetallesJugador(jugadorId);
                }
            });
        }

        // Enviar mensaje
        const btnEnviarMensaje = modalBuscarJugador.querySelector('#enviar-mensaje');
        if (btnEnviarMensaje) {
            btnEnviarMensaje.addEventListener('click', async () => {
                const mensaje = modalBuscarJugador.querySelector('#mensaje-jugador').value;
                const jugadorId = modalBuscarJugador.querySelector('#jugadores-list').value;
                
                if (mensaje && jugadorId) {
                    try {
                        await enviarMensaje(jugadorId, mensaje);
                        modalBuscarJugador.querySelector('#mensaje-jugador').value = '';
                        alert('Mensaje enviado correctamente');
                    } catch (error) {
                        console.error('Error al enviar mensaje:', error);
                        alert('Error al enviar el mensaje. Por favor, inténtalo de nuevo.');
                    }
                }
            });
        }
    }

    // Enlaces a otras páginas
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
}

async function cargarEquipos() {
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

async function cargarJugadores() {
    try {
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        const jugadoresList = document.getElementById('jugadores-list');
        
        if (jugadoresList) {
            jugadoresList.innerHTML = '';
            usuariosSnap.forEach(doc => {
                const usuario = doc.data();
                if (usuario.id !== usuarioActual.uid) { // No mostrar al usuario actual
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.text = usuario.nombreUsuario || usuario.nombre || usuario.email.split('@')[0];
                    jugadoresList.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Error al cargar jugadores:', error);
    }
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
        cargarPartidosPendientes();
    } catch (error) {
        console.error("Error al crear partido de liga:", error);
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
        cargarPartidosPendientes();
    } catch (error) {
        console.error("Error al crear partido amistoso:", error);
    }
}

async function mostrarDetallesJugador(jugadorId) {
    try {
        const jugadorDoc = await getDoc(doc(db, "usuarios", jugadorId));
        if (!jugadorDoc.exists()) return;

        const jugador = jugadorDoc.data();
        const detallesContainer = document.querySelector('.jugador-detalles');
        const statsContainer = detallesContainer.querySelector('.stats-container');
        const ultimosPartidosContainer = detallesContainer.querySelector('.ultimos-partidos');

        // Mostrar estadísticas
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Nombre</span>
                <span class="stat-value">${jugador.nombreUsuario || jugador.nombre || jugador.email.split('@')[0]}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Partidos Jugados</span>
                <span class="stat-value">${jugador.partidosJugados || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Victorias</span>
                <span class="stat-value">${jugador.victorias || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Porcentaje</span>
                <span class="stat-value">${jugador.porcentaje || 0}%</span>
            </div>
        `;

        // Cargar últimos partidos
        const partidosQuery = query(
            collection(db, "partidos"),
            where("jugadores", "array-contains", jugadorId),
            orderBy("fecha", "desc"),
            limit(5)
        );
        const partidosSnap = await getDocs(partidosQuery);

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
    } catch (error) {
        console.error('Error al mostrar detalles del jugador:', error);
    }
}

// Reemplaza la función cargarPartidosPendientes para mostrar todos los partidos pendientes (liga, amistoso, reto)
async function cargarPartidosPendientes() {
    const partidosContainer = document.getElementById('upcoming-matches-list');
    if (!partidosContainer) return;

    // Determinar filtro activo
    const filtro = document.querySelector('.pending-matches .toggle-btn.active')?.dataset.filter || 'mis-partidos';
    let userId = usuarioActual?.uid;
    let esAdmin = usuarioActual?.rol === 'Admin' || usuarioActual?.esAdmin;

    try {
        // Consultar las tres colecciones
        const [ligaSnap, amistosoSnap, retoSnap] = await Promise.all([
            getDocs(query(collection(db, 'partidos'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc'))),
            getDocs(query(collection(db, 'partidosAmistosos'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc'))),
            getDocs(query(collection(db, 'partidosReto'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc')))
        ]);

        let partidos = [];
        ligaSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'liga';
            partidos.push(partido);
        });
        amistosoSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'amistoso';
            partidos.push(partido);
        });
        retoSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'reto';
            partidos.push(partido);
        });

        // Ordenar por fecha
        partidos.sort((a, b) => a.fecha.toDate() - b.fecha.toDate());

        // Filtrar por usuario si no es admin y filtro es 'mis-partidos'
        if (!esAdmin && filtro === 'mis-partidos') {
            partidos = partidos.filter(p => {
                if (p.tipo === 'liga') {
                    return (p.equipoLocal === usuarioActual.equipoId || p.equipoVisitante === usuarioActual.equipoId || p.jugadores?.includes(userId));
                }
                return p.jugadores?.includes(userId);
            });
        }

        if (partidos.length === 0) {
            partidosContainer.innerHTML = '<p class="no-matches">No hay partidos pendientes</p>';
            return;
        }

        partidosContainer.innerHTML = '';
        partidos.forEach(partido => {
            let tipo = partido.tipo || 'liga';
            let nombreTipo = tipo === 'liga' ? 'LIGA' : tipo === 'amistoso' ? 'AMISTOSO' : 'RETO';
            let equipos = '';
            if (tipo === 'liga') {
                equipos = `${partido.equipoLocal} vs ${partido.equipoVisitante}`;
            } else {
                const nombres = (partido.jugadores || []).map(jid => typeof jid === 'string' ? jid : (jid.nombre || jid.displayName || 'Jugador')).join(' & ');
                equipos = nombres;
            }
            const partidoElement = document.createElement('div');
            partidoElement.className = 'match-item';
            partidoElement.innerHTML = `
                <div class="match-teams">
                    <span><span class="badge-tipo-partido ${tipo}">${nombreTipo}</span> ${equipos}</span>
                    <div class="match-time">
                        <i class="far fa-clock"></i>
                        ${partido.fecha.toDate().toLocaleString()}
                    </div>
                </div>
            `;
            partidosContainer.appendChild(partidoElement);
        });
    } catch (error) {
        console.error('Error al cargar partidos pendientes:', error);
        partidosContainer.innerHTML = '<p class="no-matches">Error al cargar los partidos</p>';
    }
}

// Nueva función para cargar el próximo partido (de cualquier tipo)
async function cargarProximoPartido() {
    const nextMatchContainer = document.getElementById('next-match');
    if (!nextMatchContainer) return;

    // Determinar filtro activo
    const filtro = document.querySelector('.next-match .toggle-btn.active')?.dataset.filter || 'mis-partidos';
    let userId = usuarioActual?.uid;
    let esAdmin = usuarioActual?.rol === 'Admin' || usuarioActual?.esAdmin;

    try {
        // Consultar las tres colecciones
        const [ligaSnap, amistosoSnap, retoSnap] = await Promise.all([
            getDocs(query(collection(db, 'partidos'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc'))),
            getDocs(query(collection(db, 'partidosAmistosos'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc'))),
            getDocs(query(collection(db, 'partidosReto'), where('estado', '==', 'pendiente'), orderBy('fecha', 'asc')))
        ]);

        let partidos = [];
        ligaSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'liga';
            partidos.push(partido);
        });
        amistosoSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'amistoso';
            partidos.push(partido);
        });
        retoSnap.forEach(doc => {
            const partido = doc.data();
            partido.id = doc.id;
            partido.tipo = 'reto';
            partidos.push(partido);
        });

        // Ordenar por fecha
        partidos.sort((a, b) => a.fecha.toDate() - b.fecha.toDate());

        // Filtrar por usuario si no es admin y filtro es 'mis-partidos'
        if (!esAdmin && filtro === 'mis-partidos') {
            partidos = partidos.filter(p => {
                if (p.tipo === 'liga') {
                    return (p.equipoLocal === usuarioActual.equipoId || p.equipoVisitante === usuarioActual.equipoId || p.jugadores?.includes(userId));
                }
                return p.jugadores?.includes(userId);
            });
        }

        if (partidos.length === 0) {
            nextMatchContainer.innerHTML = '<p class="no-matches">No hay partidos pendientes</p>';
            return;
        }

        // Mostrar el más próximo
        const partido = partidos[0];
        let tipo = partido.tipo || 'liga';
        let nombreTipo = tipo === 'liga' ? 'LIGA' : tipo === 'amistoso' ? 'AMISTOSO' : 'RETO';
        let equipos = '';
        if (tipo === 'liga') {
            equipos = `${partido.equipoLocal} vs ${partido.equipoVisitante}`;
        } else {
            const nombres = (partido.jugadores || []).map(jid => typeof jid === 'string' ? jid : (jid.nombre || jid.displayName || 'Jugador')).join(' & ');
            equipos = nombres;
        }
        nextMatchContainer.innerHTML = `
            <div class="match-item">
                <div class="match-teams">
                    <span><span class="badge-tipo-partido ${tipo}">${nombreTipo}</span> ${equipos}</span>
                    <div class="match-time">
                        <i class="far fa-clock"></i>
                        ${partido.fecha.toDate().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error al cargar el próximo partido:', error);
        nextMatchContainer.innerHTML = '<p class="no-matches">Error al cargar los partidos</p>';
    }
}

// Añade listeners a los botones de filtro para recargar los partidos
function configurarFiltrosHome() {
    document.querySelectorAll('#toggle-pending-filter, #toggle-pending-filter-all').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#toggle-pending-filter, #toggle-pending-filter-all').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cargarPartidosPendientes();
        });
    });
    document.querySelectorAll('#toggle-match-filter, #toggle-match-filter-all').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#toggle-match-filter, #toggle-match-filter-all').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cargarProximoPartido();
        });
    });
}

// Función para cargar notificaciones
function cargarNotificaciones() {
    const notificacionesContainer = document.querySelector('.notificaciones-container');
    if (!notificacionesContainer) return;

    suscribirNotificaciones(usuarioActual.uid, (notificaciones) => {
        notificacionesContainer.innerHTML = '';
        notificaciones.slice(0, 5).forEach(notif => {
            const notifElement = document.createElement('div');
            notifElement.className = `notificacion-item ${notif.leida ? 'leida' : ''}`;
            notifElement.innerHTML = `
                <div class="notificacion-contenido">
                    <span class="notificacion-mensaje">${notif.mensaje}</span>
                    <span class="notificacion-fecha">${notif.fecha.toDate().toLocaleString()}</span>
                </div>
            `;
            notificacionesContainer.appendChild(notifElement);

            if (!notif.leida) {
                notifElement.addEventListener('click', () => {
                    marcarNotificacionLeida(notif.id);
                });
            }
        });
    });
}