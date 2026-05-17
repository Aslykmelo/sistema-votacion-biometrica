// =============================================================
// CONFIGURACIÓN DE LA API
// =============================================================
const API_URL = "http://localhost:3000";

// =============================================================
// VARIABLES DEL DOM
// =============================================================
const btnValidar         = document.getElementById("btnValidar");
const mensajeValidacion  = document.getElementById("mensajeValidacion");
const seccionVoto        = document.getElementById("seccionVoto");
const seccionFinal       = document.getElementById("seccionFinal");
const votanteNombre      = document.getElementById("votanteNombre");
const votanteCedula      = document.getElementById("votanteCedula");
const textoConfirmacion  = document.getElementById("textoConfirmacion");
const modal              = document.getElementById("modalConfirmacion");
const btnCancelar        = document.getElementById("btnCancelar");
const btnConfirmar       = document.getElementById("btnConfirmar");
const btnSalir           = document.getElementById("btnSalir");
const btnAyuda           = document.getElementById("btnAyuda");
const resumenVoto        = document.getElementById("resumenVoto");
const contador           = document.getElementById("contador");
const timerFill          = document.getElementById("timerFill");
const estadoSistema      = document.getElementById("estadoSistema");
const txBlockchain       = document.getElementById("txBlockchain");

const cedulaInput    = document.getElementById("cedula");
const nombreInput    = document.getElementById("nombre");
const biometriaInput = document.getElementById("biometria");

// =============================================================
// VALIDACIONES DE INPUT
// =============================================================
cedulaInput.addEventListener("input", () => {
  cedulaInput.value = cedulaInput.value.replace(/[^0-9]/g, "");
});

nombreInput.addEventListener("input", () => {
  nombreInput.value = nombreInput.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
});

// =============================================================
// ESTADO DEL SISTEMA
// =============================================================
let candidatoSeleccionado = "";
let timerInterval         = null;
let totalSegundos         = 5 * 60;
let segundosRestantes     = totalSegundos;
let votacionActiva        = false;
let idCandidatoSeleccionado = null;

// Mapa nombre del candidato → id_candidato en la BD
const CANDIDATOS_ID = {
  "Candidato 1": 1,
  "Candidato 2": 2,
  "Candidato 3": 3,
  "Candidato 4": 4,
  "Candidato 5": 5,
  "Candidato 6": 6,
  "Blanco":      7
};

// =============================================================
// BIOMETRÍA (simulada)
// =============================================================
function escanearBiometria() {
  estadoSistema.textContent = "Escaneando rostro...";
  setTimeout(() => {
    biometriaInput.checked = true;
    estadoSistema.textContent = "Biometría verificada";
  }, 3000);
}

// =============================================================
// MENSAJES
// =============================================================
function mostrarMensaje(texto, tipo = "normal") {
  mensajeValidacion.textContent = texto;
  mensajeValidacion.style.color =
    tipo === "error" ? "#ff9a9a" :
    tipo === "ok"    ? "#7ff0cf" :
                       "#b9c7d9";
}

// =============================================================
// TIMER
// =============================================================
function formatearTiempo(segundos) {
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

function iniciarTemporizador() {
  clearInterval(timerInterval);
  segundosRestantes = totalSegundos;

  timerInterval = setInterval(() => {
    if (!votacionActiva) return;
    segundosRestantes--;
    contador.textContent = formatearTiempo(segundosRestantes);
    timerFill.style.width = `${(segundosRestantes / totalSegundos) * 100}%`;

    if (segundosRestantes < 60) {
      timerFill.style.background = "red";
    } else if (segundosRestantes < 120) {
      timerFill.style.background = "orange";
    }

    if (segundosRestantes === 60) {
      alert("El jurado debe asistir al ciudadano");
    }

    if (segundosRestantes <= 0) {
      registrarVoto("Blanco", true);
    }
  }, 1000);
}

// =============================================================
// VERIFICAR HEALTH DEL BACKEND
// =============================================================
async function verificarBackend() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (res.ok) {
      estadoSistema.textContent = "Sistema activo";
      return true;
    }
  } catch {
    estadoSistema.textContent = "⚠ Backend no disponible";
    console.warn("No se pudo conectar al backend Flask en", API_URL);
  }
  return false;
}

// =============================================================
// VALIDACIÓN DEL CIUDADANO (consulta la BD real)
// =============================================================
btnValidar.addEventListener("click", async () => {
  const cedula     = cedulaInput.value.trim();
  const nombre     = nombreInput.value.trim();
  const biometria  = biometriaInput.checked;

  // Validaciones locales
  if (!/^\d{6,15}$/.test(cedula)) {
    mostrarMensaje("Cédula inválida", "error");
    return;
  }
  if (nombre.length < 3) {
    mostrarMensaje("Nombre inválido", "error");
    return;
  }
  if (!biometria) {
    mostrarMensaje("Debe validar biometría", "error");
    return;
  }

  mostrarMensaje("Validando con la Registraduría...", "normal");
  btnValidar.disabled = true;
  estadoSistema.textContent = "Consultando BD...";

  try {
    // Verificar si el ciudadano ya votó usando el endpoint /verificar
    const res = await fetch(`${API_URL}/verificar`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ cedula, id_jornada: 1 })
    });

    const data = await res.json();

    if (!data.ok) {
      mostrarMensaje(data.error || "Error al verificar", "error");
      btnValidar.disabled = false;
      estadoSistema.textContent = "Sistema activo";
      return;
    }

    // Si identidad_verificada = true → ya votó
    if (data.identidad_verificada) {
      mostrarMensaje("Este ciudadano ya votó en esta jornada", "error");
      btnValidar.disabled = false;
      estadoSistema.textContent = "Sistema activo";
      return;
    }

    // Ciudadano válido y no ha votado → continuar
    setTimeout(() => {
      votanteNombre.textContent = nombre;
      votanteCedula.textContent = cedula;

      seccionVoto.classList.remove("hidden");
      votacionActiva = true;
      iniciarTemporizador();

      mostrarMensaje("Acceso concedido", "ok");
      estadoSistema.textContent = "Votación en curso";
      btnValidar.disabled = false;
    }, 800);

  } catch (err) {
    // Si el backend no está disponible, modo offline con advertencia
    console.error("Error al conectar con el backend:", err);
    mostrarMensaje("⚠ Backend no disponible — modo sin conexión", "error");
    btnValidar.disabled = false;
    estadoSistema.textContent = "Modo sin conexión";

    // Aun así permitir continuar (para pruebas locales)
    setTimeout(() => {
      votanteNombre.textContent = nombre;
      votanteCedula.textContent = cedula;
      seccionVoto.classList.remove("hidden");
      votacionActiva = true;
      iniciarTemporizador();
    }, 1000);
  }
});

// =============================================================
// SELECCIÓN DE CANDIDATO
// =============================================================
document.querySelectorAll(".candidate-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (!votacionActiva) return;

    // Resaltar seleccionado
    document.querySelectorAll(".candidate-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");

    candidatoSeleccionado       = card.dataset.candidate;
    idCandidatoSeleccionado     = CANDIDATOS_ID[candidatoSeleccionado] ?? 7;

    textoConfirmacion.textContent =
      candidatoSeleccionado === "Blanco"
        ? "¿Confirmar voto en blanco?"
        : `¿Confirmar voto por ${candidatoSeleccionado}?`;

    modal.classList.remove("hidden");
  });
});

// =============================================================
// MODAL — CANCELAR / CONFIRMAR
// =============================================================
btnCancelar.addEventListener("click", () => {
  modal.classList.add("hidden");
  document.querySelectorAll(".candidate-card").forEach(c => c.classList.remove("selected"));
});

btnConfirmar.addEventListener("click", () => {
  modal.classList.add("hidden");
  registrarVoto(candidatoSeleccionado, false);
});

// =============================================================
// AYUDA DEL JURADO
// =============================================================
btnAyuda.addEventListener("click", () => {
  estadoSistema.textContent = "Notificando jurado...";
  setTimeout(() => {
    alert("El jurado ha sido notificado y se acercará a asistir al ciudadano.");
    estadoSistema.textContent = "Jurado asistiendo";
  }, 1500);
});

// =============================================================
// REGISTRAR VOTO (llama a la API real)
// =============================================================
async function registrarVoto(candidato, automatico) {
  votacionActiva = false;
  clearInterval(timerInterval);

  const cedula       = votanteCedula.textContent;
  const id_candidato = automatico ? 7 : (CANDIDATOS_ID[candidato] ?? 7);

  estadoSistema.textContent = "Minando bloque...";

  let txHash = null;

  try {
    const res = await fetch(`${API_URL}/votar`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ cedula, id_candidato, id_jornada: 1 })
    });

    const data = await res.json();

    if (!data.ok) {
      // Si el error es "ya votó", igual mostramos la pantalla final
      console.warn("Respuesta del backend:", data.error);
    }

    txHash = data.tx_blockchain ?? null;

  } catch (err) {
    console.error("Error al registrar voto en backend:", err);
    // Modo sin conexión: generar hash local simulado
    txHash = btoa(cedula + Date.now()).replace(/=/g, "");
  }

  // Mostrar pantalla final
  seccionVoto.classList.add("hidden");
  seccionFinal.classList.remove("hidden");

  resumenVoto.textContent = automatico
    ? "Tiempo agotado. Voto en blanco registrado automáticamente."
    : `Voto por "${candidato === "Blanco" ? "Voto en Blanco" : candidato}" registrado correctamente.`;

  if (txHash && txBlockchain) {
    txBlockchain.textContent = txHash.slice(0, 32) + "...";
  }

  estadoSistema.textContent = "Voto registrado";
  console.log("[BLOCKCHAIN] tx:", txHash);
}

// =============================================================
// SALIR — REINICIAR FORMULARIO
// =============================================================
btnSalir.addEventListener("click", () => {
  cedulaInput.value    = "";
  nombreInput.value    = "";
  biometriaInput.checked = false;

  candidatoSeleccionado       = "";
  idCandidatoSeleccionado     = null;
  votacionActiva              = false;
  clearInterval(timerInterval);

  document.querySelectorAll(".candidate-card").forEach(c => c.classList.remove("selected"));

  seccionVoto.classList.add("hidden");
  seccionFinal.classList.add("hidden");

  contador.textContent    = "05:00";
  timerFill.style.width   = "100%";
  timerFill.style.background = "";

  estadoSistema.textContent = "Sistema activo";
  mostrarMensaje("", "normal");
});

// =============================================================
// AL CARGAR — VERIFICAR BACKEND
// =============================================================
window.addEventListener("load", () => {
  verificarBackend();
});
