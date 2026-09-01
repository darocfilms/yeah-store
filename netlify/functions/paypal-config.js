// El Client ID de PayPal es público por diseño (va embebido en el SDK del
// navegador) — lo servimos desde una función para no hardcodearlo en el
// frontend y poder cambiarlo por variable de entorno sin volver a desplegar código.
exports.handler = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID || null;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId })
  };
};
