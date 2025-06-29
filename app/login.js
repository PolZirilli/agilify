// Firebase config
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

// Redirección si ya está autenticado
auth.onAuthStateChanged(user => {
  if (user) window.location.href = 'projects.html';
});

// Toast helper
function toast(msg, type="info") {
  Toastify({
    text: msg,
    duration: 3500,
    gravity: "top",
    position: "right",
    style: {
      background: type === "error" ? "#e3342f"
                : type === "success" ? "#38a169"
                : "#4299e1"
    }
  }).showToast();
}

// Login
const formLogin = document.getElementById('formLogin');
formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  try {
    await auth.signInWithEmailAndPassword(email, password);
    toast("Login exitoso", "success");
    window.location.href = 'projects.html';
  } catch (error) {
    toast("Error en login: " + error.message, "error");
  }
});

// Registro
const btnOpenRegister = document.getElementById('btnOpenRegister');
const modalRegister = document.getElementById('modal-register');
const btnCerrarRegister = document.getElementById('cerrarModalRegister');
const formRegister = document.getElementById('formRegister');

btnOpenRegister.addEventListener('click', () => {
  modalRegister.classList.remove('hidden');
});
btnCerrarRegister.addEventListener('click', () => {
  modalRegister.classList.add('hidden');
});

formRegister.addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = document.getElementById('registerNombre').value.trim();
  const apellido = document.getElementById('registerApellido').value.trim();
  const email = document.getElementById('registerEmail').value.trim().toLowerCase();
  const password = document.getElementById('registerPassword').value.trim();

  if (!nombre || !apellido || !email || !password) {
    toast("Todos los campos son obligatorios.", "error");
    return;
  }
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    const displayName = `${nombre} ${apellido}`;
    await user.updateProfile({ displayName });

    // Guardar en /users
    await db.collection('users').doc(user.uid).set({
      nombre,
      apellido,
      displayName,
      email: user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    toast("Usuario registrado correctamente", "success");
    modalRegister.classList.add('hidden');
    window.location.href = 'projects.html';
  } catch (error) {
  toast("Los datos de acceso son incorrectos. Intenta nuevamente.", "error");
}

});
