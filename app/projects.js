// Firebase config e inicialización
const firebaseConfig = {
  apiKey: "AIzaSyDTuzGWaKLFzjHPfpVSQDzkSZeIA-Nv-4s",
  authDomain: "agilify-c9abf.firebaseapp.com",
  projectId: "agilify-c9abf",
  storageBucket: "agilify-c9abf.firebasestorage.app",
  messagingSenderId: "115735342206",
  appId: "1:115735342206:web:1ff5368de61190dac53c2f"
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// DOM refs
const lista = document.getElementById('listaProyectos');
const btnNuevo = document.getElementById('btnNuevoProyecto');
const btnLogout = document.getElementById('btnLogout');
const modal = document.getElementById('modal-proyecto');
const btnCerrar = document.getElementById('cerrarModalProyecto');
const form = document.getElementById('formProyecto');
const modalInvitar = document.getElementById('modal-invitar');
const formInvitar = document.getElementById('formInvitar');
const btnCerrarInvitar = document.getElementById('cerrarModalInvitar');

// Estado global de carga (para skeleton, etc)
let loading = true;

// Autenticación y carga inicial
auth.onAuthStateChanged(user => {
  if (!user) return window.location.href = 'login.html';
  cargarProyectos(user.uid);
});

// Logout
btnLogout.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'login.html';
});

// Nuevo proyecto
btnNuevo.addEventListener('click', () => {
  form.reset();
  form.proyectoId.value = '';
  modal.classList.remove('hidden');
});
btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));

form.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  const id = form.proyectoId.value || db.collection('projects').doc().id;
  const data = {
    name: form.proyectoNombre.value,
    description: form.proyectoDescripcion.value || '',
    owner: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    members: [user.uid] // <--- SIEMPRE agrega el owner al array
  };
  // Guarda/actualiza el proyecto y asegura que el owner siempre esté en el array members
  await db.collection('projects').doc(id).set(data, { merge: true });
  // Asegura también el documento en la subcolección members
  await db.collection('projects').doc(id)
    .collection('members').doc(user.uid)
    .set({
      role: 'owner',
      invitedBy: user.uid,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      displayName: user.displayName || ''
    });
  modal.classList.add('hidden');
});

// Cargar proyectos donde soy miembro
function cargarProyectos(uid) {
  db.collection('projects')
    .where('members', 'array-contains', uid)
    .onSnapshot(snap => {
      lista.innerHTML = '';
      if (snap.empty) {
        // Si no hay proyectos, muestra mensaje o skeleton
        lista.innerHTML = `<li class="text-center text-gray-400 py-8">No hay proyectos para este usuario.</li>`;
        return;
      }
      snap.docs.forEach(doc => renderProyecto(doc.id, doc.data()));
    }, err => {
      console.error("Error en snapshot listener:", err);
      lista.innerHTML = `<li class="text-center text-red-600 py-8">Error cargando proyectos.</li>`;
    });
}

// Render de un proyecto
async function renderProyecto(projectId, p) {
  const li = document.createElement('li');
  li.className = 'bg-white p-4 rounded shadow';

  // Header con iconos y título clicable
  const header = document.createElement('div');
  header.className = 'flex justify-between items-center';
  header.innerHTML = `
    <div class="project-title flex items-center gap-2 hover:text-blue-600 cursor-pointer">
      <i class="fas fa-chart-bar text-black"></i>
      <span class="font-semibold">${p.name}</span>
    </div>
    <div class="flex gap-2">
      <button class="abrir-proyecto text-black hover:text-gray-700">
        <i class="fas fa-list-check"></i>
      </button>
      <button class="agregar-miembro text-black hover:text-gray-700">
        <i class="fas fa-user-plus"></i>
      </button>
      <button class="eliminar-proyecto text-black hover:text-gray-700">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  li.appendChild(header);

  // Título clickable: abre board.html
  header.querySelector('.project-title')
    .addEventListener('click', () => {
      window.location.href = `board.html?projectId=${projectId}`;
    });

  // Botones
  header.querySelector('.abrir-proyecto')
    .addEventListener('click', () => window.location.href = `board.html?projectId=${projectId}`);

  header.querySelector('.agregar-miembro')
    .addEventListener('click', () => {
      document.getElementById('invitarProjectId').value = projectId;
      document.getElementById('invitarFirstName').value = '';
      document.getElementById('invitarLastName').value = '';
      document.getElementById('invitarUserEmail').value = '';
      document.getElementById('invitarRole').value = 'member';
      modalInvitar.classList.remove('hidden');
    });

  header.querySelector('.eliminar-proyecto')
    .addEventListener('click', async () => {
      if (!confirm('¿Eliminar proyecto y todas sus tareas?')) return;
      await db.collection('projects').doc(projectId).delete();
    });

  lista.appendChild(li);

  // Línea de miembros
  const membersLine = document.createElement('p');
  membersLine.className = 'mt-2 text-xs text-gray-700 flex items-center gap-1';
  membersLine.innerHTML = `<i class="fas fa-users text-black"></i> Cargando...`;
  li.appendChild(membersLine);

  // Cargar miembros y mostrar displayNames
  const membersSnap = await db.collection('projects').doc(projectId)
    .collection('members').get();

  const names = await Promise.all(membersSnap.docs.map(async mdoc => {
    const m = mdoc.data();
    if (m.displayName) return m.displayName;
    const usr = await db.collection('users').doc(mdoc.id).get();
    return usr.exists
      ? (usr.data().displayName || usr.data().email)
      : mdoc.id;
  }));

  membersLine.innerHTML = `<i class="fas fa-users text-black"></i> ${names.join(', ')}`;
}

// Modal invitar usuario
btnCerrarInvitar.addEventListener('click', () => modalInvitar.classList.add('hidden'));
formInvitar.addEventListener('submit', async e => {
  e.preventDefault();
  const projectId = document.getElementById('invitarProjectId').value;
  const firstName = document.getElementById('invitarFirstName').value.trim();
  const lastName  = document.getElementById('invitarLastName').value.trim();
  const email     = document.getElementById('invitarUserEmail').value.trim().toLowerCase();
  const role      = document.getElementById('invitarRole').value;
  const owner     = auth.currentUser.uid;

  // Buscar UID vía /users
  const q = await db.collection('users').where('email','==',email).limit(1).get();
  if (q.empty) {
    alert("❌ El email no existe en el sistema.");
    return;
  }
  const uid = q.docs[0].id;

  // Guardar en members con displayName
  await db.collection('projects').doc(projectId)
    .collection('members').doc(uid)
    .set({
      role,
      invitedBy: owner,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      displayName: `${firstName} ${lastName}`
    });
  // AGREGAR a members sin borrar los existentes:
  await db.collection('projects').doc(projectId)
    .update({
      members: firebase.firestore.FieldValue.arrayUnion(uid)
    });

  modalInvitar.classList.add('hidden');
  cargarProyectos(auth.currentUser.uid);
});
