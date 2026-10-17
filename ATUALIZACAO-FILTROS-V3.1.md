# MAHACH — Atualização de filtros V3.1

Esta alteração é **exclusiva da interface de categorias e marcas** da versão V3, com retirada do filtro público de famílias olfativas. Não altera checkout, pedidos, integração de ERP ou banco de dados.

## Novidades

- Removida a seção "Família olfativa" do catálogo e a referência no detalhe do produto.
- Categorias em uma lista mais limpa, com contagem de produtos, sem emojis nos rótulos públicos.
- Busca digitável de marca, opções fixas e botão "Ver todas as marcas"; **não há menu suspenso** que feche durante o clique.
- Marcas disponíveis variam de acordo com a categoria escolhida, evitando filtros sem resultado desnecessários.
- Seleção persistente e botão para limpar marca sem alterar a categoria.
- Filtros no celular em painel deslizante com categorias e marcas, permanecendo aberto até o usuário fechar.

## Instalar com segurança (para quem já está usando a V3)

1. Pare o `npm start` com `Ctrl + C`.
2. **Faça backup da pasta atual**, especialmente de `private/mahach.sqlite`.
3. Extraia o ZIP **ATUALIZACAO-FILTROS** por cima da pasta V3, mantendo os subdiretórios e substituindo os arquivos correspondentes. O patch não contém `private/`, nem banco, nem login.
4. Na pasta atualizada, execute `npm start`.
5. Atualize o navegador com **Ctrl + Shift + R** (limpar cache de estilos/scripts).
6. Abra `http://127.0.0.1:3000/produtos/index.html` e teste o painel à esquerda. No celular, abra o botão "Filtrar".

Se estiver na V2, use o **ZIP COMPLETO V3.1**, não o patch: a V2 não tem as mesmas rotas de categorias e importação.

## Testes

Execute `npm test` em uma cópia de desenvolvimento, nunca expondo sua pasta local a clientes. Os testes de integração do servidor e o fluxo de filtros foram revisados. A atualização não configura pagamentos, frete nem ERP.

### Observações

- `Família olfativa` continua existindo como dado técnico em alguns registros e nos campos do painel administrativo. Foi **removida da interface pública** do catálogo e do detalhe, como solicitado.
- Nenhuma foto, pedido ou informação de produto foi alterada nesta atualização.
- Não há senha padrão ou credenciais no pacote.
