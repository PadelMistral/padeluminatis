// menu.js
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.menu-hamburguesa');
  const menu = document.querySelector('.menu-navegacion');

  if (hamburger && menu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      menu.classList.toggle('active');
    });
  }
});
