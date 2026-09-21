import { useEffect, useState } from "react";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:10000";

function formatPrice(price: number) {
  return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${apiBase}/api/v1/products`)
      .then(async (response) => {
        const data = (await response.json()) as ProductsResponse & { message?: string };
        if (!response.ok) throw new Error(data.message ?? "Mahsulotlarni yuklab bo'lmadi.");
        setProducts(data.products);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Mahsulotlarni yuklab bo'lmadi.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="customer-page">
      <header className="customer-header">
        <div>
          <span className="eyebrow">MARKETPLACE</span>
          <h1>Mahsulotlar</h1>
          <p>Seller tomonidan bazaga qo'shilgan haqiqiy mahsulotlar shu yerda ko'rinadi.</p>
        </div>
        <div className="db-pill"><span /> LIVE DATABASE</div>
      </header>

      {loading ? (
        <section className="state">Mahsulotlar yuklanmoqda...</section>
      ) : error ? (
        <section className="state error"><strong>Ma'lumotlarni olib bo'lmadi.</strong><span>{error}</span></section>
      ) : products.length === 0 ? (
        <section className="state"><strong>Hozircha mahsulot yo'q.</strong><span>Seller saytida mahsulot qo'shilganda shu oynada avtomatik paydo bo'ladi.</span></section>
      ) : (
        <section className="grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="image">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="no-image">NO IMAGE</div>}
              </div>
              <div className="body">
                <div className="stock">{product.stock > 0 ? `${product.stock} dona mavjud` : "Tugagan"}</div>
                <h2>{product.name}</h2>
                <p>{product.description || "Mahsulot tavsifi kiritilmagan."}</p>
                <strong className="price">{formatPrice(product.price)}</strong>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
