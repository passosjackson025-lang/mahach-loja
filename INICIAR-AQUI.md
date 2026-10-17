# MAHACH V5: painel, fotos e configurações persistentes

**Atualização principal:** leia primeiro `README-ADMIN-V5.md`. O painel tem upload manual de fotos, criação/edição de produtos, categorias, estatísticas e configurações de integração salvas no banco. Bling e Mercado Pago não processam operações reais sem integração posterior e autorização.

# MAHACH V3 — Atualização do site e revisão do catálogo

## 1. Instalação sem perder seu administrador/pedidos

**Faça uma cópia de segurança da pasta atual**, principalmente `private/mahach.sqlite` e `.env` (não compartilhe as credenciais). Extraia esta V3 numa **nova pasta** e, se quiser manter os administradores e pedidos, **copie seu `private/mahach.sqlite` antigo para `private/mahach.sqlite` desta V3 antes de ligar o servidor**. O banco antigo é migrado automaticamente com novas colunas. Se preferir começar do zero, deixe o banco ausente e execute `npm run admin:create` em um segundo terminal depois de iniciar a loja.

Abra a nova pasta no VS Code. No primeiro terminal:

```bash
npm start
```

Acesse `http://127.0.0.1:3000` e o painel em `http://127.0.0.1:3000/admin`.

**Não encerre o `npm start` para abrir o navegador**: deixar servidor rodando no primeiro terminal. `ERR_CONNECTION_REFUSED` geralmente significa servidor desligado.

Node.js >=22.13.0. Não há dependências NPM externas. Execute testes `npm test`; testes de integração V3 usam banco temporário, mas o teste de catálogo V2 pode iniciar o catálogo em uma instalação ainda vazia.

## 2. Modal de produto

A cruz na janela de produto ganhou acionamento direto por clique, `type=button`, z-index e área clicável de 44 px; não depende do evento de sacola. O botão fecha a janela e o foco volta ao botão que abriu o produto; `Esc` também fecha. Teste manualmente em celular e computador. O Chromium desta sessão de geração teve o acesso local bloqueado e **não foi possível comprovar visualmente o clique final**.

## 3. Importação de CSV e Excel

Entre no painel **Produtos > Importar / atualizar catálogo**, selecione CSV UTF-8 delimitado por `;`, até 8 MB. Colunas aceitas: `Id`, `Nome`, `Preço`, `Descrição`, `Código`, `Categoria`, `Marca`, `Estoque-Saldo`, dimensões/embalagem. Também reconhece `Categoria Loja` ou `Departamento` como categoria principal. Novas categorias legíveis são criadas e limpas de emojis. Se o CSV original apresentar na coluna `Categoria` apenas marcas em maiúsculas (como LATTAFA), o importador as mantém como marca/filtro, preservando grupos gerais da vitrine. Atualizações com o mesmo ID **não substituem imagem verificada nem família olfativa editada**. Sempre faça backup antes de importar.

Para Excel `.xlsx`, primeiro converta com:

```bash
python scripts/xlsx_para_csv.py minha-planilha.xlsx
```

Depois importe o CSV convertido no painel. O conversor lê a primeira aba, não interpreta fórmulas externas e deve ser usado com planilhas confiáveis.

## 4. Imagens — revisão obrigatória e direitos de uso

Foram auditados **1.770 itens** do CSV recebido. Ele **não contém fotos, URLs nem licenças de imagem**. Foram localizadas páginas oficiais de **dois itens Lattafa**, sem confirmação da fotografia nem licença. Nenhuma foto de terceiros foi baixada ou falsamente atribuída. O arquivo `catalogo_imagens.csv` e `MAHACH_CATALOGO_AUDITORIA_V3.xlsx` têm status individual e campo de fonte. **Não use imagens de busca sem autorização comercial do fornecedor ou detentor dos direitos.**

Pesquisa de candidatos via **SerpApi** (serviço de terceiros, com limites/custos; token não incluído):

```bash
# Git Bash (terminal no Windows)
export SERPAPI_KEY='SUA_CHAVE_API'
python scripts/fotos_catalogo.py buscar --start 0 --limit 20
```

Resultado: `candidatos_imagens.csv`, com até três fontes por item, **todos aguardando revisão**. Use `--start 20 --limit 20`, e assim por diante. Pesquisar 1.770 produtos pode consumir até 1.770 consultas externas, com tarifa e limite de taxa; avance em lotes. Não é possível garantir que o buscador encontre fotografias oficiais de todos os SKUs.

Para selecionar uma foto, confira pessoalmente a **marca, fragrância, volume, rótulo, frasco/embalagem e autorização de uso comercial**. Em `candidatos_imagens.csv`, altere `Aprovado` para `SIM`, preencha a `Licenca` (ex.: `autorização de uso comercial fornecida pelo fabricante em [data]`) e confirme a `Pagina_Fonte`. Depois:

```bash
python -m pip install pillow
python scripts/fotos_catalogo.py aprovar --approvals candidatos_imagens.csv
```

O pipeline **não inventa frascos nem edita logotipos**. Só aceita foto HTTPS pública autorizada, tamanho mínimo, bordas brancas/transparentes e sem redirecionamentos. Centraliza o produto sem recorte em fundo `#FFFFFF`, salva `1200 × 1200` em WebP e atualiza o banco/`catalogo_imagens.csv`. Fotos ambíguas, pequenas ou com fundos coloridos são rejeitadas para revisão manual. O script nunca faz aprovação automática usando apenas o nome do arquivo.

**Recomendação comercial:** peça ao distribuidor arquivos oficiais em lote e a permissão de divulgação no e-commerce. Isso é mais preciso que busca aberta para 1.770 SKUs.

## 5. Checkout e pagamento

- Checkout identifica cliente, endereço e telefone, e solicita entrega ou retirada na loja por R$ 0,00.
- **Correios/Jadlog**: cotação de valores pela API Melhor Envio quando `.env` tiver `MELHOR_ENVIO_TOKEN` + `ORIGIN_CEP`. Seleção de um frete com validade curta: servidor confirma cotação/CEP/itens. Sem chave, cotação indisponível e valor fica *a confirmar*, sem cobrança.
- **Loggi, Uber Direct, 99Entrega**: solicitação manual, **sem cotação automatizada** até ter contratos e APIs homologadas. A retirada precisa do endereço real da loja, ainda não fornecido.
- **Pix/cartão**: opções **a confirmar**; nenhuma cobrança automática, nenhuma coleta de número/CVV. Uma etapa futura habilitará Bricks/SDK Mercado Pago (tokenização no navegador, acesso privado apenas no servidor, validação e webhooks). Não coloque credenciais secretas no JavaScript.
- Ao registrar o pedido, gera protocolo e mensagem pronta para WhatsApp; a pessoa precisa tocar em **Enviar** no WhatsApp. Mensagem não é disparada silenciosamente.

## 6. Rastreamento e Bling

A consulta por número + token mostra etapas: Pedido criado, Pagamento aprovado, Em separação, A caminho/Pronto para retirada, Entregue. O administrador atualiza o status e o código/link de rastreio. A linha do tempo **não inventa pagamento aprovado**. Ainda não há webhooks de transportadora.

Na aba **Integrações**, o botão de prévia Bling mostra os pedidos com pagamento **marcado como aprovado** e dados de produtos; **não envia nada ao Bling**. Falta desenvolver, autenticar e homologar o fluxo OAuth2 da conta, associar SKUs a IDs de produto/depósito, dados fiscais obrigatórios, criação idempotente, webhook de cobrança, emissão de NF-e/estoque e impressão de etiquetas. Nenhuma baixa de estoque deve ocorrer antes da confirmação do pagamento; um pedido enviado duas vezes não pode dar baixa dupla. Apenas preencher `BLING_CLIENT_ID` não ativa sincronização automática.

## 7. Segurança e escala

Mantidos hash/salt de senha, cookies HttpOnly/SameSite, Secure em produção, sessão expirada, CSRF e verificação de origem, CSP, autorização de administração no backend, consultas SQL parametrizadas, rate limiting, tamanho máximo de CSV, recalcular preço no servidor e proteção da pasta de banco. Importação CSV preserva dados já existentes e acontece em transação. Chaves ficam somente no `.env` ou cofre do provedor.

**Segurança absoluta e site que nunca cai não podem ser garantidos.** Antes de publicar: domínio e HTTPS, backup diário do banco e restauração testada, WAF/CDN, monitoramento, proteção contra robôs e picos, fila de trabalhos externos, teste de carga, teste de vulnerabilidades, política de privacidade/LGPD e banco apropriado para escala multi-instância.

## Fontes oficiais para integrações

- API Bling OAuth 2.0: https://developer.bling.com.br/bling-api
- Referência Bling: https://developer.bling.com.br/referencia
- Mercado Pago Checkout Bricks: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/common-initialization
- API Melhor Envio: https://docs.melhorenvio.com.br/docs/cotacao-de-fretes
- SerpApi busca de imagens: https://serpapi.com/google-images-api
