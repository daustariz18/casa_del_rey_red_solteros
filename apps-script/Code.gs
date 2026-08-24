const SPREADSHEET_ID = '1Ef6wWS7InY6Jd2DuRn-_atXnCHLG8-JTmmOGu9Rf96M';

const SHEET_NAMES = {
  members: 'Miembros',
  events: 'Eventos',
  attendance: 'Asistencias',
};

const HEADERS = {
  Miembros: [
    'id_miembro',
    'nombre',
    'apellido',
    'fecha_nacimiento',
    'celular',
    'direccion',
    'contacto_emergencia',
    'telefono_emergencia',
    'fecha_registro',
    'estado',
  ],
  Eventos: [
    'id_evento',
    'nombre_evento',
    'fecha_evento',
    'hora_evento',
    'ubicacion',
    'descripcion',
    'estado',
    'fecha_creacion',
  ],
  Asistencias: [
    'id_asistencia',
    'id_miembro',
    'id_evento',
    'confirmacion',
    'asistio',
    'fecha_confirmacion',
    'fecha_actualizacion',
  ],
};

const ATTENDANCE_CONFIRMATIONS = ['ASISTIRA', 'NO_ASISTIRA'];
const REAL_ATTENDANCE_VALUES = ['SI', 'NO'];

const WEEKLY_PRAYER_EVENT = {
  nombre_evento: 'Grupo de Oracion Red Solteros',
  hora_evento: '19:00',
  ubicacion: 'Edificio Toledo, preguntar por Jose Montoya',
  descripcion: 'Encuentro semanal de grupo de oracion',
};

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'findMember') {
      return buscarMiembroApi(e.parameter.phone);
    }

    if (action === 'getNextEvent') {
      return obtenerProximoEventoApi();
    }

    if (action === 'getEvents') {
      return obtenerEventosApi();
    }

    if (action === 'getEventAttendance') {
      return obtenerAsistenciaEventoApi(e.parameter.idEvento);
    }

    return jsonResponse({
      success: false,
      message: 'Accion no valida',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);

    switch (request.action) {
      case 'registerMember':
        return registrarMiembroApi(request.data);

      case 'registerAttendance':
        return registrarAsistenciaApi(request.data);

      case 'markAttendance':
        return marcarAsistenciaApi(request.data);

      default:
        return jsonResponse({
          success: false,
          message: 'Accion no valida',
        });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function setupSheets() {
  const spreadsheet = getSpreadsheet();

  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    ensureSheetStructure(sheet, sheetName);
  });

  seedWeeklyEventsForCurrentYear();
}

function buscarMiembroApi(phone) {
  const event = obtenerProximoEvento();
  const member = buscarMiembroPorCelular(phone);

  if (!member) {
    return jsonResponse({
      success: true,
      exists: false,
      event,
    });
  }

  return jsonResponse({
    success: true,
    exists: true,
    member: publicMember(member),
    event,
  });
}

function registrarMiembroApi(data) {
  const normalizedPhone = normalizePhone(data.celular);
  validateRequired(data.nombre, 'El nombre es obligatorio');
  validateRequired(data.apellido, 'El apellido es obligatorio');
  validateColombianPhone(normalizedPhone, 'El celular debe tener 10 digitos');
  validateBirthDate(data.fecha_nacimiento);

  const existingMember = buscarMiembroPorCelular(normalizedPhone);

  if (existingMember) {
    const updatedMember = actualizarMiembroExistente(normalizedPhone, data);

    return jsonResponse({
      success: true,
      exists: true,
      member: publicMember(updatedMember),
    });
  }

  const member = {
    id_miembro: `MIEMBRO_${Utilities.getUuid()}`,
    nombre: String(data.nombre).trim(),
    apellido: String(data.apellido).trim(),
    fecha_nacimiento: data.fecha_nacimiento || '',
    celular: normalizedPhone,
    direccion: data.direccion || '',
    contacto_emergencia: data.contacto_emergencia || '',
    telefono_emergencia: normalizePhone(data.telefono_emergencia),
    fecha_registro: new Date(),
    estado: 'ACTIVO',
  };

  appendRecord(SHEET_NAMES.members, member);

  return jsonResponse({
    success: true,
    exists: false,
    member: publicMember(member),
  });
}

function actualizarMiembroExistente(phone, data) {
  const sheet = getSheet(SHEET_NAMES.members);
  const headers = getHeaders(sheet);
  const rows = getRows(sheet);
  const normalizedPhone = normalizePhone(phone);
  const memberIndex = rows.findIndex(
    (row) => normalizePhone(row.celular) === normalizedPhone,
  );

  if (memberIndex === -1) {
    return null;
  }

  const existingMember = rows[memberIndex];
  const updatedMember = Object.assign({}, existingMember, {
    nombre: String(data.nombre || existingMember.nombre || '').trim(),
    apellido: String(data.apellido || existingMember.apellido || '').trim(),
    fecha_nacimiento: data.fecha_nacimiento || existingMember.fecha_nacimiento || '',
    celular: normalizedPhone,
    direccion: data.direccion || existingMember.direccion || '',
    contacto_emergencia:
      data.contacto_emergencia || existingMember.contacto_emergencia || '',
    telefono_emergencia:
      normalizePhone(data.telefono_emergencia) ||
      normalizePhone(existingMember.telefono_emergencia),
    fecha_registro: existingMember.fecha_registro || new Date(),
    estado: existingMember.estado || 'ACTIVO',
  });

  sheet.getRange(memberIndex + 2, 1, 1, headers.length).setValues([
    headers.map((header) => valueForSheet(updatedMember[header])),
  ]);

  return updatedMember;
}

function obtenerProximoEventoApi() {
  return jsonResponse({
    success: true,
    event: obtenerProximoEvento(),
  });
}

function obtenerEventosApi() {
  seedWeeklyEventsForCurrentYear();

  const events = getRows(getSheet(SHEET_NAMES.events))
    .filter((event) => event.id_evento)
    .sort((a, b) => eventDateTime(b) - eventDateTime(a))
    .map((event) => ({
      id_evento: event.id_evento,
      nombre_evento: event.nombre_evento,
      fecha_evento: formatDateValue(event.fecha_evento),
      hora_evento: formatTimeValue(event.hora_evento),
      ubicacion: event.ubicacion,
      estado: event.estado,
    }));

  return jsonResponse({
    success: true,
    events,
  });
}

function obtenerAsistenciaEventoApi(idEvento) {
  validateRequired(idEvento, 'Falta id_evento');

  const event = buscarEventoPorId(idEvento);

  if (!event) {
    throw new Error('Evento no encontrado');
  }

  const attendanceRows = getRows(getSheet(SHEET_NAMES.attendance));
  const attendanceByMember = attendanceRows.reduce((index, attendance) => {
    if (attendance.id_evento === idEvento) {
      index[attendance.id_miembro] = attendance;
    }

    return index;
  }, {});
  const members = getRows(getSheet(SHEET_NAMES.members))
    .filter((member) => member.estado === 'ACTIVO')
    .map((member) => {
      const attendance = attendanceByMember[member.id_miembro] || {};

      return {
        id_miembro: member.id_miembro,
        nombre: member.nombre,
        apellido: member.apellido,
        celular: member.celular,
        confirmacion: attendance.confirmacion || '',
        asistio: attendance.asistio || '',
      };
    });

  return jsonResponse({
    success: true,
    event: publicEvent(event),
    members,
  });
}

function registrarAsistenciaApi(data) {
  const idMiembro = data.idMiembro || data.id_miembro;
  const idEvento = data.idEvento || data.id_evento;
  const confirmacion = data.confirmacion;

  validateRequired(idMiembro, 'Falta id_miembro');
  validateRequired(idEvento, 'Falta id_evento');

  if (ATTENDANCE_CONFIRMATIONS.indexOf(confirmacion) === -1) {
    throw new Error('Confirmacion no valida');
  }

  const sheet = getSheet(SHEET_NAMES.attendance);
  const headers = getHeaders(sheet);
  const rows = getRows(sheet);
  const existingIndex = rows.findIndex(
    (row) => row.id_miembro === idMiembro && row.id_evento === idEvento,
  );
  const now = new Date();

  if (existingIndex === -1) {
    const attendance = {
      id_asistencia: `ASISTENCIA_${Utilities.getUuid()}`,
      id_miembro: idMiembro,
      id_evento: idEvento,
      confirmacion,
      asistio: '',
      fecha_confirmacion: now,
      fecha_actualizacion: now,
    };

    appendRecord(SHEET_NAMES.attendance, attendance);

    return jsonResponse({
      success: true,
      attendance,
    });
  }

  const rowNumber = existingIndex + 2;
  const existing = rows[existingIndex];
  const updated = Object.assign({}, existing, {
    confirmacion,
    fecha_actualizacion: now,
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map((header) => valueForSheet(updated[header])),
  ]);

  return jsonResponse({
    success: true,
    attendance: updated,
  });
}

function marcarAsistenciaApi(data) {
  const idMiembro = data.idMiembro || data.id_miembro;
  const idEvento = data.idEvento || data.id_evento;
  const asistio = data.asistio;

  validateRequired(idMiembro, 'Falta id_miembro');
  validateRequired(idEvento, 'Falta id_evento');

  if (REAL_ATTENDANCE_VALUES.indexOf(asistio) === -1) {
    throw new Error('Valor de asistencia no valido');
  }

  const sheet = getSheet(SHEET_NAMES.attendance);
  const headers = getHeaders(sheet);
  const rows = getRows(sheet);
  const existingIndex = rows.findIndex(
    (row) => row.id_miembro === idMiembro && row.id_evento === idEvento,
  );
  const now = new Date();

  if (existingIndex === -1) {
    const attendance = {
      id_asistencia: `ASISTENCIA_${Utilities.getUuid()}`,
      id_miembro: idMiembro,
      id_evento: idEvento,
      confirmacion: '',
      asistio,
      fecha_confirmacion: '',
      fecha_actualizacion: now,
    };

    appendRecord(SHEET_NAMES.attendance, attendance);

    return jsonResponse({
      success: true,
      attendance,
    });
  }

  const rowNumber = existingIndex + 2;
  const existing = rows[existingIndex];
  const updated = Object.assign({}, existing, {
    asistio,
    fecha_actualizacion: now,
  });

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map((header) => valueForSheet(updated[header])),
  ]);

  return jsonResponse({
    success: true,
    attendance: updated,
  });
}

function obtenerProximoEvento() {
  seedWeeklyEventsForCurrentYear();

  const weeklyEventDate = getWeeklyWednesdayDate(new Date());
  const weeklyEventDateText = formatDateValue(weeklyEventDate);
  const sheet = getSheet(SHEET_NAMES.events);
  const headers = getHeaders(sheet);
  const rows = getRows(sheet);
  const existingWeeklyEventIndex = rows.findIndex(
    (row) =>
      row.estado === 'ACTIVO' &&
      formatDateValue(row.fecha_evento) === weeklyEventDateText,
  );
  const existingWeeklyEvent = rows[existingWeeklyEventIndex];

  if (existingWeeklyEvent) {
    const updatedEvent = Object.assign({}, existingWeeklyEvent, {
      nombre_evento: WEEKLY_PRAYER_EVENT.nombre_evento,
      hora_evento: existingWeeklyEvent.hora_evento || WEEKLY_PRAYER_EVENT.hora_evento,
      ubicacion: WEEKLY_PRAYER_EVENT.ubicacion,
      descripcion: existingWeeklyEvent.descripcion || WEEKLY_PRAYER_EVENT.descripcion,
    });

    sheet.getRange(existingWeeklyEventIndex + 2, 1, 1, headers.length).setValues([
      headers.map((header) => valueForSheet(updatedEvent[header])),
    ]);

    return publicEvent(updatedEvent);
  }

  const event = {
    id_evento: `EVENTO_${Utilities.getUuid()}`,
    nombre_evento: WEEKLY_PRAYER_EVENT.nombre_evento,
    fecha_evento: weeklyEventDate,
    hora_evento: WEEKLY_PRAYER_EVENT.hora_evento,
    ubicacion: WEEKLY_PRAYER_EVENT.ubicacion,
    descripcion: WEEKLY_PRAYER_EVENT.descripcion,
    estado: 'ACTIVO',
    fecha_creacion: new Date(),
  };

  appendRecord(SHEET_NAMES.events, event);

  return publicEvent(event);
}

function seedWeeklyEventsForCurrentYear() {
  const sheet = getSheet(SHEET_NAMES.events);
  const rows = getRows(sheet);
  const existingEventDates = rows.reduce((dates, row) => {
    const dateText = formatDateValue(row.fecha_evento);

    if (dateText) {
      dates[dateText] = true;
    }

    return dates;
  }, {});
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();
  const endOfYear = new Date(currentYear, 11, 31);
  const eventsToCreate = [];
  const eventDate = getWeeklyWednesdayDate(today);

  while (eventDate <= endOfYear) {
    const dateText = formatDateValue(eventDate);

    if (!existingEventDates[dateText]) {
      eventsToCreate.push({
        id_evento: `EVENTO_${Utilities.getUuid()}`,
        nombre_evento: WEEKLY_PRAYER_EVENT.nombre_evento,
        fecha_evento: new Date(eventDate),
        hora_evento: WEEKLY_PRAYER_EVENT.hora_evento,
        ubicacion: WEEKLY_PRAYER_EVENT.ubicacion,
        descripcion: WEEKLY_PRAYER_EVENT.descripcion,
        estado: 'ACTIVO',
        fecha_creacion: new Date(),
      });

      existingEventDates[dateText] = true;
    }

    eventDate.setDate(eventDate.getDate() + 7);
  }

  if (eventsToCreate.length === 0) {
    return;
  }

  const headers = getHeaders(sheet);
  sheet
    .getRange(sheet.getLastRow() + 1, 1, eventsToCreate.length, headers.length)
    .setValues(
      eventsToCreate.map((event) =>
        headers.map((header) => valueForSheet(event[header])),
      ),
    );
}

function buscarMiembroPorCelular(phone) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const rows = getRows(getSheet(SHEET_NAMES.members));

  return rows.find((row) => normalizePhone(row.celular) === normalizedPhone) || null;
}

function buscarEventoPorId(idEvento) {
  return (
    getRows(getSheet(SHEET_NAMES.events)).find(
      (event) => event.id_evento === idEvento,
    ) || null
  );
}

function publicMember(member) {
  return {
    id_miembro: member.id_miembro,
    nombre: member.nombre,
    apellido: member.apellido,
  };
}

function publicEvent(event) {
  return {
    id_evento: event.id_evento,
    nombre_evento: event.nombre_evento,
    fecha_evento: formatDateValue(event.fecha_evento),
    hora_evento: formatTimeValue(event.hora_evento),
    ubicacion: event.ubicacion,
  };
}

function appendRecord(sheetName, record) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheet);
  sheet.appendRow(headers.map((header) => valueForSheet(record[header])));
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);

  ensureSheetStructure(sheet, name);
  return sheet;
}

function ensureSheetStructure(sheet, sheetName) {
  const expectedHeaders = HEADERS[sheetName];

  if (!expectedHeaders) {
    throw new Error(`Hoja no configurada: ${sheetName}`);
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  const currentHeaders =
    lastRow > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  const matches =
    currentHeaders.length >= expectedHeaders.length &&
    expectedHeaders.every((header, index) => currentHeaders[index] === header);

  if (matches) {
    sheet.setFrozenRows(1);
    return;
  }

  const records = [];

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

    values.forEach((row) => {
      const record = {};

      currentHeaders.forEach((header, index) => {
        if (header) {
          record[header] = row[index];
        }
      });

      records.push(record);
    });
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);

  if (records.length > 0) {
    sheet.getRange(2, 1, records.length, expectedHeaders.length).setValues(
      records.map((record) =>
        expectedHeaders.map((header) => valueForSheet(record[header])),
      ),
    );
  }

  sheet.setFrozenRows(1);
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getRows(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const headers = getHeaders(sheet);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values.map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index];
      return record;
    }, {}),
  );
}

function validateRequired(value, message) {
  if (!String(value || '').trim()) {
    throw new Error(message);
  }
}

function validateColombianPhone(phone, message) {
  if (!/^\d{10}$/.test(phone)) {
    throw new Error(message);
  }
}

function validateBirthDate(value) {
  if (!value) {
    return;
  }

  const birthDate = parseSheetDate(value);

  if (birthDate > startOfDay(new Date())) {
    throw new Error('La fecha de nacimiento no puede ser futura');
  }
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function eventDateTime(event) {
  const date = formatDateValue(event.fecha_evento);
  const time = formatTimeValue(event.hora_evento) || '00:00';
  return new Date(`${date}T${time}`);
}

function getWeeklyWednesdayDate(value) {
  const date = startOfDay(value);
  const wednesday = 3;
  const daysUntilWednesday = (wednesday - date.getDay() + 7) % 7;

  date.setDate(date.getDate() + daysUntilWednesday);

  return date;
}

function parseSheetDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return startOfDay(value);
  }

  return startOfDay(new Date(value));
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatDateValue(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return String(value);
}

function formatTimeValue(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }

  return String(value);
}

function valueForSheet(value) {
  return value === undefined || value === null ? '' : value;
}

function errorResponse(error) {
  return jsonResponse({
    success: false,
    message: error.message || 'Error inesperado',
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
