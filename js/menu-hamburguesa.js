// menu.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Menu hamburguesa script cargado');
    
    const menuToggle = document.querySelector('.menu-toggle');
    const appNav = document.querySelector('.app-nav');
    const appMain = document.querySelector('.app-main');
    
    console.log('Elementos encontrados:', {
        menuToggle: menuToggle,
        appNav: appNav,
        appMain: appMain
    });
    
    if (!menuToggle) {
        console.error('No se encontró el botón menu-toggle');
        return;
    }
    
    if (!appNav) {
        console.error('No se encontró el elemento app-nav');
        return;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    // Estilos para el overlay
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(3px);
        z-index: 998;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    `;

    function toggleMenu() {
        console.log('Toggle menu llamado');
        const isOpen = appNav.classList.contains('active');
        console.log('Menú está abierto:', isOpen);
        console.log('Clases actuales del menú:', appNav.className);
        
        if (isOpen) {
            appNav.classList.remove('active');
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
            document.body.style.overflow = 'auto';
            console.log('Menú cerrado');
        } else {
            appNav.classList.add('active');
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
            document.body.style.overflow = 'hidden';
            console.log('Menú abierto');
        }
        
        console.log('Clases después del toggle:', appNav.className);
    }

    // Event listeners
    menuToggle.addEventListener('click', function(e) {
        console.log('Click en menu toggle detectado');
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
    });
    
    overlay.addEventListener('click', function(e) {
        console.log('Click en overlay');
        toggleMenu();
    });

    // Cerrar menú con la tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && appNav.classList.contains('active')) {
            console.log('Tecla Escape presionada');
            toggleMenu();
        }
    });

    // Cerrar menú al hacer clic en un enlace
    const navLinks = document.querySelectorAll('.app-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (appNav.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    console.log('Event listeners configurados correctamente');
});