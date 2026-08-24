const API_URL = import.meta.env.VITE_API_URL;

function assertApiUrl() {
  if (!API_URL) {
    throw new Error('Falta configurar VITE_API_URL');
  }
}

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  const payload = await response.json();

  if (payload?.success === false) {
    throw new Error(payload.message || fallbackMessage);
  }

  return payload;
}

export async function findMember(phone) {
  assertApiUrl();

  const response = await fetch(
    `${API_URL}?action=findMember&phone=${encodeURIComponent(phone)}`,
  );

  return parseResponse(response, 'Error consultando integrante');
}

export async function registerMember(data) {
  assertApiUrl();

  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'registerMember',
      data,
    }),
  });

  return parseResponse(response, 'Error registrando integrante');
}

export async function registerAttendance(data) {
  assertApiUrl();

  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'registerAttendance',
      data,
    }),
  });

  return parseResponse(response, 'Error registrando asistencia');
}

export async function getNextEvent() {
  assertApiUrl();

  const response = await fetch(`${API_URL}?action=getNextEvent`);

  return parseResponse(response, 'Error consultando el proximo evento');
}

export async function getEvents() {
  assertApiUrl();

  const response = await fetch(`${API_URL}?action=getEvents`);

  return parseResponse(response, 'Error consultando eventos');
}

export async function getEventAttendance(idEvento) {
  assertApiUrl();

  const response = await fetch(
    `${API_URL}?action=getEventAttendance&idEvento=${encodeURIComponent(idEvento)}`,
  );

  return parseResponse(response, 'Error consultando asistencia del evento');
}

export async function markAttendance(idMiembro, idEvento, asistio) {
  assertApiUrl();

  const response = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'markAttendance',
      data: {
        idMiembro,
        idEvento,
        asistio,
      },
    }),
  });

  return parseResponse(response, 'Error marcando asistencia');
}
