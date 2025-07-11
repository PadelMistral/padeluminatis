import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, doc, getDocs, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

// Datos de ejemplo para la demostración
const sampleEvents = [
    {
        id: 1,
        name: "Torneo de Verano",
        type: "tournament",
        format: "group+elimination",
        startDate: "2023-07-15T10:00",
        endDate: "2023-07-16T20:00",
        registrationEnd: "2023-07-10T23:59",
        minLevel: 2,
        maxLevel: 4,
        registrationType: "team",
        entryFee: 10,
        description: "El torneo más esperado del verano. Partidos emocionantes y premios para los ganadores. Se jugará en las pistas centrales del club.",
        rules: "Partidos a 2 sets con tie-break en caso de empate. Puntuación tradicional. Se requiere vestimenta deportiva adecuada.",
        maxParticipants: 32,
        currentParticipants: 24,
        creator: "admin",
        status: "open",
        participants: [
            { id: "user1", name: "Carlos Martínez", level: 3, partner: "user2" },
            { id: "user2", name: "Ana López", level: 3, partner: "user1" },
            { id: "user3", name: "David García", level: 4, partner: "user4" },
            { id: "user4", name: "Sofía Rodríguez", level: 4, partner: "user3" },
            { id: "user5", name: "Javier Fernández", level: 3, partner: "user6" },
            { id: "user6", name: "Laura Sánchez", level: 3, partner: "user5" }
        ],
        matches: [],
        bracket: [],
        currentPhase: "Cuartos de final",
        scoringType: "standard"
    },
    {
        id: 2,
        name: "Liga Invierno",
        type: "league",
        format: "group",
        startDate: "2023-08-01T18:00",
        endDate: "2023-09-30T22:00",
        registrationEnd: "2023-07-25T23:59",
        minLevel: 3,
        maxLevel: 5,
        registrationType: "preferences",
        entryFee: 25,
        description: "Liga de invierno con partidos semanales. Todos contra todos durante 8 semanas. Premios para los tres primeros clasificados.",
        rules: "Sistema de puntuación: 3 puntos por victoria, 1 por derrota con más de 8 juegos ganados. En caso de empate se jugará un tie-break.",
        maxParticipants: 20,
        currentParticipants: 18,
        creator: "padelMaster",
        status: "open",
        participants: [
            { id: "user7", name: "Miguel Ángel", level: 4, partner: null },
            { id: "user8", name: "Elena Vargas", level: 5, partner: null },
            { id: "user9", name: "Roberto Jiménez", level: 4, partner: null }
        ],
        matches: [],
        standings: [],
        scoringType: "standard"
    },
    {
        id: 3,
        name: "Torneo Relámpago",
        type: "tournament",
        format: "elimination",
        startDate: "2023-07-08T09:00",
        endDate: "2023-07-08T18:00",
        registrationEnd: "2023-07-05T23:59",
        minLevel: 1,
        maxLevel: 0,
        registrationType: "individual",
        entryFee: 5,
        description: "Torneo rápido de un día. Perfecto para jugadores que buscan acción rápida. Se jugarán múltiples partidos simultáneamente.",
        rules: "Partidos a un set con tie-break en el 6-6. Sin ventaja. Se asignarán parejas aleatoriamente.",
        maxParticipants: 16,
        currentParticipants: 16,
        creator: "eventOrganizer",
        status: "closed",
        participants: [],
        matches: [],
        bracket: [],
        currentPhase: "Final",
        scoringType: "fast"
    },
    {
        id: 4,
        name: "Torneo Nivel Avanzado",
        type: "tournament",
        format: "group+elimination",
        startDate: "2023-07-22T10:00",
        endDate: "2023-07-23T20:00",
        registrationEnd: "2023-07-18T23:59",
        minLevel: 4,
        maxLevel: 5,
        registrationType: "team",
        entryFee: 15,
        description: "Exclusivo para jugadores de nivel avanzado. Alta competencia y premios especiales. Patrocinado por PadelPro.",
        rules: "Partidos a 3 sets. Puntuación tradicional. Se permiten 2 tiempos muertos por set. Árbitro oficial en todas las pistas.",
        maxParticipants: 16,
        currentParticipants: 10,
        creator: "proPlayer",
        status: "open",
        participants: [],
        matches: [],
        bracket: [],
        currentPhase: "Fase de grupos",
        scoringType: "pro"
    },
    {
        id: 5,
        name: "Liga Social de Pádel",
        type: "league",
        format: "group",
        startDate: "2023-07-01T18:00",
        endDate: "2023-09-01T22:00",
        registrationEnd: "2023-06-25T23:59",
        minLevel: 1,
        maxLevel: 3,
        registrationType: "team",
        entryFee: 0,
        description: "Liga social para jugadores de todos los niveles. Enfocada en diversión y práctica. Sin presión competitiva.",
        rules: "Partidos a 2 sets. Se recomienda puntuación tradicional pero se permite consenso entre jugadores. Sin premios en metálico.",
        maxParticipants: 40,
        currentParticipants: 35,
        creator: "clubManager",
        status: "in-progress",
        participants: [],
        matches: [
            {
                id: 1,
                player1: { id: "user10", name: "Pablo Ruiz" },
                player2: { id: "user11", name: "Marta Gómez" },
                date: "2023-07-10T18:00",
                court: "Pista 3",
                status: "scheduled",
                sets: []
            },
            {
                id: 2,
                player1: { id: "user12", name: "Jorge Martín" },
                player2: { id: "user13", name: "Lucía Díaz" },
                date: "2023-07-11T19:00",
                court: "Pista 1",
                status: "completed",
                sets: [[6, 4], [7, 5]]
            }
        ],
        standings: [
            { position: 1, player: "Jorge Martín", played: 5, won: 4, lost: 1, setsWon: 8, setsLost: 3, points: 12 },
            { position: 2, player: "Marta Gómez", played: 5, won: 3, lost: 2, setsWon: 7, setsLost: 4, points: 10 },
            { position: 3, player: "Pablo Ruiz", played: 5, won: 3, lost: 2, setsWon: 6, setsLost: 5, points: 9 }
        ],
        scoringType: "standard"
    }
];

// Estado de la aplicación
const appState = {
    currentUser: {
        id: "user123",
        name: "Juan Pérez",
        level: 3,
        role: "creador", // Puede ser 'jugador', 'creador' o 'admin'
        credits: 50
    },
    events: [],
    editingEvent: null,
    currentEvent: null
};

// Función para formatear fechas
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('es-ES', options);
}

// Función para determinar si un evento está abierto
function isEventOpen(event) {
    const now = new Date();
    const registrationEnd = new Date(event.registrationEnd);
    return now < registrationEnd && event.currentParticipants < event.maxParticipants;
}

// Función para obtener el estado del evento
function getEventStatus(event) {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    
    if (now > end) return "completed";
    if (now > start) return "in-progress";
    if (!isEventOpen(event)) return "closed";
    return "open";
}

// Función para renderizar eventos
function renderEvents() {
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';
    
    if (appState.events.length === 0) {
        eventsList.innerHTML = `
            <div class="no-events">
                <i class="fas fa-calendar-times fa-3x" style="margin-bottom: 1rem;"></i>
                <h3>No hay eventos disponibles</h3>
                <p>Actualmente no hay eventos programados. Vuelve más tarde o crea un nuevo evento.</p>
            </div>
        `;
        return;
    }
    
    appState.events.forEach(event => {
        const status = getEventStatus(event);
        const isOpen = status === "open";
        const userLevel = appState.currentUser.level;
        const canJoin = isOpen && 
            (event.minLevel === 0 || userLevel >= event.minLevel) && 
            (event.maxLevel === 0 || userLevel <= event.maxLevel);
        
        const eventElement = document.createElement('div');
        eventElement.className = 'event-card';
        
        eventElement.innerHTML = `
            <div class="event-header">
                <span class="event-status ${isOpen ? 'status-open' : status === 'in-progress' ? 'status-in-progress' : status === 'completed' ? 'status-completed' : 'status-closed'}">
                    ${isOpen ? 'ABIERTO' : status === 'in-progress' ? 'EN CURSO' : status === 'completed' ? 'FINALIZADO' : 'CERRADO'}
                </span>
                <h3 class="event-title">${event.name}</h3>
                <p class="event-date">
                    <i class="far fa-calendar-alt"></i> ${formatDate(event.startDate)} 
                    ${event.type === 'league' ? 'al ' + formatDate(event.endDate) : ''}
                </p>
            </div>
            <div class="event-details">
                <div class="event-info">
                    <span><i class="fas fa-${event.type === 'tournament' ? 'trophy' : 'list-ol'}"></i> ${event.type === 'tournament' ? 'Torneo' : 'Liga'}</span>
                    <span><i class="fas fa-users"></i> ${event.currentParticipants}/${event.maxParticipants} inscritos</span>
                </div>
                <div class="event-info">
                    <span>
                        <i class="fas fa-${event.registrationType === 'team' ? 'user-friends' : event.registrationType === 'individual' ? 'user' : 'star'}"></i>
                        ${event.registrationType === 'team' ? 'Parejas' : event.registrationType === 'individual' ? 'Individual' : 'Con preferencias'}
                    </span>
                    <span>
                        <i class="fas fa-${event.entryFee > 0 ? 'euro-sign' : 'gift'}"></i>
                        <span class="badge ${event.entryFee > 0 ? 'badge-paid' : 'badge-free'}">
                            ${event.entryFee > 0 ? event.entryFee + '€' : 'GRATIS'}
                        </span>
                    </span>
                </div>
                <div class="event-info">
                    <span class="tooltip">
                        Nivel: 
                        <div class="level-indicator">
                            ${[1,2,3,4,5].map(lvl => `
                                <div class="level-dot ${lvl >= event.minLevel && (event.maxLevel === 0 || lvl <= event.maxLevel) ? 'active' : ''}"></div>
                            `).join('')}
                        </div>
                        <span class="tooltiptext">
                            ${event.minLevel > 0 ? `Mínimo: ${event.minLevel}` : 'Sin mínimo'} 
                            ${event.maxLevel > 0 ? `Máximo: ${event.maxLevel}` : 'Sin máximo'}
                        </span>
                    </span>
                    <span><i class="far fa-clock"></i> Cierre: ${formatDate(event.registrationEnd)}</span>
                </div>
                <p class="event-description">${event.description}</p>
                <div class="event-actions">
                    <button class="btn btn-primary event-details-btn" data-id="${event.id}">
                        <i class="fas fa-info-circle"></i> Detalles
                    </button>
                    ${canJoin ? `
                        <button class="btn btn-accent join-event-btn" data-id="${event.id}">
                            <i class="fas fa-user-plus"></i> Unirse
                        </button>
                    ` : `
                        <button class="btn btn-disabled" ${isOpen ? 'title="No cumples con los requisitos de nivel"' : 'title="Inscripciones cerradas"'} disabled>
                            <i class="fas fa-lock"></i> No disponible
                        </button>
                    `}
                </div>
            </div>
        `;
        
        eventsList.appendChild(eventElement);
    });
    
    // Añadir event listeners a los botones
    document.querySelectorAll('.event-details-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const eventId = btn.getAttribute('data-id');
            showEventDetails(eventId);
        });
    });
    
    document.querySelectorAll('.join-event-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const eventId = btn.getAttribute('data-id');
            joinEvent(eventId);
        });
    });
}

// Función para mostrar detalles del evento
function showEventDetails(eventId) {
    const event = appState.events.find(e => e.id == eventId);
    if (!event) return;
    
    appState.currentEvent = event;
    
    const modal = document.getElementById('eventDetailsModal');
    const status = getEventStatus(event);
    const isCreator = event.creator === appState.currentUser.id || appState.currentUser.role === 'admin';
    
    // Actualizar información del evento
    document.getElementById('eventDetailsTitle').textContent = event.name;
    document.getElementById('detail-type').textContent = event.type === 'tournament' ? 'Torneo' : 'Liga';
    document.getElementById('detail-format').textContent = 
        event.format === 'elimination' ? 'Solo eliminatorias' : 
        event.format === 'group+elimination' ? 'Liguilla + Eliminatorias' : 
        'Solo liguilla';
    document.getElementById('detail-start').textContent = formatDate(event.startDate);
    document.getElementById('detail-end').textContent = formatDate(event.endDate);
    document.getElementById('detail-registration').textContent = formatDate(event.registrationEnd);
    document.getElementById('detail-participants').textContent = `${event.currentParticipants}/${event.maxParticipants}`;
    document.getElementById('detail-levels').textContent = 
        `${event.minLevel > 0 ? 'Mínimo: ' + event.minLevel : 'Sin mínimo'} / ${event.maxLevel > 0 ? 'Máximo: ' + event.maxLevel : 'Sin máximo'}`;
    document.getElementById('detail-fee').textContent = event.entryFee > 0 ? event.entryFee + '€' : 'Gratis';
    document.getElementById('detail-description').textContent = event.description;
    document.getElementById('detail-rules').textContent = event.rules || 'Estándar del club';
    
    if (event.type === 'tournament' || event.format.includes('elimination')) {
        document.getElementById('current-phase').textContent = event.currentPhase || 'Fase de grupos';
        document.getElementById('tournament-phase-info').style.display = 'block';
    } else {
        document.getElementById('tournament-phase-info').style.display = 'none';
    }
    
    // Actualizar botones según permisos
    const joinBtn = document.getElementById('joinEventBtn');
    const editBtn = document.getElementById('editEventBtn');
    const deleteBtn = document.getElementById('deleteEventBtn');
    const startBtn = document.getElementById('startEventBtn');
    const closeRegBtn = document.getElementById('closeRegistrationBtn');
    
    joinBtn.style.display = status === 'open' ? 'inline-block' : 'none';
    editBtn.style.display = isCreator ? 'inline-block' : 'none';
    deleteBtn.style.display = isCreator ? 'inline-block' : 'none';
    startBtn.style.display = (isCreator && status === 'closed' && event.participants.length > 0) ? 'inline-block' : 'none';
    closeRegBtn.style.display = (isCreator && status === 'open') ? 'inline-block' : 'none';
    
    // Actualizar participantes
    renderParticipants(event);
    
    // Actualizar bracket si es torneo
    if (event.type === 'tournament' || event.format.includes('elimination')) {
        renderTournamentBracket(event);
    }
    
    // Actualizar tabla de liga si es liga
    if (event.type === 'league' || event.format.includes('group')) {
        renderLeagueTable(event);
    }
    
    // Actualizar partidos programados
    renderScheduledMatches(event);
    
    // Mostrar modal
    modal.style.display = 'block';
}

// Función para renderizar participantes
function renderParticipants(event) {
    const participantsList = document.getElementById('participantsList');
    const noParticipants = document.getElementById('noParticipants');
    
    participantsList.innerHTML = '';
    
    if (event.participants.length === 0) {
        noParticipants.style.display = 'block';
        return;
    }
    
    noParticipants.style.display = 'none';
    
    event.participants.forEach(participant => {
        const participantElement = document.createElement('div');
        participantElement.className = 'participant-card';
        
        const name = participant.partner ? 
            `${participant.name} & ${event.participants.find(p => p.id === participant.partner)?.name || 'Sin pareja'}` : 
            participant.name;
        
        participantElement.innerHTML = `
            <div class="participant-avatar">
                ${participant.name.charAt(0)}
            </div>
            <div class="participant-info">
                <h4>${name}</h4>
                <span>Nivel ${participant.level}</span>
            </div>
        `;
        
        participantsList.appendChild(participantElement);
    });
}

// Función para unirse a un evento
function joinEvent(eventId) {
    const event = appState.events.find(e => e.id == eventId);
    if (!event) return;
    
    if (confirm(`¿Deseas unirte al evento "${event.name}"?${event.entryFee > 0 ? `\n\nCosto de inscripción: ${event.entryFee}€` : ''}`)) {
        // Simular unirse al evento
        event.currentParticipants++;
        
        // Añadir usuario como participante
        event.participants.push({
            id: appState.currentUser.id,
            name: appState.currentUser.name,
            level: appState.currentUser.level,
            partner: null
        });
        
        renderEvents();
        alert(`¡Te has unido con éxito al evento "${event.name}"!`);
        
        // Si es el creador, actualizar detalles del evento
        if (appState.currentEvent && appState.currentEvent.id === event.id) {
            renderParticipants(event);
        }
    }
}

// Función para abrir el modal de creación de evento
function openEventModal(event = null) {
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('eventForm');
    
    if (event) {
        modalTitle.textContent = 'Editar evento';
        // Rellenar el formulario con los datos del evento
        document.getElementById('eventName').value = event.name;
        document.getElementById('eventType').value = event.type;
        document.getElementById('eventFormat').value = event.format;
        document.getElementById('startDate').value = event.startDate.replace(' ', 'T');
        document.getElementById('endDate').value = event.endDate.replace(' ', 'T');
        document.getElementById('registrationEnd').value = event.registrationEnd.replace(' ', 'T');
        document.getElementById('minLevel').value = event.minLevel;
        document.getElementById('maxLevel').value = event.maxLevel;
        document.getElementById('maxParticipants').value = event.maxParticipants;
        document.getElementById('entryFee').value = event.entryFee;
        document.getElementById('eventDescription').value = event.description;
        document.getElementById('eventRules').value = event.rules || '';
        
        // Seleccionar el tipo de inscripción
        document.querySelectorAll('input[name="registrationType"]').forEach(radio => {
            if (radio.value === event.registrationType) {
                radio.checked = true;
            }
        });
        
        // Seleccionar el sistema de puntuación
        document.querySelectorAll('input[name="scoringType"]').forEach(radio => {
            if (radio.value === event.scoringType) {
                radio.checked = true;
            }
        });
        
        appState.editingEvent = event.id;
    } else {
        modalTitle.textContent = 'Crear nuevo evento';
        form.reset();
        appState.editingEvent = null;
    }
    
    modal.style.display = 'block';
}

// Función para cargar eventos desde Firestore
async function loadEvents() {
    const eventsCol = collection(db, 'eventos');
    const eventsSnapshot = await getDocs(eventsCol);
    appState.events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderEvents();
}

// Modificar saveEvent para guardar en Firestore
async function saveEvent() {
    const form = document.getElementById('eventForm');
    if (!form.checkValidity()) {
        alert('Por favor, completa todos los campos obligatorios');
        return;
    }
    
    const eventData = {
        name: document.getElementById('eventName').value,
        type: document.getElementById('eventType').value,
        format: document.getElementById('eventFormat').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        registrationEnd: document.getElementById('registrationEnd').value,
        minLevel: parseInt(document.getElementById('minLevel').value),
        maxLevel: parseInt(document.getElementById('maxLevel').value),
        maxParticipants: parseInt(document.getElementById('maxParticipants').value),
        registrationType: document.querySelector('input[name="registrationType"]:checked').value,
        entryFee: parseFloat(document.getElementById('entryFee').value),
        description: document.getElementById('eventDescription').value,
        rules: document.getElementById('eventRules').value,
        currentParticipants: 0,
        status: "open",
        creator: appState.currentUser.id,
        participants: [],
        matches: [],
        bracket: [],
        standings: []
    };

    try {
        if (appState.editingEvent) {
            // Actualizar evento existente
            const eventRef = doc(db, 'eventos', appState.editingEvent);
            await updateDoc(eventRef, eventData);
        } else {
            // Crear nuevo evento
            await addDoc(collection(db, 'eventos'), eventData);
        }
        closeEventModal();
        await loadEvents();
        alert(`Evento "${eventData.name}" guardado con éxito!`);
    } catch (error) {
        alert('Error al guardar el evento: ' + error.message);
    }
}

// Función para cerrar inscripciones manualmente
function closeEventRegistration() {
    if (appState.currentEvent) {
        appState.currentEvent.status = "closed";
        alert("Inscripciones cerradas para el evento: " + appState.currentEvent.name);
        renderEvents();
        
        // Si hay suficientes participantes, mostrar botón para iniciar evento
        if (appState.currentEvent.participants.length >= 4) {
            document.getElementById('startEventBtn').style.display = 'inline-block';
        }
    }
}

// Función para iniciar el evento
function startEvent() {
    if (appState.currentEvent) {
        // Generar estructura del evento según el tipo
        if (appState.currentEvent.type === 'tournament') {
            // Generar bracket para torneo
            alert("Torneo iniciado! Se ha generado el bracket de competición.");
            appState.currentEvent.status = "in-progress";
            
            // Aquí iría la lógica para generar el bracket real
            appState.currentEvent.currentPhase = "Octavos de final";
        } else if (appState.currentEvent.type === 'league') {
            // Generar calendario para liga
            alert("Liga iniciada! Se ha generado el calendario de partidos.");
            appState.currentEvent.status = "in-progress";
            
            // Generar partidos de ejemplo
            appState.currentEvent.matches = [
                {
                    id: 1,
                    player1: { id: "user1", name: "Carlos Martínez" },
                    player2: { id: "user2", name: "Ana López" },
                    date: "2023-07-15T18:00",
                    court: "Pista 1",
                    status: "scheduled",
                    sets: []
                },
                {
                    id: 2,
                    player1: { id: "user3", name: "David García" },
                    player2: { id: "user4", name: "Sofía Rodríguez" },
                    date: "2023-07-16T19:00",
                    court: "Pista 2",
                    status: "scheduled",
                    sets: []
                }
            ];
            
            // Generar clasificación inicial
            appState.currentEvent.standings = appState.currentEvent.participants.map(p => ({
                position: 0,
                player: p.name,
                played: 0,
                won: 0,
                lost: 0,
                setsWon: 0,
                setsLost: 0,
                points: 0
            }));
        }
        
        renderEvents();
        showEventDetails(appState.currentEvent.id);
    }
}

// Función para cerrar el modal
function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
}

function closeDetailsModal() {
    document.getElementById('eventDetailsModal').style.display = 'none';
}

// Función temporal para migrar la liga actual a un evento
async function migrarLigaActualComoEvento() {
  // 1. Crear el evento 'Liga Verano' en la colección 'eventos'
  const calendarioSnap = await getDocs(collection(db, 'calendario'));
  let participantesSet = new Set();
  let minFecha = null, maxFecha = null;
  let partidosTotales = 0;
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partido = partidoDoc.data();
      if (partido.equipoLocal) participantesSet.add(partido.equipoLocal);
      if (partido.equipoVisitante) participantesSet.add(partido.equipoVisitante);
      if (partido.fecha && partido.fecha.toDate) {
        const fecha = partido.fecha.toDate();
        if (!minFecha || fecha < minFecha) minFecha = fecha;
        if (!maxFecha || fecha > maxFecha) maxFecha = fecha;
      }
      partidosTotales++;
    }
  }
  const participantes = Array.from(participantesSet).map(id => ({ id }));
  const eventoData = {
    name: 'Liga Verano',
    type: 'league',
    format: 'group',
    startDate: minFecha ? minFecha.toISOString() : '',
    endDate: maxFecha ? maxFecha.toISOString() : '',
    registrationEnd: '',
    minLevel: 1,
    maxLevel: 5,
    maxParticipants: participantes.length,
    registrationType: 'team',
    entryFee: 0,
    description: 'Migrado automáticamente desde la colección calendario',
    rules: '',
    currentParticipants: participantes.length,
    status: 'in-progress',
    creator: 'admin',
    participants: participantes,
    matches: [],
    bracket: [],
    standings: []
  };
  const eventoRef = await addDoc(collection(db, 'eventos'), eventoData);
  const eventoId = eventoRef.id;
  // 2. Actualizar todos los partidos para que tengan eventoId
  for (const jornadaDoc of calendarioSnap.docs) {
    const partidosSnap = await getDocs(collection(db, `calendario/${jornadaDoc.id}/partidos`));
    for (const partidoDoc of partidosSnap.docs) {
      const partidoRef = doc(db, `calendario/${jornadaDoc.id}/partidos/${partidoDoc.id}`);
      await updateDoc(partidoRef, { eventoId });
    }
  }
  alert('Migración completada: Liga Verano creada y partidos actualizados.');
}

// Solo para admin: ejecuta la migración desde la consola del navegador
window.migrarLigaActualComoEvento = migrarLigaActualComoEvento;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
    await loadEvents();
    
    // Configurar botón de creación de evento
    document.getElementById('createEventBtn').addEventListener('click', () => {
        if (appState.currentUser.role === 'jugador') {
            alert('Solo los creadores y administradores pueden crear eventos');
            return;
        }
        openEventModal();
    });
    
    // Configurar cierre de modales
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeEventModal();
            closeDetailsModal();
        });
    });
    
    document.getElementById('cancelEventBtn').addEventListener('click', closeEventModal);
    
    // Configurar guardado de evento
    document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
    
    // Configurar botones en el modal de detalles
    document.getElementById('joinEventBtn').addEventListener('click', () => {
        if (appState.currentEvent) {
            joinEvent(appState.currentEvent.id);
        }
    });
    
    document.getElementById('editEventBtn').addEventListener('click', () => {
        if (appState.currentEvent) {
            closeDetailsModal();
            openEventModal(appState.currentEvent);
        }
    });
    
    document.getElementById('deleteEventBtn').addEventListener('click', () => {
        if (appState.currentEvent && confirm(`¿Estás seguro de eliminar el evento "${appState.currentEvent.name}"?`)) {
            const index = appState.events.findIndex(e => e.id === appState.currentEvent.id);
            if (index !== -1) {
                appState.events.splice(index, 1);
                closeDetailsModal();
                renderEvents();
                alert("Evento eliminado con éxito");
            }
        }
    });
    
    document.getElementById('startEventBtn').addEventListener('click', startEvent);
    
    document.getElementById('closeRegistrationBtn').addEventListener('click', closeEventRegistration);
});