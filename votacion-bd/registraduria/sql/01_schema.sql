CREATE TABLE ciudadano (
    cedula           VARCHAR(15)  PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE         NOT NULL,
    departamento     VARCHAR(50)  NOT NULL,
    municipio        VARCHAR(50)  NOT NULL,
    habilitado       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE secret_share (
    cedula     VARCHAR(15) NOT NULL,
    parte2_hex TEXT        NOT NULL,
    id_jornada INT         NOT NULL,
    PRIMARY KEY (cedula, id_jornada)
);

INSERT INTO ciudadano (cedula, nombre, fecha_nacimiento, departamento, municipio, habilitado)
VALUES
  ('1000123456', 'Juan Pérez García',       '1990-03-15', 'Cundinamarca', 'Bogotá',       TRUE),
  ('1000234567', 'María López Torres',      '1985-07-22', 'Antioquia',    'Medellín',     TRUE),
  ('1000345678', 'Carlos Rodríguez Díaz',   '1992-11-08', 'Valle',        'Cali',         TRUE),
  ('1000456789', 'Ana Martínez Gómez',      '1988-05-30', 'Atlántico',    'Barranquilla', TRUE),
  ('1000567890', 'Luis Hernández Castro',   '1995-01-17', 'Santander',    'Bucaramanga',  TRUE),
  ('1000678901', 'Sandra Vargas Moreno',    '1983-09-04', 'Nariño',       'Pasto',        TRUE),
  ('1000789012', 'Pedro Jiménez Ruiz',      '1991-12-25', 'Boyacá',       'Tunja',        FALSE),
  ('1000890123', 'Claudia Torres Silva',    '1987-06-11', 'Caldas',       'Manizales',    TRUE),
  ('1000901234', 'Andrés Castillo Reyes',   '1993-04-19', 'Risaralda',    'Pereira',      TRUE),
  ('1001012345', 'Diana Ospina Valderrama', '1996-08-27', 'Huila',        'Neiva',        TRUE);