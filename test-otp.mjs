// Test script to verify OTP email sending
import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

const rawPass = process.env.EMAIL_PASS || '';
const cleanPass = rawPass.replace(/\s+/g, '');

console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS (raw length):', rawPass.length);
console.log('EMAIL_PASS (clean length):', cleanPass.length);
console.log('Clean pass:', cleanPass);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: cleanPass,
  },
  tls: { rejectUnauthorized: false }
});

console.log('\nVerifying SMTP connection...');
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP VERIFY ERROR:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ SMTP connection verified! Ready to send emails.');
    // Try sending a test email
    const testOtp = Math.floor(1000 + Math.random() * 9000).toString();
    transporter.sendMail({
      from: `"J Perfumewala" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // send to itself for test
      subject: `${testOtp} is your J Perfumewala verification code`,
      html: `<h2>Test OTP: <strong style="color:#b8960c">${testOtp}</strong></h2><p>This is a test email from the checkout OTP system.</p>`
    }).then(info => {
      console.log('✅ Test email sent! MessageID:', info.messageId);
    }).catch(err => {
      console.error('❌ SEND FAILED:', err.message);
    });
  }
});
