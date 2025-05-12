function mostrarSubmenu() {
  const submenu = document.getElementById("submenu");
  
  // Si está oculto, lo muestra; si está visible, lo oculta
  if (submenu.style.display === "none") {
      submenu.style.display = "block";
  } else {
      submenu.style.display = "none";
  }
}

// Asigna la función al clic de la imagen
document.getElementById("botonSubmenu").onclick = mostrarSubmenu;