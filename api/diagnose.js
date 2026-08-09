// api/diagnose.js — Endpoint serverless para el diagnosticador con IA (Claude)
// Requiere la variable de entorno ANTHROPIC_API_KEY configurada en Vercel.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API no configurada' });
  }

  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || question.length > 800) {
      return res.status(400).json({ error: 'Consulta inválida' });
    }

    const systemPrompt = `Sos el asistente técnico de XPRINTED, una tienda argentina de repuestos para impresoras 3D. Ayudás a diagnosticar problemas de impresión 3D de forma clara, breve y en español rioplatense (voseo: tenés, podés, fijate).

Reglas:
- Respondé en 3-6 líneas, directo y práctico. Nada de introducciones largas.
- Si la persona NO mencionó el modelo de su impresora y el modelo cambiaría el diagnóstico o el repuesto a recomendar, pedíselo brevemente al final ("¿Qué modelo de impresora tenés? Así te digo el repuesto exacto"). Igual dale un diagnóstico general con lo que tenés.
- Diagnosticá el problema probable y decí QUÉ REVISAR paso a paso.
- Si el problema se soluciona con un repuesto que vende XPRINTED (hotend, nozzle, cama magnética, termistor, resistencia, acople, tubo de teflón, ventilador/cooler, correa, barrel), mencionalo naturalmente.
- Si aplica, sugerí leer la guía correspondiente usando enlaces markdown a estas rutas exactas: guía de hotends [guía de hotends](/guias/hotends.html), nozzles [guía de nozzles](/guias/nozzles.html), camas [guía de camas](/guias/camas.html), termistores [guía de termistores](/guias/termistores.html), acoples [guía de acoples](/guias/acoples.html), coolers [guía de ventiladores](/guias/coolers.html).
- Usá **negrita** para resaltar lo importante.
- No inventes precios ni stock. Si la consulta es ambigua o grave, sugerí escribir por WhatsApp.
- No respondas temas ajenos a impresión 3D; redirigí amablemente al tema.`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }]
      })
    });

    if (!anthropicRes.ok) {
      return res.status(502).json({ error: 'Error del asistente' });
    }

    const data = await anthropicRes.json();
    const answer = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ answer });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
}
