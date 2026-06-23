const admin = require('firebase-admin');

// CORS Helper
function runCors(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (serviceAccountVar) {
    try {
      const sa = JSON.parse(serviceAccountVar);
      credential = admin.credential.cert(sa);
      console.log('Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT environment variable.');
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e);
    }
  }

  // Fallback to local file for development if no env var is present
  if (!credential) {
    try {
      // In Vercel serverless environment, we check if key exists in api folder
      const fs = require('fs');
      const path = require('path');
      const keyPath = path.join(__dirname, 'serviceAccountKey.json');
      if (fs.existsSync(keyPath)) {
        const serviceAccount = require(keyPath);
        credential = admin.credential.cert(serviceAccount);
        console.log('Firebase Admin initialized via local serviceAccountKey.json.');
      }
    } catch (e) {
      console.error('Error loading local serviceAccountKey.json:', e);
    }
  }

  if (credential) {
    admin.initializeApp({
      credential
    });
  } else {
    // Last fallback: initialize default (fails if not in Google environment, but compiles)
    admin.initializeApp();
    console.warn('Firebase Admin initialized with default credentials.');
  }
}

module.exports = async (req, res) => {
  if (runCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { uid, newPassword } = req.body;

  if (!uid || !newPassword) {
    return res.status(400).json({ error: 'Missing uid or newPassword' });
  }

  try {
    const userRecord = await admin.auth().updateUser(uid, {
      password: newPassword,
    });
    console.log('Successfully updated user password:', userRecord.uid);
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating user password:', error);
    return res.status(500).json({ error: error.message });
  }
};
