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
    cargarMiembrosProyecto();
    cargarTareasRealtime();
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
const selectAsig = document.getElementById('asignadoA');

let membersMap = {};

// ======= Navegación =======
btnBack.addEventListener('click', () => {
  window.location.href = 'projects.html';
});

// ======= Logout =======
btnLogout.addEventListener('click', () => auth.signOut());

// ======= Abrir/Cerrar modal nueva tarea =======
btnNueva.addEventListener('click', abrirModalNueva);
btnCerrar.addEventListener('click', cerrarModal);
window.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

// ======= Drag & Drop con SortableJS =======
['todo','inprogress','paused','done'].forEach(id => {
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

// ======= Guardar / actualizar tarea =======
form.addEventListener('submit', e => {
  e.preventDefault();
  const id = form.tareaId.value ||
    db.collection('projects').doc(projectId).collection('tasks').doc().id;

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
    assignedToName: form.asignadoA.value ? membersMap[form.asignadoA.value] : null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('projects').doc(projectId)
    .collection('tasks').doc(id)
    .set(data, { merge: true });

  cerrarModal();
});

// ======= Eliminar tarea =======
btnEliminar.addEventListener('click', () => {
  const id = document.getElementById('tareaId').value;
  if (!id) return;
  if (confirm('¿Eliminar tarea permanentemente?')) {
    db.collection('projects').doc(projectId)
      .collection('tasks').doc(id).delete();
    cerrarModal();
  }
});

// ======= Cargar tareas en tiempo real =======
function cargarTareasRealtime() {
  db.collection('projects').doc(projectId)
    .collection('tasks')
    .onSnapshot(snap => {
      renderTareas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

// ======= Renderizar tarjetas Kanban (con fondo gris) =======
function renderTareas(tareas) {
  ['todo','inprogress','paused','done'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  tareas.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-gray-200 rounded p-2 mb-2 shadow cursor-pointer';
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div class="font-semibold truncate">${t.title}</div>
        <div class="text-xs font-bold uppercase ${
          t.priority==='alta'?'text-red-600':
          t.priority==='media'?'text-yellow-600':'text-green-600'
        }">${t.priority}</div>
      </div>
      <div class="text-xs mb-1 text-gray-700">
        Asignado a: <b>${t.assignedToName || '—'}</b>
      </div>
      <div class="text-xs text-gray-500">
        ${t.dueDate ? new Date(t.dueDate.seconds*1000).toLocaleDateString() : ''}
      </div>
    `;
    card.addEventListener('click', () => abrirModalEditarTarea(t));
    document.getElementById(idColumnaAId(t.status)).appendChild(card);
  });
}

// ======= Funciones para abrir/cerrar modal =======
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
  form.links.value = (tarea.links||[]).join(', ');
  form.prioridad.value = tarea.priority;
  form.fecha.value = tarea.dueDate
                       ? new Date(tarea.dueDate.seconds*1000).toISOString().substr(0,10)
                       : '';
  form.asignadoA.value = tarea.assignedTo || '';
  form.estado.value = tarea.status;
  btnEliminar.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function cerrarModal() {
  modal.classList.add('hidden');
}

// ======= Mapeo estado <-> columna =======
function idColumnaAId(status) {
  if (status==='a-realizar') return 'todo';
  if (status==='en-proceso') return 'inprogress';
  if (status==='pausado') return 'paused';
  return 'done';
}

function idColumnaAEstado(id) {
  if (id==='todo') return 'a-realizar';
  if (id==='inprogress') return 'en-proceso';
  if (id==='paused') return 'pausado';
  return 'realizado';
}

// ======= Cargar miembros correctamente =======
async function cargarMiembrosProyecto() {
  selectAsig.innerHTML = '<option value="">-- No asignado --</option>';
  try {
    const snap = await db.collection('projects').doc(projectId)
      .collection('members').get();

    membersMap = {};
    snap.docs.forEach(d => {
      const m = d.data();
      const name = m.displayName || '';
      membersMap[d.id] = name;

      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = name || 'Usuario sin nombre';
      selectAsig.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    alert('Error cargando miembros');
  }
}
