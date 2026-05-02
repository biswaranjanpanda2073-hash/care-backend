const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkUser() {
  const usersSnap = await db.collection('users').where('email', '==', 'biswaranjan@tohands.in').get();
  if (usersSnap.empty) {
    console.log("User NOT found in Firestore!");
  } else {
    usersSnap.forEach(doc => {
      console.log("User found:", doc.id, "=>", doc.data());
    });
  }
}

checkUser().then(() => process.exit());
