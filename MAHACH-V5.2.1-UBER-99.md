# MAHACH V5.2.1 — Uber / 99: pagar os produtos online, combinar a corrida no WhatsApp

## Comportamento corrigido

- **Uber e 99:** o cliente informa o endereço, escolhe **Pix ou cartão** e paga **somente os produtos** no Mercado Pago. O valor da corrida **não é incluído** no pagamento e **não é apresentado como frete grátis**: aparece como “Combinar separadamente”.
- Após a **confirmação real do pagamento pelo webhook** e pela consulta segura ao Mercado Pago, o retorno ao site (`/finalizado.html`) apresenta **Combinar entrega no WhatsApp**. A mensagem contém o número do pedido, endereço e os produtos. Ela só é disponibilizada quando o servidor confirma o pagamento.
- **Retirada:** segue permitindo dinheiro presencial ou Pix/cartão online.
- **Correios:** segue exigindo cotação válida e Pix/cartão online; falhas na cotação são independentes das opções Uber/99. Para ativar, configurar `MELHOR_ENVIO_TOKEN` e `ORIGIN_CEP` válidos no painel.
- Os e-mails de pagamento aprovado deixam explícito que a corrida Uber/99 **não** foi incluída na compra.

## Instalação

1. Pare o servidor com Ctrl+C.
2. Faça backup do diretório `private/`, especialmente `private/mahach.sqlite`, e das imagens em `assets/produtos/`.
3. Extraia `MAHACH_PATCH_UBER_99_V5_2_1.zip` sobre a pasta onde você instalou a **V5.2.0** (substituindo os arquivos).
4. Confira: `node -p "require('./package.json').version"` → `5.2.1`.
5. Execute `npm test` e depois `npm start`.
6. Recarregue a loja com Ctrl+Shift+R.

O PATCH não contém o banco SQLite, `.env`, chaves privadas nem as fotos dos produtos. Use a versão completa para instalar em uma pasta nova e **copie cuidadosamente seus dados existentes** antes de usá-la em produção.

## Limitações importantes

- Pagamento real depende de Access Token de **produção**, URL pública HTTPS e webhook correto do **Mercado Pago**. Chaves apenas salvas não garantem que a integração esteja homologada.
- Uber/99 não são cotados nem contratados automaticamente. O valor do transporte é acertado diretamente no atendimento e não faz parte da venda dos produtos.
- O retorno do navegador não comprova pagamento aprovado; apenas a confirmação verificada no servidor habilita o contato para combinar a corrida.
- Testes: suíte automatizada do servidor, com APIs externas simuladas; checkout visual em Chromium isolado para desktop e mobile. Não houve cobrança real ou envio de mensagem WhatsApp.
