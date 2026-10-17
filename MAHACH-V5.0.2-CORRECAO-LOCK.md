# MAHACH V5.0.2 — Correção SQLite `database is locked`

## Problema diagnosticado no Windows / Node 24

No V5.0.1 a tabela `site_settings` era criada antes da ativação do `PRAGMA busy_timeout`.
Duas inicializações simultâneas podiam disputar a escrita e gerar `ERR_SQLITE_ERROR: database is locked`.
Também havia migrações de tabelas fora de uma única transação de inicialização.

## Correção

- Abre `DatabaseSync` com `timeout: 15000` (15 segundos).
- Configura `PRAGMA busy_timeout=15000` antes de qualquer criação de tabela.
- Inicialização de configurações, esquemas, migrações e importação inicial dentro da MESMA transação `BEGIN IMMEDIATE`.
- Mantém o banco, o catálogo, as fotos e o cadastro administrativo existentes. **Não apaga dados.**
- Inclui teste que bloqueia de propósito o banco por um segundo e espera que a inicialização conclua, mais o teste de dois processos simultâneos.

## Instalação — Git Bash

1. Feche o servidor (`Ctrl+C`).
2. Faça backup de `private/mahach.sqlite` e de `assets/produtos/`.
3. Copie `MAHACH_PATCH_SQLITE_V5_0_2.zip` para Downloads.
4. Na pasta da sua instalação atual, execute:

```bash
unzip -o ../MAHACH_PATCH_SQLITE_V5_0_2.zip -d .
node -p "require('./package.json').version"
npm test
npm start
```

A versão deve ser `5.0.2`. Testes esperados: **29 passaram, 0 falharam**.

## Escopo e observações

- Esse patch deve ser aplicado sobre a V5.0.1.
- Não precisa criar outro administrador nem reimportar os 1.770 produtos.
- O teste no ambiente de desenvolvimento usou Linux / Node 22.16.0; a validação final para seu Windows / Node 24.15.0 precisa ocorrer no seu computador.
- A aplicação de locks não garante funcionamento de múltiplas instâncias como arquitetura de alta escala; para produção, use gestão adequada de conexões e implantação confiável.
