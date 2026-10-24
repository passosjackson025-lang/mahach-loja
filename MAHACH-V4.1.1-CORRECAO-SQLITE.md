# LA COUR V4.1.1 — Correção de colisão SQLite nos testes

## Erro corrigido
`Error: UNIQUE constraint failed: products.id` quando `npm test` executava pela primeira vez após extrair uma versão nova.

## Causa
Os arquivos `tests/site.test.js` e `tests/v4-polish.test.js` utilizavam o banco de dados padrão da loja. Como o test runner do Node executa arquivos de teste simultaneamente, duas instâncias do servidor podiam detectar o catálogo vazio e tentar importar os mesmos produtos ao mesmo tempo.

## Alterações
- `server.js`: inicialização atômica com `BEGIN IMMEDIATE` e conferência da contagem dentro da transação. Uma segunda instância aguarda a primeira e não duplica o catálogo.
- `tests/site.test.js` e `tests/v4-polish.test.js`: cada suíte usa arquivo SQLite temporário próprio, sem tocar em `private/mahach.sqlite`.
- `tests/bootstrap-concorrente.test.js`: novo teste de duas inicializações paralelas do catálogo, conferindo 1.770 IDs distintos.
- `package.json`: versão 4.1.1.

## Aplicação
1. Interrompa `npm start` com `Ctrl + C`.
2. Faça backup de `private/mahach.sqlite` e do `.env` se existir. **Não apague seu banco de dados**.
3. Extraia o patch V4.1.1 na pasta atual, substituindo os arquivos. Os arquivos `private/mahach.sqlite` e `.env` não estão no patch.
4. Abra terminal na pasta e execute `npm test`, depois `npm start`.
5. Acesse `http://127.0.0.1:3000`.

**Importante:** a versão 4.1.1 corrige o problema reproduzido de concorrência do SQLite. Não é uma certificação de segurança, checkout com cobrança real ou ausência de outros bugs.
