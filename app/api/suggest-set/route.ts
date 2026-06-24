import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

type MachineInput = {
  brand?: string | null
  type?: string | null
  model_number?: string | null
  title?: string | null
}

const SYSTEM_INSTRUCTIONS = `Role: You are a product copywriter for an appliance resale inventory system.
Task: Given a list of individual appliances that will be sold together as a set, suggest a compelling set listing.
Output Format: Return ONLY a valid JSON object. Do not include markdown formatting or backticks.
JSON Schema:
title: A professional set product name (e.g., "Whirlpool Front Load Washer & Electric Dryer Set").
description_long: A 3-4 sentence marketing description for the combined set listing.
features: An array of 3-8 strings highlighting set-level selling points (e.g., matching finish, ready to install, energy efficient pair).
Constraint: Do not invent specific model specs beyond what the input machines imply. Focus on the set as a bundle.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const machines = Array.isArray(body?.machines) ? (body.machines as MachineInput[]) : []

    if (machines.length < 2) {
      return Response.json(
        { error: 'Provide at least two machines to suggest set copy.' },
        { status: 400 },
      )
    }

    const machineSummary = machines
      .map((machine, index) => {
        const parts = [
          machine.brand,
          machine.type,
          machine.model_number,
          machine.title,
        ].filter(Boolean)
        return `${index + 1}. ${parts.join(' · ') || 'Unknown appliance'}`
      })
      .join('\n')

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTIONS,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const result = await model.generateContent([
      `Suggest a set listing title, description, and features for these appliances sold together:\n${machineSummary}`,
    ])

    const text = result.response.text().replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(text) as {
      title?: string
      description_long?: string
      features?: unknown
    }

    const features = Array.isArray(parsed.features)
      ? parsed.features
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      : []

    return Response.json({
      title: parsed.title ?? '',
      description_long: parsed.description_long ?? '',
      features,
    })
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      (error as { status?: number }).status === 503
    ) {
      return Response.json(
        { error: 'AI service is temporarily unavailable. Try again shortly.' },
        { status: 503 },
      )
    }

    console.error('[suggest-set]', error)
    return Response.json(
      { error: 'Could not generate set suggestions.' },
      { status: 500 },
    )
  }
}
