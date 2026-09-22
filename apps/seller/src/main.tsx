import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";
const emptyForm = { name: "", description: "", price: "", stock: "0", imageUrl: "" };

function formatPrice(price: number) { return new Intl.NumberFormat("uz-UZ").format(price) + " so'm"; }

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/products`, { headers: { Accept: "application/json" } });
      const data = (await response.json()) as ProductsResponse & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "Mahsulotlarni yuklab bo'lmadi.");
      setProducts(data.products);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Xatolik yuz berdi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadProducts(); }, []);

  const filtered = useMemo(() => products.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const catalogValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/products`, { method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify({ name:form.name.trim(), description:form.description.trim(), price:Number(form.price), stock:Number(form.stock), imageUrl:form.imageUrl.trim() }) });
      const data = (await response.json()) as { product?: Product; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Mahsulot saqlanmadi.");
      if (data.product) setProducts((current) => [data.product!, ...current]);
      setForm(emptyForm); setMessage("Mahsulot muvaffaqiyatli bazaga saqlandi."); setTab("products");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Saqlashda xatolik."); }
    finally { setSaving(false); }
  }

  const nav = [["overview","Dashboard"],["products","Mahsulotlar"],["orders","Buyurtmalar"],["inventory","Ombor"],["marketing","Marketing"],["analytics","Analitika"]];

  return <main className="seller-shell">
    <aside className="sidebar">
      <a className="brand" href="/">MYBUSINESS <span>SELLER</span></a>
      <nav>{nav.map(([id,label]) => <button key={id} className={tab===id?"active":""} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="side-note"><b>AI tayyor</b><span>Keyingi bosqichda mahsulot kartasini AI bilan tez to'ldiramiz.</span></div>
    </aside>
    <section className="seller-main">
      <header className="top"><div><span className="eyebrow">SELLER CENTER</span><h1>{tab==="overview"?"Dashboard":tab==="products"?"Mahsulotlar":nav.find(([id])=>id===tab)?.[1]}</h1><p>Do'koningizni bitta joydan boshqaring.</p></div><div className="status">● LIVE DATABASE</div></header>

      {tab==="overview" && <><div className="stats"><div><span>Mahsulotlar</span><b>{products.length}</b></div><div><span>Ombordagi dona</span><b>{totalStock}</b></div><div><span>Ombor qiymati</span><b>{formatPrice(catalogValue)}</b></div><div><span>Tugagan</span><b>{products.filter(p=>p.stock===0).length}</b></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Tezkor amallar</h2></div><button className="primary" onClick={()=>setTab("add")}>+ Yangi mahsulot</button><button className="secondary" onClick={()=>setTab("products")}>Mahsulotlarni ko'rish</button></section><section className="panel"><div className="panel-head"><h2>AI insight</h2><span className="ai">AI</span></div><p className="insight">Mahsulotlar soni va ombor ma'lumotlari real bazadan olinmoqda. Keyingi bosqichda savdo, ko'rish va konversiya ma'lumotlarini ham shu panelga qo'shamiz.</p></section></div></>}

      {(tab==="products" || tab==="inventory") && <section className="panel"><div className="panel-head"><div><h2>{tab==="inventory"?"Ombor":"Mahsulotlar"}</h2><span className="muted">{filtered.length} ta natija</span></div><input className="mini-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Qidirish..." /></div>{loading?<div className="empty">Yuklanmoqda...</div>:filtered.length?<div className="table">{filtered.map(p=><div className="row" key={p.id}><div className="thumb">{p.imageUrl?<img src={p.imageUrl} alt=""/>:"NO IMAGE"}</div><div><b>{p.name}</b><span>{formatPrice(p.price)}</span></div><strong className={p.stock===0?"out":""}>{p.stock} dona</strong></div>)}</div>:<div className="empty"><b>Mahsulot topilmadi.</b><span>Qidiruvni o'zgartiring yoki yangi mahsulot qo'shing.</span></div>}</section>}

      {tab==="add" && <section className="panel form-panel"><div className="panel-head"><div><h2>Yangi mahsulot</h2><span className="muted">Customer ko'radigan asosiy ma'lumotlar</span></div><span className="ai">AI READY</span></div><form onSubmit={submit}><label>Mahsulot nomi<input required maxLength={180} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Masalan: Wireless Headphones"/></label><label>Tavsif<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mahsulotni xaridor uchun tushunarli qilib yozing..." rows={5}/></label><div className="two"><label>Narx<input required min="0" step="0.01" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Qoldiq<input required min="0" step="1" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label></div><label>Rasm URL<input type="url" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="https://..."/></label><button className="primary full" disabled={saving}>{saving?"Saqlanmoqda...":"Mahsulotni bazaga qo'shish"}</button>{message&&<div className="message">{message}</div>}</form></section>}

      {["orders","marketing","analytics"].includes(tab) && <section className="panel empty-panel"><span className="eyebrow">KEYINGI BOSQICH</span><h2>{nav.find(([id])=>id===tab)?.[1]}</h2><p>Arxitektura bu bo'lim uchun tayyorlanadi. Hozir mavjud DB ma'lumotlari buzilmaydi; keyingi iteratsiyada real API bilan ulanadi.</p></section>}
    </section>
  </main>;
}
