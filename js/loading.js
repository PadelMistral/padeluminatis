// Loading espectacular para Padeluminatis
class SpectacularLoading {
  constructor() {
    this.loadingContainer = document.getElementById('loading-container');
    this.progressFill = document.querySelector('.progress-fill');
    this.progressPercentage = document.querySelector('.progress-percentage');
    this.currentProgress = 0;
    this.isLoading = true;
  }

  // Iniciar el loading
  start() {
    this.loadingContainer.style.display = 'flex';
    this.simulateProgress();
  }

  // Simular progreso de 0% a 100%
  simulateProgress() {
    const interval = setInterval(() => {
      this.currentProgress += Math.random() * 15 + 5; // Incremento aleatorio entre 5-20%
      
      if (this.currentProgress >= 100) {
        this.currentProgress = 100;
        clearInterval(interval);
        this.complete();
      }

      this.updateProgress(this.currentProgress);
    }, 200); // Actualizar cada 200ms
  }

  // Actualizar la barra de progreso
  updateProgress(percentage) {
    this.progressFill.style.width = `${percentage}%`;
    this.progressPercentage.textContent = `${Math.round(percentage)}%`;
    
    // Cambiar el texto según el progreso
    const subtitle = document.querySelector('.loading-subtitle');
    if (percentage < 25) {
      subtitle.textContent = 'Inicializando sistema...';
    } else if (percentage < 50) {
      subtitle.textContent = 'Cargando datos...';
    } else if (percentage < 75) {
      subtitle.textContent = 'Conectando servidores...';
    } else if (percentage < 100) {
      subtitle.textContent = 'Finalizando...';
    } else {
      subtitle.textContent = '¡Listo!';
    }
  }

  // Completar el loading
  complete() {
    setTimeout(() => {
      this.loadingContainer.classList.add('fade-out');
      
      setTimeout(() => {
        this.loadingContainer.style.display = 'none';
        this.isLoading = false;
        
        // Mostrar el formulario de login
        const loginContainer = document.querySelector('.contenedor-login');
        if (loginContainer) {
          loginContainer.style.display = 'flex';
          loginContainer.style.animation = 'fadeIn 0.7s cubic-bezier(.4,0,.2,1)';
        }
      }, 500);
    }, 1000);
  }

  // Ocultar el loading inmediatamente (para desarrollo)
  hide() {
    this.loadingContainer.style.display = 'none';
    this.isLoading = false;
    
    const loginContainer = document.querySelector('.contenedor-login');
    if (loginContainer) {
      loginContainer.style.display = 'flex';
    }
  }
}

// Inicializar el loading cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
  const loading = new SpectacularLoading();
  
  // Ocultar el formulario de login inicialmente
  const loginContainer = document.querySelector('.contenedor-login');
  if (loginContainer) {
    loginContainer.style.display = 'none';
  }
  
  // Iniciar el loading
  loading.start();
  
  // Para desarrollo: presionar 'L' para saltar el loading
  document.addEventListener('keydown', (e) => {
    if (e.key === 'l' || e.key === 'L') {
      loading.hide();
    }
  });
}); 