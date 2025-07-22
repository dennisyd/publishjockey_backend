const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.auth.user,
    pass: config.email.auth.pass
  }
});

/**
 * Send verification email to a new user
 * @param {Object} options - Options containing name, email, and verificationToken
 */
const sendVerificationEmail = async ({ name, email, verificationToken }) => {
  // Skip sending emails in development unless email config is set
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log(`[DEV] Verification email would be sent to ${email} with token: ${verificationToken}`);
    return;
  }

  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: `"PublishJockey" <${config.email.auth.user}>`,
    to: email,
    subject: 'Verify Your Email - PublishJockey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to PublishJockey!</h2>
        <p>Hello ${name},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Verify Email
          </a>
        </p>
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>The PublishJockey Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {Object} options - Options containing name, email, and resetToken
 */
const sendPasswordResetEmail = async ({ name, email, resetToken }) => {
  // Skip sending emails in development unless email config is set
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log(`[DEV] Password reset email would be sent to ${email} with token: ${resetToken}`);
    return;
  }

  const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"PublishJockey" <${config.email.auth.user}>`,
    to: email,
    subject: 'Reset Your Password - PublishJockey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
        <p>To reset your password, click the button below:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p>${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>Best regards,<br>The PublishJockey Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Send notification email to user
 * @param {Object} options - Options containing name, email, subject and message
 */
const sendNotificationEmail = async ({ name, email, subject, message }) => {
  // Skip sending emails in development unless email config is set
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log(`[DEV] Notification email would be sent to ${email} with subject: ${subject}`);
    return;
  }
  
  const mailOptions = {
    from: `"PublishJockey" <${config.email.auth.user}>`,
    to: email,
    subject: `${subject} - PublishJockey`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hello ${name},</p>
        <div>${message}</div>
        <p style="margin-top: 20px;">Best regards,<br>The PublishJockey Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Notification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNotificationEmail
}; 