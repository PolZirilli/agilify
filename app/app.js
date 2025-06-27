// app.js

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
const btnNueva    = document.getElementById('btnNuevaTarea');
const btnBack     = document.getElementById('btnBack');
const btnLogout   = document.getElementById('btnLogout');
const modal       = document.getElementById('modal-task');
const btnCerrar   = document.getElementById('cerrarModal');
const form        = document.getElementById('formTarea');
const btnEliminar = document.getElementById('btnEliminar');

const inpTitulo      = document.getElementById('titulo');
const inpDescripcion = document.getElementById('descripcion');
const inpLinks       = document.getElementById('links');
const selPrioridad   = document.getElementById('prioridad');
const inpFecha       = document.getElementById('fecha');
const selAsignado    = document.getElementById('asignadoA');
const selEstado      = document.getElementById('estado');

// ======= Navegación y logout =======
btnBack.addEventListener('click', () => window.location.href = 'projects.html');
btnLogout.addEventListener('click', () => auth.signOut());

// ======= Modal =======
btnNueva.addEventListener('click', abrirModalNueva);
btnCerrar.addEventListener('click', cerrarModal);
window.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

// ======= SortableJS =======
['todo','inprogress','paused','done'].forEach(id => {
  new Sortable(document.getElementById(id), {
    group: 'kanban',
    animation: 150,
    onEnd: evt => {
      const docId    = evt.item.dataset.id;
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
    title:       inpTitulo.value,
    description: inpDescripcion.value,
    links:       inpLinks.value.split(',').map(u=>u.trim()).filter(u=>u),
    priority:    selPrioridad.value,
    dueDate:     inpFecha.value
                  ? firebase.firestore.Timestamp.fromDate(new Date(inpFecha.value))
                  : null,
    status:      selEstado.value,
    assignedTo:  selAsignado.value || null,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('projects').doc(projectId)
    .collection('tasks').doc(id)
    .set(data, { merge: true });

  cerrarModal();
});

// ======= Eliminar tarea =======
btnEliminar.addEventListener('click', () => {
  const id = form.tareaId.value;
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
      document.getElementById('skeleton-board').classList.add('hidden');
      document.getElementById('content-board').classList.remove('invisible');
      renderTareas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

// ======= Renderizar tarjetas Kanban SIN links y mostrando asignado =======
function renderTareas(tareas) {
  ['todo','inprogress','paused','done'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  tareas.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-gray-200 rounded p-2 mb-2 shadow cursor-pointer';
    card.dataset.id = t.id;

    // Sinopsis de descripción (50 caracteres máximo)
    const fullDesc = t.description || '';
    const snippet = fullDesc.length > 50
      ? fullDesc.slice(0, 50) + '...'
      : fullDesc;

    // placeholder para nombre asignado
    let assignedName = '';
    if (t.assignedTo) {
      db.collection('projects').doc(projectId)
        .collection('members').doc(t.assignedTo)
        .get().then(mdoc => {
          assignedName = mdoc.data()?.displayName || '';
          card.querySelector('.assigned').textContent = assignedName;
        });
    }

    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div class="font-semibold truncate">${t.title}</div>
        <div class="text-xs font-bold uppercase ${
          t.priority==='alta'?'text-red-600':
          t.priority==='media'?'text-yellow-600':'text-green-600'}">
          ${t.priority}
        </div>
      </div>
      <div class="text-xs mb-1">${snippet}</div>
      <div class="text-xs text-gray-500 mb-1">
        <span class="font-semibold">Asignado a:</span>
        <span class="assigned"></span>
      </div>
      <div class="text-xs text-gray-500">
        ${t.dueDate
          ? new Date(t.dueDate.seconds*1000).toLocaleDateString()
          : ''
        }
      </div>
    `;
    card.addEventListener('click', () => abrirModalEditarTarea(t));
    document.getElementById(idColumnaAId(t.status)).appendChild(card);
  });
}

// ======= Funciones modales =======
function abrirModalNueva() {
  form.reset();
  form.tareaId.value = '';
  selAsignado.innerHTML = '<option value="">-- No asignado --</option>';
  cargarMiembrosProyecto();
  btnEliminar.classList.add('hidden');
  modal.classList.remove('hidden');
}

function abrirModalEditarTarea(tarea) {
  form.tareaId.value     = tarea.id;
  inpTitulo.value        = tarea.title;
  inpDescripcion.value   = tarea.description || '';
  selPrioridad.value     = tarea.priority;
  inpFecha.value         = tarea.dueDate
                             ? new Date(tarea.dueDate.seconds*1000)
                                 .toISOString().substr(0,10)
                             : '';
  selEstado.value        = tarea.status;

  cargarMiembrosProyecto().then(() => {
    selAsignado.value = tarea.assignedTo || '';
  });

  btnEliminar.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function cerrarModal() {
  modal.classList.add('hidden');
}

// ======= Cargar dropdown de miembros =======
async function cargarMiembrosProyecto() {
  selAsignado.innerHTML = '<option value="">-- No asignado --</option>';
  const membersSnap = await db.collection('projects')
    .doc(projectId)
    .collection('members')
    .get();

  for (let mdoc of membersSnap.docs) {
    const m = mdoc.data();
    const opt = document.createElement('option');
    opt.value = mdoc.id;
    opt.textContent = m.displayName;
    selAsignado.appendChild(opt);
  }
}

// ======= Utilidades =======
function idColumnaAId(status) {
  if (status==='a-realizar') return 'todo';
  if (status==='en-proceso')  return 'inprogress';
  if (status==='pausado')      return 'paused';
  return 'done';
}
function idColumnaAEstado(id) {
  if (id==='todo')       return 'a-realizar';
  if (id==='inprogress') return 'en-proceso';
  if (id==='paused')     return 'pausado';
  return 'realizado';
}
