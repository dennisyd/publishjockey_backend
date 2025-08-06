const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 PublishJockey Email Setup\n');

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupEmail() {
  console.log('This script will help you configure email settings for production.\n');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '.env');
  const envExists = fs.existsSync(envPath);
  
  if (envExists) {
    console.log('⚠️  .env file already exists. This will update your existing configuration.\n');
  }
  
  // Email provider selection
  console.log('Choose your email provider:');
  console.log('1. Gmail');
  console.log('2. Outlook/Hotmail');
  console.log('3. SendGrid');
  console.log('4. Custom SMTP');
  
  const providerChoice = await askQuestion('\nEnter your choice (1-4): ');
  
  let emailConfig = {};
  
  switch (providerChoice) {
    case '1':
      emailConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false
      };
      console.log('\n📧 Gmail Configuration');
      console.log('Note: You\'ll need to use an App Password, not your regular password.');
      console.log('To create an App Password:');
      console.log('1. Go to your Google Account settings');
      console.log('2. Enable 2-factor authentication');
      console.log('3. Generate an App Password for "Mail"\n');
      break;
      
    case '2':
      emailConfig = {
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false
      };
      console.log('\n📧 Outlook/Hotmail Configuration');
      break;
      
    case '3':
      emailConfig = {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false
      };
      console.log('\n📧 SendGrid Configuration');
      console.log('Note: Use "apikey" as the username and your SendGrid API key as the password.\n');
      break;
      
    case '4':
      emailConfig = {
        host: await askQuestion('Enter SMTP host: '),
        port: parseInt(await askQuestion('Enter SMTP port (default 587): ') || '587'),
        secure: (await askQuestion('Use secure connection? (y/n, default n): ')).toLowerCase() === 'y'
      };
      break;
      
    default:
      console.log('Invalid choice. Using Gmail configuration.');
      emailConfig = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false
      };
  }
  
  // Get email credentials
  const emailUser = await askQuestion('Enter your email address: ');
  const emailPass = await askQuestion('Enter your email password/app password: ');
  
  // Build environment variables
  const envVars = [
    `EMAIL_HOST=${emailConfig.host}`,
    `EMAIL_PORT=${emailConfig.port}`,
    `EMAIL_SECURE=${emailConfig.secure}`,
    `EMAIL_USER=${emailUser}`,
    `EMAIL_PASS=${emailPass}`
  ];
  
  // Read existing .env file if it exists
  let existingEnv = '';
  if (envExists) {
    existingEnv = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or create .env file
  let newEnvContent = existingEnv;
  
  // Remove existing email config if present
  const lines = existingEnv.split('\n').filter(line => 
    !line.startsWith('EMAIL_HOST=') &&
    !line.startsWith('EMAIL_PORT=') &&
    !line.startsWith('EMAIL_SECURE=') &&
    !line.startsWith('EMAIL_USER=') &&
    !line.startsWith('EMAIL_PASS=')
  );
  
  newEnvContent = lines.join('\n');
  if (newEnvContent && !newEnvContent.endsWith('\n')) {
    newEnvContent += '\n';
  }
  
  // Add email configuration
  newEnvContent += '\n# Email Configuration\n' + envVars.join('\n') + '\n';
  
  // Write to .env file
  fs.writeFileSync(envPath, newEnvContent);
  
  console.log('\n✅ Email configuration saved to .env file!');
  console.log('\nTo test the configuration, run:');
  console.log('node test-email.js');
  
  rl.close();
}

setupEmail().catch(console.error); 