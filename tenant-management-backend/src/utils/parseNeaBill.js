/**
 * src/utils/parseNeaBill.js
 *
 * Extract structured data from NEA electricity bill PDF using Gemini AI.
 * Clean, stable, production-safe version.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Gemini Setup ─────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use stable model (DO NOT use -latest in this SDK)
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
});

// ─── Prompt ───────────────────────────────────────────────────
const PROMPT = `
You are an expert system for extracting structured data from Nepal Electricity Authority (NEA) electricity bills.

Return ONLY valid JSON. No explanations. No markdown.

Schema:
{
  "totalAmount": number | null,
  "energyCharge": number | null,
  "demandCharge": number | null,
  "totalUnits": number | null,
  "consumedUnits": number | null,
  "nepaliMonth": number | null,
  "nepaliYear": number | null,
  "billNo": string | null,
  "consumerName": string | null,
  "meterNo": string | null,
  "category": string | null,
  "billableDemand": number | null,
  "recordedDemand": number | null,
  "presentReading": number | null,
  "previousReading": number | null
}

Rules:
- Return ONLY JSON
- Use null if field is missing
- Remove commas from numbers
- Keep values clean and accurate
`;

// ─── Helper: safe JSON parse ───────────────────────────────────
function safeParse(text) {
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Failed to parse Gemini response:", text);
    throw new Error("Invalid JSON returned from Gemini");
  }
}

// ─── Main Function ─────────────────────────────────────────────
export async function parseNeaBill(buffer) {
  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: "application/pdf",
        },
      },
      PROMPT,
    ]);

    const text = result.response.text();

    return safeParse(text);
  } catch (err) {
    console.error("[NEA parse error]", err);

    return {
      error: true,
      message: err.message,
    };
  }
}