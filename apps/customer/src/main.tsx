import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";
type Banner = { id:number; desktopImageUrl:string; mobileImageUrl:string; active:boolean; sortOrder:number; createdAt:string; targetType:string; targetValue:string; primaryColor:string };
type LandingPage = { id:number; slug:string; title:string; subtitle:string; description:string; offerText:string; productIds:number[]; active:boolean; primaryColor:string };

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


function Icon({name,size=20}:{name:"home"|"grid"|"search"|"bag"|"cart"|"user"|"heart"|"menu"|"close"|"trash"|"back";size?:number}){
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
    trash:<><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 7V4h6v3"/><path d="m6 7 1 14h10l1-14"/></>,
    back:<path d="m15 5-7 7 7 7"/>
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function money(n:number){ return new Intl.NumberFormat("uz-UZ").format(n)+" so'm"; }
function effectivePrice(p:Product){ return p.promoPrice!=null ? p.promoPrice : p.price; }
function cat(p:Product){
  const t=p.name+" "+p.description;
  for(const k of Object.keys(rules)){ if(rules[k]?.test(t)) return k; }
  return "other";
}
function label(k:string){ return categories.find(c=>c[0]===k)?.[1] || "Boshqa"; }

function productImages(p:Product){return (p.imageUrls?.length?p.imageUrls:(p.imageUrl||"").split(/[|\n]+/)).map(x=>x.trim()).filter(Boolean);}

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
  const sale=p.promoPrice!=null; const images=productImages(p);
  return <article className={"product-card "+(sale?"sale-product-card":"")}>
    <div className={"product-image "+(images.length>1?"has-gallery":"single-image")} onClick={()=>onOpen(p)}>
      <div className="product-image-track">{images.length?images.map((src,i)=><img key={src+i} src={src} alt={i===0?p.name:""} loading="lazy"/>):<div className="no-image">MYBUSINESS</div>}</div>
      <div className="badges">{sale&&<span className="sale-badge">AKSIYADA</span>}{p.stock>0&&<span className="stock-badge">SOTUVDA</span>}</div>
      <button className={"heart "+(liked?"liked":"")} onClick={e=>{e.stopPropagation();onLike(p.id)}} aria-label="Sevimliga qo'shish">{liked?"♥":"♡"}</button>
      {p.stock<=0&&<span className="sold-out">Tugagan</span>}
    </div>
    <div className="product-info">
      <span className="product-cat">{label(cat(p))}</span>
      <button className="product-name" onClick={()=>onOpen(p)}>{p.name}</button>
      <p>{p.description||"Mahsulot tavsifi kiritilmagan."}</p>
      <strong className="product-price">{p.promoPrice!=null?<><s className="old-price">{money(p.price)}</s><span className="promo-price">{money(p.promoPrice)}</span></>:money(p.price)}</strong>
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

function Mini({p,onOpen,onCart,onRemove}:{p:Product;onOpen:()=>void;onCart:()=>void;onRemove:()=>void}){
  return <div className="mini-product">
    <button className="mini-image" onClick={onOpen}>{productImages(p)[0]?<img src={productImages(p)[0]} alt=""/>:"MB"}</button>
    <div><button className="mini-name" onClick={onOpen}>{p.name}</button><b>{p.promoPrice!=null?<><s className="old-price">{money(p.price)}</s> {money(p.promoPrice)}</>:money(p.price)}</b><button className="mini-add" onClick={onCart} disabled={!p.stock}>Savatga</button></div>
    <button className="mini-remove" onClick={e=>{e.stopPropagation();onRemove()}} aria-label="Sevimlilardan o'chirish" title="Sevimlilardan o'chirish"><Icon name="trash" size={17}/></button>
  </div>;
}

function HomeProductGrid({items,favs,cart,onLike,onCart,onQty,onAsk,onOpen,onPromo}:{items:Product[];favs:number[];cart:Record<string,number>;onLike:(id:number)=>void;onCart:(p:Product)=>void;onQty:(id:number,d:number)=>void;onAsk:(p:Product)=>void;onOpen:(p:Product)=>void;onPromo:(kind:"new"|"sale")=>void}){
  const chunks:any[]=[];
  items.forEach((p,i)=>{chunks.push(<ProductCard key={"p-"+p.id} p={p} liked={favs.includes(p.id)} qty={cart[p.id]||0} onLike={onLike} onCart={onCart} onQty={onQty} onAsk={onAsk} onOpen={onOpen}/>);
    if((i+1)%6===0&&i<items.length-1)chunks.push(<div className="inline-promo-rail" key={"promo-"+i}>{[["MAXSUS TAKLIF","Bugun tanlash uchun ko'proq sabab."],["YANGI TOVARLAR","Marketplace'dagi yangi mahsulotlarni ko'ring."],["AKSIYALAR","Omborda mavjud maxsus tanlovlar."]].map((x,j)=><button key={j} onClick={()=>{if(j===1)onPromo("new");else if(j===2)onPromo("sale")}}><span>{x[0]}</span><b>{x[1]}</b><em>Ko'rish →</em></button>)}</div>);
  }); return <div className="product-grid home-product-grid">{chunks}</div>;
}

export default function App(){
  const [products,setProducts]=useState<Product[]>([]);
  const [banners,setBanners]=useState<Banner[]>([]);
  const [landingPage,setLandingPage]=useState<LandingPage|null>(null);
  const [landingPageLoading,setLandingPageLoading]=useState(false);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [sub,setSub]=useState("");
  const [sort,setSort]=useState("newest");
  const [availability,setAvailability]=useState<"all"|"stock">("all");
  const [minPrice,setMinPrice]=useState("");
  const [maxPrice,setMaxPrice]=useState("");
  const [loading,setLoading]=useState(true);
  const [productsLoaded,setProductsLoaded]=useState(false);
  const [error,setError]=useState("");
  const [favs,setFavs]=useState<number[]>(()=>JSON.parse(localStorage.getItem("mybusiness:favorites")||"[]"));
  const [cart,setCart]=useState<Record<string,number>>(()=>JSON.parse(localStorage.getItem("mybusiness:cart")||"{}"));
  const [panel,setPanel]=useState<"cart"|"favorites"|"menu"|"profile"|"filters"|"search"|null>(null);
  const [quick,setQuick]=useState<Product|null>(null);
  const [quickImageIndex,setQuickImageIndex]=useState(0);
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
  const [checkoutPayment,setCheckoutPayment]=useState<"cash"|"card"|"debt">("cash");
  const [checkoutAddress,setCheckoutAddress]=useState("");
  const [profileView,setProfileView]=useState<"home"|"orders"|"chats"|"favorites"|"settings"|"help"|"addresses">("home");
  const [myOrders,setMyOrders]=useState<Array<any>>([]);
  const [orderStatusFilter,setOrderStatusFilter]=useState<"all"|"new"|"preparing"|"shipping"|"completed">("all");
  const [myChats,setMyChats]=useState<Array<any>>([]);
  const [profileLoading,setProfileLoading]=useState(false);
  const [routeHash,setRouteHash]=useState(()=>window.location.hash);
  const [visibleLimit,setVisibleLimit]=useState(32);

  type RouteState = {
    panel: "cart"|"favorites"|"menu"|"profile"|"filters"|"search"|null;
    profileView: typeof profileView;
    productId: number|null;
    chatProductId: number|null;
    modal: "auth"|"checkout"|null;
    pageSlug: string|null;
  };
  const routeReadyRef=useRef(false);
  const applyingRouteRef=useRef(false);

  function routeFromUrl():RouteState{
    const hash=window.location.hash.replace(/^#/,"")||"/";
    const [rawPath="/",rawQuery=""]=hash.split("?");
    const parts=rawPath.replace(/^\//,"").split("/").filter(Boolean);
    const params=new URLSearchParams(rawQuery);
    const modal=params.get("modal");
    let panel:RouteState["panel"]=null;
    let profileView:RouteState["profileView"]="home";
    let productId:number|null=null;
    let chatProductId:number|null=null;
    let pageSlug:string|null=null;
    if(parts[0]==="page" && parts[1]) pageSlug=decodeURIComponent(parts[1]);
    else if(parts[0]==="product" && /^\d+$/.test(parts[1]||"")) productId=Number(parts[1]);
    else if(parts[0]==="chat" && /^\d+$/.test(parts[1]||"")) chatProductId=Number(parts[1]);
    else if(parts[0]==="profile"){
      panel="profile";
      const allowed=["home","orders","chats","favorites","settings","help","addresses"] as const;
      profileView=(allowed.includes((parts[1]||"home") as typeof allowed[number])?(parts[1]||"home"):"home") as typeof profileView;
    }else if(["cart","favorites","menu","filters","search"].includes(parts[0]||"")){
      panel=parts[0] as RouteState["panel"];
    }
    return {panel,profileView,productId,chatProductId,modal:modal==="auth"||modal==="checkout"?modal:null,pageSlug};
  }

  function currentRoute():RouteState{
    return {
      panel,
      profileView,
      productId:quick?.id??null,
      chatProductId:chatProduct?.id??null,
      modal:authOpen?"auth":checkoutOpen?"checkout":null,
      pageSlug: landingPage?.slug??null
    };
  }

  function routeUrl(r:RouteState){
    let path="/";
    if(r.pageSlug)path="/page/"+encodeURIComponent(r.pageSlug);
    else if(r.chatProductId!=null)path="/chat/"+r.chatProductId;
    else if(r.productId!=null)path="/product/"+r.productId;
    else if(r.panel==="profile")path="/profile/"+r.profileView;
    else if(r.panel)path="/"+r.panel;
    const q=r.modal?("?modal="+r.modal):"";
    return "#"+path+q;
  }

  function applyRoute(r:RouteState){
    applyingRouteRef.current=true;
    setPanel(r.panel);
    if(r.pageSlug!==landingPage?.slug)setLandingPage(null);
    setProfileView(r.panel==="profile"?r.profileView:"home");
    const p=r.productId!=null?products.find(x=>x.id===r.productId):null;
    setQuick(p||null);
    setQuickImageIndex(0);
    const cp=r.chatProductId!=null?products.find(x=>x.id===r.chatProductId):null;
    setChatProduct(cp||null);
    if(!cp)setChatId(null);
    setAuthOpen(r.modal==="auth");
    setCheckoutOpen(r.modal==="checkout");
    queueMicrotask(()=>{applyingRouteRef.current=false});
  }

  function goBack(){
    if(window.history.length>1){window.history.back();}
    else{
      window.location.hash="#/";
    }
  }

  useEffect(()=>{
    if(!productsLoaded || routeReadyRef.current)return;
    const r=routeFromUrl();
    applyRoute(r);
    routeReadyRef.current=true;
    if(window.location.hash!==routeUrl(r))history.replaceState(r,"",routeUrl(r));
  },[productsLoaded]);

  useEffect(()=>{
    const onPop=()=>{
      setRouteHash(window.location.hash);
      const r=routeFromUrl();
      if(r.productId!=null && !products.some(p=>p.id===r.productId))return;
      applyRoute(r);
    };
    window.addEventListener("popstate",onPop);
    window.addEventListener("hashchange",onPop);
    return()=>{window.removeEventListener("popstate",onPop);window.removeEventListener("hashchange",onPop)};
  },[products]);

  useEffect(()=>{
    if(!routeReadyRef.current || applyingRouteRef.current)return;
    const urlRoute=routeFromUrl();
    if(urlRoute.pageSlug && !landingPage)return;
    const url=routeUrl(currentRoute());
    if(window.location.hash!==url)history.pushState(currentRoute(),"",url);
  },[panel,profileView,quick?.id,chatProduct?.id,authOpen,checkoutOpen,landingPage?.slug]);


  useEffect(()=>{
    const slug=routeFromUrl().pageSlug;
    if(!slug){setLandingPage(null);return;}
    setLandingPageLoading(true);
    fetch(apiBase+"/api/v1/landing-pages/"+encodeURIComponent(slug),{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as {page?:LandingPage};if(r.ok)setLandingPage(d.page||null);else setLandingPage(null);})
      .catch(()=>setLandingPage(null))
      .finally(()=>setLandingPageLoading(false));
  },[routeHash]);
  useEffect(()=>{
    fetch(apiBase+"/api/v1/banners",{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as {banners?:Banner[]};if(r.ok)setBanners(d.banners||[])})
      .catch(()=>setBanners([]));
  },[]);
  useEffect(()=>{
    fetch(apiBase+"/api/v1/products",{headers:{Accept:"application/json"}})
      .then(async r=>{const d=await r.json() as ProductsResponse & {message?:string};if(!r.ok)throw new Error(d.message||"API xatosi");setProducts(d.products||[])})
      .catch(e=>setError(e instanceof Error?e.message:"API bilan ulanishda xatolik"))
      .finally(()=>{setLoading(false);setProductsLoaded(true)});
  },[]);
  useEffect(()=>localStorage.setItem("mybusiness:favorites",JSON.stringify(favs)),[favs]);
  useEffect(()=>{
    if(!authUser?.token){setFavs(JSON.parse(localStorage.getItem("mybusiness:favorites")||"[]"));return;}
    let stopped=false;
    fetch(apiBase+"/api/v1/favorites",{headers:{Accept:"application/json",Authorization:"Bearer "+authUser.token}})
      .then(async r=>{const d=await r.json() as {favorites?:number[];message?:string};if(!r.ok)throw new Error(d.message||"Sevimlilarni yuklab bo'lmadi.");if(!stopped)setFavs(d.favorites||[]);})
      .catch(()=>{if(!stopped)setToast("Sevimlilarni yuklab bo'lmadi.")});
    return()=>{stopped=true};
  },[authUser?.token]);
  useEffect(()=>localStorage.setItem("mybusiness:cart",JSON.stringify(cart)),[cart]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),2200);return()=>clearTimeout(t)},[toast]);
  useEffect(()=>{if(!chatId||!chatProduct)return;
    let stopped=false;
    const refresh=async()=>{try{
      const r=await fetch(apiBase+"/api/v1/chats/"+chatId+"/messages",{headers:{Accept:"application/json"}});
      const d=await r.json() as {messages?:Array<{id:number;senderRole:"customer"|"seller";body:string;createdAt:string}>};
      if(!stopped&&r.ok)setChatMessages(d.messages||[]);
    }catch{}};
    void refresh();
    const timer=window.setInterval(refresh,3000);
    return()=>{stopped=true;window.clearInterval(timer)};
  },[chatId,chatProduct]);

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
      const priceMatch=effectivePrice(p)>=min&&effectivePrice(p)<=max;
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
  const cartTotal=cartItems.reduce((s,x)=>s+effectivePrice(x.p)*x.q,0);
  const renderedProducts=visible.slice(0,visibleLimit);
  const newProducts=useMemo(()=>[...products].filter(isNew).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,8),[products]);
  const popular=useMemo(()=>[...products].filter(p=>p.stock>0).sort((a,b)=>b.stock-a.stock).slice(0,8),[products]);
  const categoryCounts=useMemo(()=>products.reduce<Record<string,number>>((acc,p)=>{const k=cat(p);acc[k]=(acc[k]||0)+1;return acc},{}),[products]); 

  function catalog(){document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});}
  function chooseCategory(k:string){setCategory(k);setSub("");setPanel(null);setTimeout(catalog,30);}
  function chooseSub(s:string){setSub(s);setPanel(null);setTimeout(catalog,30);}
  function add(p:Product){if(!p.stock)return;setCart(c=>({...c,[p.id]:Math.min((c[p.id]||0)+1,p.stock)}));setToast("Mahsulot savatga qo'shildi");}
  function qty(id:number,d:number){setCart(c=>{const n=(c[id]||0)+d;if(n<=0){const z={...c};delete z[id];return z}const p=products.find(x=>x.id===id);return {...c,[id]:Math.min(n,p?.stock||n)}})}
  function clearFilters(){setQuery("");setCategory("all");setSub("");setSort("newest");setAvailability("all");setMinPrice("");setMaxPrice("");}
  function removeFromCart(id:number){setCart(c=>{const z={...c};delete z[id];return z})}
  function openSearch(nextQuery=query){setQuery(nextQuery.trim());setPanel("search");}
  async function toggleFav(id:number){
    if(!authUser?.token){setAuthOpen(true);setToast("Sevimlilarga saqlash uchun akkauntga kiring.");return;}
    const wasLiked=favs.includes(id);
    setFavs(f=>wasLiked?f.filter(x=>x!==id):[...f,id]);
    try{
      const r=await fetch(apiBase+"/api/v1/favorites/"+id,{method:"PUT",headers:{Accept:"application/json",Authorization:"Bearer "+authUser.token}});
      const d=await r.json() as {liked?:boolean;message?:string};
      if(!r.ok||typeof d.liked!=="boolean")throw new Error(d.message||"Sevimlini saqlab bo'lmadi.");
      setFavs(f=>d.liked?(f.includes(id)?f:[...f,id]):f.filter(x=>x!==id));
    }catch(e){setFavs(f=>wasLiked?(f.includes(id)?f:[...f,id]):f.filter(x=>x!==id));setToast(e instanceof Error?e.message:"Sevimlini saqlab bo'lmadi.");}
  }
  function openProduct(p:Product){setQuick(p);setQuickImageIndex(0);}
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
        const sentMessage = d.message;
        if (!sentMessage || typeof sentMessage === "string") throw new Error("Xabar yuborilmadi.");
        setChatMessages(x=>[...x, sentMessage]);
      }else{
        const r=await fetch(apiBase+"/api/v1/chats",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({customerName:authUser.name||"Mijoz",customerUserId:null,productId:chatProduct.id,message:body})});
        const d=await r.json() as {chatId?:number;message?:{id:number;senderRole:"customer"|"seller";body:string;createdAt:string};error?:string};
        if(!r.ok||!d.chatId||!d.message)throw new Error(d.error||"Chat ochilmadi.");
        setChatId(d.chatId);setChatMessages([d.message]);
      }
      setChatInput("");
    }catch(e){setToast(e instanceof Error?e.message:"Xabar yuborilmadi.")}finally{setChatLoading(false)}
  }
  function openCheckout(){
    if(!authUser){setAuthOpen(true);return}
    if(!cartItems.length)return;
    setCheckoutName(authUser.name||"");setCheckoutPhone(authUser.phone||"");setCheckoutAddress("");setCheckoutPayment("cash");setCheckoutError("");setCheckoutOpen(true);
  }
  async function loadProfileData(){
    if(!authUser?.phone)return;
    setProfileLoading(true);
    try{
      const [or,cr]=await Promise.all([
        fetch(apiBase+"/api/v1/orders",{headers:{Accept:"application/json"}}),
        fetch(apiBase+"/api/v1/chats",{headers:{Accept:"application/json"}})
      ]);
      const od=await or.json() as {orders?:any[]}; const cd=await cr.json() as {chats?:any[]};
      const phone=authUser.phone.replace(/\D/g,"");
      setMyOrders((od.orders||[]).filter(o=>String(o.customerPhone||"").replace(/\D/g,"")===phone));
      setMyChats((cd.chats||[]).filter(x=>x.customerName===authUser.name));
    }catch{setToast("Profil ma'lumotlarini yuklab bo'lmadi.")}finally{setProfileLoading(false)}
  }
  function openProfileView(view:typeof profileView){
    setProfileView(view);
    if(view==="orders"||view==="chats")void loadProfileData();
  }
  async function submitCheckout(e:FormEvent){
    e.preventDefault();
    if(!checkoutName.trim()||!checkoutPhone.trim()||!cartItems.length)return;
    setCheckoutLoading(true);setCheckoutError("");
    try{
      const r=await fetch(apiBase+"/api/v1/orders",{method:"POST",headers:{"content-type":"application/json",Accept:"application/json"},body:JSON.stringify({customerName:checkoutName.trim(),customerPhone:checkoutPhone.trim(),customerUserId:null,paymentMethod:checkoutPayment,deliveryAddress:checkoutAddress.trim(),items:cartItems.map(x=>({productId:x.p.id,quantity:x.q}))})});
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
      if(window.matchMedia("(min-width: 768px)").matches){
        window.open(d.telegramUrl,"_blank","noopener,noreferrer");
      }else{
        window.location.href=d.telegramUrl;
      }
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

  const currentUrlRoute=routeFromUrl();
  const isLandingPage = Boolean(currentUrlRoute.pageSlug);
  const landingBanner = currentUrlRoute.pageSlug ? banners.find(b=>b.targetType==="page" && b.targetValue===currentUrlRoute.pageSlug) : null;

  function openBannerTarget(b:Banner){
    if(b.targetType==="page" && b.targetValue){
      const nextHash="#/page/"+encodeURIComponent(b.targetValue);
      setRouteHash(nextHash);
      window.location.hash=nextHash;
      window.scrollTo({top:0,left:0,behavior:"auto"});
      return;
    }
    if(b.targetType==="url" && b.targetValue){window.open(b.targetValue,"_blank","noopener,noreferrer");return;}
    if(b.targetType==="new-products"){setCategory("new");setTimeout(()=>document.getElementById("all-products")?.scrollIntoView({behavior:"smooth"}),0);return;}
    if(b.targetType==="sale-products"){setCategory("sale");setTimeout(()=>document.getElementById("all-products")?.scrollIntoView({behavior:"smooth"}),0);return;}
    if(b.targetType==="category" && b.targetValue){setCategory(b.targetValue);setTimeout(()=>document.getElementById("all-products")?.scrollIntoView({behavior:"smooth"}),0);return;}
    document.getElementById("all-products")?.scrollIntoView({behavior:"smooth"});
  }

  useEffect(()=>{
    const color=isLandingPage
      ? (landingPage?.primaryColor || landingBanner?.primaryColor || "#f4f1f7")
      : "#f4f1f7";
    setLandingPrimaryColor(color);
    document.documentElement.style.setProperty("--landing-primary",color);
    document.body.style.backgroundColor=isLandingPage ? color : "";
    document.documentElement.style.backgroundColor=isLandingPage ? color : "";
    return()=>{
      document.body.style.backgroundColor="";
      document.documentElement.style.backgroundColor="";
    };
  },[isLandingPage,landingPage?.primaryColor,landingBanner?.id,landingBanner?.primaryColor]);

  return <main className={"market "+(isLandingPage?"landing-mode":"")}>
    {isLandingPage&&<button className="landing-back-button" type="button" onClick={()=>{setRouteHash("#/");window.location.hash="#/";window.scrollTo({top:0,left:0,behavior:"auto"})}}><Icon name="back" size={22}/><span>Asosiyga qaytish</span></button>}
    {!isLandingPage&&panel===null&&<header className="app-header">
      <a className="logo" href="/" aria-label="MyBusiness Market">MYBUSINESS<span>MARKET</span></a>
      <form className="header-search-trigger" role="search" onSubmit={e=>{e.preventDefault();openSearch(query)}}>
        <span className="search-leading" aria-hidden="true"><Icon name="search" size={21}/></span>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Escape")setQuery("")}} placeholder="Mahsulot, brend yoki kategoriya..." aria-label="Mahsulot, brend yoki kategoriya qidiring" enterKeyHint="search"/>
        {query&&<button className="search-clear" type="button" onClick={()=>setQuery("")} aria-label="Qidiruvni tozalash"><Icon name="close" size={16}/></button>}
        <button className="search-submit" type="submit" aria-label="Qidirish"><Icon name="search" size={18}/></button>
      </form>
    </header>}

    {banners.length>0&&<section className="customer-banner-section" aria-label="Maxsus takliflar">
      <div className="customer-banner-track">
        {banners.map((b,i)=><button className={"customer-banner "+(isLandingPage?"customer-banner-static":"")} key={b.id} type="button" disabled={isLandingPage} onClick={()=>{if(!isLandingPage)openBannerTarget(b)}} aria-label={isLandingPage?"Banner":"Bannerga o'tish"}>
          <picture><source media="(max-width: 700px)" srcSet={b.mobileImageUrl}/><img src={b.desktopImageUrl} alt="Maxsus taklif" loading={i===0?"eager":"lazy"} decoding="async"/></picture>
        </button>)}
      </div>
    </section>}
    {landingPageLoading?<div className="state">Sahifa yuklanmoqda...</div>:landingPage?<section className="landing-page">
      <div className="landing-page-hero"><span className="eyebrow">MYBUSINESS · MAXSUS</span><h1>{landingPage.title}</h1>{landingPage.subtitle&&<h2>{landingPage.subtitle}</h2>}{landingPage.description&&<p>{landingPage.description}</p>}{landingPage.offerText&&<div className="landing-offer">{landingPage.offerText}</div>}</div>
      <section id="all-products" className="product-section app-products"><div className="panel-head"><div><h2>Tanlangan mahsulotlar</h2><span className="muted">{landingPage.productIds.length} ta mahsulot</span></div></div>{(()=>{const selected=products.filter(p=>landingPage.productIds.includes(p.id));return selected.length?<HomeProductGrid items={selected} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick} onPromo={k=>chooseCategory(k)}/>:<div className="state">Bu sahifaga hali mahsulot qo'shilmagan.</div>})()}</section>
    </section>:null}
    {!landingPage&&!landingPageLoading&&<section id="all-products" className="product-section app-products">
      <div className="catalog-filter-bar"><button className="filter-main-button" onClick={()=>setPanel("filters")}><span>Filtrlar</span><Icon name="grid" size={17}/></button><button className="sort-button" onClick={()=>setPanel("filters")}><span>{sort==="price-low"?"Arzon → qimmat":sort==="price-high"?"Qimmat → arzon":sort==="name"?"Nomi bo‘yicha":"Yangi mahsulotlar"}</span><span>⌄</span></button>{(category!=="all"||sub||availability==="stock"||minPrice||maxPrice||query)&&<button className="filter-reset-chip" onClick={clearFilters}>Tozalash</button>}</div>
      {error?<div className="state error"><b>Marketplace bilan ulanishda xatolik.</b><span>{error}</span><button onClick={()=>location.reload()}>Qayta urinish</button></div>:loading?<div className="state">Mahsulotlar yuklanmoqda...</div>:visible.length?<><HomeProductGrid items={renderedProducts} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick} onPromo={k=>chooseCategory(k)}/>{renderedProducts.length<visible.length&&<div className="product-load-more"><span>{renderedProducts.length} / {visible.length} ta mahsulot ko'rsatilmoqda</span><button type="button" onClick={()=>setVisibleLimit(n=>Math.min(n+32,visible.length))}>Yana 32 ta ko'rsatish</button></div>}</>:<div className="state"><b>Mahsulot topilmadi.</b><button onClick={clearFilters}>Filtrlarni tozalash</button></div>}
    </section>}

    {!isLandingPage&&<nav className="mobile-nav" aria-label="Asosiy navigatsiya">
  <button className={!isLandingPage&&panel===null?"active":""} onClick={()=>{window.location.hash="#/";scrollTo(0,0)}}><span><Icon name="home"/></span>{panel===null&&<b className="nav-label">Asosiy</b>}</button>
  <button className={panel==="menu"?"active":""} onClick={()=>setPanel("menu")}><span><Icon name="grid"/></span>{panel==="menu"&&<b className="nav-label">Mahsulotlar</b>}</button>
  <button className={panel==="search"?"active":""} onClick={()=>openSearch()}><span><Icon name="search"/></span>{panel==="search"&&<b className="nav-label">Qidirish</b>}</button>
  <button className={panel==="cart"?"active":""} onClick={()=>setPanel("cart")}><span><Icon name="bag"/></span>{panel==="cart"&&<b className="nav-label">Savat</b>}{cartCount>0&&<i className="nav-badge">{cartCount}</i>}</button>
  <button className={panel==="profile"?"active":""} onClick={()=>setPanel("profile")}><span><Icon name="user"/></span>{panel==="profile"&&<b className="nav-label">Profil</b>}</button>
</nav>}

    {panel&&<div className="drawer-backdrop" onClick={goBack}><aside className="drawer" onClick={e=>e.stopPropagation()}>
      <div className="drawer-head">
          <h2>{panel==="cart"?"Savat":panel==="favorites"?"Sevimlilar":panel==="profile"?"Profil":panel==="filters"?"Filtrlar":panel==="search"?"Qidirish":"Katalog"}</h2>
        </div>
        {panel==="favorites"&&<button className="drawer-profile-back" onClick={goBack} aria-label="Profilga qaytish"><Icon name="back" size={16}/><span>Profil</span></button>}
      {panel==="profile"&&<div className="profile-panel profile-v2">
        {!authUser?<div className="profile-login-card profile-login-v2">
          <div className="profile-login-art"><Icon name="user" size={30}/></div>
          <span className="profile-kicker">MYBUSINESS ACCOUNT</span>
          <h3>Xaridlaringizni bir joydan boshqaring</h3>
          <p>Buyurtmalar, chatlar, sevimlilar va manzillarni bitta professional kabinetdan boshqaring.</p>
          <button className="primary full" onClick={()=>setAuthOpen(true)}>Kirish / ro'yxatdan o'tish</button>
          <small className="profile-login-note">Telegram orqali tez va xavfsiz kirish</small>
        </div>:
        <>
          {profileView!=="home"&&<button className="profile-back profile-back-v2" onClick={goBack}><Icon name="back" size={18}/> Profil</button>}
          {profileView==="home"&&<>
            <div className="profile-account-card">
              <div className="profile-account-main">
                <div className="profile-avatar profile-avatar-v2">{authUser.name?.slice(0,1).toUpperCase()||"M"}</div>
                <div className="profile-account-copy"><span>MyBusiness akkaunti</span><h2>{authUser.name||"Mijoz"}</h2><p>{authUser.phone||"Telegram akkaunti"}</p></div>
              </div>
              <button className="profile-account-action" onClick={()=>openProfileView("settings")} aria-label="Sozlamalar">⚙</button>
            </div>

            <div className="profile-quick-grid">
              <button onClick={()=>openProfileView("orders")}><span className="profile-quick-icon">▣</span><b>Buyurtmalar</b><small>{myOrders.length?myOrders.length+" ta":"Tarixni ko'rish"}</small></button>
              <button onClick={()=>openProfileView("chats")}><span className="profile-quick-icon">◌</span><b>Chatlar</b><small>{myChats.length?myChats.length+" ta":"Sotuvchilar bilan"}</small></button>
              <button onClick={()=>setPanel("favorites")}><span className="profile-quick-icon">♡</span><b>Sevimlilar</b><small>{favs.length} ta mahsulot</small></button>
            </div>

            <div className="profile-section-card">
              <div className="profile-section-head"><div><span>BUYURTMALAR</span><h3>Buyurtmalarim</h3></div><button onClick={()=>{setOrderStatusFilter("all");openProfileView("orders")}}>Barchasi <b>›</b></button></div>
              <div className="profile-order-stages">
                <button onClick={()=>{setOrderStatusFilter("new");openProfileView("orders")}}><span>○</span><b>Yangi</b><small>Qabul qilindi</small></button>
                <button onClick={()=>{setOrderStatusFilter("preparing");openProfileView("orders")}}><span>◔</span><b>Tayyorlanmoqda</b><small>Jarayonda</small></button>
                <button onClick={()=>{setOrderStatusFilter("shipping");openProfileView("orders")}}><span>⌁</span><b>Yetkazilmoqda</b><small>Yo'lda</small></button>
                <button onClick={()=>{setOrderStatusFilter("completed");openProfileView("orders")}}><span>✓</span><b>Yetkazildi</b><small>Tugallangan</small></button>
              </div>
            </div>

            <div className="profile-section-title">Kabinet</div>
            <div className="profile-menu-list profile-menu-list-v2">
              <button onClick={()=>openProfileView("addresses")}><span className="profile-menu-icon">⌖</span><div><b>Manzillarim</b><small>Yetkazib berish manzillarini boshqarish</small></div><strong>›</strong></button>
              <button onClick={()=>openProfileView("chats")}><span className="profile-menu-icon">◌</span><div><b>Sotuvchilar bilan chat</b><small>Mahsulot bo'yicha savollar va javoblar</small></div><strong>›</strong></button>
              <button onClick={()=>openProfileView("settings")}><span className="profile-menu-icon">⚙</span><div><b>Sozlamalar</b><small>Akkaunt va ilova sozlamalari</small></div><strong>›</strong></button>
            </div>

            <div className="profile-section-title">Yordam va ma'lumot</div>
            <div className="profile-menu-list profile-menu-list-v2">
              <button onClick={()=>openProfileView("help")}><span className="profile-menu-icon">?</span><div><b>Yordam markazi</b><small>Buyurtma, to'lov va mahsulotlar bo'yicha yordam</small></div><strong>›</strong></button>
              <button onClick={()=>setPanel("favorites")}><span className="profile-menu-icon">♡</span><div><b>Sevimlilar</b><small>Saqlangan mahsulotlar: {favs.length} ta</small></div><strong>›</strong></button>
            </div>
            <button className="profile-logout-link" onClick={signOut}>Akkauntdan chiqish</button>
          </>}

          {profileView==="orders"&&<div className="profile-content profile-subview">
            <div className="profile-subview-heading"><span>BUYURTMALAR</span><h3>Buyurtmalarim</h3><p>Barcha xaridlaringiz va ularning joriy holati.</p></div>
            <div className="profile-order-filter-tabs" role="tablist" aria-label="Buyurtma holati">
              {([["all","Barchasi"],["new","Yangi"],["preparing","Tayyorlanmoqda"],["shipping","Yetkazilmoqda"],["completed","Yetkazildi"]] as const).map(([key,label])=><button key={key} className={orderStatusFilter===key?"active":""} onClick={()=>setOrderStatusFilter(key)}>{label}</button>)}
            </div>
            {profileLoading?<div className="state">Yuklanmoqda...</div>:myOrders.length?myOrders.filter(o=>orderStatusFilter==="all"||o.status===orderStatusFilter).length?myOrders.filter(o=>orderStatusFilter==="all"||o.status===orderStatusFilter).map(o=><div className="profile-order-card profile-order-v2" key={o.id}>
              <div className="profile-order-top"><div><span>BUYURTMA #{o.id}</span><b>{new Date(o.createdAt).toLocaleDateString("uz-UZ")}</b></div><strong>{money(Number(o.total))}</strong></div>
              <em className={"order-status status-"+o.status}>{({new:"Yangi",confirmed:"Tasdiqlangan",preparing:"Tayyorlanmoqda",shipping:"Yetkazilmoqda",completed:"Yetkazildi",cancelled:"Bekor qilingan"} as any)[o.status]||o.status}</em>
              <small>{(o.items||[]).map((i:any)=>i.productName+" × "+i.quantity).join(" · ")}</small>
            </div>):<div className="drawer-empty">Bu holatda buyurtmalar yo'q.</div>:<div className="drawer-empty">Hali buyurtmalar yo'q.</div>}
          </div>}

          {profileView==="chats"&&<div className="profile-content profile-subview">
            <div className="profile-subview-heading"><span>ALOQA</span><h3>Chatlar</h3><p>Mahsulot rasmi va nomi bilan barcha suhbatlaringiz.</p></div>
            {profileLoading?<div className="state">Yuklanmoqda...</div>:myChats.length?myChats.map(x=>{const p=products.find(p=>p.id===Number(x.productId));const chatProductData=p||{id:Number(x.productId),name:x.productName||"Mahsulot",description:"",price:0,stock:0,createdAt:"",imageUrl:x.productImageUrl||""};return <button className="profile-chat-row profile-chat-row-v2" key={x.id} onClick={async()=>{setChatProduct(chatProductData as Product);setChatId(Number(x.id));setChatMessages([]);setChatInput("");setPanel(null);try{const r=await fetch(apiBase+"/api/v1/chats/"+x.id+"/messages",{headers:{Accept:"application/json"}});const d=await r.json() as {messages?:Array<{id:number;senderRole:"customer"|"seller";body:string;createdAt:string}>};if(r.ok)setChatMessages(d.messages||[]);}catch{setToast("Xabarlarni yuklab bo'lmadi.")}}}>
              <span className="profile-chat-image profile-chat-image-v2">{(p?.imageUrl||x.productImageUrl)?<img src={p?.imageUrl||x.productImageUrl} alt="" />:<span>MB</span>}</span>
              <div><span className="profile-chat-label">MAHSULOT</span><b>{p?.name||x.productName||"Mahsulot"}</b><small>{x.lastMessage||"Yangi chat"} · {x.status==="open"?"Ochiq":"Yopiq"}</small></div><strong>›</strong>
            </button>}):<div className="drawer-empty">Hali chatlar yo'q.</div>}
          </div>}

          {profileView==="addresses"&&<div className="profile-content profile-subview"><div className="profile-subview-heading"><span>YETKAZIB BERISH</span><h3>Manzillarim</h3><p>Buyurtma rasmiylashtirishda foydalaniladigan manzillar.</p></div><div className="coming-card profile-empty-feature"><span>⌖</span><b>Saqlangan manzillar</b><p>Hozircha checkout vaqtida manzil kiritish faol. Saqlangan manzillar keyingi bosqichda ulanadi.</p></div></div>}

          {profileView==="settings"&&<div className="profile-content profile-subview"><div className="profile-subview-heading"><span>AKKAUNT</span><h3>Sozlamalar</h3><p>MyBusiness ilovasi va akkauntingizni boshqaring.</p></div><div className="profile-settings-card"><div className="setting-row"><div><b>Til</b><small>O'zbekcha</small></div><span>›</span></div><div className="setting-row"><div><b>Bildirishnomalar</b><small>Buyurtma yangiliklari</small></div><span>Tez orada</span></div><div className="setting-row"><div><b>Telefon</b><small>{authUser.phone||"Telegram orqali tasdiqlangan"}</small></div><span>✓</span></div></div><button className="profile-danger-button" onClick={signOut}>Akkauntdan chiqish</button></div>}

          {profileView==="help"&&<div className="profile-content profile-subview"><div className="profile-subview-heading"><span>YORDAM</span><h3>Yordam markazi</h3><p>Eng ko'p kerak bo'ladigan savollar va qo'llab-quvvatlash.</p></div><div className="help-card profile-help-v2"><b>Buyurtma bo'yicha savol</b><p>Buyurtma yoki mahsulot haqida sotuvchiga mahsulot sahifasidan chat orqali yozishingiz mumkin.</p><span>›</span></div><div className="help-card profile-help-v2"><b>To'lov</b><p>Hozircha naqd to'lov faol. Karta va qarz to'lovi keyinroq ulanadi.</p><span>›</span></div></div>}
        </>}
      </div>}
      {panel==="menu"&&<div className="menu-products-screen"><div className="menu-promo"><span>MYBUSINESS MARKET</span><b>Bugungi mahsulotlarni bir joyda toping</b><button onClick={()=>{setCategory("all");setPanel("menu")}}>Barchasini ko'rish →</button></div><div className="menu-products-title"><h3>Barcha mahsulotlar</h3><span>{visible.length} ta mahsulot</span></div>{visible.length?<Grid items={visible} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick}/>:<div className="state">Mahsulot topilmadi.</div>}</div>}
      {panel==="search"&&<div className="screen-search"><form className="screen-search-box" role="search" onSubmit={e=>{e.preventDefault();openSearch(query)}}><Icon name="search" size={20}/><input className="screen-search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki kategoriya qidiring..." enterKeyHint="search"/>{query&&<button className="screen-search-clear" type="button" onClick={()=>setQuery("")} aria-label="Qidiruvni tozalash"><Icon name="close" size={16}/></button>}<button className="screen-search-submit" type="submit" aria-label="Qidirish"><Icon name="search" size={18}/></button></form><div className="screen-search-meta">{query?`${visible.length} ta mahsulot topildi`:`Barcha mahsulotlar · ${visible.length} ta`}</div><div className="screen-search-results">{visible.length?<Grid items={visible} favs={favs} cart={cart} onLike={toggleFav} onCart={add} onQty={qty} onAsk={askSeller} onOpen={setQuick}/>:<SimilarProducts items={similarProducts} onOpen={setQuick} onCart={add} cart={cart} onQty={qty} favs={favs} onLike={toggleFav} onAsk={askSeller}/>}</div></div>}
      {panel==="filters"&&<div className="filter-sheet">
        <div className="filter-sheet-head"><div><span>Tanlash</span><h2>Filtrlar</h2></div><button onClick={goBack} aria-label="Filtrlarni yopish"><Icon name="close" size={21}/></button></div>
        <div className="filter-section"><div className="filter-section-title"><b>Kategoriya</b><span>{label(category)}</span></div><div className="filter-chips">{categories.map(c=><button key={c[0]} className={category===c[0]?"selected":""} onClick={()=>{setCategory(c[0]);setSub("")}}>{c[2]} {c[1]}</button>)}</div></div>
        {category!=="all"&&category!=="new"&&category!=="sale"&&subcategories[category]&&<div className="filter-section"><div className="filter-section-title"><b>Turkum</b><span>{sub||"Barchasi"}</span></div><div className="filter-chips">{subcategories[category].map(x=><button key={x} className={sub===x?"selected":""} onClick={()=>setSub(sub===x?"":x)}>{x}</button>)}</div></div>}
        <div className="filter-section"><div className="filter-section-title"><b>Narx</b><span>so'm</span></div><div className="price-inputs"><input inputMode="numeric" value={minPrice} onChange={e=>setMinPrice(e.target.value.replace(/\\D/g,""))} placeholder="dan"/><span>—</span><input inputMode="numeric" value={maxPrice} onChange={e=>setMaxPrice(e.target.value.replace(/\\D/g,""))} placeholder="gacha"/></div></div>
        <div className="filter-section"><div className="filter-section-title"><b>Mavjudligi</b></div><button className={"filter-row "+(availability==="stock"?"selected":"")} onClick={()=>setAvailability(availability==="stock"?"all":"stock")}><span><i>{availability==="stock"?"✓":"○"}</i> Faqat sotuvdagi mahsulotlar</span><b>›</b></button></div>
        <div className="filter-section"><div className="filter-section-title"><b>Saralash</b></div><div className="filter-sort-list">{[["newest","Yangi mahsulotlar"],["price-low","Arzon → qimmat"],["price-high","Qimmat → arzon"],["name","Nomi bo‘yicha"]].map(([k,v])=><button key={k} className={sort===k?"selected":""} onClick={()=>setSort(k as typeof sort)}><span>{v}</span><i>{sort===k?"✓":"○"}</i></button>)}</div></div>
        <div className="filter-bottom"><button className="filter-clear" onClick={clearFilters}>Tozalash</button><button className="filter-apply" onClick={goBack}>Ko‘rsatish · {visible.length}</button></div>
      </div>}
      {panel==="favorites"&&<div className="drawer-list">{products.filter(p=>favs.includes(p.id)).map(p=><Mini key={p.id} p={p} onOpen={()=>setQuick(p)} onCart={()=>add(p)} onRemove={()=>toggleFav(p.id)}/>) }{!favs.length&&<div className="drawer-empty">Hali sevimli mahsulotlar yo'q.</div>}</div>}
      {panel==="cart"&&<div className="drawer-cart">{cartItems.map(x=><div className="cart-item" key={x.p.id}><div className="cart-item-main" role="button" tabIndex={0} onClick={()=>openProduct(x.p)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProduct(x.p)}}} aria-label={x.p.name}><div className="mini-image">{productImages(x.p)[0]?<img src={productImages(x.p)[0]} alt=""/>:"MB"}</div><div className="cart-item-info"><b>{x.p.name}</b><span>{money(effectivePrice(x.p))} × {x.q}</span><div className="qty" onClick={e=>e.stopPropagation()}><button aria-label="Kamaytirish" onClick={()=>qty(x.p.id,-1)}>−</button><b>{x.q}</b><button aria-label="Ko'paytirish" onClick={()=>qty(x.p.id,1)}>+</button></div></div></div><button className="remove-item" aria-label="O'chirish" onClick={()=>removeFromCart(x.p.id)}><Icon name="trash" size={18}/></button></div>)}{cartItems.length?<div className="cart-total"><span>Jami</span><strong>{money(cartTotal)}</strong><button className="primary full" onClick={openCheckout}>Buyurtma berish</button></div>:<div className="drawer-empty">Savatingiz hozircha bo'sh.</div>}</div>}
    </aside></div>}

    {quick&&<div className="product-detail-screen"><div className="product-detail-head"><button className="detail-back" onClick={goBack} aria-label="Orqaga"><Icon name="back" size={22}/></button><span>Mahsulot</span><button className={"detail-fav "+(favs.includes(quick!.id)?"liked":"")} onClick={()=>toggleFav(quick!.id)} aria-label="Sevimliga qo'shish">{favs.includes(quick!.id)?"♥":"♡"}</button></div><section className={"product-detail "+(quick!.promoPrice!=null?"sale-product-detail":"")}><div className="detail-gallery" aria-label="Mahsulot rasmlari"><div className="detail-gallery-desktop"><div className="detail-thumbs-vertical">{productImages(quick).map((src,i)=><button key={"desk-"+src+i} className={quickImageIndex===i?"active":""} onClick={()=>setQuickImageIndex(i)} aria-label={"Rasm "+(i+1)}><img src={src} alt="" loading={i===0?"eager":"lazy"}/></button>)}</div><div className="detail-main-image">{productImages(quick).length?<img src={productImages(quick)[quickImageIndex]||productImages(quick)[0]} alt={quick!.name+" — rasm "+(quickImageIndex+1)} loading="eager"/>:<div className="detail-scroll-empty">MYBUSINESS</div>}{productImages(quick).length>1&&<><button className="detail-gallery-arrow prev" onClick={()=>setQuickImageIndex(i=>(i-1+productImages(quick).length)%productImages(quick).length)} aria-label="Oldingi rasm">‹</button><button className="detail-gallery-arrow next" onClick={()=>setQuickImageIndex(i=>(i+1)%productImages(quick).length)} aria-label="Keyingi rasm">›</button><span className="detail-image-counter">{quickImageIndex+1}/{productImages(quick).length}</span></>}</div></div><div className="detail-gallery-mobile"><div className="detail-mobile-track" onScroll={e=>{const el=e.currentTarget;const width=el.clientWidth;const next=width?Math.round(el.scrollLeft/width):0;if(next!==quickImageIndex)setQuickImageIndex(Math.min(next,Math.max(0,productImages(quick).length-1)));}}>{productImages(quick).length?productImages(quick).map((src,i)=><div className="detail-mobile-slide" key={"mob-"+src+i}><img src={src} alt={quick!.name+" — rasm "+(i+1)} loading={i===0?"eager":"lazy"}/></div>):<div className="detail-scroll-empty">MYBUSINESS</div>}</div>{productImages(quick).length>1&&<div className="detail-mobile-controls"><button onClick={()=>setQuickImageIndex(i=>Math.max(0,i-1))} aria-label="Oldingi rasm">‹</button><div className="detail-mobile-dots">{productImages(quick).map((_,i)=><button key={i} className={quickImageIndex===i?"active":""} onClick={()=>document.querySelector(".detail-mobile-track")?.scrollTo({left:i*(document.querySelector(".detail-mobile-track") as HTMLElement).clientWidth,behavior:"smooth"})} aria-label={"Rasm "+(i+1)}/>)}</div><button onClick={()=>setQuickImageIndex(i=>Math.min(productImages(quick).length-1,i+1))} aria-label="Keyingi rasm">›</button></div>}</div></div><div className="detail-info"><div className="detail-category">{label(cat(quick))}</div><h1>{quick!.name}</h1><div className="detail-meta"><span className="detail-stock">{quick!.stock>0?"Sotuvda":"Tugagan"}</span><span>Mahsulot ID: {quick!.id}</span></div><div className="detail-price">{quick!.promoPrice!=null?<><s className="old-price">{money(quick!.price)}</s><strong className="promo-price">{money(quick!.promoPrice)}</strong></>:money(quick!.price)}</div><p className="detail-description">{quick!.description||"Mahsulot tavsifi kiritilmagan."}</p><div className="detail-block"><b>Mahsulot haqida</b><span>Kategoriya: {label(cat(quick))}</span><span>{quick!.stock>0?"Omborda "+quick!.stock+" dona mavjud":"Hozircha mavjud emas"}</span></div><div className="detail-actions"><div className="detail-purchase-row"><button className="detail-ask" onClick={()=>askSeller(quick)}>Sotuvchidan so'rash</button>{cart[quick!.id]?<div className="detail-qty"><button onClick={()=>qty(quick!.id,-1)} aria-label="Kamaytirish">−</button><b>{cart[quick!.id]}</b><button onClick={()=>qty(quick!.id,1)} disabled={!(quick!.stock>0)||((cart[quick!.id]||0)>=quick!.stock)} aria-label="Ko'paytirish">+</button></div>:<button className="detail-add" disabled={!quick!.stock} onClick={()=>add(quick)}><Icon name="cart" size={19}/><span>{quick!.stock?"Savatga qo'shish":"Tugagan"}</span></button>}</div></div></div></section></div>}
    {authOpen&&<div className="auth-overlay" onClick={goBack}><section className="auth-modal telegram-auth-modal" onClick={e=>e.stopPropagation()}><button className="auth-close" onClick={goBack} aria-label="Yopish"><Icon name="close" size={20}/></button><span className="eyebrow">MYBUSINESS MARKET</span>{authStatus==="verified"?<><h2>Telefon tasdiqlandi</h2><p>Endi ismingizni kiriting. Shu ma'lumot bilan MyBusiness akkauntingiz yaratiladi yoki mavjud akkauntingizga kirasiz.</p><div className="auth-name-fields"><input value={authFirstName} onChange={e=>setAuthFirstName(e.target.value)} placeholder="Ism" autoComplete="given-name"/><input value={authLastName} onChange={e=>setAuthLastName(e.target.value)} placeholder="Familiya" autoComplete="family-name"/></div><button className="primary full" onClick={completeTelegramAuth}>Kirish / ro'yxatdan o'tish</button></>:authStatus==="expired"?<><h2>Sessiya tugadi</h2><p>Telegram ulanish sessiyasi 10 daqiqadan keyin tugaydi.</p><button className="primary full" onClick={startTelegramAuth}>Telegram orqali qayta ulash</button></>:<><h2>Kirish yoki ro'yxatdan o'tish</h2><p>Telefon raqamingizni xavfsiz tasdiqlash uchun Telegram orqali ulaning.</p><button className="telegram-auth-button" onClick={startTelegramAuth}>Telegram orqali ulash</button><div className="auth-flow-note">{authStatus==="waiting"?"Telegram ochiladi. Botda Start → Raqamni yuborish tugmalarini bosing, so'ng MyBusiness'ga qayting.":"Telegram bot orqali raqamingizni tasdiqlash uchun davom eting."}</div></>}{authError&&<div className="auth-error">{authError}</div>}</section></div>}
    {chatProduct&&<div className="chat-overlay"><section className="chat-screen"><header className="chat-head"><button onClick={goBack} aria-label="Orqaga"><Icon name="back" size={22}/></button><div className="chat-head-product"><span className="chat-head-thumb">{productImages(chatProduct)[0]?<img src={productImages(chatProduct)[0]} alt=""/>:<span>MB</span>}</span><span className="chat-head-copy"><b>{chatProduct.name}</b><span>Sotuvchi bilan chat · {chatMessages.length} ta xabar</span></span></div><span className="chat-online">●</span></header><div className="chat-messages"><div className="chat-empty-product"><div>{productImages(chatProduct)[0]?<img src={productImages(chatProduct)[0]} alt=""/>:<span>MB</span>}</div><b>{chatProduct.name}</b><span>{money(chatProduct.price)}</span></div>{!chatMessages.length&&<div className="chat-bubble system">Mahsulot haqida savolingizni yozing — sotuvchi shu paneldan javob beradi.</div>}{chatMessages.map(m=><div key={m.id} className={"chat-message-row "+(m.senderRole==="customer"?"mine":"theirs")}><div className={"chat-message-avatar "+(m.senderRole==="customer"?"mine":"seller")}>{m.senderRole==="customer"?"S":"M"}</div><div className={"chat-bubble "+(m.senderRole==="customer"?"customer":"seller")}><small className="chat-sender">{m.senderRole==="customer"?"Siz":"Sotuvchi"}</small><span>{m.body}</span><small>{new Intl.DateTimeFormat("uz-UZ",{hour:"2-digit",minute:"2-digit"}).format(new Date(m.createdAt))}</small></div></div>)}</div><form className="chat-composer" onSubmit={e=>{e.preventDefault();void sendChatMessage()}}><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Xabar yozing..." disabled={chatLoading}/><button className="primary" disabled={!chatInput.trim()||chatLoading} aria-label="Yuborish">➤</button></form></section></div>}
    {checkoutOpen&&<div className="auth-overlay" onClick={goBack}><section className="auth-modal checkout-modal" onClick={e=>e.stopPropagation()}><button className="auth-close" onClick={goBack} aria-label="Yopish"><Icon name="close" size={20}/></button><span className="eyebrow">MYBUSINESS MARKET</span><h2>Buyurtmani rasmiylashtirish</h2><p>{cartItems.length} ta mahsulot · {money(cartTotal)}</p><form onSubmit={submitCheckout}><div className="checkout-summary"><span>{cartItems.length} ta mahsulot</span><strong>{money(cartTotal)}</strong></div><div className="auth-name-fields"><input required value={checkoutName} onChange={e=>setCheckoutName(e.target.value)} placeholder="Ism" autoComplete="name"/><input required value={checkoutPhone} onChange={e=>setCheckoutPhone(e.target.value)} placeholder="Telefon raqami" inputMode="tel" autoComplete="tel"/></div><textarea className="checkout-address" required value={checkoutAddress} onChange={e=>setCheckoutAddress(e.target.value)} placeholder="Yetkazib berish manzili" rows={3}/><div className="payment-title">To'lov turi</div><div className="payment-options"><button type="button" className={checkoutPayment==="cash"?"selected":""} onClick={()=>setCheckoutPayment("cash")}><span>💵</span><div><b>Naqd</b><small>Hozir faol</small></div><i>{checkoutPayment==="cash"?"✓":"○"}</i></button><button type="button" className="disabled" disabled><span>💳</span><div><b>Karta</b><small>Tez orada</small></div><i>○</i></button><button type="button" className="disabled" disabled><span>◫</span><div><b>Qarz</b><small>Tez orada</small></div><i>○</i></button></div><button className="primary full checkout-submit" disabled={checkoutLoading}>{checkoutLoading?"Yuborilmoqda...":"Buyurtmani tasdiqlash · "+money(cartTotal)}</button>{checkoutError&&<div className="auth-error">{checkoutError}</div>}</form></section></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);


