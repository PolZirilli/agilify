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

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    cargarMiembrosProyecto();
    cargarTareasRealtime();
    cargarNombreProyecto();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const btnNueva = document.getElementById('btnNuevaTarea');
  const btnBack = document.getElementById('btnBack');
  const btnLogout = document.getElementById('btnLogout');
  const btnPerfil = document.getElementById('btnPerfil');
  const modal = document.getElementById('modal-task');
  const btnCerrar = document.getElementById('cerrarModal');
  const form = document.getElementById('formTarea');
  const btnEliminar = document.getElementById('btnEliminar');

  btnBack.onclick = () => window.location.href = 'projects.html';
  btnLogout.onclick = () => auth.signOut();
  btnPerfil.onclick = mostrarPerfilUsuario;

  document.getElementById('cerrarModalPerfil').onclick = () => {
    document.getElementById('modal-perfil').classList.add('hidden');
  };

  btnNueva.onclick = abrirModalNueva;
  btnCerrar && (btnCerrar.onclick = cerrarModal);
  window.onclick = e => { if (e.target === modal) cerrarModal(); };
  window.onkeydown = e => { if (e.key === 'Escape') cerrarModal(); };

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

// … Aquí mantené el resto de tus funciones (`mostrarSkeleton`, `renderTareas`, `cargarTareasRealtime`, etc.)

function mostrarPerfilUsuario() {
  auth.onAuthStateChanged(user => {
    if (!user) return;

    const contenido = document.getElementById('perfilContenido');
    contenido.innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>UID:</strong> ${user.uid}</p>
      <div><strong>Proyectos asignados:</strong></div>
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
