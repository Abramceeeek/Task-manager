export async function api(path: string, method = "GET", body?: any) {
  const base = process.env.API_BASE || "http://localhost:8000";
  const res = await fetch(base + (path.startsWith("/") ? path : `/${path}`), {
    method,
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": `ui-${Date.now()}` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`API ${method} ${path} failed`);
  return res.json();
}



