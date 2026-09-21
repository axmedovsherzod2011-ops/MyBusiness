import { useEffect, useState } from "react";
import { getApiStatus } from "./lib/api";
import "./styles.css";

export default function App() {
  const [api, setApi] = useState<"checking" | "ready" | "offline">("checking");

  useEffect(() => {
    getApiStatus()
      .then(() => setApi("ready"))
      .catch(() => setApi("offline"));
  }, []);

  return (
    <main className="clean-start">
      <div className="start-card">
        <div className="brand-mark">M</div>
        <p className="eyebrow">Новая платформа</p>
        <h1>Готово к созданию M Cosmetics</h1>
        <p className="description">
          Старый интерфейс и бизнес-логика MyBusiness удалены. Теперь это чистая основа
          для нового online marketplace одной компании.
        </p>
        <div className={"api-status " + api}>
          <span />
          {api === "checking" ? "Проверка сервера…" : api === "ready" ? "Сервер готов" : "Сервер недоступен"}
        </div>
      </div>
    </main>
  );
}
