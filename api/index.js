'use strict';
const { handle, mapError } = require('../lib/ops');

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (e) { return null; }
    }
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString('utf8')); } catch (e) { return null; }
    }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1024 * 1024) return null;
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return null; }
}

// Tek uç nokta: POST /api  { op: "...", ... }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed', message: 'Yalnızca POST desteklenir.' });
  const body = await readBody(req);
  if (!body || typeof body !== 'object') return send(res, 400, { ok: false, error: 'bad_request', message: 'Geçersiz istek.' });
  try {
    const data = await handle(body.op, body, req);
    return send(res, 200, { ok: true, data: data === undefined ? null : data });
  } catch (e) {
    const err = mapError(e);
    return send(res, err.status, { ok: false, error: err.code, message: err.message });
  }
};
