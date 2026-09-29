# Colocar o Consórcio Lab na internet

Esta versão já está preparada para o **Render Free**. O envio abaixo é feito pelo navegador, sem comandos no terminal. Você precisa de uma conta no GitHub e outra no Render para publicar; os clientes entram direto no simulador, sem cadastro.

O arquivo baixado ainda não é um site publicado. Ao concluir os passos, o Render fornece o endereço para compartilhar.

## 1. Enviar o código ao GitHub

1. Extraia este ZIP em uma pasta nova e abra a pasta `consorcio-lab`.
2. Entre em [github.com/new](https://github.com/new), escolha o nome `consorcio-lab` e crie um repositório **Private**. Isso guarda o código na sua conta.
3. Na página do repositório vazio, use **uploading an existing file**. Em um repositório que já tenha arquivos, a opção é **Add file → Upload files**.
4. Arraste o **conteúdo** da pasta `consorcio-lab` para a página: os arquivos e as pastas `public`, `src`, `tests` e `docs`. Envie os arquivos extraídos, não o ZIP.
5. Clique em **Commit changes** para salvar.

Confira a página inicial do repositório: `package.json`, `server.mjs` e `render.yaml` devem estar visíveis juntos. Se aparecer apenas uma pasta chamada `consorcio-lab`, você enviou a pasta externa; os arquivos precisam ficar na raiz do repositório.

Use o conteúdo do ZIP novo. Não envie a pasta `data`, o arquivo `.env` da instalação antiga, bancos de contas nem arquivos de planos de clientes.

## 2. Publicar no Render

1. Entre em [dashboard.render.com](https://dashboard.render.com) e crie sua conta.
2. No painel, escolha **New → Blueprint**.
3. Conecte sua conta do GitHub e permita acesso ao repositório `consorcio-lab` que acabou de criar.
4. Selecione esse repositório e use o arquivo `render.yaml`, que já vem no projeto.
5. Na revisão, confira que existe **um único Web Service, com plano Free**. Escolha o workspace Hobby, sem assinatura paga. O projeto não precisa de banco adicional, disco pago ou domínio comprado.
6. Confirme a criação e aguarde o serviço ficar **Live**. Abra o endereço HTTPS fornecido pelo Render e compartilhe esse link.

O código detecta o endereço público do Render. Não precisa preencher `PUBLIC_ORIGIN`, escolher uma porta nem enviar um arquivo `.env`.

Se o nome do serviço já estiver ocupado no seu workspace, altere `name: consorcio-lab` em `render.yaml` no GitHub antes de criar o Blueprint.

## 3. Entender o que fica salvo

O cliente precisa clicar em **Guardar aqui** no resultado. Na próxima visita pelo **mesmo endereço, aparelho e perfil do navegador**, encontra a cópia em **Planos guardados**.

| Situação | O que acontece |
| --- | --- |
| Voltar pelo mesmo navegador e endereço | Os planos guardados continuam disponíveis, enquanto o navegador mantiver os dados |
| Apenas fechar a página sem salvar | As alterações não são guardadas automaticamente |
| Abrir em outro celular ou navegador | Os planos não aparecem automaticamente |
| Limpar os dados do navegador ou encerrar uma sessão anônima | As cópias locais podem ser perdidas |
| Outra pessoa usar o mesmo perfil do navegador | Ela também pode ver os planos guardados ali |

**Baixar arquivo** cria uma cópia do plano. Para recuperá-la, use **Abrir arquivo**; para mantê-la no novo navegador, clique também em **Guardar aqui**.

Se havia planos em `http://localhost:3000`, eles não aparecem automaticamente no site publicado. Baixe cada plano no endereço antigo e abra o arquivo no novo endereço. O mesmo cuidado vale ao trocar de domínio.

O site não cria uma lista de clientes para você. Não coleta nome, telefone ou e-mail, não identifica automaticamente quem voltou e não sincroniza planos entre aparelhos. Esses recursos exigiriam outra etapa de desenvolvimento. O banco do servidor guarda somente o cache dos índices, que pode ser consultado novamente.

## O que significa gratuito aqui

O Render Free suspende o serviço após 15 minutos sem acessos; a próxima abertura pode levar cerca de um minuto. Há limites mensais. Sem forma de pagamento, exceder a franquia pode suspender o serviço ou novas publicações; com pagamento cadastrado, excedentes podem gerar cobrança. Mantenha os recursos em Free e acompanhe **Billing**. O Render apresenta esse plano como adequado a testes e projetos pessoais, não a operação de produção com disponibilidade contínua.

O endereço `onrender.com` fornecido pelo serviço evita comprar um domínio. A preparação dos arquivos não contrata nenhum serviço.

## Se aparecer um erro

| Mensagem | Como resolver |
| --- | --- |
| `Could not read package.json` | Coloque `package.json` na raiz do repositório, junto de `render.yaml` |
| Erro pedindo `PUBLIC_ORIGIN` com HTTPS | Use o `server.mjs` desta versão; remova do Render uma configuração antiga de `PUBLIC_ORIGIN` que aponte para localhost |
| Erro relacionado a `node:sqlite` | Confira a variável `NODE_VERSION`: deve ser `24` |
| Página de carregamento ao abrir o link | No Free, aguarde a inicialização após um período sem visitas |
| Índice temporariamente indisponível | Use o aviso na tela: não trate a estimativa dos meses futuros como índice já publicado |

Para atualizar o site depois, envie os arquivos alterados ao mesmo repositório. No serviço do Render, use **Manual Deploy → Deploy latest commit**. Alterações no código usam publicação manual; alterações no próprio `render.yaml` podem ser sincronizadas automaticamente pelo Blueprint. Os planos do navegador continuam no mesmo endereço, salvo se os dados forem apagados localmente.

## Documentação consultada em 27/09/2026

- [Limites e funcionamento do Render Free](https://render.com/docs/free)
- [Planos de workspace](https://render.com/docs/new-workspace-plans)
- [Criação com Blueprint](https://render.com/docs/infrastructure-as-code)
- [Configuração do render.yaml](https://render.com/docs/blueprint-spec)
- [Endereço público automático do Render](https://render.com/docs/environment-variables)
- [Upload de arquivos no GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
