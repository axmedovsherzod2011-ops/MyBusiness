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
  { label: "Управление", items: [["tasks", "Задачи", "☑"], ["team", "Команда", "♙"], ["branches", "Филиалы", "⌂"], ["auditLogs", "Журнал аудита", "▤"], ["notifications", "Уведомления", "◔"], ["integrations", "Интеграции", "↔"]] },
  { label: "Система", items: [["settings", "Настройки", "⚙"]] },
];

const cfg: any = {
  customers: { title: "Клиенты", sub: "Контакты, кредитные лимиты и история клиентов.", endpoint: "customers", action: "Добавить клиента", fields: [["name", "Имя"], ["phone", "Телефон"], ["address", "Адрес"], ["creditLimit", "Кредитный лимит"]], cols: ["name", "code", "phone", "creditLimit", "isActive"] },
  products: { title: "Товары", sub: "Каталог, SKU, штрихкоды, себестоимость и цены продажи.", endpoint: "products", action: "Добавить товар", fields: [["name", "Название"], ["sku", "SKU"], ["unit", "Единица"], ["barcode", "Штрихкод"], ["costPrice", "Себестоимость"], ["salePrice", "Цена продажи"]], cols: ["name", "sku", "unit", "costPrice", "salePrice", "isActive"] },
  orders: { title: "Заказы", sub: "Жизненный цикл заказа: от черновика до подтверждения и завершения.", endpoint: "orders", action: "Новый заказ", fields: [["customerId", "Клиент"], ["notes", "Примечания"]], cols: ["orderNumber", "customer", "status", "total", "createdAt"] },
  inventory: { title: "Остатки", sub: "Остатки по складам и SKU в реальном времени.", endpoint: "inventory", action: "Перемещение запасов", fields: [], cols: ["warehouse", "product", "sku", "quantity"] },
  purchases: { title: "Закупки", sub: "Закупки у поставщиков и приёмка поступивших запасов.", endpoint: "purchases", action: "Новая закупка", fields: [["name", "Поставщик"], ["phone", "Телефон"]], cols: ["name", "code", "phone"] },
  payments: { title: "Платежи и задолженность", sub: "Платежи, ссылки на операции и контроль дебиторской задолженности.", endpoint: "payments", action: "Записать платёж", fields: [["orderId", "ID заказа"], ["customerId", "ID клиента"], ["amount", "Сумма"], ["method", "Способ"], ["reference", "Назначение"]], cols: ["customerId", "amount", "method", "status", "reference", "createdAt"] },
  delivery: { title: "Доставка", sub: "Подготовка, отправка, отслеживание и подтверждение доставки.", endpoint: "deliveries", action: "Создать доставку", fields: [["orderId", "ID заказа"], ["address", "Адрес"], ["plannedAt", "Плановое время"]], cols: ["orderNumber", "customer", "status", "address", "plannedAt"] },
  routes: { title: "Маршруты", sub: "Планирование маршрутов и назначение ответственных за визиты.", endpoint: "routes", action: "Создать маршрут", fields: [["name", "Название маршрута"], ["routeDate", "Дата"], ["notes", "Примечания"]], cols: ["name", "routeDate", "status", "notes"] },
  visits: { title: "Визиты", sub: "Цифровые визиты к клиентам, результаты, заметки и история выполнения.", endpoint: "visits", action: "Начать визит", fields: [["customerId", "ID клиента"], ["routeId", "ID маршрута"], ["notes", "Примечания"]], cols: ["customer", "status", "outcome", "notes", "createdAt"] },
  promotions: { title: "Акции", sub: "Планирование акций, целевые клиенты и контроль выполнения.", endpoint: "promotions", action: "Новая акция", fields: [["name", "Название"], ["discount", "Скидка"], ["startDate", "Начало"], ["endDate", "Окончание"], ["notes", "Примечания"]], cols: ["name", "status", "discount", "startDate", "endDate"] },
  tasks: { title: "Задачи", sub: "Рабочие сигналы превращаются в ответственные действия с контролем сроков.", endpoint: "tasks", action: "Создать задачу", fields: [["title", "Название"], ["description", "Описание"], ["priority", "Приоритет"], ["dueAt", "Срок"]], cols: ["title", "status", "priority", "dueAt"] },
  team: { title: "Команда", sub: "Пользователи, обязанности и доступ внутри компании.", endpoint: "team", action: "Пригласить сотрудника", fields: [], cols: ["fullName", "email", "phone", "status", "createdAt"] },
  branches: { title: "Филиалы", sub: "Рабочие точки, склады и управление на уровне филиалов.", endpoint: "branches", action: "Добавить филиал", fields: [["name", "Название"], ["code", "Код"], ["address", "Адрес"], ["phone", "Телефон"]], cols: ["name", "code", "address", "phone", "isActive"] },
  integrations: { title: "Интеграции", sub: "ERP, платежные, фискальные и внешние подключения.", endpoint: "integrations", action: "Добавить интеграцию", fields: [["name", "Название"], ["provider", "Провайдер"], ["endpoint", "Адрес подключения"]], cols: ["name", "provider", "status", "lastSyncAt"] },
  reports: { title: "Отчёты", sub: "Сводные показатели на основе реальных данных рабочего пространства.", endpoint: "reports/summary", action: "Обновить", fields: [], cols: ["metric", "value"] },
  suppliers: { title: "Поставщики", sub: "Данные поставщиков для закупок и приёмки.", endpoint: "suppliers", action: "Добавить поставщика", fields: [["name", "Название"], ["phone", "Телефон"], ["address", "Адрес"]], cols: ["name", "code", "phone", "address", "createdAt"] },
  warehouses: { title: "Склады", sub: "Склады и контроль запасов на уровне филиалов.", endpoint: "warehouses", action: "Добавить склад", fields: [["branchId", "ID филиала"], ["name", "Название"], ["code", "Код"]], cols: ["name", "code", "branchId", "isActive"] },
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
    return <div className="landing"><div className="empty-work"><h2>Подготовка рабочего пространства…</h2><p>Проверяем доступ к данным компании.</p></div></div>;
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
        <main className="content"><PageView page={page} tokenUser={user} toast={setToast} go={setPage} /></main>
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

function PageView({ page, tokenUser, toast, go }: { page: Page; tokenUser: User; toast: (s: string) => void; go: (p: Page) => void }) {
  if (page === "dashboard") return <Dashboard user={tokenUser} go={go} />;
  if (page === "analytics") return <Analytics user={tokenUser} />;
  if (page === "settings") return <Settings toast={toast} />;
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

function ModuleView({ page, user, toast }: any) {
  const c = cfg[page];
  const { rows, setRows, loading, error, reload } = useApiData(c.endpoint, user);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())), [rows, search]);

  const create = async (data: any) => {
    try {
      const t = await user.getIdToken();
      if (page === "purchases") {
        toast("Для создания закупки укажите поставщика, склад и позиции через рабочий процесс закупки.");
        setOpen(false);
        return;
      }
      const d = await apiFetchAuth<any>("/api/v1/data/" + c.endpoint, t, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setRows(x => [d, ...x]); setOpen(false); toast("Запись сохранена.");
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось сохранить запись."); }
  };

  const stat = page === "reports" || page === "stockMovements" || page === "auditLogs" || page === "notifications" ? [] :
    [["Записи", rows.length], ["Активные", rows.filter(r => String(r.status || r.isActive).toLowerCase().includes("active") || r.isActive === true).length], ["Внимание", rows.filter(r => ["low", "pending", "overdue", "failed"].includes(String(r.status).toLowerCase())).length], ["Обновлено", "В реальном времени"]];

  return <div>
    <PageHeader title={c.title} subtitle={c.sub} actions={<button className="button primary" onClick={() => page === "reports" ? void reload() : setOpen(true)}>+ {c.action}</button>} />
    {stat.length > 0 && <div className="module-stat-grid">{stat.map((x: any, i: number) => <div className="module-stat" key={x[0]}><span className="module-stat-icon">{["◒", "✓", "!", "↗"][i]}</span><small>{x[0]}</small><b>{x[1]}</b><span className={i === 2 ? "warn" : "good"}>{i === 3 ? "В реальном времени" : "Текущие данные"}</span></div>)}</div>}
    <div className="toolbar"><div className="searchbox">⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Поиск: " + c.title.toLowerCase() + "..."} /></div><button className="filter-btn" onClick={() => setSearch("")}>Очистить</button><span className="toolbar-count">{filtered.length} записей</span></div>
    <section className="panel table-panel">
      {loading ? <div className="empty-work"><h3>Загрузка данных…</h3></div> :
       error ? <div className="empty-work"><h3>Не удалось загрузить данные</h3><p>{error}</p><button className="button outline" onClick={() => void reload()}>Повторить</button></div> :
       filtered.length === 0 ? <div className="empty-work"><h3>Записей пока нет</h3><p>{page === "stockMovements" || page === "auditLogs" || page === "notifications" ? "Пока нет записей для отображения." : "Создайте первую запись, чтобы начать работу с разделом."}</p></div> :
       <><Table rows={filtered} columns={c.cols} /><WorkflowBar page={page} rows={filtered} user={user} reload={reload} toast={toast} /></>}
    </section>
    {open && <CreateModal config={c} close={() => setOpen(false)} save={create} user={user} />}
  </div>;
}

function WorkflowBar({ page, rows, user, reload, toast }: { page: Page; rows: Row[]; user: User; reload: () => Promise<void>; toast: (s: string) => void }) {
  const [busy, setBusy] = useState("");
  const act = async (path: string, body?: any) => {
    setBusy(path);
    try {
      const t = await user.getIdToken();
      await apiFetchAuth<any>("/api/v1/data/" + path, t, body ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { method: "PATCH" });
      toast("Операция выполнена."); await reload();
    } catch (e) { toast(e instanceof Error ? e.message : "Не удалось выполнить операцию."); }
    finally { setBusy(""); }
  };
  const first = rows[0];
  if (!first) return null;
  return <div className="workflow-bar"><b>Быстрое действие</b>
    {page === "orders" && <><button className="button outline" disabled={!!busy} onClick={() => void act("orders/" + first.id + "/status", { status: first.status === "draft" ? "confirmed" : "completed" })}>{busy ? "Выполняется…" : first.status === "draft" ? "Подтвердить первый заказ" : "Завершить первый заказ"}</button><span>Действие применяется к первому отображаемому заказу.</span></>}
    {page === "purchases" && <><button className="button outline" disabled={!!busy} onClick={() => void act("purchases/" + first.id + "/receive")}>{busy ? "Приёмка…" : "Принять первую закупку"}</button><span>Приёмка обновляет остатки и журнал движений запасов.</span></>}
    {page === "notifications" && <><button className="button outline" disabled={!!busy || !!first.readAt} onClick={() => void act("notifications/" + first.id + "/read")}>{first.readAt ? "Уже прочитано" : "Отметить первое как прочитанное"}</button><span>Управление уведомлениями пользователя.</span></>}
    {page !== "orders" && page !== "purchases" && page !== "notifications" && <span>Используйте фильтры и действия раздела для работы с актуальными данными компании.</span>}
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

function ReferencePicker({ user, type, value, onChange, placeholder }: { user: User; type: string; value: string; onChange: (id: string) => void; placeholder: string }) {
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
        const rows = await apiFetchAuth<any[]>(
          `/api/v1/lookups/${type}?q=${encodeURIComponent(query.trim())}`,
          token,
        );
        if (active) setItems(Array.isArray(rows) ? rows : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 160);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, type, user.uid]);

  const choose = (item: any) => {
    setSelected(item);
    setQuery("");
    setItems([]);
    onChange(String(item.id));
  };

  const itemLabel = (item: any) => {
    if (type === "orders") return item.orderNumber ? "Заказ №" + item.orderNumber : item.id;
    if (type === "products") return [item.name, item.sku, item.barcode].filter(Boolean).join(" · ");
    if (type === "customers") return [item.name, item.address, item.phone].filter(Boolean).join(" · ");
    if (type === "warehouses") return [item.name, item.code].filter(Boolean).join(" · ");
    if (type === "branches") return [item.name, item.code, item.address].filter(Boolean).join(" · ");
    return [item.name, item.code].filter(Boolean).join(" · ") || item.id;
  };

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  return <div className="customer-picker">
    <input
      data-customer-picker="true"
      value={selected ? itemLabel(selected) : query}
      onChange={e => {
        if (selected) {
          setSelected(null);
          onChange("");
        }
        setQuery(e.target.value);
      }}
      placeholder={placeholder}
      autoComplete="off"
      required
    />
    {loading && <small className="lookup-hint">Поиск…</small>}
    {!loading && query.trim() && items.length === 0 && <small className="lookup-hint">Ничего не найдено.</small>}
    {items.length > 0 && <div className="customer-picker-list">
      {items.map(item => <button
        type="button"
        className="customer-picker-option"
        key={item.id}
        onMouseDown={e => e.preventDefault()}
        onClick={() => choose(item)}
      >
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
  const { rows, loading } = useApiData("dashboard", user);
  const d = rows[0] || {};
  return <div><PageHeader title="Панель управления бизнесом" subtitle="Оперативные данные вашей компании в реальном времени." actions={<><button className="button outline" onClick={() => go("reports")}>Отчёты</button><button className="button primary" onClick={() => go("orders")}>+ Новый заказ</button></>} />
    <div className="dashboard-grid">{[["Завершённые продажи", money(d.sales || 0), "В реальном времени"], ["Заказы", d.orders ?? 0, "В реальном времени"], ["Клиенты", d.customers ?? 0, "В реальном времени"], ["Статус", loading ? "Загрузка…" : "Работает", loading ? "" : "API"]].map(x => <div className="kpi" key={x[0] as string}><div><small>{x[0]}</small><b>{x[1]}</b><span className="good">{x[2]}</span></div><i>↗</i></div>)}</div>
    <div className="dashboard-columns"><section className="panel"><PanelHead title="Последние заказы" action="Открыть заказы" onClick={() => go("orders")} /><Table rows={d.recent || []} columns={["orderNumber", "customer", "total", "status", "createdAt"]} /></section>
      <section className="panel"><PanelHead title="Рабочие разделы" /><div className="alert-list">{[["Маршруты", "routes"], ["Визиты", "visits"], ["Задачи", "tasks"], ["Остатки", "inventory"]].map(x => <div key={x[0]}><span className="stock-symbol warn">→</span><span><b>{x[0]}</b><small>Открыть раздел</small></span><button className="button ghost" onClick={() => go(x[1] as Page)}>Открыть</button></div>)}</div></section>
    </div>
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

function Settings({ toast }: { toast: (s: string) => void }) {
  return <div><PageHeader title="Настройки" subtitle="Параметры компании и операционные настройки." />
    <div className="module-stat-grid">{["Профиль компании", "Безопасность", "Уведомления", "Данные и аудит"].map((x, i) => <div className="module-stat" key={x}><span className="module-stat-icon">{["◈", "✓", "◔", "▤"][i]}</span><small>{x}</small><b>Настроено</b><span className="good">Доступно</span></div>)}</div>
    <section className="panel module-workspace"><div className="empty-work"><div className="empty-icon">⚙</div><h3>Настройки рабочего пространства</h3><p>Авторизация, изоляция данных компании, журнал аудита, доступ к API и операционные разделы подключены.</p>
      <div className="quick-actions"><button className="button outline" onClick={() => toast("Журнал аудита API включён.")}>Журнал аудита</button><button className="button outline" onClick={() => toast("Настройки интеграций API включены.")}>Доступ к API</button><button className="button primary" onClick={() => toast("Настройки сохраняются через защищённые API-маршруты.")}>Сохранить настройки</button></div>
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
function Table({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{label(c)}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{columns.map(c => <td key={c}>
    {c === "status" || c === "isActive" ? <Badge>{c === "isActive" ? (r[c] ? "Активен" : "Неактивен") : displayValue(r[c])}</Badge> :
     ["total", "amount", "creditLimit", "costPrice", "salePrice", "sales", "collected"].includes(c) ? <b>{money(r[c])}</b> : displayValue(r[c])}
  </td>)}</tr>)}</tbody></table></div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
