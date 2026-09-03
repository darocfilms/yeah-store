// Envío de emails vía Resend (https://resend.com). Requiere RESEND_API_KEY.
// Si no está configurada, no falla: solo registra un aviso y sigue (el pago
// ya se procesó; el email de entrega es una capa adicional).
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'YEAH! <onboarding@resend.dev>';
const STORE_NOTIFY_EMAIL = process.env.STORE_NOTIFY_EMAIL || 'darocfilms@gmail.com';
const SITE_URL = process.env.SITE_URL || '';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[YEAH] RESEND_API_KEY no configurada — omitiendo envío de email a', to);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
  return res.json();
}

// CLP: sin decimales, miles separados con punto → $22.900 CLP
const clpFormat = new Intl.NumberFormat('es-CL');
function formatMoney(n) {
  return `$${clpFormat.format(n)} CLP`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function orderLinesHtml(lines) {
  return lines
    .map(
      ({ product, qty }) => `
    <tr>
      <td style="padding:8px 0;">${escapeHtml(product.name)} × ${qty}</td>
      <td style="padding:8px 0;text-align:right;">${formatMoney(product.price * qty)}</td>
    </tr>`
    )
    .join('');
}

const { urlDescarga, DIAS_VALIDEZ } = require('./entrega');

// Los clientes de correo ignoran flexbox, grid y hojas externas: todo va en
// tablas con estilos en línea. La marca se sostiene con color, tipografía
// condensada y tono, no con maquetación moderna.
const CREMA = '#EDEBE4', TINTA = '#0B0B0A', LIMA = '#D2FF3C', GRIS = '#5F5C53';
const SANS = "'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";

function botonLima(url, texto) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
    <tr><td bgcolor="${LIMA}" style="border-radius:999px;border:2px solid ${TINTA};">
      <a href="${url}" style="display:block;padding:15px 30px;font-family:${SANS};font-size:13px;
        font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${TINTA};text-decoration:none;">${texto}</a>
    </td></tr></table>`;
}

async function sendDeliveryEmail({ to, lines, total, orderRef, token }) {
  if (!lines.length || !token) return { skipped: true };

  const botones = lines
    .map(({ product }) => botonLima(urlDescarga(SITE_URL, token, product.downloadFile), `Descargar ${product.name}`))
    .join('');

  const filas = lines
    .map(({ product, qty }) => `<tr>
      <td style="padding:9px 0;border-bottom:1px solid rgba(11,11,10,.12);font-family:${SANS};font-size:14px;">
        ${escapeHtml(product.name)}${qty > 1 ? ` × ${qty}` : ''}</td>
      <td style="padding:9px 0;border-bottom:1px solid rgba(11,11,10,.12);font-family:${MONO};font-size:13px;text-align:right;">
        ${formatMoney(product.price * qty)}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREMA};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREMA};padding:28px 16px;">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

    <tr><td style="padding-bottom:26px;">
      <span style="font-family:${SANS};font-size:30px;font-weight:800;letter-spacing:-.02em;color:${TINTA};">YEAH</span>
      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${LIMA};border:1px solid ${TINTA};"></span>
    </td></tr>

    <tr><td style="border:2px solid ${TINTA};border-radius:18px;padding:36px 32px;background:${CREMA};">

      <p style="margin:0 0 6px;font-family:${MONO};font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${GRIS};">
        Pago confirmado${orderRef ? ` · ${escapeHtml(String(orderRef).slice(0, 24))}` : ''}</p>

      <h1 style="margin:0 0 18px;font-family:${SANS};font-size:40px;line-height:.95;letter-spacing:-.03em;
        text-transform:uppercase;font-weight:800;color:${TINTA};">Listo.<br>Es tuyo.</h1>

      <p style="margin:0 0 28px;font-family:${SANS};font-size:15.5px;line-height:1.6;color:${TINTA};">
        Sin esperas, sin trámites. Apretá el botón y empezá a colorear.</p>

      ${botones}

      <p style="margin:14px 0 30px;font-family:${MONO};font-size:10.5px;line-height:1.6;color:${GRIS};">
        Tus enlaces son personales y viven ${DIAS_VALIDEZ} días. Guardate el archivo apenas lo bajes.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border-top:2px solid ${TINTA};margin-bottom:6px;">
        <tr><td colspan="2" style="padding:16px 0 4px;font-family:${MONO};font-size:10.5px;
          letter-spacing:.09em;text-transform:uppercase;color:${GRIS};">Tu compra</td></tr>
        ${filas}
        <tr><td style="padding:14px 0 0;font-family:${SANS};font-size:11px;font-weight:700;
          letter-spacing:.09em;text-transform:uppercase;color:${TINTA};">Total</td>
          <td style="padding:14px 0 0;font-family:${SANS};font-size:22px;font-weight:800;
          letter-spacing:-.02em;text-align:right;color:${TINTA};">${formatMoney(total)}</td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 4px 0;">
      <p style="margin:0 0 8px;font-family:${SANS};font-size:11px;font-weight:700;
        letter-spacing:.09em;text-transform:uppercase;color:${TINTA};">Tu licencia</p>
      <p style="margin:0 0 20px;font-family:${SANS};font-size:13.5px;line-height:1.65;color:${GRIS};">
        Uso comercial ilimitado, en lo tuyo y en lo de tus clientes. Sin límite de entregas ni vencimiento.
        Lo único que no se puede: revenderlo o meterlo en packs de terceros.</p>

      <p style="margin:0 0 22px;font-family:${SANS};font-size:13.5px;line-height:1.65;color:${GRIS};">
        ¿Se te complicó la instalación? Escribinos por
        <a href="https://wa.me/56943801816" style="color:${TINTA};font-weight:700;">WhatsApp</a>
        y lo vemos al toque — casi siempre es una ruta de carpeta.</p>
    </td></tr>

    <tr><td style="border-top:1px solid rgba(11,11,10,.16);padding:18px 4px 0;">
      <p style="margin:0;font-family:${MONO};font-size:9.5px;letter-spacing:.07em;
        text-transform:uppercase;color:${GRIS};">YEAH! · Plug-ins DCTL para filmmakers · Santiago, CL</p>
    </td></tr>

  </table>
</td></tr></table></body></html>`;

  return sendEmail({ to, subject: 'Listo — tu descarga de YEAH! está adentro', html });
}

async function sendStoreNotification({ subject, lines, total, orderRef, customerEmail, extra }) {
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0B0B0A;max-width:560px;margin:0 auto;">
      <h1 style="font-size:18px;">${escapeHtml(subject)}</h1>
      ${orderRef ? `<p>Referencia: <strong>${escapeHtml(orderRef)}</strong></p>` : ''}
      ${customerEmail ? `<p>Cliente: ${escapeHtml(customerEmail)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${orderLinesHtml(lines)}</table>
      <p><strong>Total: ${formatMoney(total)}</strong></p>
      ${extra ? `<p>${escapeHtml(extra)}</p>` : ''}
    </div>`;
  return sendEmail({ to: STORE_NOTIFY_EMAIL, subject, html });
}

module.exports = { sendEmail, sendDeliveryEmail, sendStoreNotification, formatMoney };
