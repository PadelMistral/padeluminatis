import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, orderBy, limit, getDocs, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";
import { auth, db, storage } from './firebase-config.js';

let usuarioActual = null;
let equipoUsuario = null;

// Función helper para actualizar elementos de forma segura
function actualizarElemento(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor;
        console.log(`Actualizado ${id}: ${valor}`);
    } else {
        console.warn(`⚠️ Elemento no encontrado: ${id}`);
    }
}

// Función para inicializar la aplicación - MODIFICADA para ser async
async function inicializarPerfil() {
    console.log('🚀 Inicializando perfil...');
    
    return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
        console.log('=> Estado de autenticación:', user ? 'Usuario logeado' : 'No hay usuario');
        if (user) {
            try {
                    await cargarPerfilPropio(user);
                    resolve(); // Resuelve la promesa cuando todo ha cargado
                } catch (error) {
                    console.error("⚠️ Error al cargar el perfil propio:", error);
                    await cargarEstadisticasBasicas();
                    reject(error); // Rechaza la promesa en caso de error
                }
            } else {
                console.log('=> Redirigiendo a login...');
                window.location.href = 'index.html';
                reject(new Error("Usuario no autenticado")); // Rechaza si no hay usuario
            }
        });
    });
}

// Nueva función para encapsular la lógica del perfil propio
async function cargarPerfilPropio(user) {
                console.log('=> Cargando datos del usuario...');
                const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                if (!userDoc.exists()) {
                    console.error('⚠️ Usuario no registrado en Firestore');
                    throw new Error("Usuario no registrado");
                }
    usuarioActual = { uid: user.uid, ...userDoc.data() };
                console.log('=> Datos del usuario cargados:', usuarioActual);
    
                await actualizarInformacionBasica();
                await obtenerEquipoUsuario();
    
                if (equipoUsuario) {
                    console.log('=> Equipo encontrado:', equipoUsuario);
                    await cargarEstadisticasPerfil();
                    await cargarHistorialPartidosPerfil();
                    await cargarEstadisticasPala();
                    await cargarCompañeroYRivales();
                } else {
                    console.warn('⚠️ No se encontró equipo para el usuario');
                    await cargarEstadisticasBasicas();
                }
    
                // Funcionalidades extra
                cargarFamilyPoints();
                cargarLogros();
                await cargarInformacionLiga();
                await actualizarLigaExtendida();
                await cargarTorneosActuales();
                await cargarEstadisticasAmistosos();
                await cargarRetos();
                actualizarRetosJugados();
    console.log('=> Perfil propio cargado completamente');
}

function actualizarInformacionBasica() {
    console.log('=> Actualizando información básica...');
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        const nombre = usuarioActual.nombreUsuario || usuarioActual.nombre || usuarioActual.email.split('@')[0];
        userNameElement.textContent = nombre;
        console.log(`=> Nombre actualizado: ${nombre}`);
    }
    const userLevelElement = document.getElementById('user-level');
    if (userLevelElement) {
        const nivel = usuarioActual.nivel || '1.5';
        userLevelElement.textContent = nivel;
        const nivelNum = parseFloat(nivel);
        let nivelClass = 'level-1';
        console.log('DEBUG nivel:', nivel, 'nivelNum:', nivelNum);
        if (nivelNum >= 1 && nivelNum < 1.5) nivelClass = 'level-1';
        else if (nivelNum >= 1.5 && nivelNum < 2) nivelClass = 'level-1-5';
        else if (nivelNum >= 2 && nivelNum < 2.5) nivelClass = 'level-2';
        else if (nivelNum >= 2.5 && nivelNum < 3) nivelClass = 'level-2-5';
        else if (nivelNum >= 3 && nivelNum < 3.5) nivelClass = 'level-3';
        else if (nivelNum >= 3.5 && nivelNum < 4) nivelClass = 'level-3-5';
        else if (nivelNum >= 4 && nivelNum < 4.5) nivelClass = 'level-4';
        else if (nivelNum >= 4.5 && nivelNum < 5) nivelClass = 'level-4-5';
        else if (nivelNum >= 5) nivelClass = 'level-5';
        console.log('Nivel detectado:', nivel, 'Nivel numérico:', nivelNum, 'Clase asignada:', nivelClass);
        userLevelElement.className = `level-badge ${nivelClass}`;
        console.log('Clases actuales en user-level:', userLevelElement.className);
    } else {
        console.warn('No se encontró el elemento user-level');
    }
    const profilePic = document.getElementById('profile-pic');
    if (profilePic && usuarioActual.fotoPerfil) {
        profilePic.src = usuarioActual.fotoPerfil;
        console.log('=> Foto de perfil actualizada');
    }
    const paddlePic = document.getElementById('paddle-pic');
    if (paddlePic && usuarioActual.pala?.imagen) {
        paddlePic.src = usuarioActual.pala.imagen;
        console.log('=> Foto de pala actualizada');
    }
    const paddleNameElement = document.getElementById('paddle-name');
    if (paddleNameElement) {
        const nombrePala = usuarioActual.pala?.nombre || 'Mi Pala';
        paddleNameElement.textContent = nombrePala;
        console.log(`=> Nombre de pala actualizado: ${nombrePala}`);
    }
}

async function cargarEstadisticasBasicas() {
    console.log('=> Cargando estadísticas básicas...');
    actualizarElemento('total-matches', '0');
    actualizarElemento('total-wins', '0');
    actualizarElemento('total-losses', '0');
    actualizarElemento('win-rate', '0%');
    actualizarElemento('best-streak', '0');
    actualizarElemento('current-streak', '0');
    actualizarElemento('consecutive-matches', '0');
    actualizarElemento('league-wins', '0');
    actualizarElemento('friendly-wins', '0');
    actualizarElemento('event-wins', '0');
    actualizarElemento('total-points', '0');
    actualizarElemento('retos-ganados', '0');
    actualizarElemento('retos-perdidos', '0');
    const highlightElement = document.getElementById('highlight-achievement');
    if (highlightElement) {
        highlightElement.textContent = "¡Comienza tu aventura en el pádel!";
    }
}

async function obtenerEquipoUsuario() {
    console.log('=> Buscando equipo del usuario...');
    const equiposSnap = await getDocs(collection(db, "equipos"));
    for (const docu of equiposSnap.docs) {
        const data = docu.data();
        if (data.jugadores && data.jugadores.includes(usuarioActual.uid)) {
            equipoUsuario = { id: docu.id, ...data };
            console.log('=> Equipo encontrado:', equipoUsuario.nombre);
            return;
        }
    }
    console.warn('⚠️ No se encontró equipo para el usuario');
}

async function cargarEstadisticasPerfil() {
    console.log('=> Cargando estadísticas del perfil...');
    let partidosJugados = 0;
    let victorias = 0;
    let derrotas = 0;
    let mejorRacha = 0;
    let rachaActual = 0;
    let victoriasLiga = 0, victoriasAmistoso = 0, victoriasEvento = 0;
    let derrotasLiga = 0, derrotasAmistoso = 0, derrotasEvento = 0;
    let partidosConsecutivos = 0;
    let partidos = [];
    try {
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        console.log(`=> Encontradas ${calendarioSnap.docs.length} jornadas`);
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (!partido.resultado) continue;
                const esLocal = partido.equipoLocal === equipoUsuario.id;
                const esVisitante = partido.equipoVisitante === equipoUsuario.id;
                if (!esLocal && !esVisitante) continue;
                partidosJugados++;
                let setsMiEquipo = 0, setsRival = 0;
                Object.values(partido.resultado).forEach(set => {
                    const puntos1 = set.puntos1 || 0;
                    const puntos2 = set.puntos2 || 0;
                    if (puntos1 === 0 && puntos2 === 0) return; // REGLA: sets 0-0 no cuentan
                    if (esLocal) {
                        if (puntos1 > puntos2) setsMiEquipo++;
                        else setsRival++;
                    } else {
                        if (puntos2 > puntos1) setsMiEquipo++;
                        else setsRival++;
                    }
                });
                const victoria = setsMiEquipo > setsRival;
                if (victoria) {
                    victorias++;
                    rachaActual++;
                    if (partido.tipo === 'liga') victoriasLiga++;
                    else if (partido.tipo === 'amistoso') victoriasAmistoso++;
                    else if (partido.tipo === 'evento') victoriasEvento++;
                } else {
                    derrotas++;
                    if (rachaActual > mejorRacha) mejorRacha = rachaActual;
                    rachaActual = 0;
                    if (partido.tipo === 'liga') derrotasLiga++;
                    else if (partido.tipo === 'amistoso') derrotasAmistoso++;
                    else if (partido.tipo === 'evento') derrotasEvento++;
                }
                partidosConsecutivos = Math.max(partidosConsecutivos, rachaActual);
                partidos.push({ ...partido, victoria, setsMiEquipo, setsRival });
            }
        }
        if (rachaActual > mejorRacha) mejorRacha = rachaActual;
        console.log(`=> Estadísticas calculadas: ${partidosJugados} partidos, ${victorias} victorias, ${derrotas} derrotas`);
        actualizarElemento('total-matches', partidosJugados);
        actualizarElemento('total-wins', victorias);
        actualizarElemento('total-losses', derrotas);
        actualizarElemento('win-rate', partidosJugados > 0 ? `${((victorias / partidosJugados) * 100).toFixed(1)}%` : '0%');
        actualizarElemento('best-streak', mejorRacha);
        actualizarElemento('current-streak', rachaActual);
        actualizarElemento('consecutive-matches', partidosConsecutivos);
        actualizarElemento('league-wins', victoriasLiga);
        actualizarElemento('friendly-wins', victoriasAmistoso);
        actualizarElemento('event-wins', victoriasEvento);
        const puntosTotales = victorias * 3 + (partidosJugados - victorias - derrotas) * 1;
        actualizarElemento('total-points', puntosTotales);
        actualizarElemento('retos-ganados', victorias);
        actualizarElemento('retos-perdidos', derrotas);
        const highlightElement = document.getElementById('highlight-achievement');
        if (highlightElement) {
            if (mejorRacha >= 5) {
                highlightElement.textContent = `¡Racha de ${mejorRacha} victorias consecutivas!`;
            } else if (victorias >= 10) {
                highlightElement.textContent = `¡${victorias} victorias conseguidas!`;
            } else if (partidosJugados >= 5) {
                highlightElement.textContent = `¡${partidosJugados} partidos jugados!`;
            } else {
                highlightElement.textContent = "¡Comienza tu aventura en el pádel!";
            }
        }
        window._partidosPerfil = partidos;
    } catch (error) {
        console.error('⚠️ Error al cargar estadísticas:', error);
        await cargarEstadisticasBasicas();
    }
}

async function cargarHistorialPartidosPerfil() {
    console.log('=> Cargando histórico de partidos...');
    const matchesList = document.getElementById('matches-list');
    if (!matchesList) {
        console.warn('⚠️ Elemento matches-list no encontrado');
        return;
    }
    matchesList.innerHTML = '';
    const partidos = window._partidosPerfil || [];
    partidos.sort((a, b) => (b.fecha?.toDate?.() || 0) - (a.fecha?.toDate?.() || 0));
    for (const partido of partidos) {
        const matchElement = document.createElement('div');
        matchElement.className = 'match-item';
        const esLocal = partido.equipoLocal === equipoUsuario.id;
        const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
        let nombreRival = 'Rival';
        try {
            const rivalDoc = await getDoc(doc(db, "equipos", rivalId));
            if (rivalDoc.exists()) {
                nombreRival = rivalDoc.data().nombre || 'Rival';
            }
        } catch (error) {
            console.error("Error al obtener nombre del rival:", error);
        }
        const fecha = partido.fecha?.toDate?.() ? 
            new Date(partido.fecha.toDate()).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'Fecha no disponible';
        let setsDetallados = '';
        if (partido.resultado) {
            const sets = Object.values(partido.resultado);
            setsDetallados = sets.map((set, index) => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                return `${puntos1}-${puntos2}`;
            }).join(' | ');
        }
        const resultadoClase = partido.victoria ? 'victory' : 'defeat';
        const resultadoTexto = partido.victoria ? 'Victoria' : 'Derrota';
        matchElement.innerHTML = `
            <div class="match-header">
                <div class="match-type-badge">${partido.tipo || 'Partido'}</div>
                <div class="match-result-badge ${resultadoClase}">${resultadoTexto}</div>
            </div>
            <div class="match-content">
                <div class="match-rival">
                    <i class="fas fa-user-friends"></i>
                    <span>vs ${nombreRival}</span>
                </div>
                <div class="match-date">
                    <i class="fas fa-calendar-alt"></i>
                    <span>${fecha}</span>
                </div>
                <div class="match-score">
                    <i class="fas fa-trophy"></i>
                    <span>${partido.setsMiEquipo} - ${partido.setsRival} sets</span>
                </div>
                <div class="match-sets-detail">
                    <i class="fas fa-list-ol"></i>
                    <span>${setsDetallados || 'Sets no disponibles'}</span>
                </div>
            </div>
        `;
        matchesList.appendChild(matchElement);
    }
    console.log(`=> Histórico cargado: ${partidos.length} partidos`);
    window._victoriasPerfil = partidos.filter(p => p.victoria);
    window._derrotasPerfil = partidos.filter(p => !p.victoria);
}

async function cargarEstadisticasPala() {
    console.log('=> Cargando estadísticas de la pala...');
    const partidos = window._partidosPerfil || [];
    const partidosConPala = partidos.length;
    const victoriasConPala = partidos.filter(p => p.victoria).length;
    const winRatePala = partidosConPala > 0 ? ((victoriasConPala / partidosConPala) * 100).toFixed(1) : 0;
    actualizarElemento('paddle-matches', partidosConPala);
    actualizarElemento('paddle-wins', victoriasConPala);
    actualizarElemento('paddle-win-rate', `${winRatePala}%`);
    const powerStat = document.getElementById('power-stat');
    const controlStat = document.getElementById('control-stat');
    const handlingStat = document.getElementById('handling-stat');
    if (powerStat) powerStat.style.width = `${Math.min(winRatePala, 100)}%`;
    if (controlStat) controlStat.style.width = `${Math.min(partidosConPala * 2, 100)}%`;
    if (handlingStat) handlingStat.style.width = `${Math.min(partidosConPala * 5, 100)}%`;
    console.log('=> Estadísticas de pala actualizadas');
}

async function cargarCompañeroYRivales() {
    console.log('=> Cargando compañero y rivales...');
    if (equipoUsuario && equipoUsuario.jugadores.length > 1) {
        const compañeroId = equipoUsuario.jugadores.find(id => id !== usuarioActual.uid);
        if (compañeroId) {
            try {
                const compañeroDoc = await getDoc(doc(db, "usuarios", compañeroId));
                if (compañeroDoc.exists()) {
                    const compañeroData = compañeroDoc.data();
                    actualizarElemento('partner-name', compañeroData.nombreUsuario || compañeroData.nombre || 'Compañero');
                    const partnerPic = document.getElementById('partner-pic');
                    if (partnerPic) {
                        const nombreCompañero = compañeroData.nombreUsuario || compañeroData.nombre || 'Compañero';
                        partnerPic.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreCompañero)}&background=128C7E&color=fff&size=100`;
                    }
                    await cargarEstadisticasCompañero(compañeroId);
                }
            } catch (error) {
                console.error("Error al cargar datos del compañero:", error);
            }
        }
    }
    await calcularRivalesReales();
    console.log('=> Compañero y rivales cargados');
}

async function cargarEstadisticasCompañero(compañeroId) {
    console.log('=> Cargando estadísticas reales del compañero...');
    const equiposSnap = await getDocs(collection(db, "equipos"));
    let equipoCompañero = null;
    for (const docu of equiposSnap.docs) {
        const data = docu.data();
        if (data.jugadores && data.jugadores.includes(compañeroId)) {
            equipoCompañero = { id: docu.id, ...data };
            break;
        }
    }
    if (!equipoCompañero) {
        console.warn('⚠️ No se encontró equipo para el compañero');
        return;
    }
    let partidosCompañero = 0;
    let victoriasCompañero = 0;
    let derrotasCompañero = 0;
    const calendarioSnap = await getDocs(collection(db, "calendario"));
    for (const jornadaDoc of calendarioSnap.docs) {
        const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
        for (const partidoDoc of partidosSnap.docs) {
            const partido = partidoDoc.data();
            if (!partido.resultado) continue;
            const esLocal = partido.equipoLocal === equipoCompañero.id;
            const esVisitante = partido.equipoVisitante === equipoCompañero.id;
            if (!esLocal && !esVisitante) continue;
            partidosCompañero++;
            let setsMiEquipo = 0, setsRival = 0;
            Object.values(partido.resultado).forEach(set => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                if (puntos1 === 0 && puntos2 === 0) return;
                if (esLocal) {
                    if (puntos1 > puntos2) setsMiEquipo++;
                    else setsRival++;
                } else {
                    if (puntos2 > puntos1) setsMiEquipo++;
                    else setsRival++;
                }
            });
            const victoria = setsMiEquipo > setsRival;
            if (victoria) {
                victoriasCompañero++;
            } else {
                derrotasCompañero++;
            }
        }
    }
    const winRateCompañero = partidosCompañero > 0 ? ((victoriasCompañero / partidosCompañero) * 100).toFixed(1) : 0;
    actualizarElemento('partner-matches', partidosCompañero);
    actualizarElemento('partner-wins', victoriasCompañero);
    actualizarElemento('partner-win-rate', `${winRateCompañero}%`);
    console.log(`=> Estadísticas del compañero: ${partidosCompañero} partidos, ${victoriasCompañero} victorias, ${winRateCompañero}% win rate`);
}

async function cargarRetos() {
    console.log('=> Cargando retos...');
    try {
        const partidos = window._partidosPerfil || [];
        const retos = partidos.filter(p => p.tipo === 'reto' && p.resultado);
        const retosList = document.getElementById('retos-list');
        if (retosList) {
            retosList.innerHTML = retos.map(reto => {
                const fecha = reto.fecha?.toDate?.() ? 
                    new Date(reto.fecha.toDate()).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    }) : 'Fecha no disponible';
                return `
                    <div class="reto-item">
                        <span class="reto-date">${fecha}</span>
                        <span class="reto-result ${reto.victoria ? 'victory' : 'defeat'}">${reto.victoria ? 'Victoria' : 'Derrota'}</span>
                    </div>
                `;
            }).join('');
        }
        console.log(`✅ Retos cargados: ${retos.length} retos jugados`);
    } catch (error) {
        console.error('⚠️ Error al cargar retos:', error);
    }
}

// Función mejorada para calcular rivales reales
async function calcularRivalesReales() {
    console.log('=> Calculando rivales reales...');
    try {
        const partidos = window._partidosPerfil || [];
        const rivales = new Map();
        for (const partido of partidos) {
            if (!partido.resultado) continue;
            const esLocal = partido.equipoLocal === equipoUsuario?.id;
            const rivalId = esLocal ? partido.equipoVisitante : partido.equipoLocal;
            if (!rivales.has(rivalId)) {
                rivales.set(rivalId, {
                    id: rivalId,
                    nombre: 'Rival',
                    victorias: 0,
                    derrotas: 0,
                    setsGanados: 0,
                    setsPerdidos: 0,
                    puntosGanados: 0,
                    puntosPerdidos: 0,
                    partidos: []
                });
            }
            const rival = rivales.get(rivalId);
            rival.partidos.push(partido);
            let setsMiEquipo = 0, setsRival = 0;
            let puntosMiEquipo = 0, puntosRival = 0;
            Object.values(partido.resultado).forEach(set => {
                const puntos1 = set.puntos1 || 0;
                const puntos2 = set.puntos2 || 0;
                if (puntos1 === 0 && puntos2 === 0) return; // REGLA: sets 0-0 no cuentan
                if (esLocal) {
                    if (puntos1 > puntos2) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos1;
                    puntosRival += puntos2;
                } else {
                    if (puntos2 > puntos1) setsMiEquipo++;
                    else setsRival++;
                    puntosMiEquipo += puntos2;
                    puntosRival += puntos1;
                }
            });
            if (setsMiEquipo > setsRival) {
                rival.derrotas++; // El rival pierde contra mí
            } else {
                rival.victorias++; // El rival gana contra mí
            }
            rival.setsGanados += setsRival;
            rival.setsPerdidos += setsMiEquipo;
            rival.puntosGanados += puntosRival;
            rival.puntosPerdidos += puntosMiEquipo;
        }
        const equiposSnap = await getDocs(collection(db, "equipos"));
        const equiposMap = {};
        equiposSnap.forEach(doc => {
            equiposMap[doc.id] = doc.data().nombre;
        });
        const rivalesArray = Array.from(rivales.values()).map(rival => {
            rival.nombre = equiposMap[rival.id] || 'Rival';
            rival.diferenciaVictorias = rival.victorias - rival.derrotas;
            rival.diferenciaSets = rival.setsGanados - rival.setsPerdidos;
            rival.diferenciaPuntos = rival.puntosGanados - rival.puntosPerdidos;
            return rival;
        });
        const peorRival = rivalesArray
            .filter(r => r.victorias > 0)
            .sort((a, b) => {
                if (b.victorias !== a.victorias) return b.victorias - a.victorias;
                return b.diferenciaPuntos - a.diferenciaPuntos;
            })[0];
        const mejorRival = rivalesArray
            .filter(r => r.derrotas > 0)
            .sort((a, b) => {
                if (b.derrotas !== a.derrotas) return b.derrotas - a.derrotas;
                return a.diferenciaPuntos - b.diferenciaPuntos;
            })[0];
        if (peorRival) {
            actualizarElemento('worst-rival-name', peorRival.nombre);
            actualizarElemento('worst-rival-losses', peorRival.victorias);
            actualizarElemento('worst-rival-wins', peorRival.derrotas);
            const worstRivalDetails = document.getElementById('worst-rival-details');
            if (worstRivalDetails) {
                worstRivalDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${peorRival.victorias} victorias contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${peorRival.derrotas} derrotas contra ti</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${peorRival.setsGanados}-${peorRival.setsPerdidos}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${peorRival.puntosGanados}-${peorRival.puntosPerdidos}</span>
                    </div>
                `;
            }
            console.log(`😈 Peor rival: ${peorRival.nombre} (${peorRival.victorias} victorias contra ti)`);
        }
        if (mejorRival) {
            actualizarElemento('top-wins-name', mejorRival.nombre);
            actualizarElemento('top-wins-count', mejorRival.derrotas);
            actualizarElemento('top-wins-losses', mejorRival.victorias);
            const topWinsDetails = document.getElementById('top-wins-details');
            if (topWinsDetails) {
                topWinsDetails.innerHTML = `
                    <div class="rival-detail">
                        <i class="fas fa-trophy"></i>
                        <span>${mejorRival.derrotas} victorias contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-times-circle"></i>
                        <span>${mejorRival.victorias} derrotas contra él</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-chart-line"></i>
                        <span>Sets: ${mejorRival.setsPerdidos}-${mejorRival.setsGanados}</span>
                    </div>
                    <div class="rival-detail">
                        <i class="fas fa-bullseye"></i>
                        <span>Puntos: ${mejorRival.puntosPerdidos}-${mejorRival.puntosGanados}</span>
                    </div>
                `;
            }
            console.log(`😇 Mejor rival: ${mejorRival.nombre} (${mejorRival.derrotas} victorias contra él)`);
        }
        console.log(`✅ Rivales calculados: ${rivalesArray.length} rivales encontrados`);
    } catch (error) {
        console.error('⚠️ Error al calcular rivales:', error);
    }
}

function cargarFamilyPoints() {
    console.log('💰 Cargando Family Points...');
    const familyPoints = 500;
    actualizarElemento('family-points', familyPoints);
    console.log(`✅ Family Points cargados: ${familyPoints}`);
}

function cargarLogros() {
    console.log('🏆 Cargando logros...');
    const logrosDesbloqueados = Math.floor(Math.random() * 10) + 1;
    actualizarElemento('achievements-unlocked', logrosDesbloqueados);
    console.log(`✅ Logros cargados: ${logrosDesbloqueados} desbloqueados`);
}

async function cargarInformacionLiga() {
    console.log('🏆 Cargando información de liga...');
    try {
        const clasificacionSnap = await getDocs(collection(db, "clasificacion"));
        const clasificacion = [];
        clasificacionSnap.forEach(doc => {
            clasificacion.push({ ...doc.data(), id: doc.id });
        });
        clasificacion.sort((a, b) => a.posicion - b.posicion);
        if (clasificacion.length === 0) {
            actualizarElemento('league-position', 'N/A');
            actualizarElemento('league-points', '0');
            actualizarElemento('league-teams', '0');
            actualizarElemento('league-leader', 'N/A');
            actualizarElemento('league-matches-left', '0');
            const progressBar = document.getElementById('league-progress');
            if (progressBar) progressBar.style.width = '0%';
            const matchesLeftText = document.getElementById('league-matches-left-text');
            if (matchesLeftText) matchesLeftText.textContent = 'No hay datos de liga disponibles';
            console.log('ℹ️ No hay datos de clasificación disponibles');
            return;
        }
        let posicionUsuario = 0;
        let puntosUsuario = 0;
        let partidosJugadosUsuario = 0;
        let totalEquipos = clasificacion.length;
        let liderLiga = clasificacion[0];
        if (equipoUsuario) {
            const equipoEnClasificacion = clasificacion.find(eq => eq.id === equipoUsuario.id);
            if (equipoEnClasificacion) {
                posicionUsuario = equipoEnClasificacion.posicion;
                puntosUsuario = equipoEnClasificacion.puntos;
                partidosJugadosUsuario = equipoEnClasificacion.partidosJugados;
                console.log(`✅ Usuario encontrado en posición ${posicionUsuario} con ${puntosUsuario} puntos`);
            } else {
                console.log('⚠️ Usuario no está en la clasificación actual');
            }
        }
        const partidosTotales = totalEquipos > 1 ? (totalEquipos - 1) * 2 : 0;
        const partidosRestantes = Math.max(0, partidosTotales - partidosJugadosUsuario);
        const porcentajeJugados = partidosTotales > 0 ? Math.round((partidosJugadosUsuario / partidosTotales) * 100) : 0;
        actualizarElemento('league-position', posicionUsuario > 0 ? `#${posicionUsuario}` : 'N/A');
        actualizarElemento('league-points', puntosUsuario);
        actualizarElemento('league-teams', totalEquipos);
        actualizarElemento('league-leader', liderLiga ? liderLiga.nombre : 'N/A');
        actualizarElemento('league-matches-left', partidosRestantes);
        const progressBar = document.getElementById('league-progress');
        if (progressBar) {
            progressBar.style.width = `${porcentajeJugados}%`;
            console.log(`📊 Progreso de liga: ${porcentajeJugados.toFixed(1)}% (${partidosJugadosUsuario}/${partidosTotales} partidos)`);
        }
        const matchesLeftText = document.getElementById('league-matches-left-text');
        if (matchesLeftText) {
            if (posicionUsuario > 0) {
                matchesLeftText.textContent = `${partidosRestantes} partidos restantes`;
            } else {
                matchesLeftText.textContent = 'No estás registrado en la liga';
            }
        }
        console.log(`✅ Liga cargada: ${totalEquipos} equipos, ${partidosRestantes} partidos restantes`);
        console.log(`🏆 Líder de la liga: ${liderLiga ? liderLiga.nombre : 'N/A'} con ${liderLiga ? liderLiga.puntos : 0} puntos`);
        await actualizarLigaExtendida();
    } catch (error) {
        console.error('❌ Error al cargar información de liga:', error);
        actualizarElemento('league-position', 'Error');
        actualizarElemento('league-points', '0');
        actualizarElemento('league-teams', '0');
        actualizarElemento('league-leader', 'Error');
        actualizarElemento('league-matches-left', '0');
        const progressBar = document.getElementById('league-progress');
        if (progressBar) progressBar.style.width = '0%';
        const matchesLeftText = document.getElementById('league-matches-left-text');
        if (matchesLeftText) matchesLeftText.textContent = 'Error al cargar datos';
    }
}

async function cargarTorneosActuales() {
    console.log('⭐ Cargando torneos actuales...');
    try {
        const torneosSnap = await getDocs(collection(db, "torneos"));
        const torneosUsuario = [];
        for (const torneoDoc of torneosSnap.docs) {
            const torneoData = torneoDoc.data();
            if (torneoData.participantes && torneoData.participantes.includes(usuarioActual.uid)) {
                torneosUsuario.push({ id: torneoDoc.id, ...torneoData });
            }
        }
        const tournamentsList = document.getElementById('tournaments-list');
        if (tournamentsList) {
        if (torneosUsuario.length === 0) {
            tournamentsList.innerHTML = `
                <div class="no-tournaments">
                    <i class="fas fa-info-circle"></i>
                    <span>No estás registrado en ningún torneo</span>
                </div>
            `;
        } else {
            tournamentsList.innerHTML = torneosUsuario.map(torneo => {
                const fase = torneo.fase || 'grupos';
                const estado = torneo.estado || 'activo';
                let faseTexto = 'Grupos';
                if (fase === 'octavos') faseTexto = 'Octavos';
                else if (fase === 'cuartos') faseTexto = 'Cuartos';
                else if (fase === 'semifinal') faseTexto = 'Semifinal';
                else if (fase === 'final') faseTexto = 'Final';
                return `
                    <div class="tournament-item">
                        <span class="tournament-name">${torneo.nombre}</span>
                        <div class="tournament-info">
                            <span class="tournament-phase">${faseTexto}</span>
                            <span class="tournament-status ${estado}">${estado}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        }
        console.log(`✅ Torneos cargados: ${torneosUsuario.length} torneos activos`);
    } catch (error) {
        console.error('❌ Error al cargar torneos:', error);
    }
}

async function cargarEstadisticasAmistosos() {
    console.log('🤝 Cargando estadísticas de amistosos...');
    try {
        const partidos = window._partidosPerfil || [];
        const amistosos = partidos.filter(p => p.tipo === 'amistoso');
        const totalAmistosos = amistosos.length;
        const victoriasAmistosos = amistosos.filter(p => p.victoria).length;
        const derrotasAmistosos = totalAmistosos - victoriasAmistosos;
        actualizarElemento('friendly-total', totalAmistosos);
        actualizarElemento('friendly-wins', victoriasAmistosos);
        actualizarElemento('friendly-losses', derrotasAmistosos);
        console.log(`✅ Amistosos cargados: ${totalAmistosos} total, ${victoriasAmistosos} victorias, ${derrotasAmistosos} derrotas`);
    } catch (error) {
        console.error('❌ Error al cargar amistosos:', error);
    }
}

function inicializarRetoAmigos() {
    const challengeButton = document.getElementById('challenge-friend');
    if (challengeButton) {
        challengeButton.addEventListener('click', () => {
            alert('Función de reto a amigos en desarrollo. Próximamente podrás retar a amigos apostando Family Points.');
        });
    }
}

function actualizarRetosJugados() {
    const partidos = window._partidosPerfil || [];
    const retos = partidos.filter(p => p.tipo === 'reto');
    const retosGanados = retos.filter(p => p.victoria).length;
    document.getElementById('retos-jugados').textContent = retos.length;
    const challengeWins = document.getElementById('challenge-wins');
    if (challengeWins) challengeWins.textContent = retosGanados;
}

async function actualizarLigaExtendida() {
    try {
        const clasificacionSnap = await getDocs(collection(db, "clasificacion"));
        const clasificacion = [];
        clasificacionSnap.forEach(doc => {
            clasificacion.push({ ...doc.data(), id: doc.id });
        });
        clasificacion.sort((a, b) => a.posicion - b.posicion);
        const totalEquipos = clasificacion.length;
        let partidosJugadosUsuario = 0;
        let nombreUltimo = 'N/A';
        let puntosUsuario = 0;
        let victorias = 0;
        let derrotas = 0;
        if (clasificacion.length > 0) {
            nombreUltimo = clasificacion[clasificacion.length - 1].nombre || 'N/A';
        }
        if (equipoUsuario) {
            const equipoEnClasificacion = clasificacion.find(eq => eq.id === equipoUsuario.id);
            if (equipoEnClasificacion) {
                partidosJugadosUsuario = equipoEnClasificacion.partidosJugados;
                puntosUsuario = equipoEnClasificacion.puntos;
                victorias = equipoEnClasificacion.victorias || 0;
                derrotas = equipoEnClasificacion.derrotas || 0;
            }
        }
        
        // Actualizar información básica
        document.getElementById('league-last').textContent = nombreUltimo;
        const puntosPosibles = partidosJugadosUsuario * 2;
        document.getElementById('league-points').textContent = `${puntosUsuario}/${puntosPosibles}`;

        // Actualizar barra de progreso del equipo del usuario
        actualizarAcabarPartidos(partidosJugadosUsuario, totalEquipos);

        // Actualizar barra de progreso de la liga completa
        await contarPartidosLigaRestantes(clasificacion);
    } catch (error) {
        console.error('Error al actualizar liga extendida:', error);
    }
}

// Actualiza la barra y texto de acabar partidos (solo equipo usuario)
function actualizarAcabarPartidos(partidosJugadosUsuario, totalEquipos) {
    const partidosTotalesEquipo = totalEquipos > 1 ? (totalEquipos - 1) : 0;
    const partidosRestantesEquipo = Math.max(0, partidosTotalesEquipo - partidosJugadosUsuario);
    const porcentajeJugadosEquipo = partidosTotalesEquipo > 0 ? Math.round((partidosJugadosUsuario / partidosTotalesEquipo) * 100) : 0;
    
    // Texto y barra SOLO para el equipo del usuario
    const finishedText = document.getElementById('league-finished');
    if (finishedText) finishedText.textContent = `Jugados: ${partidosJugadosUsuario} / ${partidosTotalesEquipo} | Restantes: ${partidosRestantesEquipo} | % Completado: ${porcentajeJugadosEquipo}%`;
    
    const finishedBar = document.getElementById('league-finished-bar');
    if (finishedBar) finishedBar.style.width = `${porcentajeJugadosEquipo}%`;
    
    const finishedPercent = document.getElementById('league-finished-percent');
    if (finishedPercent) finishedPercent.textContent = `${porcentajeJugadosEquipo}%`;
    
    const finishedLeftText = document.getElementById('league-finished-left-text');
    if (finishedLeftText) finishedLeftText.textContent = `${partidosRestantesEquipo} partidos restantes`;
}

// Actualiza la barra y texto de final de liga (todos los equipos)
async function contarPartidosLigaRestantes(clasificacion) {
    try {
        // Total de equipos
        const totalEquipos = clasificacion.length;
        // Total de partidos posibles (una vuelta)
        const partidosTotalesLiga = totalEquipos > 1 ? (totalEquipos * (totalEquipos - 1)) / 2 : 0;
        
        // Contar partidos jugados (con resultado) en la colección calendario
        let partidosJugadosLiga = 0;
        const calendarioSnap = await getDocs(collection(db, "calendario"));
        for (const jornadaDoc of calendarioSnap.docs) {
            const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
            for (const partidoDoc of partidosSnap.docs) {
                const partido = partidoDoc.data();
                if (partido.resultado) partidosJugadosLiga++;
            }
        }
        
        const partidosRestantesLiga = Math.max(0, partidosTotalesLiga - partidosJugadosLiga);
        const porcentajeLiga = partidosTotalesLiga > 0 ? Math.round((partidosJugadosLiga / partidosTotalesLiga) * 100) : 0;
        
        // Texto y barra SOLO para la liga global
        const matchesLeftText = document.getElementById('league-matches-left-text');
        if (matchesLeftText) matchesLeftText.textContent = `${partidosRestantesLiga} partidos restantes (${porcentajeLiga}%)`;
        
        const progressBar = document.getElementById('league-progress');
        if (progressBar) progressBar.style.width = `${porcentajeLiga}%`;
        
        console.log(`✅ Progreso de liga actualizado: ${porcentajeLiga}% completado (${partidosJugadosLiga}/${partidosTotalesLiga} partidos)`);
    } catch (error) {
        console.error('Error al contar partidos de liga restantes:', error);
    }
}

// 2. Cambiar foto de perfil
function inicializarCambioFotoPerfil() {
    const editOverlay = document.getElementById('edit-profile-pic');
    const inputFile = document.getElementById('profile-pic-input');
    const profilePic = document.getElementById('profile-pic');
    if (editOverlay && inputFile && profilePic) {
        editOverlay.addEventListener('click', () => {
            inputFile.click();
        });
        inputFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                // Subir a Firebase Storage
                const storageRef = ref(storage, `fotosPerfil/${usuarioActual.uid}`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                // Actualizar en Firestore
                await updateDoc(doc(db, 'usuarios', usuarioActual.uid), { fotoPerfil: url });
                // Actualizar en la UI
                profilePic.src = url;
                profilePic.style.objectFit = 'cover';
                profilePic.style.objectPosition = 'center';
            } catch (error) {
                alert('Error al subir la foto de perfil');
                console.error(error);
            }
        });
    }
}

// --- CAMBIO DE COMPAÑERO ---
let solicitudCambioPendiente = false;
let idSolicitudCambio = null;

async function cargarUsuariosSinEquipo() {
  const select = document.getElementById('select-nuevo-companero');
  select.innerHTML = '<option value="">-- Selecciona usuario --</option>';
  try {
    const usuariosSnap = await getDocs(collection(db, 'usuarios'));
    usuariosSnap.forEach(doc => {
      const data = doc.data();
      if (!data.equipoId) {
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = data.nombre || data.email || doc.id;
        select.appendChild(opt);
      }
    });
  } catch (e) {
    alert('Error al cargar usuarios');
  }
}

function mostrarModalCambiarCompanero() {
  document.getElementById('modal-cambiar-companero').style.display = 'flex';
  cargarUsuariosSinEquipo();
}
function cerrarModalCambiarCompanero() {
  document.getElementById('modal-cambiar-companero').style.display = 'none';
}

async function solicitarCambioCompanero(tipo) {
  if (!equipoUsuario) return alert('No tienes equipo');
  let nuevoCompaneroId = null;
  if (tipo === 'nuevo') {
    nuevoCompaneroId = document.getElementById('select-nuevo-companero').value;
    if (!nuevoCompaneroId) return alert('Selecciona un usuario');
  }
  // Guardar solicitud en Firestore
  const docRef = await addDoc(collection(db, 'solicitudesCambioCompanero'), {
    equipoId: equipoUsuario.id,
    usuarioId: usuarioActual.uid,
    tipo: tipo,
    nuevoCompaneroId: nuevoCompaneroId || null,
    estado: 'pendiente',
    fecha: new Date()
  });
  idSolicitudCambio = docRef.id;
  solicitudCambioPendiente = true;
  marcarEquipoCambioPendiente();
  cerrarModalCambiarCompanero();
  alert('Solicitud enviada al administrador. Espera su aprobación.');
}

function marcarEquipoCambioPendiente() {
  const partnerName = document.getElementById('partner-name');
  if (partnerName) {
    partnerName.classList.add('equipo-cambio-pendiente');
    if (!partnerName.querySelector('.fa-exchange-alt')) {
      const icon = document.createElement('i');
      icon.className = 'fas fa-exchange-alt';
      partnerName.appendChild(icon);
    }
  }
}

function desmarcarEquipoCambioPendiente() {
  const partnerName = document.getElementById('partner-name');
  if (partnerName) {
    partnerName.classList.remove('equipo-cambio-pendiente');
    const icon = partnerName.querySelector('.fa-exchange-alt');
    if (icon) icon.remove();
  }
}

async function cancelarSolicitudCambio() {
  if (!idSolicitudCambio) return cerrarModalCambiarCompanero();
  await deleteDoc(doc(db, 'solicitudesCambioCompanero', idSolicitudCambio));
  solicitudCambioPendiente = false;
  idSolicitudCambio = null;
  desmarcarEquipoCambioPendiente();
  cerrarModalCambiarCompanero();
  alert('Solicitud cancelada.');
}

// Inicialización de eventos
function inicializarCambioCompanero() {
  const btn = document.getElementById('change-partner');
  if (btn) btn.onclick = mostrarModalCambiarCompanero;
  document.getElementById('close-modal-cambiar-companero').onclick = cerrarModalCambiarCompanero;
  document.getElementById('option-sin-companero').onclick = () => solicitarCambioCompanero('sin');
  document.getElementById('option-cambiar-companero').onclick = () => solicitarCambioCompanero('nuevo');
  document.getElementById('option-cancelar-cambio').onclick = cancelarSolicitudCambio;
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM cargado, inicializando aplicación...');
    try {
        // Inicializar funcionalidades que no requieren autenticación
        inicializarBusquedaUsuarios();
        
        // Inicializar funcionalidades que requieren autenticación
        await inicializarPerfil();
  inicializarCambioFotoPerfil();
  inicializarCambioCompanero();
        inicializarRetoAmigos();
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
    }
});

// Al cargar, comprobar si hay solicitud pendiente y marcar
async function comprobarSolicitudCambioPendiente() {
  if (!equipoUsuario || !usuarioActual) return;
  const q = query(collection(db, 'solicitudesCambioCompanero'), where('equipoId', '==', equipoUsuario.id), where('usuarioId', '==', usuarioActual.uid), where('estado', '==', 'pendiente'));
  const snap = await getDocs(q);
  if (!snap.empty) {
    solicitudCambioPendiente = true;
    idSolicitudCambio = snap.docs[0].id;
    marcarEquipoCambioPendiente();
  } else {
    solicitudCambioPendiente = false;
    idSolicitudCambio = null;
    desmarcarEquipoCambioPendiente();
  }
}
document.addEventListener('DOMContentLoaded', comprobarSolicitudCambioPendiente);

// --- BÚSQUEDA DE USUARIOS ---
async function cargarUsuarios() {
    console.log('=> Cargando usuarios para búsqueda...');
    try {
        const usuariosSnap = await getDocs(collection(db, "usuarios"));
        const usuarios = [];
        const usuarioActualId = auth.currentUser?.uid;
        
        usuariosSnap.forEach(doc => {
            const data = doc.data();
            // No mostrar el usuario actual y solo mostrar usuarios aprobados
            if (doc.id !== usuarioActualId && data.aprobado) {
                usuarios.push({
                    id: doc.id,
                    nombre: data.nombreUsuario || data.nombre || data.email.split('@')[0],
                    email: data.email,
                    nivel: data.nivel || '1.5',
                    fotoPerfil: data.fotoPerfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.nombreUsuario || data.email.split('@')[0])}&background=00a884&color=fff`
                });
            }
        });
        
        console.log(`✅ ${usuarios.length} usuarios cargados`);
        return usuarios.sort((a, b) => a.nombre.localeCompare(b.nombre)); // Ordenar alfabéticamente
    } catch (error) {
        console.error('❌ Error al cargar usuarios:', error);
        throw error; // Propagar el error para manejarlo en el nivel superior
    }
}

function mostrarUsuarios(usuarios) {
    const usuariosLista = document.getElementById('usuarios-lista');
    if (!usuariosLista) {
        console.error('❌ No se encontró el contenedor de usuarios');
        return;
    }
    
    usuariosLista.innerHTML = '';
    
    if (!usuarios || usuarios.length === 0) {
        usuariosLista.innerHTML = `
            <div class="no-usuarios">
                <i class="fas fa-search"></i>
                <span>No se encontraron usuarios. Intenta con otros términos de búsqueda.</span>
            </div>
        `;
        return;
    }
    
    usuarios.forEach(usuario => {
        const usuarioItem = document.createElement('div');
        usuarioItem.className = 'usuario-item';
        usuarioItem.innerHTML = `
            <div class="usuario-avatar">
                <img src="${usuario.fotoPerfil}" alt="${usuario.nombre}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.nombre)}&background=00a884&color=fff'">
            </div>
            <div class="usuario-info">
                <div class="usuario-nombre">${usuario.nombre}</div>
                <div class="usuario-email">${usuario.email}</div>
                <div class="usuario-nivel">
                    <span class="usuario-nivel-badge level-${usuario.nivel.toString().replace('.', '-')}">
                        ${usuario.nivel}
                    </span>
                </div>
            </div>
            <div class="usuario-accion">
                <i class="fas fa-arrow-right"></i>
            </div>
        `;
        
        // Agregar evento click para abrir perfil del usuario
        usuarioItem.addEventListener('click', () => {
            console.log('🖱️ Usuario seleccionado:', usuario.nombre);
            abrirPerfilUsuario(usuario.id, usuario.nombre);
        });
        
        usuariosLista.appendChild(usuarioItem);
    });
    
    console.log(`📋 Se mostraron ${usuarios.length} usuarios en la lista`);
}

function buscarUsuarios(usuarios, query) {
    if (!query.trim()) return usuarios;
    
    const queryLower = query.toLowerCase();
    return usuarios.filter(usuario => 
        usuario.nombre.toLowerCase().includes(queryLower) ||
        usuario.email.toLowerCase().includes(queryLower)
    );
}

function abrirPerfilUsuario(uid, nombre) {
    if (!uid || !nombre) {
        console.error('❌ Error: ID de usuario o nombre no proporcionado');
        return;
    }

    console.log('🔄 Abriendo perfil de usuario:', nombre);
    
    // Cerrar modal de búsqueda
    const modal = document.getElementById('modal-busqueda-usuarios');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Redirigir a la nueva página con el perfil del usuario
    try {
        const url = `perfil-usuario.html?uid=${encodeURIComponent(uid)}&nombre=${encodeURIComponent(nombre)}`;
        console.log('🔗 Redirigiendo a:', url);
        window.location.href = url;
    } catch (error) {
        console.error('❌ Error al redirigir:', error);
        alert('Error al abrir el perfil del usuario. Por favor, inténtalo de nuevo.');
    }
}

// Inicializar funcionalidad de búsqueda de usuarios
function inicializarBusquedaUsuarios() {
    console.log('🔍 Inicializando búsqueda de usuarios...');
    
    const btnBuscarUsuarios = document.getElementById('compare-profile');
    const modalBusqueda = document.getElementById('modal-busqueda-usuarios');
    const closeBusquedaModal = document.getElementById('close-busqueda-modal');
    const busquedaInput = document.getElementById('busqueda-input');
    const buscarBtn = document.getElementById('buscar-btn');
    
    console.log('🔍 Elementos encontrados:', {
        btnBuscarUsuarios: !!btnBuscarUsuarios,
        modalBusqueda: !!modalBusqueda,
        closeBusquedaModal: !!closeBusquedaModal,
        busquedaInput: !!busquedaInput,
        buscarBtn: !!buscarBtn
    });
    
    let usuariosCargados = [];
    
    if (btnBuscarUsuarios && modalBusqueda) {
        console.log('✅ Agregando event listener al botón de búsqueda');
        console.log('🔍 Botón encontrado:', btnBuscarUsuarios);
        console.log('🔍 Modal encontrado:', modalBusqueda);
        
        btnBuscarUsuarios.addEventListener('click', async () => {
            console.log('🖱️ Botón de búsqueda clickeado');
            console.log('🔍 Estado del modal antes de mostrar:', modalBusqueda.style.display);
            
            try {
                // Cambiar texto del botón
                btnBuscarUsuarios.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                btnBuscarUsuarios.disabled = true;
                
                // Cargar usuarios
                console.log('📥 Cargando usuarios...');
                usuariosCargados = await cargarUsuarios();
                console.log(`📊 ${usuariosCargados.length} usuarios cargados`);
                mostrarUsuarios(usuariosCargados);
                
                // Mostrar modal usando setProperty con !important
                console.log('🪟 Mostrando modal de búsqueda');
                document.body.style.overflow = 'hidden';
                modalBusqueda.style.setProperty('display', 'flex', 'important');
                console.log('🔍 Estado del modal después de mostrar:', modalBusqueda.style.display);
                
                // Restaurar botón
                btnBuscarUsuarios.innerHTML = '<i class="fas fa-search"></i> Buscar Perfil Jugador';
                btnBuscarUsuarios.disabled = false;
                
            } catch (error) {
                console.error('❌ Error al cargar usuarios:', error);
                alert('Error al cargar usuarios');
                btnBuscarUsuarios.innerHTML = '<i class="fas fa-search"></i> Buscar Perfil Jugador';
                btnBuscarUsuarios.disabled = false;
            }
        });
    } else {
        console.error('❌ No se encontraron elementos necesarios para la búsqueda');
        if (!btnBuscarUsuarios) console.error('❌ Botón compare-profile no encontrado');
        if (!modalBusqueda) console.error('❌ Modal modal-busqueda-usuarios no encontrado');
    }
    
    if (closeBusquedaModal && modalBusqueda) {
        closeBusquedaModal.addEventListener('click', () => {
            document.body.style.overflow = '';
            modalBusqueda.style.display = 'none';
        });
        
        // Cerrar modal al hacer click fuera
        modalBusqueda.addEventListener('click', (e) => {
            if (e.target === modalBusqueda) {
                document.body.style.overflow = '';
                modalBusqueda.style.display = 'none';
            }
        });
    }
    
    if (busquedaInput && buscarBtn) {
        const realizarBusqueda = () => {
            const query = busquedaInput.value.trim();
            const usuariosFiltrados = buscarUsuarios(usuariosCargados, query);
            mostrarUsuarios(usuariosFiltrados);
        };
        
        buscarBtn.addEventListener('click', realizarBusqueda);
        
        busquedaInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                realizarBusqueda();
            }
        });
        
        // Búsqueda en tiempo real
        busquedaInput.addEventListener('input', () => {
            const query = busquedaInput.value.trim();
            const usuariosFiltrados = buscarUsuarios(usuariosCargados, query);
            mostrarUsuarios(usuariosFiltrados);
        });
    }
    
    console.log('✅ Búsqueda de usuarios inicializada');
}

// Función para cargar perfil de otro usuario
async function cargarPerfilOtroUsuario(uid, nombre) {
    try {
        // Crear un usuario temporal con los datos básicos
        usuarioActual = {
            uid: uid,
            nombreUsuario: nombre,
            email: 'usuario@ejemplo.com', // Placeholder
            nivel: '1.5', // Se actualizará con datos reales
            fotoPerfil: `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=00a884&color=fff`
        };
        
        // Actualizar header para mostrar que es perfil de otro usuario
        actualizarHeaderPerfilOtroUsuario(nombre);
        
        // Cargar datos del usuario desde Firestore
        console.log('=> Cargando datos del usuario desde Firestore...');
        const userDoc = await getDoc(doc(db, 'usuarios', uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            usuarioActual = {
                ...usuarioActual,
                nombreUsuario: userData.nombreUsuario || userData.nombre || nombre,
                email: userData.email || 'usuario@ejemplo.com',
                nivel: userData.nivel || '1.5',
                fotoPerfil: userData.fotoPerfil || usuarioActual.fotoPerfil
            };
        }
        
        // Cargar datos básicos
        console.log('=> Cargando estadísticas del usuario...');
        await actualizarInformacionBasica();
        await obtenerEquipoUsuario();
        if (equipoUsuario) {
            console.log('=> Equipo encontrado:', equipoUsuario);
            await cargarEstadisticasPerfil();
            await cargarHistorialPartidosPerfil();
            await cargarEstadisticasPala();
            await cargarCompañeroYRivales();
        } else {
            console.warn('⚠️ No se encontró equipo para el usuario');
            await cargarEstadisticasBasicas();
        }
        
        // Ocultar elementos que no deben estar disponibles en modo lectura
        ocultarElementosEdicion();
        
        // Cargar datos adicionales
        cargarFamilyPoints();
        cargarLogros();
        await cargarInformacionLiga();
        await actualizarLigaExtendida();
        await cargarTorneosActuales();
        await cargarEstadisticasAmistosos();
        await cargarRetos();
        actualizarRetosJugados();
        
        console.log('✅ Perfil de otro usuario cargado completamente');
        
    } catch (error) {
        console.error('❌ Error al cargar perfil de otro usuario:', error);
        alert('Error al cargar el perfil del usuario. Por favor, recarga la página.');
    }
}

// Función para actualizar el header cuando se ve el perfil de otro usuario
function actualizarHeaderPerfilOtroUsuario(nombre) {
    const headerTitle = document.querySelector('.app-title');
    const headerContent = document.querySelector('.header-content');
    
    if (headerTitle) {
        headerTitle.textContent = `Perfil de ${nombre}`;
    }
    
    if (headerContent) {
        // Agregar botón de volver
        const btnVolver = document.createElement('button');
        btnVolver.className = 'btn-volver-perfil';
        btnVolver.innerHTML = '<i class="fas fa-arrow-left"></i>';
        btnVolver.title = 'Volver a mi perfil';
        btnVolver.onclick = () => {
            window.location.href = 'perfil.html';
        };
        
        // Insertar al inicio del header
        headerContent.insertBefore(btnVolver, headerContent.firstChild);
    }
}

// Función para ocultar elementos de edición en modo lectura
function ocultarElementosEdicion() {
    // Ocultar botones de acción
    const btnBuscarUsuarios = document.getElementById('compare-profile');
    const btnRetarAmigo = document.getElementById('challenge-friend');
    const btnCambiarCompanero = document.getElementById('change-partner');
    const btnCompararPala = document.getElementById('compare-paddle');
    const btnVerHistorial = document.getElementById('open-history-modal');
    
    if (btnBuscarUsuarios) btnBuscarUsuarios.style.display = 'none';
    if (btnRetarAmigo) btnRetarAmigo.style.display = 'none';
    if (btnCambiarCompanero) btnCambiarCompanero.style.display = 'none';
    if (btnCompararPala) btnCompararPala.style.display = 'none';
    if (btnVerHistorial) btnVerHistorial.style.display = 'none';
    
    // Ocultar overlay de cambio de foto
    const editOverlay = document.getElementById('edit-profile-pic');
    if (editOverlay) editOverlay.style.display = 'none';
    
    // Ocultar select de pala
    const paddleSelect = document.getElementById('paddle-select');
    if (paddleSelect) paddleSelect.style.display = 'none';
    
    // Ocultar acciones del compañero
    const partnerActions = document.querySelector('.partner-actions');
    if (partnerActions) partnerActions.style.display = 'none';
}