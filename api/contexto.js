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
    historico: { type: 'STRING', description: 'Contexto histórico, social e pessoal do autor quando a obra foi escrita. 1 a 2 parágrafos.' },
    inovacao: { type: 'STRING', description: 'O que a obra trouxe de novo ou de diferente para a época (forma, tema, estilo, ideias). 1 parágrafo.' },
    destaque: { type: 'STRING', description: 'Por que a obra se destaca até hoje: recepção, influência, prêmios, legado. 1 parágrafo.' },
    sinopse: { type: 'STRING', description: 'Sinopse curta em português, sem spoilers do final, 3 a 5 frases.' },
    categoria: { type: 'STRING', enum: CATS },
    ano_publicacao: { type: 'STRING', description: 'Ano da primeira publicação original, ou vazio se não tiver certeza.' },
    paginas: { type: 'INTEGER', description: 'Número aproximado de páginas de uma edição comum em português, ou 0 se não souber.' }
  },
  required: ['historico', 'inovacao', 'destaque', 'sinopse', 'categoria']
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

  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema }
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'Falha no Gemini.' });
    const text = (((j.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '{}';
    const out = JSON.parse(text);
    return res.status(200).json({
      context: { historico: out.historico || '', inovacao: out.inovacao || '', destaque: out.destaque || '' },
      synopsis: out.sinopse || '', category: CATS.includes(out.categoria) ? out.categoria : '',
      published: out.ano_publicacao || '', pages: out.paginas > 0 ? out.paginas : null
    });
  } catch (e) {
    return res.status(500).json({ error: 'Não consegui gerar o contexto agora.' });
  }
};
