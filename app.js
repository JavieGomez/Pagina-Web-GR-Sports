// GR SPORTS - Data Store & Application Logic

const STORAGE_KEYS = {
  USERS: 'gr_sports_users',
  CURRENT_USER: 'gr_sports_current_user',
  REQUESTS: 'gr_sports_pt_requests',
  ACTIVITIES: 'gr_sports_activities',
  INSCRIPTIONS: 'gr_sports_inscriptions'
};

// Gimnasios asociados
const PARTNER_GYMS = [
  'InterClub',
  'Particular / Sin gimnasio'
];

// Datos iniciales
function initData() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    const defaultUsers = [
      {
        id: 'admin_1',
        name: 'Administrador GR',
        email: 'admin@grsports.com',
        phone: '+34 600 000 000',
        password: 'admin',
        age: 30,
        height: 180,
        weight: 78,
        gym: 'InterClub',
        medicalNotes: 'Perfil Administrador principal',
        role: 'admin'
      },
      {
        id: 'user_1',
        name: 'Carlos Ruiz',
        email: 'carlos@ejemplo.com',
        phone: '+34 611 223 344',
        password: '123',
        age: 28,
        height: 175,
        weight: 74,
        gym: 'InterClub',
        medicalNotes: 'Ligera molestia en hombro derecho por tendinitis antigua.',
        role: 'user'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
    const defaultRequests = [
      {
        id: 'req_1',
        userId: 'user_1',
        userName: 'Carlos Ruiz',
        userGym: 'InterClub',
        trainingType: 'Entrenamiento Dúo (2 personas) - Pérdida de grasa y tono',
        preferredSchedule: 'Martes y Jueves a partir de las 18:30h',
        comments: 'Queremos empezar la semana que viene con mi compañero.',
        status: 'pending', // pending, approved, rejected
        adminResponse: '',
        date: new Date().toLocaleDateString('es-ES')
      }
    ];
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(defaultRequests));
  }

  if (!localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) {
    const defaultActivities = [
      {
        id: 'act_1',
        title: 'Masterclass ExtremFit Alta Intensidad',
        category: 'gimnasios',
        location: 'InterClub',
        date: '2026-10-18',
        time: '19:00',
        spots: 20,
        trainer: 'Miguel (Head Coach)'
      },
      {
        id: 'act_2',
        title: 'Campus Deportivo Diurno - Jornada Verano/Otoño',
        category: 'verano',
        location: 'Instalaciones Multideporte',
        date: '2026-10-25',
        time: '09:30 - 14:00',
        spots: 25,
        trainer: 'Equipo GR Sports'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(defaultActivities));
  }

  if (!localStorage.getItem(STORAGE_KEYS.INSCRIPTIONS)) {
    localStorage.setItem(STORAGE_KEYS.INSCRIPTIONS, JSON.stringify([]));
  }
}

// Helpers
function getUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function getCurrentUser() {
  const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return data ? JSON.parse(data) : null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
  updateUI();
}

function getRequests() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
}

function saveRequests(reqs) {
  localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(reqs));
}

function getActivities() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES) || '[]');
}

function saveActivities(acts) {
  localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(acts));
}

// UI State Management
function updateUI() {
  const user = getCurrentUser();
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const userMenu = document.getElementById('user-menu');
  const adminBtn = document.getElementById('nav-admin-btn');

  if (user) {
    navAuthBtn.style.display = 'none';
    userMenu.style.display = 'flex';
    document.getElementById('logged-user-name').textContent = user.name.split(' ')[0];

    if (user.role === 'admin') {
      adminBtn.style.display = 'inline-flex';
      const pendingCount = getRequests().filter(r => r.status === 'pending').length;
      document.getElementById('admin-badge-count').textContent = pendingCount > 0 ? `(${pendingCount})` : '';
    } else {
      adminBtn.style.display = 'none';
    }
  } else {
    navAuthBtn.style.display = 'inline-flex';
    userMenu.style.display = 'none';
    adminBtn.style.display = 'none';
  }
}

// Modal handling
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Register user
function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const age = document.getElementById('reg-age').value;
  const height = document.getElementById('reg-height').value;
  const weight = document.getElementById('reg-weight').value;
  const gym = document.getElementById('reg-gym').value;
  const medicalNotes = document.getElementById('reg-notes').value.trim();

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    alert('Ya existe una cuenta con este correo electrónico.');
    return;
  }

  const newUser = {
    id: 'user_' + Date.now(),
    name,
    email,
    phone,
    password,
    age: Number(age),
    height: Number(height),
    weight: Number(weight),
    gym,
    medicalNotes: medicalNotes || 'Sin observaciones registradas.',
    role: 'user'
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  closeModal('modal-auth');
  alert(`¡Bienvenido a GR SPORTS, ${name}! Tu ficha técnica ha sido creada con éxito.`);
}

// Login
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  const users = getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    alert('Credenciales incorrectas. Comprueba tu correo y contraseña.');
    return;
  }

  setCurrentUser(user);
  closeModal('modal-auth');
  alert(`Sesión iniciada correctamente como ${user.name}`);
}

function logout() {
  setCurrentUser(null);
  alert('Has cerrado sesión correctamente.');
}

// Personal training request
function handlePTRequest(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) {
    alert('Debes iniciar sesión o crear tu cuenta antes de solicitar un entrenamiento personal para vincularlo a tu ficha técnica.');
    openModal('modal-auth');
    return;
  }

  const trainingType = document.getElementById('pt-type').value;
  const preferredSchedule = document.getElementById('pt-schedule').value.trim();
  const comments = document.getElementById('pt-comments').value.trim();

  const requests = getRequests();
  const newReq = {
    id: 'req_' + Date.now(),
    userId: user.id,
    userName: user.name,
    userGym: user.gym,
    trainingType,
    preferredSchedule,
    comments,
    status: 'pending',
    adminResponse: '',
    date: new Date().toLocaleDateString('es-ES')
  };

  requests.unshift(newReq);
  saveRequests(requests);
  e.target.reset();
  alert('¡Solicitud enviada con éxito! El entrenador administrador la revisará y recibirás confirmación.');
  updateUI();
}

// Render User Profile Modal
function showUserProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const profileContent = document.getElementById('profile-content');
  const userRequests = getRequests().filter(r => r.userId === user.id);

  let reqsHtml = '';
  if (userRequests.length === 0) {
    reqsHtml = '<p style="color: var(--text-muted);">Aún no has enviado solicitudes de entrenamiento.</p>';
  } else {
    reqsHtml = userRequests.map(r => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; margin-bottom: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
          <strong>${r.trainingType}</strong>
          <span class="badge-status badge-${r.status}">
            ${r.status === 'pending' ? 'Pendiente' : (r.status === 'approved' ? 'Aprobado' : 'Rechazado')}
          </span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0;"><strong>Horario deseado:</strong> ${r.preferredSchedule}</p>
        ${r.adminResponse ? `<p style="font-size: 0.9rem; color: var(--accent-cyan); margin-top: 4px;"><strong>Respuesta entrenador:</strong> ${r.adminResponse}</p>` : ''}
      </div>
    `).join('');
  }

  profileContent.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
      <div><strong>Nombre:</strong> ${user.name}</div>
      <div><strong>Email:</strong> ${user.email}</div>
      <div><strong>Teléfono:</strong> ${user.phone}</div>
      <div><strong>Gimnasio vinculado:</strong> <span class="badge-gym">${user.gym}</span></div>
      <div><strong>Edad:</strong> ${user.age} años</div>
      <div><strong>Altura / Peso:</strong> ${user.height} cm / ${user.weight} kg</div>
    </div>
    <div style="margin-bottom: 25px;">
      <strong>Historial médico / Observaciones físicas:</strong>
      <p style="background: #090d14; border: 1px solid var(--border-color); padding: 10px; margin-top: 6px; font-size: 0.95rem; color: var(--text-secondary);">
        ${user.medicalNotes}
      </p>
    </div>
    <h3 style="font-size: 1.4rem; color: var(--accent-cyan); margin-bottom: 12px;">Mis Solicitudes de Entrenamiento</h3>
    ${reqsHtml}
  `;

  openModal('modal-profile');
}

// Render Admin Panel
function showAdminPanel() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    alert('Acceso restringido únicamente para administradores.');
    return;
  }
  renderAdminRequests();
  renderAdminUsers();
  openModal('modal-admin');
}

function renderAdminRequests() {
  const requests = getRequests();
  const container = document.getElementById('admin-requests-list');
  if (requests.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay solicitudes registradas.</td></tr>';
    return;
  }

  container.innerHTML = requests.map(r => `
    <tr>
      <td>${r.date}</td>
      <td><strong>${r.userName}</strong><br><small style="color: var(--text-muted);">${r.userGym}</small></td>
      <td>${r.trainingType}<br><small style="color: var(--accent-cyan);">Horario: ${r.preferredSchedule}</small></td>
      <td>${r.comments || '-'}</td>
      <td>
        <span class="badge-status badge-${r.status}">
          ${r.status === 'pending' ? 'Pendiente' : (r.status === 'approved' ? 'Aprobado' : 'Rechazado')}
        </span>
      </td>
      <td>
        ${r.status === 'pending' ? `
          <button class="action-btn-sm btn-approve" onclick="updateRequestStatus('${r.id}', 'approved')">Aprobar</button>
          <button class="action-btn-sm btn-reject" onclick="updateRequestStatus('${r.id}', 'rejected')">Rechazar</button>
        ` : `
          <small style="color: var(--text-muted);">${r.adminResponse || 'Gestionado'}</small>
        `}
      </td>
    </tr>
  `).join('');
}

function renderAdminUsers() {
  const users = getUsers();
  const container = document.getElementById('admin-users-list');
  container.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}<br><small>${u.phone}</small></td>
      <td><span class="badge-gym">${u.gym}</span></td>
      <td>${u.age} años / ${u.height}cm / ${u.weight}kg</td>
      <td><small style="color: #cbd5e1;">${u.medicalNotes}</small></td>
      <td><span class="badge-status ${u.role === 'admin' ? 'badge-approved' : ''}">${u.role}</span></td>
    </tr>
  `).join('');
}

function updateRequestStatus(reqId, status) {
  const responseMsg = prompt(
    status === 'approved' 
      ? 'Mensaje o confirmación de horario para el alumno (opcional):' 
      : 'Motivo del rechazo / propuesta de cambio:'
  );

  const requests = getRequests();
  const req = requests.find(r => r.id === reqId);
  if (req) {
    req.status = status;
    req.adminResponse = responseMsg || (status === 'approved' ? '¡Solicitud aceptada! Nos pondremos en contacto.' : 'No disponible en ese horario.');
    saveRequests(requests);
    renderAdminRequests();
    updateUI();
  }
}

// Activity creation by admin
function handleAddActivity(e) {
  e.preventDefault();
  const title = document.getElementById('act-title').value.trim();
  const category = document.getElementById('act-category').value;
  const location = document.getElementById('act-location').value.trim();
  const date = document.getElementById('act-date').value;
  const time = document.getElementById('act-time').value.trim();
  const spots = document.getElementById('act-spots').value;

  const activities = getActivities();
  const newAct = {
    id: 'act_' + Date.now(),
    title,
    category,
    location,
    date,
    time,
    spots: Number(spots),
    trainer: 'Equipo GR Sports'
  };

  activities.unshift(newAct);
  saveActivities(activities);
  e.target.reset();
  alert('Nueva actividad agregada con éxito.');
  renderActivitiesCatalog();
}

// Render dynamic activities to public page
function renderActivitiesCatalog() {
  const activities = getActivities();
  const container = document.getElementById('dynamic-activities-list');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); grid-column: 1/-1;">No hay actividades programadas por el momento.</p>';
    return;
  }

  container.innerHTML = activities.map(act => `
    <div class="card-angular">
      <div class="angular-badge">${act.category === 'gimnasios' ? 'Para Gimnasio' : 'Campus / Verano'}</div>
      <h3 style="font-size: 1.6rem; margin-bottom: 8px;">${act.title}</h3>
      <p style="color: var(--text-secondary); margin-bottom: 12px;"><strong>Ubicación:</strong> ${act.location}</p>
      <p style="color: var(--accent-cyan); margin-bottom: 15px;"><strong>Fecha / Horario:</strong> ${act.date} a las ${act.time}</p>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size: 0.9rem; color: var(--text-muted);">Plazas: ${act.spots}</span>
        <button class="btn btn-outline" style="padding: 6px 14px; font-size: 1rem;" onclick="signUpActivity('${act.id}', '${act.title}')">Inscribirme</button>
      </div>
    </div>
  `).join('');
}

function signUpActivity(actId, title) {
  const user = getCurrentUser();
  if (!user) {
    alert('Debes iniciar sesión para inscribirte en una actividad.');
    openModal('modal-auth');
    return;
  }
  alert(`¡Te has inscrito con éxito a: "${title}"! Te esperamos.`);
}

// Window init
document.addEventListener('DOMContentLoaded', () => {
  initData();
  updateUI();
  renderActivitiesCatalog();

  // Tab switching for Auth
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-login').style.display = tab === 'login' ? 'block' : 'none';
      document.getElementById('tab-register').style.display = tab === 'register' ? 'block' : 'none';
    });
  });

  // Admin Tab switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('admin-sec-requests').style.display = tab === 'requests' ? 'block' : 'none';
      document.getElementById('admin-sec-users').style.display = tab === 'users' ? 'block' : 'none';
      document.getElementById('admin-sec-activities').style.display = tab === 'activities' ? 'block' : 'none';
    });
  });

  // Form listeners
  document.getElementById('form-register').addEventListener('submit', handleRegister);
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('form-pt-request').addEventListener('submit', handlePTRequest);
  document.getElementById('form-add-activity').addEventListener('submit', handleAddActivity);
});
