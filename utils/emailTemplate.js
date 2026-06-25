/**
 * Generates the HTML body for the OTP verification email.
 * @param {string} name - User's name
 * @param {string} otp - 6-digit OTP code
 * @returns {string} - HTML string
 */
export const getOtpEmailTemplate = (name, otp) => {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e5d5b0; border-radius: 12px; background-color: #fafaf7; color: #1a1a1a; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
      <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e5d5b0; padding-bottom: 20px;">
        <h1 style="color: #b8960c; margin: 0; font-size: 28px; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;">J Perfumewala</h1>
        <p style="color: #666; font-size: 11px; margin: 5px 0 0 0; letter-spacing: 4px; text-transform: uppercase;">Luxury Fragrances</p>
      </div>
      
      <div style="padding: 10px 0;">
        <h2 style="font-size: 18px; font-weight: 600; margin-top: 0; color: #333; letter-spacing: 0.5px;">Verify Your Email Address</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #555;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.6; color: #555;">Thank you for registering at J Perfumewala. Please use the following 6-digit One-Time Password (OTP) to complete your account registration and email verification:</p>
        
        <div style="background-color: #ffffff; border: 1px solid #e3e3dc; padding: 22px; border-radius: 8px; text-align: center; margin: 25px 0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
          <span style="font-size: 38px; font-weight: 700; letter-spacing: 10px; color: #b8960c; font-family: monospace; padding-left: 10px;">${otp}</span>
        </div>
        
        <p style="font-size: 13px; color: #777; line-height: 1.5;">This code is valid for <strong>5 minutes</strong>. For your security, do not share this code with anyone.</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; border-top: 1px solid #e5d5b0; padding-top: 20px; font-size: 11px; color: #999;">
        <p style="margin: 0 0 5px 0;">If you did not initiate this request, you can safely ignore this email.</p>
        <p style="margin: 0;">© 2026 J Perfumewala Luxury Fragrances. All rights reserved.</p>
      </div>
    </div>
  `;
};
