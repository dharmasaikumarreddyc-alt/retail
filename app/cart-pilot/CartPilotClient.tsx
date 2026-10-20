'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useVoice, interpretYesNo } from '../components/useVoice';
import { backendUrl } from '../lib/backend';
import { getAuthenticatedSession } from '../lib/auth';

interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string[];
  timestamp?: string;
}

interface Merchant {
  id: string;
  name: string;
  type: string;
  distance: string;
  rating: number;
  image: string;
  offers: string[];
  prepTime: string;
  address?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  quantity?: number;
}

interface CartItem extends Product {
  selectedQuantity: number;
}

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
}

function formatDeliveryAddress(address?: Address): string {
  if (!address) return 'Pickup';
  return [address.street, address.city, address.state, address.zipCode]
    .filter(Boolean)
    .join(', ') || address.label || 'Pickup';
}

interface AIProposal {
  merchant: Merchant;
  items: CartItem[];
  address: Address;
  pricing: {
    subtotal: number;
    serviceFee: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  reasoning: string;
  hasAlternatives?: boolean;
  alternativeMessage?: string;
}

type FlowStep = 'input' | 'thinking' | 'choosing' | 'proposal' | 'processing' | 'confirmed' | 'smart-cart' | 'budget-shop' | 'predictions';

// Smart Cart types
interface SmartCartItem {
  productId: string;
  merchantId: string;
  merchantName: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  rating?: number;
  distance: string;
  selectionReason: string;
}

interface SmartCartResult {
  success: boolean;
  parsedRequest: { item: string; criteria: string }[];
  cart: SmartCartItem[];
  merchants: { id: string; name: string; distance: string; prepTime: string; itemCount: number }[];
  summary: { totalItems: number; totalMerchants: number; subtotal: number; estimatedSavings: number };
  aiInsights?: string;
}

// Budget Shop types
interface BudgetShopResult {
  success: boolean;
  budget: { total: number; allocated: number; remaining: number; utilizationPercent: number };
  allocations: { item: string; allocatedBudget: number; priority: string; isPriority: boolean }[];
  selectedProducts: {
    productId: string;
    merchantId: string;
    merchantName: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    withinBudget: boolean;
    budgetImpact: string;
  }[];
  summary: { itemsFound: number; itemsRequested: number; totalSavings: number; withinBudget: boolean };
  aiAdvice?: string;
}

// Prediction types
interface PredictionResult {
  success: boolean;
  predictions: {
    productId: string;
    merchantId: string;
    merchantName: string;
    name: string;
    price: number;
    image: string;
    confidence: number;
    reason: string;
    orderFrequency?: string;
  }[];
  patterns: { type: string; description: string; confidence: number }[];
  suggestedCart: { items: any[]; estimatedTotal: number; confidence: number };
  timing: { bestTimeToOrder: string; nextPredictedOrder: string; urgency: string };
  aiInsight?: string;
}

// Map a spoken phrase ("the first one", "third", "number 3", "Cafe Verde") to a merchant.
// Order matters: explicit ordinal WORDS are checked before bare number words, so
// "the third one" picks #3 (not #1 from the filler word "one").
function parseMerchantChoice(reply: string, merchants: Merchant[]): Merchant | null {
  const t = reply.toLowerCase().trim();
  if (!t || merchants.length === 0) return null;
  const at = (i: number) => (i >= 0 && i < merchants.length ? merchants[i] : null);

  // 1) Ordinal words (first..fifth, last) — most specific.
  const ordinalWords: [RegExp, number][] = [
    [/\bfirst\b/, 0],
    [/\bsecond\b/, 1],
    [/\bthird\b/, 2],
    [/\bfourth\b/, 3],
    [/\bfifth\b/, 4],
    [/\blast\b/, merchants.length - 1],
  ];
  for (const [re, i] of ordinalWords) if (re.test(t) && at(i)) return at(i);

  // 2) Numeric forms: "3", "3rd", "number 3", "option 2".
  const digit = t.match(/\b(?:number|option|merchant)?\s*([1-9])(?:st|nd|rd|th)?\b/);
  if (digit) {
    const m = at(parseInt(digit[1], 10) - 1);
    if (m) return m;
  }

  // 3) Spelled-out numbers as a fallback (only reached if no ordinal word matched).
  const numWords: Record<string, number> = { one: 0, two: 1, three: 2, four: 3, five: 4 };
  for (const [w, i] of Object.entries(numWords)) if (new RegExp(`\\b${w}\\b`).test(t) && at(i)) return at(i);

  // 4) Match by merchant name (full name or a distinctive word).
  return (
    merchants.find((m) => {
      const name = m.name.toLowerCase();
      return t.includes(name) || name.split(/\s+/).some((w) => w.length > 3 && t.includes(w));
    }) || null
  );
}

// Hard, instant stop words (everything softer is judged by the concierge so it
// can reply with a warm goodbye).
function isStopCommand(text: string): boolean {
  return /\b(stop|cancel|exit|quit|turn off)\b/.test(text.toLowerCase());
}

async function collectConfirmedCookingInstructions(
  askQuestion: (prompt: string) => Promise<string>,
  speakResponse: (message: string) => Promise<void>
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await askQuestion(
      attempt === 0
        ? 'Any cooking instructions for the restaurant? Say them now, or say no instructions.'
        : 'Please tell me the cooking instructions again, or say no instructions.'
    );
    const instructions = response?.trim() || '';
    if (!instructions || /^(no|none|no instructions|nothing|no thanks|no,?\s+thanks)$/i.test(instructions)) {
      return '';
    }

    await speakResponse(`I heard: ${instructions}. Is that correct?`);
    const confirmed = interpretYesNo(await askQuestion('Please say yes to confirm, or no to repeat the instructions.'));
    if (confirmed === 'yes') return instructions;
  }

  await speakResponse("I couldn't confirm the cooking instructions, so I haven't added any. You can add them before checkout.");
  return null;
}

const GOODBYES = [
  'Anytime! It was a pleasure helping you. Talk soon!',
  'Happy to help — have a wonderful day!',
  'You got it. Catch you later!',
  'Glad I could help. Take care!',
];
const pickGoodbye = () => GOODBYES[Math.floor(Math.random() * GOODBYES.length)];

// API Functions
async function discoverMerchants(
  query: string,
  maxDistance?: number
): Promise<{ merchants: Merchant[]; message: string; spoken?: string; clarifyingQuestion?: string }> {
  const response = await fetch('/api/agents/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxDistance }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.results;
}

async function requestReceipt(payload: {
  merchantName: string;
  items: { name: string; quantity: number }[];
  total: number;
  pointsEarned: number;
  estimatedReady: string;
}): Promise<string> {
  try {
    const response = await fetch('/api/agents/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data.success ? data.summary : '';
  } catch {
    return '';
  }
}

interface InventoryResult {
  products: Product[];
  message: string;
  spoken?: string;
  exactMatchFound?: boolean;
  hasAlternatives?: boolean;
  alternativeMessage?: string;
  alternatives?: { productId: string; originalRequest: string; reason: string }[];
}

async function fetchInventory(
  merchantId: string,
  query: string
): Promise<InventoryResult> {
  const response = await fetch('/api/agents/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId, query }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.results;
}

async function fetchAddresses(): Promise<Address[]> {
  const response = await fetch('/api/addresses');
  const data = await response.json();
  if (!data.success) return [];
  return data.addresses;
}

interface PaymentResult {
  order: {
    orderId: string;
    merchantId: string;
    merchantName: string;
    merchantAddress: string;
    items: Array<{ productId: string; name: string; price: number; quantity: number; total: number; cookingInstructions?: string }>;
    cookingInstructions?: string;
    pricing: {
      subtotal: number;
      serviceFee: number;
      deliveryFee: number;
      tax: number;
      loyaltyDiscount: number;
      total: number;
    };
    status: string;
    estimatedReady: string;
  };
  payment: {
    token: string;
    method: string;
    status: string;
    cardBrand?: string;
    last4?: string;
    upiApp?: string;
    walletType?: string;
    tokenized?: boolean;
  };
  loyalty: {
    pointsEarned: number;
    message: string;
  };
}

async function processPayment(
  merchantId: string,
  items: { productId: string; quantity: number; name?: string; price?: number }[],
  paymentMethod: 'card' | 'upi' | 'wallet' | 'cod',
  deliveryAddress: string,
  cookingInstructions = ''
): Promise<PaymentResult> {
  const session = await getAuthenticatedSession('customer');
  if (!session) throw new Error('Sign in with a customer account to place an order.');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };
  const response = await fetch(`${backendUrl}/payments/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ merchantId, items, paymentMethod, deliveryAddress, cookingInstructions }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.error || 'Could not start checkout.');
  }
  if (!data.order) throw new Error('The order service returned an invalid response.');
  return data as PaymentResult;
}

// Smart Cart API
async function fetchSmartCart(query: string): Promise<SmartCartResult> {
  const response = await fetch('/api/agents/smart-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, optimizeFor: 'balanced' }),
  });
  return response.json();
}

// Budget Shop API
async function fetchBudgetShop(budget: number, items: string[], priorities: string[] = []): Promise<BudgetShopResult> {
  const response = await fetch('/api/agents/budget-shop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ budget, items, priorities, flexibility: 'flexible' }),
  });
  return response.json();
}

// Predictions API
async function fetchPredictions(orderHistory: any[]): Promise<PredictionResult> {
  const response = await fetch('/api/agents/predict-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderHistory }),
  });
  return response.json();
}

export default function CartPilotClient() {
  const [flowStep, setFlowStep] = useState<FlowStep>('input');
  const [userQuery, setUserQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [proposal, setProposal] = useState<AIProposal | null>(null);
  const [orderResult, setOrderResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allMerchants, setAllMerchants] = useState<Merchant[]>([]);
  const [showMerchantSelector, setShowMerchantSelector] = useState(false);

  // Voice agent
  const {
    supported: voiceSupported,
    ttsSupported,
    sttSupported,
    listening,
    speaking,
    micError,
    interim,
    clearMicError,
    getMicError,
    prepareMicrophone,
    unlockAudio,
    speak,
    stopSpeaking,
    listen,
    stopListening,
    askAndListen,
  } = useVoice();
  const [diag, setDiag] = useState<string>('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [clarifyAsked, setClarifyAsked] = useState(false);
  const [voiceMerchants, setVoiceMerchants] = useState<Merchant[]>([]);
  const [voiceCaption, setVoiceCaption] = useState('');
  const [assistantActive, setAssistantActive] = useState(false); // continuous mode on/off
  const assistantActiveRef = useRef(false);

  // Geolocation / radius
  const [maxDistance, setMaxDistance] = useState(5);
  const [located, setLocated] = useState(false);
  const [locating, setLocating] = useState(false);

  // Personalization + AI receipt
  const [usual, setUsual] = useState<{ label: string; query: string } | null>(null);
  const [receiptSummary, setReceiptSummary] = useState<string>('');

  // New AI Features state
  const [smartCartResult, setSmartCartResult] = useState<SmartCartResult | null>(null);
  const [budgetShopResult, setBudgetShopResult] = useState<BudgetShopResult | null>(null);
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [budgetInput, setBudgetInput] = useState<number>(1000);
  const [budgetItems, setBudgetItems] = useState<string>('');
  const [showSmartCartInput, setShowSmartCartInput] = useState(false);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  // Alternative product state
  const [hasAlternatives, setHasAlternatives] = useState(false);
  const [alternativeMessage, setAlternativeMessage] = useState('');

  // AI Feature mode selection
  type AIMode = 'standard' | 'smart-cart' | 'budget-shop' | 'predictions';
  const [selectedAIMode, setSelectedAIMode] = useState<AIMode>('standard');

  // Payment method selection
  type PaymentMethod = 'card' | 'upi' | 'wallet' | 'cod';
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('upi');

  // Live streamed agent narration (shown during the "thinking" phase)
  const [narration, setNarration] = useState('');

  const streamNarration = async (query: string) => {
    setNarration('');
    try {
      const res = await fetch('/api/agents/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setNarration((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      /* narration is best-effort */
    }
  };

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([
    { id: '1', title: 'Understanding Your Request', description: 'Analyzing what you need', status: 'pending' },
    { id: '2', title: 'Finding Best Merchant', description: 'Matching your preferences', status: 'pending' },
    { id: '3', title: 'Selecting Products', description: 'Picking the best items', status: 'pending' },
    { id: '4', title: 'Preparing Order', description: 'Ready for your confirmation', status: 'pending' },
  ]);

  useEffect(() => {
    loadAddresses();
    loadUsual();
  }, []);

  const loadAddresses = async () => {
    const addrs = await fetchAddresses();
    setAddresses(addrs);
  };

  // Personalization: derive "your usual" from the most recent past order.
  const loadUsual = async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      const data = await res.json();
      const orders = data?.orders || [];
      setOrderHistory(orders);
      const last = orders[0];
      if (last?.items?.length) {
        const itemNames = last.items.map((i: { name: string }) => i.name).join(', ');
        setUsual({
          label: `Your usual: ${itemNames} from ${last.merchantName}`,
          query: `Order my usual: ${itemNames} from ${last.merchantName}`,
        });
      }
    } catch {
      /* no history yet — fine */
    }
  };

  // Smart Cart handler
  const handleSmartCart = async (query: string) => {
    if (!query.trim()) return;
    setFlowStep('thinking');
    setError(null);
    void streamNarration(query);
    try {
      const result = await fetchSmartCart(query);
      if (result.success && result.cart.length > 0) {
        setSmartCartResult(result);
        setFlowStep('smart-cart');
      } else {
        setError('Could not find products for your request');
        setFlowStep('input');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smart cart failed');
      setFlowStep('input');
    }
  };

  // Budget Shop handler
  const handleBudgetShop = async () => {
    const items = budgetItems.split(',').map(s => s.trim()).filter(Boolean);
    if (items.length === 0 || budgetInput <= 0) {
      setError('Please enter budget and items');
      return;
    }
    setFlowStep('thinking');
    setError(null);
    setShowBudgetInput(false);
    void streamNarration(`Budget shopping: $${budgetInput} for ${items.join(', ')}`);
    try {
      const result = await fetchBudgetShop(budgetInput, items);
      if (result.success) {
        setBudgetShopResult(result);
        setFlowStep('budget-shop');
      } else {
        setError('Budget shopping failed');
        setFlowStep('input');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Budget shop failed');
      setFlowStep('input');
    }
  };

  // Predictions handler
  const handlePredictions = async () => {
    setFlowStep('thinking');
    setError(null);
    void streamNarration('Analyzing your order history for predictions...');
    try {
      // Transform order history for API
      const historyForApi = orderHistory.slice(0, 20).map(order => ({
        orderId: order.id,
        merchantId: order.merchantId,
        items: order.items?.map((i: any) => ({ productId: i.productId, name: i.name, quantity: i.quantity })) || [],
        total: order.pricing?.total || 0,
        timestamp: order.createdAt || new Date().toISOString(),
      }));
      const result = await fetchPredictions(historyForApi);
      if (result.success) {
        setPredictionResult(result);
        setFlowStep('predictions');
      } else {
        setError('Predictions failed');
        setFlowStep('input');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Predictions failed');
      setFlowStep('input');
    }
  };

  // Checkout from Smart Cart - processes multiple merchant orders
  const handleSmartCartCheckout = async () => {
    if (!smartCartResult || smartCartResult.cart.length === 0) {
      setError('No items in cart');
      return;
    }

    setFlowStep('processing');
    setError(null);

    try {
      // Group items by merchant
      const merchantGroups = new Map<string, typeof smartCartResult.cart>();
      for (const item of smartCartResult.cart) {
        const existing = merchantGroups.get(item.merchantId) || [];
        existing.push(item);
        merchantGroups.set(item.merchantId, existing);
      }

      // Process payment for each merchant
      const results: PaymentResult[] = [];
      const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
      for (const [merchantId, items] of merchantGroups) {
        const paymentResult = await processPayment(
          merchantId,
          items.map(i => ({ productId: i.productId, quantity: i.quantity || 1, name: i.name, price: i.price })),
          selectedPaymentMethod,
          formatDeliveryAddress(defaultAddress)
        );
        results.push(paymentResult);
      }

      // Show confirmation with first order result
      if (results.length > 0) {
        setOrderResult(results[0]);
        setFlowStep('confirmed');
      } else {
        setError('No orders created');
        setFlowStep('smart-cart');
      }
    } catch (err) {
      console.error('Smart Cart Checkout Error:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setFlowStep('smart-cart');
    }
  };

  // Checkout from Budget Shop
  const handleBudgetShopCheckout = async () => {
    if (!budgetShopResult || budgetShopResult.selectedProducts.length === 0) {
      setError('No items selected');
      return;
    }

    setFlowStep('processing');
    setError(null);

    try {
      // Group items by merchant
      const merchantGroups = new Map<string, typeof budgetShopResult.selectedProducts>();
      for (const item of budgetShopResult.selectedProducts) {
        const existing = merchantGroups.get(item.merchantId) || [];
        existing.push(item);
        merchantGroups.set(item.merchantId, existing);
      }

      // Process payment for each merchant
      const results: PaymentResult[] = [];
      const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
      for (const [merchantId, items] of merchantGroups) {
        const paymentResult = await processPayment(
          merchantId,
          items.map(i => ({ productId: i.productId, quantity: i.quantity || 1, name: i.name, price: i.price })),
          selectedPaymentMethod,
          formatDeliveryAddress(defaultAddress)
        );
        results.push(paymentResult);
      }

      // Show confirmation
      if (results.length > 0) {
        setOrderResult(results[0]);
        setFlowStep('confirmed');
      } else {
        setError('No orders created');
        setFlowStep('budget-shop');
      }
    } catch (err) {
      console.error('Budget Shop Checkout Error:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setFlowStep('budget-shop');
    }
  };

  // Checkout from Predictions - add predicted items to cart
  const handlePredictionCheckout = async () => {
    if (!predictionResult || predictionResult.suggestedCart.items.length === 0) {
      setError('No suggested items');
      return;
    }

    setFlowStep('processing');
    setError(null);

    try {
      // Group by merchant
      const merchantGroups = new Map<string, typeof predictionResult.predictions>();
      for (const item of predictionResult.suggestedCart.items) {
        const existing = merchantGroups.get(item.merchantId) || [];
        existing.push(item);
        merchantGroups.set(item.merchantId, existing);
      }

      const results: PaymentResult[] = [];
      const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
      for (const [merchantId, items] of merchantGroups) {
        const paymentResult = await processPayment(
          merchantId,
          items.map(i => ({ productId: i.productId, quantity: 1, name: i.name, price: i.price })),
          selectedPaymentMethod,
          formatDeliveryAddress(defaultAddress)
        );
        results.push(paymentResult);
      }

      if (results.length > 0) {
        setOrderResult(results[0]);
        setFlowStep('confirmed');
      } else {
        setError('No orders created');
        setFlowStep('predictions');
      }
    } catch (err) {
      console.error('Prediction Checkout Error:', err);
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setFlowStep('predictions');
    }
  };

  // Geolocation: ask for the browser location to scope discovery to a radius.
  const handleLocate = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocated(true); // still allow the radius filter without coords
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocated(true);
        setLocating(false);
      },
      () => {
        setLocated(true); // permission denied — keep the radius filter usable anyway
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const updateStepStatus = (stepId: string, status: AgentStep['status'], details?: string[]) => {
    setAgentSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, status, details, timestamp: new Date().toLocaleTimeString() }
        : step
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && selectedAIMode !== 'predictions') return;

    const query = inputValue;
    setInputValue('');

    // Route to appropriate handler based on selected mode
    switch (selectedAIMode) {
      case 'smart-cart':
        await handleSmartCart(query);
        break;
      case 'budget-shop':
        await handleBudgetShop();
        break;
      case 'predictions':
        await handlePredictions();
        break;
      default:
        await runAgent(query);
    }
  };

  const runAgent = async (query: string) => {
    if (!query.trim()) return;

    setUserQuery(query);
    setFlowStep('thinking');
    setError(null);

    // Stream the agent's live narration alongside the real work.
    void streamNarration(query);

    // Reset steps
    setAgentSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const, details: undefined, timestamp: undefined })));

    try {
      // Step 1: Understanding Request
      updateStepStatus('1', 'active');
      await new Promise(r => setTimeout(r, 600));
      updateStepStatus('1', 'completed', [`"${query}"`, 'Intent: Order Request']);

      // Step 2: Finding Best Merchant
      updateStepStatus('2', 'active');
      const discoverResult = await discoverMerchants(query, located ? maxDistance : undefined);
      setAllMerchants(discoverResult.merchants);

      // Voice clarifying-question loop: if the agent needs more info, ask it aloud
      // and fold the spoken answer back into the request (once per session).
      if (voiceMode && voiceSupported && discoverResult.clarifyingQuestion && !clarifyAsked) {
        setClarifyAsked(true);
        updateStepStatus('2', 'active', [`Asking: ${discoverResult.clarifyingQuestion}`]);
        const answer = await askAndListen(discoverResult.clarifyingQuestion);
        if (answer) {
          await runAgent(`${query}. ${answer}`);
          return;
        }
      }

      if (discoverResult.merchants.length === 0) {
        throw new Error('No merchants found for your request');
      }

      // AI selects best merchant (highest rating, closest distance)
      const bestMerchant = discoverResult.merchants[0];
      updateStepStatus('2', 'completed', [
        `Selected: ${bestMerchant.name}`,
        `Rating: ${bestMerchant.rating}★ | ${bestMerchant.distance}`
      ]);

      // Step 3: Selecting Products
      updateStepStatus('3', 'active');
      const inventoryResult = await fetchInventory(bestMerchant.id, query);
      setAllProducts(inventoryResult.products);

      if (inventoryResult.products.length === 0) {
        throw new Error('No matching products found');
      }

      // Check if we got alternatives instead of exact matches
      const isAlternative = inventoryResult.hasAlternatives && !inventoryResult.exactMatchFound;
      setHasAlternatives(isAlternative || false);
      setAlternativeMessage(inventoryResult.alternativeMessage || '');

      // AI auto-selects relevant products (top matches)
      const selectedProducts: CartItem[] = inventoryResult.products.slice(0, 2).map(p => ({
        ...p,
        selectedQuantity: 1
      }));

      // Show appropriate message based on whether it's exact match or alternative
      if (isAlternative) {
        updateStepStatus('3', 'completed', [
          `⚠️ Exact item not available`,
          `Alternative found: ${selectedProducts.map(p => p.name).join(', ')}`,
        ]);
      } else {
        updateStepStatus('3', 'completed', [
          `Auto-selected ${selectedProducts.length} items`,
          ...selectedProducts.map(p => `• ${p.name}`)
        ]);
      }

      // Step 4: Preparing Order
      updateStepStatus('4', 'active');
      await new Promise(r => setTimeout(r, 400));

      // Get default address
      const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
      if (!defaultAddress) {
        throw new Error('No saved address found. Please add an address first.');
      }

      // Calculate pricing
      const subtotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
      const serviceFee = subtotal * 0.05;
      const deliveryFee = 2.99;
      const tax = subtotal * 0.0875;
      const total = subtotal + serviceFee + deliveryFee + tax;

      // Create AI proposal
      const aiProposal: AIProposal = {
        merchant: bestMerchant,
        items: selectedProducts,
        address: defaultAddress,
        pricing: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          serviceFee: parseFloat(serviceFee.toFixed(2)),
          deliveryFee: parseFloat(deliveryFee.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
        },
        reasoning:
          [discoverResult.spoken, inventoryResult.spoken].filter(Boolean).join(' ') ||
          `Based on your request "${query}", I found ${bestMerchant.name} which has ${bestMerchant.offers[0]}. I've selected ${selectedProducts.length} item${selectedProducts.length > 1 ? 's' : ''} that match what you're looking for.`,
        hasAlternatives: isAlternative,
        alternativeMessage: inventoryResult.alternativeMessage,
      };

      setProposal(aiProposal);
      updateStepStatus('4', 'completed', ['Order ready for confirmation!']);
      setFlowStep('proposal');

      // Voice: read the proposal aloud and ask for spoken confirmation.
      if (voiceMode && voiceSupported) {
        void runVoiceConfirm(aiProposal);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setError(errorMsg);
      updateStepStatus(
        agentSteps.find(s => s.status === 'active')?.id || '1',
        'error',
        [errorMsg]
      );
      setFlowStep('input');
    }
  };

  // ---- Shared pricing + proposal builders (used by text and voice flows) ----
  const computePricing = (items: CartItem[]): AIProposal['pricing'] => {
    const subtotal = items.reduce((sum, p) => sum + p.price * p.selectedQuantity, 0);
    const serviceFee = subtotal * 0.05;
    const deliveryFee = 2.99;
    const tax = subtotal * 0.0875;
    const total = subtotal + serviceFee + deliveryFee + tax;
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      serviceFee: parseFloat(serviceFee.toFixed(2)),
      deliveryFee: parseFloat(deliveryFee.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  };

  const buildProposal = async (merchant: Merchant, query: string): Promise<AIProposal | null> => {
    const inventoryResult = await fetchInventory(merchant.id, query);
    setAllProducts(inventoryResult.products);
    if (inventoryResult.products.length === 0) return null;

    const selectedProducts: CartItem[] = inventoryResult.products.slice(0, 2).map((p) => ({
      ...p,
      selectedQuantity: 1,
    }));
    const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0];
    if (!defaultAddress) return null;

    const proposal: AIProposal = {
      merchant,
      items: selectedProducts,
      address: defaultAddress,
      pricing: computePricing(selectedProducts),
      reasoning:
        inventoryResult.spoken ||
        `${merchant.name}: I've selected ${selectedProducts.length} item${selectedProducts.length > 1 ? 's' : ''} for you.`,
      hasAlternatives: inventoryResult.hasAlternatives && !inventoryResult.exactMatchFound,
      alternativeMessage: inventoryResult.alternativeMessage,
    };
    setHasAlternatives(proposal.hasAlternatives || false);
    setAlternativeMessage(proposal.alternativeMessage || '');
    setProposal(proposal);
    return proposal;
  };

  // Manual pick from the "choosing" list (clicking a merchant card).
  const chooseMerchantFromList = async (merchant: Merchant) => {
    if (assistantActiveRef.current) return; // assistant is driving by voice
    setFlowStep('thinking');
    const proposal = await buildProposal(merchant, userQuery);
    if (!proposal) {
      setError('No matching products at that merchant.');
      setFlowStep('choosing');
      return;
    }
    setFlowStep('proposal');
    if (voiceMode && voiceSupported) void runVoiceConfirm(proposal);
  };

  // ---- Voice helpers (caption + speak/listen) ----
  const say = async (text: string) => {
    setVoiceCaption('🔊 ' + text);
    await speak(text);
  };
  const ask = async (text: string, timeout = 12000) => {
    setVoiceCaption('🔊 ' + text);
    const r = await askAndListen(text, timeout);
    setVoiceCaption(r ? '🗣️ "' + r + '"' : '…(didn\'t catch that — say it again)');
    return r;
  };

  // Stop the continuous assistant.
  const stopAssistant = () => {
    assistantActiveRef.current = false;
    setAssistantActive(false);
    stopSpeaking();
    stopListening();
    setVoiceCaption('');
  };

  // Ask the concierge brain what the user meant (chat / order / stop).
  const classifyIntent = async (
    message: string
  ): Promise<{ intent: string; reply: string; orderQuery: string }> => {
    try {
      const res = await fetch('/api/agents/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      return { intent: data.intent || 'chat', reply: data.reply || '', orderQuery: data.orderQuery || message };
    } catch {
      return { intent: 'order', reply: '', orderQuery: message }; // safe default
    }
  };

  // One full order turn: request -> discover -> choose -> confirm -> checkout.
  // Returns false if it couldn't complete (so the loop can re-prompt).
  const processVoiceOrder = async (request: string): Promise<boolean> => {
    setUserQuery(request);
    setInputValue(request);
    try {
    // Reset agent steps
    setAgentSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const, details: undefined, timestamp: undefined })));

    // Step 1: Understand request
    updateStepStatus('1', 'active');
    setFlowStep('thinking');
    void streamNarration(request);
    updateStepStatus('1', 'completed', [`"${request}"`, 'Intent: Order Request']);

    // Step 2: Discover nearby merchants
    updateStepStatus('2', 'active');
    const discoverResult = await discoverMerchants(request, located ? maxDistance : undefined);
    if (!assistantActiveRef.current) return false;
    const merchants = discoverResult.merchants;
    if (!merchants.length) {
      await say("Sorry, I couldn't find anything for that nearby.");
      setFlowStep('input');
      return false;
    }
    setVoiceMerchants(merchants);
    setAllMerchants(merchants);
    setFlowStep('choosing');

    // Choose by voice
    let chosen: Merchant = merchants[0];
    if (merchants.length === 1) {
      await say(`I found ${chosen.name} nearby. Setting that up.`);
    } else {
      // Names/numbers are on the numbered on-screen list, so we DON'T speak them
      // (the mic could otherwise mistake the assistant's voice for your answer).
      const choice = await ask(`I found ${merchants.length} options, shown on screen. Which would you like?`);
      if (!assistantActiveRef.current) return false;
      if (isStopCommand(choice)) { stopAssistant(); return false; }
      let pick = parseMerchantChoice(choice, merchants);
      if (!pick) {
        const retry = await ask('Which would you like? Tell me the number, or the name.');
        if (!assistantActiveRef.current) return false;
        pick = parseMerchantChoice(retry, merchants) ?? merchants[0];
      }
      chosen = pick;
    }
    if (!assistantActiveRef.current) return false;

    // Step 2 completed - merchant chosen
    updateStepStatus('2', 'completed', [`Selected: ${chosen.name}`, `${merchants.length} option${merchants.length > 1 ? 's' : ''} found`]);

    // Step 3: Build the order (Inventory)
    updateStepStatus('3', 'active');
    setFlowStep('thinking');
    const proposal = await buildProposal(chosen, request);
    if (!assistantActiveRef.current) return false;
    if (!proposal) {
      await say(`Sorry, ${chosen.name} has nothing matching that.`);
      updateStepStatus('3', 'error', [`No matching products at ${chosen.name}`]);
      setFlowStep('input');
      return false;
    }
    if (proposal.hasAlternatives && proposal.alternativeMessage) {
      const alternativeDecision = interpretYesNo(await ask(proposal.alternativeMessage));
      if (!assistantActiveRef.current) return false;
      if (alternativeDecision !== 'yes') {
        await say("Okay, I won't add those alternatives. Tell me what you'd like to order instead.");
        setFlowStep('input');
        return false;
      }
    }
    updateStepStatus('3', 'completed', [`${proposal.items.length} item${proposal.items.length > 1 ? 's' : ''} selected`, `Total: $${proposal.pricing.total.toFixed(2)}`]);
    setFlowStep('proposal');
    setProposal(proposal);

    // Allow item modifications
    let currentProposal = proposal;
    let itemList = currentProposal.items.map((i) => i.name).join(' and ');

    let response = await ask(
      `I'll get ${itemList} from ${chosen.name}. That's ${currentProposal.pricing.total.toFixed(0)} dollars. Would you like to remove anything, or proceed to payment?`
    );
    if (!assistantActiveRef.current) return false;

    // Handle item removal loop
    let continueLoop = true;
    while (continueLoop && response) {
      const itemToRemove = parseRemoveCommand(response, currentProposal.items);

      if (itemToRemove) {
        // Remove the item
        const updatedItems = currentProposal.items.filter(item => item.id !== itemToRemove.id);
        if (updatedItems.length === 0) {
          await say("That would empty your cart. Let me start over.");
          setFlowStep('input');
          return false;
        }

        // Recalculate pricing
        const subtotal = updatedItems.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
        const serviceFee = subtotal * 0.05;
        const deliveryFee = 2.99;
        const tax = subtotal * 0.0875;
        const total = subtotal + serviceFee + deliveryFee + tax;

        currentProposal = {
          ...currentProposal,
          items: updatedItems,
          pricing: {
            subtotal: parseFloat(subtotal.toFixed(2)),
            serviceFee: parseFloat(serviceFee.toFixed(2)),
            deliveryFee: parseFloat(deliveryFee.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
          }
        };
        setProposal(currentProposal);

        itemList = currentProposal.items.map(i => i.name).join(' and ');
        response = await ask(
          `Done! I removed ${itemToRemove.name}. Your cart now has ${itemList} for ${currentProposal.pricing.total.toFixed(0)} dollars. Anything else to remove, or proceed to payment?`
        );
        if (!assistantActiveRef.current) return false;
      } else {
        // Check if user wants to proceed
        const decision = interpretYesNo(response);
        if (decision === 'yes' || response.toLowerCase().includes('proceed') || response.toLowerCase().includes('pay') || response.toLowerCase().includes('confirm')) {
          continueLoop = false;
        } else if (decision === 'no') {
          await say("Okay, I won't place that order.");
          setFlowStep('input');
          return false;
        } else {
          response = await ask("Say 'remove' and the item name, or say 'proceed' to continue to payment.");
          if (!assistantActiveRef.current) return false;
        }
      }
    }

    const cookingInstructions = await collectConfirmedCookingInstructions(
      (prompt) => ask(prompt),
      say
    );
    if (cookingInstructions === null || !assistantActiveRef.current) {
      setFlowStep('input');
      return false;
    }
    if (!assistantActiveRef.current) return false;

    // Ask for payment method
    let paymentResponse = await ask(
      'Choose UPI, Card, Wallet, or Cash on Delivery.'
    );
    if (!assistantActiveRef.current) return false;

    let chosenPaymentMethod: PaymentMethod = 'upi';

    if (paymentResponse) {
      const parsedMethod = parsePaymentMethod(paymentResponse);
      if (parsedMethod) {
        chosenPaymentMethod = parsedMethod;
        setSelectedPaymentMethod(parsedMethod);
      } else {
        await say('UPI is selected.');
      }
    }

    const methodName = chosenPaymentMethod === 'upi' ? 'UPI' :
                      chosenPaymentMethod === 'card' ? 'Card' :
                      chosenPaymentMethod === 'wallet' ? 'Wallet' : 'Cash on Delivery';

    // Final confirmation
    await say(`${methodName} is selected as your mode of payment.`);
    const finalConfirm = await ask(
      `Your order total is ${currentProposal.pricing.total.toFixed(0)} dollars. Shall I place the order?`
    );
    if (!assistantActiveRef.current) return false;

    let finalDecision = interpretYesNo(finalConfirm);
    if (finalDecision === 'unknown') {
      finalDecision = interpretYesNo(await ask('Say yes to place it, or no to cancel.'));
    }
    if (finalDecision !== 'yes') {
      await say("Okay, I won't place that order.");
      setFlowStep('input');
      return false;
    }

    // Step 4: Process payment
    updateStepStatus('4', 'active');
    setVoiceCaption('🔊 Placing your order…');
    const orderConfirmed = await handleConfirmOrder(currentProposal, chosenPaymentMethod, cookingInstructions);
    if (!orderConfirmed) {
      updateStepStatus('4', 'error', ['Order could not be confirmed.']);
      return false;
    }
    updateStepStatus('4', 'completed', [
      'Order confirmed!',
    ]);
    return true;
    } catch {
      setError('Something went wrong. Please try again.');
      await say("Sorry, something went wrong. Let's try that again.");
      setFlowStep('input');
      return false;
    }
  };

  // ---- Continuous, hands-free assistant: stays on until you Stop ----
  const startAssistant = async () => {
    if (!voiceSupported) return;
    if (assistantActiveRef.current) return; // already running
    unlockAudio(); // must run synchronously in the click gesture to enable speech
    clearMicError();
    setVoiceMode(true);
    setError(null);
    setReceiptSummary('');
    setProposal(null);
    assistantActiveRef.current = true;
    setAssistantActive(true);

    try {
      if (!(await prepareMicrophone())) {
        stopAssistant();
        return;
      }
      if (!assistantActiveRef.current) { stopListening(); return; }
      let firstTurn = true;

      while (assistantActiveRef.current) {
        // Listen for a request, re-arming the mic on silence (up to 3 times).
        let request = '';
        let empties = 0;
        while (assistantActiveRef.current && !request) {
          const prompt = firstTurn ? 'Hi! What would you like?' : 'Anything else?';
          firstTurn = false;
          request = await ask(prompt);
          if (!assistantActiveRef.current) break;
          if (!request) {
            const currentMicError = getMicError();
            if (currentMicError === 'not-allowed' || currentMicError === 'service-not-allowed') {
              await say(
                currentMicError === 'not-allowed'
                  ? 'Please allow microphone access in your browser website settings, then start me again.'
                  : 'Speech recognition is unavailable in this browser. Open this page in Safari on iPhone, or try typing your request.'
              );
              stopAssistant();
              return;
            }
            empties += 1;
            if (empties >= 3) {
              await say("I'll pause for now. Tap start when you're ready.");
              stopAssistant();
              return;
            }
          }
        }
        if (!assistantActiveRef.current) break;

        // Instant hard-stop words.
        if (isStopCommand(request)) {
          await say(pickGoodbye());
          break;
        }

        // Otherwise let the concierge decide: chat, order, or wrap up.
        const { intent, reply, orderQuery } = await classifyIntent(request);
        if (!assistantActiveRef.current) break;

        if (intent === 'stop') {
          await say(reply || pickGoodbye());
          break;
        }
        if (intent === 'chat') {
          setFlowStep('input');
          await say(reply || "I can help you order from nearby places — what would you like?");
          continue; // keep listening
        }
        // intent === 'order'
        if (reply) await say(reply);
        await processVoiceOrder(orderQuery || request);
        // Loop continues -> assistant asks "Anything else?" and keeps listening.
      }
    } finally {
      stopAssistant();
    }
  };

  const handleConfirmOrder = async (
    p: AIProposal | null = proposal,
    overridePaymentMethod?: PaymentMethod,
    overrideCookingInstructions = ''
  ): Promise<boolean> => {
    if (!p) return false;

    setFlowStep('processing');

    // Use override if provided (for voice flow), otherwise use state
    const paymentMethodToUse = overridePaymentMethod || selectedPaymentMethod;

    try {
      const items = p.items.map(item => ({ productId: item.id, quantity: item.selectedQuantity }));
      const paymentResult = await processPayment(
        p.merchant.id,
        items,
        paymentMethodToUse,
        formatDeliveryAddress(p.address),
        overrideCookingInstructions
      );
      setOrderResult(paymentResult);
      setFlowStep('confirmed');

      // AI-generated receipt summary shown on screen.
      const summary = await requestReceipt({
        merchantName: p.merchant.name,
        items: p.items.map((i) => ({ name: i.name, quantity: i.selectedQuantity })),
        total: paymentResult.order.pricing.total,
        pointsEarned: paymentResult.loyalty.pointsEarned,
        estimatedReady: paymentResult.order.estimatedReady,
      });
      setReceiptSummary(summary);

      // Voice: speak a very concise confirmation (not the full receipt).
      if (voiceMode && voiceSupported) {
        const concise = `Your order was placed successfully at ${p.merchant.name}. The total is ${paymentResult.order.pricing.total.toFixed(0)} dollars, ready in ${paymentResult.order.estimatedReady}.`;
        setVoiceCaption('🔊 ' + concise);
        await speak(concise);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : paymentMethodToUse === 'card' ? 'Payment failed' : 'Could not place the order.');
      setFlowStep('proposal');
      return false;
    }
  };

  // Parse voice commands for removing items from cart
  const parseRemoveCommand = (text: string, items: CartItem[]): CartItem | null => {
    const t = text.toLowerCase();
    // Check for remove keywords
    const removeKeywords = ['remove', 'delete', 'take out', 'no ', 'without', 'cancel', 'drop', 'exclude'];
    const hasRemoveIntent = removeKeywords.some(k => t.includes(k));
    if (!hasRemoveIntent) return null;

    // Find which item to remove
    for (const item of items) {
      const itemName = item.name.toLowerCase();
      const words = itemName.split(/\s+/);
      // Match full name or distinctive words
      if (t.includes(itemName) || words.some(w => w.length > 3 && t.includes(w))) {
        return item;
      }
    }
    return null;
  };

  // Parse voice commands for payment method selection
  const parsePaymentMethod = (text: string): PaymentMethod | null => {
    const t = text.toLowerCase();
    if (t.includes('upi') || t.includes('google pay') || t.includes('gpay') || t.includes('paytm') || t.includes('phonepe') || t.includes('phone pe')) {
      return 'upi';
    }
    if (t.includes('card') || t.includes('credit') || t.includes('debit') || t.includes('visa') || t.includes('mastercard')) {
      return 'card';
    }
    if (t.includes('wallet') || t.includes('balance')) {
      return 'wallet';
    }
    if (t.includes('cash') || t.includes('cod') || t.includes('delivery') || t.includes('pay later')) {
      return 'cod';
    }
    return null;
  };

  // Remove item from proposal by voice
  const removeItemFromProposal = (itemToRemove: CartItem) => {
    if (!proposal) return null;

    const updatedItems = proposal.items.filter(item => item.id !== itemToRemove.id);
    if (updatedItems.length === 0) return null;

    const subtotal = updatedItems.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
    const serviceFee = subtotal * 0.05;
    const deliveryFee = 2.99;
    const tax = subtotal * 0.0875;
    const total = subtotal + serviceFee + deliveryFee + tax;

    const newProposal: AIProposal = {
      ...proposal,
      items: updatedItems,
      pricing: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        serviceFee: parseFloat(serviceFee.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
      }
    };

    setProposal(newProposal);
    return newProposal;
  };

  // Speak the proposal aloud, handle modifications, ask for payment method, then confirm.
  const runVoiceConfirm = async (p: AIProposal) => {
    let currentProposal = p;

    if (p.hasAlternatives && p.alternativeMessage) {
      const answer = interpretYesNo(await askAndListen(p.alternativeMessage));
      if (answer !== 'yes') {
        await speak("Okay, I won't add those alternatives. Tell me what you'd like to order instead.");
        setFlowStep('input');
        return;
      }
    }

    // List items and ask for confirmation or modifications
    const itemsList = currentProposal.items.map(i => i.name).join(' and ');
    const summary = `${p.reasoning} I've added ${itemsList} to your cart. Your total is ${currentProposal.pricing.total.toFixed(0)} dollars. Would you like to remove anything or proceed to payment?`;

    let response = await askAndListen(summary);
    let continueLoop = true;

    // Handle item removal loop
    while (continueLoop && response) {
      const itemToRemove = parseRemoveCommand(response, currentProposal.items);

      if (itemToRemove) {
        const updatedProposal = removeItemFromProposal(itemToRemove);
        if (updatedProposal) {
          currentProposal = updatedProposal;
          const remainingItems = currentProposal.items.map(i => i.name).join(' and ');
          response = await askAndListen(
            `Done! I removed ${itemToRemove.name}. Your cart now has ${remainingItems} for ${currentProposal.pricing.total.toFixed(0)} dollars. Anything else to remove, or shall we proceed to payment?`
          );
        } else {
          await speak('That would empty your cart. Let me start over. What would you like to order?');
          return;
        }
      } else {
        // Check if user wants to proceed
        const decision = interpretYesNo(response);
        if (decision === 'yes' || response.toLowerCase().includes('proceed') || response.toLowerCase().includes('pay') || response.toLowerCase().includes('confirm') || response.toLowerCase().includes('checkout')) {
          continueLoop = false;
        } else if (decision === 'no') {
          await speak('Okay, I will hold off. You can adjust the order or ask for something else.');
          return;
        } else {
          response = await askAndListen('Sorry, I didn\'t catch that. Say remove and the item name to remove it, or say proceed to continue to payment.');
        }
      }
    }

    const cookingInstructions = await collectConfirmedCookingInstructions(
      askAndListen,
      speak
    );
    if (cookingInstructions === null) {
      setFlowStep('input');
      return;
    }

    // Ask for payment method
    let paymentQuestion = await askAndListen(
      'How would you like to pay? You can say UPI, Card, Wallet, or Cash on Delivery.'
    );

    // Retry if no response
    if (!paymentQuestion) {
      paymentQuestion = await askAndListen('Sorry, I didn\'t catch that. Choose UPI, Card, Wallet, or Cash on Delivery.');
    }

    let chosenPaymentMethod: PaymentMethod = 'upi';

    if (paymentQuestion) {
      const parsedMethod = parsePaymentMethod(paymentQuestion);
      if (parsedMethod) {
        chosenPaymentMethod = parsedMethod;
        setSelectedPaymentMethod(parsedMethod);
      } else {
        // Default to UPI if not understood.
        await speak('UPI is selected.');
      }
    } else {
      // No response, use default
      await speak('UPI is selected.');
    }

    setSelectedPaymentMethod(chosenPaymentMethod);

    const methodName = chosenPaymentMethod === 'upi' ? 'UPI' :
                      chosenPaymentMethod === 'card' ? 'Card' :
                      chosenPaymentMethod === 'wallet' ? 'Wallet' : 'Cash on Delivery';

    await speak(`${methodName} is selected as your mode of payment.`);
    const finalConfirm = interpretYesNo(
      await askAndListen(
        `Your order total is ${currentProposal.pricing.total.toFixed(0)} dollars. Shall I place the order?`
      )
    );

    if (finalConfirm === 'yes' || finalConfirm === 'unknown') {
      // If unclear, default to yes for better UX
      await speak('Perfect. Placing your order now.');
      void handleConfirmOrder(currentProposal, chosenPaymentMethod, cookingInstructions);
    } else {
      await speak('Order cancelled. Let me know when you\'re ready.');
    }
  };

  // Mic button: listen for the request, then run the agent on the transcript.
  const handleMic = async () => {
    if (!voiceSupported) return;
    unlockAudio(); // enable speech within the click gesture
    clearMicError();
    setVoiceMode(true);
    setError(null);
    setClarifyAsked(false);
    const transcript = await askAndListen('What can I get for you?');
    if (transcript) {
      setInputValue(transcript);
      await runAgent(transcript);
    }
  };

  const updateProposalItem = (productId: string, delta: number) => {
    if (!proposal) return;

    const updatedItems = proposal.items.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(0, item.selectedQuantity + delta);
        return { ...item, selectedQuantity: newQty };
      }
      return item;
    }).filter(item => item.selectedQuantity > 0);

    // Recalculate pricing
    const subtotal = updatedItems.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
    const serviceFee = subtotal * 0.05;
    const deliveryFee = 2.99;
    const tax = subtotal * 0.0875;
    const total = subtotal + serviceFee + deliveryFee + tax;

    setProposal({
      ...proposal,
      items: updatedItems,
      pricing: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        serviceFee: parseFloat(serviceFee.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
      }
    });
  };

  const addProductToProposal = (product: Product) => {
    if (!proposal) return;

    const existingItem = proposal.items.find(i => i.id === product.id);
    let updatedItems: CartItem[];

    if (existingItem) {
      updatedItems = proposal.items.map(item =>
        item.id === product.id
          ? { ...item, selectedQuantity: item.selectedQuantity + 1 }
          : item
      );
    } else {
      updatedItems = [...proposal.items, { ...product, selectedQuantity: 1 }];
    }

    // Recalculate pricing
    const subtotal = updatedItems.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
    const serviceFee = subtotal * 0.05;
    const deliveryFee = 2.99;
    const tax = subtotal * 0.0875;
    const total = subtotal + serviceFee + deliveryFee + tax;

    setProposal({
      ...proposal,
      items: updatedItems,
      pricing: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        serviceFee: parseFloat(serviceFee.toFixed(2)),
        deliveryFee: parseFloat(deliveryFee.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
      }
    });
  };

  const changeAddress = (address: Address) => {
    if (!proposal) return;
    setProposal({ ...proposal, address });
    setShowAddressSelector(false);
  };

  const changeMerchant = async (merchant: Merchant) => {
    if (!proposal) return;

    setShowMerchantSelector(false);
    setFlowStep('thinking');

    try {
      // Fetch new merchant's inventory
      updateStepStatus('3', 'active');
      const inventoryResult = await fetchInventory(merchant.id, userQuery);
      setAllProducts(inventoryResult.products);
      const isAlternative = inventoryResult.hasAlternatives && !inventoryResult.exactMatchFound;
      setHasAlternatives(isAlternative || false);
      setAlternativeMessage(inventoryResult.alternativeMessage || '');

      const selectedProducts: CartItem[] = inventoryResult.products.slice(0, 2).map(p => ({
        ...p,
        selectedQuantity: 1
      }));

      updateStepStatus('3', 'completed', [`Switched to ${merchant.name}`]);

      // Recalculate
      const subtotal = selectedProducts.reduce((sum, p) => sum + (p.price * p.selectedQuantity), 0);
      const serviceFee = subtotal * 0.05;
      const deliveryFee = 2.99;
      const tax = subtotal * 0.0875;
      const total = subtotal + serviceFee + deliveryFee + tax;

      setProposal({
        ...proposal,
        merchant,
        items: selectedProducts,
        pricing: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          serviceFee: parseFloat(serviceFee.toFixed(2)),
          deliveryFee: parseFloat(deliveryFee.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
        },
        reasoning: inventoryResult.spoken || `Switched to ${merchant.name}. ${merchant.offers[0]}`,
        hasAlternatives: isAlternative,
        alternativeMessage: inventoryResult.alternativeMessage,
      });

      setFlowStep('proposal');
    } catch (err) {
      setError('Failed to load merchant products');
      setFlowStep('proposal');
    }
  };

  const resetFlow = () => {
    setFlowStep('input');
    if (assistantActiveRef.current) stopAssistant();
    setClarifyAsked(false);
    setReceiptSummary('');
    setNarration('');
    setVoiceMerchants([]);
    setVoiceCaption('');
    setUserQuery('');
    setProposal(null);
    setOrderResult(null);
    setError(null);
    setShowAddressSelector(false);
    setShowItemEditor(false);
    setShowMerchantSelector(false);
    setSmartCartResult(null);
    setBudgetShopResult(null);
    setPredictionResult(null);
    setShowSmartCartInput(false);
    setShowBudgetInput(false);
    setHasAlternatives(false);
    setAlternativeMessage('');
    setSelectedAIMode('standard');
    setAgentSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const, details: undefined, timestamp: undefined })));
  };

  return (
    <>
      {/* Live voice caption (Siri-style assistant) */}
      {voiceSupported && (assistantActive || speaking || listening) && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9998, maxWidth: '92%',
            background: 'rgba(20,20,30,0.94)', color: '#fff',
            padding: '12px 18px', borderRadius: 30,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span className={`spinner-grow spinner-grow-sm ${listening ? 'text-danger' : 'text-info'}`}></span>
          <span style={{ fontSize: '0.95rem' }}>
            {listening
              ? (interim ? `🗣️ ${interim}` : 'Listening…')
              : (voiceCaption || 'Assistant active')}
          </span>
          {speaking && (
            <button
              onClick={stopSpeaking}
              title="Interrupt and answer"
              style={{
                border: 'none', background: '#ff7a18', color: '#fff',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap',
              }}
            >
              <i className="fas fa-microphone me-1"></i>Answer now
            </button>
          )}
          {assistantActive && (
            <button
              onClick={stopAssistant}
              style={{
                border: 'none', background: '#dc3545', color: '#fff',
                borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap',
              }}
            >
              <i className="fas fa-stop me-1"></i>Stop
            </button>
          )}
        </div>
      )}

      {/* Banner */}
      <div className="dz-bnr-inr bg-secondary overlay-black-light" style={{ backgroundImage: "url('/images/background/bg1.jpg')" }}>
        <div className="container">
          <div className="dz-bnr-inr-entry">
            <h1>Cart Pilot</h1>
            <nav aria-label="breadcrumb" className="breadcrumb-row">
              <ul className="breadcrumb">
                <li className="breadcrumb-item"><a href="/">Home</a></li>
                <li className="breadcrumb-item active">AI Checkout</li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="content-inner-1">
        <div className="container">
          <div className="row">
            {/* Left Sidebar - Agent Timeline */}
            <aside className="col-xl-4 col-lg-5">
              <div className="sticky-top" style={{ top: '100px' }}>
                <div className="account-card">
                  <div className="card-header bg-secondary text-white">
                    <h5 className="mb-0">
                      <i className="fas fa-robot me-2"></i>
                      AI Agent Working
                    </h5>
                  </div>
                  <div className="card-body p-0">
                    <div className="widget-timeline style-1">
                      <ul className="timeline">
                        {agentSteps.map((step) => (
                          <li key={step.id}>
                            <div className={`timeline-badge ${
                              step.status === 'completed' ? 'success' :
                              step.status === 'active' ? 'primary' :
                              step.status === 'error' ? 'danger' : ''
                            }`}>
                              {step.status === 'active' && (
                                <span className="spinner-border spinner-border-sm text-white"></span>
                              )}
                            </div>
                            <div className="timeline-box">
                              <div className="timeline-panel" style={{ cursor: 'default' }}>
                                <h6 className="mb-0">{step.title}</h6>
                                <span>{step.timestamp || step.description}</span>
                              </div>
                              {step.details && step.details.map((detail, idx) => (
                                <p key={idx} className="mb-1"><small>{detail}</small></p>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* How it works */}
                <div className="account-card mt-3">
                  <div className="card-header bg-light">
                    <h6 className="mb-0">
                      <i className="fas fa-magic me-2 text-primary"></i>
                      How AI Ordering Works
                    </h6>
                  </div>
                  <div className="card-body p-3">
                    <ol className="ps-3 mb-0 small">
                      <li className="mb-2">Tell AI what you want in plain English</li>
                      <li className="mb-2">AI finds the best merchant & products</li>
                      <li className="mb-2">Review the proposal (or adjust)</li>
                      <li className="mb-0">One click to confirm!</li>
                    </ol>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <section className="col-xl-8 col-lg-7">
              <div className="account-card order-details">

                {/* Input Step */}
                {flowStep === 'input' && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-magic text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-primary">AI Ready</div>
                        <h4 className="mb-0">What can I get for you?</h4>
                      </div>
                    </div>

                    <div className="p-4">
                      {error && (
                        <div className="alert alert-warning mb-4" role="alert">
                          <i className="fas fa-exclamation-triangle me-2"></i>{error}
                          {error.includes('address') && (
                            <Link href="/account/address" className="d-block mt-2">Add a delivery address</Link>
                          )}
                        </div>
                      )}

                      <div className="bg-light p-4 rounded mb-4">
                        <h5 className="mb-3">
                          <i className="fas fa-brain text-primary me-2"></i>
                          Just tell me what you need
                        </h5>
                        <p className="text-muted mb-0">
                          I'll automatically find the best merchant, select the right products, and prepare everything for your confirmation. No clicking through menus - just tell me!
                        </p>
                      </div>

                      {/* Siri-style voice assistant */}
                      {voiceSupported ? (
                        <div className="text-center mb-4">
                          {assistantActive ? (
                            <button
                              type="button"
                              className="btn btn-lg btn-danger rounded-pill px-4"
                              onClick={stopAssistant}
                            >
                              <i className="fas fa-stop me-2"></i>Stop Assistant
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-lg btn-secondary rounded-pill px-4"
                              onClick={startAssistant}
                            >
                              <i className="fas fa-microphone-lines me-2"></i>Talk to AI Assistant
                            </button>
                          )}
                          <div className="small text-muted mt-2">
                            {assistantActive
                              ? (listening ? 'Listening… speak now. Say “stop” or tap Stop to end.' : speaking ? 'Assistant is speaking… wait for “Listening” to answer.' : 'Preparing your microphone or understanding your answer…')
                              : <>Hands-free — stays on until you stop. Try <em>“Hey, can I get a coffee?”</em></>}
                          </div>
                          {micError && (
                            <div className="alert alert-warning mt-3 mb-0 small" role="alert">
                              <i className="fas fa-microphone-slash me-2"></i>
                              {micError === 'not-allowed'
                                ? 'Microphone is blocked. On iPhone, open this page in Safari, allow Microphone in the page’s website settings, then reload. Also check microphone permission for the browser app in iOS Settings.'
                                : micError === 'service-not-allowed'
                                ? 'Browser speech recognition is unavailable. On iPhone, try opening the page directly in Safari and allow microphone access.'
                                : micError === 'transcription-unavailable'
                                ? 'Audio was recorded, but transcription failed. Try Test mic again or type your request.'
                                : micError === 'microphone-unavailable'
                                ? 'The microphone is unavailable. Close other apps using it and try again in Safari.'
                                : `Voice input issue: ${micError}. Try Test mic again or type your request.`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="alert alert-info small mb-4">
                          <i className="fas fa-info-circle me-2"></i>
                          Voice isn’t available in this browser. On iPhone, open this page directly in Safari and allow microphone access, or type your request below.
                        </div>
                      )}

                      {/* Voice diagnostics — isolates TTS vs mic vs browser */}
                      <details className="bg-light rounded p-3 mb-4 small">
                        <summary style={{ cursor: 'pointer' }}>
                          <i className="fas fa-stethoscope me-2 text-primary"></i>Voice diagnostics
                        </summary>
                        <div className="mt-2">
                          <div className="mb-2">
                            Speech output (TTS): <strong className={ttsSupported ? 'text-success' : 'text-danger'}>{ttsSupported ? 'available' : 'NOT available'}</strong>
                            {' · '}Mic input (STT): <strong className={sttSupported ? 'text-success' : 'text-danger'}>{sttSupported ? 'available' : 'NOT available'}</strong>
                          </div>
                          <div className="d-flex gap-2 flex-wrap mb-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => {
                                setDiag('Speaking…');
                                void speak('Hello! If you can hear this, speech output is working.').then(() => setDiag('Finished speaking. Did you hear it?'));
                              }}
                            >
                              <i className="fas fa-volume-up me-1"></i>1. Test sound
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={async () => {
                                unlockAudio();
                                clearMicError();
                                setDiag('Listening… say something now.');
                                const t = await listen(8000);
                                setDiag(t ? `Heard: “${t}”` : getMicError() ? `Voice input issue: ${getMicError()}. Check the message above.` : 'No words detected. Wait for Listening, then speak clearly and try again.');
                              }}
                            >
                              <i className="fas fa-microphone me-1"></i>2. Test mic
                            </button>
                          </div>
                          {diag && <div className="text-muted">{diag}</div>}
                          <div className="text-muted mt-2" style={{ fontSize: '0.78rem' }}>
                            On iPhone, open Loopora directly in Safari, allow microphone access, keep the page open, and wait for “Listening” before speaking. In-app browsers may restrict microphone access.
                          </div>
                        </div>
                      </details>

                      <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                          <div className="input-group input-group-lg">
                            <span className="input-group-text bg-primary text-white">
                              <i className="fas fa-comments"></i>
                            </span>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g., Get me coffee and a croissant for breakfast"
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              autoFocus
                            />
                            {voiceSupported && (
                              <button
                                type="button"
                                className={`btn ${listening ? 'btn-danger' : 'btn-outline-primary'} px-3`}
                                onClick={handleMic}
                                title="Speak your order"
                              >
                                <i className={`fas ${listening ? 'fa-circle-notch fa-spin' : 'fa-microphone'}`}></i>
                              </button>
                            )}
                            <button type="submit" className="btn btn-primary px-4" disabled={!inputValue.trim()}>
                              <i className="fas fa-paper-plane me-2"></i>Go
                            </button>
                          </div>
                        </div>
                      </form>

                      {voiceSupported && (
                        <div className="d-flex align-items-center justify-content-between bg-light rounded p-2 mb-3">
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              id="voiceModeToggle"
                              checked={voiceMode}
                              onChange={(e) => setVoiceMode(e.target.checked)}
                            />
                            <label className="form-check-label small" htmlFor="voiceModeToggle">
                              <i className="fas fa-headset me-1 text-primary"></i>
                              Voice mode — AI reads the order back and takes a spoken &quot;yes&quot; to confirm
                            </label>
                          </div>
                          {(listening || speaking) && (
                            <span className="badge bg-primary">
                              <i className={`fas ${listening ? 'fa-microphone' : 'fa-volume-up'} me-1`}></i>
                              {listening ? 'Listening…' : 'Speaking…'}
                            </span>
                          )}
                          {speaking && (
                            <button className="btn btn-sm btn-outline-secondary ms-2" onClick={stopSpeaking}>
                              Stop
                            </button>
                          )}
                        </div>
                      )}

                      {/* Location + radius */}
                      <div className="d-flex align-items-center flex-wrap gap-3 mb-3">
                        <button
                          type="button"
                          className={`btn btn-sm ${located ? 'btn-success' : 'btn-outline-secondary'}`}
                          onClick={handleLocate}
                          disabled={locating}
                        >
                          <i className="fas fa-location-dot me-1"></i>
                          {locating ? 'Locating…' : located ? 'Location set' : 'Use my location'}
                        </button>
                        {located && (
                          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 200 }}>
                            <small className="text-muted">Within</small>
                            <input
                              type="range"
                              className="form-range flex-grow-1"
                              min={0.5}
                              max={5}
                              step={0.5}
                              value={maxDistance}
                              onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
                            />
                            <small className="fw-bold" style={{ whiteSpace: 'nowrap' }}>{maxDistance} mi</small>
                          </div>
                        )}
                      </div>

                      {/* Personalized reorder */}
                      {usual && (
                        <div className="mb-3">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm rounded-pill text-start"
                            onClick={() => runAgent(usual.query)}
                          >
                            <i className="fas fa-star me-1 text-warning"></i>{usual.label}
                          </button>
                        </div>
                      )}

                      <div className="mb-3">
                        <small className="text-muted">Try saying:</small>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mb-4">
                        {[
                          'Get an oat milk latte and almond croissant',
                          'Order fresh orange juice and a blueberry muffin',
                          'Find vegan avocado toast for breakfast',
                          'Show me masala dosa from the local restaurant',
                        ].map((suggestion, idx) => (
                          <button
                            key={idx}
                            className="btn btn-outline-primary btn-sm rounded-pill"
                            onClick={() => setInputValue(suggestion)}
                          >
                            "{suggestion}"
                          </button>
                        ))}
                      </div>

                      {/* AI Mode Selection */}
                      <div className="border-top pt-4 mt-2">
                        <h6 className="mb-3">
                          <i className="fas fa-wand-magic-sparkles text-primary me-2"></i>
                          Shopping Mode
                        </h6>
                        <div className="btn-group w-100 mb-3" role="group">
                          <input
                            type="radio"
                            className="btn-check"
                            name="aiMode"
                            id="mode-standard"
                            checked={selectedAIMode === 'standard'}
                            onChange={() => setSelectedAIMode('standard')}
                          />
                          <label className="btn btn-outline-primary" htmlFor="mode-standard">
                            <i className="fas fa-robot me-1"></i>Standard
                          </label>

                          <input
                            type="radio"
                            className="btn-check"
                            name="aiMode"
                            id="mode-smart-cart"
                            checked={selectedAIMode === 'smart-cart'}
                            onChange={() => setSelectedAIMode('smart-cart')}
                          />
                          <label className="btn btn-outline-primary" htmlFor="mode-smart-cart">
                            <i className="fas fa-cart-shopping me-1"></i>Smart Cart
                          </label>

                          <input
                            type="radio"
                            className="btn-check"
                            name="aiMode"
                            id="mode-budget"
                            checked={selectedAIMode === 'budget-shop'}
                            onChange={() => setSelectedAIMode('budget-shop')}
                          />
                          <label className="btn btn-outline-success" htmlFor="mode-budget">
                            <i className="fas fa-wallet me-1"></i>Budget
                          </label>

                          <input
                            type="radio"
                            className="btn-check"
                            name="aiMode"
                            id="mode-predict"
                            checked={selectedAIMode === 'predictions'}
                            onChange={() => setSelectedAIMode('predictions')}
                          />
                          <label className="btn btn-outline-warning" htmlFor="mode-predict">
                            <i className="fas fa-lightbulb me-1"></i>Predict
                          </label>
                        </div>

                        {/* Mode-specific inputs */}
                        {selectedAIMode === 'standard' && (
                          <div className="bg-light p-3 rounded">
                            <small className="text-muted d-block mb-2">
                              <i className="fas fa-info-circle me-1"></i>
                              Standard mode: Tell me what you want and I'll find the best merchant and products.
                            </small>
                          </div>
                        )}

                        {selectedAIMode === 'smart-cart' && (
                          <div className="bg-light p-3 rounded">
                            <small className="text-muted d-block mb-2">
                              <i className="fas fa-info-circle me-1"></i>
                              Smart Cart: Order from multiple merchants optimized for price, rating, or distance.
                            </small>
                            <small className="text-primary">Example: "coffee from best cafe and cake from cheapest bakery"</small>
                          </div>
                        )}

                        {selectedAIMode === 'budget-shop' && (
                          <div className="bg-light p-3 rounded">
                            <small className="text-muted d-block mb-2">
                              <i className="fas fa-info-circle me-1"></i>
                              Budget Mode: Set your budget and I'll find the best products within your limit.
                            </small>
                            <div className="row g-2 mt-2">
                              <div className="col-4">
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">$</span>
                                  <input
                                    type="number"
                                    className="form-control"
                                    placeholder="Budget"
                                    value={budgetInput}
                                    onChange={(e) => setBudgetInput(parseInt(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="col-8">
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Items: coffee, cake, bread"
                                  value={budgetItems}
                                  onChange={(e) => setBudgetItems(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedAIMode === 'predictions' && (
                          <div className="bg-light p-3 rounded">
                            <small className="text-muted d-block mb-2">
                              <i className="fas fa-info-circle me-1"></i>
                              Predictions: Based on your order history, I'll suggest what you might want next.
                            </small>
                            <button
                              className="btn btn-warning btn-sm mt-2"
                              onClick={handlePredictions}
                            >
                              <i className="fas fa-lightbulb me-1"></i>Show My Predictions
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Thinking Step */}
                {flowStep === 'thinking' && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="spinner-border text-white"></span>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-warning text-dark">
                          <span className="spinner-border spinner-border-sm me-2" style={{ width: '0.75rem', height: '0.75rem' }}></span>
                          Working
                        </div>
                        <h4 className="mb-0">AI is preparing your order...</h4>
                      </div>
                    </div>
                    <div className="p-5 text-center">
                      <div className="spinner-grow text-primary me-2" role="status"></div>
                      <div className="spinner-grow text-secondary me-2" role="status"></div>
                      <div className="spinner-grow text-primary" role="status"></div>
                      <p className="text-muted mt-4 mb-0">
                        Finding the best options for: <strong>"{userQuery}"</strong>
                      </p>

                      {narration && (
                        <div
                          className="bg-light rounded p-3 mt-4 mx-auto text-start"
                          style={{ maxWidth: 420, fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-line' }}
                        >
                          <span className="text-primary fw-bold d-block mb-1">
                            <i className="fas fa-terminal me-2"></i>Agent log
                          </span>
                          {narration}
                          <span className="agent-cursor">▋</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Choosing Step - merchant options (voice or click) */}
                {flowStep === 'choosing' && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-store text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-primary">Choose a merchant</div>
                        <h4 className="mb-0">I found {voiceMerchants.length} option{voiceMerchants.length > 1 ? 's' : ''} near you</h4>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-muted">
                        <i className="fas fa-microphone text-primary me-1"></i>
                        Say the number or the name — or tap one.
                      </p>
                      {voiceMerchants.map((m, i) => (
                        <div key={m.id} className="card mb-2" style={{ cursor: 'pointer' }} onClick={() => chooseMerchantFromList(m)}>
                          <div className="card-body py-2 d-flex align-items-center">
                            <span className="badge bg-secondary me-3" style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{i + 1}</span>
                            <img src={m.image} alt="" width="44" height="44" className="rounded-circle me-3" />
                            <div className="flex-grow-1">
                              <h6 className="mb-0">{m.name}</h6>
                              <small className="text-muted">{m.distance} • {m.prepTime} • <i className="fas fa-star text-warning"></i> {m.rating}</small>
                              {(m as { aiReason?: string }).aiReason && (
                                <p className="text-success small mb-0 mt-1"><i className="fas fa-robot me-1"></i>{(m as { aiReason?: string }).aiReason}</p>
                              )}
                            </div>
                            <i className="fas fa-chevron-right text-muted"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Proposal Step - The Key Agentic UI */}
                {flowStep === 'proposal' && proposal && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-check text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-success">Ready to Order</div>
                        <h4 className="mb-0">Here's what I found for you</h4>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="bg-light p-3 m-3 rounded border-start border-primary border-4">
                      <small className="text-primary fw-bold">
                        <i className="fas fa-robot me-2"></i>AI Says:
                      </small>
                      <p className="mb-0 mt-1">{proposal.reasoning}</p>
                    </div>

                    {/* Alternative Product Warning */}
                    {hasAlternatives && alternativeMessage && (
                      <div className="alert alert-warning mx-3 d-flex align-items-start" role="alert">
                        <i className="fas fa-exchange-alt me-3 mt-1" style={{ fontSize: '1.2rem' }}></i>
                        <div>
                          <strong>Alternative Suggested</strong>
                          <p className="mb-0 mt-1">{alternativeMessage}</p>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="alert alert-danger mx-3" role="alert">
                        <i className="fas fa-exclamation-circle me-2"></i>{error}
                      </div>
                    )}

                    <div className="p-3">
                      <div className="row g-3">
                        {/* Merchant Card */}
                        <div className="col-md-6">
                          <div className="card h-100">
                            <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                              <small className="text-muted fw-bold">MERCHANT</small>
                              <button
                                className="btn btn-link btn-sm p-0 text-primary"
                                onClick={() => setShowMerchantSelector(true)}
                              >
                                Change
                              </button>
                            </div>
                            <div className="card-body py-2">
                              <div className="d-flex align-items-center">
                                <img src={proposal.merchant.image} alt="" width="50" height="50" className="rounded-circle me-3" />
                                <div>
                                  <h6 className="mb-0">{proposal.merchant.name}</h6>
                                  <small className="text-muted">{proposal.merchant.distance} • {proposal.merchant.prepTime}</small>
                                  <p className="text-success mb-0 small mt-1">
                                    <i className="fas fa-tag me-1"></i>{proposal.merchant.offers[0]}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Address Card */}
                        <div className="col-md-6">
                          <div className="card h-100">
                            <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                              <small className="text-muted fw-bold">DELIVER TO</small>
                              <button
                                className="btn btn-link btn-sm p-0 text-primary"
                                onClick={() => setShowAddressSelector(true)}
                              >
                                Change
                              </button>
                            </div>
                            <div className="card-body py-2">
                              <h6 className="mb-1">
                                <i className={`fas fa-${proposal.address.label === 'Home' ? 'home' : proposal.address.label === 'Work' ? 'briefcase' : 'map-marker-alt'} me-2 text-primary`}></i>
                                {proposal.address.label}
                              </h6>
                              <small className="text-muted d-block">{proposal.address.street}</small>
                              <small className="text-muted">{proposal.address.city}, {proposal.address.state}</small>
                            </div>
                          </div>
                        </div>

                        {/* Items Card */}
                        <div className="col-12">
                          <div className="card">
                            <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
                              <small className="text-muted fw-bold">YOUR ORDER ({proposal.items.reduce((sum, i) => sum + i.selectedQuantity, 0)} items)</small>
                              <button
                                className="btn btn-link btn-sm p-0 text-primary"
                                onClick={() => setShowItemEditor(!showItemEditor)}
                              >
                                {showItemEditor ? 'Done' : 'Edit Items'}
                              </button>
                            </div>
                            <div className="card-body py-2">
                              {proposal.items.map(item => (
                                <div key={item.id} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                                  <div className="d-flex align-items-center">
                                    <img src={item.image} alt="" width="40" height="40" className="rounded me-2" />
                                    <div>
                                      <span className="d-block">{item.name}</span>
                                      <small className="text-muted">${item.price.toFixed(2)} each</small>
                                    </div>
                                  </div>
                                  <div className="d-flex align-items-center">
                                    {showItemEditor ? (
                                      <>
                                        <button
                                          className="btn btn-outline-secondary btn-sm"
                                          onClick={() => updateProposalItem(item.id, -1)}
                                        >
                                          <i className="fas fa-minus"></i>
                                        </button>
                                        <span className="mx-3 fw-bold">{item.selectedQuantity}</span>
                                        <button
                                          className="btn btn-primary btn-sm"
                                          onClick={() => updateProposalItem(item.id, 1)}
                                        >
                                          <i className="fas fa-plus"></i>
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-muted">
                                        x{item.selectedQuantity} = ${(item.price * item.selectedQuantity).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {/* Add more items */}
                              {showItemEditor && allProducts.filter(p => !proposal.items.find(i => i.id === p.id)).length > 0 && (
                                <div className="mt-3">
                                  <small className="text-muted fw-bold">ADD MORE:</small>
                                  <div className="d-flex flex-wrap gap-2 mt-2">
                                    {allProducts.filter(p => !proposal.items.find(i => i.id === p.id)).map(product => (
                                      <button
                                        key={product.id}
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={() => addProductToProposal(product)}
                                      >
                                        <i className="fas fa-plus me-1"></i>
                                        {product.name} (${product.price.toFixed(2)})
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Pricing */}
                        <div className="col-12">
                          <div className="bg-light p-3 rounded">
                            <div className="row">
                              <div className="col-6">
                                <div className="d-flex justify-content-between small mb-1">
                                  <span>Subtotal</span>
                                  <span>${proposal.pricing.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small mb-1">
                                  <span>Service Fee</span>
                                  <span>${proposal.pricing.serviceFee.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="d-flex justify-content-between small mb-1">
                                  <span>Delivery</span>
                                  <span>${proposal.pricing.deliveryFee.toFixed(2)}</span>
                                </div>
                                <div className="d-flex justify-content-between small mb-1">
                                  <span>Tax</span>
                                  <span>${proposal.pricing.tax.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            <hr className="my-2" />
                            <div className="d-flex justify-content-between fw-bold">
                              <span>Total</span>
                              <span className="text-primary fs-5">${proposal.pricing.total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Method Selection */}
                      <div className="mt-4">
                        <h6 className="mb-3">
                          <i className="fas fa-credit-card me-2 text-primary"></i>
                          Payment Method
                        </h6>
                        <div className="row g-2">
                          <div className="col-6 col-md-3">
                            <div
                              className={`card h-100 ${selectedPaymentMethod === 'upi' ? 'border-primary bg-light' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedPaymentMethod('upi')}
                            >
                              <div className="card-body text-center py-3">
                                <i className="fas fa-mobile-alt fa-lg mb-2 text-success"></i>
                                <div className="small fw-bold">UPI</div>
                                {selectedPaymentMethod === 'upi' && (
                                  <i className="fas fa-check-circle text-primary position-absolute" style={{ top: '5px', right: '5px' }}></i>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div
                              className={`card h-100 ${selectedPaymentMethod === 'card' ? 'border-primary bg-light' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedPaymentMethod('card')}
                            >
                              <div className="card-body text-center py-3">
                                <i className="fas fa-credit-card fa-lg mb-2 text-primary"></i>
                                <div className="small fw-bold">Card</div>
                                {selectedPaymentMethod === 'card' && (
                                  <i className="fas fa-check-circle text-primary position-absolute" style={{ top: '5px', right: '5px' }}></i>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div
                              className={`card h-100 ${selectedPaymentMethod === 'wallet' ? 'border-primary bg-light' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedPaymentMethod('wallet')}
                            >
                              <div className="card-body text-center py-3">
                                <i className="fas fa-wallet fa-lg mb-2 text-warning"></i>
                                <div className="small fw-bold">Wallet</div>
                                {selectedPaymentMethod === 'wallet' && (
                                  <i className="fas fa-check-circle text-primary position-absolute" style={{ top: '5px', right: '5px' }}></i>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div
                              className={`card h-100 ${selectedPaymentMethod === 'cod' ? 'border-primary bg-light' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setSelectedPaymentMethod('cod')}
                            >
                              <div className="card-body text-center py-3">
                                <i className="fas fa-money-bill-wave fa-lg mb-2 text-secondary"></i>
                                <div className="small fw-bold">COD</div>
                                {selectedPaymentMethod === 'cod' && (
                                  <i className="fas fa-check-circle text-primary position-absolute" style={{ top: '5px', right: '5px' }}></i>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Action Buttons */}
                      <div className="d-flex gap-3 mt-4">
                        <button
                          className="btn btn-primary btn-lg flex-grow-1"
                          onClick={() => handleConfirmOrder()}
                          disabled={proposal.items.length === 0}
                        >
                          <i className="fas fa-check-circle me-2"></i>
                          Place Order • ${proposal.pricing.total.toFixed(2)}
                        </button>
                        <button className="btn btn-outline-secondary" onClick={resetFlow}>
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>

                    {/* Address Selector Modal */}
                    {showAddressSelector && (
                      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                          <div className="modal-content">
                            <div className="modal-header">
                              <h5 className="modal-title">Select Delivery Address</h5>
                              <button type="button" className="btn-close" onClick={() => setShowAddressSelector(false)}></button>
                            </div>
                            <div className="modal-body">
                              {addresses.map(address => (
                                <div
                                  key={address.id}
                                  className={`card mb-2 ${proposal.address.id === address.id ? 'border-primary' : ''}`}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => changeAddress(address)}
                                >
                                  <div className="card-body py-2">
                                    <div className="d-flex justify-content-between">
                                      <h6 className="mb-0">
                                        <i className={`fas fa-${address.label === 'Home' ? 'home' : address.label === 'Work' ? 'briefcase' : 'map-marker-alt'} me-2 text-primary`}></i>
                                        {address.label}
                                      </h6>
                                      {address.isDefault && <span className="badge bg-success">Default</span>}
                                    </div>
                                    <small className="text-muted">{address.street}, {address.city}</small>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Merchant Selector Modal */}
                    {showMerchantSelector && (
                      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                          <div className="modal-content">
                            <div className="modal-header">
                              <h5 className="modal-title">Change Merchant</h5>
                              <button type="button" className="btn-close" onClick={() => setShowMerchantSelector(false)}></button>
                            </div>
                            <div className="modal-body">
                              {allMerchants.map(merchant => (
                                <div
                                  key={merchant.id}
                                  className={`card mb-2 ${proposal.merchant.id === merchant.id ? 'border-primary' : ''}`}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => changeMerchant(merchant)}
                                >
                                  <div className="card-body py-2">
                                    <div className="d-flex align-items-center">
                                      <img src={merchant.image} alt="" width="40" height="40" className="rounded-circle me-2" />
                                      <div className="flex-grow-1">
                                        <h6 className="mb-0">{merchant.name}</h6>
                                        <small className="text-muted">{merchant.distance} • {merchant.prepTime}</small>
                                      </div>
                                      <span className="text-warning">
                                        <i className="fas fa-star"></i> {merchant.rating}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Processing Step */}
                {flowStep === 'processing' && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="spinner-border text-white"></span>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-warning text-dark">Processing</div>
                        <h4 className="mb-0">Completing your order...</h4>
                      </div>
                    </div>
                    <div className="p-5 text-center">
                      <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                      <p className="text-muted mb-0">
                        Placing your prototype order...
                      </p>
                    </div>
                  </>
                )}

                {/* Confirmed Step — polished payment confirmation */}
                {flowStep === 'confirmed' && orderResult && (
                  <>
                    {/* Gradient success header */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #16a34a 0%, #0d9488 100%)',
                        borderRadius: 16, padding: '30px 20px', textAlign: 'center', color: '#fff', margin: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 66, height: 66, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
                        }}
                      >
                        <i className="fas fa-check" style={{ fontSize: '1.9rem' }}></i>
                      </div>
                      <h3 style={{ color: '#fff', margin: 0, fontWeight: 800 }}>Order Confirmed!</h3>
                      <div style={{ opacity: 0.95, marginTop: 6, fontSize: '1.05rem' }}>{orderResult.order.merchantName}</div>
                      <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Order #{orderResult.order.orderId}</div>
                    </div>

                    {/* Receipt card */}
                    <div className="card mx-3 mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center mb-2">
                          <i className="far fa-clock me-2 text-muted"></i>
                          <span className="text-muted">Estimated ready:</span>
                          <strong className="ms-2">{orderResult.order.estimatedReady}</strong>
                        </div>
                        <div className="d-flex align-items-center text-muted">
                          <i className="fas fa-location-dot me-2"></i>
                          Pickup or table service ready
                        </div>
                        <hr />
                        {orderResult.order.items.map((item) => (
                          <div key={item.productId} className="d-flex justify-content-between py-1">
                            <span>
                              <span className="fw-bold me-2">{item.quantity}×</span>
                              {item.name}
                            </span>
                            <span className="text-muted">${item.total.toFixed(2)}</span>
                          </div>
                        ))}
                        {orderResult.order.pricing.loyaltyDiscount > 0 && (
                          <div className="d-flex justify-content-between py-1 text-success">
                            <span>Discount applied</span>
                            <span>−${orderResult.order.pricing.loyaltyDiscount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between align-items-center mt-2">
                          <strong style={{ fontSize: '1.15rem' }}>
                            {orderResult.payment.status === 'captured' ? 'Total Paid' : 'Order Total'}
                          </strong>
                          <strong className="text-primary" style={{ fontSize: '1.5rem' }}>
                            ${orderResult.order.pricing.total.toFixed(2)}
                          </strong>
                        </div>
                        <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2 mt-3">
                          <span className="badge bg-light text-dark border align-self-start" style={{ fontSize: '0.85rem', padding: '6px 10px' }}>
                            {orderResult.payment.status === 'captured' && orderResult.payment.method === 'upi' ? (
                              <><i className="fas fa-mobile-alt me-1"></i>UPI - {orderResult.payment.upiApp || 'UPI'}</>
                            ) : orderResult.payment.status !== 'captured' && orderResult.payment.method === 'cod' ? (
                              <><i className="fas fa-money-bill-wave me-1"></i>Cash on Delivery</>
                            ) : orderResult.payment.status === 'captured' && orderResult.payment.method === 'wallet' ? (
                              <><i className="fas fa-wallet me-1"></i>{orderResult.payment.walletType || 'Wallet'}</>
                            ) : orderResult.payment.status === 'captured' ? (
                              <><i className="fas fa-credit-card me-1"></i>{orderResult.payment.cardBrand || 'Card'}{orderResult.payment.last4 ? ` •••• ${orderResult.payment.last4}` : ''}</>
                            ) : (
                              <><i className="fas fa-wallet me-1"></i>{orderResult.payment.method.toUpperCase()}</>
                            )}
                          </span>
                          <span className="small text-muted">
                            Mode of payment: {orderResult.payment.method.toUpperCase()}
                          </span>
                          {orderResult.payment.status === 'captured' && orderResult.payment.tokenized !== false && (
                            <small className="text-muted">Tokenized payment</small>
                          )}
                        </div>
                        {(orderResult.order.cookingInstructions ||
                          orderResult.order.items.find((item) => item.cookingInstructions)?.cookingInstructions) && (
                          <div className="alert alert-light border mt-3 mb-0">
                            <strong>Cooking instructions:</strong>
                            <p className="mb-0 mt-1">
                              {orderResult.order.cookingInstructions ||
                                orderResult.order.items.find((item) => item.cookingInstructions)?.cookingInstructions}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Loyalty card */}
                    <div
                      className="mx-3 mb-3 d-flex align-items-center justify-content-between"
                      style={{ background: '#fff8e6', border: '1px solid #ffe08a', borderRadius: 14, padding: '14px 16px' }}
                    >
                      <div className="d-flex align-items-center">
                        <div
                          style={{
                            width: 44, height: 44, borderRadius: 12, background: '#f5b301',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginRight: 12,
                          }}
                        >
                          <i className="fas fa-gift"></i>
                        </div>
                        <div>
                          <div className="fw-bold" style={{ color: '#664d00' }}>Loyalty Points Earned!</div>
                          <small style={{ color: '#8a6d00' }}>+{orderResult.loyalty.pointsEarned} points added to your wallet</small>
                        </div>
                      </div>
                      <div className="text-end" style={{ color: '#e0a000', fontWeight: 800, lineHeight: 1.1 }}>
                        <div style={{ fontSize: '1.4rem' }}>+{orderResult.loyalty.pointsEarned}</div>
                        <small><i className="fas fa-star"></i> pts</small>
                      </div>
                    </div>

                    {receiptSummary && (
                      <div className="bg-light p-3 rounded mx-3 mb-3 text-start border-start border-primary border-4">
                        <small className="text-primary fw-bold">
                          <i className="fas fa-robot me-2"></i>AI Receipt
                        </small>
                        <p className="mb-0 mt-1">{receiptSummary}</p>
                      </div>
                    )}

                    <div className="d-flex gap-3 justify-content-center flex-wrap p-3">
                      <button className="btn btn-primary" onClick={resetFlow}>
                        <i className="fas fa-plus me-2"></i>Order Again
                      </button>
                      <Link href={`/account/orders/${orderResult.order.orderId}`} className="btn btn-outline-secondary">
                        <i className="fas fa-receipt me-2"></i>View Order
                      </Link>
                      <Link href="/account/orders" className="btn btn-outline-secondary">
                        All Orders
                      </Link>
                    </div>
                  </>
                )}

                {/* Smart Cart Results */}
                {flowStep === 'smart-cart' && smartCartResult && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-cart-shopping text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className="badge bg-primary">Smart Cart</div>
                        <h4 className="mb-0">Multi-Merchant Optimized Cart</h4>
                      </div>
                    </div>

                    {smartCartResult.aiInsights && (
                      <div className="bg-light p-3 m-3 rounded border-start border-primary border-4">
                        <small className="text-primary fw-bold">
                          <i className="fas fa-lightbulb me-2"></i>AI Insight:
                        </small>
                        <p className="mb-0 mt-1">{smartCartResult.aiInsights}</p>
                      </div>
                    )}

                    <div className="p-3">
                      {/* Parsed Request */}
                      <div className="mb-3">
                        <small className="text-muted fw-bold">UNDERSTOOD YOUR REQUEST:</small>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {smartCartResult.parsedRequest.map((req, i) => (
                            <span key={i} className="badge bg-light text-dark border">
                              {req.item} <span className="text-primary">({req.criteria.replace('_', ' ')})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Merchants Summary */}
                      <div className="row g-2 mb-3">
                        {smartCartResult.merchants.map((m) => (
                          <div key={m.id} className="col-md-6">
                            <div className="card border-0 bg-light">
                              <div className="card-body py-2">
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <h6 className="mb-0">{m.name}</h6>
                                    <small className="text-muted">{m.distance} • {m.prepTime}</small>
                                  </div>
                                  <span className="badge bg-primary">{m.itemCount} item{m.itemCount > 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cart Items */}
                      <div className="card mb-3">
                        <div className="card-header bg-white py-2">
                          <small className="text-muted fw-bold">YOUR OPTIMIZED CART ({smartCartResult.cart.length} items)</small>
                        </div>
                        <div className="card-body py-2">
                          {smartCartResult.cart.map((item) => (
                            <div key={item.productId} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                              <div className="d-flex align-items-center">
                                <img src={item.image} alt="" width="45" height="45" className="rounded me-2" />
                                <div>
                                  <span className="d-block">{item.name}</span>
                                  <small className="text-muted">from {item.merchantName}</small>
                                  <p className="text-success mb-0 small"><i className="fas fa-check-circle me-1"></i>{item.selectionReason}</p>
                                </div>
                              </div>
                              <div className="text-end">
                                <strong>${item.price}</strong>
                                {item.rating && <small className="d-block text-warning"><i className="fas fa-star"></i> {item.rating}</small>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-light p-3 rounded mb-3">
                        <div className="d-flex justify-content-between mb-2">
                          <span>Subtotal ({smartCartResult.summary.totalItems} items from {smartCartResult.summary.totalMerchants} merchants)</span>
                          <strong>${smartCartResult.summary.subtotal}</strong>
                        </div>
                        {smartCartResult.summary.estimatedSavings > 0 && (
                          <div className="d-flex justify-content-between text-success">
                            <span><i className="fas fa-piggy-bank me-1"></i>Estimated Savings</span>
                            <strong>${smartCartResult.summary.estimatedSavings}</strong>
                          </div>
                        )}
                      </div>

                      {/* Payment Method Selection */}
                      <div className="mb-3">
                        <small className="text-muted fw-bold d-block mb-2">PAYMENT METHOD</small>
                        <div className="btn-group w-100" role="group">
                          <input type="radio" className="btn-check" name="smartPayment" id="smart-upi" checked={selectedPaymentMethod === 'upi'} onChange={() => setSelectedPaymentMethod('upi')} />
                          <label className="btn btn-outline-primary" htmlFor="smart-upi"><i className="fas fa-mobile-alt me-1"></i>UPI</label>
                          <input type="radio" className="btn-check" name="smartPayment" id="smart-card" checked={selectedPaymentMethod === 'card'} onChange={() => setSelectedPaymentMethod('card')} />
                          <label className="btn btn-outline-primary" htmlFor="smart-card"><i className="fas fa-credit-card me-1"></i>Card</label>
                          <input type="radio" className="btn-check" name="smartPayment" id="smart-wallet" checked={selectedPaymentMethod === 'wallet'} onChange={() => setSelectedPaymentMethod('wallet')} />
                          <label className="btn btn-outline-primary" htmlFor="smart-wallet"><i className="fas fa-wallet me-1"></i>Wallet</label>
                          <input type="radio" className="btn-check" name="smartPayment" id="smart-cod" checked={selectedPaymentMethod === 'cod'} onChange={() => setSelectedPaymentMethod('cod')} />
                          <label className="btn btn-outline-primary" htmlFor="smart-cod"><i className="fas fa-money-bill-wave me-1"></i>COD</label>
                        </div>
                      </div>

                      <div className="d-flex gap-3">
                        <button className="btn btn-outline-secondary" onClick={resetFlow}>
                          <i className="fas fa-arrow-left me-2"></i>Cancel
                        </button>
                        <button
                          className="btn btn-primary flex-grow-1"
                          onClick={handleSmartCartCheckout}
                          disabled={smartCartResult.cart.length === 0}
                        >
                          <i className="fas fa-check-circle me-2"></i>
                          Place Order • ${smartCartResult.summary.subtotal}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Budget Shop Results */}
                {flowStep === 'budget-shop' && budgetShopResult && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-wallet text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className={`badge ${budgetShopResult.summary.withinBudget ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {budgetShopResult.summary.withinBudget ? 'Within Budget' : 'Over Budget'}
                        </div>
                        <h4 className="mb-0">Budget Shopping Plan</h4>
                      </div>
                    </div>

                    {budgetShopResult.aiAdvice && (
                      <div className="bg-light p-3 m-3 rounded border-start border-success border-4">
                        <small className="text-success fw-bold">
                          <i className="fas fa-coins me-2"></i>Budget Tip:
                        </small>
                        <p className="mb-0 mt-1">{budgetShopResult.aiAdvice}</p>
                      </div>
                    )}

                    <div className="p-3">
                      {/* Budget Progress */}
                      <div className="card mb-3 border-success">
                        <div className="card-body">
                          <div className="d-flex justify-content-between mb-2">
                            <span>Budget: <strong>${budgetShopResult.budget.total}</strong></span>
                            <span>Spent: <strong className={budgetShopResult.summary.withinBudget ? 'text-success' : 'text-danger'}>${budgetShopResult.budget.allocated}</strong></span>
                          </div>
                          <div className="progress" style={{ height: '20px' }}>
                            <div
                              className={`progress-bar ${budgetShopResult.summary.withinBudget ? 'bg-success' : 'bg-danger'}`}
                              style={{ width: `${Math.min(100, budgetShopResult.budget.utilizationPercent)}%` }}
                            >
                              {budgetShopResult.budget.utilizationPercent}%
                            </div>
                          </div>
                          <div className="d-flex justify-content-between mt-2 small">
                            <span className={budgetShopResult.budget.remaining >= 0 ? 'text-success' : 'text-danger'}>
                              {budgetShopResult.budget.remaining >= 0 ? `$${budgetShopResult.budget.remaining} remaining` : `$${Math.abs(budgetShopResult.budget.remaining)} over budget`}
                            </span>
                            <span>{budgetShopResult.summary.itemsFound}/{budgetShopResult.summary.itemsRequested} items found</span>
                          </div>
                        </div>
                      </div>

                      {/* Allocations */}
                      <div className="mb-3">
                        <small className="text-muted fw-bold">BUDGET ALLOCATION:</small>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {budgetShopResult.allocations.map((a, i) => (
                            <span key={i} className={`badge ${a.isPriority ? 'bg-success' : 'bg-light text-dark border'}`}>
                              {a.item}: ${a.allocatedBudget} {a.isPriority && <i className="fas fa-star ms-1"></i>}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Selected Products */}
                      <div className="card mb-3">
                        <div className="card-header bg-white py-2">
                          <small className="text-muted fw-bold">SELECTED PRODUCTS</small>
                        </div>
                        <div className="card-body py-2">
                          {budgetShopResult.selectedProducts.map((item) => (
                            <div key={item.productId} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                              <div className="d-flex align-items-center">
                                <img src={item.image} alt="" width="45" height="45" className="rounded me-2" />
                                <div>
                                  <span className="d-block">{item.name}</span>
                                  <small className="text-muted">from {item.merchantName}</small>
                                  <p className={`mb-0 small ${item.withinBudget ? 'text-success' : 'text-warning'}`}>
                                    <i className={`fas ${item.withinBudget ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-1`}></i>
                                    {item.budgetImpact}
                                  </p>
                                </div>
                              </div>
                              <strong>${item.price}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {budgetShopResult.summary.totalSavings > 0 && (
                        <div className="alert alert-success d-flex align-items-center">
                          <i className="fas fa-piggy-bank me-2" style={{ fontSize: '1.5rem' }}></i>
                          <div>
                            <strong>You saved ${budgetShopResult.summary.totalSavings}!</strong>
                            <p className="mb-0 small">Great deals found within your budget.</p>
                          </div>
                        </div>
                      )}

                      {/* Payment Method Selection */}
                      <div className="mb-3">
                        <small className="text-muted fw-bold d-block mb-2">PAYMENT METHOD</small>
                        <div className="btn-group w-100" role="group">
                          <input type="radio" className="btn-check" name="budgetPayment" id="budget-upi" checked={selectedPaymentMethod === 'upi'} onChange={() => setSelectedPaymentMethod('upi')} />
                          <label className="btn btn-outline-success" htmlFor="budget-upi"><i className="fas fa-mobile-alt me-1"></i>UPI</label>
                          <input type="radio" className="btn-check" name="budgetPayment" id="budget-card" checked={selectedPaymentMethod === 'card'} onChange={() => setSelectedPaymentMethod('card')} />
                          <label className="btn btn-outline-success" htmlFor="budget-card"><i className="fas fa-credit-card me-1"></i>Card</label>
                          <input type="radio" className="btn-check" name="budgetPayment" id="budget-wallet" checked={selectedPaymentMethod === 'wallet'} onChange={() => setSelectedPaymentMethod('wallet')} />
                          <label className="btn btn-outline-success" htmlFor="budget-wallet"><i className="fas fa-wallet me-1"></i>Wallet</label>
                          <input type="radio" className="btn-check" name="budgetPayment" id="budget-cod" checked={selectedPaymentMethod === 'cod'} onChange={() => setSelectedPaymentMethod('cod')} />
                          <label className="btn btn-outline-success" htmlFor="budget-cod"><i className="fas fa-money-bill-wave me-1"></i>COD</label>
                        </div>
                      </div>

                      <div className="d-flex gap-3">
                        <button className="btn btn-outline-secondary" onClick={resetFlow}>
                          <i className="fas fa-arrow-left me-2"></i>Cancel
                        </button>
                        <button
                          className="btn btn-success flex-grow-1"
                          onClick={handleBudgetShopCheckout}
                          disabled={budgetShopResult.selectedProducts.length === 0}
                        >
                          <i className="fas fa-check-circle me-2"></i>
                          Place Order • ${budgetShopResult.budget.allocated}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Predictions Results */}
                {flowStep === 'predictions' && predictionResult && (
                  <>
                    <div className="order-head">
                      <div className="head-thumb" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fas fa-brain text-white" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <div className="clearfix m-l20">
                        <div className={`badge ${predictionResult.timing.urgency === 'high' ? 'bg-danger' : predictionResult.timing.urgency === 'medium' ? 'bg-warning text-dark' : 'bg-info'}`}>
                          {predictionResult.timing.urgency === 'high' ? 'Order Soon!' : predictionResult.timing.urgency === 'medium' ? 'Coming Up' : 'No Rush'}
                        </div>
                        <h4 className="mb-0">AI Predictions</h4>
                      </div>
                    </div>

                    {predictionResult.aiInsight && (
                      <div className="bg-light p-3 m-3 rounded border-start border-warning border-4">
                        <small className="text-warning fw-bold">
                          <i className="fas fa-lightbulb me-2"></i>AI Insight:
                        </small>
                        <p className="mb-0 mt-1">{predictionResult.aiInsight}</p>
                      </div>
                    )}

                    <div className="p-3">
                      {/* Timing */}
                      <div className="row g-2 mb-3">
                        <div className="col-md-6">
                          <div className="card border-0 bg-warning bg-opacity-10">
                            <div className="card-body py-3 text-center">
                              <i className="fas fa-clock text-warning mb-2" style={{ fontSize: '1.5rem' }}></i>
                              <h6 className="mb-0">Best Time to Order</h6>
                              <p className="mb-0 text-muted">{predictionResult.timing.bestTimeToOrder}</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="card border-0 bg-primary bg-opacity-10">
                            <div className="card-body py-3 text-center">
                              <i className="fas fa-calendar text-primary mb-2" style={{ fontSize: '1.5rem' }}></i>
                              <h6 className="mb-0">Next Predicted Order</h6>
                              <p className="mb-0 text-muted">{predictionResult.timing.nextPredictedOrder}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Patterns */}
                      {predictionResult.patterns.length > 0 && (
                        <div className="mb-3">
                          <small className="text-muted fw-bold">DETECTED PATTERNS:</small>
                          <div className="mt-2">
                            {predictionResult.patterns.map((p, i) => (
                              <div key={i} className="d-flex align-items-center mb-2">
                                <span className={`badge me-2 ${p.type === 'time_based' ? 'bg-info' : p.type === 'frequency' ? 'bg-primary' : 'bg-secondary'}`}>
                                  {p.type.replace('_', ' ')}
                                </span>
                                <span>{p.description}</span>
                                <span className="ms-auto badge bg-light text-dark">{p.confidence}% confidence</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Predictions */}
                      {predictionResult.predictions.length > 0 ? (
                        <div className="card mb-3">
                          <div className="card-header bg-white py-2">
                            <small className="text-muted fw-bold">PREDICTED ITEMS</small>
                          </div>
                          <div className="card-body py-2">
                            {predictionResult.predictions.map((item) => (
                              <div key={item.productId} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                                <div className="d-flex align-items-center">
                                  <img src={item.image} alt="" width="45" height="45" className="rounded me-2" />
                                  <div>
                                    <span className="d-block">{item.name}</span>
                                    <small className="text-muted">from {item.merchantName}</small>
                                    <p className="text-primary mb-0 small"><i className="fas fa-robot me-1"></i>{item.reason}</p>
                                  </div>
                                </div>
                                <div className="text-end">
                                  <strong>${item.price}</strong>
                                  <div className="progress mt-1" style={{ width: '60px', height: '6px' }}>
                                    <div className="progress-bar bg-success" style={{ width: `${item.confidence}%` }}></div>
                                  </div>
                                  <small className="text-muted">{item.confidence}% match</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="alert alert-info">
                          <i className="fas fa-info-circle me-2"></i>
                          No predictions yet. Place a few orders and I'll learn your preferences!
                        </div>
                      )}

                      {/* Payment Method Selection */}
                      {predictionResult.suggestedCart.items.length > 0 && (
                        <div className="mb-3">
                          <small className="text-muted fw-bold d-block mb-2">PAYMENT METHOD</small>
                          <div className="btn-group w-100" role="group">
                            <input type="radio" className="btn-check" name="predictPayment" id="predict-upi" checked={selectedPaymentMethod === 'upi'} onChange={() => setSelectedPaymentMethod('upi')} />
                            <label className="btn btn-outline-warning" htmlFor="predict-upi"><i className="fas fa-mobile-alt me-1"></i>UPI</label>
                            <input type="radio" className="btn-check" name="predictPayment" id="predict-card" checked={selectedPaymentMethod === 'card'} onChange={() => setSelectedPaymentMethod('card')} />
                            <label className="btn btn-outline-warning" htmlFor="predict-card"><i className="fas fa-credit-card me-1"></i>Card</label>
                            <input type="radio" className="btn-check" name="predictPayment" id="predict-wallet" checked={selectedPaymentMethod === 'wallet'} onChange={() => setSelectedPaymentMethod('wallet')} />
                            <label className="btn btn-outline-warning" htmlFor="predict-wallet"><i className="fas fa-wallet me-1"></i>Wallet</label>
                            <input type="radio" className="btn-check" name="predictPayment" id="predict-cod" checked={selectedPaymentMethod === 'cod'} onChange={() => setSelectedPaymentMethod('cod')} />
                            <label className="btn btn-outline-warning" htmlFor="predict-cod"><i className="fas fa-money-bill-wave me-1"></i>COD</label>
                          </div>
                        </div>
                      )}

                      {/* Suggested Cart */}
                      {predictionResult.suggestedCart.items.length > 0 && (
                        <div className="card mb-3 border-warning">
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <div>
                                <strong>Suggested Quick Order</strong>
                                <p className="mb-0 small text-muted">{predictionResult.suggestedCart.items.length} items • {predictionResult.suggestedCart.confidence}% confidence</p>
                              </div>
                              <div className="text-end">
                                <strong className="text-primary" style={{ fontSize: '1.2rem' }}>${predictionResult.suggestedCart.estimatedTotal}</strong>
                              </div>
                            </div>
                            <button
                              className="btn btn-warning w-100"
                              onClick={handlePredictionCheckout}
                            >
                              <i className="fas fa-bolt me-2"></i>
                              Place Order
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="d-flex gap-3">
                        <button className="btn btn-outline-secondary flex-grow-1" onClick={resetFlow}>
                          <i className="fas fa-arrow-left me-2"></i>Back
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
