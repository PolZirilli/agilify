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

// ======= Ejecutar cuando el DOM esté listo =======
document.addEventListener('DOMContentLoaded', () => {
  // ======= Control de autenticación =======
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
    } else {
      cargarMiembrosProyecto();
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

  // Aquí podés inicializar Sortable en cada columna
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      new Sortable(container, {
        group: 'shared',
        animation: 150
      });
    } else {
      console.warn(`No se encontró el contenedor para Sortable: ${id}`);
    }
  });
});

// ======= Skeleton =======
function mostrarSkeleton() {
  ['todo', 'inprogress', 'paused', 'done'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) {
      console.warn(`No se encontró el contenedor: ${id}`);
      return;
    }
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
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '';
    }
  });
}

// ======= Cargar tareas =======
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

// … aquí seguí con el resto de tus funciones (`cargarMiembrosProyecto`, `cargarNombreProyecto`, `renderTareas`, etc.)

