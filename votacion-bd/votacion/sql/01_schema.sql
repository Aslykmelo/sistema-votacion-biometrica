-- ============================================================
-- BD INTERNA: votacion_db
-- ============================================================

CREATE TABLE jornada_votacion (
    id_jornada         SERIAL PRIMARY KEY,
    tipo_jornada       VARCHAR(50)  NOT NULL,
    fecha_inicio       TIMESTAMP    NOT NULL,
    fecha_finalizacion TIMESTAMP    NOT NULL,
    estado             VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente', 'activa', 'cerrada'))
);

CREATE TABLE candidato (
    id_candidato     SERIAL PRIMARY KEY,
    id_jornada       INT          NOT NULL REFERENCES jornada_votacion(id_jornada),
    nombre_candidato VARCHAR(100) NOT NULL,
    partido          VARCHAR(100)
);

CREATE TABLE control_voto (
    id_control     SERIAL PRIMARY KEY,
    hash_token     VARCHAR(64)  NOT NULL UNIQUE,
    id_jornada     INT          NOT NULL REFERENCES jornada_votacion(id_jornada),
    fecha_registro TIMESTAMP    NOT NULL DEFAULT NOW(),
    parte1_hex     TEXT         NOT NULL
);

CREATE TABLE voto (
    id_voto       SERIAL PRIMARY KEY,
    id_jornada    INT          NOT NULL REFERENCES jornada_votacion(id_jornada),
    id_candidato  INT          NOT NULL REFERENCES candidato(id_candidato),
    tx_blockchain VARCHAR(100),
    fecha         TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DATOS INICIALES
-- ============================================================

INSERT INTO jornada_votacion (tipo_jornada, fecha_inicio, fecha_finalizacion, estado)
VALUES ('Elección Presidencial 2025', '2025-01-15 08:00:00', '2025-01-15 18:00:00', 'activa');

-- Los 6 candidatos del frontend + voto en blanco (id 7)
INSERT INTO candidato (id_jornada, nombre_candidato, partido)
VALUES
  (1, 'Ivan Cepeda',                 'Pacto Histórico'),
  (1, 'Paloma Valencia',             'Centro Democrático - Nuevo Liberalismo'),
  (1, 'Claudia López',               'Firmas / Consulta de las Soluciones'),
  (1, 'Abelardo de la Espriella',    'Salvación Nacional'),
  (1, 'Sergio Fajardo',              'Dignidad y Compromiso'),
  (1, 'Roy Barreras',                'Frente por la Vida'),
  (1, 'Voto en Blanco',              'Ninguno');
