/**
 * app.js — Property portfolio
 *
 * Data lives only on this device in localStorage. The GitHub-hosted code
 * shell never receives or transmits your numbers.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pt:data';

  // ============================================================
  // State
  // ============================================================
  let state = { data: null, view: 'main', expenseFilter: 'fy' };

  const DEFAULT_DATA = {
    schemaVersion: 2,
    lastUpdated: new Date().toISOString().slice(0, 10),
    properties: [],
    accounts: [],
    sale: null,
    expenses: [],
    snapshots: [],
    reminders: []
  };

  const EXPENSE_CATEGORIES = [
    'Maintenance', 'Repairs', 'Council rates', 'Water rates',
    'Insurance', 'Property management', 'Strata / OC',
    'Land tax', 'Accountant / legal', 'Other'
  ];

  const REMINDER_PRESETS = [
    'Insurance renewal', 'Council rates due', 'Water rates due',
    'Lease expiry', 'Inspection due', 'Land tax due',
    'Rate review', 'Tax return', 'Other'
  ];

  // ============================================================
  // DOM utilities
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

  // ============================================================
  // Formatters
  // ============================================================
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
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const fmtDateShort = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);

  // ============================================================
  // Icons
  // ============================================================
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
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-10v2h14V7H7z"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  };

  // ============================================================
  // Persistence
  // ============================================================
  function loadData() {
    let data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      data = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_DATA));
    } catch (e) {
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
    // Backward compat — older saves don't have these arrays
    if (!Array.isArray(data.expenses)) data.expenses = [];
    if (!Array.isArray(data.snapshots)) data.snapshots = [];
    if (!Array.isArray(data.reminders)) data.reminders = [];
    if (!data.schemaVersion) data.schemaVersion = 2;
    return data;
  }

  function saveData() {
    if (!state.data) return;
    state.data.lastUpdated = todayISO();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  // ============================================================
  // Portfolio calculations
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
  // Expense / snapshot / reminder calculations
  // ============================================================
  // Aus financial year: July 1 to June 30
  function fyStart(date) {
    const d = new Date(date);
    return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; // July is month 6
  }
  function fyLabel(year) { return 'FY' + String(year + 1).slice(-2); } // FY26 = Jul 2025-Jun 2026

  function expensesFiltered() {
    const today = new Date();
    const currentFY = fyStart(today);
    const f = state.expenseFilter;
    return state.data.expenses
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((e) => {
        if (f === 'all') return true;
        const efy = fyStart(new Date(e.date + 'T00:00:00'));
        if (f === 'fy') return efy === currentFY;
        if (f === 'fy-1') return efy === currentFY - 1;
        if (f === 'cy') return new Date(e.date + 'T00:00:00').getFullYear() === today.getFullYear();
        return true;
      });
  }
  function totalExpenses(list) { return (list || []).reduce((s, e) => s + (e.amount || 0), 0); }

  function expensesByCategory(list) {
    const out = {};
    (list || []).forEach((e) => { out[e.category] = (out[e.category] || 0) + e.amount; });
    return out;
  }
  function expensesByProperty(list) {
    const out = {};
    (list || []).forEach((e) => {
      const key = e.propertyId || 'unassigned';
      out[key] = (out[key] || 0) + e.amount;
    });
    return out;
  }

  function captureSnapshot() {
    const snap = {
      id: 's_' + Date.now(),
      date: todayISO(),
      totalMV: totalMV(),
      totalLoans: totalLoans(),
      totalEquity: totalEquity(),
      totalCash: totalCash(),
      lvr: totalMV() ? totalLoans() / totalMV() : 0
    };
    state.data.snapshots.push(snap);
    saveData();
    toast('Snapshot saved');
    render();
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }
  function reminderStatus(r) {
    if (r.done) return 'done';
    const d = daysUntil(r.date);
    if (d == null) return 'future';
    if (d < 0) return 'overdue';
    if (d <= 30) return 'soon';
    return 'future';
  }
  function activeReminders() {
    return state.data.reminders.filter((r) => !r.done);
  }
  function nextReminder() {
    const active = activeReminders().slice().sort((a, b) => a.date.localeCompare(b.date));
    return active[0] || null;
  }

  // ============================================================
  // Reusable: editable money input
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
  // Navigation
  // ============================================================
  function navigateTo(view) {
    state.view = view;
    window.scrollTo(0, 0);
    render();
  }

  function pageHeader(title, subtitle) {
    return el('div', { class: 'page-header' },
      el('button', { class: 'icon-btn back-btn', 'aria-label': 'Back', onclick: () => navigateTo('main'), html: ICONS.back }),
      el('div', { class: 'page-header-text' },
        el('h1', null, title),
        subtitle && el('div', { class: 'page-header-sub' }, subtitle)
      )
    );
  }

  // ============================================================
  // Main page
  // ============================================================
  function renderMainPage() {
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

    // Hero
    shell.appendChild(el('div', { class: 'hero' },
      el('div', { class: 'hero-label' }, 'Total equity'),
      el('div', { class: 'hero-value' }, fmtMoney(totalEquity())),
      el('div', { class: 'hero-meta' },
        state.data.properties.length + ' propert' + (state.data.properties.length === 1 ? 'y' : 'ies') +
        (state.data.sale ? ' · 1 sale pending' : '')
      )
    ));

    // Metrics
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

    // NEW: Three navigation tiles for the new features
    shell.appendChild(renderNavTiles());

    // Properties
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

    shell.appendChild(el('div', { class: 'app-footer' }, 'Tap any number to edit'));
    app.appendChild(shell);
  }

  function renderNavTiles() {
    const tiles = el('div', { class: 'nav-tiles' });

    // Expenses tile
    const today = new Date();
    const currentFY = fyStart(today);
    const fyExpenses = state.data.expenses.filter((e) =>
      fyStart(new Date(e.date + 'T00:00:00')) === currentFY
    );
    tiles.appendChild(el('button', { class: 'nav-tile', onclick: () => navigateTo('expenses') },
      el('div', { class: 'nav-tile-icon', html: ICONS.receipt }),
      el('div', { class: 'nav-tile-body' },
        el('div', { class: 'nav-tile-label' }, 'Expenses · ' + fyLabel(currentFY)),
        el('div', { class: 'nav-tile-value' }, fmtMoney(totalExpenses(fyExpenses))),
        el('div', { class: 'nav-tile-sub' }, fyExpenses.length + ' entr' + (fyExpenses.length === 1 ? 'y' : 'ies'))
      )
    ));

    // Snapshots tile
    const snapsSorted = state.data.snapshots.slice().sort((a, b) => b.date.localeCompare(a.date));
    const lastSnap = snapsSorted[0];
    const snapsSubtitle = lastSnap
      ? 'Last: ' + fmtDateShort(lastSnap.date)
      : 'None saved yet';
    tiles.appendChild(el('button', { class: 'nav-tile', onclick: () => navigateTo('snapshots') },
      el('div', { class: 'nav-tile-icon', html: ICONS.chart }),
      el('div', { class: 'nav-tile-body' },
        el('div', { class: 'nav-tile-label' }, 'Net worth history'),
        el('div', { class: 'nav-tile-value' }, state.data.snapshots.length + ' snapshot' + (state.data.snapshots.length === 1 ? '' : 's')),
        el('div', { class: 'nav-tile-sub' }, snapsSubtitle)
      )
    ));

    // Reminders tile
    const next = nextReminder();
    const overdueCount = state.data.reminders.filter((r) => !r.done && daysUntil(r.date) < 0).length;
    let remValue, remSub, remTone = '';
    if (!next) {
      remValue = 'No reminders';
      remSub = 'Tap to add';
    } else {
      const d = daysUntil(next.date);
      if (d < 0) { remValue = next.title; remSub = Math.abs(d) + ' days overdue'; remTone = 'danger'; }
      else if (d === 0) { remValue = next.title; remSub = 'Due today'; remTone = 'warn'; }
      else if (d <= 30) { remValue = next.title; remSub = 'In ' + d + ' days'; remTone = 'warn'; }
      else { remValue = next.title; remSub = 'In ' + d + ' days'; }
    }
    tiles.appendChild(el('button', { class: 'nav-tile' + (remTone ? ' tone-' + remTone : ''), onclick: () => navigateTo('reminders') },
      el('div', { class: 'nav-tile-icon', html: ICONS.bell },
        overdueCount > 0 && el('span', { class: 'nav-tile-badge' }, String(overdueCount))
      ),
      el('div', { class: 'nav-tile-body' },
        el('div', { class: 'nav-tile-label' }, 'Reminders'),
        el('div', { class: 'nav-tile-value', style: { fontSize: '15px' } }, remValue),
        el('div', { class: 'nav-tile-sub' }, remSub)
      )
    ));

    return tiles;
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

    // NEW: show this year's expenses for the property
    const currentFY = fyStart(new Date());
    const propExpensesFY = state.data.expenses.filter((e) =>
      e.propertyId === p.id && fyStart(new Date(e.date + 'T00:00:00')) === currentFY
    );
    if (propExpensesFY.length > 0) {
      card.appendChild(row(
        'Expenses · ' + fyLabel(currentFY) + ' (' + propExpensesFY.length + ')',
        fmtMoney(totalExpenses(propExpensesFY)),
        { muted: true }
      ));
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
  // EXPENSES PAGE
  // ============================================================
  function renderExpensesPage() {
    const app = $('#app');
    clear(app);
    const shell = el('div', { class: 'app-shell' });

    const today = new Date();
    const currentFY = fyStart(today);
    const filtered = expensesFiltered();
    const total = totalExpenses(filtered);

    shell.appendChild(pageHeader('Expenses',
      filtered.length + ' entr' + (filtered.length === 1 ? 'y' : 'ies') + ' · ' + fmtMoney(total)
    ));

    // Filter chips
    shell.appendChild(el('div', { class: 'chips' },
      chip('This FY (' + fyLabel(currentFY) + ')', 'fy'),
      chip('Last FY (' + fyLabel(currentFY - 1) + ')', 'fy-1'),
      chip('This calendar year', 'cy'),
      chip('All time', 'all')
    ));

    // Summary by category (if any expenses)
    if (filtered.length > 0) {
      const byCat = expensesByCategory(filtered);
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const breakdown = el('div', { class: 'card' });
      breakdown.appendChild(el('div', { class: 'subsection', style: { paddingTop: '0' } }, 'By category'));
      cats.forEach(([cat, amt]) => {
        breakdown.appendChild(row(cat, fmtMoney(amt), { muted: true }));
      });

      // by property
      if (state.data.properties.length > 1) {
        const byProp = expensesByProperty(filtered);
        breakdown.appendChild(el('div', { class: 'subsection' }, 'By property'));
        Object.entries(byProp).sort((a, b) => b[1] - a[1]).forEach(([pid, amt]) => {
          const p = state.data.properties.find((x) => x.id === pid);
          breakdown.appendChild(row(p ? p.name : '(unassigned)', fmtMoney(amt), { muted: true }));
        });
      }
      shell.appendChild(breakdown);
    }

    // List
    shell.appendChild(el('div', { class: 'section-head' },
      el('div', { class: 'section-title' }, 'All entries'),
      el('button', { class: 'section-action', onclick: addExpense }, '+ Add')
    ));

    if (filtered.length === 0) {
      shell.appendChild(el('div', { class: 'empty', style: { padding: '32px 16px' } },
        el('h2', null, 'No expenses yet'),
        el('p', null, 'Track maintenance, rates, insurance and other costs. Easy to hand to your accountant at year end.'),
        el('button', { class: 'btn btn-primary', onclick: addExpense }, '+ Add expense')
      ));
    } else {
      const list = el('div', { class: 'expense-list' });
      filtered.forEach((e) => list.appendChild(renderExpenseRow(e)));
      shell.appendChild(list);
    }

    // Export
    if (state.data.expenses.length > 0) {
      shell.appendChild(el('div', { class: 'settings' },
        el('button', { class: 'btn btn-icon', onclick: () => exportExpensesCSV(filtered) },
          el('span', { html: ICONS.download }), 'Export CSV (for accountant)')
      ));
    }

    app.appendChild(shell);
  }

  function chip(label, value) {
    const active = state.expenseFilter === value;
    return el('button', {
      class: 'chip' + (active ? ' active' : ''),
      onclick: () => { state.expenseFilter = value; render(); }
    }, label);
  }

  function renderExpenseRow(e) {
    const p = state.data.properties.find((x) => x.id === e.propertyId);
    return el('div', { class: 'expense-row', onclick: () => editExpense(e.id) },
      el('div', { class: 'expense-row-left' },
        el('div', { class: 'expense-row-top' },
          el('span', { class: 'expense-cat' }, e.category || 'Other'),
          el('span', { class: 'expense-date' }, fmtDate(e.date))
        ),
        el('div', { class: 'expense-row-bottom' },
          el('span', { class: 'expense-prop' }, p ? p.name : '(unassigned)'),
          e.note && el('span', { class: 'expense-note' }, ' · ' + e.note)
        )
      ),
      el('div', { class: 'expense-amount' }, fmtMoney(e.amount, 2))
    );
  }

  function addExpense(prefilledPropId) {
    const today = todayISO();
    const dateI = el('input', { class: 'form-input', type: 'date', value: today });
    const propS = el('select', { class: 'form-input' });
    state.data.properties.forEach((p) => {
      propS.appendChild(el('option', { value: p.id }, p.name));
    });
    if (prefilledPropId) propS.value = prefilledPropId;
    const catS = el('select', { class: 'form-input' });
    EXPENSE_CATEGORIES.forEach((c) => catS.appendChild(el('option', { value: c }, c)));
    const amtI = el('input', { class: 'form-input', type: 'text', inputmode: 'decimal', placeholder: 'Amount (e.g. 250.00)' });
    const noteI = el('input', { class: 'form-input', type: 'text', placeholder: 'Note (optional)' });

    let close;
    const content = el('div', null,
      el('h2', null, 'Add expense'),
      formField('Date', dateI),
      formField('Property', propS),
      formField('Category', catS),
      formField('Amount', amtI),
      formField('Note', noteI),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          const amt = parseFloat((amtI.value || '').replace(/[^\d.\-]/g, ''));
          if (isNaN(amt) || amt <= 0) { amtI.focus(); return; }
          state.data.expenses.push({
            id: 'e_' + Date.now(),
            date: dateI.value || today,
            propertyId: propS.value,
            category: catS.value,
            amount: amt,
            note: noteI.value.trim()
          });
          saveData();
          close();
          render();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
    setTimeout(() => amtI.focus(), 50);
  }

  function editExpense(id) {
    const e = state.data.expenses.find((x) => x.id === id);
    if (!e) return;
    const dateI = el('input', { class: 'form-input', type: 'date', value: e.date });
    const propS = el('select', { class: 'form-input' });
    state.data.properties.forEach((p) => propS.appendChild(el('option', { value: p.id }, p.name)));
    propS.value = e.propertyId;
    const catS = el('select', { class: 'form-input' });
    EXPENSE_CATEGORIES.forEach((c) => catS.appendChild(el('option', { value: c }, c)));
    catS.value = e.category;
    const amtI = el('input', { class: 'form-input', type: 'text', inputmode: 'decimal', value: e.amount.toFixed(2) });
    const noteI = el('input', { class: 'form-input', type: 'text', value: e.note || '' });

    let close;
    const content = el('div', null,
      el('h2', null, 'Edit expense'),
      formField('Date', dateI),
      formField('Property', propS),
      formField('Category', catS),
      formField('Amount', amtI),
      formField('Note', noteI),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-danger', onclick: () => {
          if (!confirm('Delete this expense?')) return;
          state.data.expenses = state.data.expenses.filter((x) => x.id !== id);
          saveData();
          close();
          render();
          toast('Deleted');
        } }, 'Delete'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          const amt = parseFloat((amtI.value || '').replace(/[^\d.\-]/g, ''));
          if (isNaN(amt) || amt <= 0) { amtI.focus(); return; }
          e.date = dateI.value;
          e.propertyId = propS.value;
          e.category = catS.value;
          e.amount = amt;
          e.note = noteI.value.trim();
          saveData();
          close();
          render();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
  }

  function exportExpensesCSV(list) {
    const rows = (list || state.data.expenses).slice().sort((a, b) => a.date.localeCompare(b.date));
    const csvCell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const header = ['Date', 'Property', 'Category', 'Amount', 'Note'];
    const body = rows.map((e) => {
      const p = state.data.properties.find((p) => p.id === e.propertyId);
      return [e.date, p ? p.name : '', e.category, e.amount.toFixed(2), e.note || ''];
    });
    const csv = [header, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses-' + todayISO() + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Downloaded CSV');
  }

  // ============================================================
  // SNAPSHOTS PAGE
  // ============================================================
  function renderSnapshotsPage() {
    const app = $('#app');
    clear(app);
    const shell = el('div', { class: 'app-shell' });

    const snaps = state.data.snapshots.slice().sort((a, b) => b.date.localeCompare(a.date));
    shell.appendChild(pageHeader('Net worth history',
      snaps.length + ' snapshot' + (snaps.length === 1 ? '' : 's')
    ));

    // Current state preview
    shell.appendChild(el('div', { class: 'hero' },
      el('div', { class: 'hero-label' }, 'Today'),
      el('div', { class: 'hero-value' }, fmtMoney(totalEquity())),
      el('div', { class: 'hero-meta' }, 'Equity · ' + (totalMV() ? fmtPct1(totalLoans() / totalMV()) : '—') + ' LVR')
    ));

    shell.appendChild(el('div', { class: 'settings', style: { borderTop: 'none', paddingTop: '0', marginTop: '0' } },
      el('button', { class: 'btn btn-primary btn-icon', onclick: () => {
        if (confirm('Save a snapshot of today\'s portfolio state?')) captureSnapshot();
      } },
        el('span', { html: ICONS.plus }), 'Save snapshot of today'
      )
    ));

    if (snaps.length === 0) {
      shell.appendChild(el('div', { class: 'empty', style: { padding: '32px 16px' } },
        el('h2', null, 'No snapshots yet'),
        el('p', null, 'Save a snapshot every month or so. Over time you\'ll have a clear picture of how your portfolio is growing.')
      ));
      app.appendChild(shell);
      return;
    }

    shell.appendChild(el('div', { class: 'section-head' },
      el('div', { class: 'section-title' }, 'History')
    ));

    const list = el('div', { class: 'snap-list' });
    snaps.forEach((s, i) => {
      const prev = snaps[i + 1];
      const eqDelta = prev ? s.totalEquity - prev.totalEquity : null;
      list.appendChild(renderSnapshotRow(s, eqDelta));
    });
    shell.appendChild(list);
    app.appendChild(shell);
  }

  function renderSnapshotRow(s, delta) {
    const row = el('div', { class: 'snap-row', onclick: () => snapshotDetail(s.id) });
    row.appendChild(el('div', { class: 'snap-date' }, fmtDate(s.date)));
    row.appendChild(el('div', { class: 'snap-eq' }, fmtMoney(s.totalEquity)));
    if (delta != null) {
      const tone = delta >= 0 ? 'success' : 'danger';
      const sign = delta >= 0 ? '+' : '−';
      row.appendChild(el('div', { class: 'snap-delta ' + tone }, sign + fmtMoney(Math.abs(delta))));
    } else {
      row.appendChild(el('div', { class: 'snap-delta muted' }, 'first'));
    }
    return row;
  }

  function snapshotDetail(id) {
    const s = state.data.snapshots.find((x) => x.id === id);
    if (!s) return;
    let close;
    const content = el('div', null,
      el('h2', null, 'Snapshot · ' + fmtDate(s.date)),
      el('div', { class: 'card', style: { marginTop: '8px' } },
        row('Market value', fmtMoney(s.totalMV)),
        row('Total loans', fmtMoney(s.totalLoans)),
        row('Equity', fmtMoney(s.totalEquity), { tone: 'success' }),
        row('Cash / Offset', fmtMoney(s.totalCash)),
        row('LVR', fmtPct1(s.lvr))
      ),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-danger', onclick: () => {
          if (!confirm('Delete this snapshot?')) return;
          state.data.snapshots = state.data.snapshots.filter((x) => x.id !== id);
          saveData();
          close();
          render();
          toast('Deleted');
        } }, 'Delete'),
        el('button', { class: 'btn btn-primary', onclick: () => close() }, 'Close')
      )
    );
    close = openModal(content);
  }

  // ============================================================
  // REMINDERS PAGE
  // ============================================================
  function renderRemindersPage() {
    const app = $('#app');
    clear(app);
    const shell = el('div', { class: 'app-shell' });

    const active = state.data.reminders.filter((r) => !r.done)
      .slice().sort((a, b) => a.date.localeCompare(b.date));
    const done = state.data.reminders.filter((r) => r.done)
      .slice().sort((a, b) => b.date.localeCompare(a.date));

    const overdueCount = active.filter((r) => daysUntil(r.date) < 0).length;
    const soonCount = active.filter((r) => { const d = daysUntil(r.date); return d >= 0 && d <= 30; }).length;

    let subtitle = active.length + ' active';
    if (overdueCount > 0) subtitle += ' · ' + overdueCount + ' overdue';
    else if (soonCount > 0) subtitle += ' · ' + soonCount + ' due soon';

    shell.appendChild(pageHeader('Reminders', subtitle));

    shell.appendChild(el('div', { class: 'settings', style: { borderTop: 'none', paddingTop: '0', marginTop: '0' } },
      el('button', { class: 'btn btn-primary btn-icon', onclick: addReminder },
        el('span', { html: ICONS.plus }), 'Add reminder'
      )
    ));

    if (active.length === 0 && done.length === 0) {
      shell.appendChild(el('div', { class: 'empty', style: { padding: '32px 16px' } },
        el('h2', null, 'No reminders yet'),
        el('p', null, 'Track things that have a date: insurance renewals, lease expiries, rate reviews, tax due dates.')
      ));
      app.appendChild(shell);
      return;
    }

    if (active.length > 0) {
      shell.appendChild(el('div', { class: 'section-head' },
        el('div', { class: 'section-title' }, 'Upcoming')
      ));
      const list = el('div', { class: 'reminder-list' });
      active.forEach((r) => list.appendChild(renderReminderRow(r)));
      shell.appendChild(list);
    }

    if (done.length > 0) {
      shell.appendChild(el('div', { class: 'section-head' },
        el('div', { class: 'section-title' }, 'Done')
      ));
      const list = el('div', { class: 'reminder-list' });
      done.slice(0, 20).forEach((r) => list.appendChild(renderReminderRow(r)));
      shell.appendChild(list);
    }

    app.appendChild(shell);
  }

  function renderReminderRow(r) {
    const status = reminderStatus(r);
    const days = daysUntil(r.date);
    const p = r.propertyId ? state.data.properties.find((x) => x.id === r.propertyId) : null;

    const row = el('div', { class: 'reminder-row status-' + status, onclick: () => editReminder(r.id) });

    let dateLabel;
    if (status === 'done') dateLabel = 'Done';
    else if (days < 0) dateLabel = Math.abs(days) + 'd overdue';
    else if (days === 0) dateLabel = 'Today';
    else if (days === 1) dateLabel = 'Tomorrow';
    else if (days <= 30) dateLabel = days + ' days';
    else dateLabel = fmtDateShort(r.date);

    row.appendChild(el('div', { class: 'reminder-dot' }));
    row.appendChild(el('div', { class: 'reminder-body' },
      el('div', { class: 'reminder-title' }, r.title),
      el('div', { class: 'reminder-sub' },
        fmtDate(r.date) + (p ? ' · ' + p.name : '') + (r.note ? ' · ' + r.note : '')
      )
    ));
    row.appendChild(el('div', { class: 'reminder-when' }, dateLabel));
    return row;
  }

  function addReminder() {
    const titleS = el('select', { class: 'form-input' });
    REMINDER_PRESETS.forEach((t) => titleS.appendChild(el('option', { value: t }, t)));
    const titleI = el('input', { class: 'form-input', type: 'text', placeholder: 'Custom title (optional)' });
    const dateI = el('input', { class: 'form-input', type: 'date', value: todayISO() });
    const propS = el('select', { class: 'form-input' });
    propS.appendChild(el('option', { value: '' }, '(no property)'));
    state.data.properties.forEach((p) => propS.appendChild(el('option', { value: p.id }, p.name)));
    const noteI = el('input', { class: 'form-input', type: 'text', placeholder: 'Note (optional)' });

    let close;
    const content = el('div', null,
      el('h2', null, 'Add reminder'),
      formField('What', titleS),
      formField('Custom title (overrides above)', titleI),
      formField('Date', dateI),
      formField('Property', propS),
      formField('Note', noteI),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          const title = (titleI.value.trim() || titleS.value);
          if (!title || !dateI.value) return;
          state.data.reminders.push({
            id: 'r_' + Date.now(),
            title: title,
            date: dateI.value,
            propertyId: propS.value || null,
            note: noteI.value.trim(),
            done: false
          });
          saveData();
          close();
          render();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
  }

  function editReminder(id) {
    const r = state.data.reminders.find((x) => x.id === id);
    if (!r) return;
    const titleI = el('input', { class: 'form-input', type: 'text', value: r.title });
    const dateI = el('input', { class: 'form-input', type: 'date', value: r.date });
    const propS = el('select', { class: 'form-input' });
    propS.appendChild(el('option', { value: '' }, '(no property)'));
    state.data.properties.forEach((p) => propS.appendChild(el('option', { value: p.id }, p.name)));
    propS.value = r.propertyId || '';
    const noteI = el('input', { class: 'form-input', type: 'text', value: r.note || '' });

    let close;
    const content = el('div', null,
      el('h2', null, r.done ? 'Edit completed reminder' : 'Edit reminder'),
      formField('Title', titleI),
      formField('Date', dateI),
      formField('Property', propS),
      formField('Note', noteI),
      el('div', { class: 'modal-actions', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn btn-danger', onclick: () => {
          if (!confirm('Delete this reminder?')) return;
          state.data.reminders = state.data.reminders.filter((x) => x.id !== id);
          saveData();
          close();
          render();
          toast('Deleted');
        } }, 'Delete'),
        el('button', { class: 'btn', onclick: () => {
          r.done = !r.done;
          saveData();
          close();
          render();
          toast(r.done ? 'Marked done' : 'Reopened');
        } }, r.done ? 'Reopen' : 'Mark done'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          r.title = titleI.value.trim();
          r.date = dateI.value;
          r.propertyId = propS.value || null;
          r.note = noteI.value.trim();
          saveData();
          close();
          render();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
  }

  // ============================================================
  // Modal & form helpers
  // ============================================================
  function openModal(node) {
    const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); } },
      el('div', { class: 'modal' }, node)
    );
    document.body.appendChild(backdrop);
    return () => { if (backdrop.parentNode) document.body.removeChild(backdrop); };
  }

  function formField(label, input) {
    return el('div', { class: 'form-field' },
      el('label', { class: 'form-label' }, label),
      input
    );
  }

  // ============================================================
  // Property / account dialogs (unchanged)
  // ============================================================
  function addProperty() {
    const nameI = el('input', { class: 'form-input', placeholder: 'Property name' });
    const addrI = el('input', { class: 'form-input', placeholder: 'Address' });
    const typeS = el('select', { class: 'form-input' },
      el('option', { value: 'Residential' }, 'Residential (owner-occupied)'),
      el('option', { value: 'Investment' }, 'Investment')
    );
    let close;
    const content = el('div', null,
      el('h2', null, 'Add property'),
      formField('Name', nameI),
      formField('Address', addrI),
      formField('Type', typeS),
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
          render();
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
    const nameI = el('input', { class: 'form-input', value: p.name || '' });
    const addrI = el('input', { class: 'form-input', value: p.address || '' });
    const typeS = el('select', { class: 'form-input' },
      el('option', { value: 'Residential' }, 'Residential (owner-occupied)'),
      el('option', { value: 'Investment' }, 'Investment')
    );
    typeS.value = p.type || 'Investment';
    const statusS = el('select', { class: 'form-input' },
      el('option', { value: 'active' }, 'Active'),
      el('option', { value: 'sold' }, 'Sold (pending settlement)')
    );
    statusS.value = p.status || 'active';

    let close;
    const content = el('div', null,
      el('h2', null, 'Edit property'),
      formField('Name', nameI),
      formField('Address', addrI),
      formField('Type', typeS),
      formField('Status', statusS),
      el('div', { class: 'modal-actions', style: { flexWrap: 'wrap' } },
        el('button', { class: 'btn btn-danger', onclick: () => {
          if (!confirm('Delete this property?\n\nAll its expenses and reminders will remain (the property reference will become unknown).')) return;
          state.data.properties = state.data.properties.filter((x) => x.id !== id);
          saveData();
          close();
          render();
          toast('Deleted');
        } }, 'Delete'),
        el('button', { class: 'btn', onclick: () => { close(); addExpense(p.id); } }, 'Add expense'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          p.name = nameI.value.trim();
          p.address = addrI.value.trim();
          p.type = typeS.value;
          p.status = statusS.value;
          p.icon = typeS.value === 'Residential' ? 'home' : 'building';
          saveData();
          close();
          render();
          toast('Saved');
        } }, 'Save')
      )
    );
    close = openModal(content);
  }

  function addAccount() {
    const nameI = el('input', { class: 'form-input', placeholder: 'Account name' });
    const linkI = el('input', { class: 'form-input', placeholder: 'Linked to' });
    const balI = el('input', { class: 'form-input', type: 'text', inputmode: 'decimal', placeholder: 'Balance' });
    let close;
    const content = el('div', null,
      el('h2', null, 'Add account'),
      formField('Name', nameI),
      formField('Linked to', linkI),
      formField('Balance', balI),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          if (!nameI.value.trim()) return;
          const balance = parseFloat(balI.value.replace(/[^\d.\-]/g, '')) || 0;
          state.data.accounts.push({ name: nameI.value.trim(), linkedTo: linkI.value.trim(), balance: balance });
          saveData();
          close();
          render();
          toast('Added');
        } }, 'Save')
      )
    );
    close = openModal(content);
    setTimeout(() => nameI.focus(), 50);
  }

  // ============================================================
  // Settings (import / export / wipe)
  // ============================================================
  function openSettings() {
    let close;
    const content = el('div', null,
      el('h2', null, 'Settings'),
      el('button', { class: 'btn btn-icon', onclick: () => { close(); openExport(); } },
        el('span', { html: ICONS.download }), 'Export data (full backup)'),
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
      el('p', null, 'Full backup including expenses, snapshots and reminders.'),
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
          a.download = 'portfolio-backup-' + todayISO() + '.json';
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
      el('p', null, 'This replaces all current data. Choose a JSON file or paste it below.'),
      fileI, ta,
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
        el('button', { class: 'btn btn-primary', onclick: () => {
          try {
            const parsed = JSON.parse(ta.value);
            if (!parsed.properties || !Array.isArray(parsed.properties)) throw new Error('Missing properties array');
            if (!Array.isArray(parsed.accounts)) parsed.accounts = [];
            if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
            if (!Array.isArray(parsed.snapshots)) parsed.snapshots = [];
            if (!Array.isArray(parsed.reminders)) parsed.reminders = [];
            state.data = parsed;
            saveData();
            close();
            render();
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
    if (!confirm('Clear all data?\n\nThis removes your entire portfolio (including expenses, snapshots and reminders) from this device. Make sure you have exported a backup first.')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    render();
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
  // Master render & boot
  // ============================================================
  function render() {
    if (state.view === 'expenses') renderExpensesPage();
    else if (state.view === 'snapshots') renderSnapshotsPage();
    else if (state.view === 'reminders') renderRemindersPage();
    else renderMainPage();
  }

  function rerender() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('money-input')) active.blur();
    render();
  }

  function boot() {
    state.data = loadData();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
