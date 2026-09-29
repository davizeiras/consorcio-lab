@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js 24 LTS em https://nodejs.org/ e abra este arquivo novamente.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) === 24 ? 0 : 1)"
if errorlevel 1 (
  echo Este projeto usa Node.js 24 LTS. Atualize o Node antes de continuar.
  pause
  exit /b 1
)
if not exist "server.mjs" (
  echo Extraia o ZIP inteiro. Mantenha este arquivo junto de server.mjs.
  pause
  exit /b 1
)
echo Iniciando o Consorcio Lab...
echo Abra no navegador o endereco que o servidor mostrar.
echo Mantenha esta janela aberta enquanto usar o simulador.
node --env-file-if-exists=.env server.mjs
pause
