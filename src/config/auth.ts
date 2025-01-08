import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  GITHUB_CALLBACK_URL: z
    .string()
    .default('http://localhost:3000/api/auth/github/callback'),
  GITHUB_ORG_NAME: z.string().default('Klimatbyran'),
  JWT_SECRET: z.string().default('your-secret-key'),
  SESSION_SECRET: z.string().default('session-secret'),
})

const env = envSchema.parse(process.env)

export default {
  github: {
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL,
    organization: env.GITHUB_ORG_NAME,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: '24h',
  },
  session: {
    secret: env.SESSION_SECRET,
  },
}
