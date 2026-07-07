# Extrator de Agendamentos

API REST e conjunto de scripts para **extração, processamento e atualização de datas de retorno de pacientes**, integrando Oracle Database com IA Google Gemini.

---

## Visão Geral

O sistema busca documentos clínicos no Oracle, analisa os campos de retorno ambulatorial e observações de texto livre usando o modelo **Gemini 3.5 Flash**, seleciona a data de retorno mais adequada por uma abordagem híbrida (código + IA), e grava o resultado de volta no banco.

### Arquitetura

O projeto segue os princípios de **Clean Architecture**, organizado nas seguintes camadas:

```
src/
├── domain/          # Interfaces e entidades — núcleo sem dependências externas
├── infrastructure/  # Implementações concretas (Oracle Repository, Gemini Gateway)
├── application/     # Use Cases — regras de negócio e orquestração
├── api/             # Camada HTTP (Fastify): server, plugins, routes, controllers
├── config/          # Configuração do pool Oracle
└── (scripts CLI)    # index.ts, showDates.ts, utils/testAllDates.ts
```

---

## Pré-requisitos

- Node.js 18+
- Oracle Instant Client (para Thick Mode) — ou conexão direta via Thin Mode
- Conta Google com acesso à Gemini API

---

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/LuisFacunde/extrator-agendamentos.git
cd extrator-agendamentos
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente copiando o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# === Banco de Dados Oracle ===
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_HOST=seu_host
DB_PORT=1521
DB_SERVICE=seu_servico
ORACLE_CLIENT_PATH=C:\oracle\instantclient\instantclient_23_0

# === Google Gemini ===
GEMINI_API_KEY=sua_chave_api_gemini

# === API (opcional) ===
PORT=3000
HOST=0.0.0.0
```

---

## Modo de Uso

### 1. API REST (Fastify)

Inicia o servidor HTTP na porta configurada (padrão: `3000`).

```bash
# Desenvolvimento (watch mode — reinicia ao salvar)
npm run api

# Produção
npm run api:prod
```

Saída esperada no startup:

```
[Oracle Plugin] Inicializando pool de conexões...
Connection pool criado com sucesso.
[Oracle Plugin] Pool Oracle inicializado com sucesso.
Server listening at http://0.0.0.0:3000
```

---

### 2. Scripts de Linha de Comando (CLI)

| Script                 | Comando              | Descrição                                        |
| ---------------------- | -------------------- | ------------------------------------------------ |
| Processamento completo | `npm run dev`        | Busca pacientes → Gemini → salva no Oracle       |
| Visualizar dados       | `npm run show-dates` | Lista dados de retorno brutos do Oracle          |
| Teste comparativo      | `npm run test-dates` | Exibe todas as fontes e o resultado por paciente |

---

## API — Endpoints

### Base URL

```
http://localhost:3000
```

---

### `GET /health`

Verifica se o servidor está no ar.

**Resposta `200`:**

```json
{
   "status": "ok",
   "version": "1.0.0",
   "time": "2025-06-17T13:00:00.000Z"
}
```

---

### `GET /api/retornos`

Lista pacientes com seus dados de retorno atuais do Oracle.  
Não aciona a IA — apenas consulta o estado atual da tabela.

**Query Params:**

| Parâmetro | Tipo     | Obrigatório | Padrão | Descrição                               |
| --------- | -------- | ----------- | ------ | --------------------------------------- |
| `limit`   | `number` | Não         | `100`  | Máximo de pacientes retornados (1–1000) |

**Exemplo de requisição:**

```bash
curl "http://localhost:3000/api/retornos?limit=50"
```

**Resposta `200`:**

```json
{
   "success": true,
   "data": {
      "total": 50,
      "limit": 50,
      "pacientes": [
         {
            "prontuario": 123456,
            "paciente": "JOSE DA SILVA",
            "dataCriacao": "17/06/2025",
            "dtRetornoCalc": "15/09/2025",
            "observacao": "Retorno em 3 meses para reavaliação",
            "ambEspecializado1": "CARDIOLOGIA",
            "ambDtRetorno1": "2025/09",
            "ambEspecializado2": null,
            "ambDtRetorno2": null,
            "ambEspecializado3": null,
            "ambDtRetorno3": null,
            "mcData": null,
            "mcSetor": null
         }
      ]
   }
}
```

---

### `POST /api/retornos/processar`

Executa o **fluxo completo de ponta a ponta**:

1. Busca pacientes no Oracle
2. Analisa observações clínicas via Gemini 3.5 Flash (IA)
3. Seleciona a melhor data de retorno (código + IA)
4. Atualiza `dt_retorno_calc` no Oracle para cada paciente

> ⚠️ Esta rota aciona a API do Gemini e realiza writes no banco. Use com atenção.

**Body (JSON):**

| Campo   | Tipo     | Obrigatório | Descrição                                |
| ------- | -------- | ----------- | ---------------------------------------- |
| `limit` | `number` | Sim         | Número de pacientes a processar (1–1000) |

**Exemplo de requisição:**

```bash
curl -X POST http://localhost:3000/api/retornos/processar \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

**Resposta `200`:**

```json
{
   "success": true,
   "data": {
      "totalProcessados": 100,
      "totalComRetorno": 78,
      "totalSemRetorno": 22,
      "totalAtualizados": 75,
      "resultados": [
         {
            "prontuario": 123456,
            "nome": "JOSE DA SILVA",
            "dataRetorno": "15/09/2025",
            "ambulatorio": "CARDIOLOGIA",
            "marcacaoComplementar": false,
            "fonte": "Ambulatório 1",
            "motivo": null
         },
         {
            "prontuario": 654321,
            "nome": "MARIA OLIVEIRA",
            "dataRetorno": "20/08/2025",
            "ambulatorio": null,
            "marcacaoComplementar": false,
            "fonte": "Observação (IA)",
            "motivo": "Texto 'retorno em 2 meses' somado à data de criação 20/06/2025"
         }
      ]
   }
}
```

**Resposta `400` (parâmetro inválido):**

```json
{
   "success": false,
   "error": "O campo `limit` no body deve ser um número entre 1 e 1000."
}
```

**Resposta `500` (erro de banco ou IA):**

```json
{
   "success": false,
   "error": "Erro ao processar retornos: ORA-12541: TNS: no listener"
}
```

---

## Lógica de Seleção de Data (Abordagem Híbrida)

Para cada paciente, o sistema coleta candidatos de data em ordem de prioridade:

1. **Marcação Complementar (MC)** — `mc_data` + `mc_setor` — dado estruturado
2. **Ambulatório 1, 2, 3** — `amb_dt_retorno_*` — formato `YYYY/MM`
3. **Observação clínica (IA)** — texto livre analisado pelo Gemini

Regra de seleção: **a data futura mais próxima do dia atual** entre todos os candidatos é escolhida como `dt_retorno_calc`.

---

## Stack Técnica

| Tecnologia           | Uso                                             |
| -------------------- | ----------------------------------------------- |
| Node.js + TypeScript | Runtime e linguagem principal                   |
| Fastify 5            | Framework HTTP da API REST                      |
| oracledb             | Driver oficial Oracle Database                  |
| @google/genai        | SDK Google Gemini (IA)                          |
| fastify-plugin       | Gerenciamento de plugins Fastify                |
| @fastify/sensible    | Helpers de erros HTTP padronizados              |
| pino-pretty          | Formatação de logs em desenvolvimento           |
| dotenv               | Carregamento de variáveis de ambiente           |
| tsx                  | Execução TypeScript sem build (desenvolvimento) |
