# LA COUR V5 — Operação do painel

## Instalação sem perder dados

1. Faça backup de **toda** a pasta `private/`, incluindo `mahach.sqlite` (e arquivos WAL/SHM se existirem) e `settings.key`. Pare o servidor antes de copiar.
2. Aplique o PATCH V5 por cima da versão V4.1.2, substituindo os arquivos de código. **Não substitua a pasta `private/`.**
3. Rode `npm test` e depois `npm start` (em comandos/terminais separados). Acesse `http://127.0.0.1:3000/admin`.
4. Se for uma instalação nova, execute `npm run admin:create` uma vez para cadastrar o administrador. Use uma senha longa e exclusiva.

## Produtos e fotos

- Produtos > Novo produto: preencher nome, preço, categoria e dados opcionais; salvar. O produto aparece na loja imediatamente.
- Produtos > pesquisar > Editar: alterar informações ou selecionar uma foto do computador. O navegador **redimensiona mantendo a proporção**, centraliza com margem e fundo branco e envia um arquivo WebP 1200 × 1200 com nome aleatório.
- **Importante:** a conversão não remove fundos presentes na foto original. Prefira arquivos já fotografados em fundo branco. O site não inventa nem modifica embalagens.
- Foto URL HTTPS continua disponível como alternativa. O upload é armazenado em `assets/produtos/`. Faça backup dessa pasta junto com `private/`.
- Produtos marcados como não visíveis não aparecem no catálogo público.

## Configurações e integração

- Integrações: edite dados operacionais e credenciais; clique em **Salvar configurações**. Os valores são gravados em `private/mahach.sqlite`; segredos são cifrados com AES-256-GCM usando `MAHACH_SETTINGS_KEY` ou uma chave gerada em `private/settings.key`.
- **Faça backup da chave junto com o banco**. Sem ela, as credenciais cifradas não podem ser recuperadas. Em produção é recomendado configurar `MAHACH_SETTINGS_KEY` num gerenciador de segredos da hospedagem.
- Campos de segredo ficam vazios de propósito após salvar; deixe em branco para manter a credencial anterior. Marque **Remover credencial salva** para voltar ao valor do `.env` (se existir).
- Alterações no painel valem imediatamente para Vendizap, Melhor Envio, WhatsApp/retirada, teste de Mercado Pago e prévia de Bling. Configurações em `.env` são fallback quando ainda não há valor gravado pelo painel e alterações diretas ao `.env` exigem reinício.
- O painel **não modifica arquivos-fonte**; o banco de dados é a fonte de verdade para informações de loja. Editar arquivos-fonte não é maneira segura de guardar senhas. Para migrar o projeto, copie banco + chave + imagens.
- Vendizap: sincronização manual de catálogo existente, com teste de autenticação; revise o catálogo após sincronizar.
- Melhor Envio: teste de autenticação e cotação ao vivo no checkout (com token, CEP, dimensões e contato). **Não há compra de etiqueta automática**.
- Bling: cadastro de Client ID/Secret e prévia da fila. **Não há OAuth autorizado, criação de pedido fiscal ou emissão de nota** nesta versão.
- Mercado Pago: guarda credenciais e permite testar acesso; **o checkout não processa pagamentos**. Credenciais válidas não bastam para cobrar.
- Uber Direct, 99 e Loggi: opções de consulta manual, não há API ativa.

## Segurança e publicação

- Acesso ao painel requer sessão e CSRF. Só arquivos públicos explicitamente permitidos são servidos. Segredos nunca são retornados na listagem de configurações.
- Imagens são limitadas a WebP 1200x1200, 4 MB e rota administrativa. O servidor não executa arquivos enviados.
- Mantenha HTTPS, backups, logs, hospedagem gerenciada e atualizações do Node. SQLite atende a um servidor pequeno; alta disponibilidade ou múltiplas instâncias exigem planejamento e, em geral, banco centralizado.
- Os testes locais e simulados não comprovam integração em produção ou ausência total de vulnerabilidades. Não publique cobrança online até homologação e auditoria.
