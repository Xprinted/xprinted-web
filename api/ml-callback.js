// api/ml-callback.js
// Paso 2 del OAuth: ML redirige acá con un "code". Lo cambiamos por el
// access_token + refresh_token y lo guardamos en la cajita KV (Upstash).

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Guarda un valor en la cajita KV vía su API REST (sin SDK).
async function kvSet(key, value) {
  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error('KV set falló: ' + res.status);
  return res.json();
}

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Falta el parámetro "code". Volvé a empezar desde /api/ml-auth');
  }

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const redirectUri = 'https://xprinted-web.vercel.app/api/ml-callback';

  if (!clientId || !clientSecret) {
    return res.status(500).send('Faltan credenciales de ML en las variables de entorno.');
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).send('Falta la conexión con la base KV.');
  }

  try {
    // Cambiar el code por el token
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      })
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok || !data.access_token) {
      return res.status(502).send('Error al obtener el token de ML: ' + JSON.stringify(data));
    }

    // Guardar todo lo necesario, con el momento de expiración calculado
    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user_id,
      expires_at: Date.now() + (data.expires_in * 1000) // expires_in viene en segundos
    };

    await kvSet('ml_token', tokenData);

    // Página de éxito simple
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <html><head><meta charset="utf-8"><title>Conectado</title>
      <style>body{background:#0A0A0A;color:#F0F0EE;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
      .box{max-width:480px;padding:40px;}h1{color:#4ec87a;}code{background:#191919;padding:2px 6px;border-radius:4px;font-size:0.85rem;}a{color:#E0A94A;}</style></head>
      <body><div class="box">
      <h1>✓ Conectado con Mercado Libre</h1>
      <p>La app quedó autorizada y el token se guardó correctamente.</p>
      <p>Tu seller_id es <code>${data.user_id}</code></p>
      <p>Ya podés cerrar esta ventana. El catálogo va a mostrar tus productos en vivo.</p>
      <p><a href="/catalogo.html">Ir al catálogo →</a></p>
      </div></body></html>
    `);
  } catch (err) {
    return res.status(500).send('Error interno: ' + err.message);
  }
}
