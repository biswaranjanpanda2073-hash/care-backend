require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const db = require('./src/db');
const NotificationService = require('./src/services/notification.service');
const { startScheduler } = require('./src/jobs/scheduler');

// --- Firebase Init ---
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin initialized.");
} catch (e) {
  console.warn("⚠️ WARNING: Firebase Credentials not found! FCM will not work.");
}

// --- Mock Data Seeding (For testing) ---
const seedUsers = async () => {
  const users = [
    { id: 'U1', email: 'support@care.com', role: 'support' },
    { id: 'U2', email: 'quality@care.com', role: 'quality' },
    { id: 'U3', email: 'owner@care.com', role: 'owner' },
    { id: 'U4', email: 'validator@care.com', role: 'validator' },
    { id: 'U5', email: 'management@care.com', role: 'management' },
    { id: 'U6', email: 'admin@care.com', role: 'admin' },
    { id: 'U7', email: 'care.tohandsnotifications@gmail.com', role: 'admin' }
  ];
  try {
    for (const u of users) {
      await db().collection('users').doc(u.id).set({ user_id: u.id, email: u.email, role: u.role }, { merge: true });
    }
  } catch (e) {
    console.log("Seed error:", e.message);
  }
};
seedUsers();

// --- Express App ---
const app = express();
app.use(cors());
app.use(express.json());

// API: Save FCM Token
app.post('/api/save-fcm-token', async (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) return res.status(400).json({ error: "Missing data" });
  
  try {
    await db().collection('fcm_tokens').doc(userId + '_' + token.substring(0, 10)).set({
      user_id: userId,
      token: token,
      created_at: new Date().toISOString()
    });
    res.status(200).json({ message: "Token saved successfully" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Create User
app.post('/api/create-user', async (req, res) => {
  const { userId, email, role } = req.body;
  if (!userId || !email || !role) return res.status(400).json({ error: "Missing required fields" });

  try {
    await db().collection('users').doc(userId).set({
      user_id: userId,
      email: email,
      role: role
    });
    res.status(201).json({ message: "User synced to backend DB successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: Trigger Event (Webhook style)
app.post('/api/notify-event', async (req, res) => {
  const { eventType, payload } = req.body;
  if (!eventType || !payload || !payload.ticket_id) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  // Save/Update ticket state in DB for scheduler to track later
  try {
    await db().collection('tickets').doc(payload.ticket_id).set({
      ticket_id: payload.ticket_id,
      title: payload.title,
      priority: payload.priority || 'LOW',
      status: payload.status || 'Open',
      owner_id: payload.owner_id || null,
      quality_lead_id: payload.quality_lead_id || null,
      validator_id: payload.validator_id || null,
      due_date: payload.due_date || new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error("Failed to sync ticket to DB:", e.message);
  }

  // Trigger Notification Logic asynchronously
  NotificationService.notify(eventType, payload).catch(console.error);
  
  res.status(202).json({ message: "Event accepted for processing" });
});

// API: List active tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const snap = await db().collection('tickets').get();
    res.json(snap.docs.map(d => d.data()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: List notification logs (Debug)
app.get('/api/logs', async (req, res) => {
  try {
    const snap = await db().collection('notification_logs').orderBy('timestamp', 'desc').limit(50).get();
    res.json(snap.docs.map(d => d.data()));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Background Jobs
startScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CARE Backend running on http://localhost:${PORT}`);
});
