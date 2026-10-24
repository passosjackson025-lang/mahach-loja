# LA COUR V4 — Polimento visual e revisão técnica

## Escopo: preservar layout da V3.1

A V4 **não reorganiza os módulos da loja** nem remove o catálogo, o painel e os filtros de marca sem emojis. Melhorias aplicadas:

- Cabeçalho fixo com fundo discreto ao rolar, tipografia refinada e links com microinterações acessíveis.
- Mantidos os espaços e blocos principais da página inicial; melhor ritmo tipográfico e animações de entrada discretas.
- Cartões e detalhes de produto com acabamento mais elegante, hierarquia de marca, nome, descrição e preço.
- Checkout com seleção de frete mais legível e **subtotal, frete e total estimado** calculados a partir da sacola e da cotação escolhida; valores pendentes são exibidos como **A confirmar**.
- Mobile: áreas de toque amplas, opções de entrega em cartões, escalas tipográficas e animações reduzidas para quem assim solicita no sistema.
- Segurança: `no-referrer` (protege melhor os links com token), `no-store` para páginas pessoais/admin, controle de rota estática com verificação do caminho real, mais cabeçalhos de segurança e limite de consultas de acompanhamento.

## Referências pesquisadas

- Lenis: https://github.com/darkroomengineering/lenis — pesquisa de scroll suave; **não instalado** para evitar dificuldades com gavetas, scroll e touch.
- Motion: https://github.com/motiondivision/motionone — referência de suavidade e easing; sem dependência adicional.
- AOS: https://github.com/michalsnik/aos — referência de animação na entrada da tela; implementado com `IntersectionObserver` nativo.
- Lucide: https://github.com/lucide-icons/lucide — referência de consistência de ícones; os ícones existentes foram mantidos.
- Helmet: https://github.com/helmetjs/helmet — referência de cabeçalhos; o servidor nativo `http` já recebe proteções equivalentes selecionadas, sem instalar Express.
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html — recomendações de segurança no Node.
- MDN View Transitions: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API — estudado; sem troca da navegação da loja nesta etapa.

## Instalação

### Aplicar PATCH sobre a V3.1 (recomendado)
1. Pare `npm start` com Ctrl+C.
2. **Faça backup da pasta inteira**, em especial `private/mahach.sqlite` (administrador, produtos editados e pedidos) e `.env` (segredos).
3. Extraia `MAHACH_PATCH_PRO_V4.zip` por cima da pasta do **site V3.1**, confirmando a substituição.
4. Rode `npm start`; recarregue com Ctrl+Shift+R.
5. Acesse o catálogo, abra/feche a modal pelo X, selecione uma marca e teste retirada/entrega no checkout.

### Site inteiro
O ZIP completo é uma base nova sem banco de dados nem `.env`; copiar o banco antigo preserva dados. Não importe imagens de origem desconhecida sem confirmação.

## Testes e limitações honestas

- `npm test` roda testes de rotas, permissões, dados do catálogo, frete simulado e verificações da V4.
- **Teste com navegador Chromium no ambiente de geração não pôde rodar**, pois o endereço `127.0.0.1` foi bloqueado por política do ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`). Isso não prova que exista erro na loja. Faça conferência manual nos navegadores reais.
- Integrações de Mercado Pago, Bling e frete real dependem de credenciais, homologação e infraestrutura. O site não processa pagamento automaticamente nesta versão.
- A pesquisa de imagens do catálogo continua incompleta: fotos não verificadas não foram adicionadas nesta etapa.
- Nenhuma porcentagem como “98% livre de bugs” é verificável sem testes de carga, acessibilidade, segurança e produção.
- Em implantação com muitos acessos, usar proxy HTTPS, hospedagem monitorada, cópias de segurança, rate limiting distribuído, proteção de origem e banco de dados adequado à carga.

## Arquivos modificados

`styles.css`, `polish.js` (novo), `app.js`, `checkout.js`, `server.js`, `package.json`, páginas HTML públicas (inclusão do script), `tests/v4-polish.test.js`, esta documentação.
