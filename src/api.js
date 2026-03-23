const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
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
  return request(`/sites/${id}`, {
    method: "DELETE",
  });
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
  return request(`/workers/${id}`, {
    method: "DELETE",
  });
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
