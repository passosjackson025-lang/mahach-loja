# MAHACH — Atualização de checkout, clientes e segurança

## O que foi implementado nesta cópia

- **Aba Clientes** no painel administrativo, com busca e paginação, nome, telefone, e-mail, último pedido e indicação de consentimento para marketing. A lista requer sessão administrativa; não há listagem pública. Um administrador pode retirar a autorização a pedido do cliente, mas não concedê-la em nome dele.
- **Cadastro privado no PostgreSQL**: a inicialização cria `mahach_stage.customers` se ainda não existir e adiciona `marketing_opt_in` a `orders`, sem apagar tabelas ou pedidos. Cliente e pedido são gravados na mesma transação. Não armazena dados de cartões.
- **Consentimento opcional** no checkout, **desmarcado por padrão**, independente do pedido. Só salva autorização quando o comprador realmente marca essa opção. Histórico de pedidos não é uma autorização automática para marketing.
- **Checkout revisado**: nome, telefone, e-mail, endereço, cálculo do frete pelos Correios via Melhor Envio e redirecionamento ao Checkout Pro do Mercado Pago para Pix/cartão. Retirada com pagamento em dinheiro continua disponível. As entregas via Uber/99, quando selecionadas, são combinadas e cobradas separadamente — sem prometer cotação automática.
- **Retorno de pagamento**: o token de acompanhamento não é mais enviado nas URLs de retorno configuradas no Mercado Pago; a página de retorno consulta o servidor e aguarda brevemente a confirmação, que é feita pelo webhook autenticado e checagem da API do Mercado Pago.
- **Notificação segura**: suporte ao timestamp do webhook em segundos ou milissegundos; assinatura HMAC comparada em tempo constante e consulta do pagamento autenticada no provedor.
- **Estoque**: no primeiro webhook de pagamento aprovado, o servidor debita estoque conhecido dentro de transação. Reenvios do mesmo evento não geram um segundo débito. Se faltar algum item, não debita parcialmente e marca `estoque_pendente` para revisão manual. Estoque não informado permanece como desconhecido.
- **Produtos**: botão de **Ocultar** no painel; não apaga registros históricos e permite reativar usando a edição do produto.
- **Cookies administrativos** marcados `Secure` quando hospedado na Render, além das proteções CSP, SameSite, HttpOnly e CSRF já existentes. Reforço de cabeçalhos contra isolamento indevido de janelas.
- **Política de privacidade** revista como rascunho — requer conferência jurídica e ajuste dos períodos de retenção antes da operação comercial.

## Situação de segurança / limitações

Este pacote passou por **testes de sintaxe e testes locais simulados** para algumas rotas, assinatura de webhook, estoque, clientes, opt-in e administrativo. Isso **NÃO substitui** um teste real de ponta a ponta, pentest ou auditoria jurídica; não foi feita cobrança nem cotação real neste ambiente. **Não é possível assegurar segurança absoluta ou que todos os recursos do painel estejam homologados.**

O checkout permanece **desabilitado por padrão** (`MAHACH_ENABLE_CHECKOUT=false`). **Não habilite o checkout apenas por instalar este ZIP**. Primeiro valide tudo em uma cópia do Neon/ambiente de homologação, incluindo:

1. Confirmar `PUBLIC_SITE_URL` HTTPS, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e a configuração das notificações na conta de testes; usar credenciais de homologação e fluxo de teste.
2. Testar pedidos Pix e cartão aprovados, pendentes, cancelados, múltiplos webhooks, estoque insuficiente, devoluções, cancelamentos, falhas de rede e pedidos simultâneos.
3. Confirmar o token do Melhor Envio, o CEP de origem e características dos perfumes (restrições de transporte, embalagem, peso e dimensões); cotação não é compra automática de etiqueta.
4. Confirmar que nova tabela `customers` foi criada no schema `mahach_stage` e que os dados só são acessíveis por contas administrativas; implementar backups, menor privilégio de acesso e retenção de dados conforme LGPD.
5. Validar o layout e a experiência de compra em celulares e navegadores reais; revisar textos públicos e políticas de entrega, frete, troca e devolução.
6. Integrar reembolsos/estornos e reconciliação financeira, gestão de pedidos em exceção e política de recuperação de checkout abandonado. Esse trabalho não está completo neste pacote.
7. Rever credenciais e segredos expostos anteriormente em chats, fotos ou histórico Git; nunca distribuir `.env`, chaves, tokens ou diretório `.git`.

## Como aplicar sem perder dados

1. Faça backup do repositório e do banco Neon; clone o projeto para testes antes de substituir o site atual.
2. Descompacte, compare com seu repositório e copie as alterações necessárias, preservando seu `.env` e dados de produção **fora do ZIP**.
3. Execute `npm ci`, `node scripts/test-offline.cjs`, `node scripts/test-admin-photo.cjs`, `node scripts/test-cloud-storage.cjs`, `node scripts/test-loja-clientes.cjs` e `node scripts/testar-publicacao.cjs`.
4. **Não foi realizado deploy em produção.** Faça merge/deploy somente após revisão. A própria inicialização do servidor aplica as migrações **aditivas** mencionadas acima; portanto, avalie-as e faça backup antes de subir a versão.

## Boas práticas usadas como base

- OWASP Cheat Sheet Series: Authentication, Session Management, CSRF Prevention, Input Validation e Webhook Security.
- Mercado Pago Developers: Checkout Pro (Preferences API), URLs de retorno, assinatura de Webhooks e consulta do pagamento na API.
- ANPD/LGPD: informação transparente, finalidade definida, controle de acesso e distinção entre tratamento necessário à compra e marketing opcional.
