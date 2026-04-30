import { generateText, Output } from "ai";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from "zod";

const articleSchema = z.object({
   titulo: z.string().min(1),
   resumo: z.string().min(1).max(2000),
   tags: z.array(z.string().min(1)).min(1).max(8)
});

const openrouter = (model: string, apiKey: string) => createOpenRouter({
   apiKey
}).chat(model);

export const generateSummary = async (text: string, { model, apiKey }: { model: string; apiKey: string }) => {
   const result = await generateText({
      model: openrouter(model, apiKey),
      output: Output.object({ schema: articleSchema }),
      prompt: [
         "Extraia um objeto estruturado do artigo em PDF.",
         "Retorne os campos: titulo, resumo e tags.",
         "Extraia o titulo do artigo",
         "Gere um resumo no formato markdown",
         "As tags devem ser relevantes e em portugues.",
         "Conteudo:",
         text
      ].join("\n")
   });

   const normalizedTags = Array.from(
      new Set(result.output.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))
   );

   return {
      titulo: result.output.titulo.trim(),
      resumo: result.output.resumo.trim(),
      tags: normalizedTags
   };
};
