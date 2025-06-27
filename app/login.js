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

// ======= Referencias al DOM =======
const skeleton = document.getElementById('skeleton-login');
const content  = document.getElementById('content-login');
const formLogin = document.getElementById('formLogin');
const btnOpenRegister   = document.getElementById('btnOpenRegister');
const modalRegister     = document.getElementById('modal-register');
const btnCerrarRegister = document.getElementById('cerrarModalRegister');
const formRegister      = document.getElementById('formRegister');

// ======= Control de autenticación =======
auth.onAuthStateChanged(user => {
  // Primero ocultar el skeleton y mostrar el contenido
  skeleton.classList.add('hidden');
  content.classList.remove('invisible');

  if (user) {
    window.location.href = 'projects.html';
  }
});

// ======= Manejo del login =======
formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = 'projects.html';
  } catch (error) {
    console.error("❌ Error en login:", error);
    alert("Error en login: " + error.message);
  }
});

// ======= Mostrar/Ocultar modal de registro =======
btnOpenRegister.addEventListener('click', () => {
  modalRegister.classList.remove('hidden');
});
btnCerrarRegister.addEventListener('click', () => {
  modalRegister.classList.add('hidden');
});

// ======= Registro de usuario =======
formRegister.addEventListener('submit', async e => {
  e.preventDefault();
  const nombre   = document.getElementById('registerNombre').value.trim();
  const apellido = document.getElementById('registerApellido').value.trim();
  const email    = document.getElementById('registerEmail').value.trim().toLowerCase();
  const password = document.getElementById('registerPassword').value.trim();

  if (!nombre || !apellido || !email || !password) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const displayName = `${nombre} ${apellido}`;

    // Actualizar displayName en Auth
    await user.updateProfile({ displayName });

    // Guardar en /users
    await db.collection('users').doc(user.uid).set({
      email,
      displayName,
      role: 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    modalRegister.classList.add('hidden');
    window.location.href = 'projects.html';
  } catch (err) {
    console.error("❌ Error registrando usuario:", err);
    alert("Error: " + err.message);
  }
});
