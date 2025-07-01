// app.js

// ===== Firebase config e inicialización =====
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
const db   = firebase.firestore();

// ===== Leer projectId de la URL =====
const urlParams          = new URLSearchParams(window.location.search);
const projectId          = urlParams.get('projectId');
if (!projectId) window.location.href = 'projects.html';

// ===== DOM refs =====
const btnNueva      = document.getElementById('btnNuevaTarea');
const btnBack       = document.getElementById('btnBack');
const btnLogout     = document.getElementById('btnLogout');
const projectNameDisplay = document.getElementById('projectNameDisplay');
const modal         = document.getElementById('modal-task');
const btnCerrar     = document.getElementById('cerrarModal');
const form          = document.getElementById('formTarea');
const btnEliminar   = document.getElementById('btnEliminar');
const selectAsig    = document.getElementById('asignadoA');
const commentForm   = document.getElementById('commentForm');
const commentText   = document.getElementById('commentText');
const commentsList  = document.getElementById('commentsList');

let commentsUnsub = null;
let membersMap    = {};

// ===== Toast helper =====
function toast(msg, bg = "#3B82F6") {
  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: "right",
    style: { background: bg }
  }).showToast();
}

// ===== Autenticación =====
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  // Cargar nombre del proyecto
  try {
    const doc = await db.collection('projects').doc(projectId).get();
    if (doc.exists) projectNameDisplay.textContent = doc.data().name;
  } catch (err) {
    console.error('Error cargando nombre de proyecto', err);
  }
  // Cargar miembros y tareas
  await cargarMiembrosProyecto();
  cargarTareasRealtime();
});

// ===== Navegación y logout =====
btnBack.addEventListener('click', () => {
  window.location.href = 'projects.html';
});
btnLogout.addEventListener('click', () => auth.signOut());

// ===== Modal tarea =====
btnNueva.addEventListener('click', abrirModalNueva);
btnCerrar.addEventListener('click', cerrarModal);
window.addEventListener('click', e => {
  if (e.target === modal) cerrarModal();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});

// ===== Drag & Drop =====
['todo','inprogress','paused','done'].forEach(id => {
  new Sortable(document.getElementById(id), {
    group: 'kanban',
    animation: 150,
    onEnd: evt => {
      const docId    = evt.item.dataset.id;
      const newStatus = idColumnaAEstado(evt.to.id);
      db.collection('projects').doc(projectId)
        .collection('tasks').doc(docId).update({ status: newStatus });
    }
  });
});

// ===== Guardar / actualizar tarea =====
form.addEventListener('submit', async e => {
  e.preventDefault();
  const id = form.tareaId.value ||
    db.collection('projects').doc(projectId).collection('tasks').doc().id;

  const data = {
    title:       form.titulo.value,
    description: form.descripcion.value,
    links:       form.links.value.split(',').map(u => u.trim()).filter(u => u),
    priority:    form.prioridad.value,
    dueDate:     form.fecha.value
                   ? firebase.firestore.Timestamp.fromDate(new Date(form.fecha.value))
                   : null,
    status:      form.estado.value,
    assignedTo:  form.asignadoA.value || null,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('projects').doc(projectId)
      .collection('tasks').doc(id).set(data, { merge: true });
    toast('Tarea guardada', '#22C55E');
    cerrarModal();
  } catch (err) {
    console.error(err);
    toast('Error guardando tarea', '#EF4444');
  }
});

// ===== Eliminar tarea =====
btnEliminar.addEventListener('click', async () => {
  const id = form.tareaId.value;
  if (!id) return;
  try {
    await db.collection('projects').doc(projectId)
      .collection('tasks').doc(id).delete();
    toast('Tarea eliminada', '#EF4444');
    cerrarModal();
  } catch (err) {
    console.error(err);
    toast('Error eliminando tarea', '#EF4444');
  }
});

// ===== Cargar miembros para dropdown =====
async function cargarMiembrosProyecto() {
  selectAsig.innerHTML = '<option value="">-- No asignado --</option>';
  const snap = await db.collection('projects').doc(projectId)
    .collection('members').get();

  membersMap = {};
  snap.docs.forEach(d => {
    const m    = d.data();
    const name = m.displayName || '';
    membersMap[d.id] = name;
    if (name) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = name;
      selectAsig.appendChild(opt);
    }
  });
}

// ===== Cargar tareas en tiempo real =====
function cargarTareasRealtime() {
  db.collection('projects').doc(projectId)
    .collection('tasks').onSnapshot(snap => {
      const tareas = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          assignedToName: membersMap[data.assignedTo] || ''
        };
      });
      renderTareas(tareas);
    }, err => {
      console.error(err);
      toast('Error cargando tareas', '#EF4444');
    });
}

// ===== Render de tareas (sin fondo gris, muestra asignado) =====
function renderTareas(tareas) {
  ['todo','inprogress','paused','done'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  tareas.forEach(t => {
    const card = document.createElement('div');
    card.className = 'rounded p-2 mb-2 shadow cursor-pointer';
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
        ${t.dueDate
          ? new Date(t.dueDate.seconds*1000).toLocaleDateString()
          : ''}
      </div>
    `;
    card.addEventListener('click', () => abrirModalEditarTarea(t));
    document.getElementById(idColumnaAId(t.status)).appendChild(card);
  });
}

// ===== Modal abrir/cerrar =====
function abrirModalNueva() {
  form.reset();
  form.tareaId.value = '';
  btnEliminar.classList.add('hidden');
  commentsList.innerHTML = '';
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
  modal.classList.remove('hidden');
}

function abrirModalEditarTarea(tarea) {
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
  btnEliminar.classList.remove('hidden');
  modal.classList.remove('hidden');
  cargarComentarios(tarea.id);
}

function cerrarModal() {
  modal.classList.add('hidden');
  if (commentsUnsub) {
    commentsUnsub();
    commentsUnsub = null;
  }
}

// ===== Mapear estado ↔ columna =====
function idColumnaAId(status) {
  switch(status) {
    case 'a-realizar': return 'todo';
    case 'en-proceso': return 'inprogress';
    case 'pausado':     return 'paused';
    default:            return 'done';
  }
}
function idColumnaAEstado(id) {
  switch(id) {
    case 'todo':       return 'a-realizar';
    case 'inprogress': return 'en-proceso';
    case 'paused':     return 'pausado';
    default:           return 'realizado';
  }
}

// ===== Comentarios =====
async function cargarComentarios(taskId) {
  commentsList.innerHTML = '<p class="text-gray-500 text-sm">Cargando...</p>';
  if (commentsUnsub) commentsUnsub();

  commentsUnsub = db
    .collection('projects').doc(projectId)
    .collection('tasks').doc(taskId)
    .collection('comments')
    .orderBy('createdAt','asc')
    .onSnapshot(snap => {
      commentsList.innerHTML = '';
      if (snap.empty) {
        commentsList.innerHTML = '<p class="text-gray-500 text-sm">Sin comentarios.</p>';
      } else {
        snap.docs.forEach(doc => {
          const c = doc.data();
          const div = document.createElement('div');
          div.className = 'border-b pb-1';
          div.innerHTML = `
            <p class="text-sm text-gray-800">
              <b>${c.authorName}</b>
              <span class="text-xs text-gray-500">
                ${new Date(c.createdAt.seconds*1000).toLocaleString()}
              </span>
            </p>
            <p class="text-sm">${c.text}</p>
          `;
          commentsList.appendChild(div);
        });
      }
    }, err => {
      console.error(err);
      commentsList.innerHTML = '<p class="text-red-500 text-sm">Error cargando comentarios.</p>';
    });
}

commentForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = commentText.value.trim();
  if (!text) return;
  const user = auth.currentUser;
  try {
    await db
      .collection('projects').doc(projectId)
      .collection('tasks').doc(form.tareaId.value)
      .collection('comments').add({
        authorId:   user.uid,
        authorName: user.displayName || 'Anónimo',
        text,
        createdAt:  firebase.firestore.FieldValue.serverTimestamp()
      });
    commentText.value = '';
    toast('Comentario agregado', '#22C55E');
  } catch (err) {
    console.error(err);
    toast('Error al agregar comentario', '#EF4444');
  }
});
