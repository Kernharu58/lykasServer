const nodemailer = require("nodemailer");

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send email with verification link
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.displayName - User display name
 * @param {string} options.verificationToken - Verification token
 * @param {string} options.frontendUrl - Frontend URL (e.g., 'http://localhost:3000')
 */
const sendVerificationEmail = async ({
  email,
  displayName,
  verificationToken,
  frontendUrl,
}) => {
  try {
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
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

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email verification send error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.displayName - User display name
 * @param {string} options.resetToken - Reset token
 * @param {string} options.frontendUrl - Frontend URL
 */
const sendPasswordResetEmail = async ({
  email,
  displayName,
  resetToken,
  frontendUrl,
}) => {
  try {
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
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

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Password reset email send error:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
