import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getApiStatus } from "./lib/api";
import { logout, signInWithGoogle, subscribeToAuth } from "./lib/auth";
import type { User } from "firebase/auth";
import "./styles.css";

type ApiState =
  | { status: "loading" }
  | { status: "online"; version: string }
  | { status: "offline"; message: string };

const modules = [
  { title: "Sales & Orders", description: "Create, track and manage customer orders.", icon: "↗" },
  { title: "Products", description: "Keep your catalog, prices and SKUs organized.", icon: "▦" },
  { title: "Inventory", description: "See stock levels across branches and warehouses.", icon: "◫" },
  { title: "Customers", description: "Manage customers, contacts and account balances.", icon: "◎" },
  { title: "Payments & Debts", description: "Track payments, outstanding balances and history.", icon: "₽" },
  { title: "Reports", description: "Turn business activity into clear operational reports.", icon: "▥" },
];

function App() {
  const [apiState, setApiState] = useState<ApiState>({ status: "loading" });
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => subscribeToAuth(setUser), []);

  useEffect(() => {
    getApiStatus()
      .then((data) => setApiState({ status: "online", version: data.version }))
      .catch((error: unknown) =>
        setApiState({
          status: "offline",
          message: error instanceof Error ? error.message : "API is unavailable",
        }),
      );
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MyBusiness home">
          <span className="brand-mark">M</span>
          <span>MyBusiness</span>
        </a>
        <nav className="topnav" aria-label="Main navigation">
          <a href="#modules">Modules</a>
          <a href="#status">System status</a>
        </nav>
        <button className="button button-dark" type="button" disabled={authBusy} onClick={async () => { setAuthBusy(true); try { await signInWithGoogle(); } finally { setAuthBusy(false); } }}>{authBusy ? "Signing in..." : "Sign in"}</button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Wholesale business management</span>
            <h1>Run your distribution business from one clear workspace.</h1>
            <p>
              Manage products, stock, orders, customers, payments and reports
              without spreadsheets scattered across your team.
            </p>
            <div className="hero-actions">
              <button className="button button-primary" type="button">Get started</button>
              <a className="button button-secondary" href="#modules">Explore modules</a>
            </div>
          </div>

          <div className="dashboard-preview" aria-label="Dashboard preview">
            <div className="preview-header">
              <div>
                <span className="preview-kicker">Overview</span>
                <strong>Business dashboard</strong>
              </div>
              <span className="status-dot">Live</span>
            </div>
            <div className="metric-grid">
              <div className="metric-card"><span>Orders</span><strong>1,248</strong><small>this month</small></div>
              <div className="metric-card"><span>Revenue</span><strong>842.6M</strong><small>UZS</small></div>
              <div className="metric-card"><span>Products</span><strong>524</strong><small>active</small></div>
              <div className="metric-card"><span>Customers</span><strong>1,032</strong><small>accounts</small></div>
            </div>
            <div className="chart-placeholder">
              <div className="chart-line" />
              <div className="chart-bars">
                <i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip" id="status">
          <div><span className="trust-label">API</span><strong>{apiState.status === "online" ? "Connected" : apiState.status === "loading" ? "Checking..." : "Offline"}</strong></div>
          <div><span className="trust-label">Database</span><strong>PostgreSQL</strong></div>
          <div><span className="trust-label">Architecture</span><strong>Secure modular platform</strong></div>
          <div><span className="trust-label">Version</span><strong>{apiState.status === "online" ? apiState.version : "0.1.0"}</strong></div>
        </section>

        <section className="modules-section" id="modules">
          <div className="section-heading">
            <span className="eyebrow">Built for daily operations</span>
            <h2>Everything your team needs to keep work moving.</h2>
          </div>
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.title}>
                <span className="module-icon">{module.icon}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className="module-arrow">→</span>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <div>
            <span className="eyebrow">Ready when you are</span>
            <h2>Start with your core operations. Add depth as your business grows.</h2>
          </div>
          <button className="button button-primary" type="button">Create workspace</button>
        </section>
      </main>

      <footer className="footer">
        <span>© 2026 MyBusiness</span>
        <span>Wholesale distribution management</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
