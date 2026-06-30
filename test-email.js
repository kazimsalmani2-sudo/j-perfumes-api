import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const logFile = path.join(process.cwd(), 'smtp_diagnose_result.txt');
let logContent = `--- SMTP Diagnosis Started at ${new Date().toISOString()} ---\n`;

function log(msg, obj = null) {
  const line = obj ? `${msg} ${JSON.stringify(obj, null, 2)}` : msg;
  console.log(line);
  logContent += line + '\n';
  fs.writeFileSync(logFile, logContent);
}

const cleanUser = (process.env.EMAIL_USER || '').trim();
const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();

log(`EMAIL_USER configured: "${cleanUser}"`);
log(`EMAIL_PASS length: ${cleanPass.length}`);

async function testConfig(name, config) {
  log(`\n========================================`);
  log(`Testing configuration: ${name}`);
  log(`Config:`, { host: config.host, port: config.port, secure: config.secure, service: config.service });
  log(`========================================`);
  
  const transporter = nodemailer.createTransport({
    ...config,
    auth: {
      user: cleanUser,
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  });

  try {
    log(`[${name}] Verifying SMTP connection...`);
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) reject(error);
        else resolve(success);
      });
    });
    log(`[${name}] ✅ SMTP Connection verified successfully!`);
    
    // Attempt to send a test email to yourself
    log(`[${name}] Attempting to send test email to ${cleanUser}...`);
    const info = await transporter.sendMail({
      from: `"J Perfumewala Test" <${cleanUser}>`,
      to: cleanUser,
      subject: `Test OTP connection (${name})`,
      text: `If you receive this, configuration "${name}" is working perfectly!`
    });
    log(`[${name}] ✅ Mail sent successfully! MessageID: ${info.messageId}`);
    return true;
  } catch (err) {
    log(`[${name}] ❌ Failed: ${err.message}`);
    if (err.stack) {
      logContent += `Stack Trace:\n${err.stack}\n`;
      fs.writeFileSync(logFile, logContent);
    }
    return false;
  }
}

async function runAll() {
  // Test 1: Port 587 (STARTTLS)
  const success1 = await testConfig('Port 587 (STARTTLS)', {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false
  });

  // Test 2: Port 465 (Implicit TLS)
  const success2 = await testConfig('Port 465 (Implicit TLS)', {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true
  });

  // Test 3: Service Gmail
  const success3 = await testConfig('Service Gmail shortcut', {
    service: 'gmail'
  });

  log(`\n--- SMTP Diagnosis Finished ---\n`);
  log(`Winner config found:`);
  log(`Port 587: ${success1 ? 'SUCCESS' : 'FAILED'}`);
  log(`Port 465: ${success2 ? 'SUCCESS' : 'FAILED'}`);
  log(`Service Gmail: ${success3 ? 'SUCCESS' : 'FAILED'}`);
}

runAll().catch(err => {
  log(`Fatal error during diagnostic run: ${err.message}`);
});
