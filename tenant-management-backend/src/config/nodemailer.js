import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., smtp.gmail.com
  port: Number(process.env.SMTP_PORT), // convert string to number
  secure: process.env.SMTP_PORT === "465", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // App password if using Gmail
  },
  connectionTimeout: 10000, // 10 seconds timeout for initial connection
  socketTimeout: 10000, // 10 seconds timeout for socket operations
  greetingTimeout: 10000, // 10 seconds timeout for greeting
  // Additional timeout for sendMail operation
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

export const sendEmail = async ({ to, subject, html, attachments }) => {
  if (!to) throw new Error("No recipient email provided");

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    attachments: attachments || [],
  };

  // Add timeout wrapper to prevent indefinite hangs
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("Email sending timeout after 30 seconds"));
    }, 30000); // 30 seconds timeout
  });

  await Promise.race([
    transporter.sendMail(mailOptions),
    timeoutPromise,
  ]);
};
export async function sendPaymentReceiptEmail({
  to,
  tenantName,
  amount,
  paymentDate,
  paidFor,
  receiptNo,
  propertyName,
  pdfBuffer,
  pdfFileName,
}) {
  const mailOptions = {
    from: `"Sallyan House" <${process.env.EMAIL_USER}>`,
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
              <div class="details-row">
                <span class="label">Amount Paid:</span>
                <span class="value">Rs. ${amount}</span>
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
        content: pdfBuffer, // The PDF buffer generated from generatePDFToBuffer
        contentType: "application/pdf",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
}
