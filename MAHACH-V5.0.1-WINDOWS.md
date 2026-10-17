# MAHACH V5.0.1 — Testes no Windows

## Causa da falha

O teste de inicializações simultâneas passou nas verificações do SQLite, mas no Windows, ao excluir a pasta temporária, o Node.js recebeu `EPERM` porque o sistema ainda mantinha um arquivo aberto. Isso não significa que o site falhou ao iniciar.

## Ajustes

- Fechamento explícito do servidor e do banco antes de remover os arquivos temporários dos testes.
- Limpeza assíncrona com tentativas e intervalos para suportar bloqueios transitórios do Windows.
- Caso o Windows mantenha a pasta bloqueada mesmo após as tentativas, o teste informa um aviso de limpeza, em vez de marcar como bug no catálogo. **Pode ser necessário apagar depois a pasta temporária indicada.**
- Requisições inválidas esperadas nos testes (por exemplo WebP inválido e CEP incorreto) retornam HTTP 400 sem mostrar stack traces desnecessários no terminal de desenvolvimento.
- Não houve mudanças na estrutura do banco de dados, produtos, imagens nem nas credenciais dos administradores.

## Como aplicar

1. Faça backup do arquivo `private/mahach.sqlite` e da pasta `assets/produtos/`.
2. Com o servidor parado, extraia o patch V5.0.1 por cima da pasta onde instalou a V5. **Não remova arquivos do banco.**
3. Rode `npm test` e depois `npm start` em terminais separados (ou um após o outro).
4. O teste na sua máquina, com Windows e Node 24, é a validação final; os testes locais foram executados em Linux/Node 22.
