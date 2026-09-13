## Summary Worker

Este projeto roda em Cloudflare Workers e gera resumos de artigos científicos com IA.
Ele usa um mecanismo de filas e jobs para processar os PDFs de forma assíncrona, atualizar o status das tarefas e salvar os resultados no D1.

## Configuração do ambiente de desenvolvimento
1. Instale as dependências:
   ```bash
   bun install
   ```
2. Configure as variáveis de ambiente no arquivo `.dev.vars`:
   ```
   API_SECRET_KEY=your_api_secret_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_MODEL=your_openrouter_model
   ```
3. Inicie o ambiente de desenvolvimento:
   ```bash
   bun run dev
   ```

## API

A API está disponível sob o prefixo `/api/v1`. Todos os endpoints exigem autenticação Bearer com o valor configurado em `API_SECRET_KEY`:

```http
Authorization: Bearer <API_SECRET_KEY>
```

As solicitações de criação recebem a URL de um PDF, criam um item na fila e retornam imediatamente. Consulte o recurso posteriormente até que seu `status` seja `completed` ou `failed`.

### `GET /api/v1/summaries`

Lista todos os resumos, ordenados pela data de criação.

```bash
curl http://localhost:8787/api/v1/summaries \
  -H "Authorization: Bearer $API_SECRET_KEY"
```

Resposta `200 OK`:

```json
[
  {
    "id": "c0a8012e-1234-4567-8901-abcdef123456",
    "url": "https://example.org/artigo.pdf",
    "status": "completed",
    "summary": {
      "title": "Título do artigo",
      "summary": "Resumo gerado pela IA.",
      "tags": ["ciência", "pesquisa"]
    },
    "updatedAt": "2026-09-13T12:00:00.000Z",
    "createdAt": "2026-09-13T11:59:00.000Z"
  }
]
```

Enquanto o processamento não termina, `summary` é `null`.

### `GET /api/v1/summaries/:id`

Obtém o estado e, quando disponível, o resumo de um artigo específico.

```bash
curl http://localhost:8787/api/v1/summaries/<id> \
  -H "Authorization: Bearer $API_SECRET_KEY"
```

Retorna `200 OK` com o mesmo formato de um item da listagem. Caso o identificador não exista, retorna `404 Not Found`:

```json
{ "error": "Summary not found" }
```

### `POST /api/v1/summaries`

Enfileira a geração de resumo para uma URL de PDF.

```bash
curl -X POST http://localhost:8787/api/v1/summaries \
  -H "Authorization: Bearer $API_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.org/artigo.pdf"}'
```

Corpo da requisição:

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `url` | string | Sim | URL válida do PDF a ser processado. |

Resposta `201 Created`:

```json
{
  "id": "c0a8012e-1234-4567-8901-abcdef123456",
  "url": "https://example.org/artigo.pdf",
  "status": "pending",
  "created_at": "2026-09-13 11:59:00"
}
```

A URL é única. Se ela já tiver sido enviada, o endpoint retorna o item existente com `200 OK`. Uma URL inválida é rejeitada pela validação da requisição.

### `POST /api/v1/summaries/:id/retry`

Reenfileira um item cujo processamento tenha falhado.

```bash
curl -X POST http://localhost:8787/api/v1/summaries/<id>/retry \
  -H "Authorization: Bearer $API_SECRET_KEY"
```

Retorna `200 OK` com o item reenfileirado e `status` igual a `pending`. Possíveis erros:

| Status | Resposta |
| --- | --- |
| `404 Not Found` | `{ "error": "Queue item not found" }` |
| `400 Bad Request` | `{ "error": "Only failed items can be retried" }` |

### Estados de processamento

| Estado | Descrição |
| --- | --- |
| `pending` | A solicitação aguarda processamento na fila. |
| `processing` | O PDF está sendo baixado, lido e resumido. |
| `completed` | O resumo foi gerado e está disponível em `summary`. |
| `failed` | O processamento falhou; use o endpoint de retry para tentar novamente. |
