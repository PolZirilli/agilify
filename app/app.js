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

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');

if (!projectId) {
  window.location.href = 'projects.html';
}

// ======= Variables globales =======
const modal = document.getElementById('modal-task');
const form = document.getElementById('formTarea');
const btnEliminar = document.getElementById('btnEliminar');

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    cargarTareasRealtime();
    cargarNombreProyecto();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const btnNueva = document.getElementById('btnNuevaTarea');
  const btnBack = document.getElementById('btnBack');
  const btnLogout = document.getElementById('btnLogout');
  const btnPerfil = document.getElementById('btnPerfil');
  const btnCerrarModalPerfil = document.getElementById('cerrarModalPerfil');

  btnBack.onclick = () => window.location.href = 'projects.html';
  btnLogout.onclick = () => auth.signOut();
  btnPerfil.onclick = mostrarPerfilUsuario;
  btnCerrarModalPerfil.onclick = () => document.getElementById('modal-perfil').classList.add('hidden');

  btnNueva.onclick = abrirModalNueva;

  form.onsubmit = e => {
    e.preventDefault();
    guardarTarea();
  };

  btnEliminar.onclick = eliminarTarea;

  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    new Sortable(document.querySelector(`#${id} .tareas`), {
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
});

function cargarNombreProyecto() {
  db.collection('projects').doc(projectId).get()
    .then(doc => {
      if (doc.exists) {
        document.getElementById('projectName').textContent = doc.data().name;
      }
    });
}

function cargarTareasRealtime() {
  mostrarSkeleton();
  db.collection('projects').doc(projectId).collection('tasks')
    .onSnapshot(snapshot => {
      const tareas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTareas(tareas);
    });
}

function mostrarSkeleton() {
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    const container = document.querySelector(`#${id} .tareas`);
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skel = document.createElement('div');
      skel.className = 'bg-gray-200 rounded p-2 mb-2 animate-pulse h-12';
      container.appendChild(skel);
    }
  });
}

function renderTareas(tareas) {
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    document.querySelector(`#${id} .tareas`).innerHTML = '';
  });

  tareas.forEach(t => {
    const card = document.createElement('div');
    card.className = 'bg-gray-200 rounded p-2 mb-2 shadow cursor-pointer';
    card.dataset.id = t.id;

    card.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <div class="font-semibold truncate">${t.title}</div>
        <div class="text-xs font-bold uppercase ${
          t.priority === 'alta' ? 'text-red-600' :
          t.priority === 'media' ? 'text-yellow-600' : 'text-green-600'
        }">${t.priority}</div>
      </div>
    `;

    card.onclick = () => abrirModalEditarTarea(t);
    document.querySelector(`#${idColumnaAId(t.status)} .tareas`).appendChild(card);
  });
}

function abrirModalNueva() {
  form.reset();
  form.tareaId.value = '';
  btnEliminar.classList.add('hidden');
  modal.classList.remove('hidden');
  cargarMiembrosProyecto();
}

function abrirModalEditarTarea(tarea) {
  form.reset();
  form.tareaId.value = tarea.id;
  form.titulo.value = tarea.title;
  form.descripcion.value = tarea.description || '';
  form.links.value = (tarea.links || []).join(', ');
  form.prioridad.value = tarea.priority;
  form.fecha.value = tarea.dueDate
    ? new Date(tarea.dueDate.seconds * 1000).toISOString().split('T')[0]
    : '';
  form.estado.value = tarea.status;

  btnEliminar.classList.remove('hidden');
  modal.classList.remove('hidden');

  cargarMiembrosProyecto();

  setTimeout(() => {
    form.asignadoA.value = tarea.assignedTo || '';
  }, 300);
}

function cerrarModal() {
  modal.classList.add('hidden');
}

function guardarTarea() {
  const id = form.tareaId.value || db.collection('projects').doc(projectId).collection('tasks').doc().id;

  const data = {
    title: form.titulo.value,
    description: form.descripcion.value,
    links: form.links.value.split(',').map(l => l.trim()).filter(l => l),
    priority: form.prioridad.value,
    dueDate: form.fecha.value
      ? firebase.firestore.Timestamp.fromDate(new Date(form.fecha.value))
      : null,
    status: form.estado.value,
    assignedTo: form.asignadoA.value || null,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!form.tareaId.value) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  db.collection('projects').doc(projectId).collection('tasks').doc(id).set(data, { merge: true });
  cerrarModal();
}

function eliminarTarea() {
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
}

function idColumnaAId(status) {
  return {
    'a-realizar': 'todo',
    'en-proceso': 'inprogress',
    'pausado': 'paused',
    'realizado': 'done'
  }[status] || 'todo';
}

function idColumnaAEstado(id) {
  return {
    'todo': 'a-realizar',
    'inprogress': 'en-proceso',
    'paused': 'pausado',
    'done': 'realizado'
  }[id] || 'a-realizar';
}

function cargarMiembrosProyecto() {
  const select = document.getElementById('asignadoA');
  if (!select) return;

  select.innerHTML = '<option value="">-- No asignado --</option>';

  db.collection('projects').doc(projectId).collection('members')
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const miembro = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = miembro.displayName || miembro.email || doc.id;
        select.appendChild(option);
      });
    });
}

function mostrarPerfilUsuario() {
  auth.onAuthStateChanged(user => {
    if (!user) return;

    const contenido = document.getElementById('perfilContenido');
    contenido.innerHTML = `
      <p><strong>Nombre:</strong> ${user.displayName || '(sin nombre)'}</p>
      <p><strong>Email:</strong> ${user.email}</p>
      <div><strong>Proyectos:</strong></div>
      <ul id="listaProyectos" class="list-disc list-inside text-sm mt-1"><li class="text-gray-500">Cargando…</li></ul>
    `;

    document.getElementById('modal-perfil').classList.remove('hidden');

    db.collection('projects')
      .where(`members.${user.uid}`, '==', true)
      .get()
      .then(snap => {
        const lista = document.getElementById('listaProyectos');
        lista.innerHTML = '';
        snap.forEach(doc => {
          const li = document.createElement('li');
          li.textContent = doc.data().name;
          lista.appendChild(li);
        });
        if (!lista.hasChildNodes()) {
          lista.innerHTML = '<li class="text-gray-500">Ninguno</li>';
        }
      });
  });
}
