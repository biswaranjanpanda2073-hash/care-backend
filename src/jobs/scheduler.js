const cron = require('node-cron');
const db = require('../db');
const NotificationService = require('../services/notification.service');

function startScheduler() {
  console.log("⏱️ Scheduler started. Checking SLA rules every hour.");

  // Runs every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log("🔄 Running background SLA checks...");
    const now = new Date();

    // Fetch all open tickets
    const ticketsSnap = await db().collection('tickets').where('status', '!=', 'Closed').get();

    for (const doc of ticketsSnap.docs) {
      const ticket = doc.data();
      const dueDate = new Date(ticket.due_date);
      const timeDiff = now.getTime() - dueDate.getTime();
      const daysOverdue = timeDiff / (1000 * 3600 * 24);

      if (ticket.status === 'Resolved') {
        if (daysOverdue > 1) {
          await NotificationService.notify('VALIDATION_PENDING', ticket);
        }
        continue;
      }

      if (daysOverdue > 3) {
        await NotificationService.notify('ESCALATION_LEVEL_2', ticket);
        await doc.ref.update({ escalation_count: (ticket.escalation_count || 0) + 1 });
      } else if (daysOverdue > 0) {
        await NotificationService.notify('SLA_BREACH', ticket);
      }
    }
  });
}

module.exports = { startScheduler };
