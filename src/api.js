const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "thekedar_token";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export async function login(pin) {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Login failed");
  }
  return data;
}

export function logout() {
  clearToken();
  return fetch(`${API_BASE}/logout`, { method: "POST" }).catch(() => {});
}

export function getBootstrap(month) {
  return request(`/bootstrap?month=${encodeURIComponent(month)}`);
}

export function saveCompany(company) {
  return request("/company", {
    method: "PUT",
    body: JSON.stringify(company),
  });
}

export function createSite(site) {
  return request("/sites", {
    method: "POST",
    body: JSON.stringify(site),
  });
}

export function updateSite(id, site) {
  return request(`/sites/${id}`, {
    method: "PUT",
    body: JSON.stringify(site),
  });
}

export function deleteSite(id) {
  return request(`/sites/${id}`, { method: "DELETE" });
}

export function createWorker(worker) {
  return request("/workers", {
    method: "POST",
    body: JSON.stringify(worker),
  });
}

export function updateWorker(id, worker) {
  return request(`/workers/${id}`, {
    method: "PUT",
    body: JSON.stringify(worker),
  });
}

export function deleteWorker(id) {
  return request(`/workers/${id}`, { method: "DELETE" });
}

export function updateAttendance(payload) {
  return request("/attendance", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function sendChat(messages, month, siteId) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ messages, month, siteId }),
  });
}

export function importBatch(data) {
  return request("/import/batch", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function downloadWages(month) {
  const token = getToken();
  const url = `${API_BASE}/export/wages?month=${encodeURIComponent(month)}`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Wages_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    });
}

export function downloadInvoice(month, siteId) {
  const token = getToken();
  const url = `${API_BASE}/export/invoice?month=${encodeURIComponent(month)}&siteId=${encodeURIComponent(siteId || "all")}`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `Invoice_${month}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    });
}
