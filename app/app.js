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
const db   = firebase.firestore();

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');
if (!projectId) {
  window.location.href = 'projects.html';
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  // Validar acceso SOLO por el array members
  const projectDoc = await db.collection('projects').doc(projectId).get();
  if (!projectDoc.exists) {
    alert("El proyecto no existe.");
    window.location.href = 'projects.html';
    return;
  }
  const data = projectDoc.data();
  if (!data.members || !data.members.includes(user.uid)) {
    alert("No tienes acceso a este proyecto.");
    window.location.href = 'projects.html';
    return;
  }
  inicializarBoard();
});

function inicializarBoard() {
  const btnNueva    = document.getElementById('btnNuevaTarea');
  const btnBack     = document.getElementById('btnBack');
  const btnLogout   = document.getElementById('btnLogout');
  const modal       = document.getElementById('modal-task');
  const btnCerrar   = document.getElementById('cerrarModal');
  const form        = document.getElementById('formTarea');
  const btnEliminar = document.getElementById('btnEliminar');

  btnBack.addEventListener('click', () => window.location.href = 'projects.html');
  btnLogout.addEventListener('click', () => auth.signOut());
  btnNueva.addEventListener('click', abrirModalNueva);
  btnCerrar.addEventListener('click', cerrarModal);
  window.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

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

  form.addEventListener('submit', e => {
    e.preventDefault();
    const id = form.tareaId.value ||
      db.collection('projects').doc(projectId).collection('tasks').doc().id;

    const data = {
      title:       form.titulo.value,
      description: form.descripcion.value,
      links:       form.links.value.split(',').map(u=>u.trim()).filter(u=>u),
      priority:    form.prioridad.value,
      dueDate:     form.fecha.value
                    ? firebase.firestore.Timestamp.fromDate(new Date(form.fecha.value))
                    : null,
      status:      form.estado.value,
      assignedTo:  form.asignadoA.value || null,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('projects').doc(projectId)
      .collection('tasks').doc(id)
      .set(data, { merge: true });

    cerrarModal();
  });

  btnEliminar.addEventListener('click', () => {
    const id = document.getElementById('tareaId').value;
    if (!id) return;
    if (confirm('¿Eliminar tarea permanentemente?')) {
      db.collection('projects').doc(projectId)
        .collection('tasks').doc(id).delete();
      cerrarModal();
    }
  });

  cargarMiembrosProyecto();
  cargarTareasRealtime();
}

function cargarTareasRealtime() {
  db.collection('projects').doc(projectId)
    .collection('tasks')
    .onSnapshot(snap => {
      renderTareas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

function renderTareas(tareas) {
  ['todo','inprogress','paused','done'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  tareas.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-gray-200 rounded p-2 mb-2 shadow cursor-pointer';
    card.dataset.id = t.id;
    const desc = t.description ? t.description.substring(0, 50) + (t.description.length > 50 ? "..." : "") : "";
    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div class="font-semibold truncate">${t.title}</div>
        <div class="text-xs font-bold uppercase ${
          t.priority==='alta'?'text-red-600':
          t.priority==='media'?'text-yellow-600':'text-green-600'}">
          ${t.priority}
        </div>
      </div>
      <div class="text-xs mb-1 truncate">${desc}</div>
      <div class="flex justify-between items-center text-xs text-gray-500">
        <span>${t.assignedToName||''}</span>
        <span>${
          t.dueDate
            ? new Date(t.dueDate.seconds*1000).toLocaleDateString()
            : ''
        }</span>
      </div>
    `;
    card.addEventListener('click', () => abrirModalEditarTarea(t));
    document.getElementById(idColumnaAId(t.status)).appendChild(card);
  });
}

function abrirModalNueva() {
  const form = document.getElementById('formTarea');
  form.reset();
  form.tareaId.value = '';
  document.getElementById('btnEliminar').classList.add('hidden');
  document.getElementById('modal-task').classList.remove('hidden');
}

function abrirModalEditarTarea(tarea) {
  const form = document.getElementById('formTarea');
  form.tareaId.value     = tarea.id;
  form.titulo.value      = tarea.title;
  form.descripcion.value = tarea.description || '';
  form.links.value       = (tarea.links||[]).join(', ');
  form.prioridad.value   = tarea.priority;
  form.fecha.value       = tarea.dueDate
                             ? new Date(tarea.dueDate.seconds*1000)
                                 .toISOString().substr(0,10)
                             : '';
  form.asignadoA.value   = tarea.assignedTo || '';
  form.estado.value      = tarea.status;
  document.getElementById('btnEliminar').classList.remove('hidden');
  document.getElementById('modal-task').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-task').classList.add('hidden');
}

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

async function cargarMiembrosProyecto() {
  const select = document.getElementById('asignadoA');
  select.innerHTML = '<option value="">-- No asignado --</option>';

  const membres = await db.collection('projects')
    .doc(projectId)
    .collection('members')
    .get();

  membres.docs.forEach(mdoc => {
    const m = mdoc.data();
    if (!m.displayName) return;
    const opt = document.createElement('option');
    opt.value = mdoc.id;
    opt.textContent = m.displayName;
    select.appendChild(opt);
  });
}
