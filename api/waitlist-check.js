// api/waitlist-check.js — Corre una vez por día (Vercel Cron, ver vercel.json).
// Revisa qué productos con lista de espera volvieron a tener stock y envía los avisos por email.
// Requiere: KV_REST_API_URL, KV_REST_API_TOKEN, RESEND_API_KEY.
// Opcionales: RESEND_FROM (ej: "XPRINTED <avisos@xprinted.com.ar>"), WAITLIST_ADMIN_KEY (para correrlo a mano con ?key=...).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || 'XPRINTED <onboarding@resend.dev>';

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  return d.result ? JSON.parse(d.result) : null;
}
async function kvSet(key, obj) {
  await fetch(`${KV_URL}/set/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` }, body: JSON.stringify(obj) });
}
async function kvDel(key) {
  await fetch(`${KV_URL}/del/${key}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

function emailHtml(title, url, unsubUrl) {
  return `<div style="background:#0A0A0A;padding:32px 16px;font-family:Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #26272a;border-radius:12px;padding:28px;">
    <div style="font-size:22px;font-weight:bold;color:#F0F0EE;">XPRINTED<span style="color:#E0A94A;">.</span></div>
    <h2 style="color:#F0F0EE;margin:18px 0 6px;">¡Volvió el stock! 🎉</h2>
    <p style="color:#b8b8b6;line-height:1.6;margin:0 0 18px;">Nos pediste que te avisemos cuando volviera este producto, y ya está disponible de nuevo:</p>
    <p style="color:#F0F0EE;font-weight:bold;margin:0 0 18px;">${title}</p>
    <a href="${url}" style="display:inline-block;background:#E0A94A;color:#171006;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;">Ver en Mercado Libre</a>
    <p style="color:#6a6a6c;font-size:12px;margin:24px 0 0;line-height:1.5;">Los productos con lista de espera se agotan rápido — si te interesa, no lo dejes pasar.<br><a href="${unsubUrl}" style="color:#6a6a6c;">No avisarme más por este producto</a></p>
  </div>
</div>`;
}

export default async function handler(req, res) {
  // Acepta la invocación del cron de Vercel o una corrida manual con la clave de admin
  const ua = req.headers['user-agent'] || '';
  const manual = req.query.key && process.env.WAITLIST_ADMIN_KEY && req.query.key === process.env.WAITLIST_ADMIN_KEY;
  if (!ua.startsWith('vercel-cron') && !manual) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: 'KV no configurado' });

  const index = (await kvGet('wl:index')) || [];
  if (!index.length) return res.status(200).json({ ok: true, pendientes: 0, enviados: 0 });

  // Estado actual del catálogo (incluye stock)
  const host = req.headers.host;
  const proto = host && host.startsWith('localhost') ? 'http' : 'https';
  let byId = {};
  try {
    const r = await fetch(`${proto}://${host}/api/ml-products`);
    const d = await r.json();
    (d.products || []).forEach(p => { byId[p.id] = p; });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo leer el catálogo' });
  }

  let enviados = 0, productosAvisados = [], errores = 0;
  const nuevoIndex = [];

  for (const id of index) {
    const rec = await kvGet(`wl:${id}`);
    if (!rec || !rec.emails || !rec.emails.length) continue;
    const prod = byId[id];

    if (prod && prod.stock > 0) {
      // ¡Volvió! Avisar a todos los anotados.
      if (!RESEND_KEY) { nuevoIndex.push(id); continue; } // sin servicio de email configurado: no perder la lista
      let okTodos = true;
      for (const email of rec.emails) {
        try {
          const unsub = `${proto}://${host}/api/waitlist?unsub=1&item=${id}&email=${encodeURIComponent(email)}`;
          const send = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM,
              to: email,
              subject: `¡Volvió el stock! ${rec.title || 'Tu producto en XPRINTED'}`,
              html: emailHtml(rec.title || 'Producto', prod.url, unsub)
            })
          });
          if (send.ok) enviados++;
          else { okTodos = false; errores++; }
        } catch (e) { okTodos = false; errores++; }
      }
      if (okTodos) { await kvDel(`wl:${id}`); productosAvisados.push(rec.title); }
      else nuevoIndex.push(id); // reintentar mañana los que fallaron
    } else {
      nuevoIndex.push(id); // sigue sin stock (o pausado): mantener la lista
    }
  }

  await kvSet('wl:index', nuevoIndex);
  return res.status(200).json({ ok: true, pendientes: nuevoIndex.length, enviados, errores, productosAvisados });
}
