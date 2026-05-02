const { sendPushNotification } = require('./push.service');
const { sendEmailNotification, templates } = require('./email.service');
const db = require('../db');

class NotificationService {
  /**
   * Central entry point for all notifications
   * @param {string} eventType 
   * @param {object} payload - The ticket data
   */
  static async notify(eventType, payload) {
    console.log(`[NotificationService] Processing Event: ${eventType} for Ticket: ${payload.ticket_id}`);
    
    // Safety Control: Prevent duplicate notifications in a short timeframe (e.g., within 1 hour)
    if (eventType.startsWith('SLA') || eventType.startsWith('ESC') || eventType.startsWith('VAL')) {
       const targetId = payload.owner_id || payload.validator_id;
       const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
       
       const recentLogs = await db().collection('notification_logs')
         .where('type', '==', eventType)
         .where('user_id', '==', targetId)
         .where('timestamp', '>', oneHourAgo)
         .limit(1).get();
       
       if (!recentLogs.empty) {
         console.log(`[Safety] Skipping duplicate ${eventType} notification.`);
         return;
       }
    }

    switch (eventType) {
      case 'TICKET_ASSIGNED':
        await this.handleAssignment(payload);
        break;
      case 'STATUS_UPDATED':
        await this.handleStatusUpdate(payload);
        break;
      case 'SLA_BREACH':
        await this.handleSlaBreach(payload);
        break;
      case 'ESCALATION_LEVEL_2':
        await this.handleEscalation(payload);
        break;
      case 'VALIDATION_PENDING':
        await this.handleValidationPending(payload);
        break;
      default:
        console.warn('Unknown event type:', eventType);
    }
  }

  static async handleAssignment(ticket) {
    if (ticket.owner_id) {
      // 1. FCM to Owner
      await sendPushNotification(ticket.owner_id, "Ticket Assigned", `Ticket ${ticket.ticket_id} assigned to you.`, 'TICKET_ASSIGNED');
      
      // 2. Email ONLY if priority = HIGH, CRITICAL, P1, or P2
      if (['HIGH', 'CRITICAL', 'P1', 'P2'].includes((ticket.priority || '').toUpperCase())) {
        const tmpl = templates.ASSIGNED(ticket);
        await sendEmailNotification(ticket.owner_id, tmpl.subject, tmpl.body, 'TICKET_ASSIGNED');
      } else {
        console.log(`[Email] Skipped assigning email for ${ticket.ticket_id} because priority is ${ticket.priority}`);
      }
    }
  }

  static async handleStatusUpdate(ticket) {
    // Notify Support and Quality Lead via FCM only
    const notifyUsers = ['support', 'quality'];
    const usersSnap = await db().collection('users').where('role', 'in', notifyUsers).get();
    
    for (const doc of usersSnap.docs) {
      await sendPushNotification(doc.id, "Status Updated", `Ticket ${ticket.ticket_id} status changed to ${ticket.status}.`, 'STATUS_UPDATED');
    }
  }

  static async handleSlaBreach(ticket) {
    const notifyIds = [ticket.owner_id];
    // Find a manager
    const managersSnap = await db().collection('users').where('role', '==', 'management').limit(1).get();
    if (!managersSnap.empty) {
      notifyIds.push(managersSnap.docs[0].id);
    }

    for (const id of notifyIds) {
      if (!id) continue;
      await sendPushNotification(id, "SLA Breach", `Ticket ${ticket.ticket_id} is overdue.`, 'SLA_BREACH');
      const tmpl = templates.SLA_BREACH(ticket);
      await sendEmailNotification(id, tmpl.subject, tmpl.body, 'SLA_BREACH');
    }
  }

  static async handleEscalation(ticket) {
    const managersSnap = await db().collection('users').where('role', 'in', ['management', 'admin']).get();
    
    for (const doc of managersSnap.docs) {
      await sendPushNotification(doc.id, "Escalation Level 2", `Ticket ${ticket.ticket_id} is 3+ days overdue.`, 'ESCALATION_LEVEL_2');
      const tmpl = templates.ESCALATION(ticket);
      await sendEmailNotification(doc.id, tmpl.subject, tmpl.body, 'ESCALATION_LEVEL_2');
    }
  }

  static async handleValidationPending(ticket) {
    if (ticket.validator_id) {
      await sendPushNotification(ticket.validator_id, "Pending Validation", `Ticket ${ticket.ticket_id} requires your validation.`, 'VALIDATION_PENDING');
      const tmpl = templates.VALIDATION(ticket);
      await sendEmailNotification(ticket.validator_id, tmpl.subject, tmpl.body, 'VALIDATION_PENDING');
    }
  }
}

module.exports = NotificationService;
