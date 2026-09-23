/* Nexgold investment accounts: main wallet and investment balances never mix. */
(function () {
    const DAY = 86400000;
    const DEFAULT_RULES = {
        goldRegular: { name: 'Gold regular', description: 'A straightforward gold investment account with a configurable daily rule.', dailyRate: 0.08 / 365, bonusRate: 0 },
        premiumClass: { name: 'Premium class', description: 'A premium investment account with enhanced configurable rules.', dailyRate: 0.02 / 365, bonusRate: 0 },
        platinumMembers: { name: 'Platinum members', description: 'A platinum investment account with the highest configurable rule tier.', dailyRate: 0.01 / 365, bonusRate: 0 }
    };
    const n = (v, fallback = 0) => { const x = Number(typeof v === 'string' ? v.trim() : v); return Number.isFinite(x) ? x : fallback; };
    const now = () => new Date().toISOString();
    const list = () => getFromStorage('investments', []);
    const save = rows => { saveToStorage('investments', rows); try { Sync.emit('investments'); } catch (_) {} };
    const uid = () => Auth.getCurrentUserId && Auth.getCurrentUserId();
    const user = id => (getFromStorage('users', []).find(u => String(u.id) === String(id) || String(u.fbUid || '') === String(id)) || {});
    const wallet = id => getUserWallet(id) || getFromStorage('wallets', []).find(w => String(w.userId) === String(id));
    const persist = (item) => { try { const fb = window.FB; const owner = user(item.userId); if (fb && fb.enabled && fb.db && (owner.fbUid || item.fbUid)) fb.db.collection('investments').doc(String(item.id)).set(item, { merge: true }).catch(() => {}); } catch (_) {} };
    const rules = () => {
        const configured = getFromStorage('investmentRules', null);
        if (configured) {
            const aliases = { goldRegular: configured.goldRegular || configured.stable, premiumClass: configured.premiumClass || configured.growth, platinumMembers: configured.platinumMembers || configured.flexible };
            const defaults = DEFAULT_RULES;
            return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, { ...fallback, ...(aliases[key] || {}) }]));
        }
        const settings = typeof getSettings === 'function' ? getSettings() : {};
        return {
            goldRegular: { ...DEFAULT_RULES.goldRegular, dailyRate: n(settings.weeklyPercent, 2) / 100 / 7 },
            premiumClass: { ...DEFAULT_RULES.premiumClass, dailyRate: n(settings.monthlyPercent, 8) / 100 / 30 },
            platinumMembers: { ...DEFAULT_RULES.platinumMembers, dailyRate: n(settings.yearlyPercent, 100) / 100 / 365 }
        };
    };
    const accrued = (item, at = Date.now()) => {
        const principal = Math.max(0, n(item.principal, n(item.amount)));
        const base = Math.max(0, n(item.currentValue, principal));
        const rate = n(item.dailyRate);
        const start = new Date(item.lastAccruedAt || item.startAt || item.createdAt || now()).getTime();
        const days = Math.max(0, Math.floor((at - start) / DAY));
        const value = Math.max(0, base * Math.pow(Math.max(0, 1 + rate), days));
        const bonus = n(item.bonusAmount);
        return { principal, currentValue: value + bonus, profitLoss: value + bonus - principal, dailyRate: rate, days, bonus };
    };
    const write = (item, patch = {}) => { Object.assign(item, patch, { updatedAt: now() }); persist(item); return item; };
    const find = id => list().find(x => String(x.id) === String(id));

    window.NexgoldInvestments = {
        rules, accrued,
        getForUser(id = uid()) { return list().filter(x => String(x.userId) === String(id)); },
        createRequest({ plan = 'stable', amount, duration = '', note = '' } = {}) {
            const id = uid(); const grams = n(amount);
            const w = wallet(id); const selected = rules()[plan] || rules().goldRegular;
            if (!id || !w || grams <= 0) return { success: false, message: 'Enter a positive investment amount.' };
            if (n(w.main) < grams) return { success: false, message: 'Insufficient main wallet balance. Investment funds remain separate.' };
            w.main = Number((n(w.main) - grams).toFixed(6)); saveWallet(w);
            const item = { id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), userId: id, fbUid: Auth.getCurrentUser?.()?.fbUid || '', plan, planName: selected.name, description: selected.description, principal: grams, currentValue: grams, profitLoss: 0, dailyRate: n(selected.dailyRate), bonusAmount: 0, duration, note, status: 'pending', startAt: now(), lastAccruedAt: now(), createdAt: now() };
            const rows = list(); rows.push(item); save(rows); persist(item);
            return { success: true, item, message: 'Investment requested. The amount was moved from Main Wallet into the separate Investment Account.' };
        },
        approve(id) { const item = find(id); if (!item || item.status !== 'pending') return { success: false, message: 'Investment is not pending.' }; write(item, { status: 'active', approvedAt: now(), lastAccruedAt: now() }); save(list()); return { success: true, item }; },
        reject(id, reason = '') { const item = find(id); if (!item || item.status !== 'pending') return { success: false, message: 'Investment is not pending.' }; const w = wallet(item.userId); if (w) { w.main = Number((n(w.main) + n(item.principal)).toFixed(6)); saveWallet(w); } write(item, { status: 'rejected', rejectionReason: reason, rejectedAt: now(), currentValue: 0 }); save(list()); return { success: true, item, message: 'Rejected investment refunded to Main Wallet.' }; },
        update(id, patch) { const item = find(id); if (!item) return { success: false, message: 'Investment not found.' }; const live = accrued(item); write(item, { currentValue: Math.max(0, n(patch.currentValue, live.currentValue)), dailyRate: n(patch.dailyRate, item.dailyRate), bonusAmount: Math.max(0, n(patch.bonusAmount, item.bonusAmount)), status: patch.status || item.status, lastAccruedAt: now(), profitLoss: n(patch.currentValue, live.currentValue) - live.principal }); save(list()); return { success: true, item }; },
        withdraw(id, amount) { const item = find(id); const take = n(amount); if (!item || !['active', 'approved'].includes(item.status)) return { success: false, message: 'Investment is not active.' }; const live = accrued(item); if (take <= 0 || take > live.currentValue) return { success: false, message: 'Withdrawal exceeds the separate investment balance.' }; const remaining = live.currentValue - take; const w = wallet(item.userId); if (!w) return { success: false, message: 'Main wallet not found.' }; w.main = Number((n(w.main) + take).toFixed(6)); saveWallet(w); write(item, { currentValue: remaining, profitLoss: remaining - live.principal, lastAccruedAt: now(), status: remaining <= 0.0000001 ? 'completed' : 'active' }); save(list()); return { success: true, item, message: 'Investment withdrawal moved into Main Wallet.' }; },
        addBonus(id, amount) { const item = find(id); if (!item) return { success: false, message: 'Investment not found.' }; const live = accrued(item); return this.update(id, { currentValue: live.currentValue, bonusAmount: n(item.bonusAmount) + n(amount) }); }
    };

    function fmt(v) { return n(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
    function card(item, admin = false) { const v = accrued(item); return `<div class="card mb-3" style="border:1px solid rgba(212,175,55,.25);"><div class="card-body"><div class="d-flex justify-content-between gap-2 flex-wrap"><div><h5 class="mb-1">${item.planName || item.plan || 'Investment Account'}</h5><small class="text-muted">${item.description || ''}</small></div><span class="badge">${item.status}</span></div><div class="row g-2 mt-3"><div class="col-6 col-md-3"><small>Principal</small><strong class="d-block">${fmt(v.principal)} g</strong></div><div class="col-6 col-md-3"><small>Current value</small><strong class="d-block">${fmt(v.currentValue)} g</strong></div><div class="col-6 col-md-3"><small>Profit / loss</small><strong class="d-block ${v.profitLoss >= 0 ? 'text-success' : 'text-danger'}">${fmt(v.profitLoss)} g</strong></div><div class="col-6 col-md-3"><small>Daily rule</small><strong class="d-block">${(v.dailyRate * 100).toFixed(4)}%</strong></div></div>${admin ? `<div class="d-flex gap-2 mt-3 flex-wrap">${item.status === 'pending' ? `<button class="btn-sm-gold" data-invest-approve="${item.id}">Approve</button><button class="btn-sm-danger" data-invest-reject="${item.id}">Reject / refund</button>` : `<button class="btn-sm-blue" data-invest-edit="${item.id}">Edit account</button>`}</div>` : item.status === 'active' ? `<div class="d-flex gap-2 mt-3"><input class="form-control" type="number" min="0.000001" step="0.000001" placeholder="Amount to Main Wallet" data-invest-withdraw-input="${item.id}"><button class="btn-sm-gold" data-invest-withdraw="${item.id}">Withdraw to Main</button></div>` : ''}</div></div>`; }
    function renderUser() { const section = document.getElementById('invest'); if (!section || !uid()) return; let box = document.getElementById('investmentAccountsBox'); if (!box) { box = document.createElement('div'); box.id = 'investmentAccountsBox'; section.prepend(box); } const rs = rules(); box.innerHTML = `<div class="card mb-4"><div class="card-body"><h4>Start a separate investment account</h4><p class="text-muted">Funds are deducted from Main Wallet immediately, then profits, losses, and bonuses stay in this account until you withdraw them.</p><div class="row g-2"><div class="col-md-4"><select id="investmentPlan" class="form-select">${Object.entries(rs).map(([k, r]) => `<option value="${k}">${r.name} — ${(n(r.dailyRate) * 100).toFixed(4)}% daily</option>`).join('')}</select></div><div class="col-md-3"><input id="investmentAmount" type="number" min="0.000001" step="0.000001" class="form-control" placeholder="Amount in grams"></div><div class="col-md-3"><input id="investmentDuration" class="form-control" placeholder="Duration / note"></div><div class="col-md-2"><button id="investmentStart" class="btn-hero-gold w-100">Invest</button></div></div><p id="investmentMessage" class="form-text mt-2"></p></div></div><h4 class="mb-3">Your investment accounts</h4>${NexgoldInvestments.getForUser().map(x => card(x)).join('') || '<p class="text-muted">No investment accounts yet.</p>'}`; document.getElementById('investmentStart')?.addEventListener('click', () => { const r = NexgoldInvestments.createRequest({ plan: document.getElementById('investmentPlan').value, amount: document.getElementById('investmentAmount').value, duration: document.getElementById('investmentDuration').value }); const m = document.getElementById('investmentMessage'); m.textContent = r.message; m.className = 'form-text ' + (r.success ? 'text-success' : 'text-danger'); renderUser(); }); section.querySelectorAll('[data-invest-withdraw]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.investWithdraw; const input = section.querySelector(`[data-invest-withdraw-input="${id}"]`); const r = NexgoldInvestments.withdraw(id, input?.value); alert(r.message); renderUser(); })); }
    function renderAdmin() { if (!document.getElementById('adminMainScreen') || !Auth.checkAdminSession(false)) return; let box = document.getElementById('investmentAdminBox'); if (!box) { box = document.createElement('div'); box.id = 'investmentAdminBox'; box.className = 'card mb-5'; document.querySelector('#adminMainScreen .container-fluid')?.append(box); } const rs = rules(); box.innerHTML = `<div class="card-header"><h4 class="mb-0">Investment rules & accounts</h4><small class="text-muted">Daily rules are applied automatically for each elapsed day when an account is viewed or edited.</small></div><div class="card-body"><div class="row g-2 mb-4">${Object.entries(rs).map(([k, r]) => `<div class="col-md-4"><label>${r.name} daily rate</label><input class="form-control" id="rule-${k}" type="number" step="0.000001" value="${(n(r.dailyRate) * 100).toFixed(6)}"><small class="text-muted">Percent per day; negative values record losses.</small></div>`).join('')}</div><button class="btn-sm-gold mb-4" id="saveInvestmentRules">Save investment rules</button><div>${list().map(x => card(x, true)).join('') || '<p class="text-muted">No investment accounts.</p>'}</div></div>`; document.getElementById('saveInvestmentRules')?.addEventListener('click', () => { const next = {}; Object.entries(rs).forEach(([k, r]) => next[k] = { ...r, dailyRate: n(document.getElementById('rule-' + k).value) / 100 }); saveToStorage('investmentRules', next); alert('Investment rules saved.'); renderAdmin(); }); box.querySelectorAll('[data-invest-approve]').forEach(b => b.onclick = () => { NexgoldInvestments.approve(b.dataset.investApprove); renderAdmin(); }); box.querySelectorAll('[data-invest-reject]').forEach(b => b.onclick = () => { NexgoldInvestments.reject(b.dataset.investReject, 'Rejected by admin'); renderAdmin(); }); box.querySelectorAll('[data-invest-edit]').forEach(b => b.onclick = () => { const x = find(b.dataset.investEdit); const value = prompt('Set current investment value in grams', accrued(x).currentValue); if (value !== null) { const rate = prompt('Set daily rate percent (negative = loss)', accrued(x).dailyRate * 100); const bonus = prompt('Set bonus amount in grams', x.bonusAmount || 0); NexgoldInvestments.update(x.id, { currentValue: n(value), dailyRate: n(rate) / 100, bonusAmount: n(bonus) }); renderAdmin(); } }); }
    document.addEventListener('click', e => { if (e.target.closest('.switchToInvest')) setTimeout(renderUser, 0); });
    window.addEventListener('storage', () => { renderUser(); renderAdmin(); });
    document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { renderUser(); renderAdmin(); }, 500); setInterval(() => { renderUser(); renderAdmin(); }, 60000); });
})();
