/**
 * app.js — Property portfolio
 *
 * Data lives only on this device in localStorage. The GitHub-hosted code
 * shell never receives or transmits your numbers. Phone lock is the
 * security boundary.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pt:data';

  // ============================================================
  // State
  // ============================================================
  let state = { data: null };

  const DEFAULT_DATA = {
    schemaVersion: 1,
    lastUpdated: new Date().toISOString().slice(0, 10),
    properties: [],
    accounts: [],
    sale: null
  };

  // ============================================================
  // Utilities
  // ============================================================
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
      });
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    });
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  const fmtMoney = (n, dp = 0) => {
    if (n == null || isNaN(n)) return '—';
    const abs = Math.abs(n);
    const str = abs.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (n < 0 ? '−$' : '$') + str;
  };
  const fmtShort = (n) => {
    if (n == null || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e6) return (n < 0 ? '−' : '') + '$' + (Math.abs(n) / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(n) / 1e3) + 'K';
    return fmtMoney(n);
  };
  const fmtPct1 = (n) => (n == null || isNaN(n)) ? '—' : (n * 100).toFixed(1) + '%';

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v8h-4v-6H10v6H6v-8H3l9-8z"/></svg>',
    building: '<svg viewBox="0 0 24 24"><path d="M3 21h18v-2H3v2zM5 3v16h6v-4h2v4h6V3H5zm4 12H7v-2h2v2zm0-4H7V9h2v2zm0-4H7V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 8h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2z"/></svg>',
    tree: '<svg viewBox="0 0 24 24"><path d="M12 2L5 11h4v4h6v-4h4l-7-9zm-1 14h2v6h-2v-6z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24"><path d="M21 7H5a2 2 0 0 1 0-4h13v2H5v0h16v2zm0 1H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h16v-3h-2a2 2 0 0 1 0-4h2V8zm-4 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    receipt: '<svg viewBox="0 0 24 24"><path d="M19 2H5L3 5v17l3-2 3 2 3-2 3 2 3-2 3 2V5l-2-3zm0 16.07l-1.5-.95-3 1.88-3-1.88-3 1.88-3-1.88L4 18.07V5h15v13.07zM6 9h12v2H6V9zm0-3h12v2H6V6zm0 6h9v2H6v-2z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.43 5.5l1.74-1.4-2-3.46-2.05.83a8 8 0 0 0-1.94-1.13L17 6h-4l-.18 2.34a8 8 0 0 0-1.94 1.13l-2.05-.83-2 3.46 1.74 1.4a8.1 8.1 0 0 0 0 2.26l-1.74 1.4 2 3.46 2.05-.83c.6.47 1.25.85 1.94 1.13L13 22h4l.18-2.34a8 8 0 0 0 1.94-1.13l2.05.83 2-3.46-1.74-1.4a8.1 8.1 0 0 0 0-2.5z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zM4 18h16v2H4z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M12 4l5 5h-3v7h-4V9H7l5-5zM4 18h16v2H4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>'
  };

  // ============================================================
  // Persistence
  // ============================================================
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse stored data', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function saveData() {
    if (!state.data) return;
    state.data.lastUpdated = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  // ============================================================
  // Calculations
  // ============================================================
  const interestBearing = (p) => Math.max(0, (p.currentBalance || 0) - (p.offsetBalance || 0));
  const monthlyInterest = (p) => interestBearing(p) * (p.rate || 0) / 12;
  const principalRed = (p) => (p.monthlyRepayment || 0) - monthlyInterest(p);
  const totalMV = () => state.data.properties.reduce((s, p) => s + (p.marketValue || 0), 0);
  const totalLoans = () => state.data.properties.reduce((s, p) => s + (p.currentBalance || 0), 0);
  const totalEquity = () => totalMV() - totalLoans();
  const totalCash = () => state.data.accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalMonthlyInterest = () => state.data.properties.reduce((s, p) => s + monthlyInterest(p), 0);
  const totalMonthlyRepayment = () => state.data.properties.reduce((s, p) => s + (p.monthlyRepayment || 0), 0);
  const totalMonthlyRent = () => state.data.properties.reduce((s, p) => s + (p.monthlyRentNet || 0), 0);

  function saleCalcs() {
    const s = state.data.sale;
    if (!s) return null;
    const sellingCosts = (s.commission || 0) + (s.legalFees || 0) + (s.bankDischarge || 0) + (s.sundries || 0);
    const netSaleProceeds = (s.salePrice || 0) - sellingCosts;
    const netCashAtSettlement = netSaleProceeds - (s.loanPayout || 0);
    const palLoan = state.data.properties.find((p) => p.id === s.propertyId);
    const ibBal = palLoan ? Math.max(0, (palLoan.currentBalance || 0) - (palLoan.offsetBalance || 0)) : 0;
    const holdingInterest = ibBal * (s.landRate || 0) * (s.holdingDays || 0) / 365;
    const depOct = (s.depositOct || 0) * (s.landRate || 0) * (s.depositOctDays || 0) / 365;
    const depFeb = (s.depositFeb || 0) * (s.landRate || 0) * (s.depositFebDays || 0) / 365;
    const totalHolding = holdingInterest + depOct + depFeb + (s.builderDepositLost || 0);
    const grossGain = (s.salePrice || 0) - (s.costBasis || 0);
    const netGain = grossGain - sellingCosts - totalHolding;
    return { sellingCosts, netSaleProceeds, netCashAtSettlement, holdingInterest, depOct, depFeb, totalHolding, grossGain, netGain };
  }

  // ============================================================
  // Editable money input
  // ============================================================
  function moneyInput(initial, onChange, opts) {
    opts = opts || {};
    const input = el('input', {
      type: 'text',
      class: 'money-input' + (opts.pct ? ' pct' : ''),
      inputmode: opts.pct ? 'decimal' : 'numeric',
      value: opts.pct ? ((initial || 0) * 100).toFixed(2) + '%' : fmtMoney(initial || 0, opts.dp || 0)
    });
    input.dataset.raw = String(initial || 0);
    input.addEventListener('focus', () => {
      input.value = String(input.dataset.raw);
      setTimeout(() => input.select(), 0);
    });
    input.addEventListener('blur', () => {
      const cleaned = input.value.replace(/[^\d.\-]/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed >= 0) {
        const newVal = opts.pct ? parsed / 100 : parsed;
        if (Math.abs(newVal - parseFloat(input.dataset.raw)) > 1e-9) {
          input.dataset.raw = String(newVal);
          onChange(newVal);
          saveData();
          rerender();
          toast('Saved');
        } else {
          input.value = opts.pct ? (newVal * 100).toFixed(2) + '%' : fmtMoney(newVal, opts.dp || 0);
        }
      } else {
        input.value = opts.pct ? ((initial || 0) * 100).toFixed(2) + '%' : fmtMoney(initial || 0, opts.dp || 0);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        input.value = opts.pct ? ((initial || 0) * 100).toFixed(2) + '%' : fmtMoney(initial || 0, opts.dp || 0);
        input.blur();
      }
    });
    return input;
  }

  function row(label, value, opts) {
    opts = opts || {};
    const valEl = el('div', { class: 'row-value' + (opts.muted ? ' muted' : '') + (opts.tone ? ' ' + opts.tone : '') });
    if (typeof value === 'string') valEl.textContent = value;
    else valEl.appendChild(value);
    return el('div', { class: 'row' },
      el('div', { class: 'row-label' }, label),
      valEl
    );
  }

  // ============================================================
  // Main UI
  // ============================================================
  function renderApp() {
    const app = $('#app');
    clear(app);

    const shell = el('div', { class: 'app-shell' });

    shell.appendChild(el('div', { class: 'topbar' },
      el('div', null,
        el('h1', null, 'Property portfolio'),
        el('div', { class: 'topbar-subtitle' }, 'Updated ' + (state.data.lastUpdated || '—'))
      ),
      el('div', { class: 'topbar-actions' },
        el('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: openSettings, html: ICONS.settings })
      )
    ));

    if (state.data.properties.length === 0) {
      shell.appendChild(el('div', { class: 'empty' },
        el('h2', null, 'Get started'),
        el('p', null, 'Add your first property, or import data from a JSON file.'),
        el('button', { class: 'btn btn-primary', onclick: addProperty }, '+ Add property'),
        el('button', { class: 'btn', onclick: openImport }, 'Import from JSON')
      ));
      app.appendChild(shell);
      return;
    }

    shell.appendChild(el('div', { class: 'hero' },
      el('div', { class: 'hero-label' }, 'Total equity'),
      el('div', { class: 'hero-value' }, fmtMoney(totalEquity())),
      el('div', { class: 'hero-meta' },
        state.data.properties.length + ' propert' + (state.data.properties.length === 1 ? 'y' : 'ies') +
        (state.data.sale ? ' · 1 sale pending' : '')
      )
    ));

    const mvNum = totalMV();
    const loansNum = totalLoans();
    shell.appendChild(el('div', { class: 'metrics' },
      el('div', { class: 'metric' },
        el('div', { class: 'metric-label' }, 'Market value'),
        el('div', { class: 'metric-value' }, fmtShort(mvNum))
      ),
      el('div', { class: 'metric' },
        el('div', { class: 'metric-label' }, 'Total loans'),
        el('div', { class: 'metric-value' }, fmtShort(loansNum))
      ),
      el('div', { class: 'metric' },
        el('div', { class: 'metric-label' }, 'LVR'),
        el('div', { class: 'metric-value' }, mvNum ? fmtPct1(loansNum / mvNum) : '—')
      ),
      el('div', { class: 'metric' },
        el('div', { class: 'metric-label' }, 'Cash / Offset'),
        el('div', { class: 'metric-value' }, fmtShort(totalCash()))
      )
    ));

    shell.appendChild(el('div', { class: 'section-head' },
      el('div', { class: 'section-title' }, 'Properties'),
      el('button', { class: 'section-action', onclick: addProperty }, '+ Add')
    ));
    state.data.properties.forEach((p) => shell.appendChild(renderPropertyCard(p)));

    if (state.data.sale) {
      shell.appendChild(el('div', { class: 'section-head' },
        el('div', { class: 'section-title' }, 'Sale outcome')
      ));
      shell.appendChild(renderSaleCard());
    }

    shell.appendChild(el('div', { class: 'section-head' },
      el('div', { class: 'section-title' }, 'Cash & offset'),
      el('button', { class: 'section-action', onclick: addAccount }, '+ Add')
    ));
    state.data.accounts.forEach((a) => shell.appendChild(renderAccountCard(a)));

    shell.appendChild(el('div', { class: 'section-head' },
      el('div', { class: 'section-title' }, 'Monthly cashflow')
    ));
    const cf = el('div', { class: 'card' });
    cf.appendChild(row('Total monthly interest', fmtMoney(totalMonthlyInterest(), 2), { tone: 'danger' }));
    cf.appendChild(row('Total monthly repayments', fmtMoney(totalMonthlyRepayment(), 2), { tone: 'danger' }));
    cf.appendChild(row('Total monthly rent', fmtMoney(totalMonthlyRent(), 2), { tone: 'success' }));
    const net = totalMonthlyRent() - totalMonthlyRepayment();
    cf.appendChild(row('Net (rent − repayments)', fmtMoney(net, 2), { tone: net >= 0 ? 'success' : 'danger' }));
    shell.appendChild(cf);

    shell.appendChild(el('div', { class: 'app-footer' }, 'Data stays on this device · Tap any number to edit'));
    app.appendChild(shell);
  }

  function renderPropertyCard(p) {
    const sold = p.status === 'sold';
    const iconKey = p.type === 'Residential' ? 'home' : (p.icon === 'tree' ? 'tree' : 'building');
    const card = el('div', { class: 'card' + (sold ? ' sold' : '') });

    card.appendChild(el('div', { class: 'prop-head' },
      el('div', { class: 'prop-icon' + (sold ? ' sold' : ''), html: ICONS[iconKey] }),
      el('div', { style: { flex: '1', minWidth: 0 } },
        el('div', { class: 'prop-name' }, p.name || 'Untitled'),
        el('div', { class: 'prop-addr' }, (p.address || '') + (p.type ? ' · ' + p.type : ''))
      ),
      sold && el('span', { class: 'badge' }, 'Sold'),
      el('button', { class: 'icon-btn', 'aria-label': 'Edit details', onclick: () => editPropertyDetails(p.id), html: ICONS.settings, style: { width: '32px', height: '32px' } })
    ));

    card.appendChild(row('Market value', moneyInput(p.marketValue, (v) => p.marketValue = v)));
    card.appendChild(row('Loan balance', moneyInput(p.currentBalance, (v) => p.currentBalance = v, { dp: 2 })));
    card.appendChild(row('Offset', moneyInput(p.offsetBalance, (v) => p.offsetBalance = v, { dp: 2 })));
    card.appendChild(row('Interest rate', moneyInput(p.rate, (v) => p.rate = v, { pct: true })));
    card.appendChild(row('Monthly interest', fmtMoney(monthlyInterest(p), 2), { muted: true, tone: 'danger' }));
    card.appendChild(row('Monthly repayment', moneyInput(p.monthlyRepayment, (v) => p.monthlyRepayment = v, { dp: 2 })));
    card.appendChild(row('Principal / month', fmtMoney(principalRed(p), 2), { muted: true, tone: 'success' }));
    if ((p.weeklyRent || 0) > 0 || (p.monthlyRentNet || 0) > 0) {
      card.appendChild(row('Weekly rent', moneyInput(p.weeklyRent, (v) => p.weeklyRent = v)));
      card.appendChild(row('Net rent / month', moneyInput(p.monthlyRentNet, (v) => p.monthlyRentNet = v)));
    }
    return card;
  }

  function renderSaleCard() {
    const s = state.data.sale;
    const c = saleCalcs();
    const card = el('div', { class: 'card sold' });

    card.appendChild(el('div', { class: 'prop-head' },
      el('div', { class: 'prop-icon sold', html: ICONS.receipt }),
      el('div', { style: { flex: '1' } },
        el('div', { class: 'prop-name' }, s.title || 'Sale'),
        el('div', { class: 'prop-addr' }, 'Settles ' + (s.settlementDate || '—'))
      )
    ));

    card.appendChild(row('Sale price', moneyInput(s.salePrice, (v) => s.salePrice = v)));
    card.appendChild(row('Cost basis', moneyInput(s.costBasis, (v) => s.costBasis = v)));
    card.appendChild(row('Gross gain', fmtMoney(c.grossGain), { muted: true }));

    card.appendChild(el('div', { class: 'subsection' }, 'Selling costs'));
    card.appendChild(row('Real estate commission', moneyInput(s.commission, (v) => s.commission = v)));
    card.appendChild(row('Legal / conveyancing', moneyInput(s.legalFees, (v) => s.legalFees = v)));
    card.appendChild(row('Bank discharge fee', moneyInput(s.bankDischarge, (v) => s.bankDischarge = v)));
    card.appendChild(row('Council rates · est.', moneyInput(s.sundries, (v) => s.sundries = v)));

    card.appendChild(el('div', { class: 'subsection' }, 'Holding & sunk costs'));
    card.appendChild(row('Loan interest · ' + (s.holdingDays || 0) + ' days', fmtMoney(c.holdingInterest, 2), { muted: true, tone: 'danger' }));
    card.appendChild(row('Interest on Oct deposit', fmtMoney(c.depOct, 2), { muted: true, tone: 'danger' }));
    card.appendChild(row('Interest on Feb deposit', fmtMoney(c.depFeb, 2), { muted: true, tone: 'danger' }));
    card.appendChild(row('Builder deposit forfeited', moneyInput(s.builderDepositLost, (v) => s.builderDepositLost = v)));

    card.appendChild(el('div', { class: 'divider' }));
    card.appendChild(row('Loan payout', moneyInput(s.loanPayout, (v) => s.loanPayout = v)));
    card.appendChild(row('Net cash at settlement', fmtMoney(c.netCashAtSettlement), { tone: 'success' }));

    const grand = el('div', { class: 'grand-total' });
    grand.appendChild(el('div', { class: 'grand-total-label' }, 'Net economic gain'));
    grand.appendChild(el('div', { class: 'grand-total-value' + (c.netGain < 0 ? ' loss' : '') }, fmtMoney(c.netGain)));
    card.appendChild(grand);

    return card;
  }

  function renderAccountCard(a) {
    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'prop-head' },
      el('div', { class: 'prop-icon', html: ICONS.wallet }),
      el('div', { style: { flex: '1' } },
        el('div', { class: 'prop-name' }, a.name || 'Account'),
        el('div', { class: 'prop-addr' }, a.linkedTo || '')
      )
    ));
    card.appendChild(row('Balance', moneyInput(a.balance, (v) => a.balance = v, { dp: 2 })));
    return card;
  }

  // ============================================================
  // Dialogs
  // ============================================================
  function openModal(node) {
    const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); } },
      el('div', { class: 'modal' }, node)
    );
    document.body.appendChild(backdrop);
    return () => { if (backdrop.parentNode) document.body.removeChild(backdrop); };
  }

  function addProperty() {
    const nameI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, placeholder: 'Property name' });
    const addrI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, placeholder: 'Address' });
    const typeS = el('select', { class: 'money-input', style: { width: '100%', textAlign: 'left' } },
      el('option', { value: 'Residential' }, 'Residential (owner-occupied)'),
      el('option', { value: 'Investment' }, 'Investment')
    );
    let close;
    const content = el('div', null,
      el('h2', null, 'Add property'),
      el('div', { style: { marginBottom: '10px' } }, nameI),
      el('div', { style: { marginBottom: '10px' } }, addrI),
      el('div', { style: { marginBottom: '10px' } }, typeS),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          if (!nameI.value.trim()) { nameI.focus(); return; }
          state.data.properties.push({
            id: 'p_' + Date.now(),
            name: nameI.value.trim(),
            address: addrI.value.trim(),
            type: typeS.value,
            icon: typeS.value === 'Residential' ? 'home' : 'building',
            marketValue: 0, currentBalance: 0, offsetBalance: 0, rate: 0.06,
            monthlyRepayment: 0, weeklyRent: 0, monthlyRentNet: 0,
            status: 'active'
          });
          saveData();
          close();
          rerender();
          toast('Added');
        } }, 'Save')
      )
    );
    close = openModal(content);
    setTimeout(() => nameI.focus(), 50);
  }

  function editPropertyDetails(id) {
    const p = state.data.properties.find((x) => x.id === id);
    if (!p) return;
    const nameI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, value: p.name || '' });
    const addrI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, value: p.address || '' });
    const typeS = el('select', { class: 'money-input', style: { width: '100%', textAlign: 'left' } },
      el('option', { value: 'Residential' }, 'Residential (owner-occupied)'),
      el('option', { value: 'Investment' }, 'Investment')
    );
    typeS.value = p.type || 'Investment';
    const statusS = el('select', { class: 'money-input', style: { width: '100%', textAlign: 'left' } },
      el('option', { value: 'active' }, 'Active'),
      el('option', { value: 'sold' }, 'Sold (pending settlement)')
    );
    statusS.value = p.status || 'active';

    let close;
    const content = el('div', null,
      el('h2', null, 'Edit property'),
      el('p', null, 'Name'), nameI,
      el('p', null, 'Address'), addrI,
      el('p', null, 'Type'), typeS,
      el('p', null, 'Status'), statusS,
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-danger', onclick: () => {
          if (!confirm('Delete this property?')) return;
          state.data.properties = state.data.properties.filter((x) => x.id !== id);
          saveData();
          close();
          rerender();
          toast('Deleted');
        } }, 'Delete'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          p.name = nameI.value.trim();
          p.address = addrI.value.trim();
          p.type = typeS.value;
          p.status = statusS.value;
          p.icon = typeS.value === 'Residential' ? 'home' : 'building';
          saveData();
          close();
          rerender();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
  }

  function addAccount() {
    const nameI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, placeholder: 'Account name (e.g. ANZ One Offset)' });
    const linkI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, placeholder: 'Linked to (e.g. Property 1)' });
    const balI = el('input', { class: 'money-input', style: { width: '100%', textAlign: 'left' }, placeholder: 'Balance', type: 'text', inputmode: 'decimal' });
    let close;
    const content = el('div', null,
      el('h2', null, 'Add account'),
      el('div', { style: { marginBottom: '10px' } }, nameI),
      el('div', { style: { marginBottom: '10px' } }, linkI),
      el('div', { style: { marginBottom: '10px' } }, balI),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          if (!nameI.value.trim()) return;
          const balance = parseFloat(balI.value.replace(/[^\d.\-]/g, '')) || 0;
          state.data.accounts.push({ name: nameI.value.trim(), linkedTo: linkI.value.trim(), balance: balance });
          saveData();
          close();
          rerender();
          toast('Added');
        } }, 'Save')
      )
    );
    close = openModal(content);
    setTimeout(() => nameI.focus(), 50);
  }

  // ============================================================
  // Settings: import / export / wipe
  // ============================================================
  function openSettings() {
    let close;
    const content = el('div', null,
      el('h2', null, 'Settings'),
      el('button', { class: 'btn btn-icon', onclick: () => { close(); openExport(); } },
        el('span', { html: ICONS.download }), 'Export data (backup)'),
      el('button', { class: 'btn btn-icon', onclick: () => { close(); openImport(); } },
        el('span', { html: ICONS.upload }), 'Import data'),
      el('button', { class: 'btn btn-icon btn-danger', onclick: () => { close(); confirmWipe(); } },
        el('span', { html: ICONS.trash }), 'Clear all data'),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Close')
      )
    );
    close = openModal(content);
  }

  function openExport() {
    const json = JSON.stringify(state.data, null, 2);
    const ta = el('textarea', { readonly: 'readonly' });
    ta.value = json;
    let close;
    const content = el('div', null,
      el('h2', null, 'Export data'),
      el('p', null, 'Save a backup of your portfolio. Useful if you switch phones or want a snapshot.'),
      ta,
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Close'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          ta.select();
          navigator.clipboard.writeText(json).then(() => toast('Copied')).catch(() => toast('Select & copy manually'));
        } }, 'Copy'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'portfolio-backup-' + new Date().toISOString().slice(0,10) + '.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast('Downloaded');
        } }, 'Download')
      )
    );
    close = openModal(content);
    setTimeout(() => ta.focus(), 50);
  }

  function openImport() {
    const ta = el('textarea', { placeholder: 'Paste JSON here' });
    const fileI = el('input', { type: 'file', accept: 'application/json', style: { marginBottom: '12px' } });
    fileI.addEventListener('change', () => {
      const f = fileI.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { ta.value = reader.result; };
      reader.readAsText(f);
    });
    let close;
    const content = el('div', null,
      el('h2', null, 'Import data'),
      el('p', null, 'This replaces your current portfolio data. Either choose a JSON file or paste it below.'),
      fileI, ta,
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          try {
            const parsed = JSON.parse(ta.value);
            if (!parsed.properties || !Array.isArray(parsed.properties)) throw new Error('Missing properties array');
            if (!Array.isArray(parsed.accounts)) parsed.accounts = [];
            state.data = parsed;
            saveData();
            close();
            rerender();
            toast('Imported');
          } catch (e) {
            toast('Import failed: ' + e.message, true);
          }
        } }, 'Import')
      )
    );
    close = openModal(content);
  }

  function confirmWipe() {
    if (!confirm('Clear all data?\n\nThis removes your portfolio from this device. Make sure you have exported a backup first.')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    rerender();
    toast('Cleared');
  }

  // ============================================================
  // Toast
  // ============================================================
  let toastTimer;
  function toast(msg, danger) {
    let t = $('.toast');
    if (!t) {
      t = el('div', { class: 'toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast show' + (danger ? ' danger' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 1800);
  }

  // ============================================================
  // Boot
  // ============================================================
  function rerender() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('money-input')) active.blur();
    renderApp();
  }

  function boot() {
    state.data = loadData();
    renderApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
