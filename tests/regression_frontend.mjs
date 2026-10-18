import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const FRONTEND = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const CUSTOMER_EMAIL = 'customer.e2e@example.com';
const CUSTOMER_PASSWORD = 'CustomerPass123!';
const MERCHANT_EMAIL = process.env.DEMO_MERCHANT_EMAIL || 'merchant.regression@example.com';
const MERCHANT_PASSWORD = process.env.DEMO_MERCHANT_PASSWORD || 'MerchantPass123!';

const results = [];
const failures = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
  if (!ok) failures.push({ name, detail });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function pageFileToUrl(file) {
  let rel = file.replaceAll('\\', '/').replace(/^app\//, '').replace(/\/page\.tsx$/, '');
  const parts = rel ? rel.split('/') : [];
  const urlParts = [];
  for (const part of parts) {
    if (part.startsWith('(') && part.endsWith(')')) continue;
    if (part.startsWith('[') && part.endsWith(']')) {
      const key = part.slice(1, -1);
      urlParts.push(key === 'merchantId' ? 'cafe-verde' : key === 'id' ? 'test' : 'test');
    } else urlParts.push(part);
  }
  return '/' + urlParts.join('/');
}

function apiFileToUrl(file) {
  let rel = file.replaceAll('\\', '/').replace(/^app\/api\//, '').replace(/\/route\.ts$/, '');
  const parts = rel.split('/').map((part) => {
    if (part.startsWith('[') && part.endsWith(']')) return 'test';
    return part;
  });
  return '/api/' + parts.join('/');
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

async function goto(name, url, expectedMax = 499) {
  try {
    const response = await page.goto(FRONTEND + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = response?.status() ?? 0;
    const ok = status > 0 && status <= expectedMax;
    record(name, ok, `${url} -> HTTP ${status}`);
    return response;
  } catch (err) {
    record(name, false, `${url}: ${err.message}`);
    return null;
  }
}

// Every Next page route must render without a 5xx response.
for (const file of walk('app').filter((f) => f.endsWith('/page.tsx') || f === 'app/page.tsx')) {
  const url = pageFileToUrl(file);
  await goto(`page render ${url}`, url);
}

// Branding + theme UI.
await goto('home page', '/');
const title = await page.title();
record('page title branded Loopora', /Loopora/i.test(title), title);
const bodyText = await page.locator('body').innerText();
record('visible app has no AI Mavericks branding', !/AI Mavericks/i.test(bodyText), /AI Mavericks/i.test(bodyText) ? 'old branding found' : 'clean');
const themeButton = page.locator('.theme-fab');
if (await themeButton.count()) {
  await themeButton.click();
  const pickerText = await page.locator('.theme-pop').innerText();
  record('Forest theme removed from picker', !/Forest/i.test(pickerText), pickerText.replace(/\n/g, ', '));
} else {
  record('theme picker exists', false, '.theme-fab not found');
}
record('template buy control absent', (await page.locator('.DZ-bt-buy-now').count()) === 0, '');
record('template support control absent', (await page.locator('.DZ-bt-support-now').count()) === 0, '');

// Customer registration client validation.
await goto('register page', '/register');
await page.locator('#register-name').fill('E2E Customer');
await page.locator('#register-email').fill(CUSTOMER_EMAIL);
await page.locator('#register-password').fill(CUSTOMER_PASSWORD);
await page.locator('#register-confirm-password').fill('DifferentPass123!');
await page.getByRole('button', { name: 'Create Account' }).click();
await page.locator('[role="alert"]').waitFor({ timeout: 5000 });
record('registration mismatch validation', /Passwords do not match/i.test(await page.locator('[role="alert"]').innerText()), await page.locator('[role="alert"]').innerText());

// Customer registration happy path.
await page.locator('#register-confirm-password').fill(CUSTOMER_PASSWORD);
await page.getByRole('button', { name: 'Create Account' }).click();
try {
  await page.waitForURL('**/shop', { timeout: 15000 });
  record('customer registration redirects to shop', true, page.url());
} catch {
  record('customer registration redirects to shop', false, page.url());
}
const customerToken = await page.evaluate(() => localStorage.getItem('customerToken'));
record('customer token stored in customer slot', Boolean(customerToken), customerToken ? 'present' : 'missing');

// Customer login invalid and valid.
await page.evaluate(() => localStorage.clear());
await goto('customer login page', '/login');
await page.locator('input[name="email"]').fill(CUSTOMER_EMAIL);
await page.locator('input[name="password"]').fill('WrongPassword!');
await page.getByRole('button', { name: 'Sign In' }).click();
await page.locator('[role="alert"]').waitFor({ timeout: 10000 });
record('customer invalid login shows error', /Incorrect|Invalid/i.test(await page.locator('[role="alert"]').innerText()), await page.locator('[role="alert"]').innerText());
await page.locator('input[name="password"]').fill(CUSTOMER_PASSWORD);
await page.getByRole('button', { name: 'Sign In' }).click();
try {
  await page.waitForURL('**/shop', { timeout: 15000 });
  record('customer valid login redirects to shop', true, page.url());
} catch {
  record('customer valid login redirects to shop', false, page.url());
}

// Merchant portal must reject a customer account.
await page.evaluate(() => localStorage.clear());
await goto('merchant login page', '/merchant/login');
await page.locator('#merchant-email').fill(CUSTOMER_EMAIL);
await page.locator('#merchant-password').fill(CUSTOMER_PASSWORD);
await page.getByRole('button', { name: 'Open merchant dashboard' }).click();
await page.locator('[role="alert"]').waitFor({ timeout: 10000 });
record('merchant login rejects customer role', /customer account/i.test(await page.locator('[role="alert"]').innerText()), await page.locator('[role="alert"]').innerText());

// Customer login must reject a merchant account.
await page.evaluate(() => localStorage.clear());
await goto('customer login merchant-role test', '/login');
await page.locator('input[name="email"]').fill(MERCHANT_EMAIL);
await page.locator('input[name="password"]').fill(MERCHANT_PASSWORD);
await page.getByRole('button', { name: 'Sign In' }).click();
await page.locator('[role="alert"]').waitFor({ timeout: 10000 });
record('customer login rejects merchant role', /merchant account/i.test(await page.locator('[role="alert"]').innerText()), await page.locator('[role="alert"]').innerText());

// Merchant happy path and dashboard data render.
await page.evaluate(() => localStorage.clear());
await goto('merchant login happy path page', '/merchant/login');
await page.locator('#merchant-email').fill(MERCHANT_EMAIL);
await page.locator('#merchant-password').fill(MERCHANT_PASSWORD);
await page.getByRole('button', { name: 'Open merchant dashboard' }).click();
try {
  await page.waitForURL('**/merchant/dashboard/cafe-verde', { timeout: 20000 });
  record('merchant valid login redirects to dashboard', true, page.url());
} catch {
  record('merchant valid login redirects to dashboard', false, page.url());
}
const merchantToken = await page.evaluate(() => localStorage.getItem('merchantToken'));
record('merchant token stored in merchant slot', Boolean(merchantToken), merchantToken ? 'present' : 'missing');
try {
  await page.getByText('Reviews & AI', { exact: true }).waitFor({ timeout: 15000 });
  record('merchant dashboard renders Reviews & AI tab', true, '');
} catch {
  record('merchant dashboard renders Reviews & AI tab', false, 'tab not visible');
}

// Unauthenticated direct merchant dashboard must redirect to merchant login.
await page.evaluate(() => localStorage.clear());
await goto('merchant dashboard unauthenticated entry', '/merchant/dashboard/cafe-verde');
try {
  await page.waitForURL('**/merchant/login', { timeout: 10000 });
  record('merchant dashboard requires login', true, page.url());
} catch {
  record('merchant dashboard requires login', false, page.url());
}

// Next.js API route sweep plus agent-specific payloads.
const payloads = {
  '/api/agents/assistant': { message: 'Find coffee and breakfast under 500' },
  '/api/agents/budget-shop': { query: 'breakfast', budget: 500 },
  '/api/agents/discover': { query: 'coffee', maxDistance: 10 },
  '/api/agents/inventory': { merchantId: 'cafe-verde', query: 'coffee' },
  '/api/agents/narrate': { query: 'Find a coffee shop' },
  '/api/agents/predict-order': { query: 'coffee' },
  '/api/agents/receipt': { merchant: 'Cafe Verde', items: [], total: 100, pointsEarned: 0 },
  '/api/agents/smart-cart': { query: 'coffee', budget: 500 },
  '/api/agents/call': { phone_number: '+10000000000' },
};

const routeFiles = walk('app/api').filter((f) => f.endsWith('/route.ts'));
for (const file of routeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const methods = [...text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g)].map((m) => m[1]);
  const url = apiFileToUrl(file);
  for (const method of methods) {
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(payloads[url] ?? {}) : undefined;
    try {
      const response = await fetch(FRONTEND + url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      let responseText = await response.text();
      const controlledMissingSecret = url === '/api/agents/call' && response.status === 500 && /BLAND_API_KEY is not configured/i.test(responseText);
      const controlledUnavailable = response.status === 503 && /disabled|unavailable|not configured|persistent|production/i.test(responseText);
      const ok = response.status < 500 || controlledMissingSecret || controlledUnavailable;
      record(`Next API ${method} ${url}`, ok, `HTTP ${response.status}; ${responseText.slice(0, 250).replace(/\n/g, ' ')}`);
    } catch (err) {
      record(`Next API ${method} ${url}`, false, err.message);
    }
  }
}

// Specifically require agent routes (other than call's missing secret) to stay operational without an LLM key.
for (const [url, payload] of Object.entries(payloads)) {
  if (url === '/api/agents/call') continue;
  try {
    const response = await fetch(FRONTEND + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const txt = await response.text();
    record(`agent scenario ${url}`, response.status < 500, `HTTP ${response.status}; ${txt.slice(0, 220).replace(/\n/g, ' ')}`);
  } catch (err) {
    record(`agent scenario ${url}`, false, err.message);
  }
}

record('no uncaught browser/page errors in core flow', consoleErrors.length === 0, consoleErrors.slice(0, 10).join(' | '));
await browser.close();

console.log('\n=== FRONTEND REGRESSION SUMMARY ===');
console.log(`Checks: ${results.length}  Passed: ${results.filter((x) => x.ok).length}  Failed: ${failures.length}`);
if (failures.length) {
  for (const failure of failures) console.log(`FAILED: ${failure.name}: ${failure.detail}`);
  process.exit(1);
}
