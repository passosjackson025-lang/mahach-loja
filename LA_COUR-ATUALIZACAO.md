# LA COUR — Perfumaria

Projeto existente atualizado, com PostgreSQL, painel, estoque, sacola, checkout e integrações preservados. CNPJ: 67.872.786/0001-08. Atendimento: sac.lacour@gmail.com e WhatsApp +55 11 94085-6397.

## Loja

Navegação no computador e celular: Início, Perfumes, Corpo e cuidado, Sobre e Contato. Todos os produtos continuam acessíveis pela busca e por “Ver todos os produtos”. Links antigos de Beleza essencial redirecionam para Corpo e cuidado.

A home mantém o banner original, apresenta as duas coleções, os destaques disponíveis, a narrativa da marca e o rodapé preto. As flores seguem a campanha aprovada. Produtos usam fotos e preços reais cadastrados. Menus e cabeçalho de vidro, animações por direção de scroll e preferência por movimento reduzido são preservados.

O catálogo tem somente faixa de preço na lateral. As categorias ficam no topo. Perfumes: Todos, Árabes, Importados, Nichos, Masculino, Feminino e Unissex. Corpo e cuidado: Masculino, Feminino, Unissex e Infantil; clicar novamente no público selecionado volta ao departamento completo. Não há filtro lateral de marca. Público pode ser informado no cadastro manual; nomes explícitos servem de compatibilidade quando o campo está vazio.

Os 1.771 itens antigos foram retirados do catálogo ativo por solicitação, com cópia privada no banco. O arquivo de catálogo inicial está vazio e não reimporta produtos. Cadastros manuais posteriores permanecem. Não executar novamente o script de limpeza.

## Checkout

Fluxo único, na ordem: dados, entrega/endereço, pagamento, revisão e botão de concluir. O resumo fica depois dos campos, no mesmo fluxo em todas as telas. Não há retirada na loja nem pagamento presencial em pedidos novos. As duas opções são Entrega via Uber/99 e Correios; Pix e cartão são os únicos pagamentos novos.

Uber/99: corrida combinada e paga separadamente à loja, informada antes do pagamento; não há valor de corrida inventado. Após aprovação do Pix há link para combinar a entrega. A volta do cartão também oferece esse contato quando o servidor confirma o pagamento.

Correios: apenas cotações reais dos Correios, vinculadas aos produtos e CEP, com peso e dimensões cadastrados. Não usar nome Correios para preços da Jadlog ou de outras empresas. Pela tabela atual do Melhor Envio, perfumes não são aceitos nos Correios através dessa integração; o site explica a indisponibilidade. É necessário definir um caminho de frete compatível antes da venda nacional de perfumes.

O QR Pix aparece numa tela de pagamento própria. Erros do provedor preservam o pedido e permitem recuperação sem nova compra. Cartão redireciona ao Mercado Pago; dados do cartão não passam pelo site. Preferências já criadas são reutilizadas. Pedidos cancelados não permitem iniciar novamente Pix ou cartão. A assinatura do webhook, conferência de valor e baixa de estoque permanecem no servidor.

## Administração

Visual de vidro acetinado inspirado no vídeo enviado, com creme, marrom e dourado discreto. Dashboard usa dados reais: vendas pagas, pedidos, ticket médio, aguardando envio, comparação com período anterior, gráfico diário de vendas/pedidos, status em rosca, formas de pagamento, produtos mais vendidos, pedidos recentes e estoque baixo. Exportação CSV por dia no período escolhido. Datas e agrupamentos seguem America/Sao_Paulo. Vendas incluem frete e não representam lucro; cancelamentos são excluídos das vendas pagas.

Períodos: hoje, 7 dias, 30 dias e personalizado. O painel inclui uma lista de preparação para lançamento com as configurações efetivas do servidor, sem expor credenciais. Configuração preenchida não é confirmação de recebimento bancário ou de entrega.

Busca de pedidos por código, nome e e-mail em todo o histórico, paginação, dados completos, andamento, pagamento e rastreio separados. Pedidos antigos, inclusive de retirada, continuam consultáveis. Cadastro de produtos, fotos, categorias, SKU, público e estoque preservado. Bling/Vendizap retirados; sincronização do Mercado Livre não ativada. Mercado Pago e Mercado Livre são conexões distintas.

Configurações não vazias do ambiente prevalecem sobre valores salvos no painel. E-mail administrativo é separado do SAC. Chave de criptografia, nomes de schema, cookies, IDs e idempotência anteriores são mantidos por compatibilidade.

## Situação do lançamento

Consulte `LANCAMENTO_LA_COUR.md`. A publicação do visual não comprova habilitação de pagamentos reais. No diagnóstico de 26/10/2026 a conexão efetiva do Mercado Pago pertence a uma conta de teste, portanto o checkout permanece fechado para visitantes, mesmo com a flag de ativação definida. Administrador em modo de teste pode validar o fluxo.

## Validação e execução

Testes offline cobrem catálogo, filtros, autenticação/CSRF, fotos, configurações, dados privados, consentimento, Pix, cartão, recuperação de pedidos, frete, webhook e estoque. Navegação validada com PostgreSQL local e navegador em 320, 390, 768 e 1440 pixels; verificados estados sem vendas e com vendas simuladas, exportação e cálculos. Não foram geradas cobranças reais ou enviadas mensagens.

Use Node.js 22.13+ e `npm ci`, depois `npm start`. Preserve o ambiente e a chave original `MAHACH_SETTINGS_KEY`. Não inclua `.env` nem credenciais no Git ou ZIP. Para verificações: `npm run test:offline`, `npm run test:admin`, `npm run test:catalog`, `npm run test:management`, `node scripts/test-loja-clientes.cjs` e `node scripts/test-pix-checkout.cjs`.

As fotos de produto são reais; as imagens de campanha são ilustrativas. Fontes locais DM Sans/Cormorant Garamond com licenças em assets/fonts. Fotos de produto enviadas ao painel usam Cloudinary quando configurado para evitar perda na hospedagem.
