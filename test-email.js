import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const cleanUser = (process.env.EMAIL_USER || '').trim();
const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();

console.log('EMAIL_USER:', cleanUser);
console.log('EMAIL_PASS length:', cleanPass.length);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: cleanUser,
    pass: cleanPass
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Connection configuration error:', error);
  } else {
    console.log('✅ SMTP Connection is ready!');
    
    // Attempt to send a test email to the user's email itself
    const mailOptions = {
      from: `"J Perfumewala Test" <${cleanUser}>`,
      to: cleanUser,
      subject: 'Test OTP mail connection',
      text: 'If you receive this, Nodemailer is working perfectly!'
    };
    
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('❌ Error sending mail:', err);
      } else {
        console.log('✅ Mail sent successfully:', info.messageId);
      }
    });
  }
});
