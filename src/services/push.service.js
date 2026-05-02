const admin = require('firebase-admin');
const db = require('../db');

/**
 * Sends a push notification via FCM
 * @param {string} userId - Target User ID
 * @param {string} title - Push Title
 * @param {string} body - Push Body
 * @param {string} eventType - Event type for logging
 */
async function sendPushNotification(userId, title, body, eventType) {
  if (!admin.apps.length) {
    console.warn(`⚠️ Firebase Admin not initialized. Skipping push to ${userId}`);
    return;
  }

  try {
    const tokensSnap = await db().collection('fcm_tokens').where('user_id', '==', userId).get();
    if (tokensSnap.empty) return;

    const tokenDocs = tokensSnap.docs;
    const tokenArray = tokenDocs.map(doc => doc.data().token);

    const message = {
      notification: { title, body },
      tokens: tokenArray
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Cleanup invalid tokens
    if (response.failureCount > 0) {
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errorCode = res.error.code;
          if (errorCode === 'messaging/invalid-registration-token' || errorCode === 'messaging/registration-token-not-registered') {
             tokenDocs[idx].ref.delete();
          }
        }
      });
    }

    // Log success
    await db().collection('notification_logs').add({
      user_id: userId,
      type: eventType,
      channel: 'push',
      status: 'SUCCESS',
      timestamp: new Date().toISOString()
    });
    console.log(`🔔 FCM Push sent to user ${userId} (${eventType})`);
  } catch (error) {
    console.error(`❌ Push error to ${userId}:`, error.message);
    await db().collection('notification_logs').add({
      user_id: userId,
      type: eventType,
      channel: 'push',
      status: 'FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { sendPushNotification };
