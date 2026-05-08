'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_INSTRUCTIONS = `Role: You are a Technical Data Extractor for an appliance inventory system.
Task: Analyze the image of the appliance model tag. Use the model number and visual cues to extract technical specifications.
Output Format: Return ONLY a valid JSON object. Do not include markdown formatting or backticks.
JSON Schema:
title: A professional product name (e.g., "GE 7.2 cu. ft. Aluminized Alloy Drum Electric Dryer").
brand: The manufacturer name.
model_number: The exact alphanumeric identifier from the tag.
type: The category (e.g., "Washer", "Dryer", "Refrigerator").
configuration: The layout (e.g., "Front Load", "Top Load", "Side-by-Side").
fuel: The power source (e.g., "Electric", "Gas", or null).
capacity: Number only. The volume in cubic feet (e.g., 4.5). Do not include "cu. ft." or any units.
color: The finish or color of the appliance (e.g., "Stainless Steel", "White", "Black"). Set to null if not determinable.
manufacture_year: The 4-digit year the unit was manufactured (e.g., 2019). Set to null if not determinable.
dimensions: A JSON object containing:
  depth_in: Number (or null)
  width_in: Number (or null)
  height_in: Number (or null)
  unit_of_measure: "inches"
features: An array of strings listing technical features or specs (e.g., ["Steam Sanitize", "Inverter Motor"]).
description_long: A 3-4 sentence professional marketing summary of the unit's key technologies and design.
Constraint: If a specific dimension, color, manufacture_year, or the capacity cannot be determined, set it to null.`

export interface ApplianceData {
  title: string
  brand: string
  model_number: string
  type: string
  configuration: string
  fuel: string | null
  capacity: number | null
  color: string | null
  manufacture_year: number | null
  dimensions: {
    depth_in: number | null
    width_in: number | null
    height_in: number | null
    unit_of_measure: string
  }
  features: string[]
  description_long: string
}

export async function extractApplianceData(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ data: ApplianceData | null; error: string | null }> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTIONS,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    })

    const result = await model.generateContent([
      'Extract the appliance specifications from this tag image.',
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ])

    const text = result.response.text()

    // Strip any accidental markdown fences just in case
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed: ApplianceData = JSON.parse(clean)

    return { data: parsed, error: null }
  } catch (err) {
    console.error('Gemini extraction error:', err)
    return {
      data: null,
      error:
        err instanceof Error
          ? err.message
          : 'Failed to extract data from image. Please fill in the fields manually.',
    }
  }
}
