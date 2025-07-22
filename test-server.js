// Save this as test-server.js in your backend folder
const express = require('express');
const app = express();

app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send('Express server is working');
});

app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test endpoint is working' });
});

app.listen(3002, () => {
  console.log('Test server running on port 3002');
});