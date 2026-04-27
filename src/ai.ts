import { generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const articleSchema = z.object({
   titulo: z.string().min(1),
   resumo: z.string().min(1).max(1000),
   tags: z.array(z.string().min(1)).min(1).max(8)
});

const openai = (model: string, apiKey: string) => createOpenAI({
   apiKey
})(model);

export const generateSummary = async (text: string, apiKey: string) => {
   const result = await generateText({
      model: openai("gpt-5.4-nano", apiKey),
      output: Output.object({ schema: articleSchema }),
      prompt: [
         "Extraia um objeto estruturado do artigo em PDF.",
         "Retorne os campos: titulo, resumo e tags.",
         "Extraia o titulo do artigo",
         "No resumo, mantenha os pontos principais em ate 1000 caracteres.",
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
