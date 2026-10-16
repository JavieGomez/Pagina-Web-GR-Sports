import { CONFIG } from './config.js';
import { supabase, isSupabaseConfigured, currentUser, isStaff, isAdmin, roleLabel } from './supabase-client.js';

const SERVICE_TYPES = {
  clases: {
    title: 'Clases colectivas y dirigidas',
    intro: 'Cuéntanos cómo es la clase que quieres organizar. La estimación es orientativa y no sustituye al presupuesto final.',
    fields: [
      { name: 'activity', label: 'Tipo de actividad', type: 'select', options: ['Pilates', 'BodyPump', 'ExtremFit', 'HIIT', 'Movilidad', 'Otra actividad'] },
      { name: 'duration', label: 'Duración de cada clase (minutos)', type: 'number', min: 20, max: 240, value: 60 },
      { name: 'attendees', label: 'Número aproximado de personas', type: 'number', min: 1, max: 100, value: 10 },
      { name: 'classesPerWeek', label: 'Clases por semana', type: 'number', min: 1, max: 30, value: 1 },
      { name: 'location', label: 'Gimnasio o ubicación', type: 'text', placeholder: 'Ej.: InterClub, sala 1' },
      { name: 'schedule', label: 'Días u horario preferido', type: 'text', placeholder: 'Ej.: martes y jueves por la tarde' }
    ]
  },
  sustituciones: {
    title: 'Sustituciones profesionales',
    intro: 'Indica qué cobertura necesita tu centro para preparar una estimación inicial.',
    fields: [
      { name: 'activity', label: 'Puesto o actividad a cubrir', type: 'text', placeholder: 'Monitor de sala, Pilates…' },
      { name: 'duration', label: 'Horas de cobertura', type: 'number', min: 1, max: 200, value: 2 },
      { name: 'attendees', label: 'Personas aproximadas (si es una clase)', type: 'number', min: 0, max: 100, value: 0 },
      { name: 'location', label: 'Gimnasio o ubicación', type: 'text', placeholder: 'Nombre y localidad' },
      { name: 'schedule', label: 'Fecha y horario', type: 'text', placeholder: 'Día y franja horaria' },
      { name: 'details', label: 'Detalles', type: 'textarea', placeholder: 'Duración prevista de la sustitución y necesidades' }
    ]
  },
  personal: {
    title: 'Entrenamiento personal',
    intro: 'Elige modalidad, objetivo y frecuencia. El entrenador revisará la solicitud antes de cerrar horarios.',
    fields: [
      { name: 'modality', label: 'Modalidad', type: 'select', options: ['Individual', 'Dúo'] },
      { name: 'objective', label: 'Objetivo', type: 'select', options: ['Pérdida de grasa y recomposición', 'Fuerza y masa muscular', 'Preparación de oposiciones', 'Salud y mantenimiento', 'Otro'] },
      { name: 'duration', label: 'Duración de sesión (minutos)', type: 'number', min: 30, max: 120, value: 60 },
      { name: 'sessionsPerWeek', label: 'Sesiones por semana', type: 'number', min: 1, max: 7, value: 1 },
      { name: 'location', label: 'Centro', type: 'select', options: ['InterClub', 'Particular / otro centro'] },
      { name: 'schedule', label: 'Días u horario preferido', type: 'text', placeholder: 'Ej.: lunes y miércoles a partir de las 18:00' },
      { name: 'details', label: 'Metas o información que quieras añadir', type: 'textarea', placeholder: 'Puedes añadir contexto útil para el entrenador.' }
    ]
  },
  campus: {
    title: 'Campus y actividades',
    intro: 'Cuéntanos el tamaño del grupo y la duración para calcular una estimación por participante.',
    fields: [
      { name: 'activity', label: 'Tipo de actividad', type: 'select', options: ['Campus multideporte', 'Jornada deportiva', 'Fútbol', 'Ruta al aire libre', 'Otra actividad'] },
      { name: 'attendees', label: 'Número de participantes', type: 'number', min: 1, max: 200, value: 10 },
      { name: 'duration', label: 'Duración (horas)', type: 'number', min: 1, max: 12, value: 4 },
      { name: 'ageRange', label: 'Edades aproximadas', type: 'text', placeholder: 'Ej.: 8–12 años' },
      { name: 'location', label: 'Ubicación', type: 'text', placeholder: 'Localidad o instalación' },
      { name: 'schedule', label: 'Fecha o periodo preferido', type: 'text', placeholder: 'Fechas y horario' }
    ]
  },
  eventos: {
    title: 'Ocio y animación en eventos',
    intro: 'Preparamos actividades para celebraciones y eventos privados. Indica los datos principales.',
    fields: [
      { name: 'eventType', label: 'Tipo de evento', type: 'select', options: ['Boda', 'Comunión', 'Celebración familiar', 'Otro evento'] },
      { name: 'attendees', label: 'Número de niños o jóvenes', type: 'number', min: 1, max: 150, value: 10 },
      { name: 'duration', label: 'Horas de animación', type: 'number', min: 1, max: 12, value: 2 },
      { name: 'location', label: 'Localidad o espacio', type: 'text', placeholder: 'Lugar del evento' },
      { name: 'schedule', label: 'Fecha y horario', type: 'text', placeholder: 'Día y franja horaria' },
      { name: 'details', label: 'Necesidades especiales', type: 'textarea', placeholder: 'Juegos o actividades que os gustaría incluir' }
    ]
  }
};

const STATUS_LABELS = { pending: 'En espera', approved: 'Aprobada', rejected: 'No aprobada' };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function setMessage(target, message, isError = false) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('error', Boolean(isError));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('es-ES', options).format(new Date(value));
}

function friendlyError(error) {
  const text = error?.message || 'No se pudo completar la operación.';
  const normalized = text.toLowerCase();
  if (text.includes('Failed to fetch')) return 'No se pudo conectar con Supabase. Comprueba la conexión y la configuración del proyecto.';
  if (normalized.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (normalized.includes('email not confirmed')) return 'Confirma tu correo desde el enlace que te enviamos antes de iniciar sesión.';
  if (normalized.includes('user already registered')) return 'Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.';
  if (normalized.includes('redirect') && (normalized.includes('allow') || normalized.includes('not permitted'))) return 'Supabase no permite la URL de retorno. Añade la dirección de esta web en Authentication → URL Configuration → Redirect URLs.';
  if (['PGRST205', '42P01'].includes(error?.code) || normalized.includes('could not find the table') || normalized.includes('relation') && normalized.includes('does not exist')) {
    return 'La cuenta puede guardarse, pero falta instalar las tablas de GR Sports. Ejecuta supabase/setup.sql una vez en el SQL Editor de Supabase.';
  }
  return text;
}

async function getProfile(user) {
  if (!supabase || !user) return { full_name: user?.user_metadata?.full_name || '', phone: '' };
  const { data, error } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return data || { full_name: user.user_metadata?.full_name || '', phone: '' };
}

async function renderNavigation(user) {
  $$('[data-auth-link]').forEach(link => link.classList.toggle('hidden', Boolean(user)));
  $$('[data-account-link]').forEach(link => link.classList.toggle('hidden', !user));
  $$('[data-admin-link]').forEach(link => link.classList.toggle('hidden', !isStaff(user)));
  $$('[data-sign-out]').forEach(button => button.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage('account-message', friendlyError(error), true);
    else location.href = 'index.html';
  }));
}

function showSetupMessage() {
  const page = document.body.dataset.page;
  const id = { auth: 'auth-message', 'password-recovery': 'auth-message', request: 'request-message', account: 'account-message', admin: 'admin-message', session: 'session-message' }[page];
  if (!isSupabaseConfigured && id) setMessage(id, 'Supabase aún no está configurado. Añade el Project URL y la clave publishable en config.js, y ejecuta supabase/setup.sql en el SQL Editor.', true);
}

function setupBackNavigation() {
  const page = document.body.dataset.page;
  if (!page || page === 'home') return;

  const destinations = {
    auth: 'index.html',
    admin: 'cuenta.html',
    account: 'index.html',
    team: 'index.html#quienes-somos',
    'password-recovery': 'acceso.html',
    session: 'cuenta.html',
    request: 'index.html#servicios'
  };
  const nav = $('.site-nav .site-links');
  if (!nav) return;

  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'site-back-link';
  link.href = destinations[page] || 'index.html';
  link.textContent = '← Volver';
  item.append(link);
  nav.prepend(item);
}

function inputMarkup(field) {
  const id = `field-${field.name}`;
  if (field.type === 'select') {
    const options = field.options.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    return `<div class="form-group"><label for="${id}">${escapeHtml(field.label)}</label><select id="${id}" name="${field.name}" required>${options}</select></div>`;
  }
  if (field.type === 'textarea') return `<div class="form-group"><label for="${id}">${escapeHtml(field.label)}</label><textarea id="${id}" name="${field.name}" rows="3" placeholder="${escapeHtml(field.placeholder || '')}"></textarea></div>`;
  const attrs = [field.min != null ? `min="${field.min}"` : '', field.max != null ? `max="${field.max}"` : '', field.value != null ? `value="${field.value}"` : '', field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''].filter(Boolean).join(' ');
  return `<div class="form-group"><label for="${id}">${escapeHtml(field.label)}</label><input id="${id}" name="${field.name}" type="${field.type}" ${attrs} ${field.type === 'number' ? 'required' : ''}></div>`;
}

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function calculateEstimate(key, data) {
  const prices = CONFIG.prices;
  const duration = Number(data.duration || 0);
  const attendees = Number(data.attendees || 0);
  if (key === 'clases') return duration / 60 * prices.groupClassHourly + attendees * prices.groupClassPerAttendee;
  if (key === 'sustituciones') return duration * prices.substitutionHourly;
  if (key === 'personal') return duration / 60 * (data.modality === 'Dúo' ? prices.personalTrainingDuoHourly : prices.personalTrainingHourly) * Number(data.sessionsPerWeek || 1);
  if (key === 'campus') return attendees * prices.campusPerAttendee * Math.max(duration / 4, 1);
  if (key === 'eventos') return prices.eventBase + duration * prices.eventHourly + attendees * 5;
  return 0;
}

function requestDestination(key) {
  const fallback = `solicitud.html?servicio=${encodeURIComponent(key)}`;
  const candidate = new URLSearchParams(location.search).get('returnTo');
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate, location.href);
    return parsed.origin === location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

function safeNext(fallback) {
  const candidate = new URLSearchParams(location.search).get('next');
  if (!candidate) return fallback;
  try {
    const parsed = new URL(candidate, location.href);
    return parsed.origin === location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

function openAuthForRequest(key, data) {
  sessionStorage.setItem('gr-sports-request-draft', JSON.stringify({ serviceKey: key, data }));
  const next = encodeURIComponent(requestDestination(key));
  location.href = `acceso.html?next=${next}`;
}

async function initAuth(user) {
  if (user) {
    const next = safeNext('cuenta.html');
    location.replace(next);
    return;
  }

  $$('.auth-tab').forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.authTab;
    $$('.auth-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    $$('[data-auth-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.authPanel !== selected));
  }));

  $('#login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter || $('#login-form button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Iniciando sesión…';
    setMessage('auth-message', '');
    try {
      if (!supabase) throw new Error('Supabase aún no está configurado. Comprueba config.js.');
      const { error } = await supabase.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
      if (error) throw error;
      location.replace(safeNext('cuenta.html'));
    } catch (error) {
      setMessage('auth-message', friendlyError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  $('#register-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter || $('#register-form button[type="submit"]');
    if (!supabase) return setMessage('auth-message', 'Supabase aún no está configurado. Comprueba config.js.', true);
    const fullName = $('#register-name').value.trim();
    const phone = $('#register-phone').value.trim();
    const email = $('#register-email').value.trim();
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Creando cuenta…';
    setMessage('auth-message', '');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: $('#register-password').value,
        options: {
          data: { full_name: fullName, phone },
          emailRedirectTo: new URL('.', location.href).href
        }
      });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase no devolvió el usuario creado. Inténtalo de nuevo.');
      if (data.session) {
        location.replace(safeNext('cuenta.html'));
        return;
      }
      setMessage('auth-message', `Cuenta guardada. Confirma tu correo desde el enlace que enviamos a ${email}; después podrás iniciar sesión. Revisa también la carpeta de spam.`);
    } catch (error) {
      setMessage('auth-message', friendlyError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

async function initPasswordRecovery(user) {
  const isRecoveryCallback = new URLSearchParams(location.search).get('recovery') === '1';
  const requestForm = $('#recovery-request-form');
  const resetForm = $('#password-reset-form');

  if (!supabase) return setMessage('auth-message', 'Supabase aún no está configurado. Comprueba config.js.', true);

  requestForm?.classList.toggle('hidden', isRecoveryCallback);
  resetForm?.classList.toggle('hidden', !isRecoveryCallback || !user);

  if (isRecoveryCallback && user) {
    $('#reset-email').value = user.email || '';
  } else if (isRecoveryCallback) {
    setMessage('auth-message', 'El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo e inténtalo otra vez.', true);
  }

  requestForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = event.submitter || requestForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando…';
    setMessage('auth-message', '');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail($('#recovery-email').value.trim(), {
        redirectTo: new URL('restablecer.html?recovery=1', location.href).href
      });
      if (error) throw error;
      setMessage('auth-message', 'Si existe una cuenta con ese correo, recibirás un enlace para verificarla y crear una nueva contraseña. Revisa también la carpeta de spam.');
    } catch (error) {
      setMessage('auth-message', friendlyError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  resetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    if (!user || !isRecoveryCallback) return setMessage('auth-message', 'El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo e inténtalo otra vez.', true);
    const email = $('#reset-email').value.trim().toLowerCase();
    if (email !== String(user.email || '').trim().toLowerCase()) return setMessage('auth-message', 'El correo no coincide con la cuenta verificada por el enlace.', true);
    if ($('#new-password').value !== $('#confirm-password').value) return setMessage('auth-message', 'Las contraseñas no coinciden.', true);

    const button = event.submitter || resetForm.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Guardando…';
    setMessage('auth-message', '');
    try {
      const { error } = await supabase.auth.updateUser({ password: $('#new-password').value });
      if (error) throw error;
      setMessage('auth-message', 'Contraseña actualizada. Ya puedes iniciar sesión.');
      location.replace(isAdmin(user) ? 'administracion.html' : 'cuenta.html');
    } catch (error) {
      setMessage('auth-message', friendlyError(error), true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

async function initRequest(user) {
  const params = new URLSearchParams(location.search);
  const key = params.get('servicio') || 'clases';
  const service = SERVICE_TYPES[key];
  if (!service) {
    setMessage('request-message', 'No encontramos ese servicio. Vuelve a la lista y selecciona uno.', true);
    return;
  }
  $('#service-title').textContent = service.title;
  $('#service-intro').textContent = service.intro;
  $('#service-fields').innerHTML = service.fields.map(inputMarkup).join('');

  const draft = JSON.parse(sessionStorage.getItem('gr-sports-request-draft') || 'null');
  if (draft?.serviceKey === key) {
    for (const [name, value] of Object.entries(draft.data)) {
      const input = $(`[name="${CSS.escape(name)}"]`);
      if (input) input.value = value;
    }
    sessionStorage.removeItem('gr-sports-request-draft');
    if (user) revealEstimate(key, formValues($('#service-form')));
  }

  $('#service-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    if (!user) {
      openAuthForRequest(key, data);
      return;
    }
    revealEstimate(key, data);
  });

  $('#confirm-request').addEventListener('click', () => saveRequest(user, key, service, 'estimate'));
  $('#whatsapp-request').addEventListener('click', async event => {
    event.preventDefault();
    if (!CONFIG.whatsappNumber) {
      setMessage('request-message', 'El número de WhatsApp está pendiente de configurar. Puedes confirmar la estimación para enviar la solicitud al equipo.');
      return;
    }
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      setMessage('request-message', 'Permite abrir una pestaña para continuar en WhatsApp.', true);
      return;
    }
    const data = formValues($('#service-form'));
    const estimate = calculateEstimate(key, data);
    const { error } = await insertRequest(user, key, service, data, estimate, 'whatsapp');
    if (error) {
      popup.close();
      setMessage('request-message', friendlyError(error), true);
      return;
    }
    const phone = CONFIG.whatsappNumber.replace(/\D/g, '');
    const text = `Hola, quiero solicitar el presupuesto final para ${service.title}. La estimación orientativa es ${formatMoney(estimate)}.`;
    popup.opener = null;
    popup.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    setMessage('request-message', 'Solicitud registrada. Se abrirá WhatsApp para que revises y envíes el mensaje cuando quieras.');
  });

  function revealEstimate(serviceKey, data) {
    const estimate = calculateEstimate(serviceKey, data);
    $('#estimate-value').textContent = `${formatMoney(estimate)} · estimación, no presupuesto final`;
    $('#estimate-box').classList.remove('hidden');
    $('#estimate-button').classList.add('hidden');
    $('#confirm-request').classList.remove('hidden');
    if (CONFIG.whatsappNumber) $('#whatsapp-request').classList.remove('hidden');
    else $('#whatsapp-request').classList.add('hidden');
  }
}

async function insertRequest(user, key, service, data, estimate, choice) {
  return supabase.from('service_requests').insert({
    user_id: user.id,
    service_key: key,
    service_title: service.title,
    details: data,
    estimate_eur: estimate,
    quote_choice: choice,
    status: 'pending'
  });
}

async function saveRequest(user, key, service, choice) {
  if (!user) return openAuthForRequest(key, formValues($('#service-form')));
  const data = formValues($('#service-form'));
  const estimate = calculateEstimate(key, data);
  const { error } = await insertRequest(user, key, service, data, estimate, choice);
  if (error) return setMessage('request-message', friendlyError(error), true);
  $('#service-form').reset();
  $('#estimate-box').classList.add('hidden');
  $('#confirm-request').classList.add('hidden');
  $('#whatsapp-request').classList.add('hidden');
  $('#estimate-button').classList.remove('hidden');
  setMessage('request-message', 'Solicitud enviada al equipo GR Sports. Podrás seguir el estado en tu espacio de usuario.');
}

async function initAccount(user) {
  if (!user) return location.replace(`acceso.html?next=${encodeURIComponent('cuenta.html')}`);
  const profile = await getProfile(user);
  $('#account-name').textContent = profile.full_name?.split(' ')[0] || 'deportista';
  const [requestResult, participantResult] = await Promise.all([
    supabase.from('service_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('session_participants').select('session_id, sessions(id,title,starts_at,ends_at,location,notes,allow_user_chat)').eq('user_id', user.id)
  ]);
  if (requestResult.error || participantResult.error) throw requestResult.error || participantResult.error;
  const requests = requestResult.data || [];
  const sessions = (participantResult.data || []).map(row => row.sessions).filter(Boolean).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  $('#request-list').innerHTML = requests.length ? requests.map(request => `
    <article class="list-card"><div class="toolbar"><h3>${escapeHtml(request.service_title)}</h3><span class="status-pill ${escapeHtml(request.status)}">${STATUS_LABELS[request.status] || 'En espera'}</span></div>
      <p>Solicitud del ${formatDate(request.created_at, { dateStyle: 'medium' })} · Estimación: ${formatMoney(request.estimate_eur)}</p>
      <p>Opción: ${request.quote_choice === 'whatsapp' ? 'Presupuesto final por WhatsApp' : 'Confirmar estimación'}</p>
      ${request.admin_response ? `<p><strong>Respuesta del equipo:</strong> ${escapeHtml(request.admin_response)}</p>` : ''}</article>`).join('') : '<div class="list-card"><p>Todavía no has enviado ninguna solicitud.</p><a class="card-link" href="index.html#servicios">Ver servicios →</a></div>';
  $('#session-list').innerHTML = sessions.length ? sessions.map(session => `
    <article class="list-card"><div class="toolbar"><h3>${escapeHtml(session.title)}</h3><span class="status-pill">${new Date(session.starts_at) < new Date() ? 'Realizada' : 'Próxima'}</span></div>
      <p>${formatDate(session.starts_at)} · ${escapeHtml(session.location)}</p><p>${escapeHtml(session.notes || 'El entrenador todavía no ha añadido indicaciones.')}</p>
      <a class="card-link" href="sesion.html?id=${encodeURIComponent(session.id)}">Abrir chat de la sesión →</a></article>`).join('') : '<div class="list-card"><p>Cuando el equipo te asigne una clase o entrenamiento, aparecerá aquí.</p></div>';
  supabase.channel(`account-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `user_id=eq.${user.id}` }, () => initAccount(user)).subscribe();
}

let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let adminRequests = [];
let adminSessions = [];

async function initAdmin(user) {
  if (!user) return location.replace(`acceso.html?next=${encodeURIComponent('administracion.html')}`);
  if (!isAdmin(user)) {
    setMessage('admin-message', 'Esta zona es solo para administradores. Tu cuenta tiene el rol: ' + roleLabel(user) + '.', true);
    return;
  }
  await loadAdminData();
  $('#month-prev').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
  $('#month-next').addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });
  $('#new-session-open').addEventListener('click', () => $('#session-dialog').showModal());
  $('#session-dialog-close').addEventListener('click', () => $('#session-dialog').close());
  $('#session-form').addEventListener('submit', createSession);
  supabase.channel('admin-live').on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, loadAdminData).subscribe();
}

async function loadAdminData() {
  const [requestResult, sessionResult] = await Promise.all([
    supabase.from('service_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('sessions').select('*').order('starts_at')
  ]);
  if (requestResult.error || sessionResult.error) throw requestResult.error || sessionResult.error;
  const ids = [...new Set((requestResult.data || []).map(request => request.user_id))];
  let profiles = [];
  if (ids.length) {
    const profileResult = await supabase.from('profiles').select('id,full_name,email,phone').in('id', ids);
    if (profileResult.error) throw profileResult.error;
    profiles = profileResult.data || [];
  }
  const profileById = new Map(profiles.map(profile => [profile.id, profile]));
  adminRequests = (requestResult.data || []).map(request => ({ ...request, profile: profileById.get(request.user_id) }));
  adminSessions = sessionResult.data || [];
  renderAdminRequests();
  renderCalendar();
  renderRequestOptions();
}

function renderAdminRequests() {
  const pending = adminRequests.filter(request => request.status === 'pending');
  $('#admin-request-list').innerHTML = pending.length ? pending.map(request => {
    const details = Object.entries(request.details || {}).map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</li>`).join('');
    return `<article class="list-card"><div class="toolbar"><h3>${escapeHtml(request.service_title)}</h3><span class="status-pill pending">En espera</span></div>
      <p><strong>${escapeHtml(request.profile?.full_name || 'Usuario')}</strong>${request.profile?.email ? ` · ${escapeHtml(request.profile.email)}` : ''}${request.profile?.phone ? ` · ${escapeHtml(request.profile.phone)}` : ''}</p>
      <p>Recibida el ${formatDate(request.created_at)} · Estimación ${formatMoney(request.estimate_eur)} · ${request.quote_choice === 'whatsapp' ? 'Pidió presupuesto final por WhatsApp' : 'Aceptó estimación orientativa'}</p><ul>${details}</ul>
      <div class="form-group"><label for="response-${request.id}">Respuesta para la persona</label><input id="response-${request.id}" placeholder="Mensaje opcional"></div>
      <div class="toolbar"><button type="button" class="btn btn-primary" data-request-action="approved" data-request-id="${request.id}">Aceptar</button><button type="button" class="btn btn-outline" data-request-action="rejected" data-request-id="${request.id}">Rechazar</button></div></article>`;
  }).join('') : '<div class="list-card"><p>No hay solicitudes pendientes.</p></div>';
  $$('[data-request-action]').forEach(button => button.addEventListener('click', () => updateRequest(button.dataset.requestId, button.dataset.requestAction)));
}

async function updateRequest(id, status) {
  const response = $(`#response-${CSS.escape(id)}`)?.value.trim() || '';
  const { error } = await supabase.from('service_requests').update({ status, admin_response: response }).eq('id', id);
  if (error) return setMessage('admin-message', friendlyError(error), true);
  await loadAdminData();
  setMessage('admin-message', status === 'approved' ? 'Solicitud aceptada.' : 'Solicitud rechazada.');
}

function renderRequestOptions() {
  const select = $('#session-request');
  if (!select) return;
  const approved = adminRequests.filter(request => request.status === 'approved');
  select.innerHTML = '<option value="">Sin solicitud vinculada</option>' + approved.map(request => `<option value="${request.id}">${escapeHtml(request.service_title)} · ${formatDate(request.created_at, { dateStyle: 'medium' })}</option>`).join('');
}

async function createSession(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const requestId = $('#session-request').value;
  const { data, error } = await supabase.from('sessions').insert({
    title: $('#session-title').value.trim(),
    starts_at: new Date($('#session-start').value).toISOString(),
    ends_at: new Date($('#session-end').value).toISOString(),
    location: $('#session-location').value.trim(),
    trainer_id: (await currentUser()).id,
    notes: $('#session-notes').value.trim(),
    allow_user_chat: $('#allow-chat').checked
  }).select().single();
  if (error) return setMessage('admin-message', friendlyError(error), true);
  if (requestId) {
    const request = adminRequests.find(item => item.id === requestId);
    const { error: participantError } = await supabase.from('session_participants').insert({ session_id: data.id, user_id: request.user_id, request_id: request.id });
    if (participantError) setMessage('admin-message', `La clase está en el calendario, pero no se pudo asociar al cliente: ${friendlyError(participantError)}`, true);
  }
  form.reset();
  $('#session-dialog').close();
  await loadAdminData();
  setMessage('admin-message', 'Clase añadida al calendario.');
}

function renderCalendar() {
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - offset);
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(calendarMonth);
  $('#month-label').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const week = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  let markup = week.map(day => `<div class="calendar-head">${day}</div>`).join('');
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const daySessions = adminSessions.filter(session => {
      const date = new Date(session.starts_at);
      return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
    });
    const outside = day.getMonth() !== calendarMonth.getMonth() ? ' outside' : '';
    markup += `<div class="calendar-day${outside}"><strong>${day.getDate()}</strong>${daySessions.map(session => `<a class="calendar-event" href="sesion.html?id=${encodeURIComponent(session.id)}">${escapeHtml(formatDate(session.starts_at, { hour: '2-digit', minute: '2-digit' }))} · ${escapeHtml(session.title)}</a>`).join('')}</div>`;
  }
  $('#calendar').innerHTML = markup;
}

let activeSession = null;

async function initSession(user) {
  if (!user) return location.replace(`acceso.html?next=${encodeURIComponent(location.pathname + location.search)}`);
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return setMessage('session-message', 'Falta el identificador de la sesión.', true);
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
  if (error || !data) return setMessage('session-message', friendlyError(error || new Error('No encontramos la sesión o no tienes acceso.')), true);
  activeSession = data;
  $('#session-title').textContent = data.title;
  $('#session-meta').textContent = `${formatDate(data.starts_at)} · ${data.location}`;
  const notesContainer = $('#session-notes');
  if (isStaff(user)) {
    notesContainer.innerHTML = `<textarea id="edit-session-notes" rows="4">${escapeHtml(data.notes || '')}</textarea><button id="save-session-notes" class="btn btn-outline" type="button">Guardar indicaciones</button>`;
    $('#save-session-notes').addEventListener('click', async () => {
      const { error: saveError } = await supabase.from('sessions').update({ notes: $('#edit-session-notes').value.trim() }).eq('id', data.id);
      if (saveError) setMessage('session-message', friendlyError(saveError), true);
      else setMessage('session-message', 'Indicaciones actualizadas.');
    });
  } else notesContainer.textContent = data.notes || 'El entrenador todavía no ha añadido indicaciones.';
  const participant = await supabase.from('session_participants').select('user_id').eq('session_id', id).eq('user_id', user.id).maybeSingle();
  const canChat = isStaff(user) || (Boolean(participant.data) && data.allow_user_chat);
  $('#chat-permission').textContent = isStaff(user) ? 'Como parte del equipo puedes escribir en este chat.' : canChat ? 'El entrenador ha permitido que el grupo escriba en este chat.' : 'El entrenador todavía no ha habilitado los mensajes para participantes.';
  $('#chat-form').classList.toggle('hidden', !canChat);
  $('#chat-form').addEventListener('submit', sendChatMessage);
  await loadChatMessages(user, id);
  supabase.channel(`session-chat-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${id}` }, () => loadChatMessages(user, id)).subscribe();
}

async function loadChatMessages(user, sessionId) {
  const { data, error } = await supabase.from('chat_messages').select('id,sender_id,body,created_at').eq('session_id', sessionId).order('created_at');
  if (error) return setMessage('session-message', friendlyError(error), true);
  $('#chat-messages').innerHTML = (data || []).map(message => `<div class="chat-message${message.sender_id === user.id ? ' mine' : ''}"><small>${message.sender_id === user.id ? 'Tú' : 'Participante'} · ${escapeHtml(formatDate(message.created_at))}</small>${escapeHtml(message.body)}</div>`).join('') || '<p class="muted">Aún no hay mensajes en este chat.</p>';
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
}

async function sendChatMessage(event) {
  event.preventDefault();
  const user = await currentUser();
  const body = $('#chat-input').value.trim();
  if (!body) return;
  const { error } = await supabase.from('chat_messages').insert({ session_id: activeSession.id, sender_id: user.id, body });
  if (error) return setMessage('session-message', friendlyError(error), true);
  $('#chat-input').value = '';
  await loadChatMessages(user, activeSession.id);
}

async function loadNews() {
  if (!supabase) return;
  const { data, error } = await supabase.from('news_posts').select('title,summary,body,published_at').eq('is_published', true).order('published_at', { ascending: false }).limit(6);
  if (error || !data?.length) return;
  const renderParagraph = paragraph => {
    const parts = [];
    const urls = String(paragraph).split(/(https:\/\/[^\s]+)/g);
    for (const part of urls) {
      if (!part.startsWith('https://')) {
        parts.push(escapeHtml(part));
        continue;
      }
      const trimmed = part.replace(/[),.;]+$/, '');
      const suffix = part.slice(trimmed.length);
      try {
        const url = new URL(trimmed);
        if (url.protocol !== 'https:') throw new Error('Unsupported URL protocol');
        const label = url.hostname === 'www.sciencedaily.com' ? 'ScienceDaily' : url.hostname;
        parts.push(`<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>${escapeHtml(suffix)}`);
      } catch {
        parts.push(escapeHtml(part));
      }
    }
    return `<p>${parts.join('')}</p>`;
  };
  $('#news-list').innerHTML = data.map(post => {
    const body = String(post.body || '').split(/\n\s*\n/).filter(Boolean).map(renderParagraph).join('');
    const summary = post.summary ? renderParagraph(post.summary) : '';
    return `<article class="card-angular"><h3>${escapeHtml(post.title)}</h3>${summary}${body}<small class="muted">${post.published_at ? formatDate(post.published_at, { dateStyle: 'medium' }) : ''}</small></article>`;
  }).join('');
}

async function boot() {
  setupBackNavigation();
  showSetupMessage();
  if (!isSupabaseConfigured || !supabase) {
    if (document.body.dataset.page === 'home') $('#news-list')?.insertAdjacentHTML('beforeend', '<article class="card-angular"><p class="muted">Las noticias aparecerán aquí cuando se conecte la base de datos.</p></article>');
    return;
  }
  try {
    const user = await currentUser();
    await renderNavigation(user);
    const page = document.body.dataset.page;
    if (page === 'auth') await initAuth(user);
    if (page === 'password-recovery') await initPasswordRecovery(user);
    if (page === 'request') await initRequest(user);
    if (page === 'account') await initAccount(user);
    if (page === 'admin') await initAdmin(user);
    if (page === 'session') await initSession(user);
    if (page === 'home') await loadNews();
  } catch (error) {
    const page = document.body.dataset.page;
    const id = { auth: 'auth-message', 'password-recovery': 'auth-message', request: 'request-message', account: 'account-message', admin: 'admin-message', session: 'session-message' }[page];
    if (id) setMessage(id, friendlyError(error), true);
  }
}

boot();
