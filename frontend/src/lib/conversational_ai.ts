import { Platform } from 'react-native';

export type POSIntentType =
  | 'ADD_TO_CART'
  | 'REMOVE_FROM_CART'
  | 'UPDATE_QTY'
  | 'CLEAR_CART'
  | 'APPLY_DISCOUNT'
  | 'CHECKOUT'
  | 'QUERY_SALES'
  | 'QUERY_STOCK'
  | 'LOW_STOCK_ALERT'
  | 'PRICE_CHECK'
  | 'NAVIGATE'
  | 'HELP'
  | 'UNKNOWN';

export interface ExtractedProduct {
  name: string;
  qty: number;
  matchedProduct?: any;
}

export interface POSIntentResult {
  intent: POSIntentType;
  rawText: string;
  replyText: string;
  confidence: number;
  items?: ExtractedProduct[];
  discount?: { type: 'percent' | 'flat'; value: number };
  paymentMethod?: 'cash' | 'upi' | 'card' | 'credit';
  targetRoute?: string;
  queryData?: any;
  actionRequired?: boolean;
}

// ── Fuzzy Product Matcher ──────────────────────────────────────────────
export function findBestProductMatch(queryName: string, products: any[]): any | null {
  if (!queryName || !products || products.length === 0) return null;
  const cleanQ = queryName.toLowerCase().trim();

  // 1. Exact match
  const exact = products.find(p => p.name?.toLowerCase().trim() === cleanQ);
  if (exact) return exact;

  // 2. Starts with / includes
  const includes = products.find(p => p.name?.toLowerCase().includes(cleanQ) || cleanQ.includes(p.name?.toLowerCase()));
  if (includes) return includes;

  // 3. Category match
  const catMatch = products.find(p => p.category?.toLowerCase() === cleanQ);
  if (catMatch) return catMatch;

  // 4. Token overlap
  const qTokens = cleanQ.split(/\s+/).filter(t => t.length > 2);
  let bestMatch: any = null;
  let maxScore = 0;

  for (const prod of products) {
    const pTokens = (prod.name || '').toLowerCase().split(/\s+/);
    let score = 0;
    for (const qt of qTokens) {
      if (pTokens.some((pt: string) => pt.includes(qt) || qt.includes(pt))) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = prod;
    }
  }

  return maxScore > 0 ? bestMatch : null;
}

// ── Number word converter ──────────────────────────────────────────────
const numberWords: Record<string, number> = {
  one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, 'half kg': 0.5, 'quarter': 0.25,
};

function parseQuantity(rawStr: string): number {
  const clean = rawStr.toLowerCase().trim();
  if (!isNaN(Number(clean))) return Math.max(1, Number(clean));
  if (numberWords[clean] !== undefined) return numberWords[clean];
  return 1;
}

// ── Main Intent Classifier & Parser ────────────────────────────────────
export function processPOSConversation(
  text: string,
  catalog: any[] = [],
  contextData?: {
    todaySales?: number;
    todayBills?: number;
    cartItems?: any[];
  }
): POSIntentResult {
  const clean = text.toLowerCase().trim();
  if (!clean) {
    return {
      intent: 'HELP',
      rawText: text,
      replyText: "Hi there! I'm your POS AI Assistant. Try saying 'Add 2 Milk and 1 Bread', 'What are today's sales?', or 'Check stock for Sugar'.",
      confidence: 1.0,
    };
  }

  // 1. CLEAR CART
  if (clean.includes('clear cart') || clean.includes('empty cart') || clean.includes('delete all') || clean.includes('reset bill')) {
    return {
      intent: 'CLEAR_CART',
      rawText: text,
      replyText: 'Cleared all items from your billing cart.',
      confidence: 0.95,
      actionRequired: true,
    };
  }

  // 2. CHECKOUT & PAYMENT
  if (clean.includes('checkout') || clean.includes('complete bill') || clean.includes('pay by') || clean.includes('payment') || clean.includes('finish sale')) {
    let method: 'cash' | 'upi' | 'card' | 'credit' = 'cash';
    if (clean.includes('upi') || clean.includes('gpay') || clean.includes('phonepe') || clean.includes('paytm') || clean.includes('qr')) {
      method = 'upi';
    } else if (clean.includes('card') || clean.includes('debit') || clean.includes('credit card')) {
      method = 'card';
    } else if (clean.includes('credit') || clean.includes('udhar') || clean.includes('khata')) {
      method = 'credit';
    }
    return {
      intent: 'CHECKOUT',
      rawText: text,
      replyText: `Proceeding to checkout with payment method: ${method.toUpperCase()}.`,
      confidence: 0.9,
      paymentMethod: method,
      actionRequired: true,
    };
  }

  // 3. APPLY DISCOUNT
  const discountMatch = clean.match(/(?:apply|give|add)?\s*(\d+)\s*(%|percent|rupees|rs)?\s*discount/i);
  if (discountMatch || clean.includes('discount')) {
    const val = discountMatch ? parseInt(discountMatch[1], 10) : 10;
    const isPercent = !clean.includes('rs') && !clean.includes('rupees');
    return {
      intent: 'APPLY_DISCOUNT',
      rawText: text,
      replyText: `Applied ${val}${isPercent ? '%' : ' ₹'} discount to current bill.`,
      confidence: 0.9,
      discount: { type: isPercent ? 'percent' : 'flat', value: val },
      actionRequired: true,
    };
  }

  // 4. QUERY SALES & BUSINESS REVENUE
  if (
    clean.includes('today sales') ||
    clean.includes("today's sales") ||
    clean.includes('revenue') ||
    clean.includes('how much we sold') ||
    clean.includes('daily sale') ||
    clean.includes('total bills') ||
    clean.includes('how many sales')
  ) {
    const sales = contextData?.todaySales !== undefined ? contextData.todaySales : 0;
    const bills = contextData?.todayBills !== undefined ? contextData.todayBills : 0;
    return {
      intent: 'QUERY_SALES',
      rawText: text,
      replyText: `Today's total revenue is ₹${sales.toLocaleString('en-IN')}${bills > 0 ? ` across ${bills} bills` : ''}.`,
      confidence: 0.95,
      queryData: { todaySales: sales, todayBills: bills },
    };
  }

  // 5. LOW STOCK QUERY
  if (clean.includes('low stock') || clean.includes('out of stock') || clean.includes('reorder') || clean.includes('running low') || clean.includes('stock alert')) {
    const lowStockItems = catalog.filter(p => (p.stock_quantity ?? p.stock_qty ?? 0) <= 5);
    const names = lowStockItems.slice(0, 3).map(p => `${p.name} (${p.stock_quantity ?? p.stock_qty ?? 0} left)`).join(', ');
    const msg = lowStockItems.length > 0
      ? `Found ${lowStockItems.length} items low in stock: ${names}${lowStockItems.length > 3 ? '...' : ''}.`
      : 'All items are currently well-stocked with no low-stock alerts!';

    return {
      intent: 'LOW_STOCK_ALERT',
      rawText: text,
      replyText: msg,
      confidence: 0.9,
      queryData: lowStockItems,
      targetRoute: '/(owner)/inventory',
    };
  }

  // 6. PRICE / STOCK CHECK FOR SPECIFIC ITEM
  if (clean.startsWith('price of') || clean.includes('rate of') || clean.includes('how much is') || clean.includes('cost of') || clean.includes('check stock') || clean.includes('stock for')) {
    const targetItemName = clean
      .replace(/price of|rate of|how much is|cost of|check stock for|check stock|stock for|what is the price of/gi, '')
      .trim();
    
    const matched = findBestProductMatch(targetItemName, catalog);
    if (matched) {
      const price = matched.selling_price ?? matched.mrp ?? 0;
      const stock = matched.stock_quantity ?? matched.stock_qty ?? 0;
      return {
        intent: 'PRICE_CHECK',
        rawText: text,
        replyText: `${matched.name} is priced at ₹${price} (MRP: ₹${matched.mrp || price}). Available stock: ${stock} units.`,
        confidence: 0.9,
        queryData: matched,
      };
    } else {
      return {
        intent: 'PRICE_CHECK',
        rawText: text,
        replyText: `Could not find an item matching '${targetItemName}' in the current catalog.`,
        confidence: 0.6,
      };
    }
  }

  // 7. QUICK NAVIGATION INTENTS
  if (clean.includes('go to') || clean.includes('open') || clean.includes('show')) {
    if (clean.includes('inventory') || clean.includes('product') || clean.includes('catalog')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Navigating to Inventory & Products...', targetRoute: '/(owner)/products_management', confidence: 0.9 };
    }
    if (clean.includes('gst') || clean.includes('tax') || clean.includes('gstr')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Opening GST Management...', targetRoute: '/(owner)/gst_management', confidence: 0.9 };
    }
    if (clean.includes('barcode') || clean.includes('label')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Opening Barcode Generator...', targetRoute: '/(owner)/barcode_generator', confidence: 0.9 };
    }
    if (clean.includes('report') || clean.includes('analytics') || clean.includes('profit')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Opening Sales Reports...', targetRoute: '/(owner)/reports', confidence: 0.9 };
    }
    if (clean.includes('ledger') || clean.includes('day book') || clean.includes('account')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Opening Ledgers & Day Book...', targetRoute: '/(owner)/day_book', confidence: 0.9 };
    }
    if (clean.includes('vendor') || clean.includes('staff')) {
      return { intent: 'NAVIGATE', rawText: text, replyText: 'Opening Staff & Vendors...', targetRoute: '/(owner)/vendors', confidence: 0.9 };
    }
  }

  // 8. ADD TO CART / ORDER TAKING (e.g. "add 2 milk and 1 bread", "2 soaps, 3 biscuits", "add sugar")
  // Clean prefixes like "add", "bill", "put", "take"
  let orderStr = clean.replace(/^(add|bill|put|take|please add|i want|give me|scan)\s+/i, '');
  
  // Split multiple items by 'and', ',', '&', 'plus'
  const itemClauses = orderStr.split(/(?:\s+and\s+|\s*,\s*|\s*&\s*|\s*\+\s*)/i).map(s => s.trim()).filter(Boolean);
  const extractedItems: ExtractedProduct[] = [];

  for (const clause of itemClauses) {
    // Check if clause starts with a number (e.g. "2 milk", "5 packets of biscuits", "one bread")
    const qtyMatch = clause.match(/^(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s*(?:kg|pcs|pc|units?|packets?|bottles?|box(?:es)?)?\s*(?:of\s+)?(.*)$/i);
    let qty = 1;
    let prodName = clause;

    if (qtyMatch) {
      qty = parseQuantity(qtyMatch[1]);
      prodName = (qtyMatch[2] || '').trim();
    }

    if (prodName) {
      const match = findBestProductMatch(prodName, catalog);
      if (match) {
        extractedItems.push({
          name: match.name,
          qty,
          matchedProduct: match,
        });
      } else if (clause.length > 2) {
        // Unmatched named item
        extractedItems.push({
          name: prodName,
          qty,
        });
      }
    }
  }

  if (extractedItems.length > 0) {
    const matchedCount = extractedItems.filter(i => i.matchedProduct).length;
    const summary = extractedItems.map(i => `${i.qty}x ${i.matchedProduct ? i.matchedProduct.name : i.name}`).join(', ');
    
    return {
      intent: 'ADD_TO_CART',
      rawText: text,
      replyText: matchedCount > 0
        ? `Added to cart: ${summary}.`
        : `Matched potential items for: ${summary}. Please confirm to add.`,
      confidence: matchedCount > 0 ? 0.9 : 0.6,
      items: extractedItems,
      actionRequired: true,
    };
  }

  // Fallback / Help
  return {
    intent: 'UNKNOWN',
    rawText: text,
    replyText: `I didn't quite catch that. You can tell me to:\n• Add products (e.g. "Add 2 Milk and 1 Bread")\n• Query sales (e.g. "Today's sales")\n• Check prices (e.g. "Price of Sugar")\n• Quick navigate (e.g. "Open GST Management")`,
    confidence: 0.3,
  };
}

// ── Web Speech API Helpers ─────────────────────────────────────────────
export class SpeechService {
  private static recognitionInstance: any = null;
  private static isListening: boolean = false;

  public static isSupported(): boolean {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public static isSynthesisSupported(): boolean {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    return typeof window.speechSynthesis !== 'undefined';
  }

  public static startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: any) => void,
    onEnd: () => void
  ): boolean {
    if (!this.isSupported()) {
      onError(new Error('Speech recognition is not supported in this browser.'));
      return false;
    }

    try {
      if (this.recognitionInstance && this.isListening) {
        this.recognitionInstance.stop();
      }

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-IN'; // English (India) with fallback to standard en-US

      rec.onstart = () => {
        this.isListening = true;
      };

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        onResult(text, !!finalTranscript);
      };

      rec.onerror = (event: any) => {
        this.isListening = false;
        onError(event);
      };

      rec.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognitionInstance = rec;
      rec.start();
      return true;
    } catch (e) {
      onError(e);
      return false;
    }
  }

  public static stopListening() {
    if (this.recognitionInstance && this.isListening) {
      try {
        this.recognitionInstance.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  public static speak(text: string) {
    if (!this.isSynthesisSupported()) return;
    try {
      window.speechSynthesis.cancel(); // cancel previous
      const cleanText = text.replace(/[*_#•₹]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}
