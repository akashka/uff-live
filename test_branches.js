import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

// Create a dummy admin token
const token = jwt.sign(
  { userId: new mongoose.Types.ObjectId().toString(), email: 'admin@test.com', role: 'admin' },
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

const body = JSON.stringify({
  name: 'Test Branch CLI',
  address: '123 Test St',
  phoneNumber: '555-0100',
  email: 'test@branch.com'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/branches',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cookie': `auth-token=${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', console.error);
req.write(body);
req.end();
