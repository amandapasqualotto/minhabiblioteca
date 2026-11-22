// Gera, com o Gemini, o contexto da obra e completa dados que faltarem.
// Variáveis de ambiente na Vercel: GEMINI_API_KEY (obrigatória), GEMINI_MODEL (opcional)
// Só atende pessoas logadas: confere o token do Firebase Auth.
const FIREBASE_WEB_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAHbJtb4ku63Lq69TGG_FduvUmA9WS2vBQ';
const CATS = ['Romance','Ficção literária','Fantasia','Ficção científica','Mistério & suspense','Clássicos','Não ficção','Biografia','Filosofia','História','Direito','Tecnologia','Negócios','Autoajuda','Poesia','Religião'];

async function userFromToken(idToken) {
  if (!idToken) return null;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_WEB_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.users || [])[0] || null;
}

const schema = {
  type: 'OBJECT',
  properties: {
    contexto: { type: 'STRING', description: 'Contexto da obra em 2 ou 3 parágrafos corridos, sem títulos: o momento histórico e a vida do autor quando foi escrita, o que trouxe de novo para a época e por que se destaca até hoje.' },
    sinopse: { type: 'STRING', description: 'Sinopse curta em português, sem spoilers do final, 3 a 5 frases.' },
    categoria: { type: 'STRING', enum: CATS },
    ano_publicacao: { type: 'STRING', description: 'Ano da primeira publicação original, ou vazio se não tiver certeza.' },
    paginas: { type: 'INTEGER', description: 'Número aproximado de páginas de uma edição comum em português, ou 0 se não souber.' }
  },
  required: ['contexto', 'sinopse', 'categoria']
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY não configurada na Vercel.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await userFromToken(token).catch(() => null);
  if (!user) return res.status(401).json({ error: 'Entre na sua conta para usar a IA.' });

  const b = req.body || {};
  const title = String(b.title || '').slice(0, 300).trim(), author = String(b.author || '').slice(0, 200).trim();
  if (!title) return res.status(400).json({ error: 'Informe o título.' });

  const prompt = `Você é uma crítica literária e historiadora cuidadosa. Escreva em português do Brasil, em tom acessível e elegante.
Livro: "${title}"${author ? `, de ${author}` : ''}${b.published ? ` (publicação: ${String(b.published).slice(0, 20)})` : ''}.
Explique o contexto histórico em que a obra foi escrita, por que foi inovadora e por que se destaca.
Regras: seja factual; se não conhecer bem a obra, diga isso com honestidade em vez de inventar fatos, datas, prêmios ou citações.
Não revele o final da história.`;

  // Se um modelo estiver sobrecarregado, tenta de novo e depois passa para o próximo
  const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].filter(Boolean))];
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let lastStatus = 0;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body
        });
        lastStatus = r.status;
        if (r.ok) {
          const j = await r.json();
          const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '{}';
          const out = JSON.parse(text);
          return res.status(200).json({
            context: out.contexto || '', synopsis: out.sinopse || '',
            category: CATS.includes(out.categoria) ? out.categoria : '',
            published: out.ano_publicacao || '', pages: out.paginas > 0 ? out.paginas : null, model
          });
        }
        if (r.status === 401 || r.status === 403) return res.status(502).json({ error: 'A chave do Gemini foi recusada. Confira a GEMINI_API_KEY na Vercel.' });
        if (r.status === 404 || r.status === 400) break;           // modelo indisponível: vai para o próximo
        await wait(700 * (attempt + 1));                            // 429/500/503: espera e tenta de novo
      } catch (e) { await wait(500); }
    }
  }
  return res.status(503).json({ error: lastStatus === 429
    ? 'A cota gratuita do Gemini acabou por agora. Tente de novo mais tarde.'
    : 'A IA está muito ocupada neste momento. Espere alguns segundos e clique em “Gerar com IA” de novo.' });
};
