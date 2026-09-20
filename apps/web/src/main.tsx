import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiFetchAuth, getApiStatus } from "./lib/api";
import {
  logout,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  subscribeToAuth,
  syncCurrentUser,
  getAuthErrorMessage,
} from "./lib/auth";
import type { User } from "firebase/auth";
import "./styles.css";

type Page =
  | "dashboard" | "orders" | "customers" | "products" | "inventory"
  | "purchases" | "payments" | "delivery" | "reports" | "analytics"
  | "routes" | "visits" | "promotions" | "tasks" | "team" | "branches"
  | "warehouses" | "suppliers" | "transfers" | "stockMovements"
  | "auditLogs" | "notifications" | "lowStock" | "integrations" | "settings";
type Row = Record<string, any>;
type ApiState =
  | { status: "loading" }
  | { status: "online"; version: string }
  | { status: "offline"; message: string };

const navGroups: any[] = [
  { label: "Обзор", items: [["dashboard", "Панель управления", "⌂"], ["analytics", "Аналитика и BI", "◒"]] },
  { label: "Продажи", items: [["orders", "Заказы", "↗"], ["customers", "Клиенты", "◎"], ["routes", "Маршруты", "⌁"], ["visits", "Визиты", "✓"], ["promotions", "Акции", "%"]] },
  { label: "Каталог и запасы", items: [["products", "Товары", "▦"], ["inventory", "Остатки", "▤"], ["lowStock", "Низкие остатки", "!"], ["purchases", "Закупки", "↓"], ["suppliers", "Поставщики", "♢"], ["warehouses", "Склады", "⌂"], ["transfers", "Перемещения", "⇄"], ["stockMovements", "Движения запасов", "↕"], ["delivery", "Доставка", "⇢"]] },
  { label: "Финансы", items: [["payments", "Платежи и задолженность", "₮"], ["reports", "Отчёты", "▥"]] },
  { label: "Управление", items: [["tasks", "Задачи", "☑"], ["team", "Команда", "♙"], ["branches", "Филиалы", "⌂"], ["auditLogs", "Журнал аудита", "▤"], ["notifications", "Уведомления", "◔"]] },
  { label: "Система", items: [["settings", "Настройки", "⚙"]] },
];

const cfg: any = {
  customers: { title: "Клиенты", sub: "Контакты, кредитные лимиты и история клиентов.", endpoint: "customers", action: "Добавить клиента", fields: [["name", "Имя"], ["phone", "Телефон"], ["address", "Адрес"], ["creditLimit", "Кредитный лимит"]], cols: ["name", "code", "phone", "creditLimit", "isActive"] },
  products: { title: "Товары", sub: "Каталог, SKU, штрихкоды, себестоимость и цены продажи.", endpoint: "products", action: "Добавить товар", fields: [["name", "Название"], ["sku", "SKU"], ["unit", "Единица"], ["barcode", "Штрихкод"], ["costPrice", "Себестоимость"], ["salePrice", "Цена продажи"]], cols: ["name", "sku", "unit", "costPrice", "salePrice", "isActive"] },
  orders: { title: "Заказы", sub: "Жизненный цикл заказа: от черновика до подтверждения и завершения.", endpoint: "orders", action: "Новый заказ", fields: [["customerId", "Клиент"], ["notes", "Примечания"]], cols: ["orderNumber", "customer", "status", "total", "createdAt"] },
  inventory: { title: "Остатки", sub: "Остатки по складам и SKU в реальном времени.", endpoint: "inventory", action: "Перемещение запасов", fields: [], cols: ["warehouse", "product", "sku", "quantity"] },
  purchases: { title: "Закупки", sub: "Закупки у поставщиков и приёмка поступивших запасов.", endpoint: "purchases", action: "Новая закупка", fields: [["name", "Поставщик"], ["phone", "Телефон"]], cols: ["name", "code", "phone"] },
  payments: { title: "Платежи и задолженность", sub: "Платежи, ссылки на операции и контроль дебиторской задолженности.", endpoint: "payments", action: "Записать платёж", fields: [["orderId", "Заказ"], ["customerId", "Клиент"], ["amount", "Сумма"], ["method", "Способ"], ["reference", "Назначение"]], cols: ["customerId", "amount", "method", "status", "reference", "createdAt"] },
  delivery: { title: "Доставка", sub: "Подготовка, отправка, отслеживание и подтверждение доставки.", endpoint: "deliveries", action: "Создать доставку", fields: [["orderId", "Заказ"], ["address", "Адрес"], ["plannedAt", "Плановое время"]], cols: ["orderNumber", "customer", "status", "address", "plannedAt"] },
  routes: { title: "Маршруты", sub: "Планирование маршрутов и назначение ответственных за визиты.", endpoint: "routes", action: "Создать маршрут", fields: [["name", "Название маршрута"], ["routeDate", "Дата"], ["notes", "Примечания"]], cols: ["name", "routeDate", "status", "notes"] },
  visits: { title: "Визиты", sub: "Цифровые визиты к клиентам, результаты, заметки и история выполнения.", endpoint: "visits", action: "Начать визит", fields: [["customerId", "Клиент"], ["routeId", "Маршрут"], ["notes", "Примечания"]], cols: ["customer", "status", "outcome", "notes", "createdAt"] },
  promotions: { title: "Акции", sub: "Планирование акций, целевые клиенты и контроль выполнения.", endpoint: "promotions", action: "Новая акция", fields: [["name", "Название"], ["discount", "Скидка"], ["startDate", "Начало"], ["endDate", "Окончание"], ["notes", "Примечания"]], cols: ["name", "status", "discount", "startDate", "endDate"] },
  tasks: { title: "Задачи", sub: "Рабочие сигналы превращаются в ответственные действия с контролем сроков.", endpoint: "tasks", action: "Создать задачу", fields: [["title", "Название"], ["description", "Описание"], ["priority", "Приоритет"], ["dueAt", "Срок"]], cols: ["title", "status", "priority", "dueAt"] },
  team: { title: "Команда", sub: "Пользователи и доступ внутри компании.", endpoint: "team", action: "", fields: [], cols: ["fullName", "email", "phone", "status", "createdAt"] },
  branches: { title: "Филиалы", sub: "Рабочие точки, склады и управление на уровне филиалов.", endpoint: "branches", action: "Добавить филиал", fields: [["name", "Название"], ["code", "Код"], ["address", "Адрес"], ["phone", "Телефон"]], cols: ["name", "code", "address", "phone", "isActive"] },
    reports: { title: "Отчёты", sub: "Сводные показатели на основе реальных данных рабочего пространства.", endpoint: "reports/summary", action: "Обновить", fields: [], cols: ["metric", "value"] },
  suppliers: { title: "Поставщики", sub: "Данные поставщиков для закупок и приёмки.", endpoint: "suppliers", action: "Добавить поставщика", fields: [["name", "Название"], ["phone", "Телефон"], ["address", "Адрес"]], cols: ["name", "code", "phone", "address", "createdAt"] },
  warehouses: { title: "Склады", sub: "Склады и контроль запасов на уровне филиалов.", endpoint: "warehouses", action: "Добавить склад", fields: [["branchId", "Филиал"], ["name", "Название"], ["code", "Код"]], cols: ["name", "code", "branchId", "isActive"] },
  transfers: { title: "Перемещения", sub: "Перемещение запасов между складами с полной историей операций.", endpoint: "transfers", action: "Новое перемещение", fields: [["fromWarehouseId", "Склад-источник"], ["toWarehouseId", "Склад-получатель"], ["productId", "Товар"], ["quantity", "Количество"], ["notes", "Примечания"]], cols: ["id", "status", "fromWarehouseId", "toWarehouseId", "createdAt"] },
  stockMovements: { title: "Движения запасов", sub: "Поступления, продажи, перемещения, корректировки и возвраты в едином журнале.", endpoint: "stock-movements", action: "Обновить журнал", fields: [], cols: ["type", "warehouseId", "productId", "quantity", "referenceType", "createdAt"] },
  auditLogs: { title: "Журнал аудита", sub: "История важных действий в пределах компании.", endpoint: "audit-logs", action: "Обновить", fields: [], cols: ["action", "entityType", "entityId", "createdAt"] },
  notifications: { title: "Уведомления", sub: "Системные оповещения и персональные сообщения.", endpoint: "notifications", action: "Обновить", fields: [], cols: ["title", "body", "readAt", "createdAt"] },
  lowStock: { title: "Низкие остатки", sub: "Товары на уровне или ниже установленного порога.", endpoint: "inventory/low-stock?threshold=5", action: "Обновить", fields: [], cols: ["warehouse", "product", "sku", "quantity"] },
};

function Badge({ children }: { children: any }) {
  const s = String(children ?? "").toLowerCase();
  const cls =
    s.includes("completed") || s.includes("paid") || s.includes("active") || s.includes("healthy") || s.includes("confirmed") || s.includes("delivered")
      ? "good"
      : s.includes("low") || s.includes("pending") || s.includes("processing") || s.includes("draft") || s.includes("planned") || s.includes("in_progress")
        ? "warn"
        : "bad";
  return <span className={"badge " + cls}>{children ?? "—"}</span>;
}
function money(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat("ru-RU").format(n) + " UZS" : String(v ?? "—");
}
function label(k: string) {
  return ({
    creditLimit: "Кредитный лимит", costPrice: "Себестоимость", salePrice: "Цена", isActive: "Статус",
    orderNumber: "Заказ", createdAt: "Создано", routeDate: "Дата", dueAt: "Срок", startDate: "Начало",
    endDate: "Окончание", lastSyncAt: "Последняя синхронизация", customerId: "Клиент",
    warehouse: "Склад", product: "Товар", quantity: "Количество", status: "Статус", total: "Итого",
    amount: "Сумма", method: "Способ", reference: "Назначение", notes: "Примечания",
    address: "Адрес", plannedAt: "Плановое время", outcome: "Результат", discount: "Скидка",
    branchId: "Филиал", fromWarehouseId: "Склад-источник", toWarehouseId: "Склад-получатель",
    productId: "Товар", type: "Тип", warehouseId: "Склад", referenceType: "Тип операции",
    action: "Действие", entityType: "Тип объекта", entityId: "ID объекта", title: "Название",
    body: "Сообщение", readAt: "Прочитано", metric: "Показатель", value: "Значение",
    sku: "Артикул", unit: "Единица", barcode: "Штрихкод", phone: "Телефон", code: "Код",
    name: "Ф.И.О", fullName: "Имя", email: "Электронная почта", priority: "Приоритет", description: "Описание",
    provider: "Провайдер", endpoint: "Адрес подключения", customer: "Клиент",
  } as any)[k] || "Поле";
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebar, setSidebar] = useState(true);
  const [api, setApi] = useState<ApiState>({ status: "loading" });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState("");
  const [accountReady, setAccountReady] = useState(false);
  const [loadingDots, setLoadingDots] = useState(".");

  useEffect(() => subscribeToAuth(setUser), []);
  useEffect(() => {
    getApiStatus().then(x => setApi({ status: "online", version: x.version })).catch(e => setApi({ status: "offline", message: String(e) }));
  }, []);
  useEffect(() => {
    let active = true;
    setAccountReady(!user ? false : false);
    if (!user) return () => { active = false; };
    void syncCurrentUser().then(() => { if (active) setAccountReady(true); }).catch((e) => { console.error(e); if (active) setAccountReady(false); });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (accountReady) return;
    const timer = window.setInterval(() => {
      setLoadingDots(current => current === "..." ? "." : current + ".");
    }, 450);
    return () => window.clearInterval(timer);
  }, [accountReady]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const runAuth = async (fn: () => Promise<any>) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      await fn();
      await syncCurrentUser();
      setAuthOpen(false);
      setToast("Добро пожаловать в МойБизнес.");
    } catch (e) {
      setAuthError(getAuthErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  if (!user) {
    return <Welcome api={api} open={() => setAuthOpen(true)} authOpen={authOpen} mode={authMode}
      setMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword}
      busy={authBusy} error={authError} setError={setAuthError} runAuth={runAuth} />;
  }

  if (!accountReady) {
    return <div className="landing"><div className="empty-work"><h2>Подготовка рабочего пространства{loadingDots}</h2><p>Проверяем доступ к данным компании.</p></div></div>;
  }

  const title =
    page === "dashboard" ? "Панель управления" :
    page === "analytics" ? "Аналитика и BI" :
    page === "settings" ? "Настройки" : (cfg[page]?.title || "МойБизнес");

  return (
    <div className="workspace">
      <aside className={"sidebar " + (sidebar ? "" : "collapsed")}>
        <div className="side-brand"><span className="logo">M</span>{sidebar && <><strong>МойБизнес</strong><span className="workspace-label">Рабочее пространство</span></>}</div>
        <div className="company-switch">
          {sidebar ? <><span className="company-dot">{(user.displayName || "M").charAt(0)}</span><span><b>{user.displayName || "Моя компания"}</b><small>Владелец · UZS</small></span></> : <span className="company-dot">M</span>}
        </div>
        <nav className="side-nav">
          {navGroups.map(g => <div className="nav-group" key={g.label}>{sidebar && <div className="nav-label">{g.label}</div>}
            {g.items.map((i: any) => <button className={"nav-item " + (page === i[0] ? "active" : "")} key={i[0]} onClick={() => setPage(i[0])}><span className="nav-icon">{i[2]}</span>{sidebar && <span>{i[1]}</span>}</button>)}
          </div>)}
        </nav>
        {sidebar && <div className="side-bottom">
          <div className="api-mini"><i></i><span><b>Система {api.status === "online" ? "работает" : "проверяется"}</b><small>{api.status === "online" ? "Сервисы работают" : "Статус API"}</small></span></div>
          <button className="profile-mini" onClick={() => setPage("settings")}><span className="avatar">{(user.displayName || user.email || "П").charAt(0).toUpperCase()}</span><span><b>{user.displayName || "Аккаунт"}</b><small>{user.email || "Выполнен вход"}</small></span></button>
        </div>}
      </aside>

      <div className="main-area">
        <header className="appbar">
          <button className="icon-btn" onClick={() => setSidebar(v => !v)}>☰</button>
          <div className="crumb"><span>МойБизнес</span><b>/</b><strong>{title}</strong></div>
          <div className="appbar-actions">
            <button className="icon-btn" onClick={() => setToast("Используйте поиск и фильтры раздела, чтобы найти записи.")}>⌕</button>
            <button className="icon-btn" onClick={() => setToast("Уведомления доступны в разделе «Уведомления».")}>◔</button>
            <div className="user-menu"><span className="avatar">{(user.displayName || user.email || "П").charAt(0).toUpperCase()}</span><span className="user-name">{user.displayName || user.email}</span><button className="icon-btn" onClick={() => logout()}>↪</button></div>
          </div>
        </header>
        <main className="content"><PageView page={page} tokenUser={user} toast={setToast} go={setPage} api={api} /></main>
      </div>
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Welcome(p: any) {
  return <div className="landing">
    <header className="landing-nav"><div className="brand"><span className="logo">M</span><b>МойБизнес</b></div><div><button className="button ghost" onClick={p.open}>Войти</button><button className="button dark" onClick={() => { p.setMode("signUp"); p.open(); }}>Создать аккаунт</button></div></header>
    <section className="landing-hero">
      <div>
        <span className="eyebrow">Операционная система дистрибуции</span>
        <h1>Ваш бизнес.<br /><em>В одном пространстве.</em></h1>
        <p>Заказы, клиенты, товары, остатки, финансы, работа на маршрутах и отчётность в единой системе.</p>
        <div className="hero-actions"><button className="button primary" onClick={() => { p.setMode("signUp"); p.open(); }}>Создать рабочее пространство →</button><button className="button ghost" onClick={p.open}>Войти</button></div>
        <div className="landing-proof"><span>● Операции в реальном времени</span><span>● PostgreSQL</span><span>● Доступ по ролям</span></div>
      </div>
      <div className="landing-screen">
        <div className="screen-top"><b>Обзор бизнеса</b><Badge>В реальном времени</Badge></div>
        <div className="screen-metrics">
          <div><small>Данные</small><b>Подключено</b><span>PostgreSQL</span></div>
          <div><small>Операции</small><b>18 модулей</b><span>Готово</span></div>
          <div><small>Безопасность</small><b>В рамках компании</b><span>Авторизация Firebase</span></div>
          <div><small>API</small><b>Работает</b><span>Контролируется</span></div>
        </div>
        <div className="fake-chart"><div className="chart-title"><b>Рабочее пространство</b><small>Данные в реальном времени</small></div><div className="bars">{[42,55,48,68,61,75,58,82,72,90,78,96].map((h,i) => <i style={{ height: h + "%" }} key={i}></i>)}</div></div>
      </div>
    </section>
    {p.authOpen && <AuthModal {...p} />}
  </div>;
}

function AuthModal(p: any) {
  return <div className="modal-backdrop" onClick={() => !p.busy && p.setAuthOpen(false)}>
    <div className="auth-modal" onClick={(e: any) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => p.setAuthOpen(false)}>×</button>
      <span className="eyebrow">{p.mode === "signIn" ? "С возвращением" : "Начало работы"}</span>
      <h2>{p.mode === "signIn" ? "Войти в рабочее пространство" : "Создать рабочее пространство"}</h2>
      <p>Безопасный доступ к рабочему пространству вашей компании.</p>
      <div className="social-auth">
        <button className="button outline" disabled={p.busy} onClick={() => p.runAuth(signInWithGoogle)}>G <span>Продолжить с Google</span></button>
        <button className="button outline" disabled={p.busy} onClick={() => p.runAuth(signInWithApple)}> <span>Продолжить с Apple</span></button>
      </div>
      <div className="or"><span>или продолжить по электронной почте</span></div>
      <form onSubmit={(e: any) => { e.preventDefault(); void p.runAuth(() => p.mode === "signIn" ? signInWithEmail(p.email, p.password) : signUpWithEmail(p.email, p.password)); }}>
        <label>Электронная почта<input type="email" value={p.email} onChange={(e: any) => p.setEmail(e.target.value)} required /></label>
        <label>Пароль<input type="password" value={p.password} onChange={(e: any) => p.setPassword(e.target.value)} minLength={6} required /></label>
        {p.error && <div className="auth-error">{p.error}</div>}
        <button className="button primary full" disabled={p.busy}>{p.busy ? "Подождите…" : p.mode === "signIn" ? "Войти" : "Создать аккаунт"}</button>
      </form>
      <button className="switch-auth" onClick={() => { p.setMode(p.mode === "signIn" ? "signUp" : "signIn"); p.setError(""); }}>{p.mode === "signIn" ? "Создать новый аккаунт" : "У меня уже есть аккаунт"}</button>
    </div>
  </div>;
}

function PageView({ page, tokenUser, toast, go, api }: { page: Page; tokenUser: User; toast: (s: string) => void; go: (p: Page) => void; api: ApiState }) {
  if (page === "dashboard") return <Dashboard user={tokenUser} go={go} />;
  if (page === "analytics") return <Analytics user={tokenUser} />;
  if (page === "settings") return <Settings user={tokenUser} api={api} />;
  if (page === "orders") return <OrdersPage user={tokenUser} toast={toast} />;
  return <ModuleView page={page} user={tokenUser} toast={toast} />;
}

function useApiData(endpoint: string, user: User) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const t = await user.getIdToken();
      const d = await apiFetchAuth<any>("/api/v1/data/" + endpoint, t);
      if (Array.isArray(d)) setRows(d);
      else if (d && typeof d === "object") setRows([{ ...d }]);
      else setRows([]);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось выполнить запрос."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [endpoint, user.uid]);
  return { rows, setRows, loading, error, reload: load };
}

function OrdersPage({ user, toast }: { user: User; toast: (s:string)=>void }) {
  const [rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[q,setQ]=useState(""),[status,setStatus]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[page,setPage]=useState(1),[meta,setMeta]=useState({page:1,limit:25,total:0,pages:1}),[open,setOpen]=useState(false),[detail,setDetail]=useState<Row|null>(null),[receipt,setReceipt]=useState<Row|null>(null),[busy,setBusy]=useState("");
  const load=async(nextPage=page)=>{setLoading(true);setError("");try{const t=await user.getIdToken();const p=new URLSearchParams({page:String(nextPage),limit:"25"});if(q.trim())p.set("q",q.trim());if(status)p.set("status",status);if(from)p.set("from",from);if(to)p.set("to",to);const d=await apiFetchAuth<any>("/api/v1/data/orders?"+p,t);setRows(Array.isArray(d?.rows)?d.rows:[]);setMeta(d?.pages?d:{page:nextPage,limit:25,total:d?.rows?.length||0,pages:1});setPage(nextPage);}catch(e){setError(e instanceof Error?e.message:"Не удалось загрузить заказы.");}finally{setLoading(false);}};
  useEffect(()=>{void load(1);},[user.uid]);
  const change=async(id:string,next:string)=>{setBusy(id+next);try{const t=await user.getIdToken();await apiFetchAuth("/api/v1/data/orders/"+id+"/status",t,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});toast("Статус заказа обновлён.");await load(page);}catch(e){toast(e instanceof Error?e.message:"Не удалось изменить статус.");}finally{setBusy("");}};
  const getDetail=async(id:string)=>{const t=await user.getIdToken();return await apiFetchAuth<Row>("/api/v1/data/orders/"+id,t);}; const openDetail=async(id:string)=>{try{setDetail(await getDetail(id));}catch(e){toast(e instanceof Error?e.message:"Не удалось открыть заказ.");}}; const openReceipt=async(id:string)=>{try{setReceipt(await getDetail(id));}catch(e){toast(e instanceof Error?e.message:"Не удалось открыть чек.");}};
  return <div><PageHeader title="Заказы" subtitle="Все заказы компании: поиск, фильтры, состав, оплаты и статус выполнения." actions={<button className="button primary" onClick={()=>setOpen(true)}>+ Новый заказ</button>}/>
    <div className="module-stat-grid"><div className="module-stat"><span className="module-stat-icon">№</span><small>Всего заказов</small><b>{meta.total}</b><span>Все страницы</span></div><div className="module-stat"><span className="module-stat-icon">◷</span><small>На странице</small><b>{rows.length}</b><span>25 записей</span></div><div className="module-stat"><span className="module-stat-icon">!</span><small>Черновики</small><b>{rows.filter(x=>x.status==="draft").length}</b><span>На текущей странице</span></div><div className="module-stat"><span className="module-stat-icon">✓</span><small>Завершённые</small><b>{rows.filter(x=>x.status==="completed").length}</b><span>На текущей странице</span></div></div>
    <section className="panel"><div className="toolbar"><div className="searchbox">⌕<input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load(1)}} placeholder="Поиск по номеру, клиенту или телефону..."/></div><select value={status} onChange={e=>{setStatus(e.target.value);setTimeout(()=>void load(1),0)}}><option value="">Все статусы</option><option value="draft">Черновики</option><option value="confirmed">Подтверждённые</option><option value="completed">Завершённые</option><option value="cancelled">Отменённые</option></select><input type="date" value={from} onChange={e=>setFrom(e.target.value)} aria-label="Дата от"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} aria-label="Дата до"/><button className="filter-btn" onClick={()=>void load(1)}>Применить</button><button className="filter-btn" onClick={()=>{setQ("");setStatus("");setFrom("");setTo("");setTimeout(()=>void load(1),0)}}>Сбросить</button></div></section>
    <section className="panel table-panel">{loading?<div className="empty-work"><h3>Загрузка заказов…</h3></div>:error?<div className="empty-work"><h3>Не удалось загрузить заказы</h3><p>{error}</p><button className="button outline" onClick={()=>void load(page)}>Повторить</button></div>:rows.length===0?<div className="empty-work"><h3>Заказов не найдено</h3><p>Измените поиск или фильтры, либо создайте новый заказ.</p><button className="button primary" onClick={()=>setOpen(true)}>Создать заказ</button></div>:<div className="table-scroll"><table><thead><tr><th>Заказ</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th>Создан</th><th>Действия</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><button className="table-link" onClick={()=>void openDetail(r.id)}>№ {r.orderNumber}</button></td><td><b>{r.customer}</b><small className="table-sub">{r.customerPhone||"Телефон не указан"}</small></td><td><b>{money(r.total)}</b></td><td><div className="order-status-cell"><Badge>{displayValue(r.status)}</Badge><button type="button" className="receipt-icon-btn" title="Открыть чек" aria-label="Открыть чек" onClick={()=>void openReceipt(r.id)}>▤</button></div></td><td>{displayValue(r.createdAt)}</td><td className="table-actions"><button className="button outline table-edit-btn" onClick={()=>void openDetail(r.id)}>Открыть</button>{r.status==="draft"&&<button className="button primary table-edit-btn" disabled={busy===r.id+"confirmed"} onClick={()=>void change(r.id,"confirmed")}>Подтвердить</button>}{r.status==="confirmed"&&<button className="button primary table-edit-btn" disabled={busy===r.id+"completed"} onClick={()=>void change(r.id,"completed")}>Завершить</button>}{!["completed","cancelled"].includes(r.status)&&<button className="button outline table-edit-btn" disabled={busy===r.id+"cancelled"} onClick={()=>void change(r.id,"cancelled")}>Отменить</button>}</td></tr>)}</tbody></table></div>}{!loading&&!error&&meta.pages>1&&<div className="pagination"><button className="button outline" disabled={page<=1} onClick={()=>void load(page-1)}>← Назад</button><span>Страница {page} из {meta.pages} · {meta.total} заказов</span><button className="button outline" disabled={page>=meta.pages} onClick={()=>void load(page+1)}>Вперёд →</button></div>}</section>
    {open&&<OrderCreateModal close={()=>setOpen(false)} save={async data=>{try{const t=await user.getIdToken();const created=await apiFetchAuth<Row>("/api/v1/data/orders",t,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});setOpen(false);toast("Заказ создан.");await load(1);setReceipt(await getDetail(created.id));}catch(e){toast(e instanceof Error?e.message:"Не удалось создать заказ.");}}} user={user}/>}
    {detail&&<OrderDetailModal order={detail} close={()=>setDetail(null)} user={user} toast={toast} reload={()=>load(page)} onReceipt={()=>{setReceipt(detail);setDetail(null)}}/>}{receipt&&<ReceiptModal order={receipt} close={()=>setReceipt(null)}/>}
  </div>;
}

function OrderDetailModal({order,close,user,toast,reload,onReceipt}:{order:Row;close:()=>void;user:User;toast:(s:string)=>void;reload:()=>void;onReceipt:()=>void}){const [busy,setBusy]=useState(false);const change=async(next:string)=>{setBusy(true);try{const t=await user.getIdToken();await apiFetchAuth<Row>("/api/v1/data/orders/"+order.id+"/status",t,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});toast("Статус заказа обновлён.");reload();close();}catch(e){toast(e instanceof Error?e.message:"Не удалось изменить статус.");}finally{setBusy(false);}};return <div className="modal-backdrop"><div className="quick-modal order-modal order-detail-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Заказ №{order.orderNumber}</span><h2>{order.customer}</h2><div className="order-detail-meta"><Badge>{displayValue(order.status)}</Badge><span>{displayValue(order.createdAt)}</span><span>{order.branch}</span><span>{order.warehouse}</span></div><div className="order-detail-grid"><div><small>Менеджер</small><b>{order.creator||"—"}{order.creatorPhone&&" · "+order.creatorPhone}</b></div><div><small>Клиент</small><b>{order.customerPhone||"—"} · {order.customerAddress||"—"}</b></div><div><small>Оплачено</small><b>{money(order.paid||0)}</b></div><div><small>Осталось</small><b>{money(order.balance||0)}</b></div></div><div className="order-cart">{(order.items||[]).filter((x:any)=>!x.isBonus).map((x:any)=><div className="order-cart-item" key={x.id}><span className="product-thumb">▧</span><div className="order-cart-main"><strong>{x.product}</strong><small>{Number(x.unitPrice).toLocaleString("ru-RU")} сум × {x.quantity}</small></div><b>{money(x.total)}</b></div>)}</div>{(order.items||[]).some((x:any)=>x.isBonus)&&<div className="bonus-section"><div className="order-section-title">Бонусы</div>{(order.items||[]).filter((x:any)=>x.isBonus).map((x:any)=><div className="order-cart-item bonus-item" key={x.id}><span className="product-thumb">🎁</span><div className="order-cart-main"><strong>{x.product}</strong><small>Бесплатно · {x.quantity} шт.</small></div><b>0 UZS</b></div>)}</div>}<div className="order-total"><span>Итого</span><strong>{money(order.total)}</strong></div>{order.notes&&<div className="note-box">{order.notes}</div>}<div className="modal-actions"><button className="button outline" onClick={close}>Закрыть</button><button type="button" className="button outline" onClick={onReceipt}>▤ Чек</button>{order.status==="draft"&&<button className="button primary" disabled={busy} onClick={()=>void change("confirmed")}>Подтвердить</button>}{order.status==="confirmed"&&<button className="button primary" disabled={busy} onClick={()=>void change("completed")}>Завершить</button>}{!["completed","cancelled"].includes(order.status)&&<button className="button outline" disabled={busy} onClick={()=>void change("cancelled")}>Отменить</button>}</div></div></div>;}


function ModuleView({ page, user, toast }: any) {
  const c = cfg[page];
  const { rows, setRows, loading, error, reload } = useApiData(c.endpoint, user);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Row | null>(null);
  const filtered = useMemo(() => rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const create = async (data: any) => {
    try {
      const t = await user.getIdToken();
      const d = await apiFetchAuth<any>("/api/v1/data/" + c.endpoint, t, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setRows(x => [d, ...x]); setOpen(false); toast("Запись сохранена.");
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось сохранить запись."); }
  };

  const editProduct = async (data: any) => {
    if (!editingProduct?.id) return;
    try {
      const t = await user.getIdToken();
      const d = await apiFetchAuth<any>("/api/v1/data/products/" + editingProduct.id, t, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setRows(x => x.map(row => row.id === d.id ? d : row));
      setEditingProduct(null);
      toast("Товар обновлён.");
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось обновить товар."); }
  };

  const stat = page === "reports" || page === "stockMovements" || page === "auditLogs" || page === "notifications" ? [] :
    [["Записи", rows.length], ["Активные", rows.filter(r => String(r.status || r.isActive).toLowerCase().includes("active") || r.isActive === true).length], ["Внимание", rows.filter(r => ["low", "pending", "overdue", "failed"].includes(String(r.status).toLowerCase())).length], ["Обновлено", "В реальном времени"]];

  const rowAction = async (row: Row) => {
    let path = "", body: any = undefined;
    if (page === "orders") {
      if (row.status === "draft") { path = "orders/" + row.id + "/status"; body = { status: "confirmed" }; }
      else if (row.status === "confirmed") { path = "orders/" + row.id + "/status"; body = { status: "completed" }; }
      else return;
    } else if (page === "purchases") {
      if (row.status === "received") return; path = "purchases/" + row.id + "/receive";
    } else if (page === "tasks") {
      const next: Record<string,string> = { open: "in_progress", in_progress: "completed", review: "completed" };
      if (!next[row.status]) return; path = "tasks/" + row.id + "/status"; body = { status: next[row.status] };
    } else if (page === "visits") {
      const next: Record<string,string> = { planned: "started", started: "completed" };
      if (!next[row.status]) return; path = "visits/" + row.id + "/status"; body = { status: next[row.status] };
    } else if (page === "deliveries") {
      const next: Record<string,string> = { planned: "prepared", prepared: "in_transit", in_transit: "delivered" };
      if (!next[row.status]) return; path = "deliveries/" + row.id + "/status"; body = { status: next[row.status] };
    } else if (page === "promotions") {
      const next: Record<string,string> = { draft: "planned", planned: "active", active: "completed" };
      if (!next[row.status]) return; path = "promotions/" + row.id + "/status"; body = { status: next[row.status] };
    } else if (page === "notifications") {
      if (row.readAt) return; path = "notifications/" + row.id + "/read";
    } else return;
    try {
      const t = await user.getIdToken();
      await apiFetchAuth<any>("/api/v1/data/" + path, t, body ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method: "PATCH" });
      toast("Операция выполнена.");
      await reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось выполнить операцию."); }
  };

  return <div>
    <PageHeader title={c.title} subtitle={c.sub} actions={c.action ? <button className="button primary" onClick={() => page === "reports" ? void reload() : setOpen(true)}>+ {c.action}</button> : undefined} />
    {stat.length > 0 && <div className="module-stat-grid">{stat.map((x: any, i: number) => <div className="module-stat" key={x[0]}><span className="module-stat-icon">{["◒", "✓", "!", "↗"][i]}</span><small>{x[0]}</small><b>{x[1]}</b><span className={i === 2 ? "warn" : "good"}>{i === 3 ? "В реальном времени" : "Текущие данные"}</span></div>)}</div>}
    <div className="toolbar"><div className="searchbox">⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Поиск: " + c.title.toLowerCase() + "..."} /></div><button className="filter-btn" onClick={() => setSearch("")}>Очистить</button><span className="toolbar-count">{filtered.length} записей</span></div>
    <section className="panel table-panel">
      {loading ? <div className="empty-work"><h3>Загрузка данных…</h3></div> :
       error ? <div className="empty-work"><h3>Не удалось загрузить данные</h3><p>{error}</p><button className="button outline" onClick={() => void reload()}>Повторить</button></div> :
       filtered.length === 0 ? <div className="empty-work"><h3>Записей пока нет</h3><p>{page === "stockMovements" || page === "auditLogs" || page === "notifications" ? "Пока нет записей для отображения." : "Создайте первую запись, чтобы начать работу с разделом."}</p></div> :
       <><Table rows={filtered} columns={c.cols} onEdit={page === "products" ? setEditingProduct : undefined} rowAction={rowAction} /></>}
    </section>
    {open && (page === "orders" ? <OrderCreateModal close={() => setOpen(false)} save={create} user={user} /> : page === "purchases" ? <PurchaseCreateModal close={() => setOpen(false)} save={create} user={user} /> : page === "transfers" ? <TransferCreateModal close={() => setOpen(false)} save={create} user={user} /> : <CreateModal config={c} close={() => setOpen(false)} save={create} user={user} />)}
    {editingProduct && <ProductEditModal product={editingProduct} close={() => setEditingProduct(null)} save={editProduct} />}
  </div>;
}

function CustomerPicker({ user, value, onChange }: { user: User; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const rows = await apiFetchAuth<any[]>(`/api/v1/lookups/customers?q=${encodeURIComponent(query.trim())}`, token);
        if (active) setItems(Array.isArray(rows) ? rows : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, user.uid]);

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  const choose = (item: any) => {
    setSelected(item);
    setQuery("");
    setItems([]);
    onChange(item.id);
  };

  return <div className="customer-picker">
    <input
      data-customer-picker="true"
      value={selected ? [selected.name, selected.address].filter(Boolean).join(" · ") : query}
      onChange={e => {
        if (selected) {
          setSelected(null);
          onChange("");
        }
        setQuery(e.target.value);
      }}
      placeholder="Введите имя или адрес клиента"
      autoComplete="off"
      required
    />
    {loading && <small className="lookup-hint">Поиск клиентов…</small>}
    {!loading && query.trim() && items.length === 0 && <small className="lookup-hint">Клиент не найден.</small>}
    {items.length > 0 && <div className="customer-picker-list">
      {items.map((item) => <button type="button" className="customer-picker-option" key={item.id} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item)}>
        <strong>{item.name}</strong>
        <span>{[item.address, item.phone].filter(Boolean).join(" · ") || "Без адреса"}</span>
      </button>)}
    </div>}
  </div>;
}

function ReferencePicker({ user, type, value, onChange, placeholder, onSelect, allowFreeText, onFreeText }: { user: User; type: string; value: string; onChange: (id: string) => void; placeholder: string; onSelect?: (item: any) => void; allowFreeText?: boolean; onFreeText?: (text: string) => void }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setItems([]); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const rows = await apiFetchAuth<any[]>(`/api/v1/lookups/${type}?q=${encodeURIComponent(query.trim())}`, token);
        if (active) setItems(Array.isArray(rows) ? rows : []);
      } catch { if (active) setItems([]); }
      finally { if (active) setLoading(false); }
    }, 160);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, type, user.uid]);

  const choose = (item: any) => {
    setSelected(item); setQuery(""); setItems([]); onChange(String(item.id)); onSelect?.(item);
  };
  const itemLabel = (item: any) => {
    if (type === "orders") return item.orderNumber ? "Заказ №" + item.orderNumber : item.id;
    if (type === "products") return [item.name, item.sku, item.barcode].filter(Boolean).join(" · ");
    if (type === "customers") return [item.name, item.address, item.phone].filter(Boolean).join(" · ");
    if (type === "warehouses") return [item.name, item.code].filter(Boolean).join(" · ");
    if (type === "branches") return [item.name, item.code, item.address].filter(Boolean).join(" · ");
    return [item.name, item.code].filter(Boolean).join(" · ") || item.id;
  };

  useEffect(() => { if (!value) setSelected(null); }, [value]);

  return <div className="customer-picker">
    <input data-customer-picker="true" value={selected ? itemLabel(selected) : query}
      onChange={e => {
        const next = e.target.value;
        if (selected) { setSelected(null); onChange(""); }
        setQuery(next);
        if (allowFreeText) onFreeText?.(next);
      }}
      placeholder={placeholder} autoComplete="off" required={!allowFreeText}
    />
    {loading && <small className="lookup-hint">Поиск…</small>}
    {!loading && query.trim() && items.length === 0 && <small className="lookup-hint">{allowFreeText ? "Можно использовать введённые данные как нового клиента." : "Ничего не найдено."}</small>}
    {items.length > 0 && <div className="customer-picker-list">
      {items.map(item => <button type="button" className="customer-picker-option" key={item.id} onMouseDown={e => e.preventDefault()} onClick={() => choose(item)}>
        {type === "products" && <span className="product-thumb">▧</span>}
        <strong>{itemLabel(item)}</strong>
      </button>)}
    </div>}
  </div>;
}

const referenceFieldTypes: Record<string, string> = {
  customerId: "customers",
  orderId: "orders",
  branchId: "branches",
  fromWarehouseId: "warehouses",
  toWarehouseId: "warehouses",
  warehouseId: "warehouses",
  productId: "products",
  routeId: "routes",
};

function OrderCreateModal({ close, save, user }: { close: () => void; save: (d: any) => void; user: User }) {
  const [customerId,setCustomerId]=useState(""),[customerInput,setCustomerInput]=useState(""),[customerPhone,setCustomerPhone]=useState(""),[customerAddress,setCustomerAddress]=useState(""),[branchId,setBranchId]=useState(""),[warehouseId,setWarehouseId]=useState(""),[notes,setNotes]=useState(""),[discountModal,setDiscountModal]=useState<number|null>(null),[items,setItems]=useState<any[]>([]),[bonusItems,setBonusItems]=useState<any[]>([]),[productQuery,setProductQuery]=useState(""),[bonusQuery,setBonusQuery]=useState(""),[productOptions,setProductOptions]=useState<any[]>([]),[bonusOptions,setBonusOptions]=useState<any[]>([]),[error,setError]=useState(""),[contactErrors,setContactErrors]=useState({phone:false,address:false});
  const searchProducts=async(q:string,setter:(x:any[])=>void)=>{if(!q.trim()){setter([]);return;}try{const t=await user.getIdToken();const r=await apiFetchAuth<any[]>(`/api/v1/lookups/products?q=${encodeURIComponent(q.trim())}`,t);setter(Array.isArray(r)?r:[]);}catch{setter([])}};
  useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{if(active)void searchProducts(productQuery,setProductOptions)},150);return()=>{active=false;window.clearTimeout(timer)}},[productQuery,user.uid]);
  useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{if(active)void searchProducts(bonusQuery,setBonusOptions)},150);return()=>{active=false;window.clearTimeout(timer)}},[bonusQuery,user.uid]);
  const addProduct=(product:any)=>{setProductOptions([]);setProductQuery("");setItems(v=>{const i=v.findIndex(x=>x.productId===product.id&&!x.isBonus);return i>=0?v.map((x,j)=>j===i?{...x,quantity:Number(x.quantity)+1}:x):[...v,{productId:String(product.id),product,quantity:1,unitPrice:Number(product.salePrice||0),isBonus:false}]})};
  const addBonus=(product:any)=>{setBonusOptions([]);setBonusQuery("");setBonusItems(v=>{const i=v.findIndex(x=>x.productId===product.id);return i>=0?v.map((x,j)=>j===i?{...x,quantity:Number(x.quantity)+1}:x):[...v,{productId:String(product.id),product,quantity:1,isBonus:true}]})};
  const changeQty=(index:number,delta:number)=>setItems(v=>v.map((x,i)=>i===index?{...x,quantity:Math.max(1,Number(x.quantity)+delta)}:x));
  const removeProduct=(index:number)=>setItems(v=>v.filter((_,i)=>i!==index));
  const removeBonus=(index:number)=>setBonusItems(v=>v.filter((_,i)=>i!==index));
  const lineTotal=(x:any)=>Math.max(0,Number(x.unitPrice)*Number(x.quantity));
  const grandTotal=items.reduce((s,x)=>s+lineTotal(x),0);
  const submit=()=>{setError("");const phone=customerPhone.trim(),address=customerAddress.trim();const phoneBad=!phone,addressBad=!address;setContactErrors({phone:phoneBad,address:addressBad});if(!customerId&&!customerInput.trim())return setError("Укажите имя клиента.");if(phoneBad||addressBad)return setError("Укажите телефон и адрес клиента.");if(!items.length&&!bonusItems.length)return setError("Добавьте товар или бонус.");if(!branchId||!warehouseId)return setError("Выберите филиал и склад.");save({branchId,warehouseId,customerId:customerId||undefined,customerInput:customerInput.trim()||undefined,customerPhone:phone,customerAddress:address,items:items.map(x=>({productId:x.productId,quantity:Number(x.quantity),unitPrice:Number(x.unitPrice)})),bonusItems:bonusItems.map(x=>({productId:x.productId,quantity:Number(x.quantity)})),discount:0,notes});};
  return <div className="modal-backdrop"><div className="quick-modal order-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Создание заказа</span><h2>Новый заказ</h2>
    <div className="product-edit-grid"><label>Филиал<ReferencePicker user={user} type="branches" value={branchId} onChange={setBranchId} placeholder="Выберите филиал"/></label><label>Склад<ReferencePicker user={user} type="warehouses" value={warehouseId} onChange={setWarehouseId} placeholder="Выберите склад"/></label></div>
    <label>Клиент<ReferencePicker user={user} type="customers" value={customerId} onChange={setCustomerId} onSelect={(c)=>{setCustomerInput(c.name||"");setCustomerPhone(c.phone||"");setCustomerAddress(c.address||"");setContactErrors({phone:!c.phone,address:!c.address})}} onFreeText={(text)=>{setCustomerId("");setCustomerInput(text)}} allowFreeText placeholder="Имя клиента или телефон"/></label>
    <div className="product-edit-grid"><label>Телефон<input className={contactErrors.phone?"field-invalid":""} value={customerPhone} onChange={e=>{setCustomerPhone(e.target.value);setContactErrors(v=>({...v,phone:false}))}} placeholder="+998 ..."/></label><label>Адрес<input className={contactErrors.address?"field-invalid":""} value={customerAddress} onChange={e=>{setCustomerAddress(e.target.value);setContactErrors(v=>({...v,address:false}))}} placeholder="Адрес клиента"/></label></div>
    <label className="order-product-search">Товар<input value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder="Поиск товара…" autoComplete="off"/>{productOptions.length>0&&<div className="customer-picker-list">{productOptions.map(p=><button type="button" className="customer-picker-option product-option" key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>addProduct(p)}><span className="product-thumb">▧</span><strong>{p.name}</strong><small>{Number(p.salePrice||0).toLocaleString("ru-RU")} сум · {p.sku}</small></button>)}</div>}</label>
    <div className="order-section-title">Товары</div>
    <div className="order-cart">{items.map((item,index)=><div className="order-cart-item" key={item.productId}><span className="product-thumb">▧</span><div className="order-cart-main"><strong>{item.product.name}</strong><small>Цена продажи: {Number(item.product.salePrice||0).toLocaleString("ru-RU")} сум · Цена заказа: {Number(item.unitPrice).toLocaleString("ru-RU")} сум × {item.quantity} = {lineTotal(item).toLocaleString("ru-RU")} сум</small></div><div className="order-cart-controls"><button type="button" onClick={()=>changeQty(index,-1)}>-</button><b>{item.quantity}</b><button type="button" onClick={()=>changeQty(index,1)}>+</button></div><button type="button" className="order-discount-btn" onClick={()=>setDiscountModal(index)}>Скидка</button><button type="button" className="order-remove-icon" aria-label="Удалить товар" title="Удалить товар" onClick={()=>removeProduct(index)}>🗑</button></div>)}</div>
    {discountModal!==null&&items[discountModal]&&<div className="order-discount-backdrop" onMouseDown={()=>setDiscountModal(null)}><div className="order-discount-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDiscountModal(null)}>×</button><h3>Цена со скидкой</h3><p>Обычная цена: <b>{Number(items[discountModal].product.salePrice||0).toLocaleString("ru-RU")} сум</b></p><label>Цена за 1 шт. после скидки<input autoFocus type="number" min="0" max={Number(items[discountModal].product.salePrice||0)} value={items[discountModal].unitPrice} onChange={e=>setItems(prev=>prev.map((x,i)=>i===discountModal?{...x,unitPrice:Number(e.target.value||0)}:x))}/></label><small className="lookup-hint">Например: 100 000 → 80 000 сум. Все {items[discountModal].quantity} шт. будут проданы по 80 000 сум.</small><button className="button primary full" onClick={()=>setDiscountModal(null)}>Готово</button></div></div>}
    <section className="bonus-section"><div className="order-section-title">Бонусы</div><label className="order-product-search">Бонусный товар<input value={bonusQuery} onChange={e=>setBonusQuery(e.target.value)} placeholder="Поиск товара для бонуса…"/>{bonusOptions.length>0&&<div className="customer-picker-list">{bonusOptions.map(p=><button type="button" className="customer-picker-option product-option" key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>addBonus(p)}><span className="product-thumb">🎁</span><strong>{p.name}</strong><small>Бесплатно · {p.sku}</small></button>)}</div>}</label>
      {bonusItems.length>0&&<div className="order-cart">{bonusItems.map((item,index)=><div className="order-cart-item bonus-item" key={item.productId}><span className="product-thumb">🎁</span><div className="order-cart-main"><strong>{item.product.name}</strong><small>Бонус · бесплатно · {item.quantity} шт.</small></div><div className="order-cart-controls"><button type="button" onClick={()=>setBonusItems(v=>v.map((x,i)=>i===index?{...x,quantity:Math.max(1,Number(x.quantity)-1)}:x))}>-</button><b>{item.quantity}</b><button type="button" onClick={()=>setBonusItems(v=>v.map((x,i)=>i===index?{...x,quantity:Number(x.quantity)+1}:x))}>+</button></div><button type="button" className="order-remove-icon" aria-label="Удалить бонус" title="Удалить бонус" onClick={()=>removeBonus(index)}>🗑</button></div>)}</div>}
    </section>
    <div className="order-total"><span>Итого</span><strong>{grandTotal.toLocaleString("ru-RU")} сум</strong></div>
    <label>Примечания<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Примечания"/></label>{error&&<small className="auth-error">{error}</small>}
    <div className="modal-actions"><button className="button outline" onClick={close}>Отмена</button><button className="button primary" onClick={submit}>Оформить заказ</button></div>
  </div></div>;
}


function ReceiptModal({order,close}:{order:Row;close:()=>void}) {
  const items=(order.items||[]).filter((x:any)=>!x.isBonus);
  const bonuses=(order.items||[]).filter((x:any)=>x.isBonus);
  const perPage=18;
  const pages:any[][]=[];
  for(let i=0;i<items.length;i+=perPage) pages.push(items.slice(i,i+perPage));
  if(!pages.length) pages.push([]);

  const moneyText=(v:any)=>new Intl.NumberFormat("ru-RU").format(Number(v)||0)+" сум";
  const dateText=(v:any)=>{
    const d=new Date(v);
    return Number.isNaN(d.getTime()) ? String(v??"—") : new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short"}).format(d);
  };

  const drawCell=(c:CanvasRenderingContext2D,text:string,x:number,y:number,w:number,h:number,align:"left"|"right"="left",bold=false)=>{
    c.strokeStyle="#9aa3ad";
    c.lineWidth=1;
    c.strokeRect(x,y,w,h);
    c.fillStyle="#17202a";
    c.font=(bold?"bold ":"")+"11px Arial";
    c.textAlign=align;
    c.fillText(text.slice(0,align==="left"?46:20),align==="right"?x+w-7:x+7,y+18);
    c.textAlign="left";
  };

  const drawPage=(c:CanvasRenderingContext2D,pageItems:any[],pageIndex:number,totalPages:number)=>{
    const W=794,H=1123;
    c.fillStyle="#fff";
    c.fillRect(0,0,W,H);
    c.fillStyle="#17202a";
    c.font="bold 22px Arial";
    c.fillText("ЧЕК · Заказ №"+order.orderNumber,36,44);
    c.font="12px Arial";
    c.fillText("Менеджер: "+(order.creator||"—")+" · "+(order.creatorPhone||"—"),36,72);
    c.fillText("Клиент: "+(order.customer||"—")+" · "+(order.customerPhone||"—"),36,94);
    c.fillText("Адрес клиента: "+(order.customerAddress||"—"),36,116);
    c.fillText("Дата: "+dateText(order.createdAt)+" · Страница "+(pageIndex+1)+" из "+totalPages,36,138);

    let y=165;
    const cols=[{x:36,w:38},{x:74,w:300},{x:374,w:130},{x:504,w:72},{x:576,w:182}];
    const headers=["№","Товар","Цена за 1 шт.","Количество","Сумма"];
    headers.forEach((h,i)=>drawCell(c,h,cols[i].x,y,cols[i].w,28,"left",true));
    y+=28;

    pageItems.forEach((x:any,index:number)=>{
      const globalIndex=pageIndex*perPage+index+1;
      const vals=[String(globalIndex),String(x.product||"—"),moneyText(x.unitPrice),String(x.quantity),moneyText(x.total)];
      vals.forEach((v,i)=>drawCell(c,v,cols[i].x,y,cols[i].w,28,i===2||i===4?"right":"left",false));
      y+=28;
    });

    if(pageIndex===totalPages-1){
      y+=18;
      c.fillStyle="#17202a";
      c.font="bold 16px Arial";
      c.fillText("Итого: "+moneyText(order.total),36,y+12);
      if(bonuses.length){
        y+=42;
        c.font="bold 13px Arial";
        c.fillText("Бонусы",36,y);
        y+=12;
        const bcols=[{x:36,w:38},{x:74,w:430},{x:504,w:72},{x:576,w:182}];
        ["№","Товар","Количество","Цена"].forEach((h,i)=>drawCell(c,h,bcols[i].x,y,bcols[i].w,28,"left",true));
        y+=28;
        bonuses.forEach((x:any,index:number)=>{
          [String(index+1),String(x.product||"—"),String(x.quantity), "БЕСПЛАТНО"].forEach((v,i)=>drawCell(c,v,bcols[i].x,y,bcols[i].w,28,i===3?"right":"left",false));
          y+=28;
        });
      }
    }
  };

  const download=()=>{
    const W=794,H=1123;
    const canvas=document.createElement("canvas");
    canvas.width=W;
    canvas.height=H*pages.length;
    const c=canvas.getContext("2d")!;
    pages.forEach((p,i)=>drawPage(c,p,i,pages.length));
    const a=document.createElement("a");
    a.download="чек-"+order.orderNumber+".png";
    a.href=canvas.toDataURL("image/png");
    a.click();
  };

  return <div className="modal-backdrop receipt-backdrop">
    <div className="receipt-modal">
      <button className="modal-close" onClick={close}>×</button>
      <div className="receipt-actions">
        <button className="button outline" onClick={download}>Скачать PNG</button>
        <button className="button primary" onClick={close}>Закрыть</button>
      </div>
      <div className="receipt-pages">
        {pages.map((pageItems,pi)=><div className="receipt-page" key={pi}>
          <div className="receipt-head">
            <b>ЧЕК · Заказ №{order.orderNumber}</b>
            <span>Дата: {dateText(order.createdAt)} · Страница {pi+1} из {pages.length}</span>
            <span>Менеджер: {order.creator||"—"} · {order.creatorPhone||"—"}</span>
            <span>Клиент: {order.customer||"—"} · {order.customerPhone||"—"}</span>
            <span>Адрес клиента: {order.customerAddress||"—"}</span>
          </div>
          <table className="receipt-table">
            <thead><tr><th>№</th><th>Товар</th><th>Цена за 1 шт.</th><th>Количество</th><th>Сумма</th></tr></thead>
            <tbody>{pageItems.map((x:any,ri)=><tr key={x.id}><td>{pi*perPage+ri+1}</td><td>{x.product}</td><td>{moneyText(x.unitPrice)}</td><td>{x.quantity}</td><td>{moneyText(x.total)}</td></tr>)}</tbody>
          </table>
          {pi===pages.length-1&&<>
            <div className="receipt-grand-total">Итого: {moneyText(order.total)}</div>
            {bonuses.length>0&&<div className="receipt-bonuses">
              <h3>Бонусы</h3>
              <table><thead><tr><th>№</th><th>Товар</th><th>Количество</th><th>Цена</th></tr></thead>
                <tbody>{bonuses.map((x:any,i:number)=><tr key={x.id}><td>{i+1}</td><td>{x.product}</td><td>{x.quantity}</td><td>БЕСПЛАТНО</td></tr>)}</tbody>
              </table>
            </div>}
          </>}
        </div>)}
      </div>
    </div>
  </div>;
}
function PurchaseCreateModal({ close, save, user }: { close:()=>void; save:(d:any)=>void; user:User }) {
  const [supplierId,setSupplierId]=useState(""),[warehouseId,setWarehouseId]=useState(""),[notes,setNotes]=useState(""),[items,setItems]=useState<any[]>([]),[productQuery,setProductQuery]=useState(""),[products,setProducts]=useState<any[]>([]);
  useEffect(()=>{if(!productQuery.trim()){setProducts([]);return;}let active=true;const timer=window.setTimeout(async()=>{try{const t=await user.getIdToken();const r=await apiFetchAuth<any[]>("/api/v1/lookups/products?q="+encodeURIComponent(productQuery.trim()),t);if(active)setProducts(Array.isArray(r)?r:[]);}catch{if(active)setProducts([]);}},160);return()=>{active=false;window.clearTimeout(timer)};},[productQuery,user.uid]);
  const add=(p:any)=>{setProducts([]);setProductQuery("");setItems(v=>{const i=v.findIndex(x=>x.productId===p.id);return i>=0?v.map((x,j)=>j===i?{...x,quantity:Number(x.quantity)+1}:x):[...v,{productId:p.id,quantity:1,unitCost:Number(p.costPrice||0),name:p.name}]})};
  const submit=()=>{if(!supplierId||!warehouseId||!items.length)return;save({supplierId,warehouseId,notes,items:items.map(x=>({productId:x.productId,quantity:Number(x.quantity),unitCost:Number(x.unitCost)}))});};
  return <div className="modal-backdrop"><div className="quick-modal order-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Приёмка</span><h2>Новая закупка</h2>
    <label>Поставщик<ReferencePicker user={user} type="suppliers" value={supplierId} onChange={setSupplierId} placeholder="Поиск поставщика" /></label>
    <label>Склад<ReferencePicker user={user} type="warehouses" value={warehouseId} onChange={setWarehouseId} placeholder="Поиск склада" /></label>
    <label className="order-product-search">Товар<input value={productQuery} onChange={e=>setProductQuery(e.target.value)} placeholder="Поиск товара"/>{products.length>0&&<div className="customer-picker-list">{products.map(p=><button type="button" className="customer-picker-option product-option" key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>add(p)}><span className="product-thumb">▧</span><strong>{p.name}</strong><small>{p.sku} · Себестоимость: {Number(p.costPrice||0).toLocaleString("ru-RU")} сум</small></button>)}</div>}</label>
    <div className="order-cart">{items.map((x,i)=><div className="order-cart-item" key={x.productId}><span className="product-thumb">▧</span><div className="order-cart-main"><strong>{x.name}</strong><small>{Number(x.unitCost).toLocaleString("ru-RU")} сум × {x.quantity}</small></div><div className="order-cart-controls"><button type="button" onClick={()=>setItems(v=>v.map((q,j)=>j===i?{...q,quantity:Math.max(1,Number(q.quantity)-1)}:q))}>-</button><b>{x.quantity}</b><button type="button" onClick={()=>setItems(v=>v.map((q,j)=>j===i?{...q,quantity:Number(q.quantity)+1}:q))}>+</button></div></div>)}</div>
    <label>Примечания<textarea value={notes} onChange={e=>setNotes(e.target.value)} /></label><div className="modal-actions"><button className="button outline" onClick={close}>Отмена</button><button className="button primary" disabled={!supplierId||!warehouseId||!items.length} onClick={submit}>Создать закупку</button></div>
  </div></div>;
}

function TransferCreateModal({ close, save, user }: { close:()=>void; save:(d:any)=>void; user:User }) {
  const [from,setFrom]=useState(""),[to,setTo]=useState(""),[items,setItems]=useState<any[]>([]),[query,setQuery]=useState(""),[products,setProducts]=useState<any[]>([]);
  useEffect(()=>{if(!query.trim()){setProducts([]);return;}let active=true;const timer=window.setTimeout(async()=>{try{const t=await user.getIdToken();const r=await apiFetchAuth<any[]>("/api/v1/lookups/products?q="+encodeURIComponent(query.trim()),t);if(active)setProducts(Array.isArray(r)?r:[]);}catch{if(active)setProducts([]);}},160);return()=>{active=false;window.clearTimeout(timer)};},[query,user.uid]);
  const add=(p:any)=>{setProducts([]);setQuery("");setItems(v=>{const i=v.findIndex(x=>x.productId===p.id);return i>=0?v.map((x,j)=>j===i?{...x,quantity:Number(x.quantity)+1}:x):[...v,{productId:p.id,quantity:1,name:p.name}]})};
  const submit=()=>{if(!from||!to||from===to||!items.length)return;save({fromWarehouseId:from,toWarehouseId:to,items:items.map(x=>({productId:x.productId,quantity:Number(x.quantity)}))});};
  return <div className="modal-backdrop"><div className="quick-modal order-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Склад</span><h2>Новое перемещение</h2>
    <label>Склад-источник<ReferencePicker user={user} type="warehouses" value={from} onChange={setFrom} placeholder="Поиск склада" /></label><label>Склад-получатель<ReferencePicker user={user} type="warehouses" value={to} onChange={setTo} placeholder="Поиск склада" /></label>
    <label className="order-product-search">Товар<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск товара"/>{products.length>0&&<div className="customer-picker-list">{products.map(p=><button type="button" className="customer-picker-option product-option" key={p.id} onMouseDown={e=>e.preventDefault()} onClick={()=>add(p)}><span className="product-thumb">▧</span><strong>{p.name}</strong><small>{p.sku}</small></button>)}</div>}</label>
    <div className="order-cart">{items.map((x,i)=><div className="order-cart-item" key={x.productId}><span className="product-thumb">▧</span><div className="order-cart-main"><strong>{x.name}</strong><small>Количество: {x.quantity}</small></div><div className="order-cart-controls"><button type="button" onClick={()=>setItems(v=>v.map((q,j)=>j===i?{...q,quantity:Math.max(1,Number(q.quantity)-1)}:q))}>-</button><b>{x.quantity}</b><button type="button" onClick={()=>setItems(v=>v.map((q,j)=>j===i?{...q,quantity:Number(q.quantity)+1}:q))}>+</button></div></div>)}</div>
    <div className="modal-actions"><button className="button outline" onClick={close}>Отмена</button><button className="button primary" disabled={!from||!to||from===to||!items.length} onClick={submit}>Переместить</button></div>
  </div></div>;
}

function CreateModal({ config, close, save, user }: { config: any; close: () => void; save: (d: any) => void; user: User }) {
  const [data, setData] = useState<any>({});
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const requiredReferences = config.fields
      .map((f: any) => f[0])
      .filter((key: string) => referenceFieldTypes[key]);
    const missing = requiredReferences.find((key: string) => !data[key]);
    if (missing) {
      setReferenceErrors({ [missing]: "Выберите существующую запись из списка." });
      return;
    }
    save(data);
  };

  const setReference = (key: string, id: string) => {
    setReferenceErrors(prev => ({ ...prev, [key]: "" }));
    setData((prev: any) => ({ ...prev, [key]: id }));
  };

  return <div className="modal-backdrop"><div className="quick-modal"><button className="modal-close" onClick={close}>×</button><span className="eyebrow">Создание записи</span><h2>{config.action}</h2>
    {config.fields.length === 0 ? <p>Для этого действия требуется связанная запись или отдельный рабочий процесс. Данные раздела доступны через защищённый API.</p> :
      config.fields.map((f: any) => referenceFieldTypes[f[0]] ?
        <label key={f[0]}>{f[1]}
          <ReferencePicker
            user={user}
            type={referenceFieldTypes[f[0]]}
            value={data[f[0]] ?? ""}
            onChange={(id) => setReference(f[0], id)}
            placeholder={"Введите " + f[1].toLowerCase()}
          />
          {referenceErrors[f[0]] && <small className="auth-error">{referenceErrors[f[0]]}</small>}
        </label> :
        <label key={f[0]}>{f[1]}<input value={data[f[0]] ?? ""} onChange={e => setData({ ...data, [f[0]]: e.target.value })} placeholder={f[1]} /></label>)}
    <div className="modal-actions"><button className="button outline" onClick={close}>Отмена</button><button className="button primary" onClick={submit}>Сохранить</button></div>
  </div></div>;
}

function Dashboard({ user, go }: { user: User; go: (p: Page) => void }) {
  const { rows, loading, error, reload } = useApiData("dashboard", user);
  const d = rows[0] || {};
  const attention = [
    ["Новые заказы", Number(d.pendingOrders || 0), "orders"],
    ["Низкие остатки", Number(d.lowStock || 0), "lowStock"],
    ["Доставки в работе", Number(d.pendingDeliveries || 0), "delivery"],
    ["Открытые задачи", Number(d.openTasks || 0), "tasks"],
  ];
  return <div>
    <PageHeader title="Панель управления бизнесом" subtitle="Главное за сегодня: продажи, заказы и то, что требует внимания."
      actions={<><button className="button outline" onClick={() => void reload()}>Обновить</button><button className="button outline" onClick={() => go("reports")}>Отчёты</button><button className="button primary" onClick={() => go("orders")}>+ Новый заказ</button></>} />
    {error && <section className="panel dashboard-error"><div className="empty-work"><div className="empty-icon">!</div><h3>Не удалось загрузить данные</h3><p>{error}</p><button className="button primary" onClick={() => void reload()}>Повторить</button></div></section>}
    {!error && <><div className="dashboard-grid">
      {[
        ["Продажи всего", money(d.sales || 0), "Завершённые заказы"],
        ["Продажи сегодня", money(d.todaySales || 0), "За сегодня"],
        ["Заказы", d.orders ?? 0, "Всего заказов"],
        ["Клиенты", d.customers ?? 0, "Всего клиентов"],
      ].map(x => <div className="kpi" key={x[0] as string}><div><small>{x[0]}</small><b>{loading ? "…" : x[1]}</b><span className="good">{x[2]}</span></div><i>↗</i></div>)}
    </div>
    <div className="dashboard-columns">
      <section className="panel">
        <PanelHead title="Требует внимания" />
        <div className="alert-list">{attention.map(x => <div key={x[0]}><span className={"stock-symbol " + (Number(x[1]) > 0 ? "warn" : "good")}>{Number(x[1]) > 0 ? "!" : "✓"}</span><span><b>{x[0]}</b><small>{Number(x[1]) > 0 ? "Есть записи для обработки" : "Всё под контролем"}</small></span><strong>{loading ? "…" : x[1]}</strong>{Number(x[1]) > 0 && <button className="button ghost" onClick={() => go(x[2] as Page)}>Открыть</button>}</div>)}</div>
      </section>
      <section className="panel">
        <PanelHead title="Быстрый доступ" />
        <div className="alert-list">{[["Заказы", "orders"], ["Товары", "products"], ["Остатки", "inventory"], ["Клиенты", "customers"]].map(x => <div key={x[0]}><span className="stock-symbol warn">→</span><span><b>{x[0]}</b><small>Открыть раздел</small></span><button className="button ghost" onClick={() => go(x[1] as Page)}>Открыть</button></div>)}</div>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 14 }}>
      <PanelHead title="Последние заказы" action="Открыть все заказы" onClick={() => go("orders")} />
      {loading ? <div className="empty-work"><p>Загрузка последних заказов…</p></div> : d.recent?.length ? <Table rows={d.recent} columns={["orderNumber", "customer", "total", "status", "createdAt"]} /> : <div className="empty-work"><div className="empty-icon">□</div><h3>Заказов пока нет</h3><p>Создайте первый заказ — он сразу появится здесь.</p><button className="button primary" onClick={() => go("orders")}>Создать заказ</button></div>}
    </section>
    </>}
  </div>;
}

function Analytics({ user }: { user: User }) {
  const f = useApiData("finance/summary", user);
  const r = useApiData("reports/summary", user);
  return <div><PageHeader title="Аналитика и BI" subtitle="Показатели по текущим данным продаж, финансов, запасов, задач и визитов." actions={<button className="button outline" onClick={() => { void f.reload(); void r.reload(); }}>Обновить</button>} />
    <div className="analytics-grid">{[["Продажи", f.rows[0]?.sales], ["Получено", f.rows[0]?.collected], ["Кредитные лимиты", f.rows[0]?.creditLimit], ["Открытые задачи", r.rows[0]?.openTasks]].map(x => <div className="kpi" key={x[0] as string}><div><small>{x[0]}</small><b>{typeof x[1] === "number" ? money(x[1]) : x[1] ?? "—"}</b><span className="good">В реальном времени</span></div><i>↗</i></div>)}</div>
    <section className="panel report-builder"><PanelHead title="Сводный отчёт" /><Table rows={r.rows} columns={["metric", "value"]} /></section>
  </div>;
}

function Settings({ user, api }: { user: User; api: ApiState }) {
  return <div><PageHeader title="Настройки" subtitle="Параметры аккаунта и состояние подключения." />
    <div className="module-stat-grid">
      <div className="module-stat"><span className="module-stat-icon">◈</span><small>Аккаунт</small><b>{user.displayName || "Пользователь"}</b><span className="good">Авторизован</span></div>
      <div className="module-stat"><span className="module-stat-icon">✓</span><small>Электронная почта</small><b>{user.email || "—"}</b><span className="good">Firebase</span></div>
      <div className="module-stat"><span className="module-stat-icon">◔</span><small>API</small><b>{api.status === "online" ? "Работает" : api.status === "offline" ? "Недоступен" : "Проверка"}</b><span className={api.status === "online" ? "good" : "warn"}>{api.status === "online" ? "Подключено" : "Требует проверки"}</span></div>
      <div className="module-stat"><span className="module-stat-icon">▤</span><small>Версия API</small><b>{api.status === "online" ? api.version : "—"}</b><span>Текущая</span></div>
    </div>
    <section className="panel module-workspace"><div className="empty-work"><div className="empty-icon">⚙</div><h3>Аккаунт и безопасность</h3><p>Управление профилем выполняется через Firebase. Операционные действия и история доступны в соответствующих разделах.</p>
      <div className="quick-actions"><button className="button outline" onClick={() => window.location.reload()}>Обновить состояние</button><button className="button primary" onClick={() => { void logout(); }}>Выйти из аккаунта</button></div>
    </div></section>
  </div>;
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="header-actions">{actions}</div></div>;
}
function PanelHead({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) {
  return <div className="panel-head"><h2>{title}</h2>{action && <button onClick={onClick}>{action} →</button>}</div>;
}
const valueLabels: Record<string, string> = {
  draft: "Черновик", confirmed: "Подтверждён", cancelled: "Отменён", completed: "Завершён",
  planned: "Запланирован", started: "Начат", prepared: "Подготовлен", in_transit: "В пути",
  delivered: "Доставлен", failed: "Ошибка", active: "Активен", pending: "Ожидает",
  processing: "Обрабатывается", open: "Открыта", in_progress: "В работе", review: "На проверке",
  paid: "Оплачен", received: "Принята", disconnected: "Не подключено", connected: "Подключено",
  normal: "Обычный", low: "Низкий", high: "Высокий", other: "Другое",
  cash: "Наличные", card: "Карта", receipt: "Поступление", sale: "Продажа",
  transfer_in: "Приход перемещения", transfer_out: "Расход перемещения", adjustment: "Корректировка", return: "Возврат",
};
function displayValue(value: any) {
  const key = String(value ?? "");
  return valueLabels[key] || key;
}
function ProductEditModal({ product, close, save }: { product: Row; close: () => void; save: (data: any) => void }) {
  const [data, setData] = useState<any>({
    name: product.name ?? "",
    sku: product.sku ?? "",
    unit: product.unit ?? "pcs",
    barcode: product.barcode ?? "",
    costPrice: product.costPrice ?? "0",
    salePrice: product.salePrice ?? "0",
  });
  return <div className="modal-backdrop"><div className="quick-modal product-edit-modal">
    <button className="modal-close" onClick={close}>×</button>
    <span className="eyebrow">Редактор товара</span><h2>Изменить товар</h2>
    <label>Название<input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} required /></label>
    <label>SKU<input value={data.sku} onChange={e => setData({ ...data, sku: e.target.value })} required /></label>
    <label>Единица<input value={data.unit} onChange={e => setData({ ...data, unit: e.target.value })} required /></label>
    <label>Штрихкод<input value={data.barcode} onChange={e => setData({ ...data, barcode: e.target.value })} /></label>
    <div className="product-edit-grid"><label>Себестоимость<input type="number" min="0" step="0.01" value={data.costPrice} onChange={e => setData({ ...data, costPrice: e.target.value })} /></label><label>Цена продажи<input type="number" min="0" step="0.01" value={data.salePrice} onChange={e => setData({ ...data, salePrice: e.target.value })} /></label></div>
    <div className="modal-actions"><button className="button outline" onClick={close}>Отмена</button><button className="button primary" onClick={() => save(data)}>Сохранить</button></div>
  </div></div>;
}

function RowAction({ row, onAction }: { row: Row; onAction: (row: Row) => void }) {
  const text = row.status === "draft" ? "Подтвердить" : row.status === "confirmed" ? "Завершить" : row.status === "received" ? "Принято" : row.status === "open" ? "В работу" : row.status === "in_progress" ? "Завершить" : row.status === "planned" ? "Начать" : row.status === "started" ? "Завершить" : row.status === "prepared" ? "Отправить" : row.status === "in_transit" ? "Доставить" : row.status === "active" ? "Завершить" : row.readAt ? "Прочитано" : "Прочитать";
  const disabled = ["completed", "cancelled", "received"].includes(String(row.status)) || !!row.readAt;
  return <button className="button outline table-edit-btn" disabled={disabled} onClick={() => void onAction(row)}>{text}</button>;
}

function Table({ rows, columns, onEdit, rowAction }: { rows: Row[]; columns: string[]; onEdit?: (row: Row) => void; rowAction?: (row: Row) => void }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{label(c)}</th>)}{(onEdit || rowAction) && <th>Действия</th>}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{columns.map(c => <td key={c}>
    {c === "status" || c === "isActive" ? <Badge>{c === "isActive" ? (r[c] ? "Активен" : "Неактивен") : displayValue(r[c])}</Badge> :
     ["total", "amount", "creditLimit", "costPrice", "salePrice", "sales", "collected"].includes(c) ? <b>{money(r[c])}</b> : displayValue(r[c])}
  </td>)}{(onEdit || rowAction) && <td className="table-actions">{onEdit && <button className="button outline table-edit-btn" onClick={() => onEdit(r)}>Изменить</button>}{rowAction && <RowAction row={r} onAction={rowAction} />}</td>}</tr>)}</tbody></table></div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);