import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";

const categories = [
  ["all","Barcha mahsulotlar","✦"],
  ["new","Yangi","✧"],
  ["care","Parvarish","♡"],
  ["makeup","Makiyaj","◌"],
  ["perfume","Parfyumeriya","◈"],
  ["fashion","Moda","◇"],
  ["health","Sog'liq","+"],
  ["home","Uy","⌂"],
  ["kids","Bolalar","♧"],
  ["sale","Aksiyalar","%"],
] as const;

const subcategories: Record<string,string[]> = {
  care:["Yuz parvarishi","Tana parvarishi","Sochlar","Erkaklar","Gigiyena","Kosmetsevtika"],
  makeup:["Ko'zlar","Lablar","Yuz","Qoshlar","Tirnoqlar","Pardoz aksessuarlari"],
  perfume:["Ayollar uchun","Erkaklar uchun","Uy iforlari","Parfyum kosmetikasi","Sinov namunalari"],
  fashion:["Ayollar","Erkaklar","Bolalar","Kiyim-kechak","Aksessuarlar"],
  health:["Vitaminlar","Wellness","Omega","Kollagen","Sport","Gigiyena"],
  home:["Kir yuvish","Idishlar","Yuzalar","Vanna","Oshxona","Havo va matolar"],
  kids:["Gigiyena","Teri parvarishi","Qizlar uchun","O'g'il bolalar uchun"],
};

const rules: Record<string,RegExp> = {
  care:/krem|shampun|balzam|mask|loson|serum|tonik|parvarish|soch|teri|yuz|dush|deodorant|gigien/i,
  makeup:/rouge|lipstick|pomada|jilo|kosmet|makeup|makiyaj|tonal|kushon|maskara|tush|qosh|ko.z|pudra|bronzer/i,
  perfume:/parfyum|parfum|ifor|aroma|atir|eau de|toilet water/i,
  fashion:/futbolka|ko.y|kurtka|shim|kiyim|dress|shirt|sumka|soat|ko.zoynak|paypoq|aksessuar/i,
  health:/vitamin|omega|collagen|kollagen|wellness|magniy|immun|salomat|sog.liq|protein/i,
  home:/uy|oshxona|idish|tozalash|kir yuv|salfetka|sovun|yuzalar|vanna|havo|mato/i,
  kids:/bola|bolalar|baby|kid|umoo/i,
};


function Icon({name,size=20}:{name:"home"|"grid"|"search"|"bag"|"user"|"heart"|"menu"|"close";size?:number}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,ariaHidden:true};
  const paths={
    home:<><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    grid:<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    bag:<><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    user:<><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    heart:<path d="M20.8 8.7c0 5-8.8 10.3-8.8 10.3S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z"/>,
    menu:<><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    close:<><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function money(n:number){ return new Intl.NumberFormat("uz-UZ").format(n)+" so'm"; }
function isNew(p:Product){ const t=Date.parse(p.createdAt); return Number.isFinite(t) && Date.now()-t <= 30*24*60*60*1000; }
function cat(p:Product){
  const t=p.name+" "+p.description;
  for(const k of Object.keys(rules)){ if(rules[k]?.test(t)) return k; }
  return "other";
}
function label(k:string){ return categories.find(c=>c[0]===k)?.[1] || "Boshqa"; }

function ProductCard({p,liked,onLike,onCart,onOpen}:{p:Product;liked:boolean;onLike:(id:number)=>void;onCart:(p:Product)=>void;onOpen:(p:Product)=>void}){
  const fresh=isNew(p);
  return <article className="product-card">
    <div className="product-image" onClick={()=>onOpen(p)}>
      {p.imageUrl?<img src={p.imageUrl} alt={p.name} loading="lazy"/>:<div className="no-image">MYBUSINESS</div>}
      <div className="badges">{fresh&&<span>YANGI</span>}{p.stock>0&&<span className="stock-badge">SOTUVDA</span>}</div>
      <button className={"heart "+(liked?"liked":"")} onClick={e=>{e.stopPropagation();onLike(p.id)}} aria-label="Sevimliga qo'shish">{liked?"♥":"♡"}</button>
      {p.stock<=0&&<span className="sold-out">Tugagan</span>}
    </div>
    <div className="product-info">
      <span className="product-cat">{label(cat(p))}</span>
      <button className="product-name" onClick={()=>onOpen(p)}>{p.name}</button>
      <p>{p.description||"Mahsulot tavsifi kiritilmagan."}</p>
      <div className="product-bottom"><div><strong>{money(p.price)}</strong><small>{p.stock>0?"Sotuvda":"Tugagan"}</small></div><button className="add-button" disabled={p.stock<=0} onClick={()=>onCart(p)}>{p.stock>0?"+":"—"}</button></div>
    </div>
  </article>;
}

function Grid({items,favs,onLike,onCart,onOpen}:{items:Product[];favs:number[];onLike:(id:number)=>void;onCart:(p:Product)=>void;onOpen:(p:Product)=>void}){
  return <div className="product-grid">{items.map(p=><ProductCard key={p.id} p={p} liked={favs.includes(p.id)} onLike={onLike} onCart={onCart} onOpen={onOpen}/>)}</div>;
}

function Mini({p,onOpen,onCart}:{p:Product;onOpen:()=>void;onCart:()=>void}){
  return <div className="mini-product"><button className="mini-image" onClick={onOpen}>{p.imageUrl?<img src={p.imageUrl} alt=""/>:"MB"}</button><div><button className="mini-name" onClick={onOpen}>{p.name}</button><b>{money(p.price)}</b><button className="mini-add" onClick={onCart} disabled={!p.stock}>Savatga</button></div></div>;
}

export default function App(){
  const [products,setProducts]=useState<Product[]>([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [sub,setSub]=useState("");
  const [sort,setSort]=useState("newest");
  const [availability,setAvailability]=useState<"all"|"stock">("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [favs,setFavs]=useState<number[]>(()=>JSON.parse(localStorage.getItem("mybusiness:favorites")||"[]"));
  const [cart,setCart]=useState<Record<string,number>>(()=>JSON.parse(localStorage.getItem("mybusiness:cart")||"{}"));
  const [panel,setPanel]=useState<"cart"|"favorites"|"menu"|"profile"|"filters"|"search"|null>(null);
  const [quick,setQuick]=useState<Product|null>(null);
  const [toast,setToast]=useState("");

  useEffect(()=>{
    fetch(apiBase+"/api/v1/products",{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as ProductsResponse & {message?:string};if(!r.ok)throw new Error(d.message||"API xatosi");setProducts(d.products||[])})
      .catch(e=>setError(e instanceof Error?e.message:"API bilan ulanishda xatolik"))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>localStorage.setItem("mybusiness:favorites",JSON.stringify(favs)),[favs]);
  useEffect(()=>localStorage.setItem("mybusiness:cart",JSON.stringify(cart)),[cart]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2200);return()=>clearTimeout(t)},[toast]);

  const visible=useMemo(()=>{
    const q=query.toLowerCase().trim();
    const filtered=products.filter(p=>{
      const text=(p.name+" "+p.description).toLowerCase();
      const subMatch=!sub||text.includes(sub.toLowerCase());
      const categoryMatch=category==="all"||(category==="new"?isNew(p):category==="sale"?p.stock>0:cat(p)===category);
      return (!q||text.includes(q))&&subMatch&&categoryMatch&&(availability==="all"||p.stock>0);
    });
    return [...filtered].sort((a,b)=>sort==="price-low"?a.price-b.price:sort==="price-high"?b.price-a.price:sort==="name"?a.name.localeCompare(b.name):Date.parse(b.createdAt)-Date.parse(a.createdAt));
  },[products,query,category,sub,sort,availability]);

  const cartItems=Object.entries(cart).map(([id,q])=>({p:products.find(x=>x.id===Number(id)),q})).filter(x=>x.p) as {p:Product;q:number}[];
  const cartCount=cartItems.reduce((s,x)=>s+x.q,0);
  const cartTotal=cartItems.reduce((s,x)=>s+x.p.price*x.q,0);
  const newProducts=[...products].filter(isNew).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,8);
  const popular=[...products].filter(p=>p.stock>0).sort((a,b)=>b.stock-a.stock).slice(0,8);
  const categoryCounts=products.reduce<Record<string,number>>((acc,p)=>{const k=cat(p);acc[k]=(acc[k]||0)+1;return acc},{}); 

  function catalog(){document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});}
  function chooseCategory(k:string){setCategory(k);setSub("");setPanel(null);setTimeout(catalog,30);}
  function chooseSub(s:string){setSub(s);setPanel(null);setTimeout(catalog,30);}
  function add(p:Product){if(!p.stock)return;setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}));setToast("Mahsulot savatga qo'shildi");setPanel("cart");}
  function qty(id:number,d:number){setCart(c=>{const n=(c[id]||0)+d;if(n<=0){const z={...c};delete z[id];return z}const p=products.find(x=>x.id===id);return {...c,[id]:Math.min(n,p?.stock||n)}})}
  function clearFilters(){setQuery("");setCategory("all");setSub("");setSort("newest");setAvailability("all");}
  function removeFromCart(id:number){setCart(c=>{const z={...c};delete z[id];return z})}
  function openSearch(){setPanel("search");setTimeout(()=>document.querySelector<HTMLInputElement>(".screen-search-input")?.focus(),50);}
  function toggleFav(id:number){setFavs(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);}

  return <main className="market">
    <div className="utility-bar"><div><span>O'zbekiston</span><button>UZ / O'zbekcha⌄</button></div><div><span>MYBUSINESS MARKET</span><button onClick={()=>setPanel("profile")}>Kirish / ro'yxatdan o'tish</button></div></div>
    <div className="promo-bar"><span>MYBUSINESS MARKET</span><b>Yangi mahsulotlar va maxsus takliflar</b><button onClick={()=>chooseCategory("new")}>Yangi tovarlarni ko'rish →</button></div>

    <header className="header">
      <button className="mobile-menu" aria-label="Menyu" onClick={()=>setPanel("menu")}><Icon name="menu"/></button>
      <a className="logo" href="/">MYBUSINESS<span>MARKET</span></a><span className="build-pill">APP</span>
      <div className="search-wrap"><span className="search-icon"><Icon name="search" size={18}/></span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki kategoriya qidiring..."/>{query&&<button className="clear" onClick={()=>setQuery("")}>×</button>}<button className="search-button" onClick={catalog}>Qidirish</button></div>
      <div className="header-actions"><button onClick={()=>setPanel("profile")}><span><Icon name="user" size={19}/></span><small>Profil</small></button><button onClick={()=>setPanel("favorites")}><span><Icon name="heart" size={19}/></span><small>Sevimlilar</small>{favs.length>0&&<b>{favs.length}</b>}</button><button onClick={()=>setPanel("cart")}><span><Icon name="bag" size={19}/></span><small>Savat</small>{cartCount>0&&<b>{cartCount}</b>}</button></div>
    </header>

    <nav className="category-nav"><div className="category-inner">{categories.map(c=><button key={c[0]} className={category===c[0]?"active":""} onClick={()=>chooseCategory(c[0])}><span>{c[2]}</span>{c[1]}</button>)}</div></nav>

    {category!=="all"&&category!=="new"&&category!=="sale"&&subcategories[category]&&
      <div className="subnav"><div><b>{label(category)}</b>{subcategories[category].map(s=><button className={sub===s?"active":""} key={s} onClick={()=>chooseSub(s)}>{s}</button>)}</div></div>}

    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">MYBUSINESS MARKETPLACE</span><h1>Har kuni kerakli<br/><em>narsalar bir joyda.</em></h1><p>Mahalliy sellerlarning haqiqiy mahsulotlari. Qidiring, tanlang va xaridni oddiy boshqaring.</p><div className="hero-actions"><button className="primary" onClick={catalog}>Katalogni ko'rish</button><button className="ghost" onClick={()=>chooseCategory("new")}>Yangi mahsulotlar →</button></div><div className="hero-trust"><span>✓ Haqiqiy sellerlar</span><span>✓ So'mda narxlar</span><span>✓ Real ombor</span></div></div>
      <div className="hero-art"><div className="hero-card a"><span>YANGI</span><b>Tanlangan<br/>mahsulotlar</b></div><div className="hero-card b"><span>MAXSUS</span><b>Har kuni<br/>yangi taklif</b></div><div className="hero-orb">MB</div></div>
    </section>

    <section className="quick-categories"><div className="section-title compact"><span className="eyebrow">KATEGORIYALAR</span><h2>Mahsulotni bo'limdan toping</h2></div><div className="category-cards">{categories.slice(2,9).map(c=><button key={c[0]} className="category-card" onClick={()=>chooseCategory(c[0])}><span>{c[2]}</span><b>{c[1]}</b><small>{categoryCounts[c[0]]||0} mahsulot</small><i>→</i></button>)}</div></section>

    <section className="campaign-grid">
      <button className="campaign campaign-light" onClick={()=>chooseCategory("new")}><span>YANGI TOVARLAR</span><strong>Yangi kolleksiyani<br/>birinchi bo'lib ko'ring</strong><em>Ko'rish →</em></button>
      <button className="campaign campaign-dark" onClick={()=>chooseCategory("sale")}><span>AKSIYALAR</span><strong>Omborda mavjud<br/>maxsus tanlovlar</strong><em>Katalogga o'tish →</em></button>
      <button className="campaign campaign-soft" onClick={()=>chooseCategory("all")}><span>MYBUSINESS</span><strong>Barcha sellerlar<br/>mahsulotlari bir joyda</strong><em>Barchasini ko'rish →</em></button>
    </section>

    <section className="product-section"><div className="section-title"><div><span className="eyebrow">YANGI</span><h2>Yangi mahsulotlar</h2><p>Yaqinda marketplace'ga qo'shilgan mahsulotlar.</p></div><button onClick={()=>chooseCategory("new")}>Hammasini ko'rish →</button></div>{loading?<div className="state">Mahsulotlar yuklanmoqda...</div>:newProducts.length?<Grid items={newProducts} favs={favs} onLike={toggleFav} onCart={add} onOpen={setQuick}/>:<div className="state">Hozircha yangi mahsulotlar yo'q.</div>}</section>

    <section className="deal-banner"><div><span className="eyebrow">MAXSUS TAKLIF</span><h2>Bugun tanlash uchun<br/><em>ko'proq sabab.</em></h2><p>Omborda mavjud mahsulotlarni tez toping va savatga qo'shing.</p><button className="primary" onClick={()=>chooseCategory("sale")}>Aksiyalarni ko'rish</button></div><div className="deal-badge"><strong>MB</strong><span>MARKET</span><b>UZS</b></div></section>

    <section className="product-section"><div className="section-title"><div><span className="eyebrow">OMMABOP</span><h2>Ko'p tanlanayotganlar</h2><p>Hozir omborda mavjud mahsulotlar.</p></div><button onClick={catalog}>Katalogni ko'rish →</button></div><Grid items={popular} favs={favs} onLike={toggleFav} onCart={add} onOpen={setQuick}/></section>

    <section className="benefits"><div><span>✓</span><b>Real mahsulotlar</b><small>Seller bazasidan</small></div><div><span>₿</span><b>Shaffof narx</b><small>UZS formatida</small></div><div><span>⌕</span><b>Oson qidiruv</b><small>Kategoriya va bo'limlar</small></div><div><span>♡</span><b>Sevimlilar</b><small>Saqlab qo'ying</small></div></section>

    <section id="catalog" className="catalog-section">
      <div className="catalog-head"><div><span className="eyebrow">KATALOG</span><h2>{category==="all"?"Barcha mahsulotlar":label(category)}</h2><p>{visible.length} ta mahsulot topildi</p></div><div className="catalog-tools"><button onClick={()=>setPanel("filters")}>☷ Filtrlar</button><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Yangi qo'shilgan</option><option value="price-low">Narx: arzonidan</option><option value="price-high">Narx: qimmatidan</option><option value="name">Nomi bo'yicha</option></select></div></div>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <div><b>Filtrlar</b><button onClick={clearFilters}>Barchasini tozalash</button></div>
          <h4>Bo'lim</h4>
          {categories.map(c=><label key={c[0]}><input type="radio" checked={category===c[0]} onChange={()=>{setCategory(c[0]);setSub("")}}/><span>{c[1]}</span></label>)}
          {category!=="all"&&subcategories[category]&&<><h4>Ichki bo'lim</h4>{subcategories[category].map(s=><label key={s}><input type="radio" checked={sub===s} onChange={()=>setSub(s)}/><span>{s}</span></label>)}</>}
          <h4>Mavjudligi</h4><label><input type="checkbox" checked={availability==="stock"} onChange={e=>setAvailability(e.target.checked?"stock":"all")}/><span>Faqat sotuvdagi</span></label>
        </aside>
        <div className="catalog-results">
          {error?<div className="state error"><b>Marketplace API bilan ulanishda xatolik.</b><span>{error}</span><button onClick={()=>location.reload()}>Qayta urinish</button></div>:loading?<div className="state">Mahsulotlar yuklanmoqda...</div>:visible.length?<Grid items={visible} favs={favs} onLike={toggleFav} onCart={add} onOpen={setQuick}/>:<div className="state"><b>Mahsulot topilmadi.</b><button onClick={clearFilters}>Filtrlarni tozalash</button></div>}
        </div>
      </div>
    </section>

    <footer className="footer"><div><a className="logo" href="/">MYBUSINESS<span>MARKET</span></a><p>Sellerlar va xaridorlarni bog'laydigan zamonaviy marketplace.</p></div><div><b>Marketplace</b><button onClick={catalog}>Katalog</button><button onClick={()=>chooseCategory("new")}>Yangi mahsulotlar</button><button onClick={()=>chooseCategory("sale")}>Aksiyalar</button><button onClick={()=>setPanel("favorites")}>Sevimlilar</button></div><div><b>Yordam</b><span>Buyurtma berish</span><span>Yetkazib berish</span><span>Qaytarish</span></div><div><b>Til va hudud</b><span>O'zbekiston</span><span>UZ / O'zbekcha</span></div></footer>

    <nav className="mobile-nav" aria-label="Asosiy navigatsiya">
  <button className="active" onClick={()=>{setPanel(null);scrollTo(0,0)}}><span><Icon name="home"/></span><b>Asosiy</b></button>
  <button onClick={()=>setPanel("menu")}><span><Icon name="grid"/></span><b>Katalog</b></button>
  <button onClick={openSearch}><span><Icon name="search"/></span><b>Qidirish</b></button>
  <button onClick={()=>setPanel("cart")}><span><Icon name="bag"/></span><b>Savat</b>{cartCount>0&&<b>{cartCount}</b>}</button>
  <button onClick={()=>setPanel("profile")}><span><Icon name="user"/></span><b>Profil</b></button>
</nav>

    {panel&&<div className="drawer-backdrop" onClick={()=>setPanel(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head"><button className="screen-back" onClick={()=>setPanel(null)} aria-label="Orqaga">←</button><h2>{panel==="cart"?"Savat":panel==="favorites"?"Sevimlilar":panel==="profile"?"Profil":panel==="filters"?"Filtrlar":panel==="search"?"Qidirish":"Katalog"}</h2><span className="screen-head-spacer"/></div>
      {panel==="profile"&&<div className="profile-panel"><div className="profile-icon">♙</div><h3>MyBusiness xaridori</h3><p>Kirish yoki ro'yxatdan o'tish orqali profil, manzillar va buyurtmalarni boshqarish mumkin.</p><button className="primary full" onClick={()=>setToast("Profil autentifikatsiyasi keyingi bosqichda ulanadi")}>Kirish / ro'yxatdan o'tish</button></div>}
      {panel==="menu"&&<div className="drawer-menu">{categories.map(c=><button key={c[0]} onClick={()=>chooseCategory(c[0])}>{c[2]} {c[1]} <b>→</b></button>)}</div>}
      {panel==="search"&&<div className="screen-search"><div className="screen-search-box"><Icon name="search" size={20}/><input className="screen-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki kategoriya qidiring..." autoFocus/><button onClick={()=>setQuery("")} disabled={!query}>×</button></div><div className="screen-search-meta">{query?`${visible.length} ta mahsulot topildi`:"Qidirish uchun mahsulot nomini yozing"}</div>{query&&<div className="screen-search-results">{visible.length?<Grid items={visible} favs={favs} onLike={toggleFav} onCart={add} onOpen={setQuick}/>:<div className="state"><b>Mahsulot topilmadi.</b><button onClick={()=>setQuery("")}>Qidiruvni tozalash</button></div>}</div>}</div>}
      {panel==="filters"&&<div className="drawer-menu"><button onClick={()=>{setCategory("all");setSub("");setPanel(null)}}>✦ Barcha mahsulotlar</button>{categories.slice(1).map(c=><button key={c[0]} onClick={()=>chooseCategory(c[0])}>{c[2]} {c[1]} <b>→</b></button>)}<button onClick={()=>{setAvailability(availability==="stock"?"all":"stock");setPanel(null)}}>{availability==="stock"?"✓":"○"} Faqat sotuvdagi</button><button onClick={()=>{clearFilters();setPanel(null)}}>↺ Barchasini tozalash</button></div>}
      {panel==="favorites"&&<div className="drawer-list">{products.filter(p=>favs.includes(p.id)).map(p=><Mini key={p.id} p={p} onOpen={()=>setQuick(p)} onCart={()=>add(p)}/>) }{!favs.length&&<div className="drawer-empty">Hali sevimli mahsulotlar yo'q.</div>}</div>}
      {panel==="cart"&&<div className="drawer-cart">{cartItems.map(x=><div className="cart-item" key={x.p.id}><div className="mini-image">{x.p.imageUrl?<img src={x.p.imageUrl} alt=""/>:"MB"}</div><div><b>{x.p.name}</b><span>{money(x.p.price)} × {x.q}</span><div className="qty"><button aria-label="Kamaytirish" onClick={()=>qty(x.p.id,-1)}>−</button><b>{x.q}</b><button aria-label="Ko'paytirish" onClick={()=>qty(x.p.id,1)}>+</button><button className="remove-item" aria-label="O'chirish" onClick={()=>removeFromCart(x.p.id)}>×</button></div></div></div>)}{cartItems.length?<div className="cart-total"><span>Jami</span><strong>{money(cartTotal)}</strong><button className="primary full" onClick={()=>setToast("Buyurtma berish uchun seller bilan bog'lanish moduli keyingi bosqichda ulanadi")}>Buyurtmani davom ettirish</button></div>:<div className="drawer-empty">Savatingiz hozircha bo'sh.</div>}</div>}
    </aside></div>}

    {quick&&<div className="product-detail-screen"><div className="product-detail-head"><button className="detail-back" onClick={()=>setQuick(null)} aria-label="Orqaga">←</button><span>Mahsulot</span><button className={"detail-fav "+(favs.includes(quick.id)?"liked":"")} onClick={()=>toggleFav(quick.id)} aria-label="Sevimliga qo'shish">{favs.includes(quick.id)?"♥":"♡"}</button></div><section className="product-detail"><div className="detail-gallery"><div className="detail-image">{quick.imageUrl?<img src={quick.imageUrl} alt={quick.name}/>:<span>MYBUSINESS</span>}</div><div className="detail-dots"><span className="active"/><span/><span/></div></div><div className="detail-info"><div className="detail-category">{label(cat(quick))}</div><h1>{quick.name}</h1><div className="detail-meta"><span className="detail-stock">{quick.stock>0?"Sotuvda":"Tugagan"}</span><span>Mahsulot ID: {quick.id}</span></div><div className="detail-price">{money(quick.price)}</div><p className="detail-description">{quick.description||"Mahsulot tavsifi kiritilmagan."}</p><div className="detail-block"><b>Mahsulot haqida</b><span>Kategoriya: {label(cat(quick))}</span><span>{quick.stock>0?"Omborda "+quick.stock+" dona mavjud":"Hozircha mavjud emas"}</span></div><div className="detail-actions"><div className="detail-qty"><button onClick={()=>qty(quick.id,-1)} disabled={!cart[quick.id]}>−</button><b>{cart[quick.id]||0}</b><button onClick={()=>qty(quick.id,1)} disabled={!quick.stock||cart[quick.id]>=quick.stock}>+</button></div><button className="detail-add" disabled={!quick.stock} onClick={()=>add(quick)}>{quick.stock?"Savatga qo'shish":"Tugagan"}</button></div></div></section></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);


