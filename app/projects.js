auth.onAuthStateChanged(user => {
  if (!user) return window.location.href = 'login.html';
  console.log("UID activo:", user.uid); // <--- esto loguea tu UID actual
  cargarProyectos(user.uid);
});

function cargarProyectos(uid) {
  console.log("Llamando cargarProyectos con UID:", uid);
  db.collection('projects')
    .where('members', 'array-contains', uid)
    .onSnapshot(snap => {
      console.log("Proyectos recibidos:", snap.size);
      snap.docs.forEach(doc => console.log("Proyecto:", doc.id, doc.data()));
      lista.innerHTML = '';
      snap.docs.forEach(doc => renderProyecto(doc.id, doc.data()));
    }, err => {
      console.error("Error en snapshot listener:", err);
    });
}
