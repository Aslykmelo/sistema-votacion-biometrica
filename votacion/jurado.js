const API_URL = "http://localhost:3000";

const cedulaInput  = document.getElementById("cedula");
const nombreInput  = document.getElementById("nombre");
const biometria    = document.getElementById("biometria");
const mensaje      = document.getElementById("mensajeValidacion");
const estado       = document.getElementById("estadoJurado");
const btnEnviar    = document.getElementById("btnEnviar");
const btnCabina    = document.getElementById("btnAbrirCabina");

cedulaInput.addEventListener("input", () => {
  cedulaInput.value = cedulaInput.value.replace(/\D/g, "");
});

nombreInput.addEventListener("input", () => {
  nombreInput.value = nombreInput.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
});

async function verificarBackend() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.ok) { estado.textContent = "Mesa activa"; return true; }
  } catch {
    estado.textContent = "⚠ Backend no disponible";
  }
  return false;
}

function escanearBiometria() {
  estado.textContent  = "Escaneando...";
  mensaje.textContent = "Validando biometría...";
  setTimeout(() => {
    biometria.checked   = true;
    estado.textContent  = "Biometría OK";
    mensaje.textContent = "Biometría validada correctamente";
  }, 2000);
}

btnEnviar.addEventListener("click", async () => {
  const ced = cedulaInput.value.trim();
  const nom = nombreInput.value.trim();

  if (!/^\d{6,15}$/.test(ced)) { mensaje.textContent = "Cédula inválida"; return; }
  if (nom.length < 3)           { mensaje.textContent = "Nombre inválido"; return; }
  if (!biometria.checked)       { mensaje.textContent = "Debe validar biometría primero"; return; }

  mensaje.textContent    = "Consultando Registraduría...";
  estado.textContent     = "Consultando BD...";
  btnEnviar.disabled     = true;
  btnCabina.disabled     = true;

  try {
    const res  = await fetch(`${API_URL}/verificar`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ cedula: ced, id_jornada: 1 })
    });
    const data = await res.json();

    if (!data.ok) {
      mensaje.textContent = data.error || "Error al verificar";
      estado.textContent  = "Mesa activa";
      btnEnviar.disabled  = false;
      return;
    }

    if (data.identidad_verificada) {
      mensaje.textContent = "Este ciudadano ya votó en esta jornada";
      estado.textContent  = "Mesa activa";
      btnEnviar.disabled  = false;
      return;
    }

    localStorage.setItem("cedula", ced);
    localStorage.setItem("nombre", nom);

    estado.textContent     = "Aprobado ✓";
    mensaje.textContent    = "Ciudadano habilitado. Presione Abrir cabina.";
    btnCabina.disabled     = false;
    btnEnviar.disabled     = false;

  } catch (err) {
    console.warn("Backend no disponible:", err);
    mensaje.textContent = "⚠ Backend no disponible — modo sin conexión";
    estado.textContent  = "Sin conexión";

    localStorage.setItem("cedula", ced);
    localStorage.setItem("nombre", nom);

    btnCabina.disabled  = false;
    btnEnviar.disabled  = false;
  }
});

btnCabina.addEventListener("click", () => {
  window.location.href = "votacion.html";
});

function reiniciarMesa() {
  cedulaInput.value     = "";
  nombreInput.value     = "";
  biometria.checked     = false;
  btnEnviar.disabled    = false;
  btnCabina.disabled    = true;
  mensaje.textContent   = "";
  estado.textContent    = "Mesa activa";
}

window.addEventListener("load", verificarBackend);