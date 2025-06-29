// Firebase config e inicialización
const firebaseConfig = {
  apiKey: "AIzaSyDTuzGWaKLFzjHPfpVSQDzkSZeIA-Nv-4s",
  authDomain: "agilify-c9abf.firebaseapp.com",
  projectId: "agilify-c9abf",
  storageBucket: "agilify-c9abf.firebasestorage.app",
  messagingSenderId: "115735342206",
  appId: "1:115735342206:web:1ff5368de61190dac53c2f"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM refs
const lista               = document.getElementById('listaProyectos');
const skeleton            = document.getElementById('skeletonProyectos');
const btnNuevoProyecto    = document.getElementById('btnNuevoProyecto');
const btnLogout           = document.getElementById('btnLogout');
const btnPerfil           = document.getElementById('btnPerfil');
const modalProyecto       = document.getElementById('modal-proyecto');
const btnCerrarProyecto   = document.getElementById('cerrarModalProyecto');
const formProyecto        = document.getElementById('formProyecto');
const modalInvitar        = document.getElementById('modal-invitar');
const btnCerrarInvitar    = document.getElementById('cerrarModalInvitar');
const formInvitar         = document.getElementById('formInvitar');
const modalPerfil         = document.getElementById('modal-perfil');
const btnCerrarPerfil     = document.getElementById('cerrarModalPerfil');
const perfilContenido     = document.getElementById('perfilContenido');

// Toastify wrapper
function toast(msg, bg = "#3B82F6") {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    style: { background: bg }
  }).showToast();
}

// Autenticación inicial
auth.onAuthStateChanged(user => {
  if (!user) return window.location.href = 'login.html';
  cargarProyectos(user.uid);
  cargarPerfil(user.uid);
});

// Logout
btnLogout.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = 'login.html';
});

// Nuevo proyecto
btnNuevoProyecto.addEventListener('click', () => {
  formProyecto.reset();
  formProyecto.proyectoId.value = '';
  modalProyecto.classList.remove('hidden');
});
btnCerrarProyecto.addEventListener('click', () => modalProyecto.classList.add('hidden'));

// Crear/Editar proyecto
formProyecto.addEventListener('submit', async e => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) { toast("Debes iniciar sesión.", "#EF4444"); return; }

  const id = formProyecto.proyectoId.value || db.collection('projects').doc().id;
  const data = {
    name: formProyecto.proyectoNombre.value,
    description: formProyecto.proyectoDescripcion.value || '',
    owner: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    members: [user.uid]
  };
  try {
    await db.collection('projects').doc(id).set(data, { merge: true });
    await db.collection('projects').doc(id)
      .collection('members').doc(user.uid)
      .set({
        role: 'owner',
        invitedBy: user.uid,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayName: user.displayName || ''
      });
    toast("Proyecto guardado correctamente", "#22C55E");
    modalProyecto.classList.add('hidden');
  } catch (err) {
    console.error(err);
    toast("Error al guardar proyecto", "#EF4444");
  }
});

// Cargar proyectos
function cargarProyectos(uid) {
  if (skeleton) skeleton.classList.remove('hidden');
  db.collection('projects')
    .where('members','array-contains',uid)
    .onSnapshot(snapshot => {
      lista.innerHTML = '';
      if (snapshot.empty) {
        lista.innerHTML = `<li class="text-center text-gray-400 py-8">No tienes proyectos.</li>`;
        return;
      }
      snapshot.docs.forEach(doc => renderProyecto(doc.id, doc.data()));
    }, err => {
      console.error(err);
      toast("Error cargando proyectos", "#EF4444");
    });
}

// Render de un proyecto (con carga de miembros corregida)
async function renderProyecto(projectId, p) {
  const li = document.createElement('li');
  li.className = 'bg-white p-4 rounded shadow';
  li.innerHTML = `
    <div class="flex justify-between items-center">
      <div class="project-title flex items-center gap-2 hover:text-blue-600 cursor-pointer">
        <i class="fas fa-chart-bar"></i>
        <span class="font-semibold">${p.name}</span>
      </div>
      <div class="flex gap-2">
        <button class="abrir-proyecto" title="Abrir"><i class="fas fa-list-check"></i></button>
        <button class="agregar-miembro" title="Invitar"><i class="fas fa-user-plus"></i></button>
        <button class="eliminar-proyecto" title="Eliminar"><i class="fas fa-trash"></i></button>
      </div>
    </div>
    <p class="mt-2 text-xs text-gray-700 flex items-center gap-1">
      <i class="fas fa-users"></i> Cargando...
    </p>
  `;
  lista.appendChild(li);

  // Abrir board
  li.querySelector('.project-title').onclick =
    () => window.location.href = `board.html?projectId=${projectId}`;
  li.querySelector('.abrir-proyecto').onclick =
    () => window.location.href = `board.html?projectId=${projectId}`;

  // Invitar miembro
  li.querySelector('.agregar-miembro').onclick = () => {
    formInvitar.reset();
    formInvitar.invitarProjectId.value = projectId;
    modalInvitar.classList.remove('hidden');
  };

  // Eliminar con SweetAlert2
  li.querySelector('.eliminar-proyecto').onclick = async () => {
    const res = await Swal.fire({
      title: '¿Eliminar proyecto?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });
    if (res.isConfirmed) {
      await db.collection('projects').doc(projectId).delete();
      toast("Proyecto eliminado", "#EF4444");
    }
  };

  // Cargar miembros desde subcolección o fallback al owner
  const pLine = li.querySelector('p');
  const snapM = await db.collection('projects').doc(projectId).collection('members').get();
  let names = [];

  if (!snapM.empty) {
    for (const doc of snapM.docs) {
      const m = doc.data();
      if (m.displayName && m.displayName.trim()) {
        names.push(m.displayName);
      } else {
        // fallback a /users doc
        const u = await db.collection('users').doc(doc.id).get();
        if (u.exists && u.data().displayName) names.push(u.data().displayName);
        else names.push(u.exists ? u.data().email : doc.id);
      }
    }
  } else {
    // si no hay docs en members, mostramos al owner
    const u = await db.collection('users').doc(p.owner).get();
    if (u.exists && u.data().displayName) names.push(u.data().displayName);
    else names.push(u.exists ? u.data().email : p.owner);
  }

  pLine.innerHTML = `<i class="fas fa-users"></i> ${names.join(', ')}`;
}

// Invitar miembro
btnCerrarInvitar.onclick = () => modalInvitar.classList.add('hidden');
formInvitar.onsubmit = async e => {
  e.preventDefault();
  const projectId = formInvitar.invitarProjectId.value;
  const firstName = formInvitar.invitarFirstName.value.trim();
  const lastName  = formInvitar.invitarLastName.value.trim();
  const email     = formInvitar.invitarUserEmail.value.trim().toLowerCase();
  const role      = formInvitar.invitarRole.value;
  const owner     = auth.currentUser.uid;

  const q = await db.collection('users').where('email','==',email).limit(1).get();
  if (q.empty) { toast("Email no registrado", "#F59E0B"); return; }
  const uid = q.docs[0].id;

  await db.collection('projects').doc(projectId)
    .collection('members').doc(uid)
    .set({
      role,
      invitedBy: owner,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      displayName: `${firstName} ${lastName}`
    });
  await db.collection('projects').doc(projectId)
    .update({ members: firebase.firestore.FieldValue.arrayUnion(uid) });

  modalInvitar.classList.add('hidden');
  toast("Miembro agregado", "#22C55E");
  cargarProyectos(owner);
};

// Cargar perfil
async function cargarPerfil(uid) {
  const user = auth.currentUser;
  const ud   = await db.collection('users').doc(uid).get();
  const name = ud.exists ? ud.data().displayName : user.displayName || '';
  const email= user.email;
  const snap = await db.collection('projects').where('members','array-contains',uid).get();

  let html = `<div><b>Nombre:</b> ${name}</div><div><b>Email:</b> ${email}</div>
    <div><b>Proyectos:</b><ul>`;
  if (snap.empty) html += `<li>Ninguno</li>`;
  snap.forEach(d => html += `<li>${d.data().name}</li>`);
  html += `</ul></div>`;

  perfilContenido.innerHTML = html;
  btnPerfil.onclick = () => modalPerfil.classList.remove('hidden');
  btnCerrarPerfil.onclick = () => modalPerfil.classList.add('hidden');
}
