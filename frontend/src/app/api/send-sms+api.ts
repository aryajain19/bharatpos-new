export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, message, billNo, amount, storeName, invoiceUrl } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone number is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clean the phone number — only digits, last 10 digits for Indian numbers
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(-10);
    }

    if (cleanPhone.length !== 10) {
      return new Response(JSON.stringify({ error: 'Invalid Indian mobile number. Must be 10 digits.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const timestamp = new Date().toISOString();
    const messageId = 'SMS_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Build SMS text — keep it short and clean for carrier delivery
    const smsText = message || `Dear Customer, thank you for shopping at ${storeName || 'BharatPOS Store'}! Bill No: ${billNo}, Amount: Rs.${amount}. View Bill: ${invoiceUrl}`;

    // Fast2SMS API Key from Vercel environment
    const apiKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;

    if (!apiKey) {
      console.error('[SMS API] No FAST2SMS_API_KEY or SMS_API_KEY found in environment variables.');
      return new Response(JSON.stringify({
        success: false,
        error: 'SMS gateway API key not configured. Please set FAST2SMS_API_KEY in Vercel environment variables.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ─── Send via Fast2SMS Quick Transactional SMS API ───
    console.log('[SMS GATEWAY] Sending SMS to', cleanPhone, 'via Fast2SMS...');

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

    console.log('[SMS GATEWAY] Fast2SMS Response:', JSON.stringify(f2sData));

    // Check if Fast2SMS accepted the message
    if (f2sData.return === true || f2sData.status_code === 200 || (f2sData.message && f2sData.message.includes && f2sData.message.includes('SMS sent'))) {
      return new Response(JSON.stringify({
        success: true,
        message: 'SMS delivered to +91 ' + cleanPhone,
        data: {
          messageId,
          status: 'DELIVERED',
          phone: '+91' + cleanPhone,
          billNo: billNo || '',
          amount: amount || 0,
          timestamp,
          gatewayResponse: f2sData
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Fast2SMS returned an error
      console.error('[SMS GATEWAY ERROR]', f2sData);
      return new Response(JSON.stringify({
        success: false,
        error: f2sData.message || 'Fast2SMS delivery failed',
        gatewayResponse: f2sData
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('[SMS API ERROR]', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
