const { Resend } = require('resend');
const db = require('../db');

// Use environment variables with fallbacks
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_WNJXabUZ_BRkJDvaxtf4wHcgZJE4nHf82';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

const resend = new Resend(RESEND_API_KEY);

/**
 * Sends an email notification using Resend API
 * @param {string} userId - Target User ID
 * @param {string} subject - Email Subject
 * @param {string} htmlBody - HTML formatted email body
 * @param {string} eventType - Notification event type for logging
 */
async function sendEmailNotification(userId, subject, htmlBody, eventType) {
  if (!RESEND_API_KEY) {
    console.warn(`⚠️ Resend API Key missing. Skipping email to ${userId}`);
    return;
  }

  try {
    const userSnap = await db().collection('users').doc(userId).get();
    if (!userSnap.exists) return;
    const user = userSnap.data();
    if (!user.email) return;

    const { data, error } = await resend.emails.send({
      from: `CARE QMS <${RESEND_FROM_EMAIL}>`,
      to: [user.email],
      subject: subject,
      html: htmlBody,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Log success
    await db().collection('notification_logs').add({
      user_id: userId,
      type: eventType,
      channel: 'email',
      status: 'SUCCESS',
      resend_id: data.id,
      timestamp: new Date().toISOString()
    });
    console.log(`✉️ Email sent via Resend to ${user.email} (${eventType})`);
  } catch (error) {
    const errMsg = error.message ? error.message : String(error);
    console.error(`❌ Email error to ${userId}:`, errMsg);
    await db().collection('notification_logs').add({
      user_id: userId,
      type: eventType,
      channel: 'email',
      status: 'FAILED',
      error: errMsg,
      timestamp: new Date().toISOString()
    });
  }
}

// Templates
const templates = {
  SLA_BREACH: (ticket) => ({
    subject: `[CARE] URGENT: Ticket #${ticket.ticket_id} - SLA Breach`,
    body: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #DC2626; border-top: 5px solid #DC2626; border-radius: 5px;">
        <h2 style="color: #DC2626;">⚠️ SLA Breach Alert</h2>
        <p><strong>Ticket ID:</strong> ${ticket.ticket_id}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <hr/>
        <p style="color: #4B5563;">This ticket has crossed its resolution due date and requires immediate attention.</p>
        <a href="https://care-app-b6649.web.app/" style="display: inline-block; padding: 10px 15px; background: #2563EB; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Ticket in CARE</a>
      </div>
    `
  }),
  ASSIGNED: (ticket) => ({
    subject: `[CARE] New High Priority Assignment: Ticket #${ticket.ticket_id}`,
    body: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #E5E7EB; border-top: 5px solid #2563EB; border-radius: 5px;">
        <h2 style="color: #2563EB;">New Ticket Assigned</h2>
        <p><strong>Ticket ID:</strong> ${ticket.ticket_id}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> <span style="color: #DC2626; font-weight: bold;">${ticket.priority}</span></p>
        <hr/>
        <p>A high-priority issue has been assigned to your queue.</p>
        <a href="https://care-app-b6649.web.app/" style="display: inline-block; padding: 10px 15px; background: #2563EB; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Ticket</a>
      </div>
    `
  }),
  ESCALATION: (ticket) => ({
    subject: `[CARE] ESCALATION LEVEL 2: Ticket #${ticket.ticket_id}`,
    body: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #7F1D1D; border-top: 5px solid #7F1D1D; border-radius: 5px;">
        <h2 style="color: #7F1D1D;">🚨 Escalation Level 2 (3+ Days Overdue)</h2>
        <p><strong>Ticket ID:</strong> ${ticket.ticket_id}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <hr/>
        <p>Management attention required immediately.</p>
      </div>
    `
  }),
  VALIDATION: (ticket) => ({
    subject: `[CARE] Validation Overdue: Ticket #${ticket.ticket_id}`,
    body: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #D97706; border-top: 5px solid #D97706; border-radius: 5px;">
        <h2 style="color: #D97706;">⏳ Pending Validation Alert</h2>
        <p>Ticket <strong>${ticket.ticket_id}</strong> was resolved over 24 hours ago but has not been validated.</p>
      </div>
    `
  })
};

module.exports = { sendEmailNotification, templates };
