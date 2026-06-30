import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import { getOtpEmailTemplate } from '../utils/emailTemplate.js';

/**
 * Creates a fresh transporter reading env vars at call time.
 * This avoids ESM module load-order issues where env vars aren't set yet.
 */
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    throw new Error(`EMAIL credentials not found in .env (EMAIL_USER=${user}, EMAIL_PASS length=${pass.length})`);
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

// Verify on startup (non-blocking, only for diagnostics)
setTimeout(() => {
  try {
    const t = createTransporter();
    t.verify((error) => {
      if (error) {
        console.error('❌ SMTP Connection Error (Check EMAIL_USER & EMAIL_PASS):', error.message);
      } else {
        console.log('✅ SMTP Mailer is ready to send OTP emails');
      }
    });
  } catch (e) {
    console.error('❌ SMTP setup skipped:', e.message);
  }
}, 2000);

/**
 * Sends a registration OTP email to the user
 * @param {string} email - Destination email
 * @param {string} name - Recipient name
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<any>}
 */
export const sendOtpEmail = async (email, name, otp) => {
  if (!email) throw new Error('Recipient email is required.');
  if (!otp) throw new Error('OTP code is required.');

  const transporter = createTransporter();

  const mailOptions = {
    from: `"J Perfumewala" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your J Perfumewala verification code`,
    html: getOtpEmailTemplate(name, otp)
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 OTP email sent to ${email} (MessageID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ SMTP Failed sending to ${email}:`, error.message);
    throw new Error(`SMTP Mailer failed to send: ${error.message}`);
  }
};
