const admin = require('firebase-admin');

// Wrapper for Firestore access
const db = () => {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized yet.');
  }
  return admin.firestore();
};

module.exports = db;
