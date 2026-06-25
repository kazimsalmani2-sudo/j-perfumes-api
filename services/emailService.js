import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import { getOtpEmailTemplate } from '../utils/emailTemplate.js';

// Clean the app password by removing all spaces (critical for Gmail App Passwords copy-pasted)
const rawPass = process.env.EMAIL_PASS || '';
const cleanPass = rawPass.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL/TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: cleanPass,
  },
  tls: {
    // Prevent failure in local/test networks with self-signed certs
    rejectUnauthorized: false
  }
});

// Verify connection on startup to check for auth/network issues
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error (Check EMAIL_USER & EMAIL_PASS):', error.message);
  } else {
    console.log('✅ SMTP Mailer is ready to send OTP emails');
  }
});

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
