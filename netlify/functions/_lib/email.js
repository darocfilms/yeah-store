// Envío de emails vía Resend (https://resend.com). Requiere RESEND_API_KEY.
// Si no está configurada, no falla: solo registra un aviso y sigue (el pago
// ya se procesó; el email de entrega es una capa adicional).
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'YEAH! <onboarding@resend.dev>';
const STORE_NOTIFY_EMAIL = process.env.STORE_NOTIFY_EMAIL || 'darocfilms@gmail.com';
const SITE_URL = process.env.SITE_URL || '';
const WHATSAPP_DISPLAY = '+56 9 4380 1816';

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

function downloadLinksHtml(lines, token) {
  return lines
    .map(({ product }) => {
      const url = urlDescarga(SITE_URL, token, product.downloadFile);
      return `<li style="margin-bottom:8px;"><a href="${url}" style="font-weight:bold;">Descargar ${escapeHtml(product.name)}</a></li>`;
    })
    .join('');
}

async function sendDeliveryEmail({ to, lines, total, orderRef, token }) {
  if (!lines.length || !token) return { skipped: true };
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0B0B0A;max-width:560px;margin:0 auto;">
      <h1 style="font-size:20px;">¡Gracias por tu compra en YEAH!</h1>
      <p>${orderRef ? `Pedido: <strong>${escapeHtml(orderRef)}</strong><br>` : ''}Acá está tu enlace de descarga y la licencia de uso.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${orderLinesHtml(lines)}</table>
      <p><strong>Total: ${formatMoney(total)}</strong></p>
      <h2 style="font-size:15px;">Descargas</h2>
      <ul>${downloadLinksHtml(lines, token)}</ul>
      <p style="font-size:12px;color:#5F5C53;">Tus enlaces son personales y estan activos ${DIAS_VALIDEZ} dias.</p>
      <h2 style="font-size:15px;">Licencia</h2>
      <p style="font-size:13px;line-height:1.6;color:#5F5C53;">
        Uso comercial ilimitado en proyectos propios y de clientes, sin límite de entregas ni de tiempo.
        La reventa, redistribución o inclusión en packs de terceros está prohibida.
        Reembolso disponible dentro de 14 días si el archivo no fue descargado.
      </p>
      <p style="font-size:13px;color:#5F5C53;">¿Problemas de instalación? Escríbenos por WhatsApp: ${WHATSAPP_DISPLAY}.</p>
    </div>`;
  return sendEmail({ to, subject: 'Tu compra en YEAH! — enlace de descarga y licencia', html });
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
