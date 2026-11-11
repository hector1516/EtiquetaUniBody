const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function req(path: string, init?: RequestInit, retries = 4): Promise<any> {
  let lastErr: any = null;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(t || `HTTP ${r.status}`);
      }
      return await r.json().catch(() => ({}));
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await new Promise(res => setTimeout(res, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

export const api = {
  get: (p: string) => req(p),
  post: (p: string, body?: any) => req(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: (p: string, body?: any) => req(p, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: (p: string) => req(p, { method: 'DELETE' }),
};
