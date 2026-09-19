const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "https://mybusiness-api-e6dk.onrender.com";

type LookupItem = {
  id: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  orderNumber?: number | null;
};

const lookupTypes: Record<string, string> = {
  "ID клиента": "customers",
  "Клиент": "customers",
  "ID заказа": "orders",
  "ID филиала": "branches",
  "Склад-источник": "warehouses",
  "Склад-получатель": "warehouses",
  "Товар": "products",
};

let referenceToken = "";
const referenceMatches = new WeakMap<HTMLInputElement, LookupItem[]>();
let referenceObserverStarted = false;
let originalFetch: typeof window.fetch | null = null;

function lookupValue(item: LookupItem) {
  return String(item.id);
}

function lookupLabel(item: LookupItem) {
  return [item.code || item.sku, item.barcode, item.name, item.orderNumber ? "№" + item.orderNumber : ""]
    .filter(Boolean)
    .join(" · ");
}

async function searchReference(input: HTMLInputElement, type: string, query: string) {
  if (!referenceToken || query.trim().length < 1) {
    referenceMatches.set(input, []);
    return;
  }

  try {
    const url = API_BASE_URL + "/api/v1/lookups/" + type + "?q=" + encodeURIComponent(query.trim());
    const response = await originalFetch!(url, {
      headers: { Accept: "application/json", Authorization: "Bearer " + referenceToken },
    });
    if (!response.ok) {
      referenceMatches.set(input, []);
      return;
    }

    const items = await response.json() as LookupItem[];
    referenceMatches.set(input, Array.isArray(items) ? items : []);

    const listId = input.dataset.lookupList;
    if (!listId) return;
    const list = document.getElementById(listId);
    if (!list) return;

    list.replaceChildren(...(Array.isArray(items) ? items.slice(0, 20) : []).map((item) => {
      const option = document.createElement("option");
      option.value = lookupValue(item);
      const label = lookupLabel(item);
      if (label) option.label = label;
      return option;
    }));
  } catch {
    referenceMatches.set(input, []);
  }
}

function attachReferenceInput(input: HTMLInputElement, labelText: string) {
  const type = lookupTypes[labelText];
  if (!type || input.dataset.lookupBound === "true") return;

  input.dataset.lookupBound = "true";
  input.dataset.lookupType = type;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-autocomplete", "list");

  const listId = "mybusiness-lookup-" + Math.random().toString(36).slice(2);
  input.dataset.lookupList = listId;
  input.setAttribute("list", listId);

  const list = document.createElement("datalist");
  list.id = listId;
  input.insertAdjacentElement("afterend", list);

  input.addEventListener("input", () => {
    const value = input.value.trim();
    void searchReference(input, type, value);
    if (!value) {
      input.setCustomValidity("");
      return;
    }
    input.setCustomValidity("Выберите существующую запись из списка.");
  });

  input.addEventListener("change", () => {
    const value = input.value.trim();
    const matches = referenceMatches.get(input) || [];
    const exact = matches.some(item => lookupValue(item) === value);
    input.setCustomValidity(exact ? "" : "Выберите существующую запись из списка.");
  });

  input.addEventListener("blur", () => {
    const value = input.value.trim();
    if (!value) {
      input.setCustomValidity("");
      return;
    }
    const matches = referenceMatches.get(input) || [];
    const exact = matches.some(item => lookupValue(item) === value);
    input.setCustomValidity(exact ? "" : "Выберите существующую запись из списка.");
  });
}

function scanReferenceInputs(root: ParentNode = document) {
  root.querySelectorAll("label").forEach((label) => {
    const text = Array.from(label.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent?.trim() || "")
      .join(" ")
      .trim();
    if (!text) return;
    const input = label.querySelector("input");
    if (input) attachReferenceInput(input, text);
  });
}

function validateReferenceInputs(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("button");
  if (!button || button.textContent?.trim() !== "Сохранить") return;

  const modal = button.closest(".quick-modal");
  if (!modal) return;

  const invalid = Array.from(modal.querySelectorAll<HTMLInputElement>("input[data-lookup-bound='true']"))
    .find(input => !input.value.trim() || !input.checkValidity());

  if (invalid) {
    invalid.setCustomValidity("Выберите существующую запись из списка.");
    invalid.reportValidity();
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function installReferenceAutocomplete() {
  if (referenceObserverStarted || typeof window === "undefined") return;
  referenceObserverStarted = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorization = headers.get("Authorization");
    if (authorization?.startsWith("Bearer ")) referenceToken = authorization.slice(7);
    return originalFetch!(input, init);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scanReferenceInputs(node);
      });
    }
    scanReferenceInputs();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", validateReferenceInputs, true);
  scanReferenceInputs();
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.message ??
      (response.status === 429
        ? "Слишком много запросов. Повторите попытку немного позже."
        : "Запрос завершился с кодом " + response.status),
    );
  }

  return response.json() as Promise<T>;
}

export async function getApiStatus() {
  return apiFetch<{ name: string; version: string; status: string }>("/api/v1");
}

export async function apiFetchAuth<T>(path: string, token: string, init?: RequestInit) {
  referenceToken = token;
  return apiFetch<T>(path, { ...init, headers: { ...(init?.headers || {}), Authorization: "Bearer " + token } });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", installReferenceAutocomplete, { once: true });
  } else {
    installReferenceAutocomplete();
  }
}
