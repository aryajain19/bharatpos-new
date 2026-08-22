module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, message, billNo, amount, storeName, invoiceUrl } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    let cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Invalid Indian mobile number. Must be 10 digits.' });
    }

    const apiKey = process.env.FAST2SMS_API_KEY || 'onaBZVdzr2bp8IumLDKi0JkXFvHSlfsEQMWqj3teP7gywOYCh5STcEbRVkw27WIrAnvjCqXZzKPMlQyG';
    const smsText = message || `Dear Customer, thank you for shopping at ${storeName || 'BharatPOS Store'}! Bill No: ${billNo}, Amount: Rs.${amount}. View Bill: ${invoiceUrl}`;

    console.log('[Fast2SMS] Dispatching to +91' + cleanPhone);

    const f2sRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: smsText,
        language: 'english',
        flash: '0',
        numbers: cleanPhone
      })
    });

    const f2sData = await f2sRes.json();
    console.log('[Fast2SMS Response]', f2sData);

    if (f2sData.return === true || f2sData.status_code === 200 || (f2sData.message && f2sData.message.includes && f2sData.message.includes('SMS sent'))) {
      return res.status(200).json({
        success: true,
        message: 'SMS delivered to +91 ' + cleanPhone,
        data: f2sData
      });
    } else {
      return res.status(200).json({
        success: false,
        error: f2sData.message || 'Fast2SMS delivery rejected by carrier',
        data: f2sData
      });
    }
  } catch (error) {
    console.error('[SMS Handler Error]', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
