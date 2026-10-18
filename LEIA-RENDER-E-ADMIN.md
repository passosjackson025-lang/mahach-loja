# MAHACH — Atualização da pasta PRINCIPAL / Preparação Render

Esta atualização modifica SOMENTE os arquivos que aparecem no ZIP, dentro da sua pasta atual `MAHACH_SITE_PRINCIPAL_CORRIGIDO_POSTGRES_V2`.

**NÃO crie outra pasta e NÃO substitua a pasta inteira.** Extraia o ZIP e copie **o conteúdo interno** para dentro da pasta principal existente, aceitando substituição dos arquivos de mesmo nome. Isso mantém `assets/produtos/` (suas fotos locais) e os arquivos privados fora do pacote.

## Alterações verificadas

- "Voltar ao topo" nas cinco páginas navega ao topo da **mesma página** (`href="#"`), sem redirecionar à home.
- Política de segurança agora permite `blob:` somente para imagens; corrige a prévia de foto local no navegador.
- Configurações de Resend (e-mail de vendas, remetente e chave de API) voltam a aparecer no painel Integrações.
- A vitrine continua navegável. Com checkout desligado, quem tenta finalizar vê um aviso claro de homologação, sem formulário enganoso nem tentativa de gravar pedidos.
- `scripts/auditar-publicacao.cjs`: consulta **somente leitura** de registros e URLs de foto no Neon; não mostra segredos.
- `scripts/migrar-fotos-cloudinary.cjs`: simula uma migração das URLs locais para fotos na nuvem. Com `--apply`, faz upload e atualiza referências no Neon de maneira condicional, preservando arquivos originais. Execute `--apply` SOMENTE após configurar Cloudinary e verificar a contagem; uploads ao Cloudinary e atualizações no Neon são gravações reais.

## Testar ANTES de publicar

No Git Bash, na pasta principal:

```bash
node --check server.js
npm install
npm run test:publicacao
npm run test:admin
npm run test:fotos
```

Os testes rodam localmente e não importam novamente o banco. Para inspecionar seu Neon (sem gravar), carregue `DATABASE_URL` do projeto **MAHACH — AWS US East 1 (N. Virginia)** no mesmo terminal e execute:

```bash
npm run publicacao:check
npm run fotos:migrar
```

Não imprima nem publique o conteúdo de `DATABASE_URL` ou `MAHACH_SETTINGS_KEY`.

## Persistência real

O Neon guarda os produtos e configurações. As credenciais salvas no painel ficam criptografadas — **precisam da MAHACH_SETTINGS_KEY ORIGINAL** para serem lidas após o deploy. A Render usa disco efêmero: fotos locais em `assets/produtos/` não devem ser consideradas permanentes no serviço publicado. Fotos novas precisam da Cloudinary; fotos locais já vinculadas aos produtos precisam ser migradas para lá (ou outro armazenamento persistente com suporte implementado).

Antes de habilitar o salvamento de fotos na Render, configure no painel Environment:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` obtidos na sua conta Cloudinary.

No Git Bash, depois de configurar as três variáveis de ambiente localmente (sem colocá-las no código/repositório), uma migração real de fotos é iniciada com:

```bash
npm run fotos:migrar -- --apply
```

O programa aborta se houver referência de foto local cujo arquivo não esteja na pasta. Se o upload falhar parcialmente, não renomeie/exclua nada: as referências já convertidas permanecem, e o próximo dry-run mostrará somente as restantes.

## Render — homologação visual em celular e computador

Use o serviço existente `mahach-loja` na Render, se estiver conectado ao repositório correto. Atualize os arquivos na origem do serviço (ex.: GitHub), não no painel do Neon. Na Render, valide as configurações:

| Campo | Valor ou observação |
|---|---|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL secreta **Virginia**, não a de Ohio |
| `MAHACH_SETTINGS_KEY` | chave hexadecimal **ORIGINAL** do backup verificado; nunca gerar outra |
| `MAHACH_ENABLE_CHECKOUT` | `false` durante homologação |
| `MAHACH_ENABLE_ADMIN_WRITES` | `false` até preservar imagens e testar backup; mudar para `true` apenas após avaliar o risco |
| `CLOUDINARY_*` | três variáveis privadas do armazenamento de imagens |

Não configure `HOST=127.0.0.1` na Render. O servidor já escuta `0.0.0.0` por padrão e respeita a porta definida pela Render.

A Render disponibiliza uma URL HTTPS terminada em `.onrender.com` após um deploy bem-sucedido. A hospedagem online **não faz backup automático dos arquivos locais** e **não ativa o checkout**. Não ative `MAHACH_ENABLE_CHECKOUT=true` sem resolver e testar as divergências do formulário atual (Jadlog/Loggi, WhatsApp, Mercado Pago), estoque e fluxos de pedidos; o frontend ainda está em homologação.

## Administrativo — revisão por funcionalidade

- Produtos: criação, preço, estoque, ativação/desativação, edição e foto testados **em simulação**; testar gravação e leitura após reinício no Neon.
- Categorias: criar, editar e excluir apenas categorias sem produtos; edição testada em simulação.
- Integrações: campos do painel persistidos e criptografados; chave original obrigatória. Teste de conectividade depende das credenciais corretas do provedor.
- Resend: campos agora aparecem no painel. Enviar e-mail é ação real, testar com e-mail próprio.
- Vendizap: teste de autenticação é distinto de "Sincronizar". A sincronização altera produtos; só executar depois de conferir a origem do catálogo.
- Melhor Envio: cotação depende de token/CEP; não emite etiqueta automaticamente.
- Mercado Pago: integração de pagamento e webhooks ainda pendente de homologação; não habilitar cobranças.
- Bling: prévia; OAuth, emissão fiscal e envio de pedidos não foram concluídos.
- Pedidos: podem ser listados e atualizados no painel, mas não houve teste de vendas reais; checkout bloqueado.

## Não subir para GitHub/Render

Não incluir `.env`, `private/`, `mahach.sqlite`, `settings.key`, tokens nem arquivos gerados por ferramentas com segredos. O `.gitignore` já inclui essas exclusões. Não apague fotos de `assets/produtos/` até concluir a migração e verificar URLs Cloudinary. Para publicar uma versão visual, não é necessário criar uma nova pasta local.
