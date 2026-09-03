# YEAH! — Guía de despliegue

Este documento explica cómo poner en línea la tienda: sitio estático (`public/`) +
funciones serverless de Netlify (`netlify/functions/`) para Stripe, MercadoPago,
PayPal, transferencia bancaria y entrega automática por email.

## 0. Qué falta para vender

- **El sitio, el carrito y la entrega**: completos y funcionales.
- **Los datos bancarios** (transferencia): cargados y reales.
- **Las credenciales de pago**: pendientes. Hasta que las cargues, los botones
  de Stripe/MercadoPago/PayPal muestran un error controlado en vez de romper.
- **El archivo que se vende**: hay que subirlo a Blobs una vez (ver 5.1).
  Mientras no esté, el enlace del correo responde "archivo no disponible".
- **El email de entrega**: usa [Resend](https://resend.com). Sin
  `RESEND_API_KEY`, el pago se procesa igual pero no sale ningún correo.

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
5. **PayPal y la moneda**: PayPal no acepta CLP como moneda de transacción, así
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

## 5.1 Entrega automática de los archivos

Los `.zip` **ya no viven en el sitio público**: están en Netlify Blobs, un
almacén privado que solo tocan las funciones. Nadie puede bajarlos adivinando
una URL.

### Cómo funciona una compra

1. El comprador paga (Stripe, MercadoPago o PayPal).
2. El webhook confirma el pago contra la pasarela.
3. Se genera un **token de descarga único** para esa compra: guarda el email,
   qué archivos incluye, vencimiento a 30 días y tope de 10 descargas.
4. Sale el correo con un enlace personal por producto.
5. El comprador hace clic y el archivo baja directo desde Blobs.

Entre el pago confirmado y el correo enviado pasan segundos, sin intervención
tuya.

> **Detalle técnico que hace que esto no falle:** el almacén de tokens usa
> consistencia **fuerte** (`consistency: 'strong'`). Con la consistencia
> eventual que trae Blobs por defecto, un token recién escrito por el webhook
> puede tardar hasta 60 segundos en propagarse — y el comprador que hace clic
> de inmediato vería "enlace no válido" justo después de pagar. Es el error
> clásico de este patrón.

### Subir el archivo que se vende

Una sola vez por producto (y cada vez que lo actualices):

```bash
curl -X POST "https://TU-SITIO.netlify.app/.netlify/functions/admin-subir-producto?f=filter-lab-fx.zip" \
     -H "x-admin-token: $ADMIN_TOKEN" \
     --data-binary @filter-lab-fx.zip
```

El nombre en `?f=` tiene que coincidir con `downloadFile` en `products.json`.
Para ver qué hay subido, el mismo endpoint con `GET`.

### Transferencias: liberar la entrega a mano

La transferencia no se puede verificar automáticamente. Cuando confirmes el
comprobante:

```bash
curl -X POST "https://TU-SITIO.netlify.app/.netlify/functions/admin-entregar" \
     -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
     -d '{"email":"cliente@correo.com","items":[{"id":5,"qty":1}],"orderRef":"YEAH-XXXX"}'
```

El cliente recibe exactamente el mismo correo que una compra automática.

## 6. Completar antes de vender de verdad

- [ ] Subir el `.zip` real de Filter LAB FX con `admin-subir-producto`
      (ver 5.1). Sin esto, el enlace del correo responde "archivo no
      disponible".
- [x] ~~Seguridad de las descargas~~ — resuelto: archivos privados en Blobs
      con enlaces por token, vencimiento y tope de descargas.
- [x] ~~Datos bancarios~~ — cargados en `public/js/payments.js`.
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
