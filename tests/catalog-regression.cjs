const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const box = { exports: {}, console, process, setTimeout, clearTimeout, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected import: ${name}`);
  }};
  vm.runInNewContext(source, box, { filename: file });
  return box.exports;
}
const data = load('app/api/agents/data.ts');
const next = { NextResponse: { json: body => body } };
const noAI = { llmJSON: async () => null, llmEnabled: () => false };
const request = body => ({ json: async () => body });
const coffeeIds = ['cafe-verde', 'bean-scene-coffee', 'daily-fresh-mart', 'south-delight'];
async function main() {
  const discover = load('app/api/agents/discover/route.ts', { 'next/server': next, '../data': data, '../llm': noAI });
  const assistant = load('app/api/agents/assistant/route.ts', { 'next/server': next, '../llm': noAI });
  const inventory = load('app/api/agents/inventory/route.ts', { 'next/server': next, '../data': data, '../llm': noAI });
  const queries = ['coffee', 'Coffee.', 'Can I get a coffee, please?', 'I would like a coffee, please.', 'I want a cup of coffee', 'Please get me some coffee!'];
  for (const query of queries) {
    const intent = await assistant.POST(request({ message: query }));
    assert.equal(intent.intent, 'order', query);
    const response = await discover.POST(request({ query: intent.orderQuery }));
    assert.deepEqual(Array.from(response.results.merchants, m => m.id), coffeeIds, query);
    for (const merchant of response.results.merchants) {
      const result = await inventory.POST(request({ merchantId: merchant.id, query }));
      assert.equal(result.results.hasAlternatives, false, `${query} at ${merchant.name}`);
      assert.equal(result.results.products.length, 1);
      assert.ok(result.results.products[0].tags.includes('coffee'));
    }
  }
  assert.equal((await discover.POST(request({ query: 'coffee', maxDistance: 0.05 }))).results.count, 0);
  const biryani = await discover.POST(request({ query: 'Can I get biryani, please?' }));
  assert.deepEqual(Array.from(biryani.results.merchants, m => m.id), ['spice-kitchen']);
  const unknown = await discover.POST(request({ query: 'Can I get a dragonfruit, please?' }));
  assert.equal(unknown.results.count, 0);
  const restricted = await discover.POST(request({ query: 'coffee from an Indian restaurant' }));
  assert.ok(!restricted.results.merchants.some(m => m.id === 'spice-kitchen'));
  const maliciousAI = { llmEnabled: () => true, llmJSON: async () => ({ matches: [{ id: 'spice-kitchen', reason: 'wrong category' }, { id: 'daily-fresh-mart', reason: 'outside radius' }] }) };
  const guarded = load('app/api/agents/discover/route.ts', { 'next/server': next, '../data': data, '../llm': maliciousAI });
  const guardedResult = await guarded.POST(request({ query: 'best coffee please', maxDistance: 0.2 }));
  assert.deepEqual(Array.from(guardedResult.results.merchants, m => m.id), ['cafe-verde']);
  console.log('PASS: 6 conversational coffee requests through assistant → discovery → inventory; 24 single coffee selections; punctuation, unknown items, biryani, radius and invalid AI candidates.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
