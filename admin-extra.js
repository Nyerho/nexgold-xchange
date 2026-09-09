/* ========================================
   ADMIN EXTRA FUNCTIONS - Profile modal,
   freeze/unfreeze UI helpers
   ======================================== */

function ensureUserProfileModal() {
    if (document.getElementById('userProfileModalOverlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'userProfileModalOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
    overlay.onclick = function(e) { if (e.target === overlay) window.closeUserProfileModal(); };
    var modal = document.createElement('div');
    modal.id = 'userProfileModal';
    modal.style.cssText = 'width:100%;max-width:720px;max-height:90vh;overflow-y:auto;background:linear-gradient(145deg,#0d0d0d,#000);border:1px solid rgba(212,175,55,0.3);border-radius:20px;padding:28px;position:relative;box-shadow:0 30px 80px rgba(0,0,0,0.8),0 0 80px rgba(212,175,55,0.08);';
    var content = document.createElement('div');
    content.id = 'userProfileModalContent';
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

window.openUserProfileModal = function(userId, editable) {
    ensureUserProfileModal();
    var overlay = document.getElementById('userProfileModalOverlay');
    var content = document.getElementById('userProfileModalContent');
    var profile = Admin.getUserFullProfile(userId);
    if (!profile || !profile.user) { showToast('User not found', 'error'); return; }
    var user = profile.user;
    var wallet = profile.wallet || { main:0, vault:0, bonus:0 };
    var walletUSD = profile.walletUSD || { mainUSD:0, vaultUSD:0, bonusUSD:0, totalUSD:0 };
    var isFrozen = user.frozen === true;
    var esc = function(s) {
        return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    };
    var txRows = (profile.transactions || []).slice(0, 10).map(function(t) {
        var ttype = String(t.type || 'BUY').toLowerCase();
        var cls = ttype === 'buy' ? 'buy' : 'sell';
        var vcol = String(t.type) === 'SELL' ? '#ef4444' : '#22c55e';
        return '<tr>' +
            '<td><span class="badge-' + cls + '">' + esc(t.type) + '</span></td>' +
            '<td>' + esc(t.karat || '24K') + ' - ' + formatNumber(t.grams || 0, 2) + 'g</td>' +
            '<td><strong style="color:' + vcol + ';">' + formatCurrency(t.price || 0) + '</strong></td>' +
            '<td><span style="padding:4px 10px;border-radius:10px;font-size:10.5px;font-weight:700;letter-spacing:0.4px;' + statusBadgeClass(t.status || TX_STATUS_APPROVED) + '">' + esc(t.status || TX_STATUS_APPROVED) + '</span></td>' +
            '<td style="font-size:11px;color:#7a7a7a;">' + esc(new Date(t.date || 0).toLocaleDateString()) + '</td>' +
        '</tr>';
    }).join('');
    var txSection;
    if (profile.transactions && profile.transactions.length > 0) {
        txSection = '<div style="max-height:180px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:10px;">' +
            '<table class="table table-nexgold align-middle mb-0">' +
            '<thead style="position:sticky;top:0;background:#0a0a0a;">' +
            '<tr><th>Type</th><th>Asset</th><th>Value</th><th>Status</th><th>Date</th></tr>' +
            '</thead><tbody>' + txRows + '</tbody></table></div>';
    } else {
        txSection = '<div style="padding:24px;text-align:center;color:#7a7a7a;font-size:13px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px dashed rgba(255,255,255,0.08);">' +
            '<i class="bi bi-journal-x" style="font-size:28px;opacity:0.4;margin-bottom:6px;display:block;"></i>No transactions yet</div>';
    }
    var statusBadge = isFrozen
        ? '<span style="font-size:10px;padding:3px 10px;border-radius:10px;background:rgba(239,68,68,0.15);color:#ef4444;font-weight:800;letter-spacing:0.5px;"><i class="bi bi-lock-fill"></i> FROZEN</span>'
        : '<span style="font-size:10px;padding:3px 10px;border-radius:10px;background:rgba(34,197,94,0.15);color:#22c55e;font-weight:800;letter-spacing:0.5px;"><i class="bi bi-unlock-fill"></i> ACTIVE</span>';
    var modeBadge = editable
        ? '<small style="color:#22c55e;font-weight:500;font-size:11px;letter-spacing:0.5px;"><i class="bi bi-pencil-square"></i> EDIT MODE</small>'
        : '<small style="color:#8a8a8a;font-weight:500;font-size:11px;letter-spacing:0.5px;">VIEW ONLY</small>';
    var disAttr = editable ? '' : ' disabled readonly';
    var disStyle = editable ? '' : ' background:rgba(255,255,255,0.03);color:#b0b0b0;';
    var pwPlaceholder = editable ? 'Leave blank to keep current' : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    var freezeBtn = isFrozen
        ? '<button onclick="window.adminToggleFreezeFromModal(' + user.id + ', false)" class="btn-sm-gold" style="flex:1;min-width:140px;background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 4px 12px rgba(34,197,94,0.3);border:0;"><i class="bi bi-unlock-fill"></i> Unfreeze Account</button>'
        : '<button onclick="window.adminToggleFreezeFromModal(' + user.id + ', true)" class="btn-sm-danger" style="flex:1;min-width:140px;"><i class="bi bi-lock-fill"></i> Freeze Account</button>';
    var saveBtn = editable
        ? '<button onclick="window.saveUserProfileFromModal(' + user.id + ')" class="btn-hero-gold" style="flex:2;min-width:160px;justify-content:center;"><i class="bi bi-save-fill"></i> Save Changes</button>'
        : '';

    content.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px;">' +
            '<div style="display:flex;align-items:center;gap:16px;">' +
                '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#D4AF37,#8A6A12);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:28px;box-shadow:0 8px 24px rgba(212,175,55,0.25);">' + esc((user.name || 'U').charAt(0).toUpperCase()) + '</div>' +
                '<div>' +
                    '<h3 style="margin:0;color:#fff;font-family:Playfair Display,serif;">' + esc(user.name || '') + '</h3>' +
                    '<p style="margin:4px 0 0 0;color:#8a8a8a;font-size:14px;">' + esc(user.email || '') + '</p>' +
                    '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' + statusBadge +
                        '<span style="font-size:10px;padding:3px 10px;border-radius:10px;background:rgba(139,92,246,0.12);color:#a78bfa;font-weight:700;letter-spacing:0.5px;">ID: #' + esc(String(user.id).slice(-5)) + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<button onclick="window.closeUserProfileModal()" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#8a8a8a;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:18px;flex-shrink:0;" title="Close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div style="background:linear-gradient(135deg, rgba(139,92,246,0.08), rgba(212,175,55,0.04));border:1px solid rgba(139,92,246,0.15);border-radius:14px;padding:18px;margin-bottom:20px;">' +
            '<div class="row g-3">' +
                '<div class="col-md-4"><div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Main Balance</div><div style="font-size:18px;font-weight:800;color:#fff;">' + formatCurrency(walletUSD.mainUSD || 0) + '</div><div style="font-size:11px;color:#7a7a7a;">' + formatNumber(wallet.main || 0, 4) + 'g</div></div>' +
                '<div class="col-md-4"><div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Vault Balance</div><div style="font-size:18px;font-weight:800;color:#60a5fa;">' + formatCurrency(walletUSD.vaultUSD || 0) + '</div><div style="font-size:11px;color:#7a7a7a;">' + formatNumber(wallet.vault || 0, 4) + 'g</div></div>' +
                '<div class="col-md-4"><div style="font-size:11px;color:#8a8a8a;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Bonus Balance</div><div style="font-size:18px;font-weight:800;color:#34d399;">' + formatCurrency(walletUSD.bonusUSD || 0) + '</div><div style="font-size:11px;color:#7a7a7a;">' + formatNumber(wallet.bonus || 0, 4) + 'g</div></div>' +
            '</div>' +
            '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;">' +
                '<span style="color:#8a8a8a;font-size:12px;">Total Portfolio Value</span>' +
                '<strong style="color:#D4AF37;font-size:20px;">' + formatCurrency(walletUSD.totalUSD || 0) + '</strong>' +
            '</div>' +
        '</div>' +
        '<div class="mb-4">' +
            '<h5 style="color:#fff;font-size:15px;margin-bottom:14px;display:flex;align-items:center;gap:8px;"><i class="bi bi-person-vcard" style="color:#8b5cf6;"></i>Account Details ' + modeBadge + '</h5>' +
            '<div class="row g-3">' +
                '<div class="col-md-6"><label class="form-label fw-600" style="font-size:12px;color:#8a8a8a;margin-bottom:4px;"><i class="bi bi-person-fill me-1" style="color:#D4AF37;"></i> Full Name</label><input type="text" id="upm_name" value="' + esc(user.name || '') + '"' + disAttr + ' class="form-control form-control-lg" style="' + disStyle + '"></div>' +
                '<div class="col-md-6"><label class="form-label fw-600" style="font-size:12px;color:#8a8a8a;margin-bottom:4px;"><i class="bi bi-envelope-fill me-1" style="color:#3b82f6;"></i> Email Address</label><input type="email" id="upm_email" value="' + esc(user.email || '') + '"' + disAttr + ' class="form-control form-control-lg" style="' + disStyle + '"></div>' +
                '<div class="col-md-6"><label class="form-label fw-600" style="font-size:12px;color:#8a8a8a;margin-bottom:4px;"><i class="bi bi-geo-alt-fill me-1" style="color:#ef4444;"></i> Country</label><input type="text" id="upm_country" value="' + esc(user.country || '') + '"' + disAttr + ' class="form-control form-control-lg" style="' + disStyle + '"></div>' +
                '<div class="col-md-6"><label class="form-label fw-600" style="font-size:12px;color:#8a8a8a;margin-bottom:4px;"><i class="bi bi-key-fill me-1" style="color:#a78bfa;"></i> Password</label><input type="password" id="upm_password" placeholder="' + pwPlaceholder + '"' + disAttr + ' class="form-control form-control-lg" style="' + disStyle + '"></div>' +
                '<div class="col-12"><label class="form-label fw-600" style="font-size:12px;color:#8a8a8a;margin-bottom:4px;"><i class="bi bi-house-door-fill me-1" style="color:#34d399;"></i> Address</label><textarea id="upm_address" rows="2"' + disAttr + ' class="form-control form-control-lg" style="' + disStyle + '">' + esc(user.address || '') + '</textarea></div>' +
            '</div>' +
        '</div>' +
        '<div class="mb-4">' +
            '<h5 style="color:#fff;font-size:15px;margin-bottom:14px;display:flex;align-items:center;gap:8px;"><i class="bi bi-journal-text" style="color:#D4AF37;"></i>Recent Transactions (' + (profile.transactions ? profile.transactions.length : 0) + ')</h5>' +
            txSection +
        '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">' +
            '<button onclick="window.closeUserProfileModal()" class="btn-home-outline" style="flex:1;min-width:120px;"><i class="bi bi-x-lg"></i> Close</button>' +
            freezeBtn + saveBtn +
        '</div>';
    overlay.style.display = 'flex';
};

window.closeUserProfileModal = function() {
    var overlay = document.getElementById('userProfileModalOverlay');
    if (overlay) overlay.style.display = 'none';
};

window.saveUserProfileFromModal = async function(userId) {
    var nameEl = document.getElementById('upm_name');
    var emailEl = document.getElementById('upm_email');
    var countryEl = document.getElementById('upm_country');
    var addressEl = document.getElementById('upm_address');
    var passwordEl = document.getElementById('upm_password');
    var name = nameEl ? nameEl.value.trim() : '';
    var email = emailEl ? emailEl.value.trim().toLowerCase() : '';
    var country = countryEl ? countryEl.value.trim() : '';
    var address = addressEl ? addressEl.value.trim() : '';
    var password = passwordEl ? passwordEl.value : '';
    if (!name || !email) { showToast('Name and email are required', 'error'); return; }
    var updates = { name: name, email: email, country: country, address: address };
    if (password && password.length > 0) updates.password = password;
    try {
        var result = await Promise.resolve(Admin.updateUserProfile(userId, updates));
        if (result.success) {
            showToast(result.message, 'success');
            if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch(e) {} }
            if (typeof renderUsersTable === 'function') renderUsersTable();
            if (typeof renderStats === 'function') renderStats();
            setTimeout(function() { window.closeUserProfileModal(); }, 400);
        } else {
            showToast((result && result.message) || 'Failed to update profile', 'error');
        }
    } catch (e) {
        showToast('Error: ' + (e.message || 'Unknown error'), 'error');
    }
};

window.adminToggleFreezeFromModal = async function(userId, freeze) {
    var user = getUserById(userId);
    var userName = user ? user.name : userId;
    var msg = (freeze ? 'FREEZE' : 'UNFREEZE') + ' account for: ' + userName + '?\n\n' + (freeze ? 'Frozen accounts cannot log in.' : 'This will restore account access.');
    if (!confirm(msg)) return;
    try {
        var result = await Promise.resolve(Admin.setAccountFrozen(userId, freeze));
        if (result.success) {
            showToast(result.message, freeze ? 'warning' : 'success');
            if (window.NexgoldGlobalSync) { try { window.NexgoldGlobalSync.forceSync(); } catch(e) {} }
            if (typeof renderUsersTable === 'function') renderUsersTable();
            setTimeout(function() {
                var nameEl = document.getElementById('upm_name');
                var isEdit = nameEl && !nameEl.hasAttribute('readonly');
                window.openUserProfileModal(userId, isEdit);
            }, 200);
        } else {
            showToast((result && result.message) || 'Action failed', 'error');
        }
    } catch (e) {
        showToast('Error: ' + (e.message || 'Unknown error'), 'error');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (window.Sync) {
        Sync.on('users', function() {
            try { if (typeof renderUsersTable === 'function') renderUsersTable(); } catch(e) {}
        });
    }
});
