# Revisão de lançamento — LA COUR

Verificação em 26/10/2026. A loja pode ser apresentada para revisão visual. A abertura de vendas ainda depende dos itens abaixo.

| Item | Resultado | Próximo passo |
|---|---|---|
| Loja e responsividade | Layout, navegação, busca, filtros, sacola e checkout verificados em 320/390/768/1440 px | Revisão final do proprietário no próprio celular |
| Dashboard | Dados reais, períodos, gráficos, status, estoque, CSV e estados vazios implementados | Conferir em `/admin` |
| Pedidos e estoque | Histórico preservado; referência antes/depois verificada | Continuar cadastro manual dos produtos |
| Pix e cartão | Fluxos funcionam nos testes locais; produção autentica uma conta de teste (`test_account`) | Configurações → Mercado Pago: usar credenciais da conta real de produção, da mesma aplicação do webhook, e Verificar Mercado Pago |
| Checkout público | Flag de ativação configurada; bloqueio permanece enquanto a conta não for de produção | Validar a conta real; não contornar a verificação |
| Frete para perfumes | Integração atual Melhor Envio não aceita Correios para perfumes | Definir contratação/integração de envio compatível, ou limitar a operação à entrega local com cobertura definida |
| Correios para itens elegíveis | Somente tarifas reais Correios, vinculadas a produto/CEP; sem tarifa substituída por outra empresa | Validar token, ambiente, origem, embalagem, produto e cotação reais |
| Entrega Uber/99 | Uma opção única, corrida à parte claramente informada | Definir área atendida, disponibilidade e procedimento de confirmação com o SAC |
| E-mails e fotos | Recursos preservados; o painel informa se a configuração está preenchida | Conferir remetente verificado, chegada de confirmação/rastreio e persistência da foto após deploy |
| Hospedagem | Web service no plano gratuito da Render | Para evitar adormecimento: trocar o plano de computação do serviço, não apenas o plano do workspace |
| Documentação comercial | SAC, CNPJ e privacidade presentes | Proprietário deve finalizar endereço comercial, regras reais de entrega/troca/devolução, prazos e operação fiscal antes da abertura |
| Compra completa | Não houve cobrança real nesta atualização; não há venda aprovada no banco consultado | Realizar uma compra Pix e uma por cartão, verificar recebimento/webhook, estoque, e-mail, pedido e fluxo de reembolso pelo provedor |

Não é possível confirmar uma data de abertura enquanto pagamentos e logística estiverem pendentes. A liberação comercial deve ocorrer após os testes reais acima. A publicação do código, o botão Pix e o acesso a `/users/me` não comprovam recebimento de dinheiro.

## Tela de carregamento da Render

O serviço `mahach-loja` está no plano `free`. Serviços gratuitos adormecem após 15 minutos sem tráfego. A primeira visita após isso acorda a instância, podendo mostrar a página da Render por cerca de um minuto. Não acontece em todo acesso enquanto o serviço está ativo.

O plano pago de 0,5 CPU / 512 MB (antigo Starter) custa atualmente US$ 7/mês por instância, além de uso adicional aplicável. A mudança não foi efetuada porque implica cobrança recorrente. No painel do serviço, abra Settings e a configuração de compute/instance plan. Escolha o plano pago do **serviço web**; trocar somente o plano do workspace ou comprar domínio não remove o adormecimento. O mesmo serviço pode ser mantido, preservando URL, banco, ambiente e webhooks.

Fontes oficiais verificadas:
- https://render.com/docs/free
- https://render.com/docs/compute-plans
- https://render.com/pricing
- https://centraldeajuda.melhorenvio.com.br/hc/pt-br/articles/31220391789332-Guia-de-produtos-que-podem-ou-n%C3%A3o-ser-enviados-pelo-Melhor-Envio
- https://www.correios.com.br/enviar/proibicoes-e-restricoes

Os Correios publicam regras próprias para cosméticos, sujeitas a embalagem, conteúdo e restrições. A aceitação direta não deve ser confundida com a aceitação no contrato do Melhor Envio. A restrição implementada acompanha a integração realmente utilizada pela loja.
