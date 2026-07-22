import { z } from "zod";

export const revisionItemCandidateProviderSchema = z.object({
  memoryCue: z.string().min(1).max(240),
}).strict();

export type RevisionItemCandidateProviderOutput = z.infer<typeof revisionItemCandidateProviderSchema>;

export const revisionItemCandidateProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    memoryCue: { type: "string", minLength: 1, maxLength: 240 },
  },
  required: ["memoryCue"],
} as const;
