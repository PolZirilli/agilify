// --- Firebase config e inicialización ---
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

// --- DOM refs ---
const lista = document.getElementById('listaProyectos');
const btnNuevo = document.getElementById('btnNuevoProyecto');
const btnLogout = document.getElementById('btnLogout');
const modal = document.getElementById('modal-proyecto');
const btnCerrar = document.getElementById('cerrarModalProyecto');
const form = document.getElementById('formProyecto');
const skeleton = document.getElementById('skeleton'); // Ajusta si tu skeleton tiene otro id

// --- Autenticación y carga inicial ---
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  cargarProyectos(user.uid);
});

// --- Carga de proyectos ---
function cargarProyectos(uid) {
  if (skeleton) skeleton.style.display = "block";
  db.collection('projects')
    .where('members', 'array-contains', uid)
    .onSnapshot(snap => {
      if (skeleton) skeleton.style.display = "none";
      lista.innerHTML = '';
      if (snap.empty) {
        lista.innerHTML = `<li class="text-center text-gray-400">No tienes proyectos asignados.</li>`;
      } else {
        snap.docs.forEach(doc => renderProyecto(doc.id, doc.data()));
      }
    }, err => {
      if (skeleton) skeleton.style.display = "none";
      lista.innerHTML = `<li class="text-red-600">Error cargando proyectos: ${err.message}</li>`;
    });
}

// --- Render de un proyecto (ajusta esto a tu HTML si tenés más info) ---
function renderProyecto(projectId, p) {
  const li = document.createElement('li');
  li.className = 'bg-white p-4 rounded shadow mb-4 flex justify-between items-center';
  li.innerHTML = `
    <div>
      <span class="font-semibold">${p.name}</span>
      <span class="block text-xs text-gray-500">${p.description || ''}</span>
    </div>
    <button onclick="window.location.href='board.html?projectId=${projectId}'"
      class="bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700">
      Abrir
    </button>
  `;
  lista.appendChild(li);
}

// --- Nuevo proyecto ---
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
    members: [user.uid] // El owner es miembro inicial
  };
  await db.collection('projects').doc(id).set(data, { merge: true });
  modal.classList.add('hidden');
});

// --- Logout ---
btnLogout.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'login.html';
});
