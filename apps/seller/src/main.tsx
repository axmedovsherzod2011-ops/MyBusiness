import { FormEvent, useEffect, useState } from "react";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "https://oneofficeai-1.onrender.com";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stock: "0",
  imageUrl: "",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/products`);
      const data = (await response.json()) as ProductsResponse & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Mahsulotlarni yuklab bo'lmadi.");
      setProducts(data.products);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${apiBase}/api/v1/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          stock: Number(form.stock),
          imageUrl: form.imageUrl,
        }),
      });
      const data = (await response.json()) as { product?: Product; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Mahsulot saqlanmadi.");
      if (data.product) setProducts((current) => [data.product!, ...current]);
      setForm(emptyForm);
      setMessage("Mahsulot bazaga saqlandi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mahsulotni saqlashda xatolik.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="seller-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">SELLER CENTER</span>
          <h1>Mahsulotlar</h1>
          <p>Bu yerga qo'shilgan mahsulotlar to'g'ridan-to'g'ri marketplace bazasiga yoziladi.</p>
        </div>
        <div className="count">{products.length} ta mahsulot</div>
      </header>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-title">
            <div>
              <span className="step">01</span>
              <h2>Yangi mahsulot</h2>
            </div>
            <span className="live">DB LIVE</span>
          </div>

          <label>
            Mahsulot nomi
            <input required maxLength={180} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Wireless Headphones" />
          </label>

          <label>
            Tavsif
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mahsulot haqida qisqacha ma'lumot..." rows={4} />
          </label>

          <div className="two">
            <label>
              Narx
              <input required min="0" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" />
            </label>
            <label>
              Qoldiq
              <input required min="0" step="1" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
          </div>

          <label>
            Rasm URL
            <input type="url" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
            <small>Hozircha rasmni URL orqali biriktiramiz. Demo mahsulot kiritilmagan.</small>
          </label>

          <button disabled={saving} type="submit">{saving ? "Saqlanmoqda..." : "Mahsulotni bazaga qo'shish"}</button>
          {message && <div className="message">{message}</div>}
        </form>

        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="step">02</span>
              <h2>Bazadagi mahsulotlar</h2>
            </div>
          </div>

          {loading ? (
            <div className="empty">Yuklanmoqda...</div>
          ) : products.length === 0 ? (
            <div className="empty"><strong>Hali mahsulot yo'q.</strong><span>Yuqoridagi forma orqali birinchi haqiqiy mahsulotingizni qo'shing.</span></div>
          ) : (
            <div className="product-list">
              {products.map((product) => (
                <article className="product-row" key={product.id}>
                  <div className="thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>No image</span>}</div>
                  <div className="product-info">
                    <strong>{product.name}</strong>
                    <span>{formatPrice(product.price)} · {product.stock} dona</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
