import { useEffect, useState } from "react";
import type { PlatformInfo } from "@marketplace/shared";
import "./styles.css";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:10000";

export default function App() {
  const [api, setApi] = useState<"checking" | "ready" | "offline">("checking");

  useEffect(() => {
    fetch(`${apiBase}/api/v1`)
      .then(async (response) => {
        if (!response.ok) throw new Error("API request failed");
        const data = (await response.json()) as PlatformInfo;
        if (data.name !== "Marketplace API") throw new Error("Unexpected API");
        setApi("ready");
      })
      .catch(() => setApi("offline"));
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <div className="badge">CUSTOMER</div>
        <h1>Marketplace</h1>
        <p>Customer discovery, stores, products, cart and orders will live here.</p>
        <div className={`status ${api}`}>
          <span />
          {api === "checking" ? "Checking API…" : api === "ready" ? "Shared API connected" : "API unavailable"}
        </div>
      </section>
    </main>
  );
}
