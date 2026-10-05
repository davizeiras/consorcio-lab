# Ativar contas do Iran Solutions

Implementação preparada; não ativar AUTH_MODE=required antes de concluir esta lista.
O site continua público até a configuração explícita. O e-mail do administrador já foi escolhido pelo proprietário; o UUID será vinculado após a confirmação da conta.

1. Selecionar com Davi um projeto Supabase exclusivo, mantendo a opção gratuita se disponível. Não reutilizar o projeto antigo pausado sem autorização.
2. Aplicar `docs/ACESSO.sql` por migration. Executar os advisors de segurança e confirmar as políticas RLS com sessões de administrador, usuário comum e usuário bloqueado. Migration aplicada no projeto dedicado. Testes transacionais no banco confirmaram isolamento de contas, impossibilidade de autoaprovação, administração, bloqueio e invalidação de sessão, com rollback dos dados de teste.
3. Manter confirmação de e-mail obrigatória. Configurar Site URL e redirect permitido `https://consorcio-lab.onrender.com/login`. Para clientes externos, configurar SMTP próprio antes de abrir cadastros: o envio padrão do Supabase é restrito. Testar entrega e confirmação reais.
4. Criar a conta de Davi pela própria tela; ele escolhe a senha, sem enviá-la pelo chat. Conferir o e-mail confirmado no Auth e inserir apenas seu UUID em `iran_private.administrators`. Ninguém vira administrador por ser o primeiro cadastrado, por informar um e-mail na tela ou por editar metadados.
5. Configurar no Render `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (chave pública; não usar service_role). Configurar `AUTH_MODE=required`, `PUBLIC_ORIGIN=https://consorcio-lab.onrender.com` e `NODE_ENV=production`. Credenciais ausentes impedem a inicialização em modo obrigatório; não há retorno automático ao modo público.
6. Manter build `npm test` (pretest instala o lockfile com `npm ci --ignore-scripts`), health check `/health`, executar deploy manual e conferir login, logout, contas pendentes, aprovação e bloqueio no site.

## Comportamento

- Cadastros começam pendentes. Só o administrador libera ou bloqueia.
- Sessões em cookies HttpOnly/Secure/SameSite=Strict, sem tokens no localStorage. O provedor cuida de senha e renovação.
- HTML, módulos do simulador, API de cálculo e administração são protegidos no servidor. O banco valida a sessão e as permissões com RLS; bloqueios são lidos em cada requisição. Uma aba aberta verifica o acesso também a cada 30 segundos e ao recuperar foco.
- Logout revoga a sessão no provedor e apaga cookies. A consulta RLS verifica auth.sessions para impedir reutilização do token daquela sessão.
- Administrador não vê senhas. Não há botão para promover outros administradores ou excluir contas permanentemente.
- Planos continuam neste navegador, separados por ID da conta. Dados antigos são preservados no espaço anterior; não são atribuídos automaticamente ao primeiro usuário. Importação de arquivos continua disponível.
- Troca/recuperação de senha não foi incluída nesta etapa. Planejar fluxo verificado antes do uso amplo; nunca entregar ou pedir senhas pelo chat.

## Verificação local

`npm test`: 56 testes, incluindo barreiras HTTP, CSRF, bloqueio de sessão aberta, proteção administrativa, cookies e cálculos anteriores.
Os testes de autenticação usam um provedor simulado: não substituem o teste de Supabase, RLS e e-mail reais antes da ativação.
