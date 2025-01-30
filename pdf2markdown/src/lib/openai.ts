import OpenAI from 'openai'
import { z } from 'zod'

const envSchema = z.object({
  OPENAI_API_KEY: z.string(),
})

const { success, data: env, error } = envSchema.safeParse(process.env)
if (!success) {
  console.error('Schema validation failed:', error.format())
  throw new Error('Missing OPENAI env variable')
}

const config = {
  apiKey: env.OPENAI_API_KEY,
}

export const openai = new OpenAI(config)
