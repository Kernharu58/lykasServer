const nodemailer = require('nodemailer');

// 1. Configure the transporter
// Using general environment variables to allow for flexibility between Gmail, SendGrid, or custom SMTP
const emailServiceConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

const transporter = emailServiceConfigured 
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
      auth: {
        user: process.env.EMAIL_USER || process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  : null;

// Log email service status on startup
if (!emailServiceConfigured) {
  console.warn(`⚠️ [EMAIL SERVICE] Not configured - email verification emails will not be sent.`);
  console.warn(`   To enable emails, set EMAIL_USER and EMAIL_PASSWORD in .env`);
  console.warn(`   See .env.example for instructions`);
}

/**
 * Send email with verification link
 */
const sendVerificationEmail = async ({
  email,
  displayName,
  verificationToken,
  frontendUrl,
}) => {
  try {
    if (!emailServiceConfigured) {
      console.warn(`⚠️ [EMAIL SERVICE] Email not configured. Would have sent to: ${email}`);
      return { success: false, error: 'Email service not configured', skipped: true };
    }

    if (!transporter) {
      return { success: false, error: 'Email transporter failed to initialize', skipped: true };
    }

    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `Lykas Admin <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Lykas Account Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to Lykas, ${displayName}!</h2>
          <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
          <p>
            <a href="${verificationLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p>${verificationLink}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Lykas - Animal Shelter Management System</p>
        </div>
      `,
    };

    console.log(`[EMAIL SERVICE] Sending verification email to ${email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL SERVICE] Verification email sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [EMAIL SERVICE] Error sending verification email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async ({
  email,
  displayName,
  resetToken,
  frontendUrl,
}) => {
  try {
    if (!emailServiceConfigured) {
      console.warn(`⚠️ [EMAIL SERVICE] Email not configured. Would have sent to: ${email}`);
      return { success: false, error: 'Email service not configured', skipped: true };
    }

    if (!transporter) {
      return { success: false, error: 'Email transporter failed to initialize', skipped: true };
    }

    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `Lykas Admin <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Lykas Account Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${displayName},</p>
          <p>We received a request to reset the password for your Lykas account. Click the link below to set a new password:</p>
          <p>
            <a href="${resetLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p>${resetLink}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Lykas - Animal Shelter Management System</p>
        </div>
      `,
    };

    console.log(`[EMAIL SERVICE] Sending password reset email to ${email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL SERVICE] Password reset email sent successfully to ${email}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ [EMAIL SERVICE] Error sending password reset email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};