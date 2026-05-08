const db = require('./src/db');
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

async function checkUser() {
    try {
        const snap = await admin.firestore().collection('users').doc('U1777720761174').get();
        if (snap.exists) {
            console.log("User exists:", snap.data());
        } else {
            console.log("User does not exist in backend DB!");
        }
    } catch(e) {
        console.log("Error:", e);
    }
}
checkUser();
