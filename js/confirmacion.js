document.addEventListener("DOMContentLoaded", () => {
  // Campos del formulario
  const campos = {
    nombre:      document.getElementById("nombre"),
    correo:      document.getElementById("correo"),
    telefono:    document.getElementById("telefono"),
    usuario:     document.getElementById("usuario"),
    pala:        document.getElementById("pala"),
    compañero:   document.getElementById("compañero"),
    bloque:      document.getElementById("bloque"),
    piso:        document.getElementById("piso"),
    puerta:      document.getElementById("puerta")
  };

  // Input readonly donde mostramos el resumen
  const resumenInput = document.getElementById("resumen");

  // Función que construye y actualiza el texto del resumen
  function actualizarResumen() {
    const {
      nombre, correo, telefono, usuario,
      pala, compañero, bloque, piso, puerta
    } = campos;

    resumenInput.value = 
      `Nombre: ${nombre.value} | ` +
      `Email: ${correo.value} | ` +
      `Teléfono: ${telefono.value} | ` +
      `Usuario: ${usuario.value} | ` +
      `Pala: ${pala.value} | ` +
      `Pareja: ${compañero.value} | ` +
      `Vivienda: bloque ${bloque.value}, piso ${piso.value}, puerta ${puerta.value}`;
  }

  // Asociar eventos a todos los campos para que al cambiar dispara la actualización
  Object.values(campos).forEach(el => {
    // 'input' para texto, 'change' para selects
    const ev = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, actualizarResumen);
  });

  // Al cargar la página, generar resumen inicial (si hay valores por defecto)
  actualizarResumen();
});



document.addEventListener("DOMContentLoaded", () => {
  const successFrame = document.querySelector('iframe[name="submitFrame"]');
  const successMsg   = document.getElementById("success-message");
  const form         = document.querySelector("form");

  // Cada vez que el iframe termine de cargar la respuesta de Formspree:
  successFrame.addEventListener("load", () => {
    // Mostrar el mensaje de éxito
    successMsg.hidden = false;        // :contentReference[oaicite:2]{index=2}
    form.hidden      = true;
  });
});
