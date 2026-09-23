const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const store = {
  users: [{ id: 'u1', fbUid: 'fb1', email: 'user@example.com' }],
  wallets: [{ userId: 'u1', fbUid: 'fb1', main: 100, vault: 0, bonus: 0 }],
  investments: [],
  settings: { weeklyPercent: 2, monthlyPercent: 8, yearlyPercent: 100 }
};
const context = {
  console,
  Date,
  Math,
  Number,
  Object,
  String,
  JSON,
  setTimeout,
  clearTimeout,
  window: { addEventListener() {} },
  addEventListener() {},
  document: { addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  Auth: { getCurrentUserId: () => 'u1', getCurrentUser: () => ({ fbUid: 'fb1' }), checkAdminSession: () => false },
  Sync: { emit() {} },
  getFromStorage: (key, fallback) => store[key] ?? fallback,
  saveToStorage: (key, value) => { store[key] = value; },
  getUserWallet: (id) => store.wallets.find(w => String(w.userId) === String(id) || String(w.fbUid) === String(id)),
  saveWallet: (wallet) => { const i = store.wallets.findIndex(w => String(w.userId) === String(wallet.userId)); store.wallets[i] = wallet; },
  getSettings: () => store.settings
};
context.window = context;
vm.runInNewContext(fs.readFileSync(__dirname + '/investments.js', 'utf8'), context);
const api = context.window.NexgoldInvestments;
assert.deepEqual(Object.values(api.rules()).map(r => r.name), ['Gold regular', 'Premium class', 'Platinum members']);
let result = api.createRequest({ plan: 'premiumClass', amount: 25 });
assert.equal(result.success, true);
assert.equal(store.wallets[0].main, 75);
assert.equal(store.investments[0].status, 'pending');
assert.equal(api.approve(store.investments[0].id).success, true);
store.investments[0].lastAccruedAt = new Date(Date.now() - 2 * 86400000).toISOString();
const valueAfterTwoDays = api.accrued(store.investments[0]).currentValue;
assert.ok(valueAfterTwoDays > 25);
result = api.withdraw(store.investments[0].id, valueAfterTwoDays);
assert.equal(result.success, true);
assert.ok(store.wallets[0].main > 75);
assert.equal(store.investments[0].status, 'completed');
console.log('investment regression tests passed');
