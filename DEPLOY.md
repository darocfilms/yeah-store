# YEAH! — Guía de despliegue

Este documento explica cómo poner en línea la tienda: sitio estático (`public/`) +
funciones serverless de Netlify (`netlify/functions/`) para Stripe, MercadoPago,
PayPal, transferencia bancaria y entrega automática por email.

## 0. Qué es real y qué es placeholder ahora mismo

- **El sitio y el carrito**: completos y funcionales.
- **Los pagos**: el código está completo y listo para cobrar de verdad, pero
  **no tienes credenciales configuradas todavía**. Hasta que las agregues,
  los botones de Stripe/MercadoPago/PayPal mostrarán un error controlado
  ("no se pudo iniciar el pago") en vez de romper la página.
- **Los archivos digitales** (`public/downloads/*.zip`): son placeholders de
  texto, no los productos reales. Reemplázalos antes de vender de verdad.
- **Los datos bancarios** (transferencia): están marcados como `PENDIENTE` en
  `js/payments.js` — nadie debería transferir dinero hasta que los completes
  con tus datos reales.
- **El email de entrega**: usa [Resend](https://resend.com). Sin
  `RESEND_API_KEY` configurada, el pago se procesa igual pero no se envía
  ningún correo (queda solo un log de advertencia).

## 1. Desplegar el sitio en Netlify

1. Sube este repositorio a GitHub/GitLab (o conéctalo directo si usas la CLI).
2. En [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
   existing project** → selecciona el repo.
3. Netlify debería detectar `netlify.toml` automáticamente:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
   - Build command: `npm install`
4. Deploy. Copia la URL que te da Netlify (ej. `https://yeah-store.netlify.app`).
5. Ve a **Site configuration → Environment variables** y agrega `SITE_URL` con
   esa URL exacta (sin `/` final). Las variables de pago se agregan en los
   pasos siguientes, en el mismo lugar.
6. Si compras un dominio propio, actualiza `SITE_URL` cuando lo conectes.

## 2. Stripe (tarjeta de crédito/débito)

1. Crea cuenta en [dashboard.stripe.com](https://dashboard.stripe.com).
2. **Developers → API keys** → copia la *Secret key* (empieza con `sk_test_`
   en modo prueba, `sk_live_` en producción) → variable `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://TU-SITIO.netlify.app/.netlify/functions/stripe-webhook`
   - Evento a escuchar: `checkout.session.completed`
   - Copia el *Signing secret* (`whsec_...`) → variable `STRIPE_WEBHOOK_SECRET`.
4. Prueba primero en modo test con [tarjetas de prueba de
   Stripe](https://stripe.com/docs/testing) antes de pasar a claves `sk_live_`.

## 3. MercadoPago

1. Crea cuenta de vendedor en [mercadopago.cl](https://www.mercadopago.cl)
   (o el país que corresponda).
2. **Tu negocio → Configuración → Credenciales** (developers.mercadopago.com)
   → copia el *Access Token de producción* → variable `MP_ACCESS_TOKEN`.
3. No hace falta configurar el webhook manualmente en el panel: la función
   `create-mp-preference` ya envía `notification_url` apuntando a
   `/.netlify/functions/mercadopago-webhook` en cada preferencia creada.
4. **Moneda**: la tienda cobra en **CLP** (pesos chilenos), que es la moneda
   nativa de una cuenta MercadoPago Chile. Los precios viven en
   `public/products.json` y se muestran con formato chileno (`$22.900 CLP`).

### 3.1 Revisar pagos manualmente (list-mp-payments)

Para consultar/conciliar pagos de MercadoPago sin entrar al panel de
MercadoPago, hay una función protegida:

1. Genera un token random, ej. `openssl rand -hex 24`, y guárdalo en la
   variable `ADMIN_TOKEN` en Netlify. **Sin esta variable el endpoint no
   responde** — devuelve emails y montos de clientes, así que nunca debe
   quedar abierto.
2. Llámalo así:
   ```bash
   curl -H "x-admin-token: TU_ADMIN_TOKEN" \
     "https://TU-SITIO.netlify.app/.netlify/functions/list-mp-payments?status=approved&limit=20"
   ```
   Parámetros opcionales soportados: `status`, `external_reference`,
   `begin_date`, `end_date`, `sort`, `criteria`, `offset`, `limit`.
3. Internamente usa `GET /v1/payments/search` de MercadoPago (el endpoint de
   listado/búsqueda documentado por su API), no `/v1/payments/{id}` que ya
   usa `mercadopago-webhook.js` para confirmar un pago puntual.

## 4. PayPal

1. Crea una app en [developer.paypal.com/dashboard/applications](https://developer.paypal.com/dashboard/applications).
2. Copia el *Client ID* y el *Secret* de la app (hay uno para Sandbox y otro
   para Live) → variables `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`.
3. Variable `PAYPAL_ENV`: déjala en `sandbox` mientras pruebas, cámbiala a
   `live` (y usa las credenciales *Live*) cuando quieras cobrar de verdad.
4. **PayPal y la moneda**: PayPal no acepta CLP como moneda de transacción, así
   que ese método cobra el equivalente en **USD** usando la tasa fija de la
   variable `USD_CLP_RATE` (por defecto 936). Consecuencia práctica: si el
   dólar se mueve y no actualizas esa variable, por PayPal cobrarás de más o
   de menos. Revísala cada cierto tiempo, o elimina PayPal como método si
   prefieres no lidiar con eso.
4. Prueba con una [cuenta sandbox de comprador](https://developer.paypal.com/dashboard/accounts)
   antes de pasar a `live`.

## 5. Email de entrega (Resend)

1. Crea cuenta en [resend.com](https://resend.com) (tiene plan gratuito).
2. **API Keys → Create API Key** → variable `RESEND_API_KEY`.
3. Verifica un dominio propio en **Domains** (agrega los registros DNS que te
   indiquen) para poder enviar desde `pedidos@tudominio.com`. Sin dominio
   verificado, Resend solo te deja enviar desde `onboarding@resend.dev` y
   solamente a tu propia cuenta — sirve para probar, no para vender.
4. Variable `EMAIL_FROM`, ej: `YEAH! <pedidos@tudominio.com>`.
5. Variable `STORE_NOTIFY_EMAIL`: a dónde llegan los avisos de cada venta y
   de cada pedido pendiente por transferencia (por defecto
   `darocfilms@gmail.com`, cámbiala si quieres otra bandeja).

## 6. Completar antes de vender de verdad

- [ ] Reemplazar los `.zip` placeholder en `public/downloads/` por los
      archivos reales (mismo nombre que `downloadFile` en `products.json`).
- [ ] **Seguridad de las descargas**: hoy cualquiera que adivine la URL de un
      `.zip` en `/downloads/` puede bajarlo sin haber pagado, porque son
      archivos estáticos públicos. Para una tienda real, la mejora recomendada
      es generar enlaces firmados/de un solo uso (por ejemplo con [Netlify
      Blobs](https://docs.netlify.com/blobs/overview/) + un token aleatorio
      por compra) en vez de sacar directo desde `public/downloads/`.
- [ ] Completar `BANK_INFO` en `public/js/payments.js` con los datos
      bancarios reales (hoy dice `PENDIENTE` a propósito).
- [ ] Reemplazar las imágenes placeholder de producto (bloques con textura
      diagonal) por fotos reales en `public/index.html` / `public/css/style.css`.
- [ ] Revisar la moneda de MercadoPago (punto 3.4).
- [ ] Pasar Stripe, MercadoPago y PayPal de modo prueba a modo producción
      cuando todo lo anterior esté validado.
- [ ] Probar el flujo completo de compra con cada método de pago en modo
      prueba antes de anunciar la tienda.

## 7. Desarrollo local

```bash
npm install -g netlify-cli   # si no la tienes
cp .env.example .env         # completa las variables que ya tengas
npm install
netlify dev
```

`netlify dev` sirve `public/` y las funciones de `netlify/functions/` juntas
en `http://localhost:8888`, cargando las variables de `.env`. Los webhooks de
Stripe/MercadoPago necesitan una URL pública para probarse en local — usa
`stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`
(Stripe CLI) o despliega a un sitio de pruebas en Netlify.
