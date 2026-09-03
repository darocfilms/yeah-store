// Lista/busca pagos de MercadoPago para revisión manual (panel propio, debug,
// conciliación). Usa el endpoint de búsqueda documentado por MercadoPago
// (GET /v1/payments/search) — es el equivalente soportado a "listar pagos";
// /v1/payments sin /search no es un endpoint estable de la API.
//
// Protegido con un token compartido: este endpoint devuelve emails y montos
// de clientes, así que NUNCA debe quedar abierto sin ADMIN_TOKEN configurado.
//
// Uso:
//   curl -H "x-admin-token: $ADMIN_TOKEN" \
//     "https://TU-SITIO.netlify.app/.netlify/functions/list-mp-payments?status=approved&limit=20"

const { requiereAdminOToken } = require('./_lib/auth-admin');

const ALLOWED_PARAMS = ['sort', 'criteria', 'external_reference', 'status', 'begin_date', 'end_date', 'offset', 'limit'];

const { conectarBlobs } = require('./_lib/blobs');

exports.handler = async (event) => {
  conectarBlobs(event);
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };

  const guard = await requiereAdminOToken(event);
  if (guard.error) return guard.error;

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return { statusCode: 500, body: JSON.stringify({ error: 'MercadoPago no está configurado (falta MP_ACCESS_TOKEN).' }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const search = new URLSearchParams();
    for (const key of ALLOWED_PARAMS) {
      if (params[key]) search.set(key, params[key]);
    }
    if (!search.has('limit')) search.set('limit', '30');
    if (!search.has('sort')) search.set('sort', 'date_created');
    if (!search.has('criteria')) search.set('criteria', 'desc');

    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${search.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MercadoPago API error ${res.status}: ${text}`);
    }
    const data = await res.json();

    const results = (data.results || []).map((p) => {
      let orderItems = [];
      try { orderItems = JSON.parse(p.metadata?.order_items || '[]'); } catch (e) { orderItems = []; }
      return {
        id: p.id,
        status: p.status,
        status_detail: p.status_detail,
        date_created: p.date_created,
        date_approved: p.date_approved,
        transaction_amount: p.transaction_amount,
        currency_id: p.currency_id,
        payer_email: p.payer?.email,
        order_items: orderItems
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paging: data.paging, results })
    };
  } catch (err) {
    console.error('[YEAH] list-mp-payments error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo consultar los pagos de MercadoPago.' }) };
  }
};
