const nodemailer = require('nodemailer');
const config = require('../config/config');

// Create a transporter object using SMTP transport
const createTransporter = () => {
  // In development, if no email config is provided, create a test account
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log('[DEV] No email configuration found. Using test account for development.');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'test@ethereal.email',
        pass: 'test'
      }
    });
  }

  // Production email configuration
  if (!config.email.host || !config.email.auth.user || !config.email.auth.pass) {
    throw new Error('Email configuration is required in production. Please set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables.');
  }

  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass
    },
    // Additional production settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 14 // Limit to 14 emails per second
  });
};

const transporter = createTransporter();

/**
 * Send verification email to a new user
 * @param {Object} options - Options containing name, email, and verificationToken
 */
const sendVerificationEmail = async ({ name, email, verificationToken }) => {
  // Skip sending emails in development unless email config is set
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log(`[DEV] Verification email would be sent to ${email} with token: ${verificationToken}`);
    console.log(`[DEV] Verification URL: ${config.frontendUrl}/verify-email?token=${verificationToken}`);
    return;
  }

  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: `"PublishJockey" <${config.email.auth.user}>`,
    to: email,
    subject: 'Verify Your Email - PublishJockey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Welcome to PublishJockey!</h2>
          <p style="color: #666; margin: 0 0 15px 0;">Hello ${name},</p>
          <p style="color: #666; margin: 0 0 20px 0;">Thank you for registering. Please verify your email address by clicking the button below:</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Verify Email Address
          </a>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="color: #333; margin: 0; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
          <p style="color: #999; margin: 0 0 10px 0; font-size: 14px;">This link will expire in 24 hours.</p>
          <p style="color: #999; margin: 0; font-size: 14px;">Best regards,<br>The PublishJockey Team</p>
        </div>
      </div>
    `,
    text: `
Welcome to PublishJockey!

Hello ${name},

Thank you for registering. Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

Best regards,
The PublishJockey Team
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}:`, info.messageId);
    return info;
  } catch (error) {
    console.error(`Error sending verification email to ${email}:`, error);
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
 * Send password change confirmation email
 * @param {Object} options - Options containing name, email, and changeDetails
 */
const sendPasswordChangeEmail = async ({ name, email, changeDetails = {} }) => {
  // Skip sending emails in development unless email config is set
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log(`[DEV] Password change confirmation email would be sent to ${email}`);
    console.log(`[DEV] Change details:`, changeDetails);
    return;
  }

  const { timestamp = new Date(), ipAddress, userAgent } = changeDetails;
  const formattedTime = new Date(timestamp).toLocaleString();
  
  const mailOptions = {
    from: `"PublishJockey" <${config.email.auth.user}>`,
    to: email,
    subject: 'Password Changed Successfully - PublishJockey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Changed Successfully</h2>
        <p>Hello ${name},</p>
        <p>Your password has been successfully changed.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #495057;">Change Details:</h3>
          <p><strong>Time:</strong> ${formattedTime}</p>
          ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
          ${userAgent ? `<p><strong>Device:</strong> ${userAgent}</p>` : ''}
        </div>
        
        <p>If you did not make this change, please contact our support team immediately.</p>
        
        <p>For security reasons, we recommend:</p>
        <ul>
          <li>Using a strong, unique password</li>
          <li>Enabling two-factor authentication if available</li>
          <li>Regularly reviewing your account activity</li>
        </ul>
        
        <p>Best regards,<br>The PublishJockey Team</p>
      </div>
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password change confirmation email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password change confirmation email:', error);
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
  sendPasswordChangeEmail,
  sendNotificationEmail
}; 