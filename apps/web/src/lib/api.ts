const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "https://mybusiness-api-e6dk.onrender.com";

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getApiStatus() {
  return apiFetch<{ name: string; version: string; status: string }>("/api/v1");
}

export async function apiFetchAuth<T>(path: string, token: string, init?: RequestInit) {
  return apiFetch<T>(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
}
