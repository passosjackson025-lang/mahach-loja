# MAHACH — Correção do painel PostgreSQL V2

**Pacote de atualização para a pasta MAHACH_SITE_POSTGRES_TESTE; NÃO para a versão SQLite original.**

## Por que a foto não salvava?

Na prévia PostgreSQL, todas as rotas POST/PUT/DELETE do painel, incluindo `/api/admin/images` e `/api/admin/products`, ficam bloqueadas quando `MAHACH_ENABLE_ADMIN_WRITES` não é exatamente `true`. O servidor retorna 503. Isso foi intencional para evitar edições involuntárias no banco importado.

## O que muda

- Painel mostra um aviso claro quando está em modo somente leitura, além do tipo de armazenamento de fotos.
- Ao habilitar edições **deliberadamente**, é possível testar criação/edição de produtos, categorias, upload de imagem WebP, importação CSV, configurações, atualização de pedidos etc., respeitando autenticação, sessão e CSRF já existentes.
- Fotos: em localhost, mantém gravação local `assets/produtos/`; em produção/Render, **não** salva no disco efêmero. Usa armazenamento persistente Cloudinary quando as três variáveis de ambiente estão configuradas, retornando `https://res.cloudinary.com/...` para o cadastro do produto. Se faltarem credenciais em produção, mostra erro claro, em vez de dizer que salvou.
- A sincronização Vendizap passa a preservar imagem manual previamente cadastrada no disco local/Cloudinary para não sobrescrevê-la automaticamente.
- Checkout/webhook Mercado Pago permanecem **desativados** sem `MAHACH_ENABLE_CHECKOUT=true`. Não habilite cobrança real agora.

## Como aplicar sem prejudicar o site original

1. Pare o `npm start` do terminal atual com **Ctrl+C**.
2. Faça uma cópia de segurança da pasta `MAHACH_SITE_POSTGRES_TESTE` no Windows (Ex.: `MAHACH_SITE_POSTGRES_TESTE_ANTES_ADMIN_V2`). Não altere `MAHACH_SITE_V5_0_2_CORRIGIDO`.
3. Extraia este ZIP e copie os arquivos **com a mesma estrutura de pastas** por cima da pasta `MAHACH_SITE_POSTGRES_TESTE`. Os únicos arquivos substituídos são `server.js`, `admin/admin.js` e `admin/painel.html`; `image-storage.js`, `admin/admin-pg-status.css` e os testes são novos.
4. No Git Bash, entre na pasta de teste: `cd "/c/Users/jackson.silva/Downloads/MAHACH_SITE_POSTGRES_TESTE"`.
5. Rode: `node scripts/test-offline.cjs`, `node scripts/test-admin-photo.cjs`, `node scripts/test-cloud-storage.cjs`. Esses testes usam **PostgreSQL simulado** e não alteram o Neon. Esperado: `OFFLINE OK`, `ADMIN OK (SIMULADO)` e `CLOUDINARY OK (SIMULADO)`.
6. **Atenção:** ao habilitar gravações no próximo passo, editar pelo painel vai ALTERAR DE VERDADE os registros do schema `mahach_stage` no Neon ligado à sua `DATABASE_URL`. Recomendamos criar uma branch separada no Neon antes de experimentar. O backup SQLite verificado é uma proteção, mas não é um backup automático de futuras alterações no Neon.
7. Mantenha o Git Bash com a `DATABASE_URL` do projeto MAHACH de Virginia configurada, **sem compartilhar a URL com ninguém**. Confira `npm run neon:check` antes de escrever.
8. Para iniciar **somente no computador**, com gravações liberadas no processo:

   `MAHACH_ENABLE_ADMIN_WRITES=true npm start`

   O checkout continua desabilitado. Isso não habilita a escrita permanentemente: ao fechar este processo, o valor não é salvo na Render.

9. Acesse `http://localhost:3000/admin`, entre com seu administrador, abra **Produtos > Editar**, selecione uma imagem JPG/PNG/WebP, clique em **Salvar produto**. O navegador converte a imagem para WebP 1200×1200. Recarregue o painel e o catálogo: o campo `image` deverá conter `/assets/produtos/....webp` e a imagem deverá aparecer. Em caso de falha, envie **somente a mensagem de erro**.

## Publicação na Render — ainda não fazer

O Render pode apagar arquivos gravados no sistema de arquivos durante atualizações. **Foto local não é persistência de produção.** Esta correção suporta Cloudinary de modo assinado no servidor quando configurado:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Configure os três no serviço de hospedagem com os dados da **sua conta** de armazenamento, sem enviar credenciais ao chat e sem colocá-las no GitHub. O módulo `image-storage.js` só envia fotos via HTTPS, valida o retorno e grava URL pública no campo `products.image`. Sem Cloudinary, em modo produção/Render o envio de foto é explicitamente bloqueado para evitar falsa sensação de que salvou.

**Limitações não resolvidas:** Bling ainda tem apenas prévia sem OAuth fiscal; pagamento real, emissão fiscal, e-mail e cotação não foram homologados; Vendizap depende de API/credenciais. Não afirmar que tudo está em produção. Os testes com banco simulado não substituem testes em um Neon de homologação com registros descartáveis.

**Segredos:** não inclua `private/`, `settings.key`, `*.sqlite`, `.env` nem `DATABASE_URL` neste ZIP, em GitHub ou no chat.
