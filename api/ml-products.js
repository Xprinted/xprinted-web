// api/ml-products.js
// Trae las publicaciones activas del vendedor con precio y stock en vivo.
// Maneja la renovación automática del token (si está por vencer, lo renueva solo).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SITE_ID = 'MLA'; // Argentina

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!res.ok) throw new Error('KV get falló: ' + res.status);
  const data = await res.json();
  // Upstash devuelve { result: "<string JSON>" }
  if (!data.result) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error('KV set falló: ' + res.status);
  return res.json();
}

// Devuelve un access_token válido, renovándolo si está por vencer.
async function getValidToken() {
  const token = await kvGet('ml_token');
  if (!token || !token.refresh_token) {
    throw new Error('NO_TOKEN'); // nunca se autorizó
  }

  // Si le quedan más de 5 minutos de vida, lo usamos tal cual
  if (token.expires_at && Date.now() < token.expires_at - 5 * 60 * 1000) {
    return token.access_token;
  }

  // Si no, lo renovamos con el refresh_token
  const refreshRes = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: token.refresh_token
    })
  });

  const data = await refreshRes.json();
  if (!refreshRes.ok || !data.access_token) {
    throw new Error('REFRESH_FAILED');
  }

  const newToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    user_id: data.user_id || token.user_id,
    expires_at: Date.now() + (data.expires_in * 1000)
  };
  await kvSet('ml_token', newToken);
  return newToken.access_token;
}

export default async function handler(req, res) {
  // Cache de 5 minutos en el borde para no golpear ML en cada visita
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    if (!KV_URL || !KV_TOKEN) throw new Error('KV no configurada');

    const token = await kvGet('ml_token');
    const accessToken = await getValidToken();
    const sellerId = token.user_id;

    // 1. Traer los IDs de las publicaciones activas del vendedor
    const searchRes = await fetch(
      `https://api.mercadolibre.com/users/${sellerId}/items/search?status=active&limit=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();
    if (!searchRes.ok) {
      return res.status(502).json({ error: 'Error al buscar items', detail: searchData });
    }

    const ids = (searchData.results || []).slice(0, 50);
    if (ids.length === 0) {
      return res.status(200).json({ products: [] });
    }

    // 2. Traer los detalles (precio, stock, foto) en lotes con /items?ids=
    const attributes = 'id,title,price,available_quantity,thumbnail,permalink,status,sold_quantity';
    const chunks = [];
    for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));

    let products = [];
    for (const chunk of chunks) {
      const itemsRes = await fetch(
        `https://api.mercadolibre.com/items?ids=${chunk.join(',')}&attributes=${attributes}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const itemsData = await itemsRes.json();
      if (Array.isArray(itemsData)) {
        for (const entry of itemsData) {
          if (entry.code === 200 && entry.body) {
            const it = entry.body;
            products.push({
              id: it.id,
              title: it.title,
              price: it.price,
              stock: it.available_quantity,
              sold: it.sold_quantity,
              thumbnail: (it.thumbnail || '').replace('http://', 'https://').replace('-I.jpg', '-O.jpg'),
              url: it.permalink
            });
          }
        }
      }
    }

    return res.status(200).json({ products, count: products.length });
  } catch (err) {
    if (err.message === 'NO_TOKEN') {
      return res.status(401).json({ error: 'No conectado con ML. Andá a /api/ml-auth para autorizar.' });
    }
    if (err.message === 'REFRESH_FAILED') {
      return res.status(401).json({ error: 'El token expiró y no se pudo renovar. Reautorizá en /api/ml-auth.' });
    }
    return res.status(500).json({ error: 'Error interno', detail: err.message });
  }
}
