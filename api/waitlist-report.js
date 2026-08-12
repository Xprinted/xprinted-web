// api/waitlist-report.js — Panel privado: qué productos tienen gente en lista de espera.
// Uso: https://TU-SITIO/api/waitlist-report?key=TU_CLAVE  (WAITLIST_ADMIN_KEY en Vercel)
// Muestra una tabla con cada producto, cuánta gente espera y sus emails.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  const d = await r.json();
  return d.result ? JSON.parse(d.result) : null;
}

export default async function handler(req, res) {
  const admin = process.env.WAITLIST_ADMIN_KEY;
  if (!admin || req.query.key !== admin) return res.status(401).send('No autorizado');
  if (!KV_URL || !KV_TOKEN) return res.status(500).send('KV no configurado');

  const index = (await kvGet('wl:index')) || [];
  const rows = [];
  for (const id of index) {
    const rec = await kvGet(`wl:${id}`);
    if (rec && rec.emails && rec.emails.length) {
      rows.push({ id, title: rec.title || id, count: rec.emails.length, emails: rec.emails, updated: rec.updated || '' });
    }
  }
  rows.sort((a, b) => b.count - a.count);

  if (req.query.format === 'json') return res.status(200).json({ total: rows.length, rows });

  const total = rows.reduce((s, r) => s + r.count, 0);
  const body = rows.length ? rows.map(r => `
    <tr>
      <td><b>${r.title}</b><br><span class="mono">${r.id} · <a href="https://articulo.mercadolibre.com.ar/${r.id.replace('MLA','MLA-')}" target="_blank">ver publicación</a></span></td>
      <td class="num">${r.count}</td>
      <td class="mono small">${r.emails.join('<br>')}</td>
    </tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#8a8a8c;padding:30px;">Nadie anotado por ahora.</td></tr>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Lista de espera — XPRINTED</title>
<style>
body{background:#0A0A0A;color:#F0F0EE;font-family:system-ui,sans-serif;padding:40px 20px;max-width:900px;margin:0 auto;}
h1{font-size:1.5rem;} h1 span{color:#E0A94A;}
.sum{color:#9a9a9c;margin-bottom:24px;}
table{width:100%;border-collapse:collapse;background:#141416;border:1px solid #26272a;border-radius:12px;overflow:hidden;}
th{background:#1a1b1e;color:#E0A94A;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;text-align:left;padding:12px 14px;}
td{padding:14px;border-top:1px solid #222224;vertical-align:top;font-size:0.9rem;}
.num{font-size:1.4rem;font-weight:800;color:#E0A94A;text-align:center;}
.mono{font-family:monospace;font-size:0.72rem;color:#8a8a8c;} .small{line-height:1.7;}
a{color:#E0A94A;}
</style></head><body>
<h1>Lista de espera <span>·</span> XPRINTED</h1>
<p class="sum"><b>${rows.length}</b> productos con demanda · <b>${total}</b> personas esperando en total. Esto también te sirve para decidir qué reponer primero.</p>
<table><tr><th>Producto</th><th>Esperando</th><th>Emails</th></tr>${body}</table>
</body></html>`);
}
