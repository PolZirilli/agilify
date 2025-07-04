// ======= Firebase config e inicialización =======
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

// ======= Obtener projectId de la URL =======
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');

if (!projectId) {
  console.error('No se proporcionó projectId en la URL');
  window.location.href = 'projects.html';
}

// ======= Control de autenticación =======
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    cargarTareasRealtime();
    cargarNombreProyecto();
  }
});

// ======= Referencias al DOM =======
const btnNueva = document.getElementById('btnNuevaTarea');
const btnBack = document.getElementById('btnBack');
const btnLogout = document.getElementById('btnLogout');
const modal = document.getElementById('modal-task');
const btnCerrar = document.getElementById('cerrarModal');
const form = document.getElementById('formTarea');
const btnEliminar = document.getElementById('btnEliminar');

// ======= Navegación =======
btnBack.onclick = () => window.location.href = 'projects.html';
btnLogout.onclick = () => auth.signOut();

// ======= Abrir/Cerrar modal =======
btnNueva.onclick = abrirModalNueva;
btnCerrar.onclick = cerrarModal;
window.onclick = e => { if (e.target === modal) cerrarModal(); };
window.onkeydown = e => { if (e.key === 'Escape') cerrarModal(); };

// ======= Drag & Drop =======
['todo', 'inprogress', 'paused', 'done'].forEach(id => {
  new Sortable(document.getElementById(id), {
    group: 'kanban',
    animation: 150,
    onEnd: evt => {
      const docId = evt.item.dataset.id;
      const newStatus = idColumnaAEstado(evt.to.id);
      db.collection('projects').doc(projectId)
        .collection('tasks').doc(docId)
        .update({ status: newStatus });
    }
  });
});

// ======= Guardar/actualizar tarea =======
form.onsubmit = e => {
  e.preventDefault();
  const id = form.tareaId.value || db.collection('projects').doc(projectId).collection('tasks').doc().id;

  const data = {
    title: form.titulo.value,
    description: form.descripcion.value,
    links: form.links.value.split(',').map(u => u.trim()).filter(u => u),
    priority: form.prioridad.value,
    dueDate: form.fecha.value
      ? firebase.firestore.Timestamp.fromDate(new Date(form.fecha.value))
      : null,
    status: form.estado.value,
    assignedTo: form.asignadoA.value || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('projects').doc(projectId)
    .collection('tasks').doc(id)
    .set(data, { merge: true });

  cerrarModal();
};

// ======= Eliminar tarea =======
btnEliminar.onclick = () => {
  const id = form.tareaId.value;
  if (!id) return;

  Swal.fire({
    title: '¿Eliminar tarea?',
    text: 'Esta acción no puede deshacerse.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      db.collection('projects').doc(projectId).collection('tasks').doc(id).delete();
      cerrarModal();
      Toastify({
        text: "✅ Tarea eliminada",
        style: { background: "#EF4444" }
      }).showToast();
    }
  });
};

// ======= Cargar tareas en tiempo real =======
function cargarTareasRealtime() {
  mostrarSkeleton();
  db.collection('projects').doc(projectId)
    .collection('tasks')
    .onSnapshot(snap => {
      const tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTareas(tareas);
      ocultarSkeleton();
    });
}

// ======= Skeleton =======
function mostrarSkeleton() {
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    const container = document.getElementById(id);
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'bg-gray-200 rounded p-2 mb-2 animate-pulse h-12';
      container.appendChild(skel);
    }
  });
}

function ocultarSkeleton() {
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
}

// ======= Renderizar tarjetas Kanban =======
async function renderTareas(tareas) {
  ocultarSkeleton();
  for (const id of ['todo', 'inprogress', 'paused', 'done']) {
    document.getElementById(id).innerHTML = '';
  }

  for (const t of tareas) {
    const card = document.createElement('div');
    card.className = 'bg-gray-200 rounded p-2 mb-2 shadow cursor-pointer';
    card.dataset.id = t.id;

    let assignedName = '';
    if (t.assignedTo) {
      const doc = await db.collection('projects').doc(projectId).collection('members').doc(t.assignedTo).get();
      if (doc.exists) assignedName = doc.data().displayName || '';
    }

    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div class="font-semibold truncate">${t.title}</div>
        <div class="text-xs font-bold uppercase ${
          t.priority === 'alta' ? 'text-red-600' :
          t.priority === 'media' ? 'text-yellow-600' : 'text-green-600'}">
          ${t.priority}
        </div>
      </div>
      <div class="text-xs text-gray-600">${assignedName}</div>
    `;

    card.onclick = () => abrirModalEditarTarea(t);
    document.getElementById(idColumnaAId(t.status)).appendChild(card);
  }
}

// ======= Modal handlers =======
function abrirModalNueva() {
  form.reset();
  form.tareaId.value = '';
  btnEliminar.classList.add('hidden');
  modal.classList.remove('hidden');
}

function abrirModalEditarTarea(tarea) {
  form.tareaId.value = tarea.id;
  form.titulo.value = tarea.title;
  form.descripcion.value = tarea.description || '';
  form.links.value = (tarea.links || []).join(', ');
  form.prioridad.value = tarea.priority;
  form.fecha.value = tarea.dueDate
    ? new Date(tarea.dueDate.seconds * 1000).toISOString().substr(0, 10)
    : '';
  form.asignadoA.value = tarea.assignedTo || '';
  form.estado.value = tarea.status;
  btnEliminar.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function cerrarModal() {
  modal.classList.add('hidden');
}

// ======= Helpers =======
function idColumnaAId(status) {
  return {
    'a-realizar': 'todo',
    'en-proceso': 'inprogress',
    'pausado': 'paused',
    'realizado': 'done'
  }[status];
}

function idColumnaAEstado(id) {
  return {
    'todo': 'a-realizar',
    'inprogress': 'en-proceso',
    'paused': 'pausado',
    'done': 'realizado'
  }[id];
}

// ======= Cargar miembros =======
async function cargarMiembrosProyecto() {
  const select = document.getElementById('asignadoA');
  select.innerHTML = '<option value="">-- No asignado --</option>';

  const membres = await db.collection('projects').doc(projectId).collection('members').get();
  membres.forEach(mdoc => {
    const m = mdoc.data();
    if (!m.displayName) return;
    const opt = document.createElement('option');
    opt.value = mdoc.id;
    opt.textContent = m.displayName;
    select.appendChild(opt);
  });
}

// ======= Cargar nombre del proyecto =======
function cargarNombreProyecto() {
  db.collection('projects').doc(projectId).get()
    .then(doc => {
      if (doc.exists) {
        document.getElementById('projectName').textContent = doc.data().name;
      }
    })
    .catch(err => {
      console.error(err);
      document.getElementById('projectName').textContent = "Error al cargar proyecto";
    });
}
