// api/ml-auth.js
// Paso 1 del OAuth: redirige al usuario a Mercado Libre para autorizar la app.
// Se usa UNA sola vez (o cuando haya que reconectar). Al entrar a esta URL,
// el navegador te manda a ML para que inicies sesión y autorices.

export default function handler(req, res) {
  const clientId = process.env.ML_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('Falta ML_CLIENT_ID en las variables de entorno.');
  }

  const redirectUri = 'https://xprinted-web.vercel.app/api/ml-callback';

  // Sitio Argentina: la autorización se hace en el dominio .com.ar
  const authUrl = 'https://auth.mercadolibre.com.ar/authorization'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri);

  res.writeHead(302, { Location: authUrl });
  res.end();
}
