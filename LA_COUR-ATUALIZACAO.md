# LA COUR — Perfumaria

Atualização aplicada sobre a versão atual do repositório, base `df0dd32b60f0e027bfeeedd1608cb1c4dfb45bac`, que já inclui Pix com QR Code, preenchimento por CEP e checkout em duas colunas. O ZIP anexado era anterior a essas melhorias.

## Identidade e apresentação

- Marca LA COUR — Perfumaria em todas as páginas, textos de compra, mensagens, metadados, privacidade, administração e atendimento.
- CNPJ mantido: 67.872.786/0001-08. Telefone e e-mail de atendimento preservados.
- Layout em creme, preto, marrom e dourado discreto, com navegação e componentes existentes.
- Asad, Khamrah, Badee Al Oud e Fakhar Black carregam preço e disponibilidade pela API atual. A foto cadastrada pela loja tem prioridade; as fotos oficiais locais são usadas quando não existe foto cadastrada.
- Arquivos das campanhas antigas removidos. Fotos existentes dos outros produtos preservadas.

## Compatibilidade

A estrutura PostgreSQL, IDs de produtos, estoque, pedidos, integrações, rotas, sessão administrativa e carrinhos existentes foram preservados. Identificadores técnicos legados (schema, variáveis de ambiente, cookies e chaves de armazenamento) permanecem para evitar perda de acesso ou dados. A chave de idempotência Pix anterior também permanece para que pedidos em andamento não gerem cobranças duplicadas.

O serviço estava com checkout público desativado e modo de teste habilitado antes desta atualização. Essa configuração foi preservada. Publicar o design não habilita vendas nem altera credenciais.

## Validação

- Testes existentes: SQL, catálogo, autenticação, CSRF, configurações, fotos locais, Cloudinary, clientes, pedidos, opt-in, webhook, estoque e Pix.
- Pagamentos testados com simulação, sem cobrança real.
- Navegador: página inicial, quatro destaques, detalhes, carrinho persistente, formulário de checkout, catálogo, busca, menu e filtros móveis.
- Larguras conferidas: 320, 390, 768, 1024 e 1440 pixels, sem rolagem horizontal na página inicial.
- Links de recursos locais e ausência de marcas antigas no HTML conferidos.
- A validação local do navegador usa respostas públicas capturadas da loja para não escrever no banco real. Integrações externas continuam dependendo das credenciais e configurações existentes.

## Executar o projeto

Use Node.js 22.13 ou superior. Instale as dependências com `npm ci` e execute com `npm start`. Use a configuração existente de ambiente e a chave original das configurações criptografadas. Não gere uma chave nova para substituir a chave atual.

## Imagens

Fotos dos produtos: fontes registradas em `assets/product-photo-sources.json`, obtidas da Lattafa. Imagens geradas apenas para a campanha visual, sem substituir as fotos reais dos produtos.

Banner: `assets/la-cour-hero.webp`; versão vertical: `assets/la-cour-hero-mobile.webp`. Criado com a ferramenta integrada de geração de imagens. Direção usada: fotografia editorial de um frasco âmbar LA COUR entre madeira escura de oud e flores brancas, luz dourada, fundo creme com espaço livre à esquerda, sem interface, testemunhos ou outras marcas. A composição de campanha é ilustrativa e não identifica um produto à venda.

## Experiência visual — atualização 2

A imagem principal da home foi mantida e agora começa atrás do cabeçalho. A navegação é fixa e transparente no topo; após a rolagem recebe fundo translúcido com desfoque, reflexos e bordas suaves. O rodapé é preto.

A página `/sobre.html` apresenta uma narrativa de marca criada para a LA COUR, sem inventar datas, nomes de fundadores ou números de vendas. Cabeçalho, menu móvel e rodapé apontam para essa página.

O catálogo mantém a grade, filtros e pesquisa existentes. Apenas o cabeçalho e o banner foram alterados; a imagem nova segue o creme, o âmbar e as flores da home, sem galhos. As novas imagens de campanha são `assets/la-cour-collection.webp` e `assets/la-cour-story.webp`. As flores transparentes de `assets/la-cour-flowers.webp` se sobrepõem às bordas das fotos em posições limitadas e sem receber cliques. Todas foram criadas pela ferramenta integrada de imagens, usando a campanha original como referência de cor, iluminação e formato das flores.

As animações respeitam `prefers-reduced-motion`. O conteúdo entra de baixo ao descer e de cima ao subir, com movimento discreto nas imagens e flores. O cabeçalho ganha estados próprios em cada direção. As animações não substituem a rolagem nativa.
