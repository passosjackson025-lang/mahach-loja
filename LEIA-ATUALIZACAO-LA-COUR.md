# LA COUR — gestão e loja

Esta versão usa o projeto existente, PostgreSQL e os pedidos originais. O catálogo continua vazio para cadastro manual; não há reimportação automática dos produtos retirados.

- Menu: Início, Perfumes, Corpo e cuidado, Sobre e Contato. O catálogo completo fica em `/produtos/todos/index.html`, também acessível pela busca e pelo botão da inicial.
- Corpo e cuidado reúne os antigos departamentos corpo/beleza. Links de Beleza essencial redirecionam para Corpo e cuidado.
- `/admin`: dashboard com períodos no horário de São Paulo, vendas aprovadas (produtos + frete, exceto cancelados), ticket médio, pedidos, gráficos, itens mais vendidos e alertas de estoque até 5 unidades. Faturamento não é lucro.
- Pedidos: busca por código, nome e e-mail em todo o histórico, com paginação, filtros e atualização de andamento/rastreamento. Aprovar pagamento online continua sendo responsabilidade exclusiva do Mercado Pago.
- Produtos: cadastro manual, fotos, preço, categoria, SKU, estoque e medidas reais da embalagem. O estoque do site é controlado no painel LA COUR. Não há sincronização automática com o Mercado Livre.
- Bling e Vendizap foram retirados do painel e das rotinas de integração. Campos antigos de banco são preservados quando necessários à compatibilidade histórica.

## E-mails e ambiente

`SUPPORT_EMAIL` é o SAC público e o endereço para respostas dos clientes. Padrão: `sac.lacour@gmail.com`.
`ADMIN_EMAIL` recebe avisos de vendas aprovadas. `MAIL_FROM` continua sendo o remetente autorizado pelo provedor; não substitua por um endereço não verificado. `RESEND_API_KEY` configura o provedor atual.

Variáveis não vazias do ambiente têm prioridade sobre o painel. Os campos correspondentes aparecem como leitura no painel; um valor antigo salvo pode ser removido sem apagar o valor do ambiente. Alterações no ambiente exigem reiniciar/publicar o serviço. Não compartilhe `.env`, credenciais ou a chave de criptografia.

## Pagamentos

Mercado Pago recebe Pix/cartão; Mercado Livre é o marketplace. Configurar um não implementa sincronização de anúncios e estoque do outro.

O checkout público exige `MAHACH_ENABLE_CHECKOUT=true` **e** autenticação válida da conta de pagamentos no servidor. São necessários Access Token, segredo do webhook e `PUBLIC_SITE_URL` HTTPS. A autenticação de uma conta de testes não libera cobranças públicas. Não altere o domínio sem revisar retornos e webhook.

O servidor valida o pagamento recebido e a assinatura do webhook antes de confirmar pedidos e baixar estoque, preservando a idempotência Pix. O cartão permanece no ambiente seguro do Mercado Pago. Cadastro de produtos sem estoque conhecido impede compras; frete exige peso e dimensões reais.

## Verificação

Testes incluídos: `npm run test:offline`, `node scripts/test-offline.cjs --empty-catalog`, `npm run test:management`, `npm run test:catalog`, `npm run test:admin`, `npm run test:fotos`, `node scripts/test-loja-clientes.cjs` e `node scripts/test-pix-checkout.cjs`.

Validação adicional feita em PostgreSQL local: cálculos, fuso horário, consulta de pedidos além dos 100 recentes, filtros, cadastro e SKU. Navegador verificado em 320, 390, 768 e 1440 pixels. Os testes automatizados de cobrança usam simulação; nenhuma cobrança real é criada para verificar o sistema.

## Refinamento da inicial, filtros e checkout

A inicial mantém a seleção editorial de Perfumes e Corpo e cuidado mesmo com catálogo vazio. Produtos cadastrados preenchem a vitrine automaticamente. Nenhum produto retirado foi reimportado.

As laterais dos catálogos exibem apenas preço. Perfumes mantém as categorias no topo; Corpo e cuidado usa Masculino, Feminino, Unissex e Infantil. O cadastro possui o campo Público. Quando ele não foi preenchido em registros antigos, apenas marcações explícitas no nome/família são consideradas; não há adivinhação de público.

O formulário de telefone não usa mais a expressão HTML incompatível com navegadores atuais. O servidor normaliza espaços, aspas externas e um prefixo Bearer copiado junto do Access Token. As credenciais permanecem privadas e não são substituídas automaticamente.

Falhas do provedor mantêm a referência do pedido: Pix tenta novamente no mesmo pedido; cartão recupera/reutiliza a preferência existente e permite continuar sem criar outro pedido. Erros de autenticação ficam nos registros privados; o cliente recebe orientações de atendimento sem códigos internos.

A validação diferencia credencial de teste, conta de teste e recusa de autenticação. A chave que solicita liberação não contorna a autenticação: o público só recebe acesso quando a conexão for validada para produção. Se habilitado, o modo de testes continua restrito à sessão administrativa.
