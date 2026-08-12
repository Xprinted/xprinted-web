// api/waitlist.js — Lista de espera "Avisame cuando vuelva"
// POST {id, title, email}  → anota el email para ese producto (guardado en Vercel KV).
// GET  ?unsub=1&item=&email= → da de baja ese email (link incluido en los correos).
// Requiere las variables KV_REST_API_URL y KV_REST_API_TOKEN (ya configuradas para el token de ML).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  return d.result ? JSON.parse(d.result) : null;
}
async function kvSet(key, obj) {
  await fetch(`${KV_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(obj)
  });
}
async function kvDel(key) {
  await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: 'KV no configurado' });

  // ── Baja (link del email) ──
  if (req.method === 'GET' && req.query.unsub === '1') {
    const { item, email } = req.query;
    if (item && email && /^MLA\d+$/.test(item)) {
      const rec = await kvGet(`wl:${item}`);
      if (rec && Array.isArray(rec.emails)) {
        rec.emails = rec.emails.filter(e => e.toLowerCase() !== String(email).toLowerCase());
        if (rec.emails.length) await kvSet(`wl:${item}`, rec);
        else {
          await kvDel(`wl:${item}`);
          const idx = (await kvGet('wl:index')) || [];
          await kvSet('wl:index', idx.filter(i => i !== item));
        }
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send('<body style="background:#0A0A0A;color:#F0F0EE;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Listo ✔</h2><p style="color:#9a9a9c;">No te vamos a escribir por este producto.<br><a href="/" style="color:#E0A94A;">Volver a XPRINTED</a></p></div></body>');
  }

  // ── Alta ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { id, title, email } = req.body || {};
    if (!id || !/^MLA\d+$/.test(id)) return res.status(400).json({ error: 'Producto inválido' });
    if (!email || !EMAIL_RE.test(email) || email.length > 120) return res.status(400).json({ error: 'Email inválido' });
    const cleanTitle = String(title || '').slice(0, 180);

    const key = `wl:${id}`;
    const rec = (await kvGet(key)) || { title: cleanTitle, emails: [] };
    rec.title = cleanTitle || rec.title;
    const lower = email.toLowerCase();
    if (!rec.emails.some(e => e.toLowerCase() === lower)) {
      if (rec.emails.length >= 300) return res.status(429).json({ error: 'Lista llena para este producto' });
      rec.emails.push(email.trim());
      rec.updated = new Date().toISOString();
      await kvSet(key, rec);
      const idx = (await kvGet('wl:index')) || [];
      if (!idx.includes(id)) { idx.push(id); await kvSet('wl:index', idx); }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
