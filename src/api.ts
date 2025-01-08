import express from 'express'
import pino from 'pino-http'
import swaggerJsdoc from 'swagger-jsdoc'
import { apiReference } from '@scalar/express-api-reference'
import readCompanies from './routes/companies/company.read'
import updateCompanies from './routes/companies/company.update'
import { errorHandler } from './routes/middlewares'
import { swaggerOptions } from './swagger'
import auth from './routes/auth'

const apiRouter = express.Router()
const pinoConfig = process.stdin.isTTY && {
  transport: {
    target: 'pino-pretty',
  },
  level: 'info',
}
apiRouter.use(pino(pinoConfig || undefined))

// API Routes
// Generate OpenAPI spec
const openApiSpec = swaggerJsdoc(swaggerOptions)

apiRouter.use('/auth', auth)

// API Routes
apiRouter.use('/companies', readCompanies)
apiRouter.use('/companies', updateCompanies)

// API Documentation
apiRouter.get('/openapi.json', (req, res) => {
  res.json(openApiSpec)
})

apiRouter.use(
  '/',
  apiReference({
    spec: {
      url: '/api/openapi.json',
    },
  })
)

// TODO: Why does this error handler not capture errors thrown in readCompanies?
apiRouter.use(errorHandler)

export default apiRouter
