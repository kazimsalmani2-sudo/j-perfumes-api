import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const user = (process.env.EMAIL_USER || '').trim();
const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();

console.log('EMAIL_USER:', user);
console.log('EMAIL_PASS length:', pass.length, '(should be 16)');
console.log('EMAIL_PASS value:', pass);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

console.log('\nVerifying SMTP connection...');
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Verify FAILED:', error.message);
    console.error('Full error:', error);
  } else {
    console.log('✅ SMTP Connected! Sending test email...');
    transporter.sendMail({
      from: `"J Perfumewala" <${user}>`,
      to: user,
      subject: 'Test OTP Email',
      text: 'This is a test email from J Perfumewala backend.'
    }, (err, info) => {
      if (err) {
        console.error('❌ Send FAILED:', err.message);
      } else {
        console.log('✅ Email sent! MessageID:', info.messageId);
      }
    });
  }
});
