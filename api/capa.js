// Repassa a imagem da capa com CORS liberado, para o app conseguir desenhá-la na imagem de compartilhar.
// Só aceita imagens de serviços de livros conhecidos.
const ALLOWED = /(^|\.)(books\.google\.com|googleusercontent\.com|googleapis\.com|openlibrary\.org|archive\.org)$/i;

module.exports = async (req, res) => {
  let u;
  try { u = new URL(String((req.query && req.query.url) || '')); } catch { return res.status(400).end(); }
  if (!/^https?:$/.test(u.protocol) || !ALLOWED.test(u.hostname)) return res.status(403).end();
  try {
    const r = await fetch(u.href, { redirect: 'follow', headers: { 'User-Agent': 'MinhaBiblioteca/1.0' } });
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image/')) return res.status(502).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4e6) return res.status(413).end();
    res.setHeader('Content-Type', type);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(buf);
  } catch { return res.status(502).end(); }
};
