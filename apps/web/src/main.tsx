import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getApiStatus } from "./lib/api";
import {
  logout,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeToAuth,
  syncCurrentUser,
} from "./lib/auth";
import type { User } from "firebase/auth";
import "./styles.css";

type ApiState = { status: "loading" } | { status: "online"; version: string } | { status: "offline"; message: string };

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
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const runAuth = async (action: () => Promise<unknown>) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      await action();
      await syncCurrentUser();
      setAuthOpen(false);
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => subscribeToAuth(setUser), []);

  useEffect(() => {
    if (user) void syncCurrentUser().catch((error) => console.error("Account sync failed", error));
  }, [user]);

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

  const submitEmailAuth = () =>
    runAuth(() =>
      authMode === "signIn" ? signInWithEmail(email, password) : signUpWithEmail(email, password),
    );

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
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user.displayName || user.email || "Account"}</span>
            <button className="button button-dark" type="button" disabled={authBusy} onClick={() => runAuth(logout)}>
              {authBusy ? "..." : "Sign out"}
            </button>
          </div>
        ) : (
          <button className="button button-dark" type="button" onClick={() => setAuthOpen(true)}>
            Sign in
          </button>
        )}
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Wholesale business management</span>
            <h1>Run your distribution business from one clear workspace.</h1>
            <p>Manage products, stock, orders, customers, payments and reports without spreadsheets scattered across your team.</p>
            <div className="hero-actions">
              <button className="button button-primary" type="button" onClick={() => setAuthOpen(true)}>Get started</button>
              <a className="button button-secondary" href="#modules">Explore modules</a>
            </div>
          </div>

          <div className="dashboard-preview" aria-label="Dashboard preview">
            <div className="preview-header">
              <div><span className="preview-kicker">Overview</span><strong>Business dashboard</strong></div>
              <span className="status-dot">Live</span>
            </div>
            <div className="metric-grid">
              <div className="metric-card"><span>Orders</span><strong>1,248</strong><small>this month</small></div>
              <div className="metric-card"><span>Revenue</span><strong>842.6M</strong><small>UZS</small></div>
              <div className="metric-card"><span>Products</span><strong>524</strong><small>active</small></div>
              <div className="metric-card"><span>Customers</span><strong>1,032</strong><small>accounts</small></div>
            </div>
            <div className="chart-placeholder"><div className="chart-line" /><div className="chart-bars"><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
          </div>
        </section>

        <section className="trust-strip" id="status">
          <div><span className="trust-label">API</span><strong>{apiState.status === "online" ? "Connected" : apiState.status === "loading" ? "Checking..." : "Offline"}</strong></div>
          <div><span className="trust-label">Database</span><strong>PostgreSQL</strong></div>
          <div><span className="trust-label">Architecture</span><strong>Secure modular platform</strong></div>
          <div><span className="trust-label">Version</span><strong>{apiState.status === "online" ? apiState.version : "0.1.0"}</strong></div>
        </section>

        <section className="modules-section" id="modules">
          <div className="section-heading"><span className="eyebrow">Built for daily operations</span><h2>Everything your team needs to keep work moving.</h2></div>
          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" key={module.title}>
                <span className="module-icon">{module.icon}</span><h3>{module.title}</h3><p>{module.description}</p><span className="module-arrow">→</span>
              </article>
            ))}
          </div>
        </section>

        <section className="cta">
          <div><span className="eyebrow">Ready when you are</span><h2>Start with your core operations. Add depth as your business grows.</h2></div>
          <button className="button button-primary" type="button" onClick={() => setAuthOpen(true)}>Create workspace</button>
        </section>
      </main>

      {authOpen && (
        <div role="presentation" onClick={() => !authBusy && setAuthOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 20 }}>
          <div role="dialog" aria-modal="true" aria-label="Authentication" onClick={(event) => event.stopPropagation()} style={{ width: "min(420px, 100%)", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 24px 80px rgba(0,0,0,.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div><h2 style={{ margin: 0 }}>{authMode === "signIn" ? "Welcome back" : "Create your account"}</h2><p style={{ margin: "6px 0 0", color: "#666" }}>{authMode === "signIn" ? "Sign in to MyBusiness." : "Create your MyBusiness workspace."}</p></div>
              <button type="button" className="button button-secondary" onClick={() => setAuthOpen(false)} disabled={authBusy}>×</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <button className="button button-secondary" type="button" disabled={authBusy} onClick={() => runAuth(signInWithGoogle)}>Continue with Google</button>
              <button className="button button-secondary" type="button" disabled={authBusy} onClick={() => runAuth(signInWithApple)}>Continue with Apple</button>
            </div>
            <div style={{ margin: "18px 0", textAlign: "center", color: "#888", fontSize: 13 }}>or continue with email</div>
            <form onSubmit={(event) => { event.preventDefault(); void submitEmailAuth(); }} style={{ display: "grid", gap: 10 }}>
              <input aria-label="Email" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }} />
              <input aria-label="Password" type="password" placeholder="Password" autoComplete={authMode === "signIn" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }} />
              {authError && <p style={{ margin: 0, color: "#b42318", fontSize: 13 }}>{authError}</p>}
              <button className="button button-primary" type="submit" disabled={authBusy}>{authBusy ? "Please wait..." : authMode === "signIn" ? "Sign in" : "Create account"}</button>
            </form>
            <button type="button" className="button button-secondary" disabled={authBusy} onClick={() => { setAuthMode((mode) => mode === "signIn" ? "signUp" : "signIn"); setAuthError(""); }} style={{ width: "100%", marginTop: 10 }}>
              {authMode === "signIn" ? "Create a new account" : "I already have an account"}
            </button>
          </div>
        </div>
      )}

      <footer className="footer"><span>© 2026 MyBusiness</span><span>Wholesale distribution management</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
