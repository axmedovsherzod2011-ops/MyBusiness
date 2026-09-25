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


function Icon({name,size=20}:{name:"home"|"grid"|"search"|"bag"|"cart"|"user"|"heart"|"menu"|"close"|"back";size?:number}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,ariaHidden:true};
  const paths={
    home:<><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></>,
    grid:<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    bag:<><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    cart:<><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6.2"/></>,
    user:<><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    heart:<path d="M20.8 8.7c0 5-8.8 10.3-8.8 10.3S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z"/>,
    menu:<><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    close:<><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    back:<path d="m15 5-7 7 7 7"/>
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

function productImages(p:Product){return (p.imageUrl||"").split(/[\n|,]+/).map(x=>x.trim()).filter(Boolean);}

function productTokens(value:string){
  return value.toLowerCase().replace(/[^a-z0-9а-яё'’]+/gi," ").split(/\s+/).filter(x=>x.length>2);
}
function similarityScore(p:Product,q:string){
  const queryTokens=productTokens(q);
  if(!queryTokens.length)return p.stock>0?1:0;
  const nameTokens=productTokens(p.name);
  const textTokens=productTokens(p.name+" "+p.description);
  let score=0;
  for(const token of queryTokens){
    if(nameTokens.some(x=>x===token))score+=8;
    else if(nameTokens.some(x=>x.includes(token)||token.includes(x)))score+=5;
    else if(textTokens.some(x=>x===token))score+=3;
    else if(textTokens.some(x=>x.includes(token)||token.includes(x)))score+=1;
  }
  if(p.stock>0)score+=.25;
  return score;
}

function SimilarProducts({items,onOpen,onCart,cart,onQty,favs,onLike,onAsk}:{items:Product[];onOpen:(p:Product)=>void;onCart:(p:Product)=>void;cart:Record<string,number>;onQty:(id:number,d:number)=>void;favs:number[];onLike:(id:number)=>void;onAsk:(p:Product)=>void}){
  if(!items.length)return null;
  return <section className="no-results-similar">
    <div className="no-results-title"><b>Mahsulot topilmadi</b><span>O'xshash mahsulotlar:</span></div>
    <Grid items={items} favs={favs} cart={cart} onLike={onLike} onCart={onCart} onQty={onQty} onAsk={onAsk} onOpen={onOpen}/>
  </section>;
}

function ProductCard({p,liked,qty,onLike,onCart,onQty,onAsk,onOpen}:{p:Product;liked:boolean;qty:number;onLike:(id:number)=>void;onCart:(p:Product)=>void;onQty:(id:number,d:number)=>void;onAsk:(p:Product)=>void;onOpen:(p:Product)=>void}){
  const fresh=isNew(p); const images=productImages(p);
  return <article className="product-card">
    <div className={"product-image "+(images.length>1?"has-gallery":"single-image")} onClick={()=>onOpen(p)}>
      <div className="product-image-track">{images.length?images.map((src,i)=><img key={src+i} src={src} alt={i===0?p.name:""} loading="lazy"/>):<div className="no-image">MYBUSINESS</div>}</div>
      <div className="badges">{fresh&&<span>YANGI</span>}{p.stock>0&&<span className="stock-badge">SOTUVDA</span>}</div>
      <button className={"heart "+(liked?"liked":"")} onClick={e=>{e.stopPropagation();onLike(p.id)}} aria-label="Sevimliga qo'shish">{liked?"♥":"♡"}</button>
      {p.stock<=0&&<span className="sold-out">Tugagan</span>}
    </div>
    <div className="product-info">
      <span className="product-cat">{label(cat(p))}</span>
      <button className="product-name" onClick={()=>onOpen(p)}>{p.name}</button>
      <p>{p.description||"Mahsulot tavsifi kiritilmagan."}</p>
      <strong className="product-price">{money(p.price)}</strong>
      <small className="product-stock-text">{p.stock>0?"Sotuvda":"Tugagan"}</small>
      <div className="product-actions">
        {qty>0?<div className="card-qty"><button onClick={()=>onQty(p.id,-1)} aria-label="Kamaytirish">−</button><b>{qty}</b><button onClick={()=>onQty(p.id,1)} disabled={!p.stock||qty>=p.stock} aria-label="Ko'paytirish">+</button></div>:<button className="add-button card-add" disabled={p.stock<=0} onClick={()=>onCart(p)}><Icon name="cart" size={18}/><span>{p.stock>0?"Savatga qo'shish":"Tugagan"}</span></button>}
      </div>
    </div>
  </article>;
}

function Grid({items,favs,cart,onLike,onCart,onQty,onAsk,onOpen}:{items:Product[];favs:number[];cart:Record<string,number>;onLike:(id:number)=>void;onCart:(p:Product)=>void;onQty:(id:number,d:number)=>void;onAsk:(p:Product)=>void;onOpen:(p:Product)=>void}){
  return <div className="product-grid">{items.map(p=><ProductCard key={p.id} p={p} liked={favs.includes(p.id)} qty={cart[p.id]||0} onLike={onLike} onCart={onCart} onQty={onQty} onAsk={onAsk} onOpen={onOpen}/>)}</div>;
}

function Mini({p,onOpen,onCart}:{p:Product;onOpen:()=>void;onCart:()=>void}){
  return <div className="mini-product"><button className="mini-image" onClick={onOpen}>{p.imageUrl?<img src={p.imageUrl} alt=""/>:"MB"}</button><div><button className="mini-name" onClick={onOpen}>{p.name}</button><b>{money(p.price)}</b><button className="mini-add" onClick={onCart} disabled={!p.stock}>Savatga</button></div></div>;
}

function HomeProductGrid({items,favs,cart,onLike,onCart,onQty,onAsk,onOpen,onPromo}:{items:Product[];favs:number[];cart:Record<string,number>;onLike:(id:number)=>void;onCart:(p:Product)=>void;onQty:(id:number,d:number)=>void;onAsk:(p:Product)=>void;onOpen:(p:Product)=>void;onPromo:(kind:"new"|"sale")=>void}){
  const chunks:any[]=[];
  items.forEach((p,i)=>{chunks.push(<ProductCard key={"p-"+p.id} p={p} liked={favs.includes(p.id)} qty={cart[p.id]||0} onLike={onLike} onCart={onCart} onQty={onQty} onAsk={onAsk} onOpen={onOpen}/>);
    if((i+1)%6===0&&i<items.length-1)chunks.push(<div className="inline-promo-rail" key={"promo-"+i}>{[["MAXSUS TAKLIF","Bugun tanlash uchun ko'proq sabab."],["YANGI TOVARLAR","Marketplace'dagi yangi mahsulotlarni ko'ring."],["AKSIYALAR","Omborda mavjud maxsus tanlovlar."]].map((x,j)=><button key={j} onClick={()=>{if(j===1)onPromo("new");else if(j===2)onPromo("sale")}}><span>{x[0]}</span><b>{x[1]}</b><em>Ko'rish →</em></button>)}</div>);
  }); return <div className="product-grid home-product-grid">{chunks}</div>;
}

export default function App(){
  const [products,setProducts]=useState<Product[]>([]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [sub,setSub]=useState("");
  const [sort,setSort]=useState("newest");
  const [availability,setAvailability]=useState<"all"|"stock">("all");
  const [minPrice,setMinPrice]=useState("");
  const [maxPrice,setMaxPrice]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [favs,setFavs]=useState<number[]>(()=>JSON.parse(localStorage.getItem("mybusiness:favorites")||"[]"));
  const [cart,setCart]=useState<Record<string,number>>(()=>JSON.parse(localStorage.getItem("mybusiness:cart")||"{}"));
  const [panel,setPanel]=useState<"cart"|"favorites"|"menu"|"profile"|"filters"|"search"|null>(null);
  const [quick,setQuick]=useState<Product|null>(null);
  const [toast,setToast]=useState("");
  const [authUser,setAuthUser]=useState<{name:string}|null>(()=>{try{return JSON.parse(localStorage.getItem("mybusiness:customer-auth")||"null")}catch{return null}});
  const [authOpen,setAuthOpen]=useState(false);
  const [chatProduct,setChatProduct]=useState<Product|null>(null);
  const [searchFocused,setSearchFocused]=useState(false);
  const [recentSearches,setRecentSearches]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem("mybusiness:recent-searches")||"[]")}catch{return []}});

  useEffect(()=>{
    fetch(apiBase+"/api/v1/products",{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as ProductsResponse & {message?:string};if(!r.ok)throw new Error(d.message||"API xatosi");setProducts(d.products||[])})
      .catch(e=>setError(e instanceof Error?e.message:"API bilan ulanishda xatolik"))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>localStorage.setItem("mybusiness:favorites",JSON.stringify(favs)),[favs]);
  useEffect(()=>localStorage.setItem("mybusiness:cart",JSON.stringify(cart)),[cart]);
  useEffect(()=>localStorage.setItem("mybusiness:recent-searches",JSON.stringify(recentSearches)),[recentSearches]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2200);return()=>clearTimeout(t)},[toast]);

  const visible=useMemo(()=>{
    const q=query.toLowerCase().trim();
    const filtered=products.filter(p=>{
      const text=(p.name+" "+p.description).toLowerCase();
      const subMatch=!sub||text.includes(sub.toLowerCase());
      const categoryMatch=category==="all"||(category==="new"?isNew(p):category==="sale"?p.stock>0:cat(p)===category);
      const min=minPrice?Number(minPrice):0;
      const max=maxPrice?Number(maxPrice):Infinity;
      const priceMatch=p.price>=min&&p.price<=max;
      return (!q||text.includes(q))&&subMatch&&categoryMatch&&(availability==="all"||p.stock>0)&&priceMatch;
    });
    return [...filtered].sort((a,b)=>sort==="price-low"?a.price-b.price:sort==="price-high"?b.price-a.price:sort==="name"?a.name.localeCompare(b.name):Date.parse(b.createdAt)-Date.parse(a.createdAt));
  },[products,query,category,sub,sort,availability,minPrice,maxPrice]);

  const similarProducts=useMemo(()=>{
    const q=query.trim();
    return [...products]
      .filter(p=>p.stock>0)
      .sort((a,b)=>{
        const score=similarityScore(b,q)-similarityScore(a,q);
        return score||Date.parse(b.createdAt)-Date.parse(a.createdAt);
      })
      .slice(0,4);
  },[products,query]);

  const cartItems=Object.entries(cart).map(([id,q])=>({p:products.find(x=>x.id===Number(id)),q})).filter(x=>x.p) as {p:Product;q:number}[];
  const cartCount=cartItems.reduce((s,x)=>s+x.q,0);
  const cartTotal=cartItems.reduce((s,x)=>s+x.p.price*x.q,0);
  const newProducts=[...products].filter(isNew).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,8);
  const popular=[...products].filter(p=>p.stock>0).sort((a,b)=>b.stock-a.stock).slice(0,8);
  const categoryCounts=products.reduce<Record<string,number>>((acc,p)=>{const k=cat(p);acc[k]=(acc[k]||0)+1;return acc},{}); 

  function catalog(){document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});}
  function chooseCategory(k:string){setCategory(k);setSub("");setPanel(null);setTimeout(catalog,30);}
  function chooseSub(s:string){setSub(s);setPanel(null);setTimeout(catalog,30);}
  function add(p:Product){if(!p.stock)return;setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}));setToast("Mahsulot savatga qo'shildi");}
  function qty(id:number,d:number){setCart(c=>{const n=(c[id]||0)+d;if(n<=0){const z={...c};delete z[id];return z}const p=products.find(x=>x.id===id);return {...c,[id]:Math.min(n,p?.stock||n)}})}
  function clearFilters(){setQuery("");setCategory("all");setSub("");setSort("newest");setAvailability("all");setMinPrice("");setMaxPrice("");}
  function removeFromCart(id:number){setCart(c=>{const z={...c};delete z[id];return z})}
  function saveSearch(value:string){
    const q=value.trim();
    if(!q)return;
    setRecentSearches(prev=>{const next=[q,...prev.filter(x=>x.toLowerCase()!==q.toLowerCase())].slice(0,5);localStorage.setItem("mybusiness:recent-searches",JSON.stringify(next));return next});
  }
  function openSearch(nextQuery=query){const q=nextQuery.trim();setQuery(q);setSearchFocused(false);if(q)saveSearch(q);setPanel("search");}
  function toggleFav(id:number){setFavs(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);}
  function askSeller(p:Product){if(!authUser){setAuthOpen(true);return}setPanel(null);setChatProduct(p);}
  function finishAuth(name:string){const user={name:name.trim()||"Xaridor"};localStorage.setItem("mybusiness:customer-auth",JSON.stringify(user));setAuthUser(user);setAuthOpen(false);setToast("Kirish muvaffaqiyatli");}
  function signOut(){localStorage.removeItem("mybusiness:customer-auth");setAuthUser(null);setToast("Profil chiqildi");}

  return <main className="market">
    <header className="app-header">
      <a className="logo" href="/" aria-label="MyBusiness Market">MYBUSINESS<span>MARKET</span></a>
      <div className={"header-search-wrap "+(searchFocused?"is-focused":"")}><form className="header-search-trigger" role="search" onSubmit={e=>{e.preventDefault();openSearch(query)}}><span className="search-leading" aria-hidden="true"><Icon name="search" size={21}/></span><input value={query} onFocus={()=>setSearchFocused(true)} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Escape"){setQuery("");setSearchFocused(false)}}} placeholder="Mahsulot, brend yoki kategoriya..." aria-label="Mahsulot, brend yoki kategoriya qidiring" enterKeyHint="search"/>{query&&<button className="search-clear" type="button" onClick={()=>setQuery("")} aria-label="Qidiruvni tozalash"><Icon name="close" size={16}/></button>}<button className="search-submit" type="submit" aria-label="Qidirish"><Icon name="search" size={18}/></button></form>{searchFocused&&<div className="home-search-popover">{query.trim()?products.filter(p=>(p.name+" "+p.description).toLowerCase().includes(query.toLowerCase().trim())).slice(0,5).map(p=><button key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>openSearch(p.name)}><span className="suggestion-icon"><Icon name="search" size={16}/></span><span><b>{p.name}</b><small>{label(cat(p))} · {money(p.price)}</small></span><Icon name="back" size={16}/></button>):<><div className="search-popover-title">Tez qidirish</div>{recentSearches.length?recentSearches.map(q=><button key={q} onMouseDown={e=>e.preventDefault()} onClick={()=>openSearch(q)}><span className="suggestion-icon"><Icon name="search" size={15}/></span><span><b>{q}</b><small>So‘nggi qidiruv</small></span><Icon name="back" size={16}/></button>):<div className="search-popover-empty">Mahsulot, brend yoki kategoriya nomini yozing</div>}</>}</div>}</div>
    </header>

    <section className="app-hero">
      <div className="app-hero-copy"><span className="eyebrow">MYBUSINESS MARKET</span><h1>Kerakli mahsulotlar<br/><em>bir joyda.</em></h1><p>Yangi mahsulotlar, kundalik xaridlar va maxsus takliflar.</p><button className="primary" onClick={()=>document.getElementById("all-products")?.scrollIntoView({behavior:"smooth"})}>Barcha mahsulotlarni ko'rish</button></div>
      <div className="app-hero-art"><span>NEW</span><b>Tanlangan<br/>mahsulotlar</b><strong>MB</strong></div>
    </section>

    <section id="all-products" className="product-section app-products">
      <div className="catalog-filter-bar"><button className="filter-main-button" onClick={()=>setPanel("filters")}><span>Filtrlar</span><Icon name="grid" size={17}/></button><button className="sort-button" onClick={()=>setPanel("filters")}><span>{sort==="price-low"?"Arzon → qimmat":sort==="price-high"?"Qimmat → arzon":sort==="name"?"Nomi bo‘yicha":"Yangi mahsulotlar"}</span><span>⌄</span></button>{(category!=="all"||sub||availability==="stock"||minPrice||maxPrice||query)&&<button className="filter-reset-chip" onClick={clearFilters}>Tozalash</button>}</div>
      {error?<div className="state error"><b>Marketplace bilan ulanishda xatolik.</b><span>{error}</span><button onClick={()=>location.reload()}>Qayta urinish</button></div>:loading?<div className="state">Mahsulotlar yuklanmoqda...</div>:visible.length?<HomeProductGrid items={visible} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick} onPromo={k=>chooseCategory(k)}/>:<div className="state"><b>Mahsulot topilmadi.</b><button onClick={clearFilters}>Filtrlarni tozalash</button></div>}
    </section>

    <nav className="mobile-nav" aria-label="Asosiy navigatsiya">
  <button className={panel===null?"active":""} onClick={()=>{setPanel(null);scrollTo(0,0)}}><span><Icon name="home"/></span>{panel===null&&<b className="nav-label">Asosiy</b>}</button>
  <button className={panel==="menu"?"active":""} onClick={()=>setPanel("menu")}><span><Icon name="grid"/></span>{panel==="menu"&&<b className="nav-label">Mahsulotlar</b>}</button>
  <button className={panel==="search"?"active":""} onClick={()=>openSearch()}><span><Icon name="search"/></span>{panel==="search"&&<b className="nav-label">Qidirish</b>}</button>
  <button className={panel==="cart"?"active":""} onClick={()=>setPanel("cart")}><span><Icon name="bag"/></span>{panel==="cart"&&<b className="nav-label">Savat</b>}{cartCount>0&&<i className="nav-badge">{cartCount}</i>}</button>
  <button className={panel==="profile"?"active":""} onClick={()=>setPanel("profile")}><span><Icon name="user"/></span>{panel==="profile"&&<b className="nav-label">Profil</b>}</button>
</nav>

    {panel&&<div className="drawer-backdrop" onClick={()=>setPanel(null)}><aside className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head"><h2>{panel==="cart"?"Savat":panel==="favorites"?"Sevimlilar":panel==="profile"?"Profil":panel==="filters"?"Filtrlar":panel==="search"?"Qidirish":"Katalog"}</h2></div>
      {panel==="profile"&&<div className="profile-panel"><div className="profile-icon">♙</div><h3>{authUser?authUser.name:"MyBusiness xaridori"}</h3><p>{authUser?"Siz tizimga kirgansiz. Sotuvchiga yozish va chatlarni ochish mumkin.":"Sotuvchiga yozish uchun avval kirish yoki ro'yxatdan o'tish kerak."}</p>{authUser?<button className="secondary full" onClick={signOut}>Chiqish</button>:<button className="primary full" onClick={()=>setAuthOpen(true)}>Kirish / ro'yxatdan o'tish</button>}</div>}
      {panel==="menu"&&<div className="menu-products-screen"><div className="menu-promo"><span>MYBUSINESS MARKET</span><b>Bugungi mahsulotlarni bir joyda toping</b><button onClick={()=>{setCategory("all");setPanel("menu")}}>Barchasini ko'rish →</button></div><div className="menu-products-title"><h3>Barcha mahsulotlar</h3><span>{visible.length} ta mahsulot</span></div>{visible.length?<Grid items={visible} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick}/>:<div className="state">Mahsulot topilmadi.</div>}</div>}
      {panel==="search"&&<div className="screen-search"><form className="screen-search-box" role="search" onSubmit={e=>{e.preventDefault();openSearch(query)}}><Icon name="search" size={20}/><input className="screen-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki kategoriya qidiring..." enterKeyHint="search"/>{query&&<button className="screen-search-clear" type="button" onClick={()=>setQuery("")} aria-label="Qidiruvni tozalash"><Icon name="close" size={16}/></button>}<button className="screen-search-submit" type="submit" aria-label="Qidirish"><Icon name="search" size={18}/></button></form><div className="screen-search-meta">{query?`${visible.length} ta mahsulot topildi`:`Barcha mahsulotlar · ${visible.length} ta`}</div><div className="screen-search-results">{visible.length?<Grid items={visible} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick}/>:<SimilarProducts items={similarProducts} onOpen={setQuick} onCart={add} cart={cart} onQty={qty} favs={favs} onLike={toggleFav} onAsk={askSeller}/>}</div></div>}
      {panel==="filters"&&<div className="filter-sheet">
        <div className="filter-sheet-head"><div><span>Tanlash</span><h2>Filtrlar</h2></div><button onClick={()=>setPanel(null)} aria-label="Filtrlarni yopish"><Icon name="close" size={21}/></button></div>
        <div className="filter-section"><div className="filter-section-title"><b>Kategoriya</b><span>{label(category)}</span></div><div className="filter-chips">{categories.map(c=><button key={c[0]} className={category===c[0]?"selected":""} onClick={()=>{setCategory(c[0]);setSub("")}}>{c[2]} {c[1]}</button>)}</div></div>
        {category!=="all"&&category!=="new"&&category!=="sale"&&subcategories[category]&&<div className="filter-section"><div className="filter-section-title"><b>Turkum</b><span>{sub||"Barchasi"}</span></div><div className="filter-chips">{subcategories[category].map(x=><button key={x} className={sub===x?"selected":""} onClick={()=>setSub(sub===x?"":x)}>{x}</button>)}</div></div>}
        <div className="filter-section"><div className="filter-section-title"><b>Narx</b><span>so'm</span></div><div className="price-inputs"><input inputMode="numeric" value={minPrice} onChange={e=>setMinPrice(e.target.value.replace(/\\D/g,""))} placeholder="dan"/><span>—</span><input inputMode="numeric" value={maxPrice} onChange={e=>setMaxPrice(e.target.value.replace(/\\D/g,""))} placeholder="gacha"/></div></div>
        <div className="filter-section"><div className="filter-section-title"><b>Mavjudligi</b></div><button className={"filter-row "+(availability==="stock"?"selected":"")} onClick={()=>setAvailability(availability==="stock"?"all":"stock")}><span><i>{availability==="stock"?"✓":"○"}</i> Faqat sotuvdagi mahsulotlar</span><b>›</b></button></div>
        <div className="filter-section"><div className="filter-section-title"><b>Saralash</b></div><div className="filter-sort-list">{[["newest","Yangi mahsulotlar"],["price-low","Arzon → qimmat"],["price-high","Qimmat → arzon"],["name","Nomi bo‘yicha"]].map(([k,v])=><button key={k} className={sort===k?"selected":""} onClick={()=>setSort(k as typeof sort)}><span>{v}</span><i>{sort===k?"✓":"○"}</i></button>)}</div></div>
        <div className="filter-bottom"><button className="filter-clear" onClick={clearFilters}>Tozalash</button><button className="filter-apply" onClick={()=>setPanel(null)}>Ko‘rsatish · {visible.length}</button></div>
      </div>}
      {panel==="favorites"&&<div className="drawer-list">{products.filter(p=>favs.includes(p.id)).map(p=><Mini key={p.id} p={p} onOpen={()=>setQuick(p)} onCart={()=>add(p)}/>) }{!favs.length&&<div className="drawer-empty">Hali sevimli mahsulotlar yo'q.</div>}</div>}
      {panel==="cart"&&<div className="drawer-cart">{cartItems.map(x=><div className="cart-item" key={x.p.id}><div className="mini-image">{x.p.imageUrl?<img src={x.p.imageUrl} alt=""/>:"MB"}</div><div><b>{x.p.name}</b><span>{money(x.p.price)} × {x.q}</span><div className="qty"><button aria-label="Kamaytirish" onClick={()=>qty(x.p.id,-1)}>−</button><b>{x.q}</b><button aria-label="Ko'paytirish" onClick={()=>qty(x.p.id,1)}>+</button><button className="remove-item" aria-label="O'chirish" onClick={()=>removeFromCart(x.p.id)}>×</button></div></div></div>)}{cartItems.length?<div className="cart-total"><span>Jami</span><strong>{money(cartTotal)}</strong><button className="primary full" onClick={()=>setToast("Buyurtma berish uchun seller bilan bog'lanish moduli keyingi bosqichda ulanadi")}>Buyurtmani davom ettirish</button></div>:<div className="drawer-empty">Savatingiz hozircha bo'sh.</div>}</div>}
    </aside></div>}

    {quick&&<div className="product-detail-screen"><div className="product-detail-head"><button className="detail-back" onClick={()=>setQuick(null)} aria-label="Orqaga"><Icon name="back" size={22}/></button><span>Mahsulot</span><button className={"detail-fav "+(favs.includes(quick!.id)?"liked":"")} onClick={()=>toggleFav(quick!.id)} aria-label="Sevimliga qo'shish">{favs.includes(quick!.id)?"♥":"♡"}</button></div><section className="product-detail"><div className="detail-gallery"><div className={"detail-image-track "+(productImages(quick).length>1?"has-gallery":"single-image")}>{productImages(quick).length?productImages(quick).map((src,i)=><img key={src+i} src={src} alt={i===0?quick!.name:""} />):<span>MYBUSINESS</span>}</div></div><div className="detail-info"><div className="detail-category">{label(cat(quick))}</div><h1>{quick!.name}</h1><div className="detail-meta"><span className="detail-stock">{quick!.stock>0?"Sotuvda":"Tugagan"}</span><span>Mahsulot ID: {quick!.id}</span></div><div className="detail-price">{money(quick!.price)}</div><p className="detail-description">{quick!.description||"Mahsulot tavsifi kiritilmagan."}</p><div className="detail-block"><b>Mahsulot haqida</b><span>Kategoriya: {label(cat(quick))}</span><span>{quick!.stock>0?"Omborda "+quick!.stock+" dona mavjud":"Hozircha mavjud emas"}</span></div><div className="detail-actions"><div className="detail-purchase-row"><button className="detail-ask" onClick={()=>askSeller(quick)}>Sotuvchidan so'rash</button>{cart[quick!.id]?<div className="detail-qty"><button onClick={()=>qty(quick!.id,-1)} aria-label="Kamaytirish">−</button><b>{cart[quick!.id]}</b><button onClick={()=>qty(quick!.id,1)} disabled={!(quick!.stock>0)||((cart[quick!.id]||0)>=quick!.stock)} aria-label="Ko'paytirish">+</button></div>:<button className="detail-add" disabled={!quick!.stock} onClick={()=>add(quick)}><Icon name="cart" size={19}/><span>{quick!.stock?"Savatga qo'shish":"Tugagan"}</span></button>}</div></div></div></section></div>}
    {authOpen&&<div className="auth-overlay" onClick={()=>setAuthOpen(false)}><section className="auth-modal" onClick={e=>e.stopPropagation()}><button className="auth-close" onClick={()=>setAuthOpen(false)} aria-label="Yopish"><Icon name="close" size={20}/></button><span className="eyebrow">MYBUSINESS MARKET</span><h2>Kirish yoki ro'yxatdan o'tish</h2><p>Sotuvchiga yozish uchun hisob kerak.</p><form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);finishAuth(String(data.get("name")||""))}}><input name="name" required placeholder="Ismingiz" autoComplete="name"/><input name="contact" required placeholder="Telefon yoki email" autoComplete="email"/><button className="primary full" type="submit">Davom etish</button></form><small>Hozircha autentifikatsiya demo rejimida ishlaydi; seller chat backendi keyingi bosqichda ulanadi.</small></section></div>}
    {chatProduct&&<div className="chat-overlay"><section className="chat-screen"><header className="chat-head"><button onClick={()=>setChatProduct(null)} aria-label="Orqaga"><Icon name="back" size={22}/></button><div><b>{chatProduct.name}</b><span>Sotuvchi bilan chat</span></div><span className="chat-online">●</span></header><div className="chat-messages"><div className="chat-empty-product"><div>{productImages(chatProduct)[0]?<img src={productImages(chatProduct)[0]} alt=""/>:<span>MB</span>}</div><b>{chatProduct.name}</b><span>{money(chatProduct.price)}</span></div><div className="chat-bubble system">Siz sotuvchiga mahsulot haqida savol berishingiz mumkin.</div><div className="chat-bubble muted">Yozishmalar seller ilovasi bilan ulanishdan keyin yuboriladi.</div></div><div className="chat-composer"><input disabled placeholder="Xabar yozish hozircha o'chirilgan"/><button disabled aria-label="Yuborish">➤</button></div></section></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);


