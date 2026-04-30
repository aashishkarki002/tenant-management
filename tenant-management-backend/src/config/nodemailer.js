import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { formatMoney } from "../utils/moneyUtil.js";
dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
  greetingTimeout: 10000,
  pool: true,
  maxConnections: 1,
  maxMessages: 3,
});

transporter.verify((error, success) => {
  if (error) {
    console.log("Email verification error:", error);
  } else {
    console.log("Email server is ready to send emails");
  }
});

const emailTemplates = {
  welcome: ({ tenantName, unitNumber, propertyName }) => ({
    subject: `Welcome to ${propertyName || "Sallyan House"} — Your tenancy begins here`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Sallyan House</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f7;font-family:'Georgia',serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f7;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#1A5276;padding:36px 48px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Wordmark -->
                    <p style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#ffffff;">
                      Sallyan House
                    </p>
                    <p style="margin:4px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.55);">
                      Property Management
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <!-- Decorative accent -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:6px;height:36px;background-color:rgba(255,255,255,0.15);border-radius:3px;"></td>
                        <td style="width:4px;"></td>
                        <td style="width:6px;height:24px;background-color:rgba(255,255,255,0.25);border-radius:3px;"></td>
                        <td style="width:4px;"></td>
                        <td style="width:6px;height:16px;background-color:rgba(255,255,255,0.4);border-radius:3px;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thin accent line -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#1A5276 0%,#2e86c1 60%,#aed6f1 100%);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 36px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#1A5276;font-weight:600;">
                Welcome
              </p>
              <h1 style="margin:0 0 28px;font-family:'Georgia',serif;font-size:28px;font-weight:700;color:#0d2137;line-height:1.25;">
                ${tenantName ? `Good to have you,<br/>${tenantName}.` : "Good to have you."}
              </h1>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="height:1px;background-color:#e8eef3;"></td>
                </tr>
              </table>

              <!-- Body copy -->
              <p style="margin:0 0 20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d5166;">
                Your tenancy has been registered on <strong style="color:#1A5276;">Sallyan House</strong>${unitNumber ? ` for unit <strong style="color:#1A5276;">${unitNumber}</strong>` : ""}. This inbox will be your primary channel for all official communications  rent notices, payment receipts, maintenance updates, and property announcements.
              </p>
              <p style="margin:0 0 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3d5166;">
                Please keep this email address active and check it regularly. All notices delivered here are considered officially received.
              </p>

              <!-- Info card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f9fc;border-left:3px solid #1A5276;border-radius:0 4px 4px 0;margin-bottom:36px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#1A5276;font-weight:600;">
                      What to expect
                    </p>
                    <ul style="margin:0;padding:0 0 0 18px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.9;color:#3d5166;">
                      <li>Monthly rent invoices and due date reminders</li>
                      <li>Payment confirmations and receipts</li>
                      <li>Maintenance request updates</li>
                      <li>Official notices from management</li>
                    </ul>
                  </td>
                </tr>
              </table>


            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f6f9fc;border-top:1px solid #e8eef3;padding:24px 48px;">
              <p style="margin:0 0 4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#8fa3b1;line-height:1.6;">
                This is an automated message from Sallyan House property management. Please do not reply directly to this email.
              </p>
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#8fa3b1;">
                © ${new Date().getFullYear()} Sallyan House · <a href="https://app.sallyanhouse.com" style="color:#1A5276;text-decoration:none;">app.sallyanhouse.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- End card -->

      </td>
    </tr>
  </table>

</body>
</html>`,
  }),

  maintenanceAssignment: ({
    staffName,
    title,
    description,
    type,
    priority,
    scheduledDate,
    propertyName,
    unitName,
    maintenanceId,
  }) => {
    const priorityColor =
      {
        Low: "#2196F3",
        Medium: "#FF9800",
        High: "#F44336",
        Urgent: "#9C27B0",
      }[priority] || "#FF9800";

    const formattedDate = scheduledDate
      ? new Date(scheduledDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not specified";

    return {
      subject: `[${priority}] Maintenance Task Assigned: ${title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #37474F; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #37474F; }
            .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; color: #555; }
            .badge {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 12px;
              color: white;
              background-color: ${priorityColor};
              font-size: 13px;
              font-weight: bold;
            }
            .cta { text-align: center; margin: 24px 0; }
            .cta a {
              background-color: #37474F;
              color: white;
              padding: 12px 28px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
            }
            .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1> Maintenance Task Assigned</h1>
            </div>

            <div class="content">
              <p>Dear <strong>${staffName}</strong>,</p>
              <p>A maintenance task has been assigned to you. Please review the details below and take appropriate action.</p>

              <div class="details">
                <h3 style="margin-top: 0; color: #37474F;">Task Details</h3>
                <div class="details-row">
                  <span class="label">Title:</span>
                  <span>${title}</span>
                </div>
                ${
                  description
                    ? `
                <div class="details-row">
                  <span class="label">Description:</span>
                  <span>${description}</span>
                </div>`
                    : ""
                }
                <div class="details-row">
                  <span class="label">Type:</span>
                  <span>${type}</span>
                </div>
                <div class="details-row">
                  <span class="label">Priority:</span>
                  <span class="badge">${priority}</span>
                </div>
                <div class="details-row">
                  <span class="label">Scheduled Date:</span>
                  <span>${formattedDate}</span>
                </div>
                ${
                  propertyName
                    ? `
                <div class="details-row">
                  <span class="label">Property:</span>
                  <span>${propertyName}</span>
                </div>`
                    : ""
                }
                ${
                  unitName
                    ? `
                <div class="details-row">
                  <span class="label">Unit:</span>
                  <span>${unitName}</span>
                </div>`
                    : ""
                }
              </div>

              <div class="cta">
                <a href="${process.env.FRONTEND_URL}/maintenance/${maintenanceId}">
                  View Maintenance Task
                </a>
              </div>

              <p>Please log in to the system to update the task status as you proceed.</p>
              <p>Best regards,<br><strong>Sallyan House Management</strong></p>
            </div>

            <div class="footer">
              <p>Contact us: info@sallyanhouse.com | +977-9812345678</p>
              <p>This is an automated email. Please do not reply directly to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  },
};

export const sendEmail = async ({ to, subject, html, attachments }) => {
  if (!to) throw new Error("No recipient email provided");

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    attachments: attachments || [],
  };

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Email sending timeout after 30 seconds"));
    }, 30000);
  });

  await Promise.race([transporter.sendMail(mailOptions), timeoutPromise]);
};

/** Send welcome email using template; caller only passes data. */
export const sendWelcomeEmail = async (data) => {
  const { to, tenantName } = data;
  if (!to) return;
  const { subject, html } = emailTemplates.welcome({ tenantName });
  return sendEmail({ to, subject, html });
};

/**
 * Notify assigned staff of a maintenance task.
 * Non-blocking — swallows errors so email failure never breaks the caller.
 *
 * @param {Object} data
 * @param {string} data.to          - Staff email
 * @param {string} data.staffName   - Staff display name
 * @param {string} data.title       - Maintenance title
 * @param {string} [data.description]
 * @param {string} data.type        - Repair | Maintenance | Inspection | Other
 * @param {string} data.priority    - Low | Medium | High | Urgent
 * @param {Date}   data.scheduledDate
 * @param {string} [data.propertyName]
 * @param {string} [data.unitName]
 * @param {string} data.maintenanceId - MongoDB ObjectId string
 */
export const sendMaintenanceAssignmentEmail = async (data) => {
  const { to } = data;
  if (!to) return;

  try {
    const { subject, html } = emailTemplates.maintenanceAssignment(data);
    await sendEmail({ to, subject, html });
  } catch (err) {
    // Log but never throw — email is a side-effect, not a core operation
    console.error(
      `[sendMaintenanceAssignmentEmail] Failed for ${to}:`,
      err.message,
    );
  }
};

async function sendPaymentReceiptEmail({
  to,
  tenantName,
  amount,
  paymentDate,
  paidFor,
  receiptNo,
  propertyName,
  pdfBuffer,
  pdfFileName,
  rentAmount = 0,
  camAmount = 0,
}) {
  const mailOptions = {
    from: `"Sallyan House" ${process.env.EMAIL_FROM}`,
    to: to,
    subject: `Payment Receipt - ${paidFor}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Receipt</h1>
          </div>
          
          <div class="content">
            <p>Dear <strong>${tenantName}</strong>,</p>
            <p>Thank you for your payment. We have successfully received your payment and a detailed receipt is attached to this email.</p>
            
            <div class="details">
              <h3 style="margin-top: 0; color: #4CAF50;">Payment Details</h3>
              <div class="details-row">
                <span class="label">Receipt No:</span>
                <span class="value">${receiptNo}</span>
              </div>
              ${
                rentAmount && rentAmount > 0
                  ? `
              <div class="details-row">
                <span class="label">Rent Amount:</span>
                <span class="value">Rs. ${rentAmount.toLocaleString()}</span>
              </div>
              `
                  : ""
              }
              ${
                camAmount && camAmount > 0
                  ? `
              <div class="details-row">
                <span class="label">CAM Charges:</span>
                <span class="value">Rs. ${camAmount.toLocaleString()}</span>
              </div>
              `
                  : ""
              }
              <div class="details-row">
                <span class="label">Total Amount Paid:</span>
                <span class="value"><strong>${formatMoney(amount)}</strong></span>
              </div>
              <div class="details-row">
                <span class="label">Payment Date:</span>
                <span class="value">${paymentDate}</span>
              </div>
              <div class="details-row">
                <span class="label">Period:</span>
                <span class="value">${paidFor}</span>
              </div>
              <div class="details-row">
                <span class="label">Property:</span>
                <span class="value">${propertyName}</span>
              </div>
            </div>
            
            <p>Please find your official payment receipt attached as a PDF document. Keep this for your records.</p>
            
            <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>
            <strong>Sallyan House Management</strong></p>
          </div>
          
          <div class="footer">
            <p>Contact us: info@sallyanhouse.com | +977-9812345678</p>
            <p>This is an automated email. Please do not reply directly to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: pdfFileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
}
export { sendPaymentReceiptEmail };
