import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  EmissionsSchema,
  EconomySchema,
  ErrorSchema as ErrorSchemaBase,
  CompanyInputSchema as CompanyInputSchemaBase,
  Scope1Schema,
  Scope2Schema,
  Scope3Schema,
  BiogenicSchema,
  StatedTotalEmissionsSchema,
  TurnoverSchema,
  EmployeesSchema,
  GoalSchema,
  InitiativeSchema,
  IndustrySchema
} from './schemas'

export const registry = new OpenAPIRegistry()

// Auth schemas
const AuthResponseSchema = z.object({
  token: z.string().describe('JWT token for API authentication')
})

registry.registerPath({
  method: 'get',
  path: '/auth/github',
  description: 'Initiates GitHub OAuth flow',
  tags: ['Authentication'],
  responses: {
    302: {
      description: 'Redirects to GitHub OAuth page',
      headers: {
        Location: {
          description: 'GitHub OAuth authorization URL',
          schema: { type: 'string' }
        }
      }
    }
  },
  security: [] // Explicitly mark as not requiring authentication
})

registry.registerPath({
  method: 'get',
  path: '/auth/github/callback',
  description: 'GitHub OAuth callback endpoint',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Successfully authenticated',
      content: {
        'application/json': {
          schema: AuthResponseSchema
        }
      }
    },
    401: {
      description: 'Authentication failed',
      content: {
        'application/json': {
          schema: ErrorSchemaBase
        }
      }
    }
  }
})

// Register all schemas
export const ErrorSchema = registry.register('Error', ErrorSchemaBase)
export const CompanyInputSchema = registry.register('CompanyInput', CompanyInputSchemaBase)
export const CompanySchema = registry.register('Company', CompanyInputSchemaBase.extend({}))

// Register emissions schemas
export const Scope1 = registry.register('Scope1', Scope1Schema)
export const Scope2 = registry.register('Scope2', Scope2Schema)
export const Scope3 = registry.register('Scope3', Scope3Schema)
export const Biogenic = registry.register('Biogenic', BiogenicSchema)
export const StatedTotalEmissions = registry.register('StatedTotalEmissions', StatedTotalEmissionsSchema)
export const Emissions = registry.register('Emissions', EmissionsSchema)

// Register economy schemas
export const Turnover = registry.register('Turnover', TurnoverSchema)
export const Employees = registry.register('Employees', EmployeesSchema)
export const Economy = registry.register('Economy', EconomySchema)
export const Goal = registry.register('Goal', GoalSchema)
export const Initiative = registry.register('Initiative', InitiativeSchema)
export const Industry = registry.register('Industry', IndustrySchema)
