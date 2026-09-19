import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiFetchAuth, getApiStatus } from "./lib/api";
import {
  logout, signInWithApple, signInWithEmail, signInWithGoogle, signUpWithEmail,
  subscribeToAuth, syncCurrentUser,
} from "./lib/auth";
import type { User } from "firebase/auth";
import "./styles.css";

type ApiState = { status: "loading" } | { status: "online"; version: string } | { status: "offline"; message: string };
type Page = "dashboard"|"orders"|"customers"|"products"|"inventory"|"purchases"|"payments"|"delivery"|"reports"|"analytics"|"routes"|"visits"|"promotions"|"tasks"|"team"|"branches"|"integrations"|"settings";
type Row = { id:number; [key:string]: string|number };

const navGroups = [
  {label:"Overview",items:[["dashboard","Dashboard","⌂"],["analytics","Analytics","◒"]]},
  {label:"Sales",items:[["orders","Orders","↗"],["customers","Customers","◎"],["routes","Routes","⌁"],["visits","Visits","✓"],["promotions","Promotions","%"]]},
  {label:"Catalog & stock",items:[["products","Products","▦"],["inventory","Inventory","▤"],["purchases","Purchases","↓"],["delivery","Delivery","⇢"]]},
  {label:"Finance",items:[["payments","Payments & debts","₮"],["reports","Reports","▥"]]},
  {label:"Management",items:[["tasks","Tasks","☑"],["team","Team","♙"],["branches","Branches","⌂"],["integrations","Integrations","↔"]]},
  {label:"System",items:[["settings","Settings","⚙"]]},
] as const;

const customers0:Row[]=[
 {id:1,name:"Fresh Market",code:"CUS-001",phone:"+998 90 123 45 67",address:"Tashkent, Chilanzar",balance:"12,450,000",status:"Active"},
 {id:2,name:"Baraka Savdo",code:"CUS-002",phone:"+998 91 222 14 10",address:"Tashkent, Yunusabad",balance:"4,820,000",status:"Active"},
 {id:3,name:"Samarqand Trade",code:"CUS-003",phone:"+998 93 555 20 20",address:"Samarkand",balance:"0",status:"Active"},
 {id:4,name:"Fergana Retail",code:"CUS-004",phone:"+998 95 311 80 01",address:"Fergana",balance:"8,210,000",status:"Credit hold"},
];
const products0:Row[]=[
 {id:1,name:"Coca-Cola 1.5L",sku:"SKU-1001",category:"Beverages",unit:"pcs",price:"12,500",stock:"1,248",status:"In stock"},
 {id:2,name:"Nestle Water 0.5L",sku:"SKU-1002",category:"Beverages",unit:"pcs",price:"4,200",stock:"3,840",status:"In stock"},
 {id:3,name:"R.O.C.S. Toothpaste",sku:"SKU-1003",category:"Personal care",unit:"pcs",price:"38,000",stock:"96",status:"Low stock"},
 {id:4,name:"Ariel Powder 3kg",sku:"SKU-1004",category:"Home care",unit:"pcs",price:"72,000",stock:"410",status:"In stock"},
 {id:5,name:"Nescafe Classic",sku:"SKU-1005",category:"Grocery",unit:"pcs",price:"54,000",stock:"0",status:"Out of stock"},
];
const orders0:Row[]=[
 {id:1,order:"#SO-10482",customer:"Fresh Market",date:"19 Sep 2026",amount:"8,420,000",status:"Confirmed",payment:"Credit"},
 {id:2,order:"#SO-10481",customer:"Baraka Savdo",date:"19 Sep 2026",amount:"3,190,000",status:"Completed",payment:"Paid"},
 {id:3,order:"#SO-10480",customer:"Samarqand Trade",date:"18 Sep 2026",amount:"5,760,000",status:"Processing",payment:"Transfer"},
 {id:4,order:"#SO-10479",customer:"Fergana Retail",date:"18 Sep 2026",amount:"2,150,000",status:"Draft",payment:"Pending"},
 {id:5,order:"#SO-10478",customer:"Fresh Market",date:"17 Sep 2026",amount:"11,340,000",status:"Completed",payment:"Paid"},
];
const payments0:Row[]=[
 {id:1,ref:"PAY-8291",customer:"Baraka Savdo",date:"19 Sep 2026",amount:"3,190,000",method:"Card",status:"Paid"},
 {id:2,ref:"PAY-8290",customer:"Fresh Market",date:"18 Sep 2026",amount:"5,000,000",method:"Transfer",status:"Paid"},
 {id:3,ref:"PAY-8289",customer:"Fergana Retail",date:"17 Sep 2026",amount:"1,250,000",method:"Cash",status:"Pending"},
];
const inventory0:Row[]=[
 {id:1,warehouse:"Main Warehouse",product:"Coca-Cola 1.5L",sku:"SKU-1001",onHand:"1,248",reserved:"120",available:"1,128",status:"Healthy"},
 {id:2,warehouse:"Main Warehouse",product:"R.O.C.S. Toothpaste",sku:"SKU-1003",onHand:"96",reserved:"40",available:"56",status:"Low"},
 {id:3,warehouse:"Samarkand Branch",product:"Nestle Water 0.5L",sku:"SKU-1002",onHand:"2,400",reserved:"300",available:"2,100",status:"Healthy"},
 {id:4,warehouse:"Fergana Branch",product:"Nescafe Classic",sku:"SKU-1005",onHand:"0",reserved:"0",available:"0",status:"Out"},
];

function money(v:string|number){ return typeof v==="number" ? new Intl.NumberFormat("en-US").format(v) : v+" UZS"; }
function Badge({children}:{children:React.ReactNode}){ const s=String(children).toLowerCase(); const cls=s.includes("completed")||s.includes("paid")||s.includes("active")||s.includes("healthy")||s.includes("confirmed")||s.includes("in stock") ? "good" : s.includes("low")||s.includes("pending")||s.includes("processing")||s.includes("draft") ? "warn" : "bad"; return <span className={"badge "+cls}>{children}</span>; }

function App(){
 const [user,setUser]=useState<User|null>(null);
 const [api,setApi]=useState<ApiState>({status:"loading"});
 const [page,setPage]=useState<Page>("dashboard");
 const [sidebar,setSidebar]=useState(true);
 const [search,setSearch]=useState("");
 const [authOpen,setAuthOpen]=useState(false);
 const [authMode,setAuthMode]=useState<"signIn"|"signUp">("signIn");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [authBusy,setAuthBusy]=useState(false); const [authError,setAuthError]=useState("");
 const [toast,setToast]=useState("");
 const [customers,setCustomers]=useState(customers0); const [products,setProducts]=useState(products0); const [orders,setOrders]=useState(orders0);\n useEffect(()=>{ if(!user) return; let cancelled=false; void user.getIdToken().then(token=>token && apiFetchAuth<any>("/api/v1/data/bootstrap",token)).then(data=>{ if(cancelled||!data) return; setCustomers(data.customers.map((x:any)=>({id:x.id,name:x.name,code:x.code,phone:x.phone||"—",address:x.address||"—",balance:x.creditLimit||"0",status:x.isActive?"Active":"Inactive"}))); setProducts(data.products.map((x:any)=>({id:x.id,name:x.name,sku:x.sku,category:"—",unit:x.unit,price:x.salePrice,stock:"—",status:x.isActive?"In stock":"Inactive"}))); setOrders(data.orders.map((x:any)=>({id:x.id,order:"#SO-"+x.orderNumber,customer:x.customerName||"—",date:new Date(x.createdAt).toLocaleDateString(),amount:x.total,status:x.status,payment:"Pending"}))); }).catch(e=>console.error("Bootstrap failed",e)); return ()=>{cancelled=true}; },[user]);
 useEffect(()=>subscribeToAuth(setUser),[]);
 useEffect(()=>{getApiStatus().then(d=>setApi({status:"online",version:d.version})).catch(e=>setApi({status:"offline",message:e instanceof Error?e.message:"offline"}))},[]);
 useEffect(()=>{if(user) void syncCurrentUser().catch(e=>console.error(e))},[user]);
 useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),2800);return()=>clearTimeout(t)}},[toast]);
 const runAuth=async(fn:()=>Promise<unknown>)=>{setAuthBusy(true);setAuthError("");try{await fn();await syncCurrentUser();setAuthOpen(false);setPassword("");setToast("Welcome to MyBusiness.");}catch(e){setAuthError(e instanceof Error?e.message:"Authentication failed")}finally{setAuthBusy(false)}};
 const title=page==="dashboard"?"Dashboard":page==="analytics"?"Analytics & BI":navGroups.flatMap(g=>g.items).find(x=>x[0]===page)?.[1]||"MyBusiness";
 const visibleCustomers=useMemo(()=>customers.filter(r=>Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase())),[customers,search]);
 const visibleProducts=useMemo(()=>products.filter(r=>Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase())),[products,search]);
 const visibleOrders=useMemo(()=>orders.filter(r=>Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase())),[orders,search]);

 if(!user) return <Welcome api={api} openAuth={()=>setAuthOpen(true)} authOpen={authOpen} setAuthOpen={setAuthOpen} authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} authBusy={authBusy} authError={authError} runAuth={runAuth} setAuthError={setAuthError}/>;

 return <div className="workspace">
   <aside className={"sidebar "+(sidebar?"":"collapsed")}>
    <div className="side-brand"><span className="logo">M</span>{sidebar&&<><strong>MyBusiness</strong><span className="workspace-label">Workspace</span></>}</div>
    <div className="company-switch">{sidebar?<><span className="company-dot">F</span><span><b>{user.displayName||"My Company"}</b><small>Owner · UZS</small></span><span className="chev">⌄</span></>:<span className="company-dot">F</span>}</div>
    <nav className="side-nav">{navGroups.map(g=><div className="nav-group" key={g.label}>{sidebar&&<div className="nav-label">{g.label}</div>}{g.items.map(i=><button key={i[0]} className={"nav-item "+(page===i[0]?"active":"")} onClick={()=>{setPage(i[0] as Page);setSearch("")}}><span className="nav-icon">{i[2]}</span>{sidebar&&<span>{i[1]}</span>}</button>)}</div>)}</nav>
    {sidebar&&<div className="side-bottom"><div className="api-mini"><i></i><span><b>System online</b><small>{api.status==="online"?"All services operational":"Checking services"}</small></span></div><button className="profile-mini" onClick={()=>setPage("settings")}><span className="avatar">{(user.displayName||user.email||"U").charAt(0).toUpperCase()}</span><span><b>{user.displayName||"Account"}</b><small>{user.email||"Signed in"}</small></span></button></div>}
   </aside>
   <div className="main-area">
    <header className="appbar"><button className="icon-btn" onClick={()=>setSidebar(v=>!v)}>☰</button><div className="crumb"><span>MyBusiness</span><b>/</b><strong>{title}</strong></div><div className="appbar-actions"><button className="icon-btn">⌕</button><button className="icon-btn notif">◔<i></i></button><div className="user-menu"><span className="avatar">{(user.displayName||user.email||"U").charAt(0).toUpperCase()}</span><span className="user-name">{user.displayName||user.email||"Account"}</span><button className="icon-btn" onClick={()=>setPage("settings")}>⌄</button></div></div></header>
    <main className="content"><PageView page={page} search={search} setSearch={setSearch} customers={visibleCustomers} products={visibleProducts} orders={visibleOrders} setCustomers={setCustomers} setProducts={setProducts} setOrders={setOrders} toast={setToast} go={setPage}/></main>
   </div>
   {toast&&<div className="toast">✓ {toast}</div>}
 </div>;
}

function Welcome(p:any){return <div className="landing"><header className="landing-nav"><div className="brand"><span className="logo">M</span><b>MyBusiness</b></div><div><button className="button ghost" onClick={p.openAuth}>Sign in</button><button className="button dark" onClick={()=>{p.setAuthMode("signUp");p.openAuth()}}>Create account</button></div></header><section className="landing-hero"><div><span className="eyebrow">Distribution operating system</span><h1>Your business.<br/><em>One workspace.</em></h1><p>Orders, customers, products, inventory, finance, delivery and performance — connected in one operational system.</p><div className="hero-actions"><button className="button primary" onClick={()=>{p.setAuthMode("signUp");p.openAuth()}}>Create workspace →</button><button className="button ghost" onClick={p.openAuth}>Sign in</button></div><div className="landing-proof"><span>● Live operations</span><span>● PostgreSQL</span><span>● Role-based access</span></div></div><div className="landing-screen"><div className="screen-top"><b>Business overview</b><Badge>Live</Badge></div><div className="screen-metrics"><div><small>Revenue</small><b>284.6M</b><span>+12.8%</span></div><div><small>Orders</small><b>1,284</b><span>+8.4%</span></div><div><small>Receivables</small><b>42.8M</b><span>18 accounts</span></div><div><small>Stock value</small><b>691M</b><span>Healthy</span></div></div><div className="fake-chart"><div className="chart-title"><b>Sales performance</b><small>Last 30 days</small></div><div className="bars">{[42,55,48,68,61,75,58,82,72,90,78,96].map((h,i)=><i style={{height:h+"%"}} key={i}></i>)}</div></div></div></section>{p.authOpen&&<AuthModal {...p}/>}</div>}

function AuthModal(p:any){return <div className="modal-backdrop" onClick={()=>!p.authBusy&&p.setAuthOpen(false)}><div className="auth-modal" onClick={(e:any)=>e.stopPropagation()}><button className="modal-close" onClick={()=>p.setAuthOpen(false)}>×</button><span className="eyebrow">{p.authMode==="signIn"?"Welcome back":"Get started"}</span><h2>{p.authMode==="signIn"?"Sign in to your workspace":"Create your workspace"}</h2><p>{p.authMode==="signIn"?"Continue where you left off.":"Set up your business workspace in a few seconds."}</p><div className="social-auth"><button className="button outline" disabled={p.authBusy} onClick={()=>p.runAuth(signInWithGoogle)}>G <span>Continue with Google</span></button><button className="button outline" disabled={p.authBusy} onClick={()=>p.runAuth(signInWithApple)}> <span>Continue with Apple</span></button></div><div className="or"><span>or continue with email</span></div><form onSubmit={(e:any)=>{e.preventDefault();void p.runAuth(()=>p.authMode==="signIn"?signInWithEmail(p.email,p.password):signUpWithEmail(p.email,p.password))}}><label>Email<input type="email" value={p.email} onChange={(e:any)=>p.setEmail(e.target.value)} autoComplete="email" required placeholder="you@company.com"/></label><label>Password<input type="password" value={p.password} onChange={(e:any)=>p.setPassword(e.target.value)} minLength={6} required placeholder="••••••••"/></label>{p.authError&&<div className="auth-error">{p.authError}</div>}<button className="button primary full" disabled={p.authBusy}>{p.authBusy?"Please wait…":p.authMode==="signIn"?"Sign in":"Create account"}</button></form><button className="switch-auth" onClick={()=>{p.setAuthMode(p.authMode==="signIn"?"signUp":"signIn");p.setAuthError("")}}>{p.authMode==="signIn"?"Create a new account":"I already have an account"}</button></div></div>}

function PageView({page,search,setSearch,customers,products,orders,setCustomers,setProducts,setOrders,toast,go}:any){
 if(page==="dashboard") return <Dashboard go={go}/>;
 if(page==="analytics") return <Analytics/>;
 if(page==="customers") return <DataPage title="Customers" subtitle="Manage accounts, contacts, credit and receivables." search={search} setSearch={setSearch} action="Add customer" rows={customers} columns={["name","code","phone","address","balance","status"]} setRows={setCustomers} toast={toast}/>;
 if(page==="products") return <DataPage title="Products" subtitle="Your master catalog, pricing and SKU data." search={search} setSearch={setSearch} action="Add product" rows={products} columns={["name","sku","category","unit","price","stock","status"]} setRows={setProducts} toast={toast}/>;
 if(page==="orders") return <DataPage title="Orders" subtitle="Every order from draft to delivery and payment." search={search} setSearch={setSearch} action="New order" rows={orders} columns={["order","customer","date","amount","status","payment"]} setRows={setOrders} toast={toast}/>;
 const generic:Record<string,{sub:string;cards:string[];action?:string}>={
 inventory:{sub:"Control stock across warehouses, branches and products.",cards:["Stock overview","Low stock","Movements","Transfers"],action:"Stock transfer"},
 purchases:{sub:"Receive goods, supplier documents and purchasing workflow.",cards:["Purchase orders","Receipts","Suppliers","Purchase history"],action:"New purchase"},
 payments:{sub:"Track cash, transfers, invoices and customer debt.",cards:["Collected today","Outstanding debt","Overdue","Cash & bank"],action:"Record payment"},
 delivery:{sub:"Plan shipments, drivers, delivery status and proof of delivery.",cards:["To prepare","In transit","Delivered","Exceptions"],action:"Create delivery"},
 reports:{sub:"Build operational reports with filters, grouping and export.",cards:["Sales report","Customer debt","Stock report","Profitability"],action:"New report"},
 routes:{sub:"Plan field routes and assign sales representatives.",cards:["Today's routes","Unvisited","Completed","Coverage"],action:"Create route"},
 visits:{sub:"Digital visit checklist, outcomes, notes and evidence.",cards:["Today's visits","Successful","Orders created","No order"],action:"Start visit"},
 promotions:{sub:"Plan promotions, target outlets and measure execution.",cards:["Active promos","Planned","Redemption","ROI"],action:"New promotion"},
 tasks:{sub:"Turn operational signals into owned, time-bound actions.",cards:["My tasks","Overdue","In review","Completed"],action:"Create task"},
 team:{sub:"Manage users, roles, responsibilities and access.",cards:["Team members","Roles","Activity","Invitations"],action:"Invite member"},
 branches:{sub:"Manage branches, warehouses and operating locations.",cards:["Branches","Warehouses","Active locations","Transfers"],action:"Add branch"},
 integrations:{sub:"Connect ERP, payment, fiscal and data exchange systems.",cards:["Connected","Sync health","Errors","Logs"],action:"Add integration"},
 settings:{sub:"Company profile, security, roles, notifications and preferences.",cards:["Company profile","Security","Notifications","Billing"],action:"Save changes"},
 };
 const g=generic[page]; return <GenericPage title={page==="settings"?"Settings":navGroups.flatMap(x=>x.items).find(x=>x[0]===page)?.[1]||"Module"} subtitle={g.sub} cards={g.cards} action={g.action} toast={toast} page={page}/>;
}

function Dashboard({go}:{go:(p:Page)=>void}){return <div><PageHeader title="Good evening 👋" subtitle="Here’s what is happening across your business today." actions={<><button className="button outline" onClick={()=>go("reports")}>View reports</button><button className="button primary" onClick={()=>go("orders")}>+ New order</button></>}/><div className="dashboard-grid">{[["Today's sales","28.46M UZS","+12.8% vs yesterday","↗","good"],["Orders","126","+8.4%","↗","good"],["Outstanding debt","42.8M UZS","18 customers","₮","warn"],["Stock alerts","14","5 critical","!","bad"]].map((x:any)=><div className="kpi" key={x[0]}><div><small>{x[0]}</small><b>{x[1]}</b><span className={x[4]}>{x[2]}</span></div><i>{x[3]}</i></div>)}</div><div className="dashboard-columns"><section className="panel chart-panel"><PanelHead title="Sales performance" action="Last 30 days"/><div className="big-chart"><div className="ylabels"><span>30M</span><span>20M</span><span>10M</span><span>0</span></div><div className="chart-area">{[35,42,38,55,48,65,54,72,68,82,74,91,84,96].map((h,i)=><i key={i} style={{height:h+"%"}}></i>)}</div></div></section><section className="panel"><PanelHead title="Order pipeline" action="View all" onClick={()=>go("orders")}/><div className="pipeline">{[["Draft","12","orders"],["Confirmed","38","orders"],["Processing","24","orders"],["Completed","52","orders"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small><div className="progress"><i style={{width:(Number(x[1])*1.7)+"%"}}></i></div></div>)}</div></section></div><div className="dashboard-columns"><section className="panel"><PanelHead title="Recent orders" action="Open orders" onClick={()=>go("orders")}/><Table rows={orders0.slice(0,4)} columns={["order","customer","amount","status"]}/></section><section className="panel"><PanelHead title="Stock alerts" action="Inventory" onClick={()=>go("inventory")}/><div className="alert-list">{[["Nescafe Classic","Out of stock","0 pcs","bad"],["R.O.C.S. Toothpaste","Low stock","96 pcs","warn"],["Ariel Powder 3kg","Reorder soon","410 pcs","warn"]].map(x=><div key={x[0]}><span className={"stock-symbol "+x[3]}>!</span><span><b>{x[0]}</b><small>{x[1]}</small></span><strong>{x[2]}</strong></div>)}</div></section></div></div>}

function Analytics(){return <div><PageHeader title="Analytics & BI" subtitle="Turn sales, inventory, field work and finance into decisions." actions={<button className="button outline">Export</button>}/><div className="filterbar"><button>Last 30 days⌄</button><button>All branches⌄</button><button>All sales reps⌄</button><span className="filter-note">Updated just now</span></div><div className="analytics-grid">{["Revenue","Order volume","Average order","Collection rate"].map((x,i)=><div className="kpi" key={x}><div><small>{x}</small><b>{["284.6M","1,284","221,650","86.4%"][i]}</b><span className="good">↗ {["+12.8%","+8.4%","+4.1%","+2.3%"][i]}</span></div><i>↗</i></div>)}</div><div className="panel report-builder"><PanelHead title="Management report" action="Configure"/><div className="report-tabs"><b>Sales</b><span>Inventory</span><span>Customers</span><span>Field execution</span><span>Finance</span></div><Table rows={orders0} columns={["order","customer","date","amount","status","payment"]}/></div></div>}

function DataPage({title,subtitle,search,setSearch,action,rows,columns,setRows,toast}:any){const [open,setOpen]=useState(false);return <div><PageHeader title={title} subtitle={subtitle} actions={<button className="button primary" onClick={()=>setOpen(true)}>+ {action}</button>}/><div className="toolbar"><div className="searchbox">⌕<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={"Search "+title.toLowerCase()+"..."}/></div><button className="filter-btn">Filter⌄</button><button className="filter-btn">Columns⌄</button><span className="toolbar-count">{rows.length} records</span></div><section className="panel table-panel"><Table rows={rows} columns={columns}/></section>{open&&<QuickAdd title={action} close={()=>setOpen(false)} save={(name:string)=>{setRows([...rows,{id:Date.now(),name,code:"NEW-"+Date.now().toString().slice(-4),status:"Active"}]);setOpen(false);toast(action+" saved successfully.")}}/>}</div>}

function GenericPage({title,subtitle,cards,action,toast,page}:any){return <div><PageHeader title={title} subtitle={subtitle} actions={action&&<button className="button primary" onClick={()=>toast(action+" form opened.")}>+ {action}</button>}/><div className="module-stat-grid">{cards.map((c:string,i:number)=><div className="module-stat" key={c}><span className="module-stat-icon">{["◒","!","✓","↗"][i%4]}</span><small>{c}</small><b>{["284","14","86.4%","42"][i]}</b><span className={i===1?"warn":"good"}>{i===1?"Needs attention":"Updated today"}</span></div>)}</div><section className="panel module-workspace"><PanelHead title={page==="settings"?"Company settings":"Operational workspace"} action="Configure"/><div className="empty-work"><div className="empty-icon">{page==="settings"?"⚙":"◈"}</div><h3>{page==="settings"?"Configure your workspace":"Your workflow is ready"}</h3><p>Use the controls above to manage this area. MyBusiness keeps the records, permissions, history and reporting connected.</p><div className="quick-actions"><button className="button outline" onClick={()=>toast("Import workflow opened.")}>Import data</button><button className="button outline" onClick={()=>toast("Export prepared.")}>Export</button><button className="button primary" onClick={()=>toast((action||"Action")+" started.")}>{action||"Get started"} →</button></div></div></section></div>}

function QuickAdd({title,close,save}:{title:string;close:()=>void;save:(v:string)=>void}){const [v,setV]=useState("");return <div className="modal-backdrop"><div className="quick-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Quick create</span><h2>{title}</h2><label>Name<input autoFocus value={v} onChange={e=>setV(e.target.value)} placeholder="Enter a name"/></label><div className="modal-actions"><button className="button outline" onClick={close}>Cancel</button><button className="button primary" disabled={!v.trim()} onClick={()=>save(v.trim())}>Save</button></div></div></div>}

function PageHeader({title,subtitle,actions}:{title:string;subtitle:string;actions?:React.ReactNode}){return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="header-actions">{actions}</div></div>}
function PanelHead({title,action,onClick}:{title:string;action?:string;onClick?:()=>void}){return <div className="panel-head"><h2>{title}</h2>{action&&<button onClick={onClick}>{action} →</button>}</div>}
function Table({rows,columns}:{rows:Row[];columns:string[]}){const labels:Record<string,string>={name:"Name",code:"Code",phone:"Phone",address:"Address",balance:"Balance",status:"Status",sku:"SKU",category:"Category",unit:"Unit",price:"Price",stock:"Stock",order:"Order",customer:"Customer",date:"Date",amount:"Amount",payment:"Payment",warehouse:"Warehouse",product:"Product",onHand:"On hand",reserved:"Reserved",available:"Available",method:"Method",ref:"Reference"};return <div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c}>{labels[c]||c}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{columns.map(c=><td key={c}>{c==="status"||c==="payment"?<Badge>{r[c]}</Badge>:c==="amount"||c==="balance"||c==="price"?<b>{money(r[c])}</b>:String(r[c]??"—")}</td>)}</tr>)}</tbody></table></div>}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
