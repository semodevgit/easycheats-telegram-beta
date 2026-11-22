'use strict';
// Supabase (PostgREST) ince katmanı — bağımlılık yok, sadece fetch.
// Tüm iş mantığı veritabanındaki fonksiyonlarda (rpc) çalışır.

class DbError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'DbError';
    this.status = status;
    this.code = code;
  }
}

function config() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) throw new DbError('server_not_configured', 500, 'config');
  return { url, key };
}

function headers(key) {
  const h = { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' };
  // Yeni "sb_secret_..." anahtarları JWT değildir; sadece apikey başlığında gönderilir.
  if (!key.startsWith('sb_')) h.Authorization = 'Bearer ' + key;
  return h;
}

async function rpc(fn, args) {
  const { url, key } = config();
  let res;
  try {
    res = await fetch(url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(args || {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new DbError('db_unreachable', 502, 'network');
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = null; }
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.hint)) || 'db_' + res.status;
    throw new DbError(String(msg), res.status, data && data.code);
  }
  return data;
}

module.exports = { rpc, DbError };
