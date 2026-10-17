# MAHACH 5.2 — Checkout, administração e envios

## O que esta versão faz

- **Retirada**: frete R$ 0,00; dinheiro apenas pessoalmente; Pix e cartão pelo Checkout Pro do Mercado Pago, se corretamente conectado.
- **Correios**: exige CEP e cotação real do Melhor Envio com serviço dos Correios. O valor da cotação é verificado no servidor contra os produtos e CEP antes da criação do pedido. Pagamento online pelo Mercado Pago; não abre WhatsApp ao pagar. Depois que a equipe incluir o código de rastreamento, o cliente poderá acompanhar no **site oficial dos Correios**.
- **Uber/99**: coleta endereço e abre conversa do WhatsApp para combinar preço, disponibilidade e corrida. Não faz cobrança nem agenda corrida automaticamente.
- **E-mails**: com Resend configurado, confirma pagamento aprovado ao cliente e à loja após webhook válido; avisa o cliente quando a equipe cadastrar novo código Correios. No painel há um atalho para compartilhar o código pelo WhatsApp **manualmente**.
- **Dashboard**: configuração persistente em SQLite (sem precisar reiniciar), criação/edição de produtos e upload manual permanecem disponíveis. Botão de sincronizar Vendizap é desativado sem credenciais.

## Configurar no painel

Abra `http://127.0.0.1:3000/admin`, faça login e acesse **Integrações**. Salve os dados; eles passam a valer no servidor imediatamente. A edição do `.env` só é reconhecida após reiniciar o servidor.

1. Loja: WhatsApp, endereço de retirada.
2. Melhor Envio: token de API com acesso à cotação, CEP de origem (8 dígitos) e e-mail operacional. Teste a conexão.
3. Mercado Pago: Access Token de **produção**, segredo de assinatura do **Webhook** e URL pública HTTPS do site. O Checkout Pro cria uma preferência no servidor; só marca aprovado após webhook assinado e consulta autenticada do pagamento. Configure o endpoint de notificações do evento **payment**: `https://SEU-DOMINIO/api/payments/mercadopago/webhook`. No `localhost` pagamentos online não são habilitados. A chave pública fica opcional, pois o Checkout Pro redireciona ao Mercado Pago.
4. E-mails: API Key Resend, remetente de domínio verificado (`MAIL_FROM`) e e-mail administrativo. Use **Enviar e-mail de teste**.
5. Vendizap: ID e secret, e teste antes de sincronizar. Se não configurados, a sincronização não pode ser executada.

**Não coloque senhas, tokens e chaves em prints ou mensagens.** O painel armazena segredos cifrados. Faça backup de **toda a pasta `private/`**, incluindo `settings.key` e `mahach.sqlite` (e de `assets/produtos/`), nunca apenas do arquivo SQLite. Não sobrescreva sua pasta `private/` ao atualizar.

## Limitações reais

- **Nota fiscal:** não emitida automaticamente. O Bling continua sem OAuth e sem automação fiscal. Confirmações não devem afirmar que uma nota fiscal já foi emitida.
- **WhatsApp:** Uber/99 abrem mensagem pronta; mensagem de rastreamento só sai após ação humana no painel. Envio automático exige integração oficial da plataforma e consentimento/modelo de mensagem quando aplicável.
- **Pagamento:** integração implementada com Checkout Pro e confirmação servidor/webhook, mas não é possível testar cobrança real neste projeto sem as suas credenciais, um site HTTPS publicado e homologação. O Mercado Pago controla os métodos efetivamente exibidos no ambiente de pagamento.
- **Frete:** Melhor Envio apenas cota. A compra de etiqueta/postagem é manual. O código de rastreamento é inserido manualmente no painel.
- **E-mails:** dependem da conta Resend, verificação do domínio e efetiva entrega. O teste local utiliza simulação de API, não comprova envio real.
- **Estoque:** o pedido é registrado, mas não faz baixa automática no ERP.
- **Bancos de dados SQLite:** adequados para instância única e demanda moderada; para tráfego grande, é necessário infraestrutura apropriada e monitoramento.

## Instalação no Windows

Pare a V5.0.2 com Ctrl+C. Faça backup de `private/`, `assets/produtos/` e `.env`. Extraia o **patch V5.2** dentro da pasta que já roda a V5.0.2, substituindo os arquivos do patch. Rode:

```bash
node -p "require('./package.json').version"
npm test
npm start
```

Deve exibir `5.2.0`. Não precisa criar novo administrador. Não use o ZIP completo para substituir o banco já cadastrado.

## Verificações feitas

Testes de Node incluem controle de acesso, produtos, importação, cotações, envio de pedidos, rejeição de entrega/pagamento incompatíveis, assinatura e conferência do Mercado Pago com respostas simuladas e e-mails com API simulada. O checkout foi testado isoladamente em Chromium desktop e mobile. Uma execução completa de navegador conectada ao servidor foi bloqueada pelo ambiente; a operação real com prestadores externos segue pendente de homologação no site publicado.
