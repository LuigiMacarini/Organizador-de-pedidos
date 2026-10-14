# Scripts de coleta e análise do TCC

Ferramentas usadas para validar o coletor, medir a sobrecarga e analisar as sessões. O contexto e os resultados estão em [../metricas-desempenho-tcc.md](../metricas-desempenho-tcc.md).

Nada aqui faz parte do app: os scripts rodam no PC e não entram na build.

## Pré-requisitos (uma vez só)

| O quê | Onde | Para quê |
|---|---|---|
| Node 22 ou mais novo | no PC | todos os `.js` |
| Android SDK (adb) | `%LOCALAPPDATA%\Android\Sdk` (seção 4.5 da doc) | scripts de `adb/` e `bancada/` |
| Git Bash | vem com o Git | scripts `.sh` |
| Token do Sentry, **só de leitura** | `C:\dev\sentry-token.txt` (**nunca** no repositório) | scripts de `sentry/` |
| Bibliotecas das planilhas | `C:\dev\tcc-ferramentas` (veja abaixo) | scripts de `planilhas/` |

As bibliotecas das planilhas ficam fora do app, para não mexer nas dependências do projeto:

```powershell
mkdir C:\dev\tcc-ferramentas; cd C:\dev\tcc-ferramentas
npm init -y; npm install exceljs@4 hyperformula@2
```

Antes de rodar um script de `planilhas/`, aponte o Node para elas:

```powershell
$env:NODE_PATH = "C:\dev\tcc-ferramentas\node_modules"
```

Arquivos de trabalho (leituras de tela, logs, exportações de teste) ficam em `C:\dev\tcc-ferramentas`. No repositório, entram só os resultados finais, em `../dados/`.

## O que tem em cada pasta

| Pasta | Script | Faz |
|---|---|---|
| `sentry/` | `listar-execucoes.js [período]` | Lista as execuções recentes (`run_id`): horário, nº de leituras de CPU e telas visitadas |
| | `exportar-execucao.js <run_id> <período> <saída.json> [início] [fim]` | Baixa todas as métricas `perf.*` de uma execução, com recorte opcional por horário |
| | `checar-cadencia.js` | Confere se a execução Android mais recente está mandando leituras a cada 15 s |
| `planilhas/` | `gerar-planilha-sessao.js <entrada.json> <saída.xlsx> "<descrição>"` | Planilha de uma sessão: resumo por tela, uma linha por leitura e dados brutos, tudo com fórmulas conferidas |
| | `gerar-planilha-ab.js <saída.xlsx>` | Planilha do teste de sobrecarga A/B, a partir de `../dados/teste-sobrecarga-ab-brutos/` |
| | `conferir-p.js <planilha-ab.xlsx>` | Confere o p da planilha A/B por integração numérica, sem a função beta |
| `adb/` | `dump.sh [filtro]` | Lista os botões e textos da tela atual do celular, com as coordenadas |
| | `roteiro.sh` | Roteiro de conferência automático (seção 4.9 da doc) |
| | `acha.js`, `ui.js` | Usados pelos dois scripts acima |
| `bancada/` | `build-apk.ps1` | Build local B (com o coletor) a partir de `C:\dev\org`, já instala no celular |
| | `build-apk-A.ps1` | Build local A (sem DSN, sem medição) para o teste de sobrecarga |
| | `rodadas-ab.ps1` | Rodadas do teste A/B, medidas de fora do app pelo adb (seção 4.7) |
| | `vigia-adb.ps1` | Reinicia o servidor do adb quando ele perde o celular durante as rodadas |
| | `analisar-ab.js [pasta]` | Resultado do A/B direto no terminal, sem planilha |
| | `validar-adb.ps1` + `analisar-validacao.js` | Validação do coletor contra o Android (seção 4.6) |
| | `dryrun-sentry.ps1` | Testa a configuração do plugin Gradle do Sentry sem compilar (seção 2.4) |

## Depois de cada sessão oficial

O Sentry apaga os dados em 30 dias, então exporte no mesmo dia.

```powershell
$S = "C:\Users\Luigi\OneDrive\Área de Trabalho\Projeto Org Produtos\pedidos-lancamento-app\claude\documentacao\scripts"

# 1. Achar a execução pelo horário (as amostras levam 1–2 min para aparecer)
node "$S\sentry\listar-execucoes.js" 3h

# 2. Exportar recortando pelos horários anotados no protocolo
node "$S\sentry\exportar-execucao.js" <run_id> 24h C:\dev\tcc-ferramentas\sessoes\<run_id>.json 2026-10-20T14:03:00-03:00 2026-10-20T14:13:00-03:00

# 3. Gerar a planilha da sessão e salvá-la em dados/
$env:NODE_PATH = "C:\dev\tcc-ferramentas\node_modules"
node "$S\planilhas\gerar-planilha-sessao.js" C:\dev\tcc-ferramentas\sessoes\<run_id>.json "$S\..\dados\sessao-android-1.xlsx" "sessão 1, Android, rota X"
```

Guarde também o `.json` exportado. Ele é o dado bruto da sessão. A planilha tem uma cópia dele na aba "Dados brutos".

## Cuidados

- **`roteiro.sh` mexe em dados reais.** Ele cria um pedido e uma rota para o cliente "Teste Tcc" e depois cancela a rota e arquiva o pedido.
  - Se um botão importante não aparece, ele fecha o app e para, sem salvar nada pendente.
  - Ele não pode rodar durante sessões oficiais. Ninguém deve tocar no celular enquanto ele roda.
  - A correção do passo de arquivamento (o primeiro toque na lista só fecha o teclado) foi feita depois da execução de 13/10 e ainda não foi testada.
- **`dump.sh` e `roteiro.sh` fazem o app trabalhar um pouco** a cada leitura de tela. Não use durante medições.
- **`build-apk-A.ps1` tira o DSN do `.env` da cópia `C:\dev\org`** e o restaura no fim. O backup com segredos vai para a pasta temporária do Windows, fora de qualquer repositório.
- **Scripts `.sh` desligam a conversão de caminhos do Git Bash** (`MSYS_NO_PATHCONV=1`), para não estragar caminhos do celular como `/sdcard`. Por isso, caminhos passados ao Node precisam estar no formato `C:/...` (`pwd -W`).
