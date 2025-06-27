// ======= Firebase config e inicialización =======
const firebaseConfig = {
  apiKey: "AIzaSyDTuzGWaKLFzjHPfpVSQDzkSZeIA-Nv-4s",
  authDomain: "agilify-c9abf.firebaseapp.com",
  projectId: "agilify-c9abf",
  storageBucket: "agilify-c9abf.firebasestorage.app",
  messagingSenderId: "115735342206",
  appId: "1:115735342206:web:1ff5368de61190dac53c2f"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ======= DOM refs =======
const lista           = document.getElementById('listaProyectos');
const skeleton        = document.getElementById('skeleton-projects');
const content         = document.getElementById('content-projects');
const btnNuevo        = document.getElementById('btnNuevoProyecto');
const btnLogout       = document.getElementById('btnLogout');
const modal           = document.getElementById('modal-proyecto');
const btnCerrar       = document.getElementById('cerrarModalProyecto');
const form            = document.getElementById('formProyecto');
const modalInvitar    = document.getElementById('modal-invitar');
const formInvitar     = document.getElementById('formInvitar');
const btnCerrarInv    = document.getElementById('cerrarModalInvitar');

// Estado local para evitar duplicados
const proyectosMap = {};

// ======= Autenticación y carga inicial =======
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    cargarProyectos();
  }
});

// ======= Logout =======
btnLogout.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'login.html';
});

// ======= Nuevo proyecto =======
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
    name:        form.proyectoNombre.value,
    description: form.proyectoDescripcion.value || '',
    owner:       user.uid,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
  // Guardar proyecto
  await db.collection('projects').doc(id).set(data, { merge: true });
  // Asegurar owner en members
  await db.collection('projects').doc(id)
    .collection('members').doc(user.uid)
    .set({
      role:        'owner',
      invitedBy:   user.uid,
      joinedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      displayName: user.displayName || ''
    });
  modal.classList.add('hidden');
});

// ======= Carga dual de proyectos =======
function cargarProyectos() {
  const uid = auth.currentUser.uid;

  // 1) proyectos que creaste
  db.collection('projects')
    .where('owner', '==', uid)
    .onSnapshot(snap => {
      snap.docs.forEach(doc => {
        proyectosMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      renderProyectos();
    });

  // 2) proyectos donde eres miembro (Collection Group)
  db.collectionGroup('members')
    .where(firebase.firestore.FieldPath.documentId(), '==', uid)
    .onSnapshot(async snap => {
      // Por cada doc de miembro, obtenemos su proyecto padre
      for (let mdoc of snap.docs) {
        const projectId = mdoc.ref.parent.parent.id;
        if (!proyectosMap[projectId]) {
          const pdoc = await db.collection('projects').doc(projectId).get();
          if (pdoc.exists) {
            proyectosMap[projectId] = { id: pdoc.id, ...pdoc.data() };
          }
        }
      }
      renderProyectos();
    });
}

// ======= Render de proyectos combinados =======
function renderProyectos() {
  // Primera vez: ocultar skeleton y mostrar contenido
  skeleton.classList.add('hidden');
  content.classList.remove('invisible');

  lista.innerHTML = '';
  Object.values(proyectosMap).forEach(p => {
    const li = document.createElement('li');
    li.className = 'bg-white p-4 rounded shadow mb-4';
    li.innerHTML = `
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2 cursor-pointer hover:text-blue-600 open-project">
          <i class="fas fa-chart-bar text-black"></i>
          <span class="font-semibold">${p.name}</span>
        </div>
        <div class="flex gap-2">
          <button class="open-project text-black hover:text-gray-700"><i class="fas fa-list-check"></i></button>
          <button class="invite-member text-black hover:text-gray-700"><i class="fas fa-user-plus"></i></button>
          <button class="delete-project text-black hover:text-gray-700"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <p class="mt-2 text-xs text-gray-600 flex items-center gap-1 members-line">
        <i class="fas fa-users text-black"></i> Cargando...
      </p>
    `;
    // abrir tablero
    li.querySelectorAll('.open-project').forEach(el =>
      el.addEventListener('click', () => window.location.href = `board.html?projectId=${p.id}`)
    );
    // invitar miembro
    li.querySelector('.invite-member').addEventListener('click', () => {
      document.getElementById('invitarProjectId').value = p.id;
      modalInvitar.classList.remove('hidden');
    });
    // borrar proyecto
    li.querySelector('.delete-project').addEventListener('click', async () => {
      if (!confirm('¿Eliminar proyecto y sus datos?')) return;
      await db.collection('projects').doc(p.id).delete();
      delete proyectosMap[p.id];
      renderProyectos();
    });

    lista.appendChild(li);

    // Cargar miembros para la línea inferior
    db.collection('projects').doc(p.id)
      .collection('members').get()
      .then(msnap => {
        const names = msnap.docs.map(d => d.data().displayName);
        li.querySelector('.members-line')
          .innerHTML = `<i class="fas fa-users text-black"></i> ${names.join(', ')}`;
      });
  });
}

// ======= Modal invitar usuario =======
btnCerrarInv.addEventListener('click', () => modalInvitar.classList.add('hidden'));
formInvitar.addEventListener('submit', async e => {
  e.preventDefault();
  const projectId = document.getElementById('invitarProjectId').value;
  const firstName = document.getElementById('invitarFirstName').value.trim();
  const lastName  = document.getElementById('invitarLastName').value.trim();
  const email     = document.getElementById('invitarUserEmail').value.trim().toLowerCase();
  const role      = document.getElementById('invitarRole').value;
  const owner     = auth.currentUser.uid;

  // Buscar UID vía users
  const q = await db.collection('users').where('email','==',email).limit(1).get();
  if (q.empty) {
    alert("❌ El email no existe en el sistema.");
    return;
  }
  const uid = q.docs[0].id;

  // Guardar en members
  await db.collection('projects').doc(projectId)
    .collection('members').doc(uid)
    .set({
      role,
      invitedBy: owner,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      displayName: `${firstName} ${lastName}`
    });

  modalInvitar.classList.add('hidden');
  cargarProyectos();
});
