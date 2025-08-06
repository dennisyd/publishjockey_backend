const { sendVerificationEmail } = require('./utils/emailUtils');
const config = require('./config/config');

async function testEmailVerification() {
  console.log('🧪 Testing Email Verification System\n');
  console.log('Environment:', config.nodeEnv);
  console.log('Frontend URL:', config.frontendUrl);
  console.log('Email Host:', config.email.host || 'NOT SET');
  console.log('Email User:', config.email.auth.user || 'NOT SET');
  console.log('Email Port:', config.email.port);
  console.log('Email Secure:', config.email.secure);
  
  if (config.nodeEnv === 'development' && !config.email.host) {
    console.log('\n⚠️  Development Mode: No email configuration found.');
    console.log('Emails will be logged to console instead of sent.');
    console.log('To enable actual email sending, run: node setup-email.js\n');
  }
  
  try {
    console.log('\n📧 Sending test verification email...');
    await sendVerificationEmail({
      name: 'Test User',
      email: 'test@example.com',
      verificationToken: 'test-token-123'
    });
    
    if (config.nodeEnv === 'development' && !config.email.host) {
      console.log('✅ Test completed successfully!');
      console.log('Check the console output above for the verification URL.');
    } else {
      console.log('✅ Test email sent successfully!');
      console.log('Check your email inbox (and spam folder) for the test email.');
    }
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your email credentials in .env file');
    console.log('2. For Gmail, make sure you\'re using an App Password');
    console.log('3. For Outlook, make sure you\'ve enabled "Less secure apps"');
    console.log('4. Check your firewall/antivirus settings');
    console.log('5. Run: node setup-email.js to reconfigure email settings');
  }
}

testEmailVerification(); 