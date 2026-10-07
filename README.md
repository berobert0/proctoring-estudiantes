# Proctoring Estudiantes · Fase 1

Base funcional para evolucionar el frontend original hacia un sistema real con servidor.

## Incluye

- Login de estudiante y profesor.
- Node.js + Express.
- PostgreSQL.
- Sesiones opacas revocables guardadas en base de datos.
- Roles `student` y `teacher`.
- Preguntas entregadas desde servidor.
- Aleatorización de preguntas y alternativas en el servidor.
- Registro persistente de respuestas.
- Registro persistente de incidencias.
- Temporizador basado en el inicio registrado en servidor.
- Corrección y puntaje automáticos.
- Panel docente inicial.
- Esquema preparado para evidencias/capturas de webcam en una fase posterior.

## Arquitectura recomendada

GitHub Pages sirve solo archivos estáticos del directorio `frontend/`.
El backend `backend/` debe ejecutarse en un servicio Node.js y conectarse a PostgreSQL.

No publiques `.env` ni credenciales en GitHub.

## Inicio local

1. Inicia PostgreSQL:

```bash
docker compose up -d
```

2. En `backend/`:

```bash
cp .env.example .env
npm install
psql "postgres://proctoring:proctoring@localhost:5432/proctoring" -f sql/schema.sql
npm run seed
npm start
```

3. Sirve `frontend/` con un servidor local (por ejemplo Live Server en VS Code).

4. Configura `frontend/config.js` con la URL de la API.

## Usuarios demo

- Profesor: `DOC001` / `Profesor123!`
- Alumno: `000001` / `Alumno123!`

Cambia estas credenciales antes de cualquier prueba con estudiantes reales.

## Seguridad

Las incidencias son señales para revisión docente, no una declaración automática de fraude.

El bloqueo de copiar/pegar, pantalla completa y detección de foco son controles de interfaz; no pueden impedir de forma absoluta otro dispositivo, capturas externas o manipulación avanzada del navegador.

## Próxima fase sugerida

Banco de preguntas y editor docente completo:
- crear/editar/eliminar preguntas;
- alternativas correctas;
- asignar preguntas a exámenes;
- importación masiva;
- reportes por estudiante;
- capturas periódicas de webcam con consentimiento y política de retención.


## Portal profesional por DNI

Se agregó `frontend/portal.html` como página pública de ingreso para estudiantes.

Flujo:
1. El estudiante ingresa su DNI.
2. El servidor busca al estudiante y devuelve datos académicos mínimos y exámenes disponibles.
3. Se muestran únicamente los cursos/exámenes matriculados.
4. Para iniciar una evaluación, el estudiante confirma su clave personal.
5. El examen inicia con la sesión autenticada.

### Seguridad importante

El DNI **identifica**, pero no debe utilizarse como único secreto de autenticación.
En esta versión se solicita una clave personal antes de abrir la evaluación.

Para una siguiente fase se recomienda sustituir la clave por:
- DNI + fecha de nacimiento, o
- DNI + PIN temporal, o
- DNI + código OTP enviado al correo/celular institucional.

### Demo del portal

DNI demo: `12345678`
Clave demo: `Alumno123!`
