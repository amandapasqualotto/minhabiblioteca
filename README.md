# Minha Biblioteca

Estante virtual interativa: lombadas que você clica para ver a ficha do livro (capa, autor, ano, páginas, datas de leitura, sinopse, categoria), avaliação por critérios de 0 a 5 com nota final automática e espaço para comentários. Acesso por e-mail e senha.

## Como colocar no ar (Firebase + Vercel)

1. **Firebase** → crie um projeto em console.firebase.google.com.
2. **Authentication** → Começar → ative **E-mail/senha**.
3. **Firestore Database** → Criar banco (modo produção) → aba **Regras** → cole o conteúdo de `firestore.rules` → Publicar.
4. **Configurações do projeto → Seus apps → Web (</>)** → registre o app e copie o objeto `firebaseConfig`.
5. Abra `index.html`, procure `const FIREBASE_CONFIG = null;` e troque `null` pelo objeto copiado.
6. Suba a pasta no GitHub e importe o repositório na **Vercel** (Framework: *Other*, sem build).
7. No Firebase, em **Authentication → Configurações → Domínios autorizados**, adicione o domínio da Vercel (ex.: `minha-biblioteca.vercel.app`).

Sem o `FIREBASE_CONFIG`, o app roda em **modo demonstração** (conta e livros salvos só no navegador).

## Estrutura dos dados

`users/{uid}/books/{bookId}` com: `title, author, published, pages, category, status (lido|lendo|quero), startDate, endDate, synopsis, cover, color, ratings[{label, value}], comments, createdAt, updatedAt`.

A nota final é a média dos critérios que você avaliou (critérios sem nota não entram na conta).

## Recursos

- Busca no Google Livros para preencher título, autor, ano, páginas, sinopse e capa automaticamente.
- Envio de foto da capa (redimensionada) e cor da lombada extraída da capa.
- Duas estantes: lidos/lendo agora (com fita marcadora) e "quero ler".
- Filtro por categoria, busca, navegação Anterior/Próximo (também pelas setas do teclado), salvamento automático das notas e comentários.
