// projects.js

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
const db   = firebase.firestore();

// ======= DOM refs =======
const lista        = document.getElementById('listaProyectos');
const skeleton     = document.getElementById('skeleton-projects');
const content      = document.getElementById('content-projects');
const btnNuevo     = document.getElementById('btnNuevoProyecto');
const btnLogout    = document.getElementById('btnLogout');
const modal        = document.getElementById('modal-proyecto');
const btnCerrar    = document.getElementById('cerrarModalProyecto');
const form         = document.getElementById('formProyecto');
const modalInvitar = document.getElementById('modal-invitar');
const formInvitar  = document.getElementById('formInvitar');
const btnCerrarInv = document.getElementById('cerrarModalInvitar');

// ======= Autenticación y listado de proyectos =======
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    listarProyectos(user.uid);
  }
});

// ======= Cerrar sesión =======
btnLogout.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'login.html';
});

// ======= Crear/editar proyecto =======
btnNuevo.addEventListener('click', () => {
  form.reset();
  form.proyectoId.value = '';
  modal.classList.remove('hidden');
});
btnCerrar.addEventListener('click', () => modal.classList.add('hidden'));

form.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  const id   = form.proyectoId.value || db.collection('projects').doc().id;
  const data = {
    name:        form.proyectoNombre.value,
    description: form.proyectoDescripcion.value || '',
    owner:       user.uid,
    members:     firebase.firestore.FieldValue.arrayUnion(user.uid),
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };
  // Guardar el documento de proyecto (merge para no sobrescribir array completo)
  await db.collection('projects').doc(id).set(data, { merge: true });

  // También lo añadimos en la subcolección (opcional, por consistencia)
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

// ======= Listar proyectos donde eres miembro =======
function listarProyectos(uid) {
  db.collection('projects')
    .where('members', 'array-contains', uid)
    .onSnapshot(snap => {
      // ocultar skeleton y mostrar contenido
      skeleton.classList.add('hidden');
      content.classList.remove('invisible');

      lista.innerHTML = '';
      snap.docs
        .sort((a, b) => {
          const ta = a.data().createdAt?.seconds || 0;
          const tb = b.data().createdAt?.seconds || 0;
          return tb - ta;
        })
        .forEach(doc => renderProyecto(doc.id, doc.data()));
    }, err => {
      console.error("Error al cargar proyectos:", err);
      alert("No tienes permiso para ver estos proyectos.");
    });
}

// ======= Renderizar un proyecto =======
async function renderProyecto(projectId, p) {
  const li = document.createElement('li');
  li.className = 'bg-white p-4 rounded shadow mb-4';
  li.innerHTML = `
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2 cursor-pointer open-project hover:text-blue-600">
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

  // handlers básicos
  li.querySelectorAll('.open-project').forEach(el =>
    el.addEventListener('click', () => location.href = `board.html?projectId=${projectId}`)
  );
  li.querySelector('.invite-member').addEventListener('click', () => {
    document.getElementById('invitarProjectId').value = projectId;
    modalInvitar.classList.remove('hidden');
  });
  li.querySelector('.delete-project').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    await db.collection('projects').doc(projectId).delete();
  });

  lista.appendChild(li);

  // cargar nombres de members desde el array
  const names = await Promise.all(
    p.members.map(async uid => {
      const u = await db.collection('users').doc(uid).get();
      return u.exists ? (u.data().displayName || u.data().email) : uid;
    })
  );
  li.querySelector('.members-line')
    .innerHTML = `<i class="fas fa-users text-black"></i> ${names.join(', ')}`;
}

// ======= Invitar un miembro (arrayUnion + subcolección) =======
btnCerrarInv.addEventListener('click', () => modalInvitar.classList.add('hidden'));
formInvitar.addEventListener('submit', async e => {
  e.preventDefault();
  const projectId = document.getElementById('invitarProjectId').value;
  const firstName = document.getElementById('invitarFirstName').value.trim();
  const lastName  = document.getElementById('invitarLastName').value.trim();
  const email     = document.getElementById('invitarUserEmail').value.trim().toLowerCase();
  const role      = document.getElementById('invitarRole').value;
  const owner     = auth.currentUser.uid;

  // resolver UID por email
  const q = await db.collection('users').where('email', '==', email).limit(1).get();
  if (q.empty) {
    alert("❌ Ese email no existe en el sistema.");
    return;
  }
  const uid = q.docs[0].id;

  // actualizar el array members del proyecto
  await db.collection('projects').doc(projectId)
    .update({ members: firebase.firestore.FieldValue.arrayUnion(uid) });

  // y también en subcolección
  await db.collection('projects').doc(projectId)
    .collection('members').doc(uid)
    .set({
      role,
      invitedBy:   owner,
      joinedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      displayName: `${firstName} ${lastName}`
    });

  modalInvitar.classList.add('hidden');
});
