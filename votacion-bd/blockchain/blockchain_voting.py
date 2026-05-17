"""
================================================================
Sistema de Votacion con Blockchain + Shamir's Secret Sharing
================================================================
Arquitectura:
- BD Interna (Docker votacion, puerto 5432):
    Guarda jornadas, candidatos, votos, control_voto y la PARTE 1
    del secreto compartido (parte1_hex).

- Registraduria (Docker registraduria, puerto 5433):
    Guarda ciudadanos y la PARTE 2 del secreto (parte2_hex).

Garantias:
- Nadie solo puede reconstruir la identidad del votante.
- Solo cooperando ambas DB se puede verificar la identidad.
- Los votos quedan encadenados en una blockchain (integridad).
================================================================
"""

import hashlib
import json
import random
import os
import traceback
from datetime import datetime

import pg8000.native
from flask import Flask, request, jsonify
from flask_cors import CORS


# =============================================================
# CONEXIONES A LAS BASES DE DATOS
# =============================================================

def conectar_votacion():
    """Conexion a la BD Interna (Docker votacion)."""
    return pg8000.native.Connection(
        host=os.getenv("DB_VOTACION_HOST", "host.docker.internal"),
        port=int(os.getenv("DB_VOTACION_PORT", 5432)),
        database=os.getenv("DB_VOTACION_NAME", "votacion_db"),
        user=os.getenv("DB_VOTACION_USER", "admin_votacion"),
        password=os.getenv("DB_VOTACION_PASS", "votacion1234")
    )


def conectar_registraduria():
    """Conexion a la BD de la Registraduria (Docker registraduria)."""
    return pg8000.native.Connection(
        host=os.getenv("DB_REGISTRADURIA_HOST", "host.docker.internal"),
        port=int(os.getenv("DB_REGISTRADURIA_PORT", 5433)),
        database=os.getenv("DB_REGISTRADURIA_NAME", "registraduria_db"),
        user=os.getenv("DB_REGISTRADURIA_USER", "admin_registraduria"),
        password=os.getenv("DB_REGISTRADURIA_PASS", "registraduria1234")
    )


# =============================================================
# SHAMIR'S SECRET SHARING (esquema 2 de 2)
# =============================================================
# Idea: dividir un secreto (hash de cedula) en 2 partes,
# de modo que ninguna parte sola revele el secreto.
# Solo juntando AMBAS partes se puede reconstruir.

# Primo grande de Mersenne usado para los calculos modulares.
PRIME = 2**127 - 1


def _extended_gcd(a, b):
    """Algoritmo extendido de Euclides (auxiliar para inverso modular)."""
    if a == 0:
        return b, 0, 1
    g, x, y = _extended_gcd(b % a, a)
    return g, y - (b // a) * x, x


def _modinv(a, m):
    """Calcula el inverso modular de a mod m."""
    g, x, _ = _extended_gcd(a % m, m)
    return x % m


def dividir_secreto(cedula):
    """
    Divide el hash de la cedula en 2 partes usando Shamir.
    Retorna (parte_bd_interna, parte_registraduria) en hexadecimal.
    """
    # Calcular hash SHA-256 de la cedula y convertirlo a entero
    hash_cedula = hashlib.sha256(cedula.encode()).hexdigest()
    secreto_int = int(hash_cedula, 16) % PRIME

    # Polinomio de grado 1: f(x) = secreto + coef1*x  (mod PRIME)
    coef1 = random.randint(1, PRIME - 1)
    parte1 = (secreto_int + coef1 * 1) % PRIME  # f(1) -> BD Interna
    parte2 = (secreto_int + coef1 * 2) % PRIME  # f(2) -> Registraduria

    return hex(parte1)[2:], hex(parte2)[2:]


def reconstruir_secreto(parte1_hex, parte2_hex):
    """
    Reconstruye el secreto original a partir de las 2 partes.
    Usa interpolacion de Lagrange.
    """
    y1 = int(parte1_hex, 16)
    y2 = int(parte2_hex, 16)
    shares = [(1, y1), (2, y2)]
    secreto = 0
    for i, (x_i, y_i) in enumerate(shares):
        num = den = 1
        for j, (x_j, _) in enumerate(shares):
            if i != j:
                num = (num * (-x_j)) % PRIME
                den = (den * (x_i - x_j)) % PRIME
        secreto = (secreto + y_i * num * _modinv(den, PRIME)) % PRIME
    return secreto


def verificar_cedula(cedula, parte1_hex, parte2_hex):
    """
    Verifica que las 2 partes corresponden realmente a la cedula dada.
    Solo posible si ambas DB cooperan y entregan su parte.
    """
    hash_original = hashlib.sha256(cedula.encode()).hexdigest()
    secreto_esperado = int(hash_original, 16) % PRIME
    secreto_reconstruido = reconstruir_secreto(parte1_hex, parte2_hex)
    return secreto_esperado == secreto_reconstruido


# =============================================================
# BLOCKCHAIN
# =============================================================

class Bloque:
    """Representa un bloque individual de la cadena."""

    def __init__(self, indice, datos, hash_anterior):
        self.indice = indice
        self.timestamp = datetime.now().isoformat()
        self.datos = datos
        self.hash_anterior = hash_anterior
        self.nonce = 0
        self.hash = self._calcular_hash()

    def _calcular_hash(self):
        """Calcula el hash SHA-256 del contenido del bloque."""
        contenido = json.dumps({
            "indice": self.indice,
            "timestamp": self.timestamp,
            "datos": self.datos,
            "hash_anterior": self.hash_anterior,
            "nonce": self.nonce
        }, sort_keys=True)
        return hashlib.sha256(contenido.encode()).hexdigest()

    def minar(self, dificultad=2):
        """
        Proof of Work: incrementa el nonce hasta que el hash
        empiece con 'dificultad' ceros.
        """
        objetivo = "0" * dificultad
        while not self.hash.startswith(objetivo):
            self.nonce += 1
            self.hash = self._calcular_hash()


class Blockchain:
    """Cadena de bloques que almacena los votos de forma encadenada."""

    def __init__(self, dificultad=2):
        self.dificultad = dificultad
        self.cadena = []
        # Bloque genesis (el primero, no contiene votos reales)
        genesis = Bloque(0, {"msg": "Bloque Genesis - Jornada Electoral"}, "0" * 64)
        genesis.minar(self.dificultad)
        self.cadena.append(genesis)
        print("[BLOCKCHAIN] Genesis creado -> {}...".format(genesis.hash[:16]))

    def agregar_voto(self, id_jornada, id_candidato, hash_token):
        """
        Agrega un nuevo bloque a la cadena con la informacion del voto.
        NO incluye la cedula, solo el hash_token anonimo.
        """
        ultimo = self.cadena[-1]
        nuevo = Bloque(
            len(self.cadena),
            {
                "id_jornada": id_jornada,
                "id_candidato": id_candidato,
                "hash_token": hash_token
            },
            ultimo.hash
        )
        nuevo.minar(self.dificultad)
        self.cadena.append(nuevo)
        return nuevo.hash

    def es_valida(self):
        """Verifica la integridad de toda la cadena."""
        for i in range(1, len(self.cadena)):
            actual = self.cadena[i]
            anterior = self.cadena[i - 1]
            if actual.hash != actual._calcular_hash():
                return False
            if actual.hash_anterior != anterior.hash:
                return False
        return True


# =============================================================
# SERVICIO PRINCIPAL DE VOTACION
# =============================================================

class ServicioVotacion:
    """Coordina las dos BD, el Secret Sharing y el blockchain."""

    def __init__(self):
        self.blockchain = Blockchain(dificultad=2)
        print("[SISTEMA] Servicio de votacion iniciado\n")

    def registrar_voto(self, cedula, id_candidato, id_jornada=1):
        """
        Registra un voto siguiendo el flujo completo:
        1. Verificar que el ciudadano exista en Registraduria
        2. Verificar que este habilitado
        3. Verificar que no haya votado ya
        4. Dividir la identidad con Secret Sharing
        5. Guardar las partes en cada BD
        6. Minar el bloque y registrar el voto

        Retorna un diccionario con:
          - tx: hash del bloque (si fue exitoso)
          - error: mensaje de error (si fallo)
        """
        print("\n" + "-" * 50)
        print("[VOTO] Procesando cedula: {}***{}".format(cedula[:3], cedula[-2:]))

        conn_reg = None
        conn_vot = None

        # --- Conexion a Registraduria ---
        try:
            conn_reg = conectar_registraduria()
            print("[DB] Conectado a Registraduria OK")
        except Exception as e:
            print("[ERROR] No se pudo conectar a Registraduria: {}".format(e))
            traceback.print_exc()
            return {"error": "Error de conexion con la Registraduria"}

        # --- Conexion a Votacion ---
        try:
            conn_vot = conectar_votacion()
            print("[DB] Conectado a Votacion OK")
        except Exception as e:
            print("[ERROR] No se pudo conectar a Votacion: {}".format(e))
            traceback.print_exc()
            if conn_reg:
                conn_reg.close()
            return {"error": "Error de conexion con la BD Interna"}

        try:
            # 1. Verificar que el ciudadano exista
            rows = conn_reg.run(
                "SELECT habilitado FROM ciudadano WHERE cedula = :cedula",
                cedula=cedula
            )

            if not rows:
                print("[ERROR] El usuario no esta registrado")
                return {"error": "El usuario no esta registrado"}

            # 2. Verificar que este habilitado
            habilitado = rows[0][0]
            if not habilitado:
                print("[ERROR] El usuario no esta habilitado para votar")
                return {"error": "El usuario no esta habilitado para votar"}

            # 3. Verificar voto duplicado mediante hash_token anonimo
            hash_token = hashlib.sha256(
                "{}_{}".format(cedula, id_jornada).encode()
            ).hexdigest()

            rows_dup = conn_vot.run(
                "SELECT id_control FROM control_voto WHERE hash_token = :ht",
                ht=hash_token
            )
            if rows_dup:
                print("[ERROR] El usuario ya voto")
                return {"error": "El usuario ya voto"}

            # 4. Dividir la identidad con Shamir's Secret Sharing
            parte_bd_interna, parte_registraduria = dividir_secreto(cedula)

            # 5a. Guardar parte 2 en la Registraduria
            conn_reg.run(
                "INSERT INTO secret_share (cedula, parte2_hex, id_jornada) "
                "VALUES (:c, :p, :j) "
                "ON CONFLICT (cedula, id_jornada) DO NOTHING",
                c=cedula, p=parte_registraduria, j=id_jornada
            )

            # 5b. Guardar parte 1 + hash_token en control_voto (BD Interna)
            conn_vot.run(
                "INSERT INTO control_voto (hash_token, id_jornada, parte1_hex) "
                "VALUES (:ht, :j, :p)",
                ht=hash_token, j=id_jornada, p=parte_bd_interna
            )

            # 6. Minar el bloque en la blockchain
            tx = self.blockchain.agregar_voto(id_jornada, id_candidato, hash_token)

            # 7. Guardar el voto con su tx_blockchain
            conn_vot.run(
                "INSERT INTO voto (id_jornada, id_candidato, tx_blockchain) "
                "VALUES (:j, :c, :tx)",
                j=id_jornada, c=id_candidato, tx=tx
            )

            print("[SECRET] Parte 1 -> BD Interna:    {}...".format(parte_bd_interna[:20]))
            print("[SECRET] Parte 2 -> Registraduria: {}...".format(parte_registraduria[:20]))
            print("[BLOCKCHAIN] Bloque minado -> tx: {}...".format(tx[:20]))
            print("[VOTO] Registrado exitosamente OK")
            return {"tx": tx}

        except Exception as e:
            print("[ERROR INTERNO] {}".format(e))
            traceback.print_exc()
            return {"error": "Error interno al procesar el voto"}

        finally:
            # Cerrar conexiones siempre
            try:
                conn_reg.close()
            except:
                pass
            try:
                conn_vot.close()
            except:
                pass

    def verificar_identidad(self, cedula, id_jornada=1):
        """
        Verifica la identidad cooperando con ambas DB.
        Cada DB entrega su parte, y se reconstruye el hash original.
        """
        print("\n[VERIFICACION] Cedula {}***{}".format(cedula[:3], cedula[-2:]))
        conn_reg = None
        conn_vot = None
        try:
            conn_reg = conectar_registraduria()
            conn_vot = conectar_votacion()

            hash_token = hashlib.sha256(
                "{}_{}".format(cedula, id_jornada).encode()
            ).hexdigest()

            # Pedir parte 1 a la BD Interna
            r1 = conn_vot.run(
                "SELECT parte1_hex FROM control_voto WHERE hash_token = :ht",
                ht=hash_token
            )
            # Pedir parte 2 a la Registraduria
            r2 = conn_reg.run(
                "SELECT parte2_hex FROM secret_share "
                "WHERE cedula = :c AND id_jornada = :j",
                c=cedula, j=id_jornada
            )

            if not r1 or not r2:
                print("[VERIFICACION] No hay registro")
                return False

            # Reconstruir el secreto y comparar con el hash de la cedula
            valido = verificar_cedula(cedula, r1[0][0], r2[0][0])
            print("[VERIFICACION] {}".format("VALIDA" if valido else "INVALIDA"))
            return valido

        except Exception as e:
            print("[ERROR VERIFICACION] {}".format(e))
            traceback.print_exc()
            return False

        finally:
            try:
                conn_reg.close()
            except:
                pass
            try:
                conn_vot.close()
            except:
                pass

    def estado_cadena(self):
        """Retorna estadisticas de la blockchain."""
        return {
            "bloques_votos": len(self.blockchain.cadena) - 1,
            "bloques_totales": len(self.blockchain.cadena),
            "cadena_valida": self.blockchain.es_valida()
        }


# =============================================================
# API FLASK
# =============================================================

app = Flask(__name__)
CORS(app)
servicio = ServicioVotacion()


@app.route("/", methods=["GET"])
def home():
    """Endpoint raiz: muestra los endpoints disponibles."""
    return jsonify({
        "servicio": "Sistema de Votacion Blockchain",
        "estado": "activo",
        "endpoints": {
            "health": "/health",
            "votar": "/votar",
            "verificar": "/verificar",
            "estado": "/estado"
        }
    })


@app.route("/health", methods=["GET"])
def health():
    """Health check del servicio."""
    return jsonify({"status": "ok", "message": "Blockchain service running"})


@app.route("/votar", methods=["POST"])
def votar():
    """
    Registra un voto.
    Body esperado: { "cedula": "...", "id_candidato": N, "id_jornada": 1 }
    """
    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "Debe enviar un JSON"}), 400

    cedula = data.get("cedula")
    id_candidato = data.get("id_candidato")
    id_jornada = data.get("id_jornada", 1)

    if not cedula or not id_candidato:
        return jsonify({
            "ok": False,
            "error": "Los campos cedula e id_candidato son obligatorios"
        }), 400

    resultado = servicio.registrar_voto(
        cedula=str(cedula),
        id_candidato=int(id_candidato),
        id_jornada=int(id_jornada)
    )

    # Si hubo error, lo devolvemos con el mensaje especifico
    if "error" in resultado:
        return jsonify({"ok": False, "error": resultado["error"]}), 400

    # Voto exitoso
    return jsonify({
        "ok": True,
        "mensaje": "Voto registrado exitosamente",
        "tx_blockchain": resultado["tx"]
    }), 201


@app.route("/verificar", methods=["POST"])
def verificar():
    """
    Verifica la identidad de un votante cooperando con ambas DB.
    Body esperado: { "cedula": "...", "id_jornada": 1 }
    """
    data = request.get_json()
    if not data:
        return jsonify({"ok": False, "error": "Debe enviar un JSON"}), 400

    cedula = data.get("cedula")
    id_jornada = data.get("id_jornada", 1)

    if not cedula:
        return jsonify({"ok": False, "error": "El campo cedula es obligatorio"}), 400

    valido = servicio.verificar_identidad(
        cedula=str(cedula),
        id_jornada=int(id_jornada)
    )

    return jsonify({
        "ok": True,
        "cedula": "{}***{}".format(str(cedula)[:3], str(cedula)[-2:]),
        "identidad_verificada": valido
    })


@app.route("/estado", methods=["GET"])
def estado():
    """Retorna el estado actual de la blockchain."""
    return jsonify(servicio.estado_cadena())


# =============================================================
# MAIN
# =============================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=False)