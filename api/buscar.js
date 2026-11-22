// Busca de livros: Google Livros (com chave própria) e, se falhar, Open Library.
// Variável de ambiente opcional na Vercel: GOOGLE_BOOKS_API_KEY
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function google(q) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q=' + encodeURIComponent(q) + (key ? '&key=' + key : '');
  const r = await fetch(url);
  if (!r.ok) throw new Error('google ' + r.status);
  const j = await r.json();
  return (j.items || []).map(it => {
    const v = it.volumeInfo || {};
    const img = v.imageLinks || {};
    return {
      source: 'google',
      title: v.title ? v.title + (v.subtitle ? ': ' + v.subtitle : '') : '',
      author: (v.authors || []).join(', '),
      published: v.publishedDate || '',
      pages: v.pageCount || null,
      category: (v.categories || [])[0] || '',
      synopsis: clean(v.description).slice(0, 3000),
      language: v.language || '',
      cover: (img.thumbnail || img.smallThumbnail || '').replace('http:', 'https:').replace('&edge=curl', '')
    };
  }).filter(b => b.title);
}

async function openLibrary(q) {
  const fields = 'key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i,language';
  const r = await fetch('https://openlibrary.org/search.json?limit=8&fields=' + fields + '&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'MinhaBiblioteca/1.0' } });
  if (!r.ok) throw new Error('openlibrary ' + r.status);
  const j = await r.json();
  return (j.docs || []).map(d => ({
    source: 'openlibrary',
    title: d.title || '',
    author: (d.author_name || []).join(', '),
    published: d.first_publish_year ? String(d.first_publish_year) : '',
    pages: d.number_of_pages_median || null,
    category: (d.subject || [])[0] || '',
    synopsis: '',
    language: (d.language || [])[0] || '',
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : ''
  })).filter(b => b.title);
}

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim().slice(0, 200);
  if (!q) return res.status(400).json({ error: 'Informe o que buscar.' });
  let items = [];
  try { items = await google(q); } catch (e) { /* cota ou erro: tenta o Open Library */ }
  if (!items.length) { try { items = await openLibrary(q); } catch (e) {} }
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({ items });
};
