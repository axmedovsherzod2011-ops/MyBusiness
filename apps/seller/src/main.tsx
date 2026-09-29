import { FormEvent, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createRoot } from "react-dom/client";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";
const emptyForm = { name: "", sku: "", description: "", price: "", stock: "0", imageUrl: "", imageUrls: [] as string[] };

type OrderItem = { id:number; productId:number|null; productName:string; sku?:string; imageUrl?:string; price:number; quantity:number };
type Order = {
  id:number; customerUserId:number|null; customerName:string; customerPhone:string; status:string; total:number; paymentMethod?:string; deliveryAddress?:string;
  createdAt:string; updatedAt:string; items:OrderItem[];
};
type Chat = {
  id:number; customerUserId:number|null; customerName:string; productId:number|null; status:string;
  productName?:string; productImageUrl?:string; lastMessage:string; messageCount:number; updatedAt:string;
  hasUnreadForSeller?:boolean; sellerLastReadAt?:string|null;
};
type ChatMessage = { id:number; senderRole:"customer"|"seller"; body:string; createdAt:string };
type Banner = { id:number; desktopImageUrl:string; mobileImageUrl:string; active:boolean; sortOrder:number; createdAt:string; targetType:string; targetValue:string };
type LandingPage = { id:number; slug:string; title:string; subtitle:string; description:string; offerText:string; productIds:number[]; active:boolean };
const statusLabels:Record<string,string> = {
  new:"Yangi", confirmed:"Qabul qilindi", preparing:"Tayyorlanmoqda",
  shipping:"Yetkazilmoqda", completed:"Yakunlangan", cancelled:"Bekor qilingan"
};
const nextStatus:Record<string,string> = {new:"confirmed",confirmed:"preparing",preparing:"shipping",shipping:"completed"};

const priceFormatter=new Intl.NumberFormat("uz-UZ");
const dateFormatter=new Intl.DateTimeFormat("uz-UZ",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
function formatPrice(price:number){return priceFormatter.format(Number(price))+ " so'm";}
function formatDate(value:string){return dateFormatter.format(new Date(value));}
function formatAnalyticsDay(value:string){const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[3]}/${match[2]}/${match[1]}`:String(value);}

const routeToTab:Record<string,string>={dashboard:"overview",products:"products","mahsulotlar":"products","buyurtmalar":"orders",chatlar:"chats",ombor:"inventory",marketing:"marketing",analitika:"analytics","mahsulot-qoshish":"add"};
const tabToRoute:Record<string,string>={overview:"dashboard",products:"mahsulotlar",orders:"buyurtmalar",chats:"chatlar",inventory:"ombor",marketing:"marketing",analytics:"analitika",add:"mahsulot-qoshish"};
function pathForTab(value:string){return "/xaccount/"+(tabToRoute[value]||"dashboard");}
function tabFromLocation(){const match=window.location.pathname.match(/^\/xaccount\/([^/]+)/i);return match?routeToTab[decodeURIComponent(match[1])]||"overview":"overview";}
function routeModal(){const parts=window.location.pathname.split("/").filter(Boolean);if(parts[0]!=="xaccount")return null;if(parts[1]==="mahsulotlar"&&parts[2]==="edit"&&parts[3])return {kind:"edit",id:Number(parts[3])};if(parts[1]==="mahsulotlar"&&parts[2]==="delete"&&parts[3])return {kind:"delete",id:Number(parts[3])};if(parts[1]==="marketing"&&parts[2]==="aksiya"&&parts[3])return {kind:"promo",id:Number(parts[3])};return null;}

export default function App(){
  const [products,setProducts]=useState<Product[]>([]);
  const [orders,setOrders]=useState<Order[]>([]);
  const [chats,setChats]=useState<Chat[]>([]);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [activeChat,setActiveChat]=useState<number|null>(null);
  const [selectedOrder,setSelectedOrder]=useState<number|null>(null);
  const [lastSeenNewOrders,setLastSeenNewOrders]=useState(0);
  const [notification,setNotification]=useState("");
  const [chatText,setChatText]=useState("");
  const [form,setForm]=useState(emptyForm);
  const [query,setQuery]=useState("");
  const [tab,setTab]=useState("overview");
  const [pendingNavigation,setPendingNavigation]=useState<string|null>(null);
  const [inventorySaving,setInventorySaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [ordersLoading,setOrdersLoading]=useState(true);
  const [chatsLoading,setChatsLoading]=useState(true);
  const [messagesLoading,setMessagesLoading]=useState(false);
  const [analyticsLoading,setAnalyticsLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [refreshLoading,setRefreshLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [liveTick,setLiveTick]=useState(0);
  const [orderFilter,setOrderFilter]=useState<"all"|"new"|"active"|"completed">("all");
  const [lastSync,setLastSync]=useState<Date|null>(null);
  const [editing,setEditing]=useState<Product|null>(null);
  const [stockDraft,setStockDraft]=useState<Record<number,string>>({});
  const inventoryOriginalRef=useRef<Record<number,number>>({});
  const [analytics,setAnalytics]=useState<any|null>(null);
  const [promoProduct,setPromoProduct]=useState<Product|null>(null);
  const [promoDiscount,setPromoDiscount]=useState("10");
  const [promoEndsAt,setPromoEndsAt]=useState("");
  const [imageUrlInput,setImageUrlInput]=useState("");
  const [deleteProductTarget,setDeleteProductTarget]=useState<Product|null>(null);
  const [deleteLoading,setDeleteLoading]=useState(false);
  const [editingImageLoading,setEditingImageLoading]=useState(false);
  const [banners,setBanners]=useState<Banner[]>([]);
  const [bannerLoading,setBannerLoading]=useState(true);
  const [bannerSaving,setBannerSaving]=useState(false);
  const [bannerDesktopUrl,setBannerDesktopUrl]=useState("");
  const [bannerMobileUrl,setBannerMobileUrl]=useState("");
  const [bannerTargetType,setBannerTargetType]=useState("all-products");
  const [bannerTargetValue,setBannerTargetValue]=useState("");
  const [landingPages,setLandingPages]=useState<LandingPage[]>([]);
  const [pageEditorOpen,setPageEditorOpen]=useState(false);
  const [pageSaving,setPageSaving]=useState(false);
  const [pageTitle,setPageTitle]=useState("");
  const [pageSubtitle,setPageSubtitle]=useState("");
  const [pageDescription,setPageDescription]=useState("");
  const [pageOfferText,setPageOfferText]=useState("");
  const [pageProductIds,setPageProductIds]=useState<number[]>([]);

  const inventoryDirtyIds=useMemo(()=>Object.keys(stockDraft).filter(id=>{const productId=Number(id);const product=products.find(p=>p.id===productId);const original=inventoryOriginalRef.current[productId];return product&&Number(stockDraft[productId])!==Number(original??product.stock)}).map(Number),[products,stockDraft]);
  const inventoryDirtyCount=inventoryDirtyIds.length;
  const tabRef=useRef(tab);
  const dirtyCountRef=useRef(inventoryDirtyCount);
  useEffect(()=>{tabRef.current=tab;dirtyCountRef.current=inventoryDirtyCount;},[tab,inventoryDirtyCount]);
  useEffect(()=>{
    const modal=routeModal();
    if(!modal||!products.length)return;
    const product=products.find(p=>p.id===modal.id);
    if(!product)return;
    if(modal.kind==="edit"){setEditing(product);setPromoProduct(null);setDeleteProductTarget(null);}
    else if(modal.kind==="promo"){setPromoProduct(product);setEditing(null);setDeleteProductTarget(null);}
    else{setDeleteProductTarget(product);setEditing(null);setPromoProduct(null);}
  },[products]);

  function syncRoute(){const next=tabFromLocation();setTab(next);}
  function requestNavigation(nextTab:string){
    const nextPath=pathForTab(nextTab);
    if(window.location.pathname===nextPath)return;
    if(tabRef.current==="inventory"&&dirtyCountRef.current>0){setPendingNavigation(nextPath);return;}
    window.history.pushState({},"",nextPath);syncRoute();
  }
  function completePendingNavigation(save:boolean){
    const nextPath=pendingNavigation;
    if(!nextPath)return;
    if(save){void saveAllStock(nextPath);return;}
    const originals=inventoryOriginalRef.current;
    setProducts(current=>current.map(product=>Object.prototype.hasOwnProperty.call(originals,product.id)?{...product,stock:originals[product.id]}:product));
    inventoryOriginalRef.current={};
    setStockDraft({});
    setPendingNavigation(null);
    window.history.pushState({},"",nextPath);
    syncRoute();
  }

  async function api(path:string, options:RequestInit={}) {
    const r=await fetch(apiBase+path,{...options,headers:{"Accept":"application/json","Content-Type":"application/json",...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message||"Server xatosi.");
    return d;
  }
  async function loadProducts(){setLoading(true);try{const d=await api("/api/v1/products");setProducts((d as ProductsResponse).products)}catch(e){setMessage(e instanceof Error?e.message:"Mahsulotlarni yuklab bo'lmadi.")}finally{setLoading(false)}}
  async function loadOrders(){setOrdersLoading(true);try{const d=await api("/api/v1/orders");const next=(d.orders||[]) as Order[];setOrders(next);return next}catch(e){setMessage(e instanceof Error?e.message:"Buyurtmalarni yuklab bo'lmadi.");return [] as Order[]}finally{setOrdersLoading(false)}}
  async function loadChats(){setChatsLoading(true);try{const d=await api("/api/v1/chats");setChats(d.chats||[])}catch(e){setMessage(e instanceof Error?e.message:"Chatlarni yuklab bo'lmadi.")}finally{setChatsLoading(false)}}
  async function loadBanners(){setBannerLoading(true);try{const d=await api("/api/v1/banners/manage");setBanners(d.banners||[])}catch(e){setMessage(e instanceof Error?e.message:"Bannerlarni yuklab bo'lmadi.")}finally{setBannerLoading(false)}}
  async function loadLandingPages(){try{const d=await api("/api/v1/landing-pages/manage");setLandingPages(d.pages||[])}catch(e){setMessage(e instanceof Error?e.message:"Sahifalarni yuklab bo'lmadi.")}}
  async function createLandingPage(){
    if(!pageTitle.trim()){setMessage("Sahifa nomini kiriting.");return;}
    try{setPageSaving(true);const d=await api("/api/v1/landing-pages",{method:"POST",body:JSON.stringify({title:pageTitle,subtitle:pageSubtitle,description:pageDescription,offerText:pageOfferText,productIds:pageProductIds})});setLandingPages(x=>[d.page,...x]);setBannerTargetType("page");setBannerTargetValue(d.page.slug);setPageEditorOpen(false);setPageTitle("");setPageSubtitle("");setPageDescription("");setPageOfferText("");setPageProductIds([]);setMessage("Yangi sahifa yaratildi.");}
    catch(e){setMessage(e instanceof Error?e.message:"Sahifani yaratib bo'lmadi.");}finally{setPageSaving(false)}
  }
  async function toggleLandingPage(p:LandingPage){try{const d=await api("/api/v1/landing-pages/"+p.id,{method:"PATCH",body:JSON.stringify({active:!p.active})});setLandingPages(x=>x.map(v=>v.id===p.id?d.page:v));}catch(e){setMessage(e instanceof Error?e.message:"Sahifa holatini o'zgartirib bo'lmadi.")}}
  async function deleteLandingPage(p:LandingPage){if(!confirm("Bu sahifani o'chirishga aminmisiz?"))return;try{await api("/api/v1/landing-pages/"+p.id,{method:"DELETE"});setLandingPages(x=>x.filter(v=>v.id!==p.id));if(bannerTargetValue===p.slug){setBannerTargetType("all-products");setBannerTargetValue("")}setMessage("Sahifa o'chirildi.");}catch(e){setMessage(e instanceof Error?e.message:"Sahifani o'chirib bo'lmadi.")}}
  async function refreshAll(){
    if(refreshLoading)return;
    setRefreshLoading(true);
    setMessage("");
    try{
      const results=await Promise.allSettled([loadProducts(),loadOrders(),loadChats(),loadBanners()]);
      const orderResult=results[1];
      if(orderResult.status==="fulfilled"){
        const next=orderResult.value;
        const incoming=next.filter(o=>o.status==="new").length;
        if(lastSeenNewOrders>0 && incoming>lastSeenNewOrders){
          setNotification(`Yangi buyurtma keldi: ${incoming-lastSeenNewOrders} ta`);
          requestNavigation("orders");
        }
        setLastSeenNewOrders(incoming);
      }
      if(analytics)await loadAnalytics();
      setLiveTick(x=>x+1);
      setLastSync(new Date());
    }finally{
      setRefreshLoading(false);
    }
  }

  useEffect(()=>{
    syncRoute();
    const onPop=()=>{
      if(tabRef.current==="inventory"&&dirtyCountRef.current>0){
        const current=window.location.pathname;
        window.history.pushState({},"",pathForTab("inventory"));
        setPendingNavigation(current);
        return;
      }
      syncRoute();
    };
    window.addEventListener("popstate",onPop);
    void loadProducts(); void loadOrders(); void loadChats(); void loadBanners(); void loadLandingPages(); void loadAnalytics();
    const timer=window.setInterval(()=>{void refreshAll()},300000);
    return()=>{window.clearInterval(timer);window.removeEventListener("popstate",onPop);};
  },[]);

  async function openChat(id:number){
    setActiveChat(id);requestNavigation("chats");
    try{
      setMessagesLoading(true);
      await api("/api/v1/chats/"+id+"/read",{method:"POST"});
      setChats(x=>x.map(c=>c.id===id?{...c,hasUnreadForSeller:false,sellerLastReadAt:new Date().toISOString()}:c));
      const d=await api("/api/v1/chats/"+id+"/messages");setMessages(d.messages||[]);
    }catch(e){setMessage(e instanceof Error?e.message:"Xabarlarni yuklab bo'lmadi.")}finally{setMessagesLoading(false)}
  }
  useEffect(()=>{
    if(!activeChat)return;
    const timer=window.setInterval(async()=>{try{setMessagesLoading(true);const d=await api("/api/v1/chats/"+activeChat+"/messages");setMessages(d.messages||[])}catch{}finally{setMessagesLoading(false)}},300000);
    return()=>window.clearInterval(timer);
  },[activeChat]);
  async function sendChat(e:FormEvent){e.preventDefault();const text=chatText.trim();if(!activeChat||!text)return;try{const d=await api("/api/v1/chats/"+activeChat+"/messages",{method:"POST",body:JSON.stringify({message:text,senderRole:"seller"})});setMessages(x=>[...x,d.message]);setChatText("");await loadChats()}catch(e){setMessage(e instanceof Error?e.message:"Xabar yuborilmadi.")}}
  async function openOrderChat(order:Order){
    const match=chats.find(c=>c.customerUserId===order.customerUserId && (order.items.length===0 || c.productId===order.items[0]?.productId))
      || chats.find(c=>c.customerUserId===order.customerUserId)
      || chats.find(c=>c.customerName===order.customerName);
    if(match){await openChat(match.id);return;}
    setMessage("Bu mijoz uchun hali chat ochilmagan.");
    requestNavigation("chats");
  }
  async function changeStatus(order:Order,status:string){try{const d=await api("/api/v1/orders/"+order.id+"/status",{method:"PATCH",body:JSON.stringify({status})});setOrders(x=>x.map(o=>o.id===order.id?d.order:o))}catch(e){setMessage(e instanceof Error?e.message:"Holatni o'zgartirib bo'lmadi.")}}

  function firstImage(value:string){return value.split(/[\n|,]+/).map(x=>x.trim()).filter(Boolean)[0]||"";}
  async function uploadImage(file:File):Promise<string>{
    const r=await fetch(apiBase+"/api/v1/uploads/product-image",{method:"POST",headers:{"Content-Type":file.type},body:file});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message||"Rasmni storage'ga yuklab bo'lmadi.");
    return String(d.image?.url||"");
  }
  async function handleImageFile(file:File){
    if(!file.type.startsWith("image/")){setMessage("Faqat rasm fayli tanlang.");return;}
    if(file.size>12*1024*1024){setMessage("Rasm 12 MB dan kichik bo'lishi kerak.");return;}
    try{
      const normalized=await new Promise<Blob>((resolve,reject)=>{
        const source=URL.createObjectURL(file);
        const img=new Image();
        img.onload=()=>{
          URL.revokeObjectURL(source);
          const canvas=document.createElement("canvas");
          canvas.width=1080; canvas.height=1440;
          const ctx=canvas.getContext("2d");
          if(!ctx){reject(new Error("Rasm canvas tayyorlanmadi."));return;}
          ctx.fillStyle="#fff";ctx.fillRect(0,0,1080,1440);
          const scale=Math.min(1080/img.naturalWidth,1440/img.naturalHeight);
          const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
          ctx.drawImage(img,(1080-width)/2,(1440-height)/2,width,height);
          canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Rasmni tayyorlab bo'lmadi.")),"image/jpeg",0.9);
        };
        img.onerror=()=>{URL.revokeObjectURL(source);reject(new Error("Rasmni ochib bo'lmadi."));};
        img.src=source;
      });
      const storedUrl=await uploadImage(new File([normalized],file.name.replace(/\\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}));
      setForm(x=>({...x,imageUrl:x.imageUrls[0]||storedUrl,imageUrls:[...x.imageUrls,storedUrl]}));
      setMessage("Rasm yuklandi. Yana bir nechta rasm qo'shishingiz mumkin.");
    }catch(e){setMessage(e instanceof Error?e.message:"Rasmni yuklab bo'lmadi.");}
  }
  function onImageDrop(e:DragEvent<HTMLDivElement>){
    e.preventDefault();
    const files=Array.from(e.dataTransfer.files||[]);
    void Promise.all(files.map(handleImageFile));
  }
  async function removeImage(url:string){
    setForm(x=>({...x,imageUrls:x.imageUrls.filter(v=>v!==url),imageUrl:x.imageUrls.filter(v=>v!==url)[0]||""}));
    try{await api("/api/v1/uploads/product-image",{method:"DELETE",body:JSON.stringify({url})});}catch{}
  }
  function addImageUrl(){
    const url=imageUrlInput.trim();
    if(!/^https?:\/\//i.test(url)){setMessage("Rasm URL'i http:// yoki https:// bilan boshlanishi kerak.");return;}
    if(form.imageUrls.includes(url)){setImageUrlInput("");return;}
    if(form.imageUrls.length>=12){setMessage("Ko'pi bilan 12 ta rasm qo'shish mumkin.");return;}
    setForm(x=>({...x,imageUrl:x.imageUrls[0]||url,imageUrls:[...x.imageUrls,url]}));
    setImageUrlInput("");
  }

  async function uploadBannerFile(file:File,width:number,height:number):Promise<string>{
    if(!file.type.startsWith("image/"))throw new Error("Faqat rasm fayli tanlang.");
    if(file.size>12*1024*1024)throw new Error("Rasm 12 MB dan kichik bo'lishi kerak.");
    const normalized=await new Promise<Blob>((resolve,reject)=>{
      const src=URL.createObjectURL(file);const img=new Image();
      img.onload=()=>{URL.revokeObjectURL(src);const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("Canvas tayyorlanmadi."));return;}
        ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
        const scale=Math.min(width/img.naturalWidth,height/img.naturalHeight);const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
        ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
        canvas.toBlob(b=>b?resolve(b):reject(new Error("Rasmni tayyorlab bo'lmadi.")),"image/jpeg",.92);
      };img.onerror=()=>{URL.revokeObjectURL(src);reject(new Error("Rasmni ochib bo'lmadi."));};img.src=src;
    });
    return uploadImage(new File([normalized],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}));
  }
  async function createBanner(){
    if(!bannerDesktopUrl||!bannerMobileUrl){setMessage("Avval desktop va mobile banner rasmlarini yuklang.");return;}
    if(["category","page","url"].includes(bannerTargetType)&&!bannerTargetValue){setMessage("Banner qayerga olib borishini tanlang.");return;}
    try{setBannerSaving(true);const d=await api("/api/v1/banners",{method:"POST",body:JSON.stringify({desktopImageUrl:bannerDesktopUrl,mobileImageUrl:bannerMobileUrl,sortOrder:banners.length,targetType:bannerTargetType,targetValue:bannerTargetValue})});
      setBanners(x=>[...x,d.banner]);setBannerDesktopUrl("");setBannerMobileUrl("");setMessage("Banner customer saytiga joylandi.");
    }catch(e){setMessage(e instanceof Error?e.message:"Bannerni saqlab bo'lmadi.");}finally{setBannerSaving(false)}
  }
  async function toggleBanner(b:Banner){
    try{const d=await api("/api/v1/banners/"+b.id,{method:"PATCH",body:JSON.stringify({active:!b.active})});setBanners(x=>x.map(v=>v.id===b.id?d.banner:v));}
    catch(e){setMessage(e instanceof Error?e.message:"Banner holatini o'zgartirib bo'lmadi.")}
  }
  async function deleteBanner(b:Banner){
    if(!confirm("Bu bannerni o'chirishga aminmisiz?"))return;
    try{await api("/api/v1/banners/"+b.id,{method:"DELETE"});setBanners(x=>x.filter(v=>v.id!==b.id));setMessage("Banner o'chirildi.");}
    catch(e){setMessage(e instanceof Error?e.message:"Bannerni o'chirib bo'lmadi.")}
  }

  async function uploadEditingImage(file:File){
    if(!editing||editingImageLoading)return;
    if(!file.type.startsWith("image/")){setMessage("Faqat rasm fayli tanlang.");return;}
    if(file.size>12*1024*1024){setMessage("Rasm 12 MB dan kichik bo'lishi kerak.");return;}
    try{
      setEditingImageLoading(true);
      const normalized=await new Promise<Blob>((resolve,reject)=>{
        const source=URL.createObjectURL(file); const img=new Image();
        img.onload=()=>{URL.revokeObjectURL(source);const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1440;
          const ctx=canvas.getContext("2d"); if(!ctx){reject(new Error("Rasm canvas tayyorlanmadi."));return;}
          ctx.fillStyle="#fff";ctx.fillRect(0,0,1080,1440);const scale=Math.min(1080/img.naturalWidth,1440/img.naturalHeight);
          const w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(1080-w)/2,(1440-h)/2,w,h);
          canvas.toBlob(b=>b?resolve(b):reject(new Error("Rasmni tayyorlab bo'lmadi.")),"image/jpeg",0.9);
        }; img.onerror=()=>{URL.revokeObjectURL(source);reject(new Error("Rasmni ochib bo'lmadi."));}; img.src=source;
      });
      const url=await uploadImage(new File([normalized],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}));
      setEditing(p=>p?{...p,imageUrl:p.imageUrls?.[0]||url,imageUrls:[...(p.imageUrls||[]),url]}:p);
    }catch(e){setMessage(e instanceof Error?e.message:"Rasmni yuklab bo'lmadi.");}
    finally{setEditingImageLoading(false)}
  }
  function removeEditingImage(url:string){
    setEditing(p=>{if(!p)return p;const urls=(p.imageUrls||[]).filter(x=>x!==url);return {...p,imageUrls:urls,imageUrl:urls[0]||""};});
    void api("/api/v1/uploads/product-image",{method:"DELETE",body:JSON.stringify({url})}).catch(()=>{});
  }
  function reorderEditingImage(from:number,to:number){
    setEditing(p=>{if(!p)return p;const urls=[...(p.imageUrls||[])];if(from===to||!urls[from]||to<0||to>=urls.length)return p;
      const moved=urls[from];if(!moved)return p;urls.splice(from,1);urls.splice(to,0,moved);return {...p,imageUrls:urls,imageUrl:urls[0]||""};});
  }
  function addEditingImageUrl(){
    const url=imageUrlInput.trim(); if(!editing)return;
    if(!/^https?:\/\//i.test(url)){setMessage("Rasm URL'i http:// yoki https:// bilan boshlanishi kerak.");return;}
    const urls=editing.imageUrls||[]; if(urls.includes(url)){setImageUrlInput("");return;}
    if(urls.length>=12){setMessage("Ko'pi bilan 12 ta rasm qo'shish mumkin.");return;}
    setEditing({...editing,imageUrls:[...urls,url],imageUrl:urls[0]||url});setImageUrlInput("");
  }

  async function saveProduct(product:Product){
    const normalizedSku=String(product.sku??"").trim().toUpperCase();
    if(!normalizedSku){setMessage("SKU kiriting.");return;}
    if(!/^[A-Z0-9._-]+$/.test(normalizedSku)){setMessage("SKU faqat harf, raqam, -, _, . belgilaridan iborat bo'lishi mumkin.");return;}
    product={...product,sku:normalizedSku};
    try{
      setSaving(true);
      const d=await api("/api/v1/products/"+product.id,{method:"PATCH",body:JSON.stringify({
        name:product.name,sku:product.sku,description:product.description,price:product.price,stock:product.stock,imageUrl:product.imageUrls?.[0]||product.imageUrl,imageUrls:product.imageUrls||[]
      })});
      setProducts(x=>x.map(p=>p.id===product.id?d.product:p)); setEditing(null);window.history.pushState({},"",pathForTab("products"));syncRoute(); setMessage("Mahsulot yangilandi.");
    }catch(e){setMessage(e instanceof Error?e.message:"Mahsulotni yangilab bo'lmadi.")}
    finally{setSaving(false)}
  }
  async function deleteProduct(product:Product){
    if(deleteLoading)return;
    setDeleteLoading(true);
    setMessage("");
    try{
      await api("/api/v1/products/"+product.id,{method:"DELETE"});
      setProducts(x=>x.filter(p=>p.id!==product.id));
      setDeleteProductTarget(null);window.history.pushState({},"",pathForTab("products"));syncRoute();
      setMessage("Mahsulot o'chirildi.");
    }catch(e){setMessage(e instanceof Error?e.message:"Mahsulotni o'chirib bo'lmadi.");}
    finally{setDeleteLoading(false);}
  }
  async function saveAllStock(nextPath?:string){
    if(inventorySaving||inventoryDirtyCount===0){if(nextPath){setPendingNavigation(null);window.history.pushState({},"",nextPath);syncRoute();}return;}
    setInventorySaving(true);setMessage("");
    const changes=inventoryDirtyIds.map(id=>{const p=products.find(item=>item.id===id);return p?{product:p,value:Math.max(0,Math.floor(Number(stockDraft[id])))}:null}).filter(Boolean) as Array<{product:Product;value:number}>;
    if(changes.some(x=>!Number.isFinite(x.value))){setMessage("Ombor sonini tekshiring.");setInventorySaving(false);return;}
    try{
      const results=await Promise.all(changes.map(async ({product,value})=>({id:product.id,data:await api("/api/v1/products/"+product.id,{method:"PATCH",body:JSON.stringify({...product,stock:value})})})));
      setProducts(current=>current.map(product=>{const result=results.find(x=>x.id===product.id);return result?.data?.product||product;}));
      inventoryOriginalRef.current={};
      setStockDraft({});setMessage(changes.length+" ta mahsulot qoldig'i saqlandi.");
      const destination=nextPath||pendingNavigation;
      if(destination){setPendingNavigation(null);window.history.pushState({},"",destination);syncRoute();}
    }catch(e){setMessage(e instanceof Error?e.message:"Ombor o'zgarishlarini saqlab bo'lmadi.");}
    finally{setInventorySaving(false)}
  }
  function cancelAllStock(){
    const originals=inventoryOriginalRef.current;
    setProducts(current=>current.map(product=>Object.prototype.hasOwnProperty.call(originals,product.id)?{...product,stock:originals[product.id]}:product));
    inventoryOriginalRef.current={};
    setStockDraft({});
    setMessage("Ombor o'zgarishlari bekor qilindi.");
  }
  async function loadAnalytics(){
    setAnalyticsLoading(true);
    try{const d=await api("/api/v1/analytics/summary?days=30");setAnalytics(d);}
    catch(e){setMessage(e instanceof Error?e.message:"Analitikani yuklab bo'lmadi.")}
    finally{setAnalyticsLoading(false)}
  }
  async function savePromotion(){
    if(!promoProduct)return;
    try{
      await api("/api/v1/products/"+promoProduct.id+"/promotion",{method:"PUT",body:JSON.stringify({
        discountPercent:Number(promoDiscount),endsAt:promoEndsAt?new Date(promoEndsAt).toISOString():null
      })});
      await loadProducts();setPromoProduct(null);window.history.pushState({},"",pathForTab("marketing"));syncRoute();setMessage("Aksiya real bazaga saqlandi.");
    }catch(e){setMessage(e instanceof Error?e.message:"Aksiyani saqlab bo'lmadi.")}
  }
  async function stopPromotion(id:number){
    try{await api("/api/v1/products/"+id+"/promotion",{method:"DELETE"});await loadProducts();setMessage("Aksiya to'xtatildi.");}
    catch(e){setMessage(e instanceof Error?e.message:"Aksiyani to'xtatib bo'lmadi.")}
  }

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setMessage("");
    try{
      const d=await api("/api/v1/products",{method:"POST",body:JSON.stringify({
        name:form.name.trim(),sku:form.sku.trim().toUpperCase(),description:form.description.trim(),price:Number(form.price),
        stock:Number(form.stock),imageUrl:form.imageUrls[0]||"",imageUrls:form.imageUrls
      })});
      if(d.product)setProducts(x=>[d.product,...x]);setForm(emptyForm);setMessage("Mahsulot bazaga saqlandi.");requestNavigation("products");
    }catch(err){setMessage(err instanceof Error?err.message:"Saqlashda xatolik.")}finally{setSaving(false)}
  }

  const filtered=useMemo(()=>products.filter(p=>(p.name+" "+p.sku+" "+p.description).toLowerCase().includes(query.toLowerCase())),[products,query]);
  const totalStock=products.reduce((s,p)=>s+p.stock,0);
  const catalogValue=products.reduce((s,p)=>s+p.price*p.stock,0);
  const newOrders=orders.filter(o=>o.status==="new").length;
  const unreadChats=chats.filter(c=>c.status==="open"&&c.hasUnreadForSeller).length;
  const openChats=chats.filter(c=>c.status==="open").length;
  const filteredOrders=orders.filter(o=>orderFilter==="all"?true:orderFilter==="new"?o.status==="new":orderFilter==="active"?["confirmed","preparing","shipping"].includes(o.status):["completed","cancelled"].includes(o.status));
  const selected=selectedOrder===null?null:orders.find(o=>o.id===selectedOrder)||null;
  const nav: Array<[string,string]> = [["overview","Dashboard"],["products","Mahsulotlar"],["orders","Buyurtmalar"],["chats","Chatlar"],["inventory","Ombor"],["marketing","Marketing"],["analytics","Analitika"]];

  const DbSkeleton=()=> <span className="db-skeleton" aria-label="Ma'lumot yuklanmoqda"/>;
  const DbListSkeleton=({rows=5}:{rows?:number})=><div className="db-skeleton-list">{Array.from({length:rows},(_,i)=><div className="db-skeleton-row" key={i}><span/><span/><i/></div>)}</div>;
  const DbTableSkeleton=({rows=7}:{rows?:number})=><div className="db-table-skeleton">{Array.from({length:rows},(_,i)=><div className="db-table-skeleton-row" key={i}><span/><span/><span/><span/></div>)}</div>;

  return <main className="seller-shell">
    <aside className="sidebar">
      <a className="brand" href="/">MYBUSINESS <span>SELLER</span></a>
      <nav>{nav.map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>requestNavigation(id)}>{label}{id==="orders"&&newOrders>0?<i className="nav-count">{newOrders}</i>:id==="chats"&&unreadChats>0?<i className="nav-count">{unreadChats}</i>:null}</button>)}</nav>
      <div className="side-note"><b>Live boshqaruv</b><span>Buyurtmalar, chatlar, mahsulotlar va ombor shu paneldan boshqariladi.</span></div>
    </aside>

    <section className="seller-main">
      <header className="top">
        <div><span className="eyebrow">SELLER CENTER · LIVE v3</span><h1>{tab==="overview"?"Dashboard":nav.find(x=>x[0]===tab)?.[1]}</h1><p>Do'koningizni bitta joydan boshqaring.</p></div>
        <div className="top-actions">{notification&&<button className="notice" onClick={()=>setNotification("")}>🔔 {notification}</button>}<button className="db-refresh-button" onClick={()=>void refreshAll()} disabled={refreshLoading} aria-label="Ma'lumotlarni yangilash">{refreshLoading?<><span className="refresh-spinner" aria-hidden="true"/>Yangilanmoqda...</>:<><span className="refresh-icon" aria-hidden="true">↻</span>Yangilash</>}</button><div className="status">● LIVE DATABASE · {liveTick}{lastSync?` · ${lastSync.toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"})}`:""}</div></div>
      </header>

      {tab==="overview"&&<>
        <div className="stats">
          <div><span>Mahsulotlar</span>{loading?<DbSkeleton/>:<><b>{products.length}</b><small>Real katalog</small></>}</div>
          <div><span>Ombordagi dona</span>{loading?<DbSkeleton/>:<><b>{totalStock}</b><small>{products.filter(p=>p.stock===0).length} ta tugagan</small></>}</div>
          <div className={!ordersLoading&&newOrders?"stat-alert":""}><span>Yangi buyurtmalar</span>{ordersLoading?<DbSkeleton/>:<><b>{newOrders}</b><small>{orders.length} ta jami buyurtma</small></>}</div>
          <div className={!chatsLoading&&openChats?"stat-alert":""}><span>Ochiq chatlar</span>{chatsLoading?<DbSkeleton/>:<><b>{openChats}</b><small>{chats.length} ta suhbat</small></>}</div>
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-head"><div><h2>So'nggi buyurtmalar</h2><span className="muted">Customer saytidan real kelganlar</span></div><button className="secondary small" onClick={()=>requestNavigation("orders")}>Barchasi</button></div>
            {ordersLoading ? <DbListSkeleton rows={5}/> : orders.length ? <div className="recent-orders">{orders.slice(0,5).map(o=><button className="recent-order" key={o.id} onClick={()=>{setSelectedOrder(o.id);requestNavigation("orders")}}>
              <span><b>#{o.id} · {o.customerName}</b><small>{o.customerPhone} · {o.items?.length||0} ta mahsulot</small></span>
              <span><strong>{formatPrice(o.total)}</strong><i className={"status-pill "+o.status}>{statusLabels[o.status]||o.status}</i></span>
            </button>)}</div> : <div className="empty compact-empty"><b>Buyurtmalar hali yo'q</b><span>Customer checkout qilganda shu yerda ko'rinadi.</span></div>}
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Tezkor boshqaruv</h2><span className="muted">Bugungi asosiy ko'rsatkichlar</span></div><span className="ai">LIVE</span></div>
            <div className="overview-list">
              <div><span>Ombor qiymati</span>{loading?<DbSkeleton/>:<b>{formatPrice(catalogValue)}</b>}</div>
              <div><span>Yakunlangan buyurtmalar</span>{ordersLoading?<DbSkeleton/>:<b>{orders.filter(o=>o.status==="completed").length}</b>}</div>
              <div><span>Bekor qilingan</span>{ordersLoading?<DbSkeleton/>:<b>{orders.filter(o=>o.status==="cancelled").length}</b>}</div>
            </div>
            <div className="quick-actions"><button className="primary" onClick={()=>requestNavigation("add")}>+ Yangi mahsulot</button><button className="secondary" onClick={()=>requestNavigation("chats")}>Mijozlar chatini ochish</button></div>
          </section>
        </div>
      </>}

      {tab==="orders"&&(
        <section className="panel">
          <div className="panel-head">
            <div><h2>Buyurtmalar</h2><span className="muted">Customer saytidan kelgan buyurtmalar · {filteredOrders.length} ta</span></div>
            <div className="order-toolbar"><div className="filter-tabs">{([["all","Barchasi"],["new","Yangi"],["active","Jarayonda"],["completed","Yakunlangan"]] as const).map(([id,label])=><button key={id} className={orderFilter===id?"active":""} onClick={()=>setOrderFilter(id)}>{label}</button>)}</div><button className="db-refresh-button small-refresh" onClick={()=>void refreshAll()} disabled={refreshLoading}>{refreshLoading?<><span className="refresh-spinner" aria-hidden="true"/>Yangilanmoqda...</>:<><span className="refresh-icon" aria-hidden="true">↻</span>Yangilash</>}</button></div>
          </div>
          {ordersLoading ? <DbListSkeleton rows={6}/> : !filteredOrders.length ? (
            <div className="empty"><b>Hali buyurtma yo'q</b><span>Customer checkout ishlaganda yangi buyurtmalar shu yerda paydo bo'ladi.</span></div>
          ) : (
            <div className="orders-list">
              {filteredOrders.map(o=>(                <article
                  className={"order-card "+(selectedOrder===o.id?"selected-order":"")}
                  key={o.id}
                  onClick={()=>setSelectedOrder(selectedOrder===o.id?null:o.id)}
                >
                  <div className="order-main">
                    <div>
                      <span className="order-id">BUYURTMA #{o.id}</span>
                      <h3>{o.customerName}</h3>
                      <p>{o.customerPhone} · {formatDate(o.createdAt)} · {o.items?.length||0} ta mahsulot</p>
                    </div>
                    <span className={"status-pill "+o.status}>{statusLabels[o.status]||o.status}</span>
                  </div>
                  {selectedOrder===o.id && (
                    <div className="order-details" onClick={e=>e.stopPropagation()}>
                      <div className="customer-box">
                        <b>Mijoz</b><span>{o.customerName}</span>
                        <a href={"tel:"+o.customerPhone}>{o.customerPhone}</a>
                        {o.customerUserId && <small>Customer ID: {o.customerUserId}</small>}
                      </div>
                      <div className="customer-meta">
                        <span><b>To'lov</b>{o.paymentMethod==="cash"?"Naqd":o.paymentMethod==="card"?"Karta":"Qarz"}</span>
                        <span><b>Yetkazib berish</b>{o.deliveryAddress||"Manzil kiritilmagan"}</span>
                      </div>
                      <div className="item-list">
                        {(o.items||[]).map(i=>(
                          <div className="order-item-detail" key={i.id}>
                            <div className="order-item-image">{i.imageUrl?<img loading="lazy" decoding="async" src={firstImage(i.imageUrl)} alt=""/>:<span>NO IMAGE</span>}</div>
                            <div className="order-item-info">
                              <b>{i.productName}</b>
                              {i.sku&&<small>SKU · {i.sku}</small>}
                              <span>{i.quantity} × {formatPrice(Number(i.price))}</span>
                            </div>
                            <strong>{formatPrice(Number(i.price)*i.quantity)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="order-bottom">
                    <b>{formatPrice(o.total)}</b>
                    <div className="order-actions">
                      {o.status!=="cancelled" && o.status!=="completed" && (
                        <button
                          className="primary small"
                          onClick={()=>changeStatus(o,nextStatus[o.status]||"completed")}
                        >
                          {nextStatus[o.status]==="confirmed"?"Qabul qilish":nextStatus[o.status]==="preparing"?"Tayyorlash":nextStatus[o.status]==="shipping"?"Yetkazishga berish":"Yakunlash"}
                        </button>
                      )}
                      {o.status!=="completed" && o.status!=="cancelled" && (
                        <button className="secondary small" onClick={()=>changeStatus(o,"cancelled")}>Bekor qilish</button>
                      )}
                      
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab==="chats"&&<section className="chat-layout panel">
        <div className="chat-list"><div className="panel-head"><div><h2>Mijozlar chatlari</h2><span className="muted">{chats.length} ta suhbat</span></div><button className="db-refresh-button small-refresh" onClick={()=>void refreshAll()} disabled={refreshLoading}>{refreshLoading?<><span className="refresh-spinner" aria-hidden="true"/>Yangilanmoqda...</>:<><span className="refresh-icon" aria-hidden="true">↻</span>Yangilash</>}</button></div>
          {chatsLoading?<DbListSkeleton rows={6}/>:chats.length?chats.map(c=><button className={"chat-row "+(activeChat===c.id?"selected":"")} key={c.id} onClick={()=>void openChat(c.id)}><span className="avatar">{(c.customerName||"M").slice(0,1).toUpperCase()}</span><span><b>{c.productName||"Mahsulot"}</b><small>{c.customerName||"Mijoz"} · {c.lastMessage||"Yangi suhbat"}</small></span><i>{formatDate(c.updatedAt)}</i></button>):<div className="empty small-empty">Hali chat yo'q.</div>}
        </div>
        <div className="chat-window">{chatsLoading?<DbTableSkeleton rows={5}/>:activeChat?(()=>{const active=chats.find(c=>c.id===activeChat);return <><div className="chat-window-head"><div className="seller-chat-title">{active?.productImageUrl?<img loading="lazy" decoding="async" src={active.productImageUrl} alt=""/>:<span className="seller-chat-product-fallback">MB</span>}<span><b>{active?.productName||"Mahsulot"}</b><small>{active?.customerName||"Mijoz"} bilan suhbat</small></span></div><button onClick={()=>setActiveChat(null)}>×</button></div><div className="messages">{messagesLoading?<DbListSkeleton rows={5}/>:messages.length?messages.map(m=><div key={m.id} className={"chat-message-row "+(m.senderRole==="seller"?"mine":"theirs")}><div className={"message-avatar "+(m.senderRole==="seller"?"seller":"customer")}>{m.senderRole==="seller"?"S":"M"}</div><div className={"bubble "+m.senderRole}><small className="message-sender">{m.senderRole==="seller"?"Siz":"Mijoz"}</small><span>{m.body}</span><small>{formatDate(m.createdAt)}</small></div></div>):<div className="chat-placeholder"><b>Hali xabar yo'q</b><span>Mijozga birinchi xabarni yuboring.</span></div>}</div><form className="chat-compose" onSubmit={sendChat}><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Mijozga xabar yozing..." /><button className="primary" disabled={!chatText.trim()}>Yuborish</button></form></>})():<div className="chat-placeholder"><b>Chatni tanlang</b><span>Mijoz bilan yozishmalar shu yerda ko'rinadi.</span></div>}</div>
      </section>}

      {(tab==="products"||tab==="inventory")&&<section className="panel">
        <div className="panel-head"><div><h2>{tab==="inventory"?"Ombor nazorati":"Mahsulotlar"}</h2><span className="muted">{filtered.length} ta natija · real Neon katalog</span></div><input className="mini-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Qidirish..." /></div>
        {loading?<DbTableSkeleton rows={7}/>:filtered.length?<div className="table">
          {filtered.map(p=><div className="row seller-product-row" key={p.id}>
            <div className="thumb product-thumb">{(p.imageUrls?.[0]||firstImage(p.imageUrl))?<img loading="lazy" decoding="async" src={p.imageUrls?.[0]||firstImage(p.imageUrl)} alt=""/>:"NO IMAGE"}</div>
            <div className="product-row-main"><b>{p.name}</b><span>SKU · {p.sku} · {p.promoPrice!=null?<><s>{formatPrice(p.price)}</s> {formatPrice(p.promoPrice)} · {p.promoDiscountPercent}% chegirma</>:formatPrice(p.price)}</span></div>
            {tab==="inventory"?<div className={"stock-editor "+(inventoryDirtyIds.includes(p.id)?"stock-editor-dirty":"")}><div className="stock-stepper"><button type="button" onClick={()=>{if(!Object.prototype.hasOwnProperty.call(inventoryOriginalRef.current,p.id))inventoryOriginalRef.current[p.id]=p.stock;setStockDraft(x=>({...x,[p.id]:String(Math.max(0,Number(x[p.id]??p.stock)-1))}))}} aria-label="Bitta kamaytirish">−</button><input aria-label={p.name+" qoldig'i"} type="number" min="0" value={stockDraft[p.id] ?? String(p.stock)} onChange={e=>{if(!Object.prototype.hasOwnProperty.call(inventoryOriginalRef.current,p.id))inventoryOriginalRef.current[p.id]=p.stock;setStockDraft(x=>({...x,[p.id]:e.target.value}))}}/><button type="button" onClick={()=>{if(!Object.prototype.hasOwnProperty.call(inventoryOriginalRef.current,p.id))inventoryOriginalRef.current[p.id]=p.stock;setStockDraft(x=>({...x,[p.id]:String(Math.max(0,Number(x[p.id]??p.stock)+1))}))}} aria-label="Bitta oshirish">+</button></div><span className="stock-unit">dona</span></div>:<strong className={p.stock===0?"out":p.stock<=5?"low":""}>{p.stock} dona</strong>}
            {tab==="products"&&<div className="row-actions product-actions" aria-label={p.name+" amallari"}>
  <button type="button" className="product-action edit-action" onClick={()=>{setEditing(p);window.history.pushState({},"","/xaccount/mahsulotlar/edit/"+p.id)}} title="Mahsulotni tahrirlash" aria-label={p.name+" ni tahrirlash"}>
    <span className="product-action-icon" aria-hidden="true">✎</span><span>Tahrirlash</span>
  </button>
  <button type="button" className={"product-action promo-action "+(p.promoPrice!=null?"promo-active":"")} onClick={()=>{setPromoProduct(p);window.history.pushState({},"","/xaccount/marketing/aksiya/"+p.id)}} title={p.promoPrice!=null?"Aksiyani o'zgartirish":"Aksiya yaratish"} aria-label={p.promoPrice!=null?"Aksiyani o'zgartirish":"Aksiya yaratish"}>
    <span className="product-action-icon" aria-hidden="true">%</span><span>{p.promoPrice!=null?"Aksiya":"Aksiya"}</span>
  </button>
  {p.promoPrice!=null&&<button type="button" className="product-action stop-action" onClick={()=>void stopPromotion(p.id)} title="Aksiyani to'xtatish" aria-label={p.name+" aksiyasini to'xtatish"}>
    <span className="product-action-icon" aria-hidden="true">⏸</span><span>To'xtatish</span>
  </button>}
  <button type="button" className="product-action delete-action" onClick={()=>{setDeleteProductTarget(p);window.history.pushState({},"","/xaccount/mahsulotlar/delete/"+p.id)}} title="Mahsulotni o'chirish" aria-label={p.name+" ni o'chirish"}>
    <span className="product-action-icon" aria-hidden="true">⌫</span><span>O'chirish</span>
  </button>
</div>}
          </div>)}
        </div>:<div className="empty"><b>Mahsulot topilmadi.</b><span>Qidiruvni o'zgartiring yoki yangi mahsulot qo'shing.</span></div>}
      </section>}

      {tab==="add"&&<section className="panel form-panel"><div className="panel-head"><div><h2>Yangi mahsulot</h2><span className="muted">Customer ko'radigan asosiy ma'lumotlar</span></div><span className="ai">AI READY</span></div><form onSubmit={submit}><label>Mahsulot nomi<input required maxLength={180} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Masalan: Yuz kremi"/></label><label>Qisqa SKU<input required maxLength={40} value={form.sku} onChange={e=>setForm({...form,sku:e.target.value.toUpperCase()})} placeholder="Masalan: CREAM-01" autoComplete="off"/><small className="field-help">SKU faqat seller panelida ko'rinadi. Harf, raqam, -, _, . ishlatiladi.</small></label><label>Tavsif<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mahsulot tavsifi..." rows={5}/></label><div className="two"><label>Narx<input required min="0" step="0.01" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Qoldiq<input required min="0" step="1" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label></div><div className="image-uploader" onDragOver={e=>e.preventDefault()} onDrop={onImageDrop}>
  <label>Mahsulot rasmlari <span>Bir nechta faylni tanlang yoki drag & drop qiling</span>
    <input type="file" accept="image/*" multiple onChange={e=>{const files=Array.from(e.target.files||[]);void Promise.all(files.map(handleImageFile));e.currentTarget.value="";}} />
  </label>
  <div className="image-uploader-divider"><span>yoki rasm URL qo'shing</span></div>
  <div className="image-url-add"><input value={imageUrlInput} onChange={e=>setImageUrlInput(e.target.value)} placeholder="https://.../image.jpg" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addImageUrl();}}}/><button type="button" className="secondary small" onClick={addImageUrl}>Qo'shish</button></div>
  {form.imageUrls.length>0&&<div className="image-gallery-preview">{form.imageUrls.map((url,i)=><div className="image-preview-card" key={url}><img loading="lazy" decoding="async" src={url} alt={"Preview "+(i+1)}/><span>{i===0?"Asosiy":i+1}</span><button type="button" onClick={()=>void removeImage(url)} aria-label="Rasmni o'chirish">×</button></div>)}</div>}
  <small>Har bir rasm 1080×1440 oq fonli formatga tayyorlanadi. Katta rasm kesilmaydi. DB'ga rasmning o'zi emas, faqat URL saqlanadi.</small>
</div><button className="primary full" disabled={saving}>{saving?"Saqlanmoqda...":"Mahsulotni bazaga qo'shish"}</button>{message&&<div className="message">{message}</div>}</form></section>}

      {tab==="inventory"&&inventoryDirtyCount>0&&<div className="inventory-save-bar" role="status"><div className="inventory-save-bar-info"><span className="inventory-save-dot"/><div><b>{inventoryDirtyCount} ta mahsulot o'zgartirildi</b><small>O'zgarishlarni hozircha tasdiqlamasdan boshqa mahsulotlarni ham tahrirlashingiz mumkin.</small></div></div><div className="inventory-save-actions"><button type="button" className="inventory-discard-button" onClick={cancelAllStock} disabled={inventorySaving}>Voz kechish</button><button type="button" className="inventory-save-button" onClick={()=>void saveAllStock()} disabled={inventorySaving}>{inventorySaving?<><span className="refresh-spinner" aria-hidden="true"/>Saqlanmoqda...</>:<>Saqlash <span>→</span></>}</button></div></div>}
      {pendingNavigation&&<div className="modal-backdrop inventory-leave-backdrop"><div className="modal inventory-leave-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-leave-title"><div className="inventory-leave-icon">!</div><span className="eyebrow">SAQLANMAGAN O'ZGARISHLAR</span><h2 id="inventory-leave-title">{inventoryDirtyCount} ta mahsulot o'zgartirildi</h2><p>Ombordan chiqishdan oldin o'zgarishlarni saqlaysizmi?</p><div className="inventory-leave-actions"><button type="button" className="secondary" onClick={()=>completePendingNavigation(false)} disabled={inventorySaving}>Voz kechish</button><button type="button" className="primary" onClick={()=>void completePendingNavigation(true)} disabled={inventorySaving}>{inventorySaving?<><span className="refresh-spinner" aria-hidden="true"/>Saqlanmoqda...</>:<>Saqlash va chiqish <span>→</span></>}</button></div><button type="button" className="modal-close-button inventory-leave-close" onClick={()=>setPendingNavigation(null)} disabled={inventorySaving} aria-label="Yopish" title="Yopish"><span aria-hidden="true">×</span></button></div></div>}
      {tab==="analytics"&&<section className="panel analytics-panel"><div className="analytics-hero"><div><span className="eyebrow">BUSINESS INTELLIGENCE · 30 KUN</span><h2>Analitika</h2><p>Do'koningizning real savdo va ombor ko'rsatkichlari Neon bazasidan avtomatik yuklanadi.</p></div><div className="analytics-live"><span className="live-dot"/> LIVE DATA</div></div>{analyticsLoading?<DbTableSkeleton rows={8}/>:!analytics?<div className="empty"><b>Analitika hozircha mavjud emas</b><span>Ma'lumotlar bazadan yuklanmoqda yoki vaqtincha mavjud emas.</span></div>:<><div className="stats"><div><span>30 kunlik tushum</span><b>{formatPrice(Number(analytics.summary.revenue))}</b><small>Faqat yakunlangan buyurtmalar</small></div><div><span>Buyurtmalar</span><b>{analytics.summary.totalOrders}</b><small>{analytics.summary.completedOrders} tasi yakunlangan</small></div><div><span>O'rtacha chek</span><b>{formatPrice(Number(analytics.summary.averageOrder))}</b><small>Yakunlangan buyurtmalar</small></div><div><span>Past qoldiq</span><b>{analytics.stock.lowStock}</b><small>{analytics.stock.outOfStock} ta tugagan</small></div></div><div className="dashboard-grid"><section className="panel"><div className="panel-head"><h2>Eng ko'p tushum bergan mahsulotlar</h2><button className="db-refresh-button small-refresh" onClick={()=>void refreshAll()} disabled={refreshLoading}>{refreshLoading?<><span className="refresh-spinner" aria-hidden="true"/>Yangilanmoqda...</>:<><span className="refresh-icon" aria-hidden="true">↻</span>Yangilash</>}</button></div>{analytics.topProducts.map((x:any)=><div className="overview-list" key={x.productId}><div><span>{x.productName}</span><b>{formatPrice(Number(x.revenue))}</b></div></div>)}</section><section className="panel"><div className="panel-head"><h2>Kundalik savdo</h2></div>{analytics.daily.map((x:any)=><div className="overview-list" key={String(x.day)}><div><span>{formatAnalyticsDay(String(x.day))}</span><b>{formatPrice(Number(x.revenue))} · {x.orders} buyurtma</b></div></div>)}</section></div></>}</section>}
      {tab==="marketing"&&<section className="panel marketing-page">
        <div className="panel-head"><div><h2>Marketing & Aksiyalar</h2><span className="muted">Bannerlar customer saytining bosh sahifasida, aksiyalar esa katalogda ko'rinadi.</span></div></div>
        <div className="banner-manager">
          <div className="banner-manager-head"><div><span className="editor-section-kicker">CUSTOMER · BANNER</span><h3>Sayt bannerlari</h3><p>Faqat rasm. Desktop: <b>1440×480 px</b> · Telefon: <b>1080×540 px</b>. Tizim rasmni shu nisbatga sig'dirib, oq fon bilan tayyorlaydi.</p></div><span className="banner-size-badge">RESPONSIVE</span></div>
          <div className="banner-upload-grid">
            <label className="banner-upload-card"><input type="file" accept="image/*" disabled={bannerSaving} onChange={async e=>{const f=e.target.files?.[0];e.currentTarget.value="";if(!f)return;try{setBannerSaving(true);setBannerDesktopUrl(await uploadBannerFile(f,1440,480));setMessage("Desktop banner tayyor.");}catch(err){setMessage(err instanceof Error?err.message:"Desktop banner yuklanmadi.")}finally{setBannerSaving(false)}}}/><span>▣</span><b>Desktop banner</b><small>1440 × 480 px · 3:1</small>{bannerDesktopUrl&&<img src={bannerDesktopUrl} alt="Desktop banner preview"/>}</label>
            <label className="banner-upload-card"><input type="file" accept="image/*" disabled={bannerSaving} onChange={async e=>{const f=e.target.files?.[0];e.currentTarget.value="";if(!f)return;try{setBannerSaving(true);setBannerMobileUrl(await uploadBannerFile(f,1080,540));setMessage("Mobile banner tayyor.");}catch(err){setMessage(err instanceof Error?err.message:"Mobile banner yuklanmadi.")}finally{setBannerSaving(false)}}}/><span>▯</span><b>Telefon banner</b><small>1080 × 540 px · 2:1</small>{bannerMobileUrl&&<img src={bannerMobileUrl} alt="Mobile banner preview"/>}</label>
          </div>          <div className="banner-target-box">
            <div><span className="editor-section-kicker">BANNER · YO'NALISH</span><h3>Banner bosilganda qayerga o'tadi?</h3><p>Endi banner bosilganda avtomatik ravishda faqat mahsulotlar sahifasi ochilmaydi — yo'nalishni seller tanlaydi.</p></div>
            <select value={bannerTargetType} onChange={e=>{setBannerTargetType(e.target.value);setBannerTargetValue("");}}>
              <option value="all-products">Barcha mahsulotlar</option><option value="new-products">Yangi mahsulotlar</option><option value="sale-products">Aksiyalar</option><option value="category">Kategoriya</option><option value="page">Yangi/maxsus sahifa</option><option value="url">Boshqa sayt yoki sahifa</option>
            </select>
            {bannerTargetType==="category"&&<select value={bannerTargetValue} onChange={e=>setBannerTargetValue(e.target.value)}><option value="">Kategoriya tanlang</option>{["care","makeup","perfume","fashion","health","home","kids"].map(x=><option key={x} value={x}>{x}</option>)}</select>}
            {bannerTargetType==="page"&&<><select value={bannerTargetValue} onChange={e=>setBannerTargetValue(e.target.value)}><option value="">Sahifa tanlang</option>{landingPages.filter(x=>x.active).map(p=><option key={p.id} value={p.slug}>{p.title}</option>)}</select><button type="button" className="secondary small" onClick={()=>setPageEditorOpen(true)}>＋ Yangi sahifa yaratish</button></>}
            {bannerTargetType==="url"&&<input value={bannerTargetValue} onChange={e=>setBannerTargetValue(e.target.value)} placeholder="https://..." />}
            {["all-products","new-products","sale-products"].includes(bannerTargetType)&&<small>Customer shu tanlangan katalog oynasini ochadi.</small>}
          </div>
          {pageEditorOpen&&<div className="banner-page-editor">
            <div><span className="editor-section-kicker">CUSTOM PAGE</span><h3>Yangi maxsus sahifa</h3><p>Mahsulotlarni tanlang, sarlavha va maxsus taklifni yozing.</p></div>
            <input value={pageTitle} onChange={e=>setPageTitle(e.target.value)} placeholder="Masalan: Kuzgi go'zallik haftaligi" />
            <input value={pageSubtitle} onChange={e=>setPageSubtitle(e.target.value)} placeholder="Qisqa sarlavha" />
            <textarea rows={3} value={pageDescription} onChange={e=>setPageDescription(e.target.value)} placeholder="Sahifa haqida..." />
            <input value={pageOfferText} onChange={e=>setPageOfferText(e.target.value)} placeholder="Maxsus taklif: 20% gacha chegirma" />
            <div className="page-product-picker">{products.map(p=><label key={p.id}><input type="checkbox" checked={pageProductIds.includes(p.id)} onChange={e=>setPageProductIds(x=>e.target.checked?[...x,p.id]:x.filter(id=>id!==p.id))}/><span>{p.name}</span></label>)}</div>
            <div className="editor-footer-actions"><button type="button" className="secondary" onClick={()=>setPageEditorOpen(false)}>Bekor qilish</button><button type="button" className="primary" disabled={pageSaving} onClick={()=>void createLandingPage()}>{pageSaving?"Saqlanmoqda...":"Sahifani yaratish"}</button></div>
          </div>}
          <button className="primary banner-publish-button" onClick={()=>void createBanner()} disabled={bannerSaving||!bannerDesktopUrl||!bannerMobileUrl}>{bannerSaving?<><span className="refresh-spinner"/>Yuklanmoqda...</>:<>Bannerlarni customer saytiga joylash <span>→</span></>}</button>
          <div className="banner-list">{bannerLoading?<DbTableSkeleton rows={2}/>:banners.length?banners.map(b=><div className={"banner-row "+(!b.active?"inactive":"")} key={b.id}><div className="banner-previews"><img src={b.desktopImageUrl} alt=""/><img src={b.mobileImageUrl} alt=""/></div><div className="banner-row-copy"><b>{b.active?"Customer saytida ko'rinmoqda":"O'chirilgan"}</b><small>Desktop 1440×480 · Mobile 1080×540 · {b.targetType==="page"?"Sahifa: "+b.targetValue:b.targetType==="url"?"Tashqi URL":b.targetType==="category"?"Kategoriya: "+b.targetValue:b.targetType==="new-products"?"Yangi mahsulotlar":b.targetType==="sale-products"?"Aksiyalar":"Barcha mahsulotlar"}</small></div><button className="secondary small" onClick={()=>void toggleBanner(b)}>{b.active?"O'chirish":"Yoqish"}</button><button className="icon-action danger" onClick={()=>void deleteBanner(b)} aria-label="Bannerni o'chirish">×</button></div>):<div className="banner-empty">Hali banner joylanmagan.</div>}</div>
        </div>
<div className="landing-page-list"><div className="panel-head"><div><h3>Maxsus sahifalar</h3><span className="muted">Banner uchun yaratilgan sahifalar: mahsulotlar + maxsus takliflar.</span></div></div>{landingPages.length?landingPages.map(p=><div className="banner-row" key={p.id}><div className="banner-row-copy"><b>{p.title}</b><small>/{p.slug} · {p.productIds.length} ta mahsulot{p.offerText?" · "+p.offerText:""}</small></div><button className="secondary small" onClick={()=>{setBannerTargetType("page");setBannerTargetValue(p.slug)}}>Bannerga tanlash</button><button className="secondary small" onClick={()=>void toggleLandingPage(p)}>{p.active?"O'chirish":"Yoqish"}</button><button className="icon-action danger" onClick={()=>void deleteLandingPage(p)}>×</button></div>):<div className="banner-empty">Hali maxsus sahifa yaratilmagan.</div>}</div>
        {loading?<DbTableSkeleton rows={7}/>:<div className="table">{products.map(p=><div className="row" key={p.id}><div className="thumb">{(p.imageUrls?.[0]||p.imageUrl)?<img loading="lazy" decoding="async" src={p.imageUrls?.[0]||p.imageUrl} alt=""/>:"NO IMAGE"}</div><div><b>{p.name}</b><span>{p.promoPrice!=null?formatPrice(p.promoPrice)+" · "+p.promoDiscountPercent+"% chegirma":"Aksiya yo'q"}</span></div><button className="secondary small" onClick={()=>{setPromoProduct(p);window.history.pushState({},"","/xaccount/marketing/aksiya/"+p.id)}}>{p.promoPrice!=null?"O'zgartirish":"Aksiya qo'shish"}</button>{p.promoPrice!=null&&<button className="secondary small" onClick={()=>void stopPromotion(p.id)}>To'xtatish</button>}</div>)}</div>}</section>}
      {editing&&<div className="modal-backdrop editor-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving&&!editingImageLoading)setEditing(null)}}><form className="modal product-editor-modal" onSubmit={e=>{e.preventDefault();void saveProduct(editing)}}>
  <header className="product-editor-header">
    <div className="product-editor-title-wrap"><div className="product-editor-avatar">{(editing.imageUrls?.[0]||editing.imageUrl)?<img loading="lazy" decoding="async" src={editing.imageUrls?.[0]||editing.imageUrl} alt=""/>:<span>MB</span>}</div><div><span className="eyebrow">CATALOG · PRODUCT EDITOR</span><h2>Mahsulotni tahrirlash</h2><p>{editing.name||"Yangi mahsulot"} <span>·</span> SKU {editing.sku||"—"}</p></div></div>
    <div className="product-editor-header-actions"><span className="editor-live-badge"><i/> Bazaga ulangan</span><button type="button" className="modal-close-button" onClick={()=>{setEditing(null);window.history.pushState({},"",pathForTab("products"));syncRoute();}} disabled={saving||editingImageLoading} aria-label="Yopish" title="Yopish"><span aria-hidden="true">×</span></button></div>
  </header>
  <div className="product-editor-body">
    <section className="editor-details-column">
      <div className="editor-section-card"><div className="editor-section-head"><div><span className="editor-section-kicker">01 · ASOSIY MA'LUMOT</span><h3>Mahsulot tafsilotlari</h3><p>Customer saytida ko‘rinadigan asosiy ma'lumotlarni boshqaring.</p></div></div>
        <div className="editor-field-grid">
          <label className="editor-field editor-field-wide"><span>Mahsulot nomi <em>*</em></span><input required maxLength={180} value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="Masalan: Faberlic kir yuvish geli"/></label>
          <label className="editor-field"><span>SKU <em>*</em></span><input required maxLength={40} value={editing.sku} onChange={e=>setEditing({...editing,sku:e.target.value.toUpperCase()})} autoComplete="off" placeholder="SKU-001"/><small>Faqat seller panelida ko‘rinadi.</small></label>
          <label className="editor-field"><span>Narx <em>*</em></span><div className="editor-input-with-suffix"><input required type="number" min="0" step="0.01" value={editing.price} onChange={e=>setEditing({...editing,price:Number(e.target.value)})}/><b>so‘m</b></div></label>
          <label className="editor-field"><span>Ombordagi qoldiq <em>*</em></span><div className="editor-input-with-suffix"><input required type="number" min="0" step="1" value={editing.stock} onChange={e=>setEditing({...editing,stock:Number(e.target.value)})}/><b>dona</b></div></label>
          <label className="editor-field editor-field-wide"><span>Tavsif</span><textarea rows={9} maxLength={3000} value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})} placeholder="Mahsulotning xususiyatlari, hajmi, tarkibi va foydali ma'lumotlari..."/><small>{String(editing.description||"").length}/3000 belgi</small></label>
        </div>
      </div>
      <div className="editor-summary-card"><div className="editor-summary-title"><span>Saqlashdan oldingi holat</span><b>LIVE PREVIEW</b></div><div className="editor-summary-grid"><div><span>Narx</span><strong>{formatPrice(Number(editing.price)||0)}</strong></div><div><span>Qoldiq</span><strong>{Number(editing.stock)||0} dona</strong></div><div><span>Rasmlar</span><strong>{(editing.imageUrls||[]).length}/12</strong></div></div></div>
    </section>
    <section className="editor-media-column"><div className="editor-section-card editor-media-card">
      <div className="editor-section-head editor-media-section-head"><div><span className="editor-section-kicker">02 · MEDIA</span><h3>Mahsulot rasmlari</h3><p>Asosiy rasm birinchi turadi. Tartib customer saytida ham saqlanadi.</p></div><span className="editor-image-counter">{(editing.imageUrls||[]).length}<small>/ 12</small></span></div>
      <div className={"editor-image-drop-zone "+(editingImageLoading?"is-loading":"")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!editingImageLoading)void Promise.all(Array.from(e.dataTransfer.files||[]).map(uploadEditingImage))}}><input type="file" accept="image/*" multiple disabled={editingImageLoading} onChange={e=>{const files=Array.from(e.target.files||[]);void Promise.all(files.map(uploadEditingImage));e.currentTarget.value=""}}/>{editingImageLoading?<><span className="editor-upload-spinner" aria-hidden="true"/><b>Rasm yuklanmoqda...</b><span>Storage'ga saqlanmoqda</span></>:<><span className="editor-upload-icon" aria-hidden="true">＋</span><b>Rasmlarni shu yerga tashlang</b><span>yoki fayldan tanlang · JPG, PNG, WEBP · 12 MB gacha</span></>}</div>
      <div className="editor-url-row"><div className="editor-url-input"><span>↗</span><input value={imageUrlInput} onChange={e=>setImageUrlInput(e.target.value)} placeholder="Rasm URL manzilini kiriting..." onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addEditingImageUrl()}}}/></div><button type="button" className="secondary editor-add-url" onClick={addEditingImageUrl}>URL qo‘shish</button></div>
      {(editing.imageUrls||[]).length>0?<div className="editor-image-grid-pro">{(editing.imageUrls||[]).map((url,i)=><div className={"editor-image-card-pro "+(i===0?"primary-image":"")} key={url} draggable={!editingImageLoading} onDragStart={e=>e.dataTransfer.setData("text/plain",String(i))} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));reorderEditingImage(from,i)}}><div className="editor-image-visual"><img loading="lazy" decoding="async" src={url} alt={editing.name+" "+(i+1)}/><span className="editor-image-number">{i+1}</span>{i===0&&<span className="editor-primary-label">ASOSIY</span>}<button type="button" className="editor-image-delete-pro" onClick={()=>removeEditingImage(url)} aria-label="Rasmni o‘chirish">×</button></div><div className="editor-image-card-footer"><div><b>{i===0?"Asosiy rasm":"Rasm "+(i+1)}</b><small>{i===0?"Customer vitrinasi":"Tartibni o‘zgartirish uchun suring"}</small></div><button type="button" disabled={i===0||editingImageLoading} onClick={()=>reorderEditingImage(i,0)}>{i===0?"✓":"Asosiy qilish"}</button></div></div>)}</div>:<div className="editor-empty-media"><span aria-hidden="true">▧</span><b>Hali rasm yo‘q</b><small>Birinchi rasm mahsulotning asosiy rasmi bo‘ladi.</small></div>}
      <div className="editor-media-tip"><span>💡</span><p><b>Pro maslahat:</b> mahsulotning eng toza va tushunarli rasmini birinchi o‘ringa qo‘ying. Qolgan rasmlarni sudrab tartiblang.</p></div>
    </div></section>
  </div>
  <footer className="product-editor-footer"><div className="editor-save-status"><span className={saving?"saving-dot":"ready-dot"}/><span>{saving?"O‘zgarishlar saqlanmoqda...":"O‘zgarishlar saqlashga tayyor"}</span></div><div className="editor-footer-actions"><button type="button" className="secondary editor-cancel-button" onClick={()=>{setEditing(null);window.history.pushState({},"",pathForTab("products"));syncRoute();}} disabled={saving||editingImageLoading}>Bekor qilish</button><button className="primary editor-save-button" disabled={saving||editingImageLoading}>{saving?<><span className="refresh-spinner" aria-hidden="true"/>Saqlanmoqda...</>:<>O‘zgarishlarni saqlash <span>→</span></>}</button></div></footer>
</form></div>}      {deleteProductTarget&&<div className="modal-backdrop delete-confirm-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!deleteLoading){setDeleteProductTarget(null);window.history.pushState({},"",pathForTab("products"));syncRoute();}}}><div className="modal delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-product-title">
        <div className="delete-confirm-head"><div className="delete-confirm-icon" aria-hidden="true">⌫</div><button type="button" className="modal-close-button" onClick={()=>{setDeleteProductTarget(null);window.history.pushState({},"",pathForTab("products"));syncRoute();}} disabled={deleteLoading} aria-label="Yopish" title="Yopish"><span aria-hidden="true">×</span></button></div>
        <div className="delete-confirm-content"><span className="eyebrow">MAHSULOTNI O'CHIRISH</span><h2 id="delete-product-title">Shu mahsulotni o'chirishga aminmisiz?</h2><p>Bu amal mahsulotni seller katalogidan olib tashlaydi.</p></div>
        <div className="delete-product-preview"><div className="delete-product-image">{(deleteProductTarget.imageUrls?.[0]||firstImage(deleteProductTarget.imageUrl))?<img loading="lazy" decoding="async" src={deleteProductTarget.imageUrls?.[0]||firstImage(deleteProductTarget.imageUrl)} alt={deleteProductTarget.name}/>:<span>NO IMAGE</span>}</div><div className="delete-product-info"><b>{deleteProductTarget.name}</b><span>SKU · {deleteProductTarget.sku||"—"}</span><small>{formatPrice(Number(deleteProductTarget.price))} · {deleteProductTarget.stock} dona</small></div></div>
        <div className="delete-confirm-actions"><button type="button" className="secondary small" onClick={()=>{setDeleteProductTarget(null);window.history.pushState({},"",pathForTab("products"));syncRoute();}} disabled={deleteLoading}>Bekor qilish</button><button type="button" className="delete-confirm-button" onClick={()=>void deleteProduct(deleteProductTarget)} disabled={deleteLoading}>{deleteLoading?<><span className="refresh-spinner" aria-hidden="true"/>O'chirilmoqda...</>:<><span aria-hidden="true">⌫</span>Ha, o'chirish</>}</button></div>
      </div></div>}
      {promoProduct&&<div className="modal-backdrop"><div className="modal form-panel"><div className="panel-head"><h2>Aksiya: {promoProduct.name}</h2><button type="button" className="modal-close-button" onClick={()=>{setPromoProduct(null);window.history.pushState({},"",pathForTab("marketing"));syncRoute();}} aria-label="Yopish" title="Yopish"><span aria-hidden="true">×</span></button></div><label>Chegirma foizi<input type="number" min="1" max="99" value={promoDiscount} onChange={e=>setPromoDiscount(e.target.value)}/></label><label>Tugash vaqti<input type="datetime-local" value={promoEndsAt} onChange={e=>setPromoEndsAt(e.target.value)}/></label><button className="primary full" onClick={()=>void savePromotion()}>Aksiyani saqlash</button></div></div>}
    </section>
  </main>;
}


const root = document.getElementById("root");
if (!root) throw new Error("Seller root element not found.");
createRoot(root).render(<App />);