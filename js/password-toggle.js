export function initPasswordToggle() {
  const toggleButtons = document.querySelectorAll('.toggle-password');
  
  toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Buscar el input anterior (puede haber espacios, usar closest)
      let input = this.previousElementSibling;
      while (input && input.tagName !== 'INPUT') {
        input = input.previousElementSibling;
      }
      if (!input) return;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      // Cambiar el icono
      if (type === 'text') {
        this.classList.remove('fa-eye');
        this.classList.add('fa-eye-slash');
      } else {
        this.classList.remove('fa-eye-slash');
        this.classList.add('fa-eye');
      }
    });
  });
}

// Inicializar automáticamente si se importa como módulo principal
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initPasswordToggle);
} 