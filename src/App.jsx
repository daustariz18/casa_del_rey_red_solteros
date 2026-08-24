import { useEffect, useMemo, useState } from 'react';
import AdminAttendance from './admin/AdminAttendance.jsx';
import logoUrl from '../logo.svg';
import {
  findMember,
  getNextEvent,
  registerAttendance,
  registerMember,
} from './services/api.js';

const emptyRegistration = {
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  celular: '',
  direccion: '',
  contacto_emergencia: '',
  telefono_emergencia: '',
};

function formatEventDate(event) {
  const fallbackEvent = {
    fecha_evento: getNextWednesday().toISOString().slice(0, 10),
    hora_evento: '19:00',
  };
  const currentEvent = event?.fecha_evento ? event : fallbackEvent;

  const dateTime = `${currentEvent.fecha_evento}T${currentEvent.hora_evento || '00:00'}`;

  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateTime));
}

function getNextWednesday() {
  const date = new Date();
  const wednesday = 3;
  const daysUntilWednesday = (wednesday - date.getDay() + 7) % 7;

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysUntilWednesday);

  return date;
}

function cleanPhone(value) {
  return value.replace(/\D/g, '');
}

export default function App() {
  const isAdminPath = window.location.pathname.endsWith('/admin');

  if (isAdminPath) {
    return <AdminAttendance />;
  }

  return <PublicAttendance />;
}

function PublicAttendance() {
  const [step, setStep] = useState('lookup');
  const [phone, setPhone] = useState('');
  const [member, setMember] = useState(null);
  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(emptyRegistration);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const eventDate = useMemo(
    () => formatEventDate(event),
    [event],
  );
  const eventLocation =
    event?.ubicacion || 'Edificio Toledo, preguntar por Jose Montoya';

  useEffect(() => {
    getNextEvent()
      .then((payload) => setEvent(payload.event))
      .catch(() => {
        setMessage('No pudimos cargar el proximo encuentro todavia.');
      });
  }, []);

  async function handleLookupSubmit(event) {
    event.preventDefault();
    setMessage('');

    const celular = cleanPhone(phone);

    if (celular.length !== 10) {
      setMessage('Ingresa un celular colombiano de 10 digitos.');
      return;
    }

    setLoading(true);

    try {
      const payload = await findMember(celular);
      setEvent(payload.event);

      if (payload.exists) {
        setMember(payload.member);
        setStep('confirmation');
      } else {
        setRegistration((current) => ({
          ...current,
          celular,
        }));
        setStep('registration');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRegistrationChange(event) {
    const { name, value } = event.target;
    setRegistration((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleRegistrationSubmit(event) {
    event.preventDefault();
    setMessage('');

    const celular = cleanPhone(registration.celular);
    const emergencyPhone = cleanPhone(registration.telefono_emergencia);

    if (celular.length !== 10) {
      setMessage('El celular debe tener 10 digitos.');
      return;
    }

    if (emergencyPhone && emergencyPhone.length !== 10) {
      setMessage('El telefono de emergencia debe tener 10 digitos.');
      return;
    }

    setLoading(true);

    try {
      const payload = await registerMember({
        ...registration,
        celular,
        telefono_emergencia: emergencyPhone,
      });
      setMember(payload.member);
      setStep('confirmation');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttendanceSubmit(confirmacion) {
    setMessage('');
    setLoading(true);

    try {
      await registerAttendance({
        idMiembro: member.id_miembro,
        idEvento: event?.id_evento,
        confirmacion,
      });
      setStep('success');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStep('lookup');
    setPhone('');
    setMember(null);
    setRegistration(emptyRegistration);
    setMessage('');
  }

  function FormHeader({ stepLabel, title }) {
    return (
      <div className="form-header">
        <img className="form-logo" src={logoUrl} alt="Casa del Rey" />
        <div>
          <p className="step-label">{stepLabel}</p>
          <h2>{title}</h2>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className="brand-panel" aria-label="Red Solteros Casa del Rey">
        <img className="logo" src={logoUrl} alt="Casa del Rey" />
        <p className="eyebrow">Red Solteros</p>
        <h1>Casa del Rey</h1>
        <p className="event-label">Proximo encuentro</p>
        <p className="event-date">{eventDate}</p>
      </section>

      <section className="flow-panel">
        {step === 'lookup' && (
          <form className="flow-card" onSubmit={handleLookupSubmit}>
            <FormHeader
              stepLabel="Registro de asistencia"
              title="Busca tu registro"
            />

            <label>
              Celular
              <input
                autoComplete="tel"
                inputMode="tel"
                name="phone"
                placeholder="3001234567"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            {message && <p className="message">{message}</p>}

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? 'Consultando...' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'registration' && (
          <form className="flow-card" onSubmit={handleRegistrationSubmit}>
            <FormHeader stepLabel="Nuevo integrante" title="Completa tus datos" />

            <div className="field-grid">
              <label>
                Nombre
                <input
                  autoComplete="given-name"
                  name="nombre"
                  required
                  value={registration.nombre}
                  onChange={handleRegistrationChange}
                />
              </label>
              <label>
                Apellido
                <input
                  autoComplete="family-name"
                  name="apellido"
                  required
                  value={registration.apellido}
                  onChange={handleRegistrationChange}
                />
              </label>
            </div>

            <label>
              Celular
              <input
                autoComplete="tel"
                inputMode="tel"
                name="celular"
                required
                value={registration.celular}
                onChange={handleRegistrationChange}
              />
            </label>

            <label>
              Fecha de nacimiento
              <input
                max={new Date().toISOString().slice(0, 10)}
                name="fecha_nacimiento"
                type="date"
                value={registration.fecha_nacimiento}
                onChange={handleRegistrationChange}
              />
            </label>

            <label>
              Direccion
              <input
                autoComplete="street-address"
                name="direccion"
                placeholder="Barranquilla, Atlantico"
                value={registration.direccion}
                onChange={handleRegistrationChange}
              />
            </label>

            <label>
              Contacto de emergencia
              <input
                name="contacto_emergencia"
                value={registration.contacto_emergencia}
                onChange={handleRegistrationChange}
              />
            </label>

            <label>
              Telefono de emergencia
              <input
                autoComplete="tel"
                inputMode="tel"
                name="telefono_emergencia"
                value={registration.telefono_emergencia}
                onChange={handleRegistrationChange}
              />
            </label>

            {message && <p className="message">{message}</p>}

            <div className="button-row">
              <button className="secondary-button" type="button" onClick={restart}>
                Volver
              </button>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {step === 'confirmation' && (
          <div className="flow-card">
            <FormHeader stepLabel="Confirmacion" title={`Hola, ${member?.nombre}`} />
            <p className="body-text">
              Confirma tu asistencia al encuentro de Red Solteros Casa del Rey.
            </p>
            <div className="summary-box">
              <span>Integrante</span>
              <strong>
                {member?.nombre} {member?.apellido}
              </strong>
            </div>
            <div className="summary-box">
              <span>Evento</span>
              <strong>{event?.nombre_evento || 'Grupo de Oracion Red Solteros'}</strong>
            </div>
            <div className="summary-box">
              <span>Fecha</span>
              <strong>{eventDate}</strong>
            </div>
            <div className="summary-box">
              <span>Ubicacion</span>
              <strong>{eventLocation}</strong>
            </div>

            {message && <p className="message">{message}</p>}

            <div className="button-row attendance-actions">
              <button className="secondary-button" type="button" onClick={restart}>
                Cambiar
              </button>
              <button
                className="primary-button"
                disabled={loading || !member?.id_miembro || !event?.id_evento}
                type="button"
                onClick={() => handleAttendanceSubmit('ASISTIRA')}
              >
                {loading ? 'Registrando...' : 'Si asistire'}
              </button>
              <button
                className="secondary-button"
                disabled={loading || !member?.id_miembro || !event?.id_evento}
                type="button"
                onClick={() => handleAttendanceSubmit('NO_ASISTIRA')}
              >
                No asistire
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flow-card success-card">
            <FormHeader stepLabel="Asistencia registrada" title="Te esperamos" />
            <p className="body-text">
              Tu asistencia quedo registrada para{' '}
              {event?.nombre_evento || 'Grupo de Oracion Red Solteros'}.
            </p>
            <button className="primary-button" type="button" onClick={restart}>
              Registrar otra persona
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
