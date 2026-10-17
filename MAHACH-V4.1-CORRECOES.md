# MAHACH V4.1 — Correção da navegação e da busca

Atualização incremental da MAHACH V4. **Não altera o esquema do banco, credenciais, pedidos ou painel.**

## Ajustes implementados

1. **Troca de categorias sem recarga da página**: os links de categoria dentro dos filtros do catálogo atualizam a URL, contagem, marcas e produtos pela API; o navegador não recarrega e a posição vertical é preservada. Os links de navegação fora do catálogo continuam funcionando normalmente.
2. **Filtros e rolagem**: ao selecionar marca ou limpar os filtros, a listagem reserva temporariamente espaço para evitar que um resultado mais curto desloque a rolagem; o espaço é liberado quando o usuário retorna acima da listagem. A posição é restaurada ao fechar as janelas de filtros e detalhes. Requisições antigas não podem sobrescrever resultados mais recentes.
3. **Busca global por produto**: ao digitar no campo principal, a busca percorre todos os produtos ativos, independentemente de categorias/marcas anteriormente selecionadas. Busca palavras do nome e marca em qualquer ordem, ignora maiúsculas, pontuação e acentos. Conteúdo da descrição não é mais confundido com o nome pesquisado. Resultados são contados integralmente e oferecidos em páginas.
4. **Detalhes de produto**: animação curta de abertura com foto e descrição escalonadas, desativada para usuários que preferem movimento reduzido. Removida a rolagem interna desnecessária da descrição, mantendo uma só rolagem na janela de detalhes. O botão X continua independente de adicionar à sacola.
5. **Histórico de categorias**: botão Voltar do navegador pode restaurar a categoria pela URL, sem recarregar toda a página. A busca em páginas específicas de uma categoria também é global.

## Instalação recomendada (PATCH)

1. Feche o servidor MAHACH com `Ctrl+C`.
2. Faça backup da pasta do projeto, especialmente `private/mahach.sqlite` e `.env`.
3. Extraia o `MAHACH_PATCH_CORRECOES_V4_1.zip` **por cima da pasta do projeto V4**, preservando a estrutura de diretórios e substituindo apenas os arquivos do ZIP.
4. Execute `npm test` no terminal do projeto; depois `npm start`.
5. Abra `http://127.0.0.1:3000/produtos/index.html` e pressione `Ctrl+Shift+R` para atualizar cache.

## Verificações

`npm test` — **17 testes aprovados** (servidor, catálogo, segurança existente, checkout existente, pesquisa por nome, filtros e código de navegação).

Interação em Chromium com DOM local e APIs simuladas: catálogo, seleção de categoria sem alteração da rolagem, pesquisa global, seleção de marca, animação e fechamento da janela de detalhes funcionaram em larguras de desktop e celular, sem erros de JavaScript.

**Limitação**: a política do navegador neste ambiente impediu executar um teste completo acessando o servidor HTTP local. Portanto, é necessária a conferência final no navegador e no dispositivo reais antes de publicar em produção. Correções visuais não homologam pagamentos, transportadoras ou ERP.

## Teste rápido de aceite

- Abra `/produtos/index.html`, role até ver as categorias e selecione uma: a página não deve voltar ao início.
- Digite um nome de perfume que exista em mais de uma variação: o total e a paginação devem refletir todas as correspondências.
- Procure `LATTAFA ASAD` e depois `ASAD LATTAFA`: ambos devem retornar o mesmo total.
- Abra um produto em **Conhecer**, observe a animação e feche no `X` sem adicionar à sacola.
- No celular, abra os filtros, escolha uma marca, confirme que a gaveta continua aberta e toque em **Ver resultados**.
