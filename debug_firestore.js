const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDebug() {
  console.log("--- Checking Users ---");
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });

  console.log("\n--- Checking Notification Logs (Last 5) ---");
  const logsSnap = await db.collection('notification_logs').orderBy('timestamp', 'desc').limit(5).get();
  logsSnap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

checkDebug().then(() => process.exit());
