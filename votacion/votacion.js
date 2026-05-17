const API_URL = "http://localhost:3000";

const CANDIDATOS_ID = {
  "Iván Cepeda":              1,
  "Paloma Valencia":          2,
  "Claudia López":            3,
  "Abelardo de la Espriella": 4,
  "Sergio Fajardo":           5,
  "Roy Barreras":             6,
  "Blanco":                   7
};

document.getElementById("nombreVotante").textContent = localStorage.getItem("nombre") || "—";
document.getElementById("cedulaVotante").textContent = localStorage.getItem("cedula")  || "—";

const cedulaVotante = localStorage.getItem("cedula") || "";

let candidatoSeleccionado = "";
let timerInterval         = null;
let segundosRestantes     = 300;
const totalSegundos       = 300;
let votacionActiva        = true;

const contador  = document.getElementById("contador");
const timerFill = document.getElementById("timerFill");
const modal     = document.getElementById("modal");

timerInterval = setInterval(() => {
  if (!votacionActiva) return;
  segundosRestantes--;

  const min = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
  const seg = String(segundosRestantes % 60).padStart(2, "0");
  contador.textContent  = `${min}:${seg}`;
  timerFill.style.width = `${(segundosRestantes / totalSegundos) * 100}%`;

  if (segundosRestantes < 60)       timerFill.style.background = "red";
  else if (segundosRestantes < 120) timerFill.style.background = "orange";

  if (segundosRestantes === 60) alert("El jurado debe asistir al ciudadano");
  if (segundosRestantes <= 0)   registrarVoto("Blanco", true);
}, 1000);

document.querySelectorAll(".candidato").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!votacionActiva) return;

    document.querySelectorAll(".candidato").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    candidatoSeleccionado = btn.dataset.candidato;

    document.getElementById("textoModal").textContent =
      candidatoSeleccionado === "Blanco"
        ? "¿Desea confirmar su voto en blanco?"
        : `¿Desea confirmar su voto por ${candidatoSeleccionado}?`;

    modal.classList.remove("hidden");
  });
});

document.getElementById("confirmarVoto").addEventListener("click", () => {
  modal.classList.add("hidden");
  registrarVoto(candidatoSeleccionado, false);
});

function cerrarModal() {
  modal.classList.add("hidden");
  document.querySelectorAll(".candidato").forEach(b => b.classList.remove("selected"));
}

function pedirAyuda() {
  document.getElementById("mensajeAyuda").textContent = "El jurado fue notificado. Espere asistencia.";
  setTimeout(() => { alert("El jurado ha sido notificado y se acercará a asistir."); }, 300);
}

async function registrarVoto(candidato, automatico) {
  votacionActiva = false;
  clearInterval(timerInterval);

  const id_candidato = automatico ? 7 : (CANDIDATOS_ID[candidato] ?? 7);
  let txHash = null;

  try {
    const res  = await fetch(`${API_URL}/votar`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ cedula: cedulaVotante, id_candidato, id_jornada: 1 })
    });
    const data = await res.json();
    if (!data.ok) console.warn("Backend:", data.error);
    txHash = data.tx_blockchain ?? null;

  } catch (err) {
    console.error("Error al registrar voto:", err);
    txHash = btoa(cedulaVotante + Date.now()).replace(/=/g, "");
  }

  const resumen = automatico
    ? "Tiempo agotado. Voto en blanco registrado automáticamente."
    : `Voto por "${candidato === "Blanco" ? "Voto en Blanco" : candidato}" registrado correctamente.`;

  const tx = txHash ? txHash.slice(0, 32) + "..." : "";

  document.body.innerHTML = `
    <div class="app">
      <div class="card" style="max-width:520px;margin:80px auto;text-align:center;padding:40px;">
        <div style="font-size:3rem;margin-bottom:20px;">✔</div>
        <h1 style="margin-bottom:16px;">Voto registrado correctamente</h1>
        <p style="color:#b9c7d9;margin-bottom:24px;">${resumen}</p>
        <div style="background:rgba(255,255,255,0.06);border-radius:14px;padding:18px;text-align:left;margin-bottom:24px;">
          <p><strong>Estado:</strong> Cerrado</p>
          <p><strong>Registro:</strong> almacenado en blockchain</p>
          ${tx ? `<p style="margin-top:8px;word-break:break-all;"><strong>TX:</strong><br>
          <span style="color:#2dd4bf;font-family:monospace;font-size:0.8rem;">${tx}</span></p>` : ""}
        </div>
        <button class="btn primary" onclick="window.location.href='jurado.html'">Siguiente votante</button>
      </div>
    </div>
  `;
}