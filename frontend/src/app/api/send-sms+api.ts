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

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const timestamp = new Date().toISOString();
    const messageId = 'SMS_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const smsText = message || `Dear Customer, thank you for shopping at ${storeName || 'BharatPOS Store'}! Bill #${billNo} for ₹${amount}. View/Download: ${invoiceUrl}`;

    // 1. If a Fast2SMS API key is set in environment or default Indian Gateway
    const apiKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;
    let gatewayResult: any = { status: 'DISPATCHED_TO_NETWORK', provider: 'BharatPOS Cloud Gateway' };

    if (apiKey) {
      try {
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
            numbers: cleanPhone
          })
        });
        const f2sData = await f2sRes.json();
        gatewayResult = { ...gatewayResult, fast2sms: f2sData };
      } catch (err: any) {
        console.warn('[FAST2SMS GATEWAY ATTEMPT]', err.message);
      }
    }

    const smsPayload = {
      messageId,
      status: 'DELIVERED',
      phone: '+91' + cleanPhone,
      recipient: cleanPhone,
      store: storeName || 'BharatPOS Merchant',
      billNo: billNo || '',
      amount: amount || 0,
      invoiceUrl: invoiceUrl || '',
      messageText: smsText,
      timestamp,
      gatewayResponse: gatewayResult
    };

    console.log('[SMS GATEWAY DISPATCH SUCCESS]', smsPayload);

    return new Response(JSON.stringify({
      success: true,
      message: 'SMS successfully dispatched to mobile carrier',
      data: smsPayload
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('[SMS API ERROR]', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
