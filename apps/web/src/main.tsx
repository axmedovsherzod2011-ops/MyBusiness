import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <header>
        <span className="logo">MARKETPLACE</span>
        <nav><a href="/">Home</a><a href="/stores">Stores</a><a href="/cart">Cart</a></nav>
      </header>
      <section className="hero">
        <p className="eyebrow">A fresh marketplace foundation</p>
        <h1>Discover products from independent stores.</h1>
        <p className="subtitle">The old business-management application is gone. This codebase is now reserved for the marketplace product.</p>
      </section>
      <section className="placeholder">
        <h2>Marketplace core is ready to build</h2>
        <p>Catalog, stores, search, product pages, cart, checkout, seller tools and admin features will be added from the product requirements.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>
);
