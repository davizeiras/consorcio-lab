# Regras e convenções de cálculo

Este arquivo documenta o modelo programado. Percentuais de lance, seguro, taxas fixas e formas de utilização são premissas contratuais informadas pelo solicitante, não regras universais para todas as administradoras.

## 1. Componentes

Considere C = crédito contratado, N = prazo, a = administração total / 100, f = reserva total / 100 e S = seguro mensal em reais.

- Administração inicial total: C × a; rateio mensal: C × a ÷ N.
- Reserva inicial total: C × f; rateio mensal: C × f ÷ N.
- Parcela linear inicial: C ÷ N + C × a ÷ N + C × f ÷ N + S, quando o seguro incide.
- Parcela reduzida inicial: 0,5 × C ÷ N + C × a ÷ N + C × f ÷ N + S, quando incide.

Os 24% e 0,2% são taxas **totais do plano**, não taxas mensais. A redução incide somente no fundo comum. Seguro é um custo mensal em reais, não é dividido por N novamente. Em branco significa não informado; zero é uma hipótese explícita de custo zero.

## 2. Ordem mensal dos eventos

1. Aplicar um mês de rendimento a ativos já existentes no mês anterior.
2. Consultar a competência do indexador conforme a defasagem escolhida.
3. Aplicar a correção ao principal restante, quando chega a periodicidade de reajuste.
4. Pagar parcela, taxas e seguro do mês.
5. No mês simulado de contemplação, pagar lance e constituir o crédito líquido.
6. Se o cenário prevê venda ou uso naquele mês, executar esse evento hipotético depois da parcela e da contemplação.
7. Apurar ativos, dívida, desembolsos e resultado.

A data inicial representa o primeiro mês de pagamento. O mês da contemplação é pago com parcela reduzida; a redistribuição começa no seguinte. O seguro obrigatório do modelo começa no próprio mês da contemplação. Se o contrato tiver outra ordem de assembleia e vencimento, essas convenções precisam ser ajustadas.

## 3. Reajuste

Em cada competência publicada, o fator é 1 + percentual / 100. O fator de um conjunto de meses é o produto dos fatores, não a soma das porcentagens.

- Mensal: aplicar cada fator sobre o principal ainda não pago.
- Anual: acumular doze fatores e aplicar no início dos meses 13, 25, 37 etc.
- Defasagem padrão: um mês. No mês 2, usa-se a competência do mês 1.
- Administração, reserva e seguro não recebem correção neste modelo.
- O crédito de referência recebe a mesma correção até a contemplação. Depois de contemplado, passa a ser um ativo que rende pela hipótese escolhida, sem somar INCC ao mesmo ativo novamente.
- O saldo devedor continua sendo corrigido até o fim do prazo, mesmo após contemplação e uso.
- Índices negativos são aceitos. Histórico ausente é identificado e utiliza a hipótese, sem se tornar um dado oficial.

Exemplo: crédito R$ 120.000 em 24 meses, plano linear, após 12 amortizações de R$ 5.000 resta R$ 60.000. Um reajuste acumulado de 10% acrescenta R$ 6.000 ao principal restante. Não acrescenta R$ 12.000 ao saldo nem altera taxas fixas.

O INCC-M padrão é uma escolha provisória. A periodicidade da publicação não determina a periodicidade do reajuste contratual. Confirme variante, data-base, defasagem, tratamento de deflação e aniversário do grupo no contrato.

## 4. Parcela reduzida após contemplação

Amortização nova = saldo de principal depois da parcela e do lance do mês da contemplação ÷ número de meses restantes.

Não se deve somar novamente metade do crédito a esse saldo: a metade adiada já está nele. O motor recalcula com base no saldo efetivamente remanescente e aplica os próximos reajustes sobre o que ainda falta.

No último mês do prazo, qualquer saldo de principal restante é integralmente amortizado, inclusive se a contemplação ocorrer somente nesse mês. A interface informa a consequência dessa hipótese.

## 5. Lances

- Base dos percentuais: crédito de referência corrigido no mês da contemplação.
- Próprio: gera saída de caixa e amortiza principal.
- Embutido: reduz o crédito disponível e amortiza principal; não é contado como dinheiro saindo do bolso.
- Modalidades fixas de 25% e 40% exigem que próprio + embutido somem o percentual do lance.
- Pré-seleção de 25%: 15% próprio + 10% embutido. Também é possível escolher 0% próprio + 25% embutido. A descrição inicial estava ambígua; confirme a composição aceita no contrato.
- Pré-seleção de 40%: 20% próprio + 20% embutido.
- Fidelidade: inicialmente entre meses 13 e 36, lance de 40% a 50%, pré-seleção de 45%. Faixas editáveis. Considera parcelas mensais pagas em dia até o mês selecionado; não simula concorrentes ou desempates.
- Lance superior ao principal restante após a parcela do mês é rejeitado.

O lance reduz a parcela e mantém o prazo. Não reduz taxas futuras nem antecipa o término do contrato. Se a administradora amortizar outros componentes ou reduzir prazo, o motor deve ser adaptado antes de representar esse produto.

## 6. Crédito aplicado

Taxa mensal equivalente = (1 + taxa anual / 100)^(1/12) − 1.

Rendimento começa no mês seguinte à contemplação, sobre o crédito líquido do lance embutido. As parcelas continuam saindo de recursos próprios; não são debitadas automaticamente do ativo. Crédito vinculado à administradora não é apresentado como dinheiro livre para saque. O usuário informa uma hipótese de rendimento, que não assegura retorno efetivo.

## 7. Venda de cota

- Recebimento bruto = percentual negociado (0% a 45%) × crédito disponível na data de venda + reembolso adicional.
- Ganho-base da hipótese tributária = máximo entre zero e recebimento bruto − custos da cessão − desembolsos até a venda.
- Recebimento líquido = bruto − custo da cessão − alíquota efetiva informada × ganho-base.
- Resultado no ato = líquido recebido − desembolsos anteriores.
- O comprador assume todo o saldo remanescente de principal e taxas na hipótese de transferência aprovada. Esse saldo é mostrado separadamente.
- A partir do mês seguinte, encerram-se as parcelas do vendedor e o valor líquido recebido rende pela taxa de aplicação pós-venda.

Os 45% significam preço pago ao vendedor neste modelo. Se o acordo usar 45% como ágio, informe à parte o reembolso negociado. Não se soma simultaneamente o crédito integral e o valor da venda ao patrimônio do vendedor.

## 8. Uso imobiliário

O valor da operação é informado para a data escolhida de utilização. Não é automaticamente valorizado desde a contratação.

Antes do uso, desconta-se dos rendimentos do crédito a alíquota efetiva informada. Crédito usado = menor entre crédito disponível após esse desconto e valor da operação. Complementação = diferença positiva + custos informados, pagos com recursos próprios. Eventual sobra fica como crédito vinculado, não vira caixa livre.

Para compra e construção, o benefício patrimonial inicial assume o valor da operação se o campo for deixado vazio. Em construção, isso é uma simplificação de conclusão integral na data escolhida; não há cronograma de obra. Reforma e quitação exigem informar o benefício patrimonial separado: custo de reforma não prova valorização, e quitação é redução de outra obrigação, não geração de renda em dinheiro. Não são apurados aluguel, vacância, depreciação, manutenção, cronograma de liberações ou financiamento complementar.

## 9. Resultado e precisão

Patrimônio = direito de crédito condicionado antes da contemplação, ou ativos do cenário após a contemplação, menos desconto hipotético sobre rendimentos pendentes.

Dívida = principal + administração e reserva ainda não pagos. Seguro futuro não é tratado como saldo financiado; só conta quando ocorre no fluxo.

Resultado nominal = patrimônio − dívida − desembolsos acumulados.

ROI nominal = resultado ÷ desembolsos acumulados × 100. Não é taxa anual, TIR, valor presente ou ganho real descontado pela inflação.

Valores usam precisão numérica de JavaScript durante os cálculos e arredondamento apenas na apresentação. Pode haver diferença de centavos em relação a boletos que arredondam cada componente mensalmente. A última parcela zera resíduos do principal e taxas. Não há restituição presumida do fundo de reserva.

## 10. Condições pendentes de confirmação

- Empresa/administradora, grupo, regulamento e contrato aplicáveis.
- Nome, logotipo e cores definitivos.
- Tipo do INCC, aniversário do grupo e defasagem.
- Cotação do seguro e sua base de cálculo; seguro mensal fixo é o modelo implementado.
- Regras efetivas de lance, composição, desempate e redução de prazo/parcela.
- Interpretação dos 45% e condições da cessão.
- Remuneração real do crédito sob gestão e custos tributários aplicáveis.

Nenhuma destas lacunas recebe uma taxa oficial inventada. A interface usa premissas visíveis e editáveis.
