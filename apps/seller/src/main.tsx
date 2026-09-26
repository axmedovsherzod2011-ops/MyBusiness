import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Product, ProductsResponse } from "@marketplace/shared";
import "./styles.css";

const apiBase = "https://mybusiness-api-e6dk.onrender.com";
const emptyForm = { name: "", description: "", price: "", stock: "0", imageUrl: "" };

type OrderItem = { id:number; productId:number|null; productName:string; price:number; quantity:number };
type Order = {
  id:number; customerUserId:number|null; customerName:string; customerPhone:string; status:string; total:number;
  createdAt:string; updatedAt:string; items:OrderItem[];
};
type Chat = {
  id:number; customerName:string; productId:number|null; status:string;
  lastMessage:string; messageCount:number; updatedAt:string;
};
type ChatMessage = { id:number; senderRole:"customer"|"seller"; body:string; createdAt:string };
const statusLabels:Record<string,string> = {
  new:"Yangi", confirmed:"Qabul qilindi", preparing:"Tayyorlanmoqda",
  shipping:"Yetkazilmoqda", completed:"Yakunlangan", cancelled:"Bekor qilingan"
};
const nextStatus:Record<string,string> = {new:"confirmed",confirmed:"preparing",preparing:"shipping",shipping:"completed"};

function formatPrice(price:number){return new Intl.NumberFormat("uz-UZ").format(Number(price))+ " so'm";}
function formatDate(value:string){return new Intl.DateTimeFormat("uz-UZ",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}

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
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  async function api(path:string, options:RequestInit={}) {
    const r=await fetch(apiBase+path,{...options,headers:{"Accept":"application/json","Content-Type":"application/json",...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message||"Server xatosi.");
    return d;
  }
  async function loadProducts(){try{const d=await api("/api/v1/products");setProducts((d as ProductsResponse).products)}catch(e){setMessage(e instanceof Error?e.message:"Mahsulotlarni yuklab bo'lmadi.")}finally{setLoading(false)}}
  async function loadOrders(){try{const d=await api("/api/v1/orders");setOrders(d.orders||[])}catch(e){setMessage(e instanceof Error?e.message:"Buyurtmalarni yuklab bo'lmadi.")}}
  async function loadChats(){try{const d=await api("/api/v1/chats");setChats(d.chats||[])}catch(e){setMessage(e instanceof Error?e.message:"Chatlarni yuklab bo'lmadi.")}}
  useEffect(()=>{
    void loadProducts(); void loadOrders(); void loadChats();
    const timer=window.setInterval(async()=>{
      try{
        const d=await api("/api/v1/orders");
        const next=(d.orders||[]) as Order[];
        const incoming=next.filter(o=>o.status==="new").length;
        if(lastSeenNewOrders>0 && incoming>lastSeenNewOrders){
          setNotification(`Yangi buyurtma keldi: ${incoming-lastSeenNewOrders} ta`);
          setTab("orders");
        }
        setLastSeenNewOrders(incoming);
        setOrders(next);
        const c=await api("/api/v1/chats");
        setChats(c.chats||[]);
      }catch{}
    },15000);
    return()=>window.clearInterval(timer);
  },[lastSeenNewOrders]);

  async function openChat(id:number){setActiveChat(id);try{const d=await api("/api/v1/chats/"+id+"/messages");setMessages(d.messages||[])}catch(e){setMessage(e instanceof Error?e.message:"Xabarlarni yuklab bo'lmadi.")}}
  async function sendChat(e:FormEvent){e.preventDefault();const text=chatText.trim();if(!activeChat||!text)return;try{const d=await api("/api/v1/chats/"+activeChat+"/messages",{method:"POST",body:JSON.stringify({message:text})});setMessages(x=>[...x,d.message]);setChatText("");await loadChats()}catch(e){setMessage(e instanceof Error?e.message:"Xabar yuborilmadi.")}}
  async function changeStatus(order:Order,status:string){try{const d=await api("/api/v1/orders/"+order.id+"/status",{method:"PATCH",body:JSON.stringify({status})});setOrders(x=>x.map(o=>o.id===order.id?d.order:o))}catch(e){setMessage(e instanceof Error?e.message:"Holatni o'zgartirib bo'lmadi.")}}

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setMessage("");
    try{
      const d=await api("/api/v1/products",{method:"POST",body:JSON.stringify({
        name:form.name.trim(),description:form.description.trim(),price:Number(form.price),
        stock:Number(form.stock),imageUrl:form.imageUrl.trim()
      })});
      if(d.product)setProducts(x=>[d.product,...x]);setForm(emptyForm);setMessage("Mahsulot bazaga saqlandi.");setTab("products");
    }catch(err){setMessage(err instanceof Error?err.message:"Saqlashda xatolik.")}finally{setSaving(false)}
  }

  const filtered=useMemo(()=>products.filter(p=>`${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase())),[products,query]);
  const totalStock=products.reduce((s,p)=>s+p.stock,0);
  const catalogValue=products.reduce((s,p)=>s+p.price*p.stock,0);
  const newOrders=orders.filter(o=>o.status==="new").length;
  const openChats=chats.filter(c=>c.status==="open").length;
  const selected=selectedOrder===null?null:orders.find(o=>o.id===selectedOrder)||null;
  const nav: Array<[string,string]> = [["overview","Dashboard"],["products","Mahsulotlar"],["orders","Buyurtmalar"],["chats","Chatlar"],["inventory","Ombor"],["marketing","Marketing"],["analytics","Analitika"]];

  return <main className="seller-shell">
    <aside className="sidebar">
      <a className="brand" href="/">MYBUSINESS <span>SELLER</span></a>
      <nav>{nav.map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}{id==="orders"&&newOrders>0?<i className="nav-count">{newOrders}</i>:id==="chats"&&openChats>0?<i className="nav-count">{openChats}</i>:null}</button>)}</nav>
      <div className="side-note"><b>Live boshqaruv</b><span>Buyurtmalar, chatlar, mahsulotlar va ombor shu paneldan boshqariladi.</span></div>
    </aside>

    <section className="seller-main">
      <header className="top">
        <div><span className="eyebrow">SELLER CENTER</span><h1>{tab==="overview"?"Dashboard":nav.find(x=>x[0]===tab)?.[1]}</h1><p>Do'koningizni bitta joydan boshqaring.</p></div>
        <div className="top-actions">{notification&&<button className="notice" onClick={()=>setNotification("")}>🔔 {notification}</button>}<div className="status">● LIVE DATABASE</div></div>
      </header>

      {tab==="overview"&&<>
        <div className="stats">
          <div><span>Mahsulotlar</span><b>{products.length}</b></div><div><span>Ombordagi dona</span><b>{totalStock}</b></div>
          <div><span>Yangi buyurtmalar</span><b>{newOrders}</b></div><div><span>Ochiq chatlar</span><b>{openChats}</b></div>
        </div>
        <div className="dashboard-grid">
          <section className="panel"><div className="panel-head"><h2>Tezkor amallar</h2></div>
            <button className="primary" onClick={()=>setTab("add")}>+ Yangi mahsulot</button>
            <button className="secondary" onClick={()=>setTab("orders")}>Buyurtmalarni ko'rish</button>
            <button className="secondary" onClick={()=>setTab("chats")}>Mijozlar chatini ochish</button>
          </section>
          <section className="panel"><div className="panel-head"><h2>Bugungi holat</h2><span className="ai">LIVE</span></div>
            <div className="overview-list"><div><span>Ombor qiymati</span><b>{formatPrice(catalogValue)}</b></div><div><span>Tugagan mahsulotlar</span><b>{products.filter(p=>p.stock===0).length}</b></div><div><span>Jami buyurtmalar</span><b>{orders.length}</b></div></div>
          </section>
        </div>
      </>}

      {tab==="orders"&&<section className="panel">
        <div className="panel-head"><div><h2>Buyurtmalar</h2><span className="muted">Customer saytidan kelgan buyurtmalar</span></div><button className="secondary small" onClick={()=>void loadOrders()}>Yangilash</button></div>
        {!orders.length?<div className="empty"><b>Hali buyurtma yo'q</b><span>Customer checkout ishlaganda yangi buyurtmalar shu yerda paydo bo'ladi.</span></div>:
        <div className="orders-list">{orders.map(o=><article className={"order-card "+(selectedOrder===o.id?"selected-order":"")} key={o.id} onClick={()=>setSelectedOrder(selectedOrder===o.id?null:o.id)}>
          <div className="order-main"><div><span className="order-id">BUYURTMA #{o.id}</span><h3>{o.customerName}</h3><p>{o.customerPhone} · {formatDate(o.createdAt)} · {o.items?.length||0} ta mahsulot</p></div><span className={"status-pill "+o.status}>{statusLabels[o.status]||o.status}</span></div>
          {selectedOrder===o.id&&<div className="order-details" onClick={e=>e.stopPropagation()}>
            <div className="customer-box"><b>Mijoz</b><span>{o.customerName}</span><a href={"tel:"+o.customerPhone}>{o.customerPhone}</a>{o.customerUserId&&<small>Customer ID: {o.customerUserId}</small>}</div>
            <div className="item-list">{(o.items||[]).map(i=><div className="item-line" key={i.id}><span>{i.productName} × {i.quantity}</span><b>{formatPrice(Number(i.price)*i.quantity)}</b></div>)}</div>
          </div>}
          <div className="order-bottom"><b>{formatPrice(o.total)}</b><div className="order-actions">{o.status!=="cancelled"&&o.status!=="completed"&&<button className="primary small" onClick={()=>changeStatus(o,nextStatus[o.status]||"completed")}>{nextStatus[o.status]==="confirmed"?"Qabul qilish":nextStatus[o.status]==="preparing"?"Tayyorlash":nextStatus[o.status]==="shipping"?"Yetkazishga berish":"Yakunlash"}</button>} {o.status!=="completed"&&o.status!=="cancelled"&&<button className="secondary small" onClick={()=>changeStatus(o,"cancelled")}>Bekor qilish</button>}<button className="secondary small" onClick={()=>{setTab("chats");setSelectedOrder(null)}}>Chat</button></div></div>
        </article>)}</div>
      </section>}

      {tab==="chats"&&<section className="chat-layout panel">
        <div className="chat-list"><div className="panel-head"><div><h2>Mijozlar chatlari</h2><span className="muted">{chats.length} ta suhbat</span></div><button className="secondary small" onClick={()=>void loadChats()}>Yangilash</button></div>
          {chats.length?chats.map(c=><button className={"chat-row "+(activeChat===c.id?"selected":"")} key={c.id} onClick={()=>void openChat(c.id)}><span className="avatar">{(c.customerName||"M").slice(0,1).toUpperCase()}</span><span><b>{c.customerName||"Mijoz"}</b><small>{c.lastMessage||"Yangi suhbat"}</small></span><i>{formatDate(c.updatedAt)}</i></button>):<div className="empty small-empty">Hali chat yo'q.</div>}
        </div>
        <div className="chat-window">{activeChat?<><div className="chat-window-head"><div><b>{chats.find(c=>c.id===activeChat)?.customerName||"Mijoz"}</b><span>Suhbat</span></div><button onClick={()=>setActiveChat(null)}>×</button></div><div className="messages">{messages.map(m=><div key={m.id} className={"bubble "+m.senderRole}><span>{m.body}</span><small>{formatDate(m.createdAt)}</small></div>)}</div><form className="chat-compose" onSubmit={sendChat}><input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="Mijozga javob yozing..." /><button className="primary" disabled={!chatText.trim()}>Yuborish</button></form></>:<div className="chat-placeholder"><b>Chatni tanlang</b><span>Mijoz bilan yozishmalar shu yerda ko'rinadi.</span></div>}</div>
      </section>}

      {(tab==="products"||tab==="inventory")&&<section className="panel"><div className="panel-head"><div><h2>{tab==="inventory"?"Ombor":"Mahsulotlar"}</h2><span className="muted">{filtered.length} ta natija</span></div><input className="mini-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Qidirish..." /></div>{loading?<div className="empty">Yuklanmoqda...</div>:filtered.length?<div className="table">{filtered.map(p=><div className="row" key={p.id}><div className="thumb">{p.imageUrl?<img src={p.imageUrl.split(/[\n|,]+/)[0]} alt=""/>:"NO IMAGE"}</div><div><b>{p.name}</b><span>{formatPrice(p.price)}</span></div><strong className={p.stock===0?"out":""}>{p.stock} dona</strong></div>)}</div>:<div className="empty"><b>Mahsulot topilmadi.</b><span>Qidiruvni o'zgartiring yoki yangi mahsulot qo'shing.</span></div>}</section>}

      {tab==="add"&&<section className="panel form-panel"><div className="panel-head"><div><h2>Yangi mahsulot</h2><span className="muted">Customer ko'radigan asosiy ma'lumotlar</span></div><span className="ai">AI READY</span></div><form onSubmit={submit}><label>Mahsulot nomi<input required maxLength={180} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Masalan: Yuz kremi"/></label><label>Tavsif<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Mahsulot tavsifi..." rows={5}/></label><div className="two"><label>Narx<input required min="0" step="0.01" type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Qoldiq<input required min="0" step="1" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label></div><label>Rasm URLlari<input value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="Bir nechta URL: yangi qator, | yoki vergul"/></label><button className="primary full" disabled={saving}>{saving?"Saqlanmoqda...":"Mahsulotni bazaga qo'shish"}</button>{message&&<div className="message">{message}</div>}</form></section>}

      {["marketing","analytics"].includes(tab)&&<section className="panel empty-panel"><span className="eyebrow">KEYINGI BOSQICH</span><h2>{nav.find(x=>x[0]===tab)?.[1]}</h2><p>Buyurtma va chatlar endi real API bilan ishlaydi. Bu bo'limlarni keyin Customer tajribasiga mos marketing va analitika bilan to'ldiramiz.</p></section>}
    </section>
  </main>;
}
