const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function forceUpdatePassword() {
  try {
    const user = await admin.auth().getUserByEmail('aryajain1906@gmail.com');
    await admin.auth().updateUser(user.uid, {
      password: 'Welcome@123'
    });
    console.log('Successfully updated password for aryajain1906@gmail.com to Welcome@123');
  } catch (error) {
    console.log('Error:', error.message);
  }
  process.exit();
}

forceUpdatePassword();
