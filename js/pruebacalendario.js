import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js';
import {
    doc, getDoc, collection, query, orderBy, getDocs,
    updateDoc, addDoc, deleteDoc, Timestamp, setDoc,
    increment, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js';
console.log("✅ pruebacalendario.js cargado correctamente");

// Estado de la aplicación
let usuarioActual = null;
let equipoUsuario = null;
let fechaActual = new Date();
let partidosAgrupados = {};
let vistaActual = 'tabla';
let selectedDateSlot = null;
let allUsers = [];
let allTeams = [];

// Configuración de temas
let configUsuario = {
    tema: 'dark',
    particulas: true,
    animaciones: true
};

// Franjas horarias
const FRANJAS_HORARIAS = [
    { inicio: '08:00', fin: '09:30' },
    { inicio: '09:30', fin: '11:00' },
    { inicio: '11:00', fin: '12:30' },
    { inicio: '12:30', fin: '14:00' },
    { inicio: '14:30', fin: '16:00' },
    { inicio: '16:00', fin: '17:30' },
    { inicio: '17:30', fin: '19:00' },
    { inicio: '19:00', fin: '20:30' },
    { inicio: '20:30', fin: '22:00' }
];

// Variables globales para filtros
let filtrosActivos = {
    usuario: '',
    tipo: '',
    fechaInicio: '',
    fechaFin: '',
    estado: ''
};

// MODAL DE SELECCIÓN DE USUARIO CON SELECT ESTILADO
let modalSeleccionUsuario = null;

document.addEventListener('DOMContentLoaded', () => {
    // cargarConfiguracion(); // Eliminada porque no está implementada
    if (configUsuario.particulas && document.getElementById('particles-js')) {
        inicializarParticulas();
    }

    // Eventos de navegación y vistas
    document.getElementById('btn-vista-tabla')?.addEventListener('click', () => cambiarVista('tabla'));
    document.getElementById('btn-vista-lista')?.addEventListener('click', () => cambiarVista('lista'));
    document.getElementById('btn-mes-anterior')?.addEventListener('click', () => {
        fechaActual.setDate(fechaActual.getDate() - 7);
        cargarCalendario();
    });
    document.getElementById('btn-mes-siguiente')?.addEventListener('click', () => {
        fechaActual.setDate(fechaActual.getDate() + 7);
        cargarCalendario();
    });
    document.getElementById('btn-configuracion')?.addEventListener('click', mostrarModalConfiguracion);

    // Eventos de modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-general');
            if (modal) {
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                modal.addEventListener('transitionend', function handler() {
                    modal.style.display = 'none';
                    modal.removeEventListener('transitionend', handler);
                });
            }
        });
    });

    // Eventos de formularios
    document.getElementById('form-crear-partido-liga')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await crearNuevoPartidoLiga();
    });

    document.getElementById('form-crear-partido-amistoso')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await crearNuevoPartidoAmistoso();
    });

    document.getElementById('form-crear-partido-reto')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await crearNuevoPartidoReto();
    });

    // Evento para guardar resultado desde el modal de resultados
    document.getElementById('form-resultados')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarResultado();
    });

    // Cambiar tipo de partido en modal
    document.querySelectorAll('.match-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.match-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Ocultar todos los formularios
            document.querySelectorAll('.match-form').forEach(form => {
                form.style.display = 'none';
                form.classList.remove('active');
            });
            // Mostrar el formulario correspondiente
            const formId = `form-crear-partido-${btn.dataset.type}`;
            const targetForm = document.getElementById(formId);
            if (targetForm) {
                targetForm.style.display = 'block';
                targetForm.classList.add('active');
                setTimeout(() => {
                    cargarDatosEnSelects();
                }, 100);
            }
            // CAMBIO DE FONDO DEL MODAL SEGÚN TIPO
            const modalContent = document.querySelector('#create-match-modal .modal-content');
            if (modalContent) {
                modalContent.classList.remove('partido-liga', 'partido-amistoso', 'partido-reto');
                if (btn.dataset.type === 'liga') {
                    modalContent.classList.add('partido-liga');
                } else if (btn.dataset.type === 'amistoso') {
                    modalContent.classList.add('partido-amistoso');
                } else if (btn.dataset.type === 'reto') {
                    modalContent.classList.add('partido-reto');
                }
            }
        });
    });

    // Verificar autenticación y cargar datos
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        // Si ya está logueado, no pedir login de nuevo
        usuarioActual = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
        };
        try {
            // Cargar datos extra del usuario (rol, esAdmin)
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                usuarioActual.rol = userData.rol;
                usuarioActual.esAdmin = userData.rol === 'Admin';
            }
            await cargarTodosLosUsuarios();
            await cargarTodosLosEquipos();
            await obtenerEquipoUsuario();
            await cargarCalendario();
            await cargarRivalesNoEnfrentados();
        } catch (error) {
            console.error('Error:', error);
            mostrarMensajeTemporal("Error de autenticación", "error");
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    });

    setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.error('Error al establecer persistencia de sesión:', error);
    });

    // Inicialización de campo de tenis en amistoso
    const formAmistoso = document.getElementById('form-crear-partido-amistoso');
    if (formAmistoso) {
        formAmistoso.addEventListener('reset', () => {
            setTimeout(() => {
                inicializarCampoTenis('amistoso');
                renderAddPlayerButtons('amistoso');
            }, 10);
        });
        inicializarCampoTenis('amistoso');
        renderAddPlayerButtons('amistoso');
        document.getElementById('btn-anadir-jugador-amistoso')?.addEventListener('click', () => {
            anadirJugadoresACampo('amistoso');
        });
    }
    // Inicialización de campo de tenis en reto
    const formReto = document.getElementById('form-crear-partido-reto');
    if (formReto) {
        formReto.addEventListener('reset', () => {
            setTimeout(() => {
                inicializarCampoTenis('reto');
                renderAddPlayerButtons('reto');
            }, 10);
        });
        inicializarCampoTenis('reto');
        renderAddPlayerButtons('reto');
        document.getElementById('btn-anadir-jugador-reto')?.addEventListener('click', () => {
            anadirJugadoresACampo('reto');
        });
    }
    
    // Evento para botón de filtros
    document.getElementById('btn-filtros')?.addEventListener('click', () => {
        mostrarModalFiltros();
    });
    
    // Evento para formulario de filtros
    document.getElementById('form-filtros')?.addEventListener('submit', (e) => {
        e.preventDefault();
        aplicarFiltros();
    });
    
    // Evento para limpiar filtros
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click', () => {
        limpiarFiltros();
    });
});

// FUNCIONES PRINCIPALES

async function cargarCalendario() {
    mostrarCarga(true);
    try {
        partidosAgrupados = {}; // Reset partidosAgrupados for a fresh load

        // Always fetch all league matches
        const ligaSnapshot = await getDocs(collection(db, "calendario"));

        // Process league matches
        for (const jornadaDoc of ligaSnapshot.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                const fecha = partido.fecha?.toDate();

                const equipoLocal = allTeams.find(e => e.id === partido.equipoLocal) || { id: partido.equipoLocal, nombre: 'Equipo Local' };
                const equipoVisitante = allTeams.find(e => e.id === partido.equipoVisitante) || { id: partido.equipoVisitante, nombre: 'Equipo Visitante' };

                const partidoData = {
                    id: partidoDoc.id,
                    jornadaId: jornadaDoc.id,
                    ...partido,
                    fecha,
                    equipoLocal,
                    equipoVisitante,
                    tipo: 'liga'
                };

                const fechaKey = fecha.toDateString();
                if (!partidosAgrupados[fechaKey]) partidosAgrupados[fechaKey] = [];
                partidosAgrupados[fechaKey].push(partidoData);
            }
        }

        let amistososSnapshot;
        if (vistaActual === 'tabla') {
            // Calculate start and end of the current week for table view
            const startOfWeek = new Date(fechaActual);
            startOfWeek.setDate(fechaActual.getDate() - fechaActual.getDay() + (fechaActual.getDay() === 0 ? -6 : 1));
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            const startTimestamp = Timestamp.fromDate(startOfWeek);
            const endTimestamp = Timestamp.fromDate(endOfWeek);

            // Fetch only friendly matches within the current week for table view
            amistososSnapshot = await getDocs(query(
                collection(db, "partidosAmistosos"),
                where("fecha", ">=", startTimestamp),
                where("fecha", "<=", endTimestamp)
            ));

             // Filter league matches for the current week for table view
             for (const fechaKey in partidosAgrupados) {
                const partidosDelDia = partidosAgrupados[fechaKey];
                partidosAgrupados[fechaKey] = partidosDelDia.filter(partido => {
                    const fecha = partido.fecha;
                    return fecha && fecha >= startOfWeek && fecha <= endOfWeek;
                });
                if (partidosAgrupados[fechaKey].length === 0) {
                    delete partidosAgrupados[fechaKey];
                }
            }


        } else { // vistaActual === 'lista'
            // Fetch all friendly matches for list view
            amistososSnapshot = await getDocs(collection(db, "partidosAmistosos"));
        }


        // Process friendly matches
        for (const partidoDoc of amistososSnapshot.docs) {
            const partido = partidoDoc.data();
            const fecha = partido.fecha?.toDate();
            if (!fecha) continue;

            const partidoData = {
                id: partidoDoc.id,
                ...partido,
                fecha,
                tipo: 'amistoso',
                jugadores: partido.jugadores || []
            };

            const fechaKey = fecha.toDateString();
            if (!partidosAgrupados[fechaKey]) partidosAgrupados[fechaKey] = [];
            partidosAgrupados[fechaKey].push(partidoData);
        }

        renderCalendario();
    } catch (error) {
        console.error("Error al cargar calendario:", error);
        mostrarMensajeTemporal("Error al cargar partidos", "error");
    } finally {
        mostrarCarga(false);
    }
}

async function crearNuevoPartidoLiga() {
    const selectRival = document.getElementById('select-rival-liga');
    const rivalId = selectRival.value;
    if (!rivalId) {
        mostrarMensajeTemporal('Debes seleccionar un equipo rival', 'error');
        return;
    }
    if (!equipoUsuario) {
        mostrarMensajeTemporal('No tienes un equipo asignado', 'error');
        return;
    }
    if (!selectedDateSlot) {
        mostrarMensajeTemporal('Debes seleccionar una celda del calendario', 'error');
        return;
    }
    try {
        // Buscar si ya existe la jornada para esa semana
        const fechaPartido = selectedDateSlot;
        const semanaInicio = new Date(fechaPartido);
        semanaInicio.setDate(fechaPartido.getDate() - fechaPartido.getDay() + (fechaPartido.getDay() === 0 ? -6 : 1));
        semanaInicio.setHours(0, 0, 0, 0);
        const jornadaId = `jornada_${semanaInicio.getTime()}`;
        const jornadaRef = doc(db, 'calendario', jornadaId);
        const jornadaSnap = await getDoc(jornadaRef);
        if (!jornadaSnap.exists()) {
            await setDoc(jornadaRef, {
                nombre: `Jornada ${semanaInicio.toLocaleDateString('es-ES')}`,
                fecha: semanaInicio,
                estado: 'pendiente'
            });
        }
        // Crear el partido en la jornada
        await addDoc(collection(db, `calendario/${jornadaId}/partidos`), {
            equipoLocal: equipoUsuario.id,
            equipoVisitante: rivalId,
            resultado: null,
            fecha: fechaPartido,
            estado: 'pendiente'
        });
        mostrarMensajeTemporal('Partido de liga creado exitosamente', 'success');
        cerrarModalAnimado(document.getElementById('create-match-modal'));
        await cargarCalendario();
    } catch (error) {
        console.error('Error creando partido de liga:', error);
        mostrarMensajeTemporal('Error al crear el partido', 'error');
    }
}

async function crearNuevoPartidoAmistoso() {
    const slots = document.querySelectorAll('#form-crear-partido-amistoso .court-player-slot');
    const jugadores = [];
    slots.forEach((slot) => {
        const uid = slot.dataset.uid;
        if (uid) {
            jugadores.push(uid);
        }
    });
    const nivelMinimo = parseInt(document.getElementById('nivel-minimo-amistoso')?.value) || 0;
    const nivelMaximo = parseInt(document.getElementById('nivel-maximo-amistoso')?.value) || 0;
    
    // Permitir crear partido aunque no haya 4 jugadores
    if (jugadores.length === 0) {
        mostrarMensajeTemporal('Debes añadir al menos un jugador para crear el partido', 'error');
        return;
    }
    
    try {
        const partidoData = {
            jugadores,
            resultado: null,
            fecha: Timestamp.fromDate(selectedDateSlot),
            creador: usuarioActual.uid,
            estado: 'pendiente',
            tipo: 'amistoso',
            maxJugadores: 4,
            nivelMinimo: nivelMinimo,
            nivelMaximo: nivelMaximo,
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "partidosAmistosos"), partidoData);
        mostrarMensajeTemporal('Partido amistoso creado exitosamente', 'success');
        // Cerrar el modal y limpiar
        cerrarModalAnimado(document.getElementById('create-match-modal'));
        inicializarCampoTenis('amistoso');
        renderAddPlayerButtons('amistoso');
        await cargarCalendario();
    } catch (error) {
        console.error('Error creando partido amistoso:', error);
        mostrarMensajeTemporal('Error al crear el partido', 'error');
    }
}

async function crearNuevoPartidoReto() {
    const familyPoints = parseInt(document.getElementById('family-points-apuesta').value);
    const nivelMinimo = parseInt(document.getElementById('nivel-minimo-reto')?.value) || 0;
    const nivelMaximo = parseInt(document.getElementById('nivel-maximo-reto')?.value) || 0;
    const slots = document.querySelectorAll('#form-crear-partido-reto .court-player-slot');
    const jugadores = [];
    slots.forEach((slot) => {
        const uid = slot.dataset.uid;
        if (uid) {
            jugadores.push(uid);
        }
    });
    
    // Permitir crear reto aunque no haya 4 jugadores
    if (jugadores.length === 0) {
        mostrarMensajeTemporal('Debes añadir al menos un jugador para crear el reto', 'error');
        return;
    }
    
    // Validar family points de los jugadores que ya están
    for (const uid of jugadores) {
        const user = allUsers.find(u => u.id === uid);
        if (!user || (user.familyPoints ?? 0) < familyPoints) {
            mostrarMensajeTemporal('Algún jugador no tiene suficientes Family Points.', 'error');
        return;
    }
    }
    
    try {
        const partidoData = {
            jugadores,
            familyPoints,
            fecha: Timestamp.fromDate(selectedDateSlot),
            creador: usuarioActual.uid,
            estado: 'pendiente',
            tipo: 'reto',
            maxJugadores: 4,
            nivelMinimo,
            nivelMaximo,
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "partidosReto"), partidoData);
        mostrarMensajeTemporal('Reto creado exitosamente', 'success');
        // Cerrar el modal y limpiar
        cerrarModalAnimado(document.getElementById('create-match-modal'));
        inicializarCampoTenis('reto');
        renderAddPlayerButtons('reto');
        await cargarCalendario();
    } catch (error) {
        console.error('Error creando reto:', error);
        mostrarMensajeTemporal('Error al crear el reto', 'error');
    }
}

async function cargarRivalesNoEnfrentados() {
    if (!equipoUsuario) return;

    try {
        const yaJugados = new Set();
        const calendarioSnap = await getDocs(collection(db, "calendario"));

        for (const jornada of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornada.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const p = partidoDoc.data();
                if (p.equipoLocal === equipoUsuario.id || p.equipoVisitante === equipoUsuario.id) {
                    const rival = p.equipoLocal === equipoUsuario.id ? p.equipoVisitante : p.equipoLocal;
                    yaJugados.add(rival);
                }
            }
        }

        const selectRival = document.getElementById('select-rival-liga');
        if (!selectRival) return;

        selectRival.innerHTML = '<option value="">Selecciona un rival</option>';

        allTeams.forEach(equipo => {
            if (equipo.id !== equipoUsuario.id && !yaJugados.has(equipo.id)) {
                const opt = document.createElement("option");
                opt.value = equipo.id;
                opt.textContent = equipo.nombre || `Equipo ${equipo.id}`;
                selectRival.appendChild(opt);
            }
        });

        if (selectRival.options.length <= 1) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "Ya te has enfrentado a todos los equipos";
            selectRival.appendChild(opt);
            selectRival.disabled = true;
        }
    } catch (error) {
        console.error("Error al cargar rivales:", error);
    }
}

async function obtenerEquipoUsuario() {
    if (!usuarioActual) return;

    const equiposSnap = await getDocs(collection(db, "equipos"));
    for (const doc of equiposSnap.docs) {
        const data = doc.data();
        if (data.jugadores?.includes(usuarioActual.uid)) {
            equipoUsuario = { id: doc.id, nombre: data.nombre || `Equipo ${doc.id}` };
            break;
        }
    }
}

// FUNCIONES DE RENDERIZADO

function cambiarVista(vista) {
    vistaActual = vista;
    
    // Actualizar botones de vista
    document.querySelectorAll('.btn-vista').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-vista-${vista}`).classList.add('active');
    
    // Ocultar todas las vistas
    document.getElementById('vista-tabla').classList.remove('vista-activa');
    document.getElementById('vista-tabla').classList.add('vista-oculta');
    document.getElementById('vista-lista').classList.remove('vista-activa');
    document.getElementById('vista-lista').classList.add('vista-oculta');
    
    // Mostrar la vista seleccionada
    document.getElementById(`vista-${vista}`).classList.remove('vista-oculta');
    document.getElementById(`vista-${vista}`).classList.add('vista-activa');
    
    // Mostrar/ocultar controles según la vista
    const controles = document.querySelector('.calendario-controls');
    const btnFiltros = document.getElementById('btn-filtros');
    
    if (vista === 'tabla') {
        controles.style.display = 'flex';
        btnFiltros.style.display = 'none';
        cargarCalendario(); // Recargar vista tabla con navegación
    } else {
        controles.style.display = 'none';
        btnFiltros.style.display = 'flex';
        cargarListaCompleta(); // Cargar lista completa sin navegación
    }
}

function renderCalendario() {
    if (vistaActual === 'tabla') {
        renderTablaCalendario();
    } else {
        renderListaCalendario();
    }
}

function renderTablaCalendario() {
    const semanasContainer = document.getElementById('semanas-calendario');
    if (!semanasContainer) {
        console.error('❌ No se encontró el contenedor semanas-calendario');
        return;
    }

    console.log('🔄 Renderizando tabla de calendario...');
    console.log('📅 Fecha actual:', fechaActual);
    console.log('📊 Partidos agrupados:', partidosAgrupados);

    semanasContainer.innerHTML = '<div class="loading-spinner"></div>';

    const primerDiaSemana = new Date(fechaActual);
    const diaSemana = fechaActual.getDay();
    const diferencia = diaSemana === 0 ? -6 : 1 - diaSemana;
    primerDiaSemana.setDate(fechaActual.getDate() + diferencia);

    const ultimoDiaSemana = new Date(primerDiaSemana);
    ultimoDiaSemana.setDate(primerDiaSemana.getDate() + 6);

    console.log('📅 Semana del', primerDiaSemana, 'al', ultimoDiaSemana);

    const mesActualElement = document.getElementById('mes-actual');
    if (mesActualElement) {
        mesActualElement.textContent =
            `${primerDiaSemana.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} - ` +
            `${ultimoDiaSemana.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }

    const tabla = document.createElement('table');
    tabla.className = 'tabla-calendario';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thHora = document.createElement('th');
    thHora.className = 'columna-hora';
    thHora.textContent = 'Hora';
    headerRow.appendChild(thHora);

    const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    diasSemana.forEach((dia, index) => {
        const th = document.createElement('th');
        th.className = 'columna-dia';
        const fechaDia = new Date(primerDiaSemana);
        fechaDia.setDate(primerDiaSemana.getDate() + index);
        th.innerHTML = `
            <div class="nombre-dia">${dia}</div>
            <div class="fecha-dia">${fechaDia.getDate()}</div>
        `;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    tabla.appendChild(thead);

    const tbody = document.createElement('tbody');

    FRANJAS_HORARIAS.forEach(franja => {
        const tr = document.createElement('tr');

        const tdHora = document.createElement('td');
        tdHora.className = 'columna-hora';
        tdHora.textContent = franja.inicio.substring(0, 5);
        tr.appendChild(tdHora);

        for (let i = 0; i < 7; i++) {
            const td = document.createElement('td');
            td.className = 'columna-dia';
            const fechaDia = new Date(primerDiaSemana);
            fechaDia.setDate(primerDiaSemana.getDate() + i);

            const fechaKey = fechaDia.toDateString();
            const partidosDia = partidosAgrupados[fechaKey] || [];

            const partidoEnFranja = partidosDia.find(partido => {
                if (!partido.fecha) return false;
                const horaPartido = partido.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                return horaPartido >= franja.inicio && horaPartido < franja.fin;
            });

            const slotElement = document.createElement('div');
            slotElement.className = 'slot-horario';

            if (partidoEnFranja) {
                let classTipo = '';
                let classEstado = '';
                let classParticipa = '';
                let contentHTML = '';
                let usuarioParticipa = false;
                let partidoJugado = false;

                // Determinar tipo
                if (partidoEnFranja.tipo === 'liga') {
                    classTipo = 'partido-liga';
                    // Comprobar si el usuario está en el equipo local o visitante
                    if (equipoUsuario && (partidoEnFranja.equipoLocal?.id === equipoUsuario.id || partidoEnFranja.equipoVisitante?.id === equipoUsuario.id)) {
                        usuarioParticipa = true;
                    }
                    // Comprobar si tiene resultado
                    partidoJugado = esResultadoJugado(partidoEnFranja.resultado);
                    // ... contenido ...
                    const nombreLocal = partidoEnFranja.equipoLocal?.nombre || 'Equipo Local';
                    const nombreVisitante = partidoEnFranja.equipoVisitante?.nombre || 'Equipo Visitante';
                    contentHTML = `
                        <div class="equipos-celda">
                            <div class="equipo-local">${nombreLocal}</div>
                            <div class="vs-celda">VS</div>
                            <div class="equipo-visitante">${nombreVisitante}</div>
                        </div>
                    `;
                } else if (partidoEnFranja.tipo === 'amistoso') {
                    classTipo = 'partido-amistoso';
                    // Comprobar si el usuario está en el array de jugadores o es el creador
                    if ((partidoEnFranja.jugadores || []).includes(usuarioActual?.uid) || partidoEnFranja.creador === usuarioActual?.uid) {
                        usuarioParticipa = true;
                    }
                    partidoJugado = esResultadoJugado(partidoEnFranja.resultado);
                    // ... contenido ...
                    const jugadores = partidoEnFranja.jugadores || [];
                    const jugadoresTexto = jugadores.length > 0 
                        ? jugadores.slice(0, 2).map(j => allUsers.find(u => u.id === j)?.displayName || 'Jugador').join(', ')
                        : 'Abierto';
                    contentHTML = `
                        <div class="equipos-celda">
                            <div class="equipo-local">Amistoso</div>
                            <div class="vs-celda">VS</div>
                            <div class="equipo-visitante">${jugadoresTexto}</div>
                        </div>
                    `;
                    // Añadir botón "Ver partida" si no tiene resultado
                    if (!partidoJugado) {
                        contentHTML += `
                            <button class="btn-ver-partida" data-partido-id="${partidoEnFranja.id}" data-tipo="amistoso" style="margin-top: 5px; padding: 2px 8px; font-size: 0.8em; background: #2A9D8F; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-users"></i> Ver partida
                            </button>
                        `;
                    }
                } else if (partidoEnFranja.tipo === 'reto') {
                    classTipo = 'partido-reto';
                    if ((partidoEnFranja.jugadores || []).includes(usuarioActual?.uid) || partidoEnFranja.creador === usuarioActual?.uid) {
                        usuarioParticipa = true;
                    }
                    partidoJugado = esResultadoJugado(partidoEnFranja.resultado);
                    const jugadores = partidoEnFranja.jugadores || [];
                    const jugadoresTexto = jugadores.length > 0 
                        ? jugadores.slice(0, 2).map(j => allUsers.find(u => u.id === j)?.displayName || 'Jugador').join(', ')
                        : 'Abierto';
                    contentHTML = `
                        <div class="equipos-celda">
                            <div class="equipo-local">Reto ${partidoEnFranja.familyPoints || 0}FP</div>
                            <div class="vs-celda">VS</div>
                            <div class="equipo-visitante">${jugadoresTexto}</div>
                        </div>
                    `;
                    // Añadir botón "Ver partida" si no tiene resultado
                    if (!partidoJugado) {
                        contentHTML += `
                            <button class="btn-ver-partida" data-partido-id="${partidoEnFranja.id}" data-tipo="reto" style="margin-top: 5px; padding: 2px 8px; font-size: 0.8em; background: #E76F51; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-fire"></i> Ver partida
                            </button>
                        `;
                    }
                }

                // Estado
                classEstado = partidoJugado ? 'partido-jugado' : 'partido-pendiente';
                // Participación
                classParticipa = usuarioParticipa ? 'usuario-participa' : '';

                slotElement.className += ` ${classTipo} ${classEstado} ${classParticipa}`;
                slotElement.innerHTML = contentHTML;
                slotElement.addEventListener('click', () => mostrarDetallesPartido(partidoEnFranja));
            } else if (franja.inicio === '14:00' && franja.fin === '14:30') {
                slotElement.className += ' descanso';
                slotElement.innerHTML = '<div class="texto-descanso">Descanso</div>';
            } else {
                slotElement.innerHTML = '<i class="fas fa-plus slot-vacio"></i>';
                slotElement.addEventListener('click', () => {
                    const hora = parseInt(franja.inicio.split(':')[0], 10);
                    const minutos = parseInt(franja.inicio.split(':')[1], 10);
                    const fechaSlot = new Date(fechaDia);
                    fechaSlot.setHours(hora, minutos, 0, 0);
                    selectedDateSlot = fechaSlot;
                    mostrarModalCrearPartido();
                });
            }

            td.appendChild(slotElement);
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });

    tabla.appendChild(tbody);
    semanasContainer.innerHTML = '';

    // Siempre mostrar la tabla, incluso sin partidos
    semanasContainer.appendChild(tabla);
    
    console.log('✅ Tabla renderizada correctamente');
}

function renderListaCalendario() {
    const listaContainer = document.getElementById('lista-partidos');
    if (!listaContainer) return;

    listaContainer.innerHTML = '<div class="loading-spinner"></div>';

    // Obtener todas las fechas con partidos y ordenarlas
    const fechasConPartidos = Object.keys(partidosAgrupados)
        .filter(fecha => partidosAgrupados[fecha].length > 0)
        .sort((a, b) => new Date(a) - new Date(b));

    listaContainer.innerHTML = '';

    if (fechasConPartidos.length === 0) {
        listaContainer.innerHTML = `
            <div class="sin-partidos">
                <i class="fas fa-calendar-times"></i>
                <p>No hay partidos programados</p>
            </div>
        `;
        return;
    }

    // Elimino el botón flotante de crear partido y solo muestro la lista de partidos
    // ... resto del código de renderizado de la lista ...
}

// FUNCIONES DE MODALES

function mostrarModalAnimado(modal) {
    if (!modal) return;
    console.log('[DEBUG] mostrarModalAnimado: mostrando modal', modal.id);
    // Eliminar clases y estilos de cierres previos
    modal.classList.remove('modal-exiting', 'show', 'modal-entering');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    // Añadir clase para animación de entrada
    modal.classList.add('modal-entering');
    // Trigger reflow para asegurar que la animación funcione
    modal.offsetHeight;
    // Añadir clase show para activar animaciones
    modal.classList.add('show');
    modal.classList.remove('modal-entering');
    // Añadir efecto de partículas de fondo
    añadirParticulasModal(modal);
    // Focus en el primer input si existe
    setTimeout(() => {
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 300);
}

function cerrarModalAnimado(modal) {
    if (!modal) return;
    
    // Añadir clase para animación de salida
    modal.classList.add('modal-exiting');
    
    // Remover clase show para activar animación de salida
    modal.classList.remove('show');
    
    // Esperar a que termine la animación
    modal.addEventListener('transitionend', function handler() {
        modal.style.display = 'none';
        modal.classList.remove('modal-exiting');
        modal.removeEventListener('transitionend', handler);
        
        // Limpiar partículas
        limpiarParticulasModal(modal);
    }, { once: true });
}

function añadirParticulasModal(modal) {
    // Crear contenedor de partículas
    const particulasContainer = document.createElement('div');
    particulasContainer.className = 'modal-particulas';
    particulasContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        overflow: hidden;
    `;
    
    // Añadir partículas flotantes
    for (let i = 0; i < 20; i++) {
        const particula = document.createElement('div');
        particula.className = 'particula-flotante';
        particula.style.cssText = `
            position: absolute;
            width: 4px;
            height: 4px;
            background: linear-gradient(45deg, var(--primary-color), #0088CC);
            border-radius: 50%;
            opacity: 0.3;
            animation: flotarParticula ${3 + Math.random() * 4}s infinite linear;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
        `;
        particulasContainer.appendChild(particula);
    }
    
    modal.appendChild(particulasContainer);
}

function limpiarParticulasModal(modal) {
    const particulasContainer = modal.querySelector('.modal-particulas');
    if (particulasContainer) {
        particulasContainer.remove();
    }
}

function mostrarModalCrearPartido() {
    console.log('[DEBUG] mostrarModalCrearPartido: llamada');
    const createMatchModal = document.getElementById('create-match-modal');
    if (!createMatchModal) {
        console.error('[DEBUG] No se encontró el modal de crear partido');
        return;
    }
    // Limpiar formularios
    document.querySelectorAll('.match-form').forEach(form => {
        form.classList.remove('active');
        form.reset();
    });
    // Activar formulario de liga por defecto
    document.getElementById('form-crear-partido-liga').classList.add('active');
    document.querySelector('.match-type-btn[data-type="liga"]').classList.add('active');
    // Cargar datos en los selects
    cargarDatosEnSelects();
    // Mostrar modal con animación
    mostrarModalAnimado(createMatchModal);
    // Añadir efecto de typing en el título
    const titulo = createMatchModal.querySelector('.modal-header h3');
    if (titulo) {
        titulo.style.opacity = '0';
        setTimeout(() => {
            titulo.style.transition = 'opacity 0.5s ease';
            titulo.style.opacity = '1';
        }, 200);
    }
    // En mostrarModalCrearPartido, al abrir el modal, pon el fondo de liga por defecto:
    const modalContent = document.querySelector('#create-match-modal .modal-content');
    if (modalContent) {
        modalContent.classList.remove('partido-liga', 'partido-amistoso', 'partido-reto');
        modalContent.classList.add('partido-liga');
    }
}

async function cargarDatosEnSelects() {
    try {
        // Cargar usuarios para selects de amistoso y reto
        const usuariosSnapshot = await getDocs(collection(db, "usuarios"));
        const usuarios = usuariosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Filtrar usuarios que no sean el usuario actual
        const usuariosFiltrados = usuarios.filter(u => u.id !== usuarioActual.uid);

        // Actualizar selects de amistoso y reto
        const selectAmistoso = document.getElementById('select-rivales-amistoso');
        const selectReto = document.getElementById('select-rivales-reto');
        
        if (selectAmistoso) {
            selectAmistoso.innerHTML = '<option value="">Selecciona jugadores</option>';
            usuariosFiltrados.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = `${usuario.nombreUsuario || usuario.displayName || 'Sin nombre'} (Nivel: ${usuario.nivel || 'N/A'}) - FP: ${usuario.familyPoints || 0}`;
                option.dataset.nivel = usuario.nivel;
                option.dataset.familyPoints = usuario.familyPoints || 0;
                selectAmistoso.appendChild(option);
            });
        }
        
        if (selectReto) {
            selectReto.innerHTML = '<option value="">Selecciona jugadores</option>';
            usuariosFiltrados.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = `${usuario.nombreUsuario || usuario.displayName || 'Sin nombre'} (Nivel: ${usuario.nivel || 'N/A'}) - FP: ${usuario.familyPoints || 0}`;
                option.dataset.nivel = usuario.nivel;
                option.dataset.familyPoints = usuario.familyPoints || 0;
                selectReto.appendChild(option);
            });
        }

        // Cargar equipos para select de liga - SOLO equipos que falten por jugar
        const rivalesNoEnfrentados = await obtenerRivalesNoEnfrentados();
        const selectLiga = document.getElementById('select-rival-liga');
        if (selectLiga) {
            selectLiga.innerHTML = '<option value="">Selecciona un equipo rival</option>';
            rivalesNoEnfrentados.forEach(equipo => {
                const option = document.createElement('option');
                option.value = equipo.id;
                option.textContent = equipo.nombre;
                selectLiga.appendChild(option);
            });
        }

        // Aplicar estilos según nivel
        aplicarEstilosNivel();

    } catch (error) {
        console.error('Error al cargar datos en selects:', error);
        mostrarMensajeTemporal("Error al cargar datos", "error");
    }
}

async function obtenerRivalesNoEnfrentados() {
    if (!equipoUsuario) return [];
    
    try {
        // Obtener todos los partidos de liga donde participó el equipo del usuario
        const partidosJugados = [];
        const ligaSnapshot = await getDocs(collection(db, "calendario"));
        
        for (const jornadaDoc of ligaSnapshot.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (partido.equipoLocal === equipoUsuario.id || partido.equipoVisitante === equipoUsuario.id) {
                    const rivalId = partido.equipoLocal === equipoUsuario.id ? partido.equipoVisitante : partido.equipoLocal;
                    partidosJugados.push(rivalId);
                }
            }
        }
        
        // Filtrar equipos que no han sido enfrentados
        const rivalesNoEnfrentados = allTeams.filter(equipo => 
            equipo.id !== equipoUsuario.id && !partidosJugados.includes(equipo.id)
        );
        
        console.log(`✅ ${rivalesNoEnfrentados.length} rivales no enfrentados encontrados`);
        return rivalesNoEnfrentados;
        
    } catch (error) {
        console.error('Error obteniendo rivales no enfrentados:', error);
        return [];
    }
}

function mostrarDetallesPartido(partido) {
    const modal = document.getElementById('modal-partido');
    if (!modal) return;
    
    const contenido = document.getElementById('modal-contenido-partido');
    if (!contenido) return;
    
    // Limpiar contenido anterior
    contenido.innerHTML = '';
    
    // Mostrar loading
    contenido.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>Cargando detalles del partido...</p>
        </div>
    `;
    
    // Mostrar modal
    mostrarModalAnimado(modal);
    
    // Generar contenido según el tipo de partido
    setTimeout(() => {
        if (partido.tipo === 'liga') {
            contenido.innerHTML = generarDetallesLiga(partido);
        } else if (partido.tipo === 'amistoso') {
            contenido.innerHTML = generarDetallesAmistoso(partido);
        } else if (partido.tipo === 'reto') {
            contenido.innerHTML = generarDetallesReto(partido);
        }
        
        // Añadir animaciones de entrada al contenido
        añadirAnimacionesContenido(contenido);
        
    }, 500);
}

function generarDetallesLiga(partido) {
    const jugadoresLocal = partido.jugadoresLocal || [];
    const jugadoresVisitante = partido.jugadoresVisitante || [];
    const esAdmin = usuarioActual && (usuarioActual.uid === 'admin' || usuarioActual.esAdmin);
    const esJugador = usuarioActual && (
        partido.creador === usuarioActual.uid || 
        jugadoresLocal.includes(usuarioActual.uid) || 
        jugadoresVisitante.includes(usuarioActual.uid)
    );
    const puedeEditar = esAdmin || esJugador;
    let html = `
        <div class="vs-container">
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${partido.equipoLocal?.nombre || 'Equipo Local'}</div>
          </div>
          <div class="match-info match-info-horizontal">
            <div class="match-date">
              <i class="fas fa-calendar"></i>
              ${partido.fecha ? partido.fecha.toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
            </div>
            <div class="match-vs">VS</div>
          </div>
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${partido.equipoVisitante?.nombre || 'Equipo Visitante'}</div>
          </div>
        </div>
        ${partido.resultado ? `
            <div class="resultado-container">
                <h4><i class="fas fa-trophy"></i> Resultado</h4>
                ${formatearResultado(partido.resultado, partido)}
            </div>
        ` : `
            <div class="sin-resultado">
                <i class="fas fa-clock"></i>
                <p>Partido pendiente</p>
            </div>
        `}
    `;
    // Botón eliminar solo para admin y partido pendiente
    if (esAdmin && !partido.resultado) {
        html += `
            <div style="display:flex;justify-content:center;margin-top:2rem;gap:1rem;">
                <button class="btn-eliminar-partido btn-eliminar-rojo" data-partido-id="${partido.id}" data-tipo="liga"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        `;
    }
    // Botón añadir resultado (admin o jugador, solo si pendiente)
    if (puedeEditar && !partido.resultado) {
        html += `
            <div style="display:flex;justify-content:center;margin-top:2.5rem;">
                <button class="btn-añadir-resultado" data-partido-id="${partido.id}">
                    <i class="fas fa-plus"></i> Añadir Resultado
                </button>
            </div>
        `;
    }
    return html;
}

function generarDetallesAmistoso(partido) {
    const jugadores = partido.jugadores || [];
    const nombresLocal = jugadores.slice(0,2).map(jugadorId => {
        const usuario = allUsers.find(u => u.id === jugadorId);
        return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
    });
    const nombresVisitante = jugadores.slice(2,4).map(jugadorId => {
        const usuario = allUsers.find(u => u.id === jugadorId);
        return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
    });
    const esAdmin = usuarioActual && (usuarioActual.uid === 'admin' || usuarioActual.esAdmin);
    const esCreador = usuarioActual && partido.creador === usuarioActual.uid;
    const esJugador = usuarioActual && ((partido.creador === usuarioActual.uid) || (partido.jugadores || []).includes(usuarioActual.uid));
    const puedeEditar = esAdmin || esJugador;
    const partidoCompleto = jugadores.length === 4;
    const usuarioYaEnPartido = jugadores.includes(usuarioActual?.uid);
    
    let html = `
        <div class="badge-tipo-partido amistoso" style="margin-bottom: 1rem;">AMISTOSO</div>
        <div class="vs-container">
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${nombresLocal.join(' & ')}</div>
          </div>
          <div class="match-info match-info-horizontal">
            <div class="match-date">
              <i class="fas fa-calendar"></i>
              ${partido.fecha ? partido.fecha.toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
            </div>
            <div class="match-vs">VS</div>
          </div>
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${nombresVisitante.join(' & ')}</div>
          </div>
        </div>
        ${partido.resultado ? `
            <div class="resultado-container">
                <h4><i class="fas fa-medal"></i> Resultado Final</h4>
                ${formatearResultado(partido.resultado, partido)}
            </div>
        ` : `
            <div class="sin-resultado">
                <i class="fas fa-clock"></i>
                <p>Partido pendiente de jugar</p>
            </div>
        `}
    `;
    
    // Botones según el rol y estado del partido
    if (!partido.resultado) {
        let botones = '';
        
        if (esCreador) {
            // Creador: Botón de editar partida
            botones += `<button class="btn-editar-partida" data-partido-id="${partido.id}" data-tipo="amistoso" style="background: #2A9D8F; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                <i class="fas fa-edit"></i> Editar partida
            </button>`;
        } else if (!partidoCompleto && !usuarioYaEnPartido) {
            // Usuario normal: Botón de unirse (solo si no está completo y no está ya en la partida)
            botones += `<button class="btn-unirse-partida" data-partido-id="${partido.id}" data-tipo="amistoso" style="background: #E9C46A; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                <i class="fas fa-user-plus"></i> Unirme a la partida
            </button>`;
        }
        
        // Botón de añadir resultado (solo si está completo)
        if (partidoCompleto && puedeEditar) {
            botones += `<button class="btn-añadir-resultado" data-partido-id="${partido.id}" style="background: #E76F51; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                    <i class="fas fa-plus"></i> Añadir Resultado
        </button>`;
        }
        
        // Botón eliminar (solo para creador)
        if (esCreador) {
            botones += `<button class="btn-eliminar-partido btn-eliminar-rojo" data-partido-id="${partido.id}" data-tipo="amistoso" style="margin: 0 5px;">
                <i class="fas fa-trash"></i> Eliminar
            </button>`;
        }
        
        if (botones) {
        html += `
                <div style="display:flex;justify-content:center;margin-top:2rem;gap:1rem;flex-wrap:wrap;">
                ${botones}
            </div>
        `;
        }
    }
    return html;
}

function generarDetallesReto(partido) {
    const jugadores = partido.jugadores || [];
    const nombresLocal = jugadores.slice(0,2).map(jugadorId => {
        const usuario = allUsers.find(u => u.id === jugadorId);
        return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
    });
    const nombresVisitante = jugadores.slice(2,4).map(jugadorId => {
        const usuario = allUsers.find(u => u.id === jugadorId);
        return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
    });
    const esAdmin = usuarioActual && (usuarioActual.uid === 'admin' || usuarioActual.esAdmin);
    const esCreador = usuarioActual && partido.creador === usuarioActual.uid;
    const esJugador = usuarioActual && ((partido.creador === usuarioActual.uid) || (partido.jugadores || []).includes(usuarioActual.uid));
    const puedeEditar = esAdmin || esJugador;
    const partidoCompleto = jugadores.length === 4;
    const usuarioYaEnPartido = jugadores.includes(usuarioActual?.uid);
    
    let html = `
        <div class="badge-tipo-partido reto" style="margin-bottom: 1rem;">RETO</div>
        <div class="vs-container">
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${nombresLocal.join(' & ')}</div>
          </div>
          <div class="match-info match-info-horizontal">
            <div class="match-date">
              <i class="fas fa-calendar"></i>
              ${partido.fecha ? partido.fecha.toLocaleString("es-ES", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'}
            </div>
            <div class="match-vs">VS</div>
          </div>
          <div class="team team-horizontal">
            <div class="team-logo"></div>
            <div class="team-name">${nombresVisitante.join(' & ')}</div>
          </div>
        </div>
        ${partido.resultado ? `
            <div class="resultado-container">
                <h4><i class="fas fa-trophy"></i> Ganador del Reto</h4>
                ${formatearResultado(partido.resultado, partido)}
            </div>
        ` : `
            <div class="sin-resultado">
                <i class="fas fa-clock"></i>
                <p>Reto pendiente de jugar</p>
            </div>
        `}
    `;
    
    // Botones según el rol y estado del partido
    if (!partido.resultado) {
        let botones = '';
        
        if (esCreador) {
            // Creador: Botón de editar partida
            botones += `<button class="btn-editar-partida" data-partido-id="${partido.id}" data-tipo="reto" style="background: #E76F51; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                <i class="fas fa-edit"></i> Editar partida
            </button>`;
        } else if (!partidoCompleto && !usuarioYaEnPartido) {
            // Usuario normal: Botón de unirse (solo si no está completo y no está ya en la partida)
            botones += `<button class="btn-unirse-partida" data-partido-id="${partido.id}" data-tipo="reto" style="background: #E9C46A; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                <i class="fas fa-user-plus"></i> Unirme a la partida
            </button>`;
        }
        
        // Botón de añadir resultado (solo si está completo)
        if (partidoCompleto && puedeEditar) {
            botones += `<button class="btn-añadir-resultado" data-partido-id="${partido.id}" style="background: #E76F51; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin: 0 5px;">
                    <i class="fas fa-plus"></i> Añadir Resultado
        </button>`;
        }
        
        // Botón eliminar (solo para creador)
        if (esCreador) {
            botones += `<button class="btn-eliminar-partido btn-eliminar-rojo" data-partido-id="${partido.id}" data-tipo="reto" style="margin: 0 5px;">
                <i class="fas fa-trash"></i> Eliminar
            </button>`;
        }
        
        if (botones) {
        html += `
                <div style="display:flex;justify-content:center;margin-top:2rem;gap:1rem;flex-wrap:wrap;">
                ${botones}
            </div>
        `;
        }
    }
    return html;
}

function generarSlotsJugadores(jugadores, maxSlots) {
    let html = '';
    for (let i = 0; i < maxSlots; i++) {
        const jugador = jugadores[i];
        if (jugador) {
            const usuario = allUsers.find(u => u.uid === jugador);
            html += `
                <div class="jugador-slot ocupado">
                    <div class="jugador-nombre">${usuario?.displayName || usuario?.email || 'Jugador'}</div>
                    ${partido.creador === jugador ? '<span class="badge-creador">Creador</span>' : ''}
                    ${usuarioActual?.uid === jugador ? '<span class="badge-usuario">Tú</span>' : ''}
                </div>
            `;
        } else {
            html += `
                <div class="jugador-slot vacio">
                    <i class="fas fa-user-plus"></i>
                    <div class="jugador-nombre">Slot Vacío</div>
                </div>
            `;
        }
    }
    return html;
}

function añadirAnimacionesContenido(contenido) {
    // Añadir event listeners para botones de añadir resultado
    const botonesResultado = contenido.querySelectorAll('.btn-añadir-resultado');
    botonesResultado.forEach(boton => {
        boton.addEventListener('click', (e) => {
            e.preventDefault();
            const partidoId = boton.dataset.partidoId;
            if (partidoId && typeof window.abrirModalResultado === 'function') {
                window.abrirModalResultado(partidoId, true); // true = forzar modal sets equipoLocal vs equipoVisitante
            } else {
                console.error('No se pudo abrir el modal de resultado:', partidoId);
            }
        });
    });
    
    // Event listener para botón de editar partida
    const botonesEditar = contenido.querySelectorAll('.btn-editar-partida');
    botonesEditar.forEach(boton => {
        boton.addEventListener('click', async (e) => {
            e.preventDefault();
            const partidoId = boton.dataset.partidoId;
            const tipo = boton.dataset.tipo;
            await mostrarModalEditarSlots(partidoId, tipo);
        });
    });
    
    // Event listener para botón de unirse a la partida
    const botonesUnirse = contenido.querySelectorAll('.btn-unirse-partida');
    botonesUnirse.forEach(boton => {
        boton.addEventListener('click', async (e) => {
            e.preventDefault();
            const partidoId = boton.dataset.partidoId;
            const tipo = boton.dataset.tipo;
            await unirseAPartida(partidoId, tipo);
        });
    });
    
    // Event listener para eliminar partido
    const botonesEliminar = contenido.querySelectorAll('.btn-eliminar-partido');
    botonesEliminar.forEach(boton => {
        boton.addEventListener('click', async (e) => {
            e.preventDefault();
            const partidoId = boton.dataset.partidoId;
            const tipo = boton.dataset.tipo;
            if (confirm('¿Estás seguro de que deseas eliminar este partido?')) {
                await eliminarPartidoAmistosoOReto(partidoId, tipo);
            } else {
                mostrarMensajeTemporal('No se ha borrado el partido', 'info');
            }
        });
    });
    // ... resto de animaciones existentes ...
    const elementos = contenido.querySelectorAll('*');
    elementos.forEach((elemento, index) => {
        elemento.style.opacity = '0';
        elemento.style.transform = 'translateY(20px)';
        elemento.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            elemento.style.opacity = '1';
            elemento.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

// Función para unirse automáticamente a una partida
async function unirseAPartida(partidoId, tipo) {
    try {
        // Obtener datos del partido
        let partido;
        if (tipo === 'amistoso') {
            const docSnap = await getDoc(doc(db, 'partidosAmistosos', partidoId));
            if (!docSnap.exists()) return mostrarMensajeTemporal('Partido no encontrado', 'error');
            partido = { id: partidoId, ...docSnap.data() };
        } else if (tipo === 'reto') {
            const docSnap = await getDoc(doc(db, 'partidosReto', partidoId));
            if (!docSnap.exists()) return mostrarMensajeTemporal('Partido no encontrado', 'error');
            partido = { id: partidoId, ...docSnap.data() };
        } else {
            return;
        }
        
        // Verificar que no esté completo
        if (partido.jugadores?.length >= 4) {
            mostrarMensajeTemporal('La partida ya está completa', 'error');
            return;
        }
        
        // Verificar que el usuario no esté ya en la partida
        if (partido.jugadores?.includes(usuarioActual.uid)) {
            mostrarMensajeTemporal('Ya estás en esta partida', 'info');
            return;
        }
        
        // Añadir usuario al primer slot vacío
        const jugadores = partido.jugadores || [];
        jugadores.push(usuarioActual.uid);
        
        // Actualizar en la base de datos
        if (tipo === 'amistoso') {
            await updateDoc(doc(db, 'partidosAmistosos', partidoId), { jugadores });
        } else if (tipo === 'reto') {
            await updateDoc(doc(db, 'partidosReto', partidoId), { jugadores });
        }
        
        mostrarMensajeTemporal('Te has unido a la partida', 'success');
        
        // Recargar el calendario para mostrar los cambios
        await cargarCalendario();
        
        // Cerrar el modal de detalles
        const modal = document.getElementById('modal-partido');
        if (modal) {
            cerrarModalAnimado(modal);
        }
        
    } catch (error) {
        console.error('Error al unirse a la partida:', error);
        mostrarMensajeTemporal('Error al unirse a la partida', 'error');
    }
}

// Función para eliminar partido amistoso o reto
async function eliminarPartidoAmistosoOReto(partidoId, tipo) {
    try {
        let ref;
        if (tipo === 'amistoso') {
            ref = doc(db, 'partidosAmistosos', partidoId);
        } else if (tipo === 'reto') {
            ref = doc(db, 'partidosReto', partidoId);
        } else if (tipo === 'liga') {
            // Buscar el partido en partidosAgrupados para obtener jornadaId
            let jornadaId = null;
            for (const fecha in partidosAgrupados) {
                const partidos = partidosAgrupados[fecha];
                const partido = partidos.find(p => p.id === partidoId);
                if (partido && partido.jornadaId) {
                    jornadaId = partido.jornadaId;
                    break;
                }
            }
            if (!jornadaId) throw new Error('No se encontró la jornada del partido de liga');
            ref = doc(db, `calendario/${jornadaId}/partidos/${partidoId}`);
        } else {
            throw new Error('Tipo de partido no válido');
        }
        await deleteDoc(ref);
        mostrarMensajeTemporal('Partido eliminado correctamente', 'success');
        setTimeout(() => {
            cerrarModalAnimado(document.getElementById('modal-partido'));
            if (vistaActual === 'lista') {
                cargarListaCompleta();
            } else {
                cargarCalendario();
            }
        }, 400);
    } catch (error) {
        console.error('Error eliminando partido:', error);
        mostrarMensajeTemporal('Error al eliminar partido', 'error');
    }
}

// Event listeners mejorados para modales
document.addEventListener('DOMContentLoaded', () => {
    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modalesAbiertos = document.querySelectorAll('.modal-general.show');
            modalesAbiertos.forEach(modal => {
                cerrarModalAnimado(modal);
            });
        }
    });
    
    // Cerrar modales haciendo clic fuera
    document.querySelectorAll('.modal-general').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModalAnimado(modal);
            }
        });
    });
    
    // Botones de cierre mejorados
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-general');
            if (modal) {
                cerrarModalAnimado(modal);
            }
        });
    });
    
    // Selector de tipo de partido con animaciones
    document.querySelectorAll('.match-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover activo de todos los botones
            document.querySelectorAll('.match-type-btn').forEach(b => {
                b.classList.remove('active');
                b.style.transform = 'scale(1)';
            });
            
            // Activar botón seleccionado
            btn.classList.add('active');
            btn.style.transform = 'scale(1.05)';
            
            // Ocultar todos los formularios
            document.querySelectorAll('.match-form').forEach(form => {
                form.classList.remove('active');
            });
            
            // Mostrar formulario correspondiente
            const tipo = btn.dataset.type;
            const formulario = document.getElementById(`form-crear-partido-${tipo}`);
            if (formulario) {
                setTimeout(() => {
                    formulario.classList.add('active');
                }, 200);
            }
        });
    });
});

// FUNCIONES AUXILIARES

function formatearResultado(resultado, partido) {
    if (!resultado) return '';
    const set1 = resultado.set1 || { puntos1: 0, puntos2: 0 };
    const set2 = resultado.set2 || { puntos1: 0, puntos2: 0 };
    const set3 = resultado.set3 || { puntos1: 0, puntos2: 0 };
    let sets = [set1, set2];
    // Determinar si hay ganador tras dos sets
    let setsGanadosLocal = 0;
    let setsGanadosVisitante = 0;
    if (set1.puntos1 > set1.puntos2) setsGanadosLocal++;
    else if (set1.puntos2 > set1.puntos1) setsGanadosVisitante++;
    if (set2.puntos1 > set2.puntos2) setsGanadosLocal++;
    else if (set2.puntos2 > set2.puntos1) setsGanadosVisitante++;
    let mostrarSet3 = true;
    if ((setsGanadosLocal === 2 || setsGanadosVisitante === 2) && set3.puntos1 === 0 && set3.puntos2 === 0) {
        mostrarSet3 = false;
    }
    const setsMostrar = mostrarSet3 ? [set1, set2, set3] : [set1, set2];
    let puntosLocal = 0, puntosVisitante = 0;
    setsMostrar.forEach(set => {
        puntosLocal += set.puntos1;
        puntosVisitante += set.puntos2;
    });
    // Recalcular sets ganados
    setsGanadosLocal = 0; setsGanadosVisitante = 0;
    setsMostrar.forEach(set => {
        if (set.puntos1 > set.puntos2) setsGanadosLocal++;
        else if (set.puntos2 > set.puntos1) setsGanadosVisitante++;
    });
    const ganador = setsGanadosLocal > setsGanadosVisitante ?
        (partido?.tipo === 'liga' ? partido.equipoLocal?.nombre || 'Equipo 1' : 'Equipo 1') :
        (partido?.tipo === 'liga' ? partido.equipoVisitante?.nombre || 'Equipo 2' : 'Equipo 2');
    const setsHTML = setsMostrar.map((s, i) =>
        `<div class="set-info">Set ${i + 1}: ${s.puntos1}-${s.puntos2}</div>`
    ).join("");
    return `
        <div class="marcador-final">${puntosLocal} - ${puntosVisitante}</div>
        <div class="sets-detalle">
            ${setsHTML}
        </div>
        <div class="ganador-partido">
            <i class="fas fa-trophy"></i>
            Ganador: ${ganador} (${setsGanadosLocal}-${setsGanadosVisitante})
        </div>`;
}

function generarJugadoresHTML(jugadores, tipoEquipo, opciones = {}) {
    // Modal: jugadores es array de IDs
    if (opciones.modal) {
        return jugadores?.map(jugadorId => {
            const usuario = allUsers.find(u => u.id === jugadorId) || {};
            return `
                <div class="jugador-modal-transparente">
                    <span class="jugador-nombre-modal">${usuario.nombreUsuario || usuario.displayName || 'Jugador'}</span>
                    <span class="jugador-nivel-modal">Nivel: ${usuario.nivel || 'N/A'}</span>
                </div>
            `;
        }).join('') || '';
    }
    // Tabla: jugadores es array de objetos
    return jugadores?.map(jugador => {
        let clases = 'jugador-slot ocupado';
        let badges = '';
        if (jugador.id === usuarioActual?.uid) {
            clases += ' es-usuario';
            badges += '<span class="badge-usuario">Tú</span>';
        }
        if (tipoEquipo === 'local') {
            clases += ' es-equipo-local';
            badges += '<span class="badge-equipo-local">Local</span>';
        } else {
            clases += ' es-equipo-visitante';
            badges += '<span class="badge-equipo-visitante">Visitante</span>';
        }
        return `
            <div class="${clases}">
                <span class="jugador-nombre">${jugador.nombre}</span>
                ${badges}
            </div>
        `;
    }).join('') || '';
}

// FUNCIONES AUXILIARES FALTANTES

async function cargarTodosLosUsuarios() {
    try {
        const usuariosSnapshot = await getDocs(collection(db, "usuarios"));
        allUsers = usuariosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ Cargados ${allUsers.length} usuarios`);
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        allUsers = [];
    }
}

async function cargarTodosLosEquipos() {
    try {
        const equiposSnapshot = await getDocs(collection(db, "equipos"));
        allTeams = equiposSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log(`✅ Cargados ${allTeams.length} equipos`);
    } catch (error) {
        console.error("Error al cargar equipos:", error);
        allTeams = [];
    }
}

function mostrarMensajeTemporal(mensaje, tipo = "info", duracion = 3000) {
    // Crear elemento de mensaje
    const mensajeElement = document.createElement('div');
    mensajeElement.className = `temp-message ${tipo}`;
    mensajeElement.textContent = mensaje;
    
    // Añadir al DOM
    document.body.appendChild(mensajeElement);
    
    // Mostrar con animación
    setTimeout(() => mensajeElement.classList.add('show'), 100);
    
    // Ocultar después del tiempo especificado
    setTimeout(() => {
        mensajeElement.classList.remove('show');
        setTimeout(() => {
            if (mensajeElement.parentNode) {
                mensajeElement.parentNode.removeChild(mensajeElement);
            }
        }, 300);
    }, duracion);
}

function mostrarCarga(mostrar) {
    const loadingElement = document.getElementById('loading-calendario');
    if (!loadingElement) return;
    
        if (mostrar) {
        loadingElement.style.display = 'flex';
        loadingElement.style.opacity = '0';
        setTimeout(() => {
            loadingElement.style.transition = 'opacity 0.3s ease';
            loadingElement.style.opacity = '1';
        }, 10);
        } else {
        loadingElement.style.transition = 'opacity 0.3s ease';
        loadingElement.style.opacity = '0';
        setTimeout(() => {
            loadingElement.style.display = 'none';
        }, 300);
    }
}

function inicializarParticulas() {
    // Esta función ya está manejada por particles-init.js
    console.log("✅ Partículas inicializadas");
}

// Función para validar nivel de usuario
function validarNivelUsuario(nivelUsuario, nivelMinimo) {
    if (!nivelMinimo) return true; // Sin restricción
    
    const niveles = ['Principiante', 'Intermedio', 'Avanzado', 'Experto'];
    const nivelUsuarioIndex = niveles.indexOf(nivelUsuario);
    const nivelMinimoIndex = niveles.indexOf(nivelMinimo);
    
    return nivelUsuarioIndex >= nivelMinimoIndex;
}

// Función para obtener color según nivel
function obtenerColorNivel(nivel) {
    const colores = {
        'Principiante': '#2A9D8F',
        'Intermedio': '#E9C46A', 
        'Avanzado': '#E76F51',
        'Experto': '#7209B7'
    };
    return colores[nivel] || '#94A3B8';
}

// Función para aplicar estilos a los selects según nivel
function aplicarEstilosNivel() {
    document.querySelectorAll('select option').forEach(option => {
        if (option.dataset.nivel) {
            const color = obtenerColorNivel(option.dataset.nivel);
            option.style.color = color;
            option.style.fontWeight = '600';
        }
    });
}

// Función para generar colores únicos para equipos
function generarColorEquipo(equipoId) {
    // Array de colores vibrantes para equipos
    const colores = [
        '#E9C46A', // Dorado
        '#2A9D8F', // Verde azulado
        '#E76F51', // Naranja
        '#264653', // Azul oscuro
        '#F4A261', // Naranja claro
        '#06D6A0', // Verde menta
        '#EF476F', // Rosa
        '#118AB2', // Azul
        '#073B4C', // Azul muy oscuro
        '#7209B7', // Púrpura
        '#3A0CA3', // Azul púrpura
        '#4361EE', // Azul medio
        '#4CC9F0', // Cian
        '#F72585', // Magenta
        '#B5179E'  // Púrpura oscuro
    ];
    
    // Generar un índice basado en el ID del equipo
    let hash = 0;
    for (let i = 0; i < equipoId.length; i++) {
        const char = equipoId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convertir a entero de 32 bits
    }
    
    // Usar el valor absoluto del hash para seleccionar el color
    const index = Math.abs(hash) % colores.length;
    return colores[index];
}

function inicializarCampoTenis(tipo) {
    const idCampo = tipo === 'amistoso' ? 'form-crear-partido-amistoso' : 'form-crear-partido-reto';
    const campo = document.querySelectorAll(`#${idCampo} .court-player-slot`);
    campo.forEach((c, idx) => {
        c.innerHTML = '';
        c.classList.add('vacio');
        c.removeAttribute('data-uid');
        // Fondo diferente para arriba y abajo
        if (idx < 2) {
            c.style.background = 'rgba(42,157,143,0.18)'; // azul
        } else {
            c.style.background = 'rgba(233,196,106,0.18)'; // dorado
        }
    });
    if (usuarioActual) {
        const user = allUsers.find(u => u.id === usuarioActual.uid) || usuarioActual;
        campo[0].innerHTML = `<div class='jugador-casilla-info'><div class='jugador-nombre destacado'>${user.nombreUsuario || user.displayName || 'Tú'}</div><div class='jugador-nivel'>Nivel: ${user.nivel || 'N/A'}</div></div>`;
        campo[0].classList.remove('vacio');
        campo[0].dataset.uid = usuarioActual.uid;
    }
    renderAddPlayerButtons(tipo);
}

function anadirJugadoresACampo(tipo) {
    const idSelect = tipo === 'amistoso' ? 'select-rivales-amistoso' : 'select-rivales-reto';
    const idCampo = tipo === 'amistoso' ? 'form-crear-partido-amistoso' : 'form-crear-partido-reto';
    const select = document.getElementById(idSelect);
    const campo = document.querySelectorAll(`#${idCampo} .court-player-slot`);
    const seleccionados = Array.from(select.selectedOptions).map(opt => opt.value);
    let uidsEnCampo = Array.from(campo).map(c => c.dataset.uid).filter(Boolean);
    for (const uid of seleccionados) {
        if (uidsEnCampo.length >= 4) break;
        if (uidsEnCampo.includes(uid) || uid === usuarioActual.uid) continue;
        for (let i = 1; i < 4; i++) {
            if (!campo[i].dataset.uid) {
                const user = allUsers.find(u => u.id === uid);
                if (user) {
                    campo[i].innerHTML = `<div class='jugador-casilla-info'><div class='jugador-nombre destacado'>${user.nombreUsuario || user.displayName || 'Jugador'}</div><div class='jugador-nivel'>Nivel: ${user.nivel || 'N/A'}</div> <button type='button' class='btn-quitar-jugador' data-uid='${uid}' style='margin-left:4px;font-size:0.9em;'>✕</button></div>`;
                    campo[i].classList.remove('vacio');
                    campo[i].dataset.uid = uid;
                    uidsEnCampo.push(uid);
                }
                break;
            }
        }
    }
    document.querySelectorAll(`#${idCampo} .btn-quitar-jugador`).forEach(btn => {
        btn.onclick = function() {
            const uid = btn.dataset.uid;
            const casilla = btn.closest('.court-player-slot');
            if (casilla && casilla.dataset.uid !== usuarioActual.uid) {
                casilla.innerHTML = '';
                casilla.classList.add('vacio');
                casilla.removeAttribute('data-uid');
            }
        };
    });
}

function colocarUsuarioEnSlot(tipo, pos, uid) {
    const idCampo = tipo === 'amistoso' ? 'form-crear-partido-amistoso' : 'form-crear-partido-reto';
    const campo = document.querySelectorAll(`#${idCampo} .court-player-slot`);
    const slot = campo[pos-1];
    if (!slot || slot.dataset.uid) return;
    const user = allUsers.find(u => u.id === uid);
    if (user) {
        slot.innerHTML = `
        <div class='jugador-casilla-info usuario-slot-premium'>
            <div class='jugador-nombre destacado' style="font-size:1.1em;font-weight:700;text-shadow:0 2px 6px #000;letter-spacing:0.5px;">${user.nombreUsuario || user.displayName || 'Jugador'}</div>
            <div class='jugador-nivel'>Nivel: <span>${user.nivel || 'N/A'}</span></div>
            <button type='button' class='btn-quitar-jugador' data-uid='${uid}' style='margin-left:4px;font-size:0.9em;background:rgba(0,0,0,0.15);border-radius:6px;padding:2px 8px;color:#fff;border:none;cursor:pointer;'>✕</button>
        </div>`;
        slot.classList.remove('vacio');
        slot.dataset.uid = uid;
        slot.querySelector('.btn-quitar-jugador').onclick = function() {
            slot.innerHTML = `<button type='button' class='btn-add-player' data-pos='${pos}'>+</button>`;
            delete slot.dataset.uid;
            renderAddPlayerButtons(tipo);
        };
    }
    renderAddPlayerButtons(tipo);
}

// Función para mostrar modal de filtros
function mostrarModalFiltros() {
    const modal = document.getElementById('modal-filtros');
    if (!modal) return;
    
    // Cargar usuarios en el select de filtros
    const selectUsuario = document.getElementById('filtro-usuario');
    if (selectUsuario) {
        selectUsuario.innerHTML = '<option value="">Todos los usuarios</option>';
        allUsers.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.id;
            option.textContent = usuario.nombreUsuario || usuario.displayName || 'Sin nombre';
            selectUsuario.appendChild(option);
        });
    }
    
    mostrarModalAnimado(modal);
}

// Función para aplicar filtros
function aplicarFiltros() {
    filtrosActivos = {
        usuario: document.getElementById('filtro-usuario').value,
        tipo: document.getElementById('filtro-tipo').value,
        fechaInicio: document.getElementById('filtro-fecha-inicio').value,
        fechaFin: document.getElementById('filtro-fecha-fin').value,
        estado: document.getElementById('filtro-estado').value
    };
    
    cerrarModalAnimado(document.getElementById('modal-filtros'));
    cargarListaCompleta();
}

// Función para limpiar filtros
function limpiarFiltros() {
    document.getElementById('filtro-usuario').value = '';
    document.getElementById('filtro-tipo').value = '';
    document.getElementById('filtro-fecha-inicio').value = '';
    document.getElementById('filtro-fecha-fin').value = '';
    document.getElementById('filtro-estado').value = '';
    
    filtrosActivos = {
        usuario: '',
        tipo: '',
        fechaInicio: '',
        fechaFin: '',
        estado: ''
    };
    
    cargarListaCompleta();
}

// Función para cargar lista completa de partidos
async function cargarListaCompleta() {
    mostrarCarga(true);
    try {
        const todosLosPartidos = [];
        
        // Cargar partidos de liga
        const ligaSnapshot = await getDocs(collection(db, "calendario"));
        for (const jornadaDoc of ligaSnapshot.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                const fecha = partido.fecha?.toDate();
                
                const equipoLocal = allTeams.find(e => e.id === partido.equipoLocal) || { id: partido.equipoLocal, nombre: 'Equipo Local' };
                const equipoVisitante = allTeams.find(e => e.id === partido.equipoVisitante) || { id: partido.equipoVisitante, nombre: 'Equipo Visitante' };
                
                todosLosPartidos.push({
                    id: partidoDoc.id,
                    jornadaId: jornadaDoc.id,
                    ...partido,
                    fecha,
                    equipoLocal,
                    equipoVisitante,
                    tipo: 'liga'
                });
            }
        }
        
        // Cargar partidos amistosos y retos
        const otrosPartidosSnapshot = await getDocs(collection(db, "partidos"));
        otrosPartidosSnapshot.docs.forEach(doc => {
            const partido = doc.data();
            const fecha = partido.fecha?.toDate();
            todosLosPartidos.push({
                id: doc.id,
                ...partido,
                fecha,
                tipo: partido.tipo || 'amistoso'
            });
        });
        
        // Aplicar filtros
        const partidosFiltrados = aplicarFiltrosAPartidos(todosLosPartidos);
        
        // Ordenar por fecha
        partidosFiltrados.sort((a, b) => b.fecha - a.fecha);
        
        renderListaCompleta(partidosFiltrados);
        
    } catch (error) {
        console.error('Error cargando lista completa:', error);
        mostrarMensajeTemporal("Error al cargar partidos", "error");
    } finally {
        mostrarCarga(false);
    }
}

// Función para aplicar filtros a partidos
function aplicarFiltrosAPartidos(partidos) {
    return partidos.filter(partido => {
        // Filtro por usuario
        if (filtrosActivos.usuario) {
            const participaUsuario = partido.jugadoresLocal?.includes(filtrosActivos.usuario) ||
                                   partido.jugadoresVisitante?.includes(filtrosActivos.usuario) ||
                                   partido.creador === filtrosActivos.usuario;
            if (!participaUsuario) return false;
        }
        
        // Filtro por tipo
        if (filtrosActivos.tipo && partido.tipo !== filtrosActivos.tipo) {
            return false;
        }
        
        // Filtro por fecha inicio
        if (filtrosActivos.fechaInicio && partido.fecha) {
            const fechaInicio = new Date(filtrosActivos.fechaInicio);
            if (partido.fecha < fechaInicio) return false;
        }
        
        // Filtro por fecha fin
        if (filtrosActivos.fechaFin && partido.fecha) {
            const fechaFin = new Date(filtrosActivos.fechaFin);
            fechaFin.setHours(23, 59, 59);
            if (partido.fecha > fechaFin) return false;
        }
        
        // Filtro por estado
        if (filtrosActivos.estado) {
            const estado = partido.resultado ? 'jugado' : 'pendiente';
            if (estado !== filtrosActivos.estado) return false;
        }
        
        return true;
    });
}

// Función para renderizar lista completa
function renderListaCompleta(partidos) {
    const listaContainer = document.getElementById('lista-partidos');
    if (!listaContainer) return;
    
    if (partidos.length === 0) {
        listaContainer.innerHTML = `
            <div class="sin-partidos">
                <i class="fas fa-calendar-times"></i>
                <p>No se encontraron partidos con los filtros aplicados</p>
                <button class="btn-crear-partido" onclick="mostrarModalCrearPartido()">
                    <i class="fas fa-plus"></i> Crear Partido
                </button>
            </div>
        `;
        return;
    }
    
    // Agrupar partidos por fecha
    const partidosPorFecha = {};
    partidos.forEach(partido => {
        const fecha = partido.fecha ? partido.fecha.toLocaleDateString('es-ES') : 'Sin fecha';
        if (!partidosPorFecha[fecha]) {
            partidosPorFecha[fecha] = [];
        }
        partidosPorFecha[fecha].push(partido);
    });
    
    let html = '';
    Object.keys(partidosPorFecha).sort((a, b) => new Date(b) - new Date(a)).forEach(fecha => {
        html += `
            <details class="dia-partidos" open>
                <summary class="dia-header">
                    <div class="dia-info">
                        <span class="dia-fecha">${fecha}</span>
                        <span class="dia-cantidad">${partidosPorFecha[fecha].length} partido${partidosPorFecha[fecha].length > 1 ? 's' : ''}</span>
                    </div>
                </summary>
                <div class="partidos-del-dia">
        `;
        
        partidosPorFecha[fecha].forEach(partido => {
            html += generarItemPartido(partido);
        });
        
        html += `
                </div>
            </details>
        `;
    });
    
    listaContainer.innerHTML = html;
}

// Función para generar item de partido en lista
function generarItemPartido(partido) {
    const fecha = partido.fecha ? partido.fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Sin hora';
    const puedeEditar = usuarioActual && (
        partido.creador === usuarioActual.uid || 
        partido.jugadoresLocal?.includes(usuarioActual.uid) || 
        partido.jugadoresVisitante?.includes(usuarioActual.uid) ||
        usuarioActual.uid === 'admin'
    );
    
    let equiposHTML = '';
    if (partido.tipo === 'liga') {
        equiposHTML = `
            <div class="equipo-local">${partido.equipoLocal?.nombre || 'Equipo Local'}</div>
            <div class="vs-lista">VS</div>
            <div class="equipo-visitante">${partido.equipoVisitante?.nombre || 'Equipo Visitante'}</div>
        `;
    } else {
        const jugadoresLocal = partido.jugadoresLocal || [];
        const jugadoresVisitante = partido.jugadoresVisitante || [];
        const nombresLocal = jugadoresLocal.map(id => {
            const user = allUsers.find(u => u.id === id);
            return user?.nombreUsuario || user?.displayName || 'Jugador';
        }).join(' y ');
        const nombresVisitante = jugadoresVisitante.map(id => {
            const user = allUsers.find(u => u.id === id);
            return user?.nombreUsuario || user?.displayName || 'Jugador';
        }).join(' y ');
        
        equiposHTML = `
            <div class="equipo-local">${nombresLocal || 'Pendiente'}</div>
            <div class="vs-lista">VS</div>
            <div class="equipo-visitante">${nombresVisitante || 'Pendiente'}</div>
        `;
    }
    
    const resultadoHTML = partido.resultado ? formatearResultado(partido.resultado, partido) : '';
    const btnResultado = puedeEditar && !partido.resultado ? 
        `<button class="btn-añadir-resultado" data-partido-id="${partido.id}">
            <i class="fas fa-plus"></i> Añadir Resultado
        </button>` : '';
    
    return `
        <div class="partido-item partido-${partido.tipo}" onclick="mostrarDetallesPartido(${JSON.stringify(partido).replace(/"/g, '&quot;')})">
            <div class="partido-hora">
                <i class="fas fa-clock"></i>
                ${fecha}
            </div>
            <div class="partido-equipos">
                ${equiposHTML}
            </div>
            ${resultadoHTML}
            ${btnResultado}
        </div>
    `;
}

// Función para abrir modal de resultado
function abrirModalResultado(partidoId, forzarSets) {
    const modal = document.getElementById('modal-resultados');
    if (!modal) return;
    const infoPartido = document.getElementById('info-partido-resultado');
    const partido = encontrarPartidoPorId(partidoId);
    if (!partido) return;
    
    // Mostrar nombres reales
    let nombreLocal = 'Equipo Local';
    let nombreVisitante = 'Equipo Visitante';
    
    if (partido.tipo === 'liga') {
        nombreLocal = partido.equipoLocal?.nombre || 'Equipo Local';
        nombreVisitante = partido.equipoVisitante?.nombre || 'Equipo Visitante';
    } else if (partido.tipo === 'amistoso' || partido.tipo === 'reto') {
        const jugadores = partido.jugadores || [];
        
        // Primeros 2 usuarios = Equipo Local
        const equipoLocal = jugadores.slice(0, 2);
        const nombresLocal = equipoLocal.map(jugadorId => {
            const usuario = allUsers.find(u => u.id === jugadorId);
            return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
        }).join(' y ');
        
        // Últimos 2 usuarios = Equipo Visitante
        const equipoVisitante = jugadores.slice(2, 4);
        const nombresVisitante = equipoVisitante.map(jugadorId => {
            const usuario = allUsers.find(u => u.id === jugadorId);
            return usuario?.displayName || usuario?.nombreUsuario || 'Jugador';
        }).join(' y ');
        
        nombreLocal = nombresLocal || 'Pendiente';
        nombreVisitante = nombresVisitante || 'Pendiente';
    }
    
    if (infoPartido) {
        infoPartido.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;font-size:1.08em;font-weight:700;">
                <span style="color:#E9C46A;">${nombreLocal}</span>
                <span style="color:#E76F51;font-size:1.2em;">VS</span>
                <span style="color:#2A9D8F;">${nombreVisitante}</span>
            </div>
            <small>${partido.fecha ? partido.fecha.toLocaleDateString('es-ES') : 'Sin fecha'}</small>
        `;
    }
    
    // Limpiar inputs sets
    document.getElementById('set1-local').value = '';
    document.getElementById('set1-visitante').value = '';
    document.getElementById('set2-local').value = '';
    document.getElementById('set2-visitante').value = '';
    document.getElementById('set3-local').value = '';
    document.getElementById('set3-visitante').value = '';
    document.getElementById('form-resultados').dataset.partidoId = partidoId;
    
    // Mostrar modal
    mostrarModalAnimado(modal);
}

// Función para guardar resultado
async function guardarResultado() {
    const partidoId = document.getElementById('form-resultados').dataset.partidoId;
    if (!partidoId) return;
    const set1Local = parseInt(document.getElementById('set1-local').value) || 0;
    const set1Visitante = parseInt(document.getElementById('set1-visitante').value) || 0;
    const set2Local = parseInt(document.getElementById('set2-local').value) || 0;
    const set2Visitante = parseInt(document.getElementById('set2-visitante').value) || 0;
    const set3Local = parseInt(document.getElementById('set3-local').value) || 0;
    const set3Visitante = parseInt(document.getElementById('set3-visitante').value) || 0;
    const resultado = {
        set1: { puntos1: set1Local, puntos2: set1Visitante },
        set2: { puntos1: set2Local, puntos2: set2Visitante }
    };
    if (set3Local > 0 || set3Visitante > 0) {
        resultado.set3 = { puntos1: set3Local, puntos2: set3Visitante };
    }
    resultado.fechaGuardado = serverTimestamp();
    try {
        const partido = encontrarPartidoPorId(partidoId);
        if (!partido) throw new Error('Partido no encontrado');
        if (partido.tipo === 'liga') {
            await updateDoc(doc(db, `calendario/${partido.jornadaId}/partidos/${partidoId}`), {
                resultado: resultado
            });
        } else {
            await updateDoc(doc(db, "partidos", partidoId), {
                resultado: resultado
            });
        }
        cerrarModalAnimado(document.getElementById('modal-resultados'));
        mostrarMensajeTemporal("Resultado guardado correctamente", "success");
        if (vistaActual === 'lista') {
            cargarListaCompleta();
        } else {
            cargarCalendario();
        }
    } catch (error) {
        console.error('Error guardando resultado:', error);
        mostrarMensajeTemporal("Error al guardar resultado", "error");
    }
}

// Función para encontrar partido por ID
function encontrarPartidoPorId(partidoId) {
    for (const fecha in partidosAgrupados) {
        const partidos = partidosAgrupados[fecha];
        if (Array.isArray(partidos)) {
            const partido = partidos.find(p => p.id === partidoId);
            if (partido) return partido;
        }
    }
    return null;
}

// En renderAddPlayerButtons, añade un botón + global al lado del label de 'Añadir usuarios al partido' solo si hay slots vacíos
function renderAddPlayerButtons(tipo) {
    const idCampo = tipo === 'amistoso' ? 'form-crear-partido-amistoso' : 'form-crear-partido-reto';
    const campo = document.querySelectorAll(`#${idCampo} .court-player-slot`);
    campo.forEach((slot, idx) => {
        if (!slot.dataset.uid) {
            slot.innerHTML = '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-add-player';
            btn.setAttribute('data-pos', idx+1);
            btn.innerHTML = '+';
            btn.onclick = function() {
                // Solo el creador o el propio usuario pueden añadir
                if (esCreadorPartidoActual() || usuarioActual.uid) {
                abrirModalSeleccionUsuario(tipo, idx+1);
                } else {
                    mostrarMensajeTemporal('No tienes permiso para añadir jugadores', 'error');
                }
            };
            slot.appendChild(btn);
        } else {
            // Si el usuario es el que está en el slot, mostrar X para salirse
            if (slot.dataset.uid === usuarioActual.uid) {
                const btnQuitar = document.createElement('button');
                btnQuitar.type = 'button';
                btnQuitar.className = 'btn-quitar-jugador';
                btnQuitar.innerHTML = '✕';
                btnQuitar.onclick = function() {
                    slot.innerHTML = '';
                    slot.classList.add('vacio');
                    slot.removeAttribute('data-uid');
                    renderAddPlayerButtons(tipo);
                };
                slot.appendChild(btnQuitar);
            } else if (esCreadorPartidoActual()) {
                // Si es el creador, puede quitar a cualquier usuario
                const btnQuitar = document.createElement('button');
                btnQuitar.type = 'button';
                btnQuitar.className = 'btn-quitar-jugador';
                btnQuitar.innerHTML = '✕';
                btnQuitar.onclick = function() {
                    slot.innerHTML = '';
                    slot.classList.add('vacio');
                    slot.removeAttribute('data-uid');
                    renderAddPlayerButtons(tipo);
                };
                slot.appendChild(btnQuitar);
            }
        }
    });
    // El botón de crear partido siempre debe estar habilitado
    // Ya no validamos que haya 4 slots llenos para crear el partido
}

function abrirModalSeleccionUsuario(tipo, pos) {
    if (modalSeleccionUsuario) {
        modalSeleccionUsuario.remove();
        modalSeleccionUsuario = null;
    }
    modalSeleccionUsuario = document.createElement('div');
    modalSeleccionUsuario.className = 'modal-general modal-seleccion-usuario';
    modalSeleccionUsuario.innerHTML = `
        <div class="modal-content" style="min-width:340px;max-width:95vw;">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> Seleccionar usuario</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="lista-usuarios-modal"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modalSeleccionUsuario);
    modalSeleccionUsuario.querySelector('.close-modal').onclick = () => {
        modalSeleccionUsuario.style.opacity = '0';
        setTimeout(() => modalSeleccionUsuario.remove(), 200);
    };
    // Llenar lista de usuarios elegantes
    const lista = modalSeleccionUsuario.querySelector('.lista-usuarios-modal');
    lista.innerHTML = '';
    const idCampo = tipo === 'amistoso' ? 'form-crear-partido-amistoso' : 'form-crear-partido-reto';
    const slots = document.querySelectorAll(`#${idCampo} .court-player-slot`);
    allUsers.forEach(user => {
        let yaSeleccionado = false;
        slots.forEach(slot => {
            if (slot.dataset.uid === user.id) yaSeleccionado = true;
        });
        if (yaSeleccionado) return;
        const div = document.createElement('div');
        div.className = 'usuario-modal-item premium-fly';
        div.innerHTML = `
            <span class='nombre-usuario-modal' style='color:#2A9D8F;font-weight:800;font-size:1.13em;'>${user.nombreUsuario || user.displayName || user.email}</span>
            <span class='nivel-usuario-modal' style='color:#E9C46A;font-weight:700;font-size:1.05em;margin-left:14px;'>Nivel: ${user.nivel || 'N/A'}</span>
        `;
        div.onclick = () => {
            // Animación de vuelo
            const rectOrigen = div.getBoundingClientRect();
            const slot = document.querySelectorAll(`#${idCampo} .court-player-slot`)[pos-1];
            const rectDestino = slot.getBoundingClientRect();
            // Clonar y animar
            const flyDiv = div.cloneNode(true);
            flyDiv.style.position = 'fixed';
            flyDiv.style.left = rectOrigen.left + 'px';
            flyDiv.style.top = rectOrigen.top + 'px';
            flyDiv.style.width = rectOrigen.width + 'px';
            flyDiv.style.zIndex = 99999;
            flyDiv.style.transition = 'all 0.7s cubic-bezier(.4,1.6,.6,1)';
            flyDiv.style.pointerEvents = 'none';
            document.body.appendChild(flyDiv);
            setTimeout(() => {
                flyDiv.style.left = rectDestino.left + 'px';
                flyDiv.style.top = rectDestino.top + 'px';
                flyDiv.style.width = rectDestino.width + 'px';
                flyDiv.style.opacity = '0.7';
                flyDiv.style.transform = 'scale(0.85)';
            }, 10);
            setTimeout(() => {
                document.body.removeChild(flyDiv);
                colocarUsuarioEnSlot(tipo, pos, user.id);
                modalSeleccionUsuario.style.opacity = '0';
                setTimeout(() => modalSeleccionUsuario.remove(), 200);
            }, 750);
        };
        lista.appendChild(div);
    });
    setTimeout(() => {
        modalSeleccionUsuario.style.opacity = '1';
        modalSeleccionUsuario.style.visibility = 'visible';
        modalSeleccionUsuario.style.display = 'flex';
    }, 10);
}

// Hacer la función disponible globalmente
window.abrirModalResultado = abrirModalResultado;

// Nueva función auxiliar para saber si un resultado es válido (al menos un set no es 0-0)
function esResultadoJugado(resultado) {
    if (!resultado) return false;
    
    // Verificar si es un objeto válido
    if (typeof resultado !== 'object' || resultado === null) return false;
    
    const sets = Object.values(resultado);
    return sets.some(set => {
        // Verificar que set sea un objeto válido con las propiedades necesarias
        if (!set || typeof set !== 'object' || set === null) return false;
        
        const puntos1 = set.puntos1 || 0;
        const puntos2 = set.puntos2 || 0;
        return puntos1 !== 0 || puntos2 !== 0;
    });
}

// Al final del archivo, añade el CSS para el botón eliminar solo si no existe ya
if (!document.getElementById('estilo-btn-eliminar-rojo')) {
  const estiloEliminar = document.createElement('style');
  estiloEliminar.id = 'estilo-btn-eliminar-rojo';
  estiloEliminar.innerHTML = `
.btn-eliminar-rojo {
  background: #e74c3c !important;
  color: #fff !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 0.6em 1.2em !important;
  font-weight: bold !important;
  margin-left: 0.5em;
  transition: background 0.2s;
  box-shadow: 0 2px 8px rgba(231,76,60,0.08);
  cursor: pointer;
}
.btn-eliminar-rojo:hover {
  background: #c0392b !important;
}
`;
  document.head.appendChild(estiloEliminar);
}

// Añadir estilos para la badge de tipo de partido
if (!document.getElementById('estilo-badge-tipo-partido')) {
  const estiloBadge = document.createElement('style');
  estiloBadge.id = 'estilo-badge-tipo-partido';
  estiloBadge.innerHTML = `
.badge-tipo-partido {
  display: inline-block;
  margin-left: 10px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
  vertical-align: middle;
}
.badge-tipo-partido.amistoso {
  background: #2A9D8F;
  color: #fff;
}
.badge-tipo-partido.reto {
  background: #E76F51;
  color: #fff;
}
`;
  document.head.appendChild(estiloBadge);
}

// Función auxiliar para saber si el usuario actual es el creador del partido en edición
function esCreadorPartidoActual() {
    // Aquí deberías guardar el id del partido en edición y comparar con usuarioActual.uid
    // Por simplicidad, asumimos que si el usuario abrió el modal de crear, es el creador
    return true;
}



// 2. Delegar evento para abrir el modal de edición de slots
// (al final del DOMContentLoaded o tras renderizar partidos)
document.body.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-ver-partida')) {
        const partidoId = e.target.getAttribute('data-partido-id');
        const tipo = e.target.getAttribute('data-tipo');
        await mostrarModalEditarSlots(partidoId, tipo);
    }
});

// 3. Función para mostrar el modal de edición de slots
async function mostrarModalEditarSlots(partidoId, tipo) {
    // Obtener datos del partido
    let partido;
    if (tipo === 'amistoso') {
        const docSnap = await getDoc(doc(db, 'partidosAmistosos', partidoId));
        if (!docSnap.exists()) return mostrarMensajeTemporal('Partido no encontrado', 'error');
        partido = { id: partidoId, ...docSnap.data() };
    } else if (tipo === 'reto') {
        const docSnap = await getDoc(doc(db, 'partidosReto', partidoId));
        if (!docSnap.exists()) return mostrarMensajeTemporal('Partido no encontrado', 'error');
        partido = { id: partidoId, ...docSnap.data() };
    } else {
        return;
    }
    // Crear modal si no existe
    let modal = document.getElementById('modal-editar-slots');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-editar-slots';
        modal.className = 'modal-general';
        document.body.appendChild(modal);
    }
    // Renderizar contenido del modal
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-users"></i> Editar Jugadores</h3>
          <span class="close-modal">&times;</span>
        </div>
        <div class="modal-body">
          <div id="estado-partido-slots" style="margin-bottom:1em;"></div>
          <div class="tennis-court padel-grid" id="slots-edicion"></div>
          <div style="margin-top:1em;text-align:center;">
            <button id="btn-guardar-slots" class="btn-guardar">Guardar Cambios</button>
            <button id="btn-cerrar-slots" class="btn-cancelar">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    // Mostrar estado
    document.getElementById('estado-partido-slots').innerHTML = partido.resultado ? '<span style="color:green">JUGADO</span>' : '<span style="color:orange">PENDIENTE</span>';
    // Renderizar slots
    renderSlotsEdicion(partido, tipo);
    // Mostrar modal
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; modal.style.visibility = 'visible'; }, 10);
    // Cerrar modal
    modal.querySelector('.close-modal').onclick = cerrarModalEditarSlots;
    document.getElementById('btn-cerrar-slots').onclick = cerrarModalEditarSlots;
    // Guardar cambios
    document.getElementById('btn-guardar-slots').onclick = async () => {
        await guardarCambiosSlots(partido, tipo);
        cerrarModalEditarSlots();
        await cargarCalendario();
    };
}
function cerrarModalEditarSlots() {
    const modal = document.getElementById('modal-editar-slots');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 200);
    }
}
// 4. Renderizar los slots editables según permisos
function renderSlotsEdicion(partido, tipo) {
    const container = document.getElementById('slots-edicion');
    container.innerHTML = '';
    const maxSlots = 4;
    for (let i = 0; i < maxSlots; i++) {
        const uid = partido.jugadores?.[i];
        const slot = document.createElement('div');
        slot.className = 'court-player-slot';
        if (uid) {
            const user = allUsers.find(u => u.id === uid);
            slot.innerHTML = `<div class='jugador-casilla-info'><div class='jugador-nombre destacado'>${user?.nombreUsuario || user?.displayName || 'Jugador'}</div><div class='jugador-nivel'>Nivel: ${user?.nivel || 'N/A'}</div></div>`;
            // Botón X para quitar
            if (usuarioActual.uid === partido.creador || usuarioActual.uid === uid) {
                const btnQuitar = document.createElement('button');
                btnQuitar.className = 'btn-quitar-jugador';
                btnQuitar.innerHTML = '✕';
                btnQuitar.onclick = () => {
                    partido.jugadores[i] = null;
                    renderSlotsEdicion(partido, tipo);
                };
                slot.appendChild(btnQuitar);
            }
        } else {
            // Botón + para añadir
            const btnAdd = document.createElement('button');
            btnAdd.className = 'btn-add-player';
            btnAdd.innerHTML = '+';
            btnAdd.onclick = () => {
                // Si es el creador, abrir modal de selección de usuarios
                if (usuarioActual.uid === partido.creador) {
                    abrirModalSeleccionUsuarioParaEdicion(partido, tipo, i);
                } else {
                    // Si es un usuario normal, unirse automáticamente (solo si no está ya en la partida)
                    if (!partido.jugadores?.includes(usuarioActual.uid)) {
                        partido.jugadores[i] = usuarioActual.uid;
                        renderSlotsEdicion(partido, tipo);
                    } else {
                        mostrarMensajeTemporal('Ya estás en esta partida', 'info');
                    }
                }
            };
            slot.appendChild(btnAdd);
        }
        container.appendChild(slot);
    }
}
// 5. Guardar cambios en la base de datos
async function guardarCambiosSlots(partido, tipo) {
    // Limpiar nulos y dejar solo los uids válidos
    const jugadores = (partido.jugadores || []).filter(Boolean);
    if (jugadores.length !== 4) {
        mostrarMensajeTemporal('Debes tener 4 jugadores para guardar', 'error');
        return;
    }
    if (tipo === 'amistoso') {
        await updateDoc(doc(db, 'partidosAmistosos', partido.id), { jugadores });
    } else if (tipo === 'reto') {
        await updateDoc(doc(db, 'partidosReto', partido.id), { jugadores });
    }
    mostrarMensajeTemporal('Jugadores actualizados', 'success');
}

// 6. Función para abrir modal de selección de usuarios en edición de slots (solo para creador)
function abrirModalSeleccionUsuarioParaEdicion(partido, tipo, pos) {
    if (modalSeleccionUsuario) {
        modalSeleccionUsuario.remove();
        modalSeleccionUsuario = null;
    }
    modalSeleccionUsuario = document.createElement('div');
    modalSeleccionUsuario.className = 'modal-general modal-seleccion-usuario';
    modalSeleccionUsuario.innerHTML = `
        <div class="modal-content" style="min-width:340px;max-width:95vw;">
            <div class="modal-header">
                <h3><i class="fas fa-user-plus"></i> Seleccionar usuario para añadir</h3>
                <span class="close-modal">&times;</span>
            </div>
            <div class="modal-body">
                <div class="lista-usuarios-modal"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modalSeleccionUsuario);
    modalSeleccionUsuario.querySelector('.close-modal').onclick = () => {
        modalSeleccionUsuario.style.opacity = '0';
        setTimeout(() => modalSeleccionUsuario.remove(), 200);
    };
    
    // Llenar lista de usuarios elegantes
    const lista = modalSeleccionUsuario.querySelector('.lista-usuarios-modal');
    lista.innerHTML = '';
    
    allUsers.forEach(user => {
        // Verificar si el usuario ya está en el partido
        let yaEnPartido = partido.jugadores?.includes(user.id) || false;
        
        const div = document.createElement('div');
        div.className = 'usuario-modal-item premium-fly';
        if (yaEnPartido) {
            div.style.opacity = '0.5';
            div.style.pointerEvents = 'none';
        }
        div.innerHTML = `
            <span class='nombre-usuario-modal' style='color:#2A9D8F;font-weight:800;font-size:1.13em;'>${user.nombreUsuario || user.displayName || user.email}</span>
            <span class='nivel-usuario-modal' style='color:#E9C46A;font-weight:700;font-size:1.05em;margin-left:14px;'>Nivel: ${user.nivel || 'N/A'}</span>
            ${yaEnPartido ? '<span style="color:#E76F51;margin-left:10px;">(Ya en partido)</span>' : ''}
        `;
        
        if (!yaEnPartido) {
            div.onclick = () => {
                // Animación de vuelo
                const rectOrigen = div.getBoundingClientRect();
                const container = document.getElementById('slots-edicion');
                const slot = container.children[pos];
                const rectDestino = slot.getBoundingClientRect();
                
                // Clonar y animar
                const flyDiv = div.cloneNode(true);
                flyDiv.style.position = 'fixed';
                flyDiv.style.left = rectOrigen.left + 'px';
                flyDiv.style.top = rectOrigen.top + 'px';
                flyDiv.style.width = rectOrigen.width + 'px';
                flyDiv.style.zIndex = 99999;
                flyDiv.style.transition = 'all 0.7s cubic-bezier(.4,1.6,.6,1)';
                flyDiv.style.pointerEvents = 'none';
                document.body.appendChild(flyDiv);
                
                setTimeout(() => {
                    flyDiv.style.left = rectDestino.left + 'px';
                    flyDiv.style.top = rectDestino.top + 'px';
                    flyDiv.style.width = rectDestino.width + 'px';
                    flyDiv.style.opacity = '0.7';
                    flyDiv.style.transform = 'scale(0.85)';
                }, 10);
                
                setTimeout(() => {
                    document.body.removeChild(flyDiv);
                    // Añadir usuario al slot
                    partido.jugadores[pos] = user.id;
                    renderSlotsEdicion(partido, tipo);
                    modalSeleccionUsuario.style.opacity = '0';
                    setTimeout(() => modalSeleccionUsuario.remove(), 200);
                }, 750);
            };
        }
        
        lista.appendChild(div);
    });
    
    setTimeout(() => {
        modalSeleccionUsuario.style.opacity = '1';
        modalSeleccionUsuario.style.visibility = 'visible';
        modalSeleccionUsuario.style.display = 'flex';
    }, 10);
}