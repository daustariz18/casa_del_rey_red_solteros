import { useEffect, useMemo, useState } from 'react';
import logoUrl from '../../logo.svg';
import {
  getEventAttendance,
  getEvents,
  markAttendance,
} from '../services/api.js';

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'attended', label: 'Asistieron' },
  { id: 'missed', label: 'No asistieron' },
  { id: 'confirmed', label: 'Confirmaron asistencia' },
  { id: 'not-confirmed', label: 'No confirmaron' },
];

function formatAdminEventDate(event) {
  if (!event?.fecha_evento) return 'Fecha no definida';

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${event.fecha_evento}T${event.hora_evento || '00:00'}`));
}

function getConfirmationLabel(value) {
  if (value === 'ASISTIRA') return 'ASISTIRA';
  if (value === 'NO_ASISTIRA') return 'NO ASISTIRA';
  return 'SIN RESPUESTA';
}

function getAttendanceLabel(value) {
  if (value === 'SI') return 'SI ASISTIO';
  if (value === 'NO') return 'NO ASISTIO';
  return 'PENDIENTE';
}

function sortMembers(a, b) {
  const score = (member) => {
    if (!member.asistio && member.confirmacion === 'ASISTIRA') return 0;
    if (!member.asistio && !member.confirmacion) return 1;
    if (!member.asistio && member.confirmacion === 'NO_ASISTIRA') return 2;
    return 3;
  };

  return (
    score(a) - score(b) ||
    `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`)
  );
}

export default function AdminAttendance() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getEvents()
      .then((payload) => {
        setEvents(payload.events);
        setSelectedEventId(getDefaultEventId(payload.events));
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    setLoading(true);
    setMessage('');

    getEventAttendance(selectedEventId)
      .then((payload) => {
        setSelectedEvent(payload.event);
        setMembers(payload.members);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  const metrics = useMemo(() => {
    const confirmed = members.filter(
      (member) => member.confirmacion === 'ASISTIRA',
    ).length;
    const attended = members.filter((member) => member.asistio === 'SI').length;
    const missed = members.filter((member) => member.asistio === 'NO').length;
    const pending = members.filter((member) => !member.asistio).length;
    const walkIns = members.filter(
      (member) => !member.confirmacion && member.asistio === 'SI',
    ).length;
    const attendanceRate = confirmed > 0 ? (attended / confirmed) * 100 : 0;

    return {
      confirmed,
      attended,
      missed,
      pending,
      walkIns,
      attendanceRate,
    };
  }, [members]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return members
      .filter((member) => {
        if (filter === 'pending') return !member.asistio;
        if (filter === 'attended') return member.asistio === 'SI';
        if (filter === 'missed') return member.asistio === 'NO';
        if (filter === 'confirmed') return member.confirmacion === 'ASISTIRA';
        if (filter === 'not-confirmed') return member.confirmacion !== 'ASISTIRA';
        return true;
      })
      .filter((member) => {
        if (!normalizedQuery) return true;

        return `${member.nombre} ${member.apellido} ${member.celular}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort(sortMembers);
  }, [filter, members, query]);

  async function handleMarkAttendance(member, asistio) {
    const previousMembers = members;

    setSavingId(member.id_miembro);
    setMessage('');
    setMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id_miembro === member.id_miembro
          ? { ...currentMember, asistio }
          : currentMember,
      ),
    );

    try {
      await markAttendance(member.id_miembro, selectedEventId, asistio);
      setMessage('Asistencia actualizada');
    } catch (error) {
      setMembers(previousMembers);
      setMessage(error.message);
    } finally {
      setSavingId('');
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <img className="admin-logo" src={logoUrl} alt="Casa del Rey" />
          <div>
            <p className="eyebrow">Red Solteros</p>
            <h1>Control de asistencia</h1>
            <p>Valida la asistencia real de los integrantes al encuentro.</p>
          </div>
        </div>
      </header>

      <section className="admin-toolbar">
        <label>
          Evento
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
          >
            {events.map((event) => (
              <option key={event.id_evento} value={event.id_evento}>
                {event.nombre_evento} - {formatAdminEventDate(event)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Buscar integrante
          <input
            placeholder="Nombre, apellido o celular"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      {selectedEvent && (
        <section className="admin-event-summary">
          <div>
            <p className="step-label">Evento seleccionado</p>
            <h2>{selectedEvent.nombre_evento}</h2>
            <p>{formatAdminEventDate(selectedEvent)}</p>
          </div>
          <strong>{metrics.pending} pendientes por validar</strong>
        </section>
      )}

      <section className="metrics-grid" aria-label="Resumen del evento">
        <Metric label="Confirmaron que asistirian" value={metrics.confirmed} />
        <Metric label="Asistieron realmente" value={metrics.attended} />
        <Metric label="No asistieron" value={metrics.missed} />
        <Metric label="Pendientes de validar" value={metrics.pending} />
        <Metric
          label="Tasa de asistencia"
          value={`${metrics.attendanceRate.toFixed(1)} %`}
        />
        <Metric label="Llegaron sin confirmar" value={metrics.walkIns} />
      </section>

      <section className="admin-filters" aria-label="Filtros de asistencia">
        {filters.map((item) => (
          <button
            className={filter === item.id ? 'filter-chip active' : 'filter-chip'}
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </section>

      {message && <p className="admin-message">{message}</p>}

      <section className="attendance-list">
        {loading && <p className="body-text">Cargando asistencia...</p>}

        {!loading && filteredMembers.length === 0 && (
          <p className="body-text">No hay integrantes para este filtro.</p>
        )}

        {!loading && filteredMembers.length > 0 && (
          <>
            <div className="attendance-table" role="table">
              <div className="attendance-row attendance-head" role="row">
                <span>Nombre</span>
                <span>Celular</span>
                <span>Confirmacion</span>
                <span>Asistencia real</span>
                <span>Accion</span>
              </div>
              {filteredMembers.map((member) => (
                <AttendanceItem
                  key={member.id_miembro}
                  member={member}
                  saving={savingId === member.id_miembro}
                  onMark={handleMarkAttendance}
                />
              ))}
            </div>

            <div className="attendance-cards">
              {filteredMembers.map((member) => (
                <AttendanceItem
                  key={member.id_miembro}
                  member={member}
                  saving={savingId === member.id_miembro}
                  onMark={handleMarkAttendance}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function getDefaultEventId(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = events
    .filter((event) => event.estado === 'ACTIVO')
    .filter((event) => new Date(`${event.fecha_evento}T00:00`) >= today)
    .sort(
      (a, b) =>
        new Date(`${a.fecha_evento}T00:00`) - new Date(`${b.fecha_evento}T00:00`),
    );

  return upcomingEvents[0]?.id_evento || events[0]?.id_evento || '';
}

function Metric({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AttendanceItem({ member, onMark, saving }) {
  return (
    <article className="attendance-item attendance-row">
      <div>
        <strong>
          {member.nombre} {member.apellido}
        </strong>
      </div>
      <span>{member.celular}</span>
      <Badge type="confirmation" value={member.confirmacion} />
      <Badge type="attendance" value={member.asistio} />
      <div className="mark-actions">
        <button
          className="mark-button attended"
          disabled={saving}
          type="button"
          onClick={() => onMark(member, 'SI')}
        >
          ✓ Asistio
        </button>
        <button
          className="mark-button missed"
          disabled={saving}
          type="button"
          onClick={() => onMark(member, 'NO')}
        >
          × No asistio
        </button>
      </div>
    </article>
  );
}

function Badge({ type, value }) {
  const label =
    type === 'confirmation' ? getConfirmationLabel(value) : getAttendanceLabel(value);
  const tone =
    value === 'ASISTIRA' || value === 'SI'
      ? 'positive'
      : value === 'NO_ASISTIRA' || value === 'NO'
        ? 'negative'
        : 'neutral';
  const symbol = tone === 'positive' ? '✓' : tone === 'negative' ? '×' : '-';

  return (
    <span className={`status-badge ${tone}`}>
      <span aria-hidden="true">{symbol}</span>
      {label}
    </span>
  );
}
