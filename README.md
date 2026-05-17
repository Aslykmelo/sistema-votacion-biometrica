# 🗳️ Sistema de Votación Electrónica Biométrica
## Guía de despliegue completo

---

## Arquitectura

```
[Frontend HTML/JS]  →  [API Flask :3000]  →  [BD Votación :5432]
                                          →  [BD Registraduría :5433]
```

---

## Paso 1 — Levantar la BD de Registraduría

```bash
cd votacion-bd/registraduria
docker-compose up -d
```

Verifica que esté corriendo:
```bash
docker ps   # debe aparecer "registraduria_sim"
```

Adminer disponible en: http://localhost:8081
- Sistema: PostgreSQL
- Servidor: db_registraduria
- Usuario: admin_registraduria
- Contraseña: reg1234
- Base de datos: registraduria_db

---

## Paso 2 — Levantar la BD de Votación

```bash
cd votacion-bd/votacion
docker-compose up -d
```

Adminer disponible en: http://localhost:8080
- Sistema: PostgreSQL
- Servidor: db_votacion
- Usuario: admin_votacion
- Contraseña: votacion1234
- Base de datos: votacion_db

---

## Paso 3 — Levantar el servicio Blockchain (API Flask)

```bash
cd votacion-bd/blockchain
docker-compose up --build
```

Verifica que esté corriendo:
```bash
curl http://localhost:3000/health
# Respuesta esperada: {"message":"Blockchain service running","status":"ok"}
```

---

## Paso 4 — Abrir el Frontend

Abre el archivo `votacion/index.html` directamente en el navegador.

> ⚠️ **Importante:** Si el navegador bloquea las llamadas a localhost por CORS,
> levanta un servidor local simple:
> ```bash
> cd votacion
> python3 -m http.server 8000
> ```
> Luego entra a: http://localhost:8000

---

## Cédulas de prueba (ya están en la BD)

| Cédula       | Nombre                    | Habilitado |
|--------------|---------------------------|------------|
| 1000123456   | Juan Pérez García         | ✅ Sí      |
| 1000234567   | María López Torres        | ✅ Sí      |
| 1000345678   | Carlos Rodríguez Díaz     | ✅ Sí      |
| 1000456789   | Ana Martínez Gómez        | ✅ Sí      |
| 1000567890   | Luis Hernández Castro     | ✅ Sí      |
| 1000678901   | Sandra Vargas Moreno      | ✅ Sí      |
| 1000789012   | Pedro Jiménez Ruiz        | ❌ No      |
| 1000890123   | Claudia Torres Silva      | ✅ Sí      |
| 1000901234   | Andrés Castillo Reyes     | ✅ Sí      |
| 1001012345   | Diana Ospina Valderrama   | ✅ Sí      |

---

## Endpoints de la API

| Método | URL                          | Body / Descripción                                 |
|--------|------------------------------|----------------------------------------------------|
| GET    | http://localhost:3000/health | Health check                                       |
| GET    | http://localhost:3000/estado | Estado de la blockchain (bloques minados)          |
| POST   | http://localhost:3000/votar  | `{"cedula":"...","id_candidato":1,"id_jornada":1}` |
| POST   | http://localhost:3000/verificar | `{"cedula":"...","id_jornada":1}`               |

---

## Correcciones aplicadas

| Archivo | Problema | Corrección |
|---------|----------|------------|
| `votacion-bd/blockchain/docker-compose.yml` | Contraseña `registraduria1234` no coincidía con la BD (`reg1234`) | Unificado a `reg1234` |
| `votacion-bd/votacion/sql/01_schema.sql` | Solo 3 candidatos en la BD, pero el frontend tiene 6 | Agregados los 6 candidatos + voto en blanco (id 7) |
| `votacion/app.js` | No llamaba a ninguna API, trabajaba solo en memoria | Conectado completamente a la API Flask |
| `votacion/index.html` | No mostraba el hash de la transacción blockchain | Agregado campo `txBlockchain` en pantalla final |

---

## Flujo completo de un voto

1. El jurado ingresa cédula + nombre del ciudadano
2. Se escanea la biometría (simulada)
3. El frontend consulta `POST /verificar` → verifica que el ciudadano existe y no ha votado
4. El ciudadano selecciona su candidato
5. Aparece modal de confirmación
6. Al confirmar → `POST /votar` → la API:
   - Verifica ciudadano en Registraduría
   - Detecta doble voto con hash anónimo
   - Divide la identidad con Shamir's Secret Sharing (2 de 2)
   - Mina un bloque en la blockchain
   - Guarda el voto con el hash del bloque
7. La pantalla final muestra el hash de la transacción blockchain
