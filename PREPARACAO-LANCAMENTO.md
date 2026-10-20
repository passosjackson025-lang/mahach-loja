# MAHACH — preparação de lançamento (20/10/2026)

Cadastro dos produtos: manual pelo proprietário. A pesquisa dos 500 deixou de fazer parte da execução solicitada.

## Entrega preparada
Branch: codex/preparacao-lancamento. PR: https://github.com/passosjackson025-lang/mahach-loja/pull/1
Produção permanece no commit 9494a87c0a59fa95ec7d1c3d5198a0a14895ec50 (V8), verificado durante esta sessão. Nenhum deploy ou alteração de dados de produção realizado.

- Estoque físico e medidas de transporte exigem confirmação explícita no painel. O estoque legado 1000 não recebe confirmação automática.
- Produtos inativos pesquisáveis por nome, marca, SKU ou ID; edição preserva ID; SKU gerado quando vazio; índice único.
- Reserva de estoque em transação antes da chamada de pagamento. Repetição do checkout com a mesma chave recupera o mesmo pedido. Pix usa a mesma chave de idempotência por pedido.
- Reserva é consumida na aprovação, sem nova baixa; cancelamento confirmado pelo provedor libera uma reserva pendente uma única vez. Estornos de compras já aprovadas não repõem estoque automaticamente.
- Checkout de cartão em URL validada do Mercado Pago; recuperação da preferência existente. Os dados do cartão não passam pela loja.
- Webhook HMAC, consulta ao provedor, conferência de valor, moeda, método e pedido. Novas compras podem ficar suspensas sem interromper notificações de pagamentos iniciados.
- Estados pendente, em análise, recusado, cancelado, aprovado, reembolsado e contestação. Eventos pendentes atrasados não desfazem aprovação.
- E-mail só é marcado como enviado com resposta contendo ID do provedor. Chave de idempotência reduz duplicação por retry; aprovação, preparação, embalagem, envio e conclusão têm notificações.
- Rastreamento por transportadora e link HTTPS cadastrado. Impede preparo/expedição de pedido online sem pagamento aprovado.
- Frete mantém Melhor Envio e restrições atuais de perfumes. Preço, itens e dimensões fazem parte da validação da cotação. Nenhuma cotação fictícia.
- Scrypt assíncrono no login, limites de tempo/tamanho HTTP, paginação inteira, arquivos privados bloqueados.
- robots.txt e sitemap.xml preparados para a URL principal configurada; nenhum domínio novo definido.

## Evidência de testes
A rodada no commit 3097a8f318808af7e7d356e187d277cf6886a613 passou nos testes unitários, testes legados, PostgreSQL 18 descartável, Chromium desktop (1440px) e mobile (390px), e npm audit sem vulnerabilidades reportadas.
A rodada 9be4701e2be9bc313f4a470e8bc5b66942336c4d também passou, incluindo verificação pública somente por GET: checkoutEnabled=false, páginas respondendo 200 e acesso administrativo/arquivos privados bloqueados. Rodadas seguintes devem passar novamente antes de publicar.
O PostgreSQL de testes usa dados sintéticos locais. Mercado Pago, Melhor Envio, Resend e Cloudinary são simulados nos testes. NÃO é homologação real dos provedores.
Cobertura: checkout repetido simultâneo, reserva de estoque, webhook simultâneo/duplicado/assinado, valor divergente, eventos atrasados, cotação invalidada por mudança de preço, arquivos privados, modal, sacola e Pix renderizado.
O teste progressivo usa somente /api/health no ambiente descartável; os números NÃO representam capacidade do serviço Free em produção.
Verificação pública usa apenas GET; não cria pedidos nem cobra valores.

## Bloqueios de lançamento
1. MP_HTTP_401_7 ocorreu em produção após V8. A configuração permite token e segredo de webhook específicos do Pix (API Payments), separados do cartão (Checkout Pro). Isso permite corrigir a compatibilidade da aplicação sem trocar o fluxo de cartão. Normalização de Bearer não comprova que a causa real foi resolvida. Precisamos de credencial apropriada à integração/ambiente, permissão de pagamentos e homologação real na conta. Consulta /users/me não comprova permissão de cobrança.
2. Estoque real, preço, SKU e embalagem de cada produto precisam de revisão manual. Imagens serão cadastradas pelo proprietário.
3. E-mail: MAIL_FROM e ADMIN_EMAIL estavam vazios no banco consultado. Confirmar Resend, domínio/remetente e recebimento real.
4. Frete: falta cotação real com uma sacola e embalagem confirmadas; restrições de perfumes e cobertura dependem do serviço.
5. Render usa Free (hiberna). Upgrade de compute requer orçamento/aprovação; nenhum plano alterado. A branch identifica CF-Connecting-IP somente quando hospedada na Render; confirmar esse cabeçalho no deploy. Cotações e rate limit usam memória de uma instância e precisam de armazenamento compartilhado antes de escalar horizontalmente.
6. Nenhum snapshot nem agendamento de snapshot estava configurado no Neon. Snapshot é cobrado conforme tabela do provedor; não criado sem aprovação de cobrança.
7. Migração foi preparada/testada em banco descartável, mas ainda não aplicada no Neon.

## Aplicação proposta (exige aprovação de produção)
1. Manter MAHACH_ENABLE_CHECKOUT=false; confirmar publicamente checkoutEnabled=false. Manter modo de homologação acessível apenas ao administrador quando necessário.
2. Criar backup verificável do Neon. Se usar snapshot, obter aprovação de custo primeiro. Restaurar em branch isolada e verificar contagens, configurações e pedidos; não restaurar sobre produção.
3. Executar migrations/20261020-sale-validation.sql. Somente adiciona três flags booleanas e índice de SKU. Flags antigas começam falsas; não muda saldo, IDs, preço ou visibilidade. A criação do índice falha se houver SKU duplicado, revertendo a transação.
4. Publicar exatamente o commit testado pela PR, confirmando main atual e preservando alterações alheias. Main publica automaticamente na Render.
5. Conferir deploy, health, catálogo, acesso privado, painel e checkout público desativado. Conferir logs sem imprimir segredos.
6. Cadastrar/confirmar manualmente produtos prontos. Produtos sem estoque confirmado não podem vender; transporte exige confirmação de medidas.
7. Homologar Pix e cartão com credenciais corretas, webhook real e recebimento de e-mail; testar frete real. Cobranças reais e liberação pública exigem aprovação separada.
8. Só abrir vendas depois do aceite da homologação.

## Reversão
Com checkout ainda bloqueado e antes de novas compras: retornar o deploy ao V8, mantendo as colunas novas (mudança aditiva). Não apagar colunas, índices, produtos ou pedidos automaticamente.
Se houver pedidos com reservas ou pagamentos, não retornar ao V8 sem reconciliação: V8 baixa estoque em outro momento. Suspender novas compras, preservar webhooks, conferir pagamentos no provedor e tratar reservas individualmente.
Restaurar snapshot sobre produção só com aprovação explícita e plano de preservação dos pedidos posteriores ao snapshot. Não é reversão automática segura após vendas.

## Domínio futuro
Após a compra: confirmar nome exato, cadastrar domínio na Render, aplicar os registros DNS retornados, verificar TLS, escolher URL principal e redirecionamentos; atualizar PUBLIC_SITE_URL e URLs de retorno/webhook do Mercado Pago. Verificar remetente de e-mail e registros DNS informados pelo provedor (SPF/DKIM/DMARC). Conferir sitemap e robots no domínio final.
Não modificar URLs atuais antes dessa escolha.

## Operação
Reservas de pagamentos sem confirmação não devem ser liberadas manualmente enquanto o provedor ainda puder aprovar a cobrança.
Cancelamento de pedido no painel não cancela nem reembolsa uma cobrança no Mercado Pago. Verificar o provedor antes de reconciliar estoque.
O checkout de cartão reaproveita a preferência persistida. Uma falha de rede após o provedor criar a preferência e antes da persistência exige conciliação; não há afirmação de exatamente uma cobrança em todo cenário.
Nenhuma declaração de segurança absoluta, disponibilidade absoluta ou 100% funcionalidade foi feita.

Referências verificadas: https://neon.com/docs/guides/backup-restore (snapshot US$ 0,09/GB-mês); https://render.com/docs/free; https://developers.cloudflare.com/fundamentals/reference/http-headers/; https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-test/make-test-purchase

## Validação gratuita no Neon — atualização de 20/10/2026
- Plano da organização confirmado pela API: Free. Franquia oficial consultada: 10 branches por projeto.
- Cópia preservada, criada sem compute: mahach-reserva-pre-lancamento-20261020 (br-icy-term-b8xnabnk), a partir de production, LSN 0/282F8F8.
- Ambiente isolado: mahach-homologacao-20261020 (br-royal-truth-b8f1l1rb), criado a partir da cópia preservada, com compute fixo de 0,25 CU. Usa os recursos incluídos no Free; nenhum plano alterado ou snapshot pago criado.
- A primeira configuração de tempo de suspensão foi recusada pelo plano. A criação foi refeita sem alterar o tempo de suspensão imposto pelo Free.
- Recuperação da cópia conferida nas sete tabelas por contagem e assinatura calculada dentro do banco: produtos 1771, categorias 3, pedidos 9, administradores 1, configurações 16, clientes 1 e sessões 1. Todas as assinaturas corresponderam às de produção no momento da conferência. Valores de credenciais e dados pessoais não foram exportados.
- Migração 20261020-sale-validation.sql aplicada com sucesso SOMENTE na homologação.
- Após a migração: 1771 produtos preservados, 1771 ativos, saldos inalterados; zero confirmações automáticas de estoque ou embalagem. As assinaturas dos campos originais das sete tabelas continuaram iguais.
- A cópia fica no próprio projeto Neon e depende da mesma conta/projeto. Não substitui uma exportação externa independente; não houve troca da conexão do site.
- CI do código 337667c9bba97ddc56a9f528f985b5adbb31feaa: offline/PostgreSQL/navegador e verificação pública aprovados (run 39486393257).
- A tentativa de aplicar a migração em produção foi rejeitada pela revisão automática de aprovação, por exigir autorização específica após os testes isolados. Nenhuma instrução SQL dessa tentativa foi aplicada. Consulta posterior confirmou a ausência das três colunas em produção.
- A PR continua sem merge, e o deploy de produção não foi alterado.

### Operação concreta aguardando aprovação
1. Aplicar em production o mesmo arquivo SQL já validado: adicionar stock_confirmed e shipping_confirmed em products, stock_reserved em orders (todas false por padrão) e o índice único para SKUs não vazios.
2. Publicar a PR 1 somente com os testes aprovados. Não mudar planos, domínio, credenciais ou flags de liberação pública.
3. Conferir o deploy Render e repetir a verificação pública somente por GET. Manter checkout público fechado para a homologação real.
A liberação pública de pagamentos e qualquer cobrança real continuam fora dessa operação.

## Conexão Bling e testes de cartão — atualização
- Implementado OAuth 2.0 do Bling no painel: state aleatório, cookie HttpOnly/Secure/SameSite=Lax exclusivo para callback, vínculo à sessão administrativa ainda válida, prazo de dez minutos, uso único e invalidação se as credenciais mudarem. Reiniciar o processo cancela autorizações pendentes; basta iniciar novamente.
- Tokens e renovação são gravados criptografados no banco de configurações existente, sem nova migração; não aparecem na lista do painel e não podem ser inseridos pela API pública de configurações. Renovação simultânea usa uma requisição por processo.
- Configurar no aplicativo Bling o retorno exato PUBLIC_SITE_URL + /api/integrations/bling/callback, cadastrar Client ID/Secret pelo painel privado e clicar em Autorizar conta Bling. A autorização acontece no Bling; esta etapa requer o titular da conta.
- Conexão OAuth NÃO implementa exportação automática de pedidos, autorização de NF-e ou compra de etiqueta. A exportação ainda é prévia. Permanecem bloqueios de lançamento; não considerar nota emitida.
- Credenciais Mercado Pago iniciadas por TEST- agora selecionam sandbox_init_point, inclusive ao recuperar uma preferência. Não há fallback para init_point de produção quando a URL de testes não estiver presente.
- Painel inclui botão de e-mail de teste ao ADMIN_EMAIL configurado. Mensagem aceita pelo Resend não prova entrega na caixa de entrada.
- Ainda faltam nome real do domínio comprado, remetente, configuração DNS, autorização Bling, certificado/configuração fiscal e homologação externa. Não foram lidos ou divulgados tokens existentes.

### Fluxo operacional e limites atuais
1. Pedido e estoque: reservar somente estoque confirmado; recalcular valores no servidor.
2. Pagamento: QR/Pix Copia e Cola ou cartão no Mercado Pago; atualizar por assinatura e consulta ao provedor. Um teste local simulado não prova pagamento externo.
3. E-mail: após aprovação real, enviar confirmação pelo provedor; marcar o envio apenas após identificação da mensagem aceita.
4. Fiscal: integrar pedidos ao Bling com SKUs, cliente e endereço estruturados, validar regras fiscais com o responsável e emitir somente com autorização SEFAZ. Essa exportação ainda não foi implementada. Não substituir documento fiscal por recibo da loja.
5. Expedição: cotação já usa Melhor Envio. Compra/geração de etiqueta e automação de coleta ainda não implementadas; nunca cobrar saldo sem aprovação.
6. Rastreio: cadastro no painel e e-mail estão implementados; recebimento automático de eventos Melhor Envio ainda não implementado. É necessário aplicativo com webhook, assinatura e vínculo do identificador de etiqueta ao pedido; etiquetas criadas fora do aplicativo não geram eventos para ele.
7. Entrega: atualizar status por evento verificado ou conferência operacional, não por confirmação do pagamento.

Fontes oficiais: https://developer.bling.com.br/aplicativos ; https://developer.bling.com.br/webhooks ; https://docs.melhorenvio.com.br/docs/webhooks ; https://resend.com/docs/dashboard/domains/introduction
