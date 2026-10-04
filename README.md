# Controle de acesso em preparação · 2.4.0

Foto de identificação, login por e-mail e senha e painel de aprovação/bloqueio preparados. A ativação depende de configurar o projeto de contas, o envio de e-mails e o administrador. Veja [ATIVAR-ACESSOS.md](docs/ATIVAR-ACESSOS.md). Enquanto AUTH_MODE=public, o comportamento sem login abaixo permanece vigente.

## Simulador no modo público

Abra o endereço e comece a simular. Esta versão não pede nome, e-mail, senha ou cadastro.

A versão 2.3.0 mantém os objetivos **Render** e **Vender**, com a identidade Iran Solutions em vermelho, branco e preto. Ganhos e ROI positivos aparecem em verde; perdas continuam em vermelho. O resultado da venda mostra a carta disponível antes da operação ao lado do recebimento líquido. Uma aba **Poupança** compara os mesmos desembolsos com juros compostos.

**Para colocar na internet:** siga [PUBLICAR-GRATIS.md](PUBLICAR-GRATIS.md). A versão 2.0.1 inclui a configuração do Render Free e detecta o endereço público automaticamente. Ainda é necessário criar o serviço na sua conta.

## Abrir no Windows

1. Instale **Node.js 24 LTS**, se ainda não tiver.
2. Extraia o ZIP e entre na pasta **consorcio-lab**.
3. Dê dois cliques em **INICIAR-WINDOWS.cmd**.
4. Abra **http://localhost:3000** no navegador. Mantenha a janela do servidor aberta.

Também pode abrir a pasta que contém `package.json` no VS Code e executar:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd start
```

Na versão 2.4.0, execute `npm ci --ignore-scripts` antes de iniciar. Se o terminal mostrar `ENOENT package.json`, ele está na pasta errada; use o iniciador acima ou abra a pasta correta no VS Code.

## O que o cliente vê

1. **Objetivo:** Render (deixar o crédito aplicado) ou Vender (vender a carta contemplada e investir o valor recebido).
2. **Valor:** digitar o crédito, escolher um valor sugerido e definir o prazo e o tipo de parcela.
3. **Quando usar:** escolher qualquer ano dentro do prazo do contrato, o último período incompleto ou um mês personalizado. Lances ficam em uma opção separada.
4. **Resultado:** parcelas, valor estimado, total pago, saldo restante, ROI no período e lance total, dividido entre recursos próprios e carta. Antes da contemplação, o lance aparece como previsto. Uma frase explica se a diferença fica a favor ou contra o cliente.

O ROI usa o resultado estimado (valor estimado menos dívida e total pago) dividido pelo total pago do próprio bolso. É acumulado até o mês selecionado e não anualizado. O lance embutido não entra no total pago do próprio bolso.

Em **Evolução dos valores**, passe o mouse, toque no gráfico ou use o controle de mês com as setas do teclado para consultar os valores exatos. **Valores mês a mês** inclui o valor pago acumulado, também disponível no CSV.

Em **Resultado → Poupança**, cada parcela e lance próprio vira um depósito no fim do mesmo mês, começando a render no mês seguinte. O lance embutido não é dinheiro do bolso e não vira depósito. Depois da venda, não há novos aportes; o saldo segue rendendo pelo período selecionado. O controle de mês é compartilhado entre as abas. A comparação exibe total investido, valores estimados, dívida, resultado e ROI, sem anualização.

A taxa mensal é editável (0% a 10%); **0,5% é uma hipótese inicial, não uma cotação**. Não há consulta automática de TR/Selic nem cálculo por dia de aniversário. É uma projeção de juros compostos a taxa constante, não a reprodução do extrato real da poupança. [Regras de remuneração no Banco Central](https://www.bcb.gov.br/meubc/faqs/p/como-sao-remunerados-os-depositos-da-poupanca). A taxa escolhida é preservada nos planos e arquivos; planos antigos recebem a hipótese inicial sem alterar o cálculo do consórcio.

A tela chama contemplação de **liberação do crédito** e explica o termo. A venda mostra o recebimento líquido estimado. A linha do tempo permite olhar outro mês.

Seguro, taxas, INCC, impostos, data da venda e regras de lance continuam disponíveis nas opções do plano. Gráfico, tabela mensal, taxas e salvamento ficam nos detalhes do resultado.

## Guardar e abrir planos

- **Guardar simulação → Guardar aqui:** salva neste navegador e neste endereço do site, usando `localStorage`. Limite: 50 planos. O servidor não guarda uma lista de simulações.
- **Planos guardados:** abre ou exclui uma dessas cópias. Salvar de novo cria outra cópia.
- **Baixar arquivo:** gera um JSON com as escolhas e o histórico de índices. Guarde-o como cópia ou leve para outro aparelho.
- **Abrir arquivo:** importa o JSON, valida os dados e refaz os cálculos. Também aceita planos de rendimento e venda exportados pela versão anterior. Planos imobiliários antigos são preservados, mas não são convertidos nem abertos na interface atual.
- **Valores mês a mês → Baixar tabela:** exporta o demonstrativo em CSV.

Em um aparelho compartilhado, as pessoas que usam o mesmo perfil do navegador podem ver os planos guardados ali. Limpar os dados do navegador remove essas cópias. Outro navegador, perfil, endereço ou porta não acessa automaticamente os mesmos planos. Se o navegador bloquear o armazenamento ou não houver espaço, a tela informa a falha e permite baixar o arquivo.

Arquivos importados são identificados como histórico informado pelo usuário; o sistema não atribui automaticamente autenticidade oficial a esse histórico. Os resultados de um JSON são ignorados e recalculados.

## Atualizar a versão anterior

Siga **ATUALIZAR.txt**. Faça uma cópia de segurança, pare o servidor e atualize a pasta `public` inteira e o arquivo `server.mjs`. O novo `public/storage.js` precisa acompanhar a atualização.

As contas antigas deixam de ser utilizadas. O arquivo antigo `data/consorcio.sqlite` é preservado: a nova versão não o abre e não disponibiliza seu conteúdo por nenhuma rota pública. Antes de atualizar, você pode abrir os planos na versão antiga, baixar seus dados em JSON e usar **Abrir arquivo** na nova versão. Não existe importação automática do banco antigo.

## Regras financeiras

As fórmulas não mudaram nesta atualização. O arquivo **docs/REGRAS.md** descreve as convenções adotadas e os pontos do contrato que precisam ser confirmados.

- Parcela integral e reduzida; administração, reserva e seguro separados.
- Sorteio e lances livre, fixo de 25%, fixo de 40% e fidelidade.
- Lances próprios e retirados da carta.
- Crédito aplicado, venda da cota com investimento do recebimento, e uso imobiliário.
- Compra, construção, reforma e quitação, com custos e complementação.
- Juros compostos e taxas de retorno editáveis.
- Reajuste do principal restante; taxas fixas conforme o modelo solicitado.
- Seguro em branco deixa os resultados parciais, com indicação visível.

O mês de liberação é uma hipótese. **14% ao ano de rendimento** e **6% ao ano de reajuste futuro** são exemplos editáveis, não valores garantidos. Tributos e custos só entram conforme os campos informados. O resultado não desconta inflação.

## INCC

O servidor consulta INCC-M (SGS 7456) ou INCC-DI (SGS 192) no Banco Central e guarda o histórico por seis horas. O índice é mensal. Os meses futuros ou sem histórico usam a estimativa configurada e são identificados na tabela.

O cache fica separado, em **data/indices.sqlite**, criado automaticamente. Se a consulta falhar, o servidor preserva o histórico disponível ou informa que não há consulta, sem inventar índices. O plano salvo mantém seu histórico; use o botão de atualizar para buscar outro.

Também é possível importar um CSV em **Valor → Alterar taxas, seguro ou reajuste**, escolhendo histórico informado. Exemplo apenas de formato:

```csv
competencia;percentual
2025-01;0,71
2025-02;0,10
```

Em redes que exigem proxy, Node 24.5 ou posterior aceita `NODE_USE_ENV_PROXY=1` junto das variáveis de proxy da rede.

## Arquivos principais

| Arquivo | Para que serve |
| --- | --- |
| `public/index.html` | Estrutura e textos da interface |
| `public/styles.css` | Cores, espaçamento e adaptação ao celular |
| `public/app.js` | Formulário, navegação, resultados e eventos |
| `public/journey.js` | Textos de resumo e coerência das datas |
| `public/storage.js` | Planos no navegador e importação de JSON |
| `public/engine.js` | Cálculos e validações financeiras |
| `public/savings.js` | Juros compostos sobre os mesmos pagamentos, mês a mês |
| `server.mjs` | Arquivos públicos e consulta de índices, sem autenticação |
| `src/indices.mjs` | Consulta e cache dos índices publicados |
| `tests/` | Testes do motor, jornada, armazenamento e servidor |
| `ATUALIZAR.txt` | Instruções para atualizar a instalação anterior |
| `PUBLICAR-GRATIS.md` | Passo a passo para publicar pelo navegador |
| `render.yaml` | Configuração do serviço no Render Free |

## Verificação

```powershell
npm.cmd test
```

A suíte tem **53 testes**, incluindo os juros compostos conferidos pela fórmula de depósitos regulares, aportes interrompidos na venda, lances, reajustes, seguro, taxas inválidas, salvamento da comparação e compatibilidade com planos anteriores. Também cobre cálculos do consórcio, os dois objetivos atuais, planos imobiliários antigos, opções de anos, mês no gráfico, entrada sem conta, proteção dos dados antigos, armazenamento local e inicialização em produção.

Exemplo sem índices, rendimento ou seguro: crédito R$ 220.000, 220 meses, administração 24%, reserva 0,2%, liberação no mês 60. Parcela integral inicial: **R$ 1.242,00**. Reduzida inicial: **R$ 742,00**. Reduzida no mês 61: **R$ 1.429,50**. Total de parcelas: **R$ 273.240,00** em ambos os planos.

## Configurações e hospedagem

O arquivo `.env.example` contém configurações opcionais. Na produção, use Node 24, `NODE_ENV=production`, HTTPS, `HOST=0.0.0.0` e `PUBLIC_ORIGIN=https://seu-dominio.com.br`. O diretório `data` deve ser gravável para o cache. A opção antiga `ALLOW_REGISTRATION` não é mais utilizada.

No Render, `render.yaml` configura o serviço Free e o servidor utiliza `RENDER_EXTERNAL_URL` automaticamente quando `PUBLIC_ORIGIN` não foi informado. O cache de índices pode ser recriado após reinícios; os planos ficam no navegador. Para domínio próprio, configure `PUBLIC_ORIGIN` com o endereço HTTPS escolhido. Os arquivos atuais não criam armazenamento de clientes na nuvem.

O código não publica um site automaticamente. GitHub Pages não executa o servidor Node que consulta os índices. Contas, sincronização entre aparelhos, contratos, transferências de cotas e investimentos reais não são executados por esta versão.
