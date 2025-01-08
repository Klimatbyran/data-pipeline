import { NextFunction, Request, Response } from 'express'
import {
  Company,
  Economy,
  Emissions,
  Metadata,
  PrismaClient,
  ReportingPeriod,
  User,
} from '@prisma/client'
import { validateRequest, validateRequestBody } from './zod-middleware'
import { z, ZodError } from 'zod'
import cors, { CorsOptionsDelegate } from 'cors'

import {
  upsertEconomy,
  upsertEmissions,
  upsertReportingPeriod,
} from '../lib/prisma'
import { GarboAPIError } from '../lib/garbo-api-error'
import apiConfig from '../config/api'

declare global {
  namespace Express {
    interface Locals {
      user: User
      company: Company
      reportingPeriod: ReportingPeriod
      metadata?: Metadata
      emissions?: Emissions
      economy?: Economy
    }
  }
}

import apiConfig from '../config/api'

export const cache = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${apiConfig.cacheMaxAge}`)
    next()
  }
}


import { authenticateJWT } from '../lib/auth'

export const auth = authenticateJWT

export const validateMetadata = () =>
  validateRequestBody(
    z
      .object({
        metadata: z
          .object({
            comment: z.string().optional(),
            source: z.string().optional(),
            dataOrigin: z.string().optional(),
          })
          .optional(),
      })
      .optional()
  )

const editMethods = new Set([
  apiConfig.httpMethods.post,
  apiConfig.httpMethods.patch,
  apiConfig.httpMethods.put
])
export const createMetadata =
  (prisma: PrismaClient) =>
  async (req: Request, res: Response, next: NextFunction) => {
    let createdMetadata: Metadata | undefined = undefined
    // TODO: If we use a DB transaction (initiated before this middleware is called),
    // then we could always create metadata and just abort the transaction for invalid requests.
    // This would make it easy to work with, but still allow us to prevent adding metadata not connected to any actual changes.

    // We only need to create metadata when creating or updating data
    if (editMethods.has(req.method)) {
      // TODO: Find a better way to determine if changes by the current user should count as verified or not
      // IDEA: Maybe a column in the User table to determine if this is a trusted editor? And if so, all their changes are automatically "verified".
      const verifiedByUserEmail =
        res.locals.user.email === USERS.alex ? USERS.alex : null

      const { comment, source, dataOrigin } = req.body.metadata ?? {}

      createdMetadata = await prisma.metadata.create({
        data: {
          comment,
          source,
          dataOrigin,
          user: {
            connect: {
              id: res.locals.user.id,
            },
          },
          verifiedBy: verifiedByUserEmail
            ? {
                connect: {
                  email: verifiedByUserEmail,
                },
              }
            : undefined,
        },
      })
    }

    res.locals.metadata = createdMetadata
    next()
  }

import { reportingPeriodBodySchema } from '../openapi/schemas'

export const validateReportingPeriod = () =>
  validateRequest({
    params: z.object({
      year: z.string().regex(/\d{4}(?:-\d{4})?/),
    }),
    body: reportingPeriodBodySchema,
  })

export const reportingPeriod =
  (prisma: PrismaClient) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const { year } = req.params

    // NOTE: Since we have to use validateRequest() for middlewares,
    // we have to parse the request body twice.
    // We should find a cleaner and more declarative pattern for this.
    // Look if we can solve this in a good way for express. Otherwise see how fastify handles schema validation.
    const { startDate, endDate, reportURL } = reportingPeriodBodySchema.parse(
      req.body
    )

    const endYear = parseInt(year.split('-').at(-1)!)
    if (endYear !== endDate.getFullYear()) {
      throw new GarboAPIError(
        `The URL param year must be the same year as the endDate (${endYear})`
      )
    }

    const metadata = res.locals.metadata!
    const company = res.locals.company

    if (req.method === 'POST' || req.method === 'PATCH') {
      // TODO: Only allow creating a reporting period when updating other data
      // TODO: Maybe throw 404 if the reporting period was not found and it is a GET request
      const reportingPeriod = await upsertReportingPeriod(company, metadata, {
        startDate,
        endDate,
        reportURL,
        year,
      })

      res.locals.reportingPeriod = reportingPeriod
    }

    next()
  }

export const ensureEmissionsExists =
  (prisma: PrismaClient) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const reportingPeriod = res.locals.reportingPeriod

    const emissions = await upsertEmissions({
      emissionsId: reportingPeriod.emissionsId ?? 0,
      companyId: res.locals.company.wikidataId,
      year: reportingPeriod.year,
    })

    res.locals.emissions = emissions
    next()
  }

export const ensureEconomyExists =
  (prisma: PrismaClient) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const reportingPeriod = res.locals.reportingPeriod

    const economy = await upsertEconomy({
      economyId: reportingPeriod.economyId ?? 0,
      companyId: reportingPeriod.companyId,
      year: reportingPeriod.year,
    })

    res.locals.economy = economy
    next()
  }

const getCorsOptionsBasedOnOrigin =
  (allowedOrigins: string[]): CorsOptionsDelegate =>
  (req: Request, callback) => {
    const origin = req.header('Origin')
    const corsOptions =
      origin && allowedOrigins.includes(origin)
        ? { origin: true }
        : { origin: false }
    callback(null, corsOptions)
  }

export const enableCors = (allowedOrigins: string[]) =>
  cors(getCorsOptionsBasedOnOrigin(allowedOrigins))

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  req.log.error(error)

  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
    
    res.status(422).json({ 
      error: 'Validation failed',
      details: formattedErrors,
      help: 'Kontrollera att alla fält har korrekta värden enligt API-specifikationen'
    });
    return
  } else if (error instanceof GarboAPIError) {
    req.log.error(error.original)
    res.status(error.statusCode).json({ 
      error: error.message,
      details: error.original,
      help: 'Kontakta support om felet kvarstår'
    })
    return
  }

  res.status(500).json({ 
    error: 'Internal Server Error',
    help: 'Ett oväntat fel uppstod. Kontakta support om problemet kvarstår.'
  })
}
