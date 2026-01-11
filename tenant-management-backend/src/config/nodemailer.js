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

  await transporter.sendMail(mailOptions);
};
