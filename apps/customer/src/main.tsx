import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [authUser,setAuthUser]=useState<{name:string;phone?:string;token?:string}|null>(()=>{try{return JSON.parse(localStorage.getItem("mybusiness:customer-auth")||"null")}catch{return null}});
  const [authOpen,setAuthOpen]=useState(false);
  const [authSession,setAuthSession]=useState("");
  const [authStatus,setAuthStatus]=useState<"idle"|"waiting"|"verified"|"expired"|"error">("idle");
  const [authFirstName,setAuthFirstName]=useState("");
  const [authLastName,setAuthLastName]=useState("");
  const [authError,setAuthError]=useState("");
  const [chatProduct,setChatProduct]=useState<Product|null>(null);
  const [chatId,setChatId]=useState<number|null>(null);
  const [chatMessages,setChatMessages]=useState<Array<{id:number;senderRole:"customer"|"seller";body:string;createdAt:string}>>([]);
  const [chatInput,setChatInput]=useState("");
  const [chatLoading,setChatLoading]=useState(false);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const [checkoutName,setCheckoutName]=useState("");
  const [checkoutPhone,setCheckoutPhone]=useState("");
  const [checkoutLoading,setCheckoutLoading]=useState(false);
  const [checkoutError,setCheckoutError]=useState("");

  useEffect(()=>{
    fetch(apiBase+"/api/v1/products",{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as ProductsResponse & {message?:string};if(!r.ok)throw new Error(d.message||"API xatosi");setProducts(d.products||[])})
      .catch(e=>setError(e instanceof Error?e.message:"API bilan ulanishda xatolik"))
      .finally(()=>setLoading(false));
  },[]);
  useEffect(()=>localStorage.setItem("mybusiness:favorites",JSON.stringify(favs)),[favs]);
  useEffect(()=>localStorage.setItem("mybusiness:cart",JSON.stringify(cart)),[cart]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2200);return()=>clearTimeout(t)},[toast]);
  useEffect(()=>{if(!authSession||authStatus!=="waiting")return;
    let stopped=false;
    const check=async()=>{
      try{
        const r=await fetch(apiBase+"/api/v1/auth/telegram/session/"+encodeURIComponent(authSession),{headers:{Accept:"application/json"}});
        const d=await r.json() as {status?:string;phone?:string;existingUser?:boolean;message?:string};
        if(stopped)return;
        if(d.status==="verified"){
          if(d.existingUser){
            try{
              const complete=await fetch(apiBase+"/api/v1/auth/telegram/complete",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({sessionId:authSession})});
              const result=await complete.json() as {token?:string;user?:{first_name:string;last_name:string;phone:string};message?:string};
              if(!complete.ok||!result.token||!result.user)throw new Error(result.message||"Kirishda xatolik.");
              const user={name:[result.user.first_name,result.user.last_name].filter(Boolean).join(" "),phone:result.user.phone,token:result.token};
              localStorage.setItem("mybusiness:customer-auth",JSON.stringify(user));
              setAuthUser(user); setAuthOpen(false); setAuthSession(""); setAuthStatus("idle");
              setToast("Kirish muvaffaqiyatli");
            }catch(e){if(!stopped){setAuthStatus("error");setAuthError(e instanceof Error?e.message:"Kirishda xatolik.");}}
          }else{
            setAuthStatus("verified");
          }
          return;
        }
        if(d.status==="expired")setAuthStatus("expired");
      }catch{if(!stopped)setAuthStatus("error")}
    };
    void check();
    const timer=window.setInterval(check,1500);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[authSession,authStatus]);

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
  function openSearch(nextQuery=query){setQuery(nextQuery.trim());setPanel("search");}
  function toggleFav(id:number){setFavs(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);}
  function askSeller(p:Product){if(!authUser){setAuthOpen(true);return}setPanel(null);setChatId(null);setChatMessages([]);setChatInput("");setChatProduct(p);}
  async function sendChatMessage(){
    const body=chatInput.trim();
    if(!chatProduct||!authUser||!body||chatLoading)return;
    setChatLoading(true);
    try{
      if(chatId){
        const r=await fetch(apiBase+"/api/v1/chats/"+chatId+"/messages",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({message:body})});
        const d=await r.json() as {message?:{id:number;senderRole:"customer"|"seller";body:string;createdAt:string}|string};
        if(!r.ok||!d.message||typeof d.message==="string")throw new Error(typeof d.message==="string"?d.message:"Xabar yuborilmadi.");
        setChatMessages(x=>[...x,d.message!]);
      }else{
        const r=await fetch(apiBase+"/api/v1/chats",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({customerName:authUser.name||"Mijoz",customerUserId:null,productId:chatProduct.id,message:body})});
        const d=await r.json() as {chatId?:number;message?:{id:number;senderRole:"customer"|"seller";body:string;createdAt:string};message?:string};
        if(!r.ok||!d.chatId||!d.message)throw new Error((d as any).message||"Chat ochilmadi.");
        setChatId(d.chatId);setChatMessages([d.message]);
      }
      setChatInput("");
    }catch(e){setToast(e instanceof Error?e.message:"Xabar yuborilmadi.")}finally{setChatLoading(false)}
  }
  function openCheckout(){
    if(!authUser){setAuthOpen(true);return}
    if(!cartItems.length)return;
    setCheckoutName(authUser.name||"");setCheckoutPhone(authUser.phone||"");setCheckoutError("");setCheckoutOpen(true);setPanel(null);
  }
  async function submitCheckout(e:FormEvent){
    e.preventDefault();
    if(!checkoutName.trim()||!checkoutPhone.trim()||!cartItems.length)return;
    setCheckoutLoading(true);setCheckoutError("");
    try{
      const r=await fetch(apiBase+"/api/v1/orders",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({customerName:checkoutName.trim(),customerPhone:checkoutPhone.trim(),customerUserId:null,items:cartItems.map(x=>({productId:x.p.id,quantity:x.q}))})});
      const d=await r.json() as {order?:{id:number};message?:string};
      if(!r.ok||!d.order)throw new Error(d.message||"Buyurtma yaratilmadi.");
      setCart({});setCheckoutOpen(false);setToast("Buyurtma #"+d.order.id+" qabul qilindi.");
      const fresh=await fetch(apiBase+"/api/v1/products",{headers:{Accept:"application/json"}});const fd=await fresh.json() as ProductsResponse;setProducts(fd.products||[]);
    }catch(e){setCheckoutError(e instanceof Error?e.message:"Buyurtma yuborilmadi.")}finally{setCheckoutLoading(false)}
  }
  async function startTelegramAuth(){
    setAuthError("");
    setAuthStatus("idle");
    try{
      const r=await fetch(apiBase+"/api/v1/auth/telegram/session",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"}});
      const d=await r.json() as {sessionId?:string;telegramUrl?:string;message?:string};
      if(!r.ok||!d.sessionId||!d.telegramUrl)throw new Error(d.message||"Telegram ulanishini boshlashda xatolik.");
      setAuthSession(d.sessionId);
      setAuthStatus("waiting");
      window.location.href=d.telegramUrl;
    }catch(e){setAuthStatus("error");setAuthError(e instanceof Error?e.message:"Telegram ulanishida xatolik.");}
  }
  async function completeTelegramAuth(){
    const firstName=authFirstName.trim();
    const lastName=authLastName.trim();
    if(!firstName){setAuthError("Ismingizni kiriting.");return}
    setAuthError("");
    try{
      const r=await fetch(apiBase+"/api/v1/auth/telegram/complete",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({sessionId:authSession,firstName,lastName})});
      const d=await r.json() as {token?:string;user?:{first_name:string;last_name:string;phone:string};message?:string};
      if(!r.ok||!d.token||!d.user)throw new Error(d.message||"Hisobni yaratib bo'lmadi.");
      const user={name:[d.user.first_name,d.user.last_name].filter(Boolean).join(" "),phone:d.user.phone,token:d.token};
      localStorage.setItem("mybusiness:customer-auth",JSON.stringify(user));
      setAuthUser(user);
      setAuthOpen(false);
      setAuthSession("");
      setAuthStatus("idle");
      setAuthFirstName("");
      setAuthLastName("");
      setToast("Kirish muvaffaqiyatli");
    }catch(e){setAuthError(e instanceof Error?e.message:"Hisobni yaratib bo'lmadi.");}
  }
  function signOut(){localStorage.removeItem("mybusiness:customer-auth");setAuthUser(null);setAuthSession("");setAuthStatus("idle");setAuthFirstName("");setAuthLastName("");}

  return <main className="market">
    {panel===null&&<header className="app-header">
      <a className="logo" href="/" aria-label="MyBusiness Market">MYBUSINESS<span>MARKET</span></a>
      <form className="header-search-trigger" role="search" onSubmit={e=>{e.preventDefault();openSearch(query)}}>
        <span className="search-leading" aria-hidden="true"><Icon name="search" size={21}/></span>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setQuery("")}} placeholder="Mahsulot, brend yoki kategoriya..." aria-label="Mahsulot, brend yoki kategoriya qidiring" enterKeyHint="search"/>
        {query&&<button className="search-clear" type="button" onClick={()=>setQuery("")} aria-label="Qidiruvni tozalash"><Icon name="close" size={16}/></button>}
        <button className="search-submit" type="submit" aria-label="Qidirish"><Icon name="search" size={18}/></button>
      </form>
    </header>}

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
      {panel==="cart"&&<div className="drawer-cart">{cartItems.map(x=><div className="cart-item" key={x.p.id}><div className="mini-image">{x.p.imageUrl?<img src={x.p.imageUrl} alt=""/>:"MB"}</div><div><b>{x.p.name}</b><span>{money(x.p.price)} × {x.q}</span><div className="qty"><button aria-label="Kamaytirish" onClick={()=>qty(x.p.id,-1)}>−</button><b>{x.q}</b><button aria-label="Ko'paytirish" onClick={()=>qty(x.p.id,1)}>+</button><button className="remove-item" aria-label="O'chirish" onClick={()=>removeFromCart(x.p.id)}>×</button></div></div></div>)}{cartItems.length?<div className="cart-total"><span>Jami</span><strong>{money(cartTotal)}</strong><button className="primary full" onClick={openCheckout}>Buyurtma berish</button></div>:<div className="drawer-empty">Savatingiz hozircha bo'sh.</div>}</div>}
    </aside></div>}

    {quick&&<div className="product-detail-screen"><div className="product-detail-head"><button className="detail-back" onClick={()=>setQuick(null)} aria-label="Orqaga"><Icon name="back" size={22}/></button><span>Mahsulot</span><button className={"detail-fav "+(favs.includes(quick!.id)?"liked":"")} onClick={()=>toggleFav(quick!.id)} aria-label="Sevimliga qo'shish">{favs.includes(quick!.id)?"♥":"♡"}</button></div><section className="product-detail"><div className="detail-gallery"><div className={"detail-image-track "+(productImages(quick).length>1?"has-gallery":"single-image")}>{productImages(quick).length?productImages(quick).map((src,i)=><img key={src+i} src={src} alt={i===0?quick!.name:""} />):<span>MYBUSINESS</span>}</div></div><div className="detail-info"><div className="detail-category">{label(cat(quick))}</div><h1>{quick!.name}</h1><div className="detail-meta"><span className="detail-stock">{quick!.stock>0?"Sotuvda":"Tugagan"}</span><span>Mahsulot ID: {quick!.id}</span></div><div className="detail-price">{money(quick!.price)}</div><p className="detail-description">{quick!.description||"Mahsulot tavsifi kiritilmagan."}</p><div className="detail-block"><b>Mahsulot haqida</b><span>Kategoriya: {label(cat(quick))}</span><span>{quick!.stock>0?"Omborda "+quick!.stock+" dona mavjud":"Hozircha mavjud emas"}</span></div><div className="detail-actions"><div className="detail-purchase-row"><button className="detail-ask" onClick={()=>askSeller(quick)}>Sotuvchidan so'rash</button>{cart[quick!.id]?<div className="detail-qty"><button onClick={()=>qty(quick!.id,-1)} aria-label="Kamaytirish">−</button><b>{cart[quick!.id]}</b><button onClick={()=>qty(quick!.id,1)} disabled={!(quick!.stock>0)||((cart[quick!.id]||0)>=quick!.stock)} aria-label="Ko'paytirish">+</button></div>:<button className="detail-add" disabled={!quick!.stock} onClick={()=>add(quick)}><Icon name="cart" size={19}/><span>{quick!.stock?"Savatga qo'shish":"Tugagan"}</span></button>}</div></div></div></section></div>}
    {authOpen&&<div className="auth-overlay" onClick={()=>setAuthOpen(false)}><section className="auth-modal telegram-auth-modal" onClick={e=>e.stopPropagation()}><button className="auth-close" onClick={()=>setAuthOpen(false)} aria-label="Yopish"><Icon name="close" size={20}/></button><span className="eyebrow">MYBUSINESS MARKET</span>{authStatus==="verified"?<><h2>Telefon tasdiqlandi</h2><p>Endi ismingizni kiriting. Shu ma'lumot bilan MyBusiness akkauntingiz yaratiladi yoki mavjud akkauntingizga kirasiz.</p><div className="auth-name-fields"><input value={authFirstName} onChange={e=>setAuthFirstName(e.target.value)} placeholder="Ism" autoComplete="given-name"/><input value={authLastName} onChange={e=>setAuthLastName(e.target.value)} placeholder="Familiya" autoComplete="family-name"/></div><button className="primary full" onClick={completeTelegramAuth}>Kirish / ro'yxatdan o'tish</button></>:authStatus==="expired"?<><h2>Sessiya tugadi</h2><p>Telegram ulanish sessiyasi 10 daqiqadan keyin tugaydi.</p><button className="primary full" onClick={startTelegramAuth}>Telegram orqali qayta ulash</button></>:<><h2>Kirish yoki ro'yxatdan o'tish</h2><p>Telefon raqamingizni xavfsiz tasdiqlash uchun Telegram orqali ulaning.</p><button className="telegram-auth-button" onClick={startTelegramAuth}>Telegram orqali ulash</button><div className="auth-flow-note">{authStatus==="waiting"?"Telegram ochiladi. Botda Start → Raqamni yuborish tugmalarini bosing, so'ng MyBusiness'ga qayting.":"Telegram bot orqali raqamingizni tasdiqlash uchun davom eting."}</div></>}{authError&&<div className="auth-error">{authError}</div>}</section></div>}
    {chatProduct&&<div className="chat-overlay"><section className="chat-screen"><header className="chat-head"><button onClick={()=>setChatProduct(null)} aria-label="Orqaga"><Icon name="back" size={22}/></button><div><b>{chatProduct.name}</b><span>Sotuvchi bilan real chat</span></div><span className="chat-online">●</span></header><div className="chat-messages"><div className="chat-empty-product"><div>{productImages(chatProduct)[0]?<img src={productImages(chatProduct)[0]} alt=""/>:<span>MB</span>}</div><b>{chatProduct.name}</b><span>{money(chatProduct.price)}</span></div>{!chatMessages.length&&<div className="chat-bubble system">Mahsulot haqida savolingizni yozing — sotuvchi shu paneldan javob beradi.</div>}{chatMessages.map(m=><div key={m.id} className={"chat-bubble "+(m.senderRole==="customer"?"customer":"seller")}><span>{m.body}</span><small>{new Intl.DateTimeFormat("uz-UZ",{hour:"2-digit",minute:"2-digit"}).format(new Date(m.createdAt))}</small></div>)}</div><form className="chat-composer" onSubmit={e=>{e.preventDefault();void sendChatMessage()}}><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Xabar yozing..." disabled={chatLoading}/><button className="primary" disabled={!chatInput.trim()||chatLoading} aria-label="Yuborish">➤</button></form></section></div>}
    {checkoutOpen&&<div className="auth-overlay" onClick={()=>setCheckoutOpen(false)}><section className="auth-modal checkout-modal" onClick={e=>e.stopPropagation()}><button className="auth-close" onClick={()=>setCheckoutOpen(false)} aria-label="Yopish"><Icon name="close" size={20}/></button><span className="eyebrow">MYBUSINESS MARKET</span><h2>Buyurtmani rasmiylashtirish</h2><p>{cartItems.length} ta mahsulot · {money(cartTotal)}</p><form onSubmit={submitCheckout}><div className="auth-name-fields"><input required value={checkoutName} onChange={e=>setCheckoutName(e.target.value)} placeholder="Ism" autoComplete="name"/><input required value={checkoutPhone} onChange={e=>setCheckoutPhone(e.target.value)} placeholder="Telefon raqami" inputMode="tel" autoComplete="tel"/></div><button className="primary full" disabled={checkoutLoading}>{checkoutLoading?"Yuborilmoqda...":"Buyurtmani yuborish"}</button>{checkoutError&&<div className="auth-error">{checkoutError}</div>}</form></section></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);


