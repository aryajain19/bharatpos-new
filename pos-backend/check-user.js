const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkUser() {
  try {
    const user = await admin.auth().getUserByEmail('aryajain1906@gmail.com');
    console.log('User exists in Auth:', user.uid);
  } catch (error) {
    console.log('Error:', error.message);
  }
  process.exit();
}

checkUser();
