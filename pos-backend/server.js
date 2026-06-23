const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/reset-password', async (req, res) => {
  const { uid, newPassword } = req.body;

  if (!uid || !newPassword) {
    return res.status(400).json({ error: 'Missing uid or newPassword' });
  }

  try {
    const userRecord = await admin.auth().updateUser(uid, {
      password: newPassword,
    });
    console.log('Successfully updated user password:', userRecord.uid);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating user password:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 8083;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
