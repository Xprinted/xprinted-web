// api/ml-reputation.js — Reputación pública del vendedor en Mercado Libre, en vivo.
// Devuelve {medal, positive, transactions} para mostrar como prueba de confianza en la web.
// Cachea 1 hora. Si algo falla, devuelve {medal:null} y la web simplemente no muestra el badge.

const SELLER_ID = '1954423536';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const MEDALS = {
  platinum: 'MercadoLíder Platinum',
  gold: 'MercadoLíder Gold',
  silver: 'MercadoLíder'
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  try {
    // Intento con token guardado (más campos disponibles); si no hay, va sin token (datos públicos).
    let headers = {};
    try {
      if (KV_URL && KV_TOKEN) {
        const r = await fetch(`${KV_URL}/get/ml_token`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
        const d = await r.json();
        const tok = d.result ? JSON.parse(d.result) : null;
        if (tok && tok.access_token) headers = { Authorization: `Bearer ${tok.access_token}` };
      }
    } catch (e) { /* seguimos sin token */ }

    let r = await fetch(`https://api.mercadolibre.com/users/${SELLER_ID}`, { headers });
    if (!r.ok && headers.Authorization) {
      // token vencido u otro problema: reintento público
      r = await fetch(`https://api.mercadolibre.com/users/${SELLER_ID}`);
    }
    if (!r.ok) return res.status(200).json({ medal: null });

    const u = await r.json();
    const rep = u.seller_reputation || {};
    const medal = MEDALS[rep.power_seller_status] || null;
    const ratings = (rep.transactions && rep.transactions.ratings) || {};
    const positive = typeof ratings.positive === 'number' ? Math.round(ratings.positive * 1000) / 10 : null;
    const transactions = (rep.transactions && rep.transactions.completed) || null;

    return res.status(200).json({ medal, positive, transactions });
  } catch (e) {
    return res.status(200).json({ medal: null });
  }
}
