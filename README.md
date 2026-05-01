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
