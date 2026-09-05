# Red Solteros Casa del Rey

Aplicacion web para registrar integrantes, confirmar asistencia a encuentros semanales y validar la asistencia real del grupo Red Solteros Casa del Rey.

El producto tiene dos partes:

- Frontend React/Vite para la experiencia publica y administrativa.
- Google Apps Script como API, conectado a Google Sheets como base de datos.

## Estado Del Producto

La app soporta estos flujos principales:

- Un integrante ingresa su celular y el sistema busca si ya existe.
- Si existe, confirma si asistira o no al proximo encuentro.
- Si no existe, completa sus datos personales y luego confirma asistencia.
- Un administrador entra a la vista `/admin`, selecciona un evento y marca si cada integrante asistio realmente.
- El backend crea automaticamente eventos semanales de oracion para los miercoles restantes del anio actual.

## Estructura

```text
.
|-- apps-script/
|   `-- Code.gs              # API de Google Apps Script y logica de Sheets
|-- src/
|   |-- App.jsx              # Flujo publico y enrutamiento simple a admin
|   |-- admin/
|   |   `-- AdminAttendance.jsx
|   |-- services/
|   |   `-- api.js           # Cliente HTTP hacia Apps Script
|   |-- main.jsx
|   `-- styles.css
|-- index.html
|-- logo.svg
|-- vite.config.js
|-- package.json
`-- .env.example
```

## Stack

- React 19
- Vite 7
- Google Apps Script
- Google Sheets

## Configuracion Local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` usando `.env.example` como referencia:

```bash
VITE_API_URL=https://script.google.com/macros/s/XXXXXXXXXXXX/exec
```

`VITE_API_URL` debe apuntar a la URL publicada del Web App de Google Apps Script.

3. Ejecutar en desarrollo:

```bash
npm run dev
```

4. Compilar produccion:

```bash
npm run build
```

5. Vista previa del build:

```bash
npm run preview
```

## Rutas

- `/`: flujo publico de registro y confirmacion.
- `/admin`: panel administrativo para control de asistencia.
- `#/admin`: alternativa soportada para entrar al panel admin.

La base configurada en Vite es `/casa_del_rey_red_solteros/`, pensada para despliegues donde la app vive bajo ese subdirectorio.

## Backend Apps Script

El archivo principal es `apps-script/Code.gs`.

La API usa:

```js
const SPREADSHEET_ID = '1Ef6wWS7InY6Jd2DuRn-_atXnCHLG8-JTmmOGu9Rf96M';
```

Ese ID corresponde al Google Sheet donde se guardan integrantes, eventos y asistencias.

### Hojas

`Miembros`

```text
id_miembro
nombre
apellido
fecha_nacimiento
celular
direccion
contacto_emergencia
telefono_emergencia
fecha_registro
estado
```

`Eventos`

```text
id_evento
nombre_evento
fecha_evento
hora_evento
ubicacion
descripcion
estado
fecha_creacion
```

`Asistencias`

```text
id_asistencia
id_miembro
id_evento
confirmacion
asistio
fecha_confirmacion
fecha_actualizacion
```

### Evento Semanal

El evento recurrente se define en `WEEKLY_PRAYER_EVENT`:

```text
Nombre: Grupo de Oracion Red Solteros
Hora: 19:00
Ubicacion: Edificio Toledo, preguntar por Jose Montoya
Descripcion: Encuentro semanal de grupo de oracion
```

`seedWeeklyEventsForCurrentYear()` crea eventos todos los miercoles desde el miercoles actual/proximo hasta el 31 de diciembre del anio actual, evitando duplicados por fecha.

`obtenerProximoEvento()` garantiza que exista el evento del miercoles actual/proximo y devuelve sus datos publicos.

## Endpoints

Apps Script expone un Web App con `doGet` y `doPost`.

### GET

`?action=findMember&phone=3001234567`

Busca integrante por celular normalizado. Devuelve tambien el proximo evento.

`?action=getNextEvent`

Devuelve el proximo evento semanal.

`?action=getEvents`

Devuelve la lista de eventos, ordenada de mas reciente a mas antiguo.

`?action=getEventAttendance&idEvento=EVENTO_ID`

Devuelve el evento y la lista de miembros activos con su confirmacion y asistencia real.

### POST

`registerMember`

```json
{
  "action": "registerMember",
  "data": {
    "nombre": "Ana",
    "apellido": "Perez",
    "fecha_nacimiento": "1995-01-20",
    "celular": "3001234567",
    "direccion": "Barranquilla, Atlantico",
    "contacto_emergencia": "Maria Perez",
    "telefono_emergencia": "3011234567"
  }
}
```

Si el celular ya existe, actualiza los datos del integrante existente y responde con `exists: true`.

`registerAttendance`

```json
{
  "action": "registerAttendance",
  "data": {
    "idMiembro": "MIEMBRO_ID",
    "idEvento": "EVENTO_ID",
    "confirmacion": "ASISTIRA"
  }
}
```

Valores validos de `confirmacion`:

- `ASISTIRA`
- `NO_ASISTIRA`

`markAttendance`

```json
{
  "action": "markAttendance",
  "data": {
    "idMiembro": "MIEMBRO_ID",
    "idEvento": "EVENTO_ID",
    "asistio": "SI"
  }
}
```

Valores validos de `asistio`:

- `SI`
- `NO`

## Modelo De Datos

Un miembro se identifica por `id_miembro`, pero la busqueda publica usa celular normalizado a digitos.

Un evento se identifica por `id_evento`. Los eventos semanales se deduplican por `fecha_evento`, no por nombre.

Una asistencia conecta un miembro con un evento. Puede tener:

- `confirmacion`: intencion previa del integrante.
- `asistio`: validacion real hecha por administracion.

Esto permite registrar casos como:

- Confirmo asistencia y asistio.
- Confirmo asistencia y no asistio.
- No confirmo, pero llego.
- Confirmo que no asistiria.

## Flujo Publico

Archivo principal: `src/App.jsx`.

Estados del flujo:

- `lookup`: captura celular.
- `registration`: formulario para nuevo integrante.
- `confirmation`: confirma asistencia al evento.
- `success`: pantalla final.

Validaciones principales:

- Celular colombiano de 10 digitos.
- Telefono de emergencia opcional, pero si existe debe tener 10 digitos.
- Fecha de nacimiento no puede ser futura.

## Flujo Administrativo

Archivo principal: `src/admin/AdminAttendance.jsx`.

Capacidades:

- Cargar eventos.
- Elegir evento activo o historico.
- Buscar por nombre, apellido o celular.
- Filtrar por estado de confirmacion/asistencia.
- Marcar asistencia real como `SI` o `NO`.
- Ver metricas del evento.

Metricas actuales:

- Confirmaron que asistirian.
- Asistieron realmente.
- No asistieron.
- Pendientes de validar.
- Tasa de asistencia.
- Llegaron sin confirmar.

## Conocimiento Para Un Agente Especializado

Este proyecto debe tratarse como un producto operativo para gestion de asistencia de una comunidad, no como una landing page.

Prioridades al modificarlo:

- Preservar la compatibilidad entre `src/services/api.js` y `apps-script/Code.gs`.
- Mantener los nombres de hojas y encabezados en espanol, porque el backend los usa como contrato.
- No cambiar valores de estado sin migracion: `ASISTIRA`, `NO_ASISTIRA`, `SI`, `NO`, `ACTIVO`.
- Evitar duplicar eventos semanales; la fecha del evento es la clave practica para deduplicacion.
- Recordar que Google Apps Script no es un servidor Node: no usar APIs de Node en `Code.gs`.
- Mantener respuestas JSON con la forma `{ success: boolean, ... }`.
- Validar telefonos normalizando a solo digitos.
- Cuidar que el flujo publico siga siendo rapido para usuarios desde celular.
- Cuidar que la vista admin sea util para operacion durante el evento, con busqueda y acciones visibles.

Cuando se agregue una funcionalidad nueva, revisar estos puntos:

- Si requiere una nueva columna en Sheets, actualizar `HEADERS` y considerar como se preservan datos existentes en `ensureSheetStructure`.
- Si requiere endpoint nuevo, agregarlo en `doGet` o `doPost` y despues exponerlo en `src/services/api.js`.
- Si afecta asistencia, distinguir entre confirmacion previa (`confirmacion`) y asistencia real (`asistio`).
- Si afecta eventos semanales, revisar `getWeeklyWednesdayDate`, `seedWeeklyEventsForCurrentYear` y `obtenerProximoEvento`.

## Despliegue De Apps Script

Pasos generales:

1. Crear o abrir el proyecto de Google Apps Script.
2. Copiar el contenido de `apps-script/Code.gs`.
3. Ejecutar `setupSheets()` una vez para crear/verificar las hojas.
4. Publicar como Web App.
5. Dar permisos necesarios para acceder al Google Sheet.
6. Copiar la URL `/exec` en `VITE_API_URL`.

Si se cambia el backend, volver a desplegar una nueva version del Web App para que el frontend use el codigo actualizado.

## Riesgos Y Cuidados

- La URL de Apps Script en `.env` puede considerarse sensible operativamente. No subir `.env`.
- El `SPREADSHEET_ID` esta hardcodeado en `Code.gs`; cambiarlo apunta toda la API a otra base de datos.
- Apps Script puede convertir fechas y horas a objetos `Date`; por eso existen `formatDateValue` y `formatTimeValue`.
- `ensureSheetStructure` puede reordenar datos segun encabezados conocidos. Antes de cambiar encabezados, entender como preserva registros existentes.
- La autenticacion admin no esta implementada en el frontend; `/admin` depende del acceso a la app y al endpoint publicado.

## Scripts Disponibles

```bash
npm run dev
npm run build
npm run preview
```
