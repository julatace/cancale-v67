import qrcode from 'qrcode-generator';
// Le secret ne quitte jamais le navigateur pour générer le QR.
// L'URI vient de Supabase Auth : on n'invente pas de paramètres TOTP.
export function qrMfa(totp) {
  const uri = String(totp?.uri || '');
  try {
    const u = new URL(uri);
    const secret = u.searchParams.get('secret');
    if (u.protocol === 'otpauth:' && u.hostname === 'totp' && secret && /^[A-Z2-7]+=*$/i.test(secret) && (!totp.secret || secret === totp.secret) && uri.length < 4096) {
      const qr = qrcode(0, 'M');
      qr.addData(uri, 'Byte'); qr.make();
      return qr.createDataURL(5, 4);
    }
  } catch (_) { /* Une URI invalide n'est jamais réinterprétée. */ }
  const image = String(totp?.qr_code || '').trim();
  if (/^data:image\/(?:svg\+xml|png|gif);/i.test(image)) return image;
  if (/^<svg[\s>]/i.test(image)) return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(image);
  return '';
}
