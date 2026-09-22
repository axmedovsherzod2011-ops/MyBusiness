import { useEffect, useMemo, useState } from "react";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";
const categories = ["Barchasi", "Elektronika", "Uy uchun", "Go'zallik", "Kiyim", "Aksessuarlar"];

function formatPrice(price: number) {
  return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
}

function inferCategory(product: Product) {
  const text = `${product.name} ${product.description}`.toLowerCase();
  if (/telefon|phone|noutbuk|laptop|quloqchin|naushnik|charger|zaryad|kompyuter|mouse|klaviatura/.test(text)) return "Elektronika";
  if (/krem|shampun|parfyum|kosmet|rouge|lipstick|makeup|soch|teri/.test(text)) return "Go'zallik";
  if (/futbolka|ko'ylak|kurtka|shim|kiyim|dress|shirt/.test(text)) return "Kiyim";
  if (/sumka|soat|ko'zoynak|aksessuar|bag|watch/.test(text)) return "Aksessuarlar";
  if (/idish|oshxona|uy|yostiq|choyshab|clean/.test(text)) return "Uy uchun";
  return "Boshqa";
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Barchasi");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<number[]>(() => JSON.parse(localStorage.getItem("mybusiness:favorites") ?? "[]"));
  const [cart, setCart] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem("mybusiness:cart") ?? "{}"));

  useEffect(() => {
    fetch(`${apiBase}/api/v1/products`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const data = (await response.json()) as ProductsResponse & { message?: string };
        if (!response.ok) throw new Error(data.message ?? "Mahsulotlarni yuklab bo'lmadi.");
        setProducts(data.products);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Mahsulotlarni yuklab bo'lmadi."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => localStorage.setItem("mybusiness:favorites", JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem("mybusiness:cart", JSON.stringify(cart)), [cart]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesQuery = !normalized || `${product.name} ${product.description}`.toLowerCase().includes(normalized);
      const matchesCategory = category === "Barchasi" || inferCategory(product) === category;
      return matchesQuery && matchesCategory;
    });
    return [...result].sort((a, z) => sort === "price-low" ? a.price - z.price : sort === "price-high" ? z.price - a.price : z.createdAt.localeCompare(a.createdAt));
  }, [products, query, category, sort]);

  const cartCount = Object.values(cart).reduce((sum, value) => sum + value, 0);

  function toggleFavorite(id: number) {
    setFavorites((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function addToCart(product: Product) {
    if (product.stock <= 0) return;
    setCart((current) => ({ ...current, [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stock) }));
  }

  return (
    <main className="market">
      <header className="header">
        <a className="logo" href="/">MYBUSINESS<span>MARKET</span></a>
        <div className="search-wrap">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mahsulot, brend yoki kategoriya qidiring..." aria-label="Mahsulot qidirish" />
          {query && <button className="clear" onClick={() => setQuery("")}>×</button>}
        </div>
        <nav className="actions">
          <button onClick={() => setFavorites([])}>♡ <span>Sevimlilar</span></button>
          <button className="cart">Savat <b>{cartCount}</b></button>
        </nav>
      </header>

      <section className="hero">
        <div>
          <span className="eyebrow">MYBUSINESS MARKETPLACE</span>
          <h1>Kerakli mahsulotni<br /><em>oson toping.</em></h1>
          <p>Haqiqiy sellerlar joylagan mahsulotlar. Qidiring, solishtiring va savatga bir bosishda qo'shing.</p>
          <div className="hero-points"><span>✓ Haqiqiy mahsulotlar</span><span>✓ Aniq narx</span><span>✓ Oddiy xarid</span></div>
        </div>
      </section>

      <section className="content">
        <div className="section-head">
          <div><span className="eyebrow">KATALOG</span><h2>Mahsulotlarni toping</h2></div>
          <div className="controls">
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Saralash">
              <option value="newest">Yangilari</option>
              <option value="price-low">Arzonidan</option>
              <option value="price-high">Qimmatidan</option>
            </select>
          </div>
        </div>

        <div className="categories" role="tablist">
          {categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>

        {loading ? <section className="state"><strong>Mahsulotlar yuklanmoqda...</strong><span>Bir necha soniya.</span></section> :
        error ? <section className="state error"><strong>Marketplace vaqtincha ulanmayapti.</strong><span>{error}</span></section> :
        !visibleProducts.length ? <section className="state"><strong>Mahsulot topilmadi.</strong><span>Qidiruv yoki kategoriyani o'zgartirib ko'ring.</span><button onClick={() => { setQuery(""); setCategory("Barchasi"); }}>Filtrlarni tozalash</button></section> :
        <div className="grid">
          {visibleProducts.map((product) => {
            const liked = favorites.includes(product.id);
            return <article className="card" key={product.id}>
              <div className="photo">
                {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <span>NO IMAGE</span>}
                <button className={`favorite ${liked ? "liked" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label="Sevimliga qo'shish">{liked ? "♥" : "♡"}</button>
                {product.stock <= 0 && <span className="soldout">Tugagan</span>}
              </div>
              <div className="card-body">
                <span className="category">{inferCategory(product)}</span>
                <h3>{product.name}</h3>
                <p>{product.description || "Mahsulot tavsifi kiritilmagan."}</p>
                <div className="buy-row">
                  <strong>{formatPrice(product.price)}</strong>
                  <button disabled={product.stock <= 0} onClick={() => addToCart(product)}>{product.stock > 0 ? "Savatga +" : "Tugagan"}</button>
                </div>
              </div>
            </article>;
          })}
        </div>}
      </section>
      <footer>MYBUSINESS MARKET · Xaridor uchun sodda, seller uchun qulay.</footer>
    </main>
  );
}
