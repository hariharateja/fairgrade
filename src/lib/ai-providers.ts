import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ApiError, FinishReason, GoogleGenAI, type Part as GeminiPart } from "@google/genai";
import { z } from "zod";

/**
 * Model providers behind the grading agent. Both take the same provider-neutral prompt
 * (system text + parts) and return output validated against the same Zod schema, so the
 * grading logic in ai.ts doesn't care which model runs.
 *
 * Selection (first match wins):
 *   FAIRGRADE_AI_MODE=demo          -> simulated suggestions
 *   AI_PROVIDER=claude | gemini     -> that provider
 *   ANTHROPIC_API_KEY set           -> Claude
 *   GEMINI_API_KEY set              -> Gemini
 *   otherwise                       -> demo
 */

export type Provider = "claude" | "gemini";
export type AiMode = Provider | "demo";

export const PROVIDER_LABEL: Record<string, string> = { claude: "Claude", gemini: "Gemini", demo: "Demo" };

const CLAUDE_MODEL = "claude-opus-5-5";
const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

export function aiMode(): AiMode {
  const forced = process.env.FAIRGRADE_AI_MODE;
  if (forced === "demo") return "demo";
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === "claude" || provider === "anthropic") return "claude";
  if (provider === "gemini") return "gemini";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "live") return "claude";
  return "demo";
}

export class AiError extends Error {}

export type PromptPart =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }
  | { kind: "pdf"; data: string };

export type StructuredRequest<T extends z.ZodType> = {
  schema: T;
  system: string;
  parts: PromptPart[];
};

export async function callStructured<T extends z.ZodType>(provider: Provider, req: StructuredRequest<T>): Promise<z.infer<T>> {
  return provider === "gemini" ? callGemini(req) : callClaude(req);
}

// ---------------------------------------------------------------------------
// Claude

let anthropicClient: Anthropic | null = null;

async function callClaude<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  anthropicClient ??= new Anthropic();
  const content: Anthropic.Beta.BetaContentBlockParam[] = req.parts.map((p) => {
    if (p.kind === "text") return { type: "text", text: p.text };
    if (p.kind === "pdf") return { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } };
    return { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } };
  });
  try {
    const response = await anthropicClient.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(req.schema) },
      system: req.system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") {
      throw new AiError("The AI declined to assess this submission. Please resolve it manually.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      throw new AiError("The AI response was incomplete. Please try again.");
    }
    return response.parsed_output as z.infer<T>;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiError("The Anthropic API key is invalid. Check ANTHROPIC_API_KEY in .env.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError("Claude is rate limited right now. Try again in a minute.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError(`Claude request failed (${error.status ?? "network"}): ${error.message}`);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Gemini

let geminiClient: GoogleGenAI | null = null;

/** Zod -> JSON Schema, minus the "$schema" header Gemini's schema subset doesn't accept. */
function geminiSchema(schema: z.ZodType) {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

async function callGemini<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError("GEMINI_API_KEY is not set in .env.");
  // The SDK otherwise retries up to 5 times with up to 60s backoff, which looks like a hang in the UI.
  geminiClient ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: 120_000, retryOptions: { attempts: 2 } } });

  const parts: GeminiPart[] = req.parts.map((p) => {
    if (p.kind === "text") return { text: p.text };
    return { inlineData: { mimeType: p.kind === "pdf" ? "application/pdf" : p.mediaType, data: p.data } };
  });

  let text: string | undefined;
  try {
    const response = await geminiClient.models.generateContent({
      model: process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: geminiSchema(req.schema),
        maxOutputTokens: 16000,
      },
    });
    const finish = response.candidates?.[0]?.finishReason;
    if (response.promptFeedback?.blockReason || finish === FinishReason.SAFETY) {
      throw new AiError("The AI declined to assess this submission. Please resolve it manually.");
    }
    if (finish === FinishReason.MAX_TOKENS) {
      throw new AiError("The AI response was incomplete. Please try again.");
    }
    text = response.text;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403 || (error.status === 400 && /api key/i.test(error.message))) {
        throw new AiError("The Gemini API key is invalid. Check GEMINI_API_KEY in .env.");
      }
      if (error.status === 429) {
        throw new AiError("Gemini rate limit or free-tier quota reached. Wait a minute and try again.");
      }
      if (error.status === 504 || error.status === 503) {
        throw new AiError("Gemini is overloaded or timed out. Try again, or set GEMINI_MODEL to another model.");
      }
      if (error.status === 404) {
        throw new AiError(`Gemini model "${process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL}" was not found. Check GEMINI_MODEL in .env.`);
      }
      throw new AiError(`Gemini request failed (${error.status}): ${error.message}`);
    }
    throw error;
  }

  if (!text) throw new AiError("The AI returned an empty response. Please try again.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("The AI returned malformed output. Please try again.");
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) throw new AiError("The AI response didn't match the expected format. Please try again.");
  return parsed.data as z.infer<T>;
}
