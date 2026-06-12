/* Flexile (Hono + Cloudflare) — single-page frontend, vanilla JS. */

const state = {
  user: null,
  companies: [],
  activeCompany: null,
  tab: "dashboard",
};

const api = async (path, opts = {}) => {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const fmtMoney = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const fmtUsd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("en-US").format(n || 0);

const statusColors = {
  paid: "bg-green-100 text-green-800",
  approved: "bg-blue-100 text-blue-800",
  received: "bg-yellow-100 text-yellow-800",
  processing: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  signed: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  unsigned: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
};
const badge = (status) =>
  `<span class="text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[status] || "bg-gray-100 text-gray-700"}">${status}</span>`;

const el = (id) => document.getElementById(id);
const app = () => document.getElementById("app");

/* ----------------------------- Auth screen ----------------------------- */
function renderLogin(errorMsg = "") {
  app().innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-3">F</div>
          <h1 class="text-2xl font-bold">Flexile</h1>
          <p class="text-gray-500 text-sm mt-1">Payroll &amp; equity · Hono + Cloudflare Workers + D1</p>
        </div>
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          ${errorMsg ? `<div class="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">${errorMsg}</div>` : ""}
          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Email</label>
              <input id="email" type="email" value="admin@acme.test" class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Password</label>
              <input id="password" type="password" value="password123" class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 transition">Sign in</button>
          </form>
          <div class="mt-4 text-xs text-gray-500 leading-relaxed">
            <p class="font-medium text-gray-600 mb-1">Demo accounts (password: <code>password123</code>):</p>
            <ul class="space-y-0.5">
              <li>· admin@acme.test — Administrator</li>
              <li>· dev@acme.test — Contractor</li>
              <li>· investor@acme.test — Investor</li>
              <li>· lawyer@acme.test — Lawyer</li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;

  el("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: el("email").value, password: el("password").value }),
      });
      state.user = data.user;
      await loadCompanies();
      renderApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

/* ----------------------------- Shell ----------------------------- */
async function loadCompanies() {
  const data = await api("/companies");
  state.companies = data.companies;
  state.activeCompany = data.companies[0] || null;
}

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "invoices", label: "Invoices" },
  { id: "people", label: "People" },
  { id: "documents", label: "Documents" },
  { id: "equity", label: "Equity" },
];

function renderApp() {
  const c = state.activeCompany;
  app().innerHTML = `
    <div class="min-h-screen">
      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-blue-600 text-white grid place-items-center font-bold">F</div>
            <div>
              <div class="font-semibold leading-tight">${c ? c.name : "Flexile"}</div>
              <div class="text-xs text-gray-500">${c ? Object.entries(c.roles).filter(([, v]) => v).map(([k]) => k).join(" · ") : ""}</div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-600">${state.user.legalName || state.user.email}</span>
            <button id="logout" class="text-sm text-gray-500 hover:text-gray-900">Sign out</button>
          </div>
        </div>
        <nav class="max-w-6xl mx-auto px-4 flex gap-1 -mb-px">
          ${tabs
            .map(
              (t) => `<button data-tab="${t.id}" class="px-3 py-2.5 text-sm font-medium border-b-2 ${
                state.tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"
              }">${t.label}</button>`,
            )
            .join("")}
        </nav>
      </header>
      <main class="max-w-6xl mx-auto px-4 py-6"><div id="content">Loading…</div></main>
    </div>`;

  el("logout").addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    state.user = null;
    renderLogin();
  });
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      state.tab = b.dataset.tab;
      renderApp();
    }),
  );
  renderTab();
}

const card = (inner) => `<div class="bg-white rounded-xl border border-gray-200 ${inner}"></div>`;
const tableWrap = (head, rows) => `
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 text-gray-500 text-left"><tr>${head}</tr></thead>
      <tbody class="divide-y divide-gray-100">${rows}</tbody>
    </table>
  </div>`;

async function renderTab() {
  const content = el("content");
  const cid = state.activeCompany?.id;
  try {
    if (state.tab === "dashboard") return renderDashboard(content, cid);
    if (state.tab === "invoices") return renderInvoices(content, cid);
    if (state.tab === "people") return renderPeople(content, cid);
    if (state.tab === "documents") return renderDocuments(content, cid);
    if (state.tab === "equity") return renderEquity(content, cid);
  } catch (err) {
    content.innerHTML = `<div class="text-red-600">${err.message}</div>`;
  }
}

/* ----------------------------- Tabs ----------------------------- */
async function renderDashboard(content, cid) {
  const { company, metrics } = await api(`/companies/${cid}`);
  content.innerHTML = `
    <h2 class="text-lg font-semibold mb-4">Overview</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      ${[
        ["Contractors", fmtNum(metrics.contractors)],
        ["Investors", fmtNum(metrics.investors)],
        ["Invoices", fmtNum(metrics.invoices)],
        ["Paid out", fmtMoney(metrics.totalPaidCents)],
      ]
        .map(
          ([l, v]) =>
            `<div class="bg-white rounded-xl border border-gray-200 p-4"><div class="text-xs text-gray-500">${l}</div><div class="text-2xl font-bold mt-1">${v}</div></div>`,
        )
        .join("")}
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="font-semibold mb-3">Company</h3>
        <dl class="text-sm space-y-2">
          <div class="flex justify-between"><dt class="text-gray-500">Legal name</dt><dd>${company.name}</dd></div>
          <div class="flex justify-between"><dt class="text-gray-500">Email</dt><dd>${company.email || "—"}</dd></div>
          <div class="flex justify-between"><dt class="text-gray-500">Tax ID</dt><dd>${company.taxId || "—"}</dd></div>
          <div class="flex justify-between"><dt class="text-gray-500">Share price</dt><dd>${fmtUsd(company.sharePriceUsd)}</dd></div>
          <div class="flex justify-between"><dt class="text-gray-500">Fully diluted shares</dt><dd>${fmtNum(company.fullyDilutedShares)}</dd></div>
        </dl>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <h3 class="font-semibold mb-2">Stack</h3>
        <p class="text-sm text-gray-600 leading-relaxed">This app is the Flexile domain ported to <b>Hono</b> running on <b>Cloudflare Workers</b>, backed by <b>D1</b> (SQLite). Auth is JWT via the Web Crypto API, all data served through Hono API routes.</p>
      </div>
    </div>`;
}

async function renderInvoices(content, cid) {
  const { invoices } = await api(`/invoices?companyId=${cid}`);
  const rows = invoices
    .map(
      (i) => `<tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-medium">${i.invoiceNumber}</td>
        <td class="px-4 py-3">${i.contractorName || "—"}</td>
        <td class="px-4 py-3">${i.invoiceDate}</td>
        <td class="px-4 py-3">${fmtMoney(i.totalAmountCents)}</td>
        <td class="px-4 py-3">${badge(i.status)}</td>
        <td class="px-4 py-3 text-right">
          ${i.status === "received" ? `<button data-approve="${i.id}" class="text-blue-600 hover:underline text-xs">Approve</button>` : ""}
          ${i.status === "approved" ? `<button data-pay="${i.id}" class="text-green-600 hover:underline text-xs">Mark paid</button>` : ""}
        </td>
      </tr>`,
    )
    .join("");
  content.innerHTML = `
    <h2 class="text-lg font-semibold mb-4">Invoices</h2>
    ${tableWrap(
      `<th class="px-4 py-2 font-medium">Invoice</th><th class="px-4 py-2 font-medium">Contractor</th><th class="px-4 py-2 font-medium">Date</th><th class="px-4 py-2 font-medium">Amount</th><th class="px-4 py-2 font-medium">Status</th><th class="px-4 py-2"></th>`,
      rows || `<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">No invoices</td></tr>`,
    )}`;
  const update = async (id, status) => {
    await api(`/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    renderTab();
  };
  content.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", () => update(b.dataset.approve, "approved")));
  content.querySelectorAll("[data-pay]").forEach((b) => b.addEventListener("click", () => update(b.dataset.pay, "paid")));
}

async function renderPeople(content, cid) {
  const data = await api(`/people?companyId=${cid}`);
  const section = (title, rows, head) =>
    rows ? `<h3 class="font-semibold mt-6 mb-2">${title}</h3>${tableWrap(head, rows)}` : "";
  const contractors = data.contractors
    .map(
      (p) => `<tr class="hover:bg-gray-50"><td class="px-4 py-3 font-medium">${p.legalName}</td><td class="px-4 py-3">${p.role || "—"}</td><td class="px-4 py-3">${fmtUsd(p.payRateUsd)}/${p.payRateType === "hourly" ? "hr" : "proj"}</td><td class="px-4 py-3 text-gray-500">${p.email}</td></tr>`,
    )
    .join("");
  const investors = data.investors
    .map(
      (p) => `<tr class="hover:bg-gray-50"><td class="px-4 py-3 font-medium">${p.legalName}</td><td class="px-4 py-3">${fmtUsd(p.investmentAmountUsd)}</td><td class="px-4 py-3">${fmtNum(p.totalShares)} shares</td><td class="px-4 py-3 text-gray-500">${p.email}</td></tr>`,
    )
    .join("");
  content.innerHTML = `
    <h2 class="text-lg font-semibold mb-2">People</h2>
    ${section("Contractors", contractors, `<th class="px-4 py-2 font-medium">Name</th><th class="px-4 py-2 font-medium">Role</th><th class="px-4 py-2 font-medium">Rate</th><th class="px-4 py-2 font-medium">Email</th>`)}
    ${section("Investors", investors, `<th class="px-4 py-2 font-medium">Name</th><th class="px-4 py-2 font-medium">Invested</th><th class="px-4 py-2 font-medium">Shares</th><th class="px-4 py-2 font-medium">Email</th>`)}`;
}

async function renderDocuments(content, cid) {
  const { documents } = await api(`/documents?companyId=${cid}`);
  const rows = documents
    .map(
      (d) => `<tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-medium">${d.name}</td>
        <td class="px-4 py-3 text-gray-500">${d.documentType}</td>
        <td class="px-4 py-3">${d.signerName || "—"}</td>
        <td class="px-4 py-3">${badge(d.status)}</td>
        <td class="px-4 py-3 text-right">${d.status === "unsigned" ? `<button data-sign="${d.id}" class="text-blue-600 hover:underline text-xs">Sign</button>` : ""}</td>
      </tr>`,
    )
    .join("");
  content.innerHTML = `
    <h2 class="text-lg font-semibold mb-4">Documents</h2>
    ${tableWrap(
      `<th class="px-4 py-2 font-medium">Name</th><th class="px-4 py-2 font-medium">Type</th><th class="px-4 py-2 font-medium">Signer</th><th class="px-4 py-2 font-medium">Status</th><th class="px-4 py-2"></th>`,
      rows || `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">No documents</td></tr>`,
    )}`;
  content.querySelectorAll("[data-sign]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api(`/documents/${b.dataset.sign}/sign`, { method: "POST" });
      renderTab();
    }),
  );
}

async function renderEquity(content, cid) {
  const cap = await api(`/equity/cap-table?companyId=${cid}`);
  const grants = await api(`/equity/grants?companyId=${cid}`);
  const capRows = cap.holders
    .map(
      (h) => `<tr class="hover:bg-gray-50"><td class="px-4 py-3 font-medium">${h.investorName}</td><td class="px-4 py-3">${fmtNum(h.totalShares)}</td><td class="px-4 py-3">${h.ownershipPercent}%</td><td class="px-4 py-3">${fmtUsd(h.investmentAmountUsd)}</td></tr>`,
    )
    .join("");
  const grantRows = grants.grants
    .map(
      (g) => `<tr class="hover:bg-gray-50"><td class="px-4 py-3 font-medium">${g.name}</td><td class="px-4 py-3">${g.holderName}</td><td class="px-4 py-3">${fmtNum(g.vestedShares)} / ${fmtNum(g.numberOfShares)}</td><td class="px-4 py-3">${fmtUsd(g.exercisePriceUsd)}</td></tr>`,
    )
    .join("");
  content.innerHTML = `
    <h2 class="text-lg font-semibold mb-1">Equity</h2>
    <p class="text-sm text-gray-500 mb-4">Share price ${fmtUsd(cap.sharePriceUsd)} · ${fmtNum(cap.fullyDilutedShares)} fully diluted shares</p>
    <h3 class="font-semibold mb-2">Cap table</h3>
    ${tableWrap(
      `<th class="px-4 py-2 font-medium">Holder</th><th class="px-4 py-2 font-medium">Shares</th><th class="px-4 py-2 font-medium">Ownership</th><th class="px-4 py-2 font-medium">Invested</th>`,
      capRows || `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400">No holders</td></tr>`,
    )}
    <h3 class="font-semibold mt-6 mb-2">Option grants</h3>
    ${tableWrap(
      `<th class="px-4 py-2 font-medium">Grant</th><th class="px-4 py-2 font-medium">Holder</th><th class="px-4 py-2 font-medium">Vested / Total</th><th class="px-4 py-2 font-medium">Strike</th>`,
      grantRows || `<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400">No grants</td></tr>`,
    )}`;
}

/* ----------------------------- Boot ----------------------------- */
(async function boot() {
  try {
    const data = await api("/auth/me");
    state.user = data.user;
    await loadCompanies();
    renderApp();
  } catch {
    renderLogin();
  }
})();
