# MAHACH — Site principal corrigido (PostgreSQL + painel V2)

Este ZIP **consolida** o site completo MAHACH V5.0.2, a adaptação PostgreSQL V1 e a correção administrativa/fotos V2. **Não é uma homologação de pagamentos nem uma publicação pronta na Render.**

## Para instalar na sua pasta principal existente, sem criar outra pasta

1. Pare o servidor com **Ctrl+C** no Git Bash.
2. Extraia este ZIP e copie **todo o conteúdo** sobre a sua pasta principal `MAHACH_SITE_CORRIGIDO` (ou sobre a pasta que você já decidiu usar). Mantenha a estrutura `admin/`, `scripts/` e `assets/`. A extração **não deve apagar** o que já existe em `private/`; esse diretório não está incluído no pacote.
3. Sua conexão `DATABASE_URL` deve apontar para o Neon correto **US East 1 / N. Virginia** que já apresentou `1770` produtos em `mahach_stage.products`. Não compartilhe a URL. Na mesma sessão do Git Bash:

   ```bash
   npm install
   npm run test:offline
   npm run test:admin
   npm run test:fotos
   npm run neon:check
   ```

4. **Somente depois de validar a conexão,** para testar alterações reais no painel local:

   ```bash
   npm run admin:local
   ```

   Acesse `http://localhost:3000/admin`, faça login, abra **Produtos**, edite **um produto descartável ou de teste**, selecione uma foto, clique em **Salvar produto**, atualize a página e verifique a foto.

## Atenção aos dados e às imagens

- `admin:local` grava diretamente no Neon escolhido. Se apontar para o `mahach_stage` já importado, **modificará o catálogo de verdade**. O checkout permanece desativado. Se não quiser alterar registros reais, crie antes uma branch de homologação no Neon.
- Preserve sua `private/settings.key` **original**, fora do repositório. Sem ela, dados criptografados já importados não poderão ser lidos. O ZIP não inclui chaves, bancos SQLite, `.env` ou senhas.
- Em desenvolvimento, foto é armazenada em `assets/produtos/` localmente; para hospedagem Render, configure **Cloudinary** para persistência. Sem ele, upload em produção é bloqueado. As credenciais da Cloudinary são `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- **Não execute novamente** o migrador SQLite→Neon com `--apply`. Os 1770 produtos já foram importados.
- O aviso SSL sobre `sslmode=require` é proveniente da dependência; uma verificação de certificado continua habilitada neste código. Considere atualizar a connection string para `sslmode=verify-full` ao revisar a configuração Neon, sem expor a URL.

## O que está validado versus pendente

- Testes automáticos locais **simulados**: catálogo, login e sessão, importação de imagem WebP, atualização de produto, categoria, configurações e Cloudinary simulado. Não equivale a teste de produção.
- Testes reais **confirmados pelo usuário** na versão anterior: leitura do catálogo e 1770 produtos do Neon, abertura da loja e da tela de login.
- **Ainda não homologados**: upload no Neon real, fotos online na Render, fluxo real de pedidos, Mercado Pago, e-mail Resend, Bling OAuth/fiscal, cotação Melhor Envio, sincronização Vendizap e comportamento sob concorrência. Não habilite vendas reais até a conclusão desses testes.

## Diagnóstico rápido

- `Cannot find module scripts/test-admin-photo.cjs`: a extração não foi aplicada na raiz do projeto.
- `DATABASE_URL não configurada`: a variável de ambiente não foi definida no terminal atual.
- `relation mahach_stage.products does not exist`: você está no projeto/branch Neon incorreto.
- Mensagem **Painel em modo leitura**: inicie usando `npm run admin:local`, **somente no computador**.
- O servidor está na porta 3000. Para encerrar, use Ctrl+C.
