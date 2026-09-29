# Consórcio Lab — versão 2, sem login

Abra o endereço e comece a simular. Esta versão não pede nome, e-mail, senha ou cadastro.

**Para colocar na internet:** siga [PUBLICAR-GRATIS.md](PUBLICAR-GRATIS.md). A versão 2.0.1 inclui a configuração do Render Free e detecta o endereço público automaticamente. Ainda é necessário criar o serviço na sua conta.

## Abrir no Windows

1. Instale **Node.js 24 LTS**, se ainda não tiver.
2. Extraia o ZIP e entre na pasta **consorcio-lab**.
3. Dê dois cliques em **INICIAR-WINDOWS.cmd**.
4. Abra **http://localhost:3000** no navegador. Mantenha a janela do servidor aberta.

Também pode abrir a pasta que contém `package.json` no VS Code e executar:

```powershell
npm.cmd start
```

Não precisa executar `npm install`. Se o terminal mostrar `ENOENT package.json`, ele está na pasta errada; use o iniciador acima ou abra a pasta correta no VS Code.

## O que o cliente vê

1. **Objetivo:** usar no imóvel, deixar o crédito rendendo ou vender a carta contemplada.
2. **Valor:** digitar o crédito, escolher um valor sugerido e definir o prazo e o tipo de parcela.
3. **Quando usar:** testar um mês de liberação com opções como 1, 2, 3 ou 5 anos. Lances ficam em uma opção separada.
4. **Resultado:** parcela inicial, parcela depois da liberação, valor estimado, total pago e saldo restante. Uma frase explica se a diferença fica a favor ou contra o cliente.

A tela chama contemplação de **liberação do crédito** e explica o termo. A compra mostra quanto falta completar do próprio bolso; a venda mostra o recebimento líquido estimado. A linha do tempo permite olhar outro mês.

Seguro, taxas, INCC, impostos, datas de venda/uso e regras de lance continuam disponíveis nas opções do plano. Gráfico, comparação das parcelas, demonstrativo, hipóteses e exportações ficam nos detalhes do resultado.

## Guardar e abrir planos

- **Guardar aqui:** salva neste navegador e neste endereço do site, usando `localStorage`. Limite: 50 planos. O servidor não guarda uma lista de simulações.
- **Planos guardados:** abre ou exclui uma dessas cópias. Salvar de novo cria outra cópia.
- **Baixar arquivo:** gera um JSON com as escolhas e o histórico de índices. Guarde-o como cópia ou leve para outro aparelho.
- **Abrir arquivo:** importa o JSON, valida os dados e refaz os cálculos. Também aceita o JSON exportado pela versão anterior.
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

A suíte tem **44 testes**, incluindo cálculos, entrada direta sem conta, ausência de rotas que exponham os planos antigos, armazenamento local, importação de arquivos, falhas de armazenamento e inicialização em produção com o endereço fornecido pelo Render. Também foram conferidos a sintaxe JavaScript, a estrutura HTML, os rótulos e a presença dos 38 parâmetros. A revisão visual no navegador não foi realizada neste ambiente.

Exemplo sem índices, rendimento ou seguro: crédito R$ 220.000, 220 meses, administração 24%, reserva 0,2%, liberação no mês 60. Parcela integral inicial: **R$ 1.242,00**. Reduzida inicial: **R$ 742,00**. Reduzida no mês 61: **R$ 1.429,50**. Total de parcelas: **R$ 273.240,00** em ambos os planos.

## Configurações e hospedagem

O arquivo `.env.example` contém configurações opcionais. Na produção, use Node 24, `NODE_ENV=production`, HTTPS, `HOST=0.0.0.0` e `PUBLIC_ORIGIN=https://seu-dominio.com.br`. O diretório `data` deve ser gravável para o cache. A opção antiga `ALLOW_REGISTRATION` não é mais utilizada.

No Render, `render.yaml` configura o serviço Free e o servidor utiliza `RENDER_EXTERNAL_URL` automaticamente quando `PUBLIC_ORIGIN` não foi informado. O cache de índices pode ser recriado após reinícios; os planos ficam no navegador. Para domínio próprio, configure `PUBLIC_ORIGIN` com o endereço HTTPS escolhido. Os arquivos atuais não criam armazenamento de clientes na nuvem.

O código não publica um site automaticamente. GitHub Pages não executa o servidor Node que consulta os índices. Contas, sincronização entre aparelhos, contratos, transferências de cotas e investimentos reais não são executados por esta versão.
