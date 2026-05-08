import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTIONS = `Role: You are a Technical Data Extractor for an appliance inventory system.
Task: Analyze the image of the appliance model tag. Use the model number and your knowledge to look up and extract full technical specifications for that appliance model.
Output Format: Return ONLY a valid JSON object. Do not include markdown formatting or backticks.
JSON Schema:
title: A professional product name (e.g., "GE 7.2 cu. ft. Aluminized Alloy Drum Electric Dryer").
brand: The manufacturer name.
model_number: The exact alphanumeric identifier from the tag.
type: The category (e.g., "Washer", "Dryer", "Refrigerator").
configuration: The layout (e.g., "Front Load", "Top Load", "Side-by-Side").
fuel: The power source (e.g., "Electric", "Gas", or null).
capacity: Number only. The volume in cubic feet (e.g., 4.5). Do not include units.
color: The finish or color (e.g., "Stainless Steel", "White", "Black"). Set to null if not determinable.
manufacture_year: The 4-digit manufacture year. Set to null if not determinable.
dimensions: A JSON object containing depth_in, width_in, height_in (numbers or null), and unit_of_measure set to "inches".
features: An array of strings listing key features (e.g., ["Steam Sanitize", "Inverter Motor"]).
description_long: A 3-4 sentence professional marketing summary of the unit.
Constraint: Set any unknown field to null.`;

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType } = await req.json();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTIONS,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent([
      "Read the model number from this appliance tag, then use your knowledge to return the full technical specifications for that exact model.",
      { inlineData: { data: image, mimeType } },
    ]);

    const text = result.response.text().replace(/```json|```/g, "").trim();
    return Response.json(JSON.parse(text));

  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 503
    ) {
      return Response.json(
        { error: "Servers are busy, try again in 10 seconds" },
        { status: 503 }
      );
    }

    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Unknown error";

    return Response.json({ error: message }, { status: 500 });
  }
}