import express, { Request, Response, NextFunction } from 'express'
import { validateRequestParams } from './zod-middleware'

import { getGics } from '../lib/gics'
import { cache, enableCors } from './middlewares'
import { wikidataIdParamSchema } from './companySchemas'
import { prisma } from '../lib/prisma'
import { GarboAPIError } from '../lib/garbo-api-error'

const router = express.Router()

const metadata = {
  select: {
    comment: true,
    source: true,
    updatedAt: true,
    user: {
      select: {
        name: true,
      },
    },
    verifiedBy: {
      select: {
        name: true,
      },
    },
  },
}

const minimalMetadata = {
  select: {
    verifiedBy: {
      select: {
        name: true,
      },
    },
  },
}

function removeEmptyValues(obj: Record<any, any>) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v != null))
}

// ## DÖLJ DESSA från API:et
const HIDDEN_FROM_API = new Set([
  'Q22629259', // GARO
  'Q37562781', // GARO
  'Q489097', // Ernst & Young
  'Q10432209', // Prisma Properties
  'Q5168854', // Copperstone Resources AB
  'Q115167497', // Specialfastigheter
  'Q549624', // RISE AB
  'Q34', // Swedish Logistic Property AB,

  // OLD pages:

  'Q8301325', // SJ
  'Q112055015', // BONESUPPORT
  'Q97858523', // Almi
  'Q2438127', // Dynavox
  'Q117352880', // BioInvent
  'Q115167497', // Specialfastigheter
])

const unwantedWikidataIds = Array.from(HIDDEN_FROM_API)

function isNumber(n: unknown): n is number {
  return Number.isFinite(n)
}

const origins =
  process.env.NODE_ENV === 'development'
    ? ['http://localhost:4321']
    : ['https://beta.klimatkollen.se', 'https://klimatkollen.se']

router.use(enableCors(origins))

// TODO: Find a way to re-use the same logic to process companies both for GET /companies and GET /companies/:wikidataId

router.get(
  '/',
  cache(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companies = await prisma.company.findMany({
        select: {
          wikidataId: true,
          name: true,
          description: true,
          reportingPeriods: {
            select: {
              startDate: true,
              endDate: true,
              reportURL: true,
              economy: {
                select: {
                  turnover: {
                    select: {
                      value: true,
                      currency: true,
                      //metadata: minimalMetadata,
                    },
                  },
                  employees: {
                    select: {
                      value: true,
                      unit: true,
                      //metadata: minimalMetadata,
                    },
                  },
                },
              },
              emissions: {
                select: {
                  scope1: {
                    select: {
                      total: true,
                      unit: true,
                      //metadata: minimalMetadata,
                    },
                  },
                  scope2: {
                    select: {
                      lb: true,
                      mb: true,
                      unknown: true,
                      unit: true,
                      //metadata: minimalMetadata,
                    },
                  },
                  scope3: {
                    select: {
                      statedTotalEmissions: {
                        select: {
                          total: true,
                          unit: true,
                          //metadata: minimalMetadata,
                        },
                      },
                      categories: {
                        select: {
                          category: true,
                          total: true,
                          unit: true,
                          //metadata: minimalMetadata,
                        },
                        orderBy: {
                          category: 'asc',
                        },
                      },
                      //metadata: minimalMetadata,
                    },
                  },
                  biogenicEmissions: {
                    select: {
                      total: true,
                      unit: true,
                      //metadata: minimalMetadata,
                    },
                  },
                  scope1And2: {
                    select: {
                      total: true,
                      unit: true,
                      //metadata: minimalMetadata,
                    },
                  },
                  statedTotalEmissions: {
                    select: {
                      total: true,
                      unit: true,
                      //metadata,
                    },
                  },
                },
              },
              metadata: minimalMetadata,
            },
            orderBy: {
              startDate: 'desc',
            },
          },
          industry: {
            select: {
              industryGics: {
                select: {
                  sectorCode: true,
                  groupCode: true,
                  industryCode: true,
                  subIndustryCode: true,
                },
              },
              //metadata: minimalMetadata,
            },
          },
        },
        where: {
          wikidataId: {
            notIn: unwantedWikidataIds,
          },
        },
      })
      res.json(
        companies
          // Calculate total emissions for each scope type
          .map((company) => ({
            ...company,
            reportingPeriods: company.reportingPeriods.map(
              (reportingPeriod) => ({
                ...reportingPeriod,
                emissions: {
                  ...reportingPeriod.emissions,
                  scope2:
                    (reportingPeriod.emissions?.scope2 && {
                      ...reportingPeriod.emissions.scope2,
                      calculatedTotalEmissions:
                        reportingPeriod.emissions.scope2.mb ??
                        reportingPeriod.emissions.scope2.lb ??
                        reportingPeriod.emissions.scope2.unknown,
                    }) ||
                    undefined,
                  scope3:
                    (reportingPeriod.emissions?.scope3 &&
                      Object.keys(
                        removeEmptyValues(reportingPeriod.emissions?.scope3)
                      ).length && {
                        ...removeEmptyValues(reportingPeriod.emissions.scope3),
                        calculatedTotalEmissions:
                          reportingPeriod.emissions.scope3.statedTotalEmissions
                            ?.total ?? 0,
                      }) ||
                    undefined,
                },
                metadata: reportingPeriod.metadata[0],
              })
            ),
          }))
      )
    } catch (error) {
      next(
        new GarboAPIError('Failed to load companies', {
          original: error,
          statusCode: 500,
        })
      )
    }
  }
)

router.get(
  '/:wikidataId',
  validateRequestParams(wikidataIdParamSchema),
  cache(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { wikidataId } = req.params
      const company = await prisma.company.findFirst({
        where: {
          wikidataId,
          AND: {
            wikidataId: {
              notIn: unwantedWikidataIds,
            },
          },
        },
        select: {
          wikidataId: true,
          name: true,
          description: true,
          reportingPeriods: {
            select: {
              startDate: true,
              endDate: true,
              reportURL: true,
              economy: {
                select: {
                  turnover: {
                    select: {
                      value: true,
                      currency: true,
                      metadata,
                    },
                  },
                  employees: {
                    select: {
                      value: true,
                      unit: true,
                      metadata,
                    },
                  },
                },
              },
              emissions: {
                select: {
                  scope1: {
                    select: {
                      total: true,
                      unit: true,
                      metadata,
                    },
                  },
                  scope2: {
                    select: {
                      lb: true,
                      mb: true,
                      unknown: true,
                      unit: true,
                      metadata,
                    },
                  },
                  scope3: {
                    select: {
                      statedTotalEmissions: {
                        select: {
                          total: true,
                          unit: true,
                          metadata,
                        },
                      },
                      categories: {
                        select: {
                          category: true,
                          total: true,
                          unit: true,
                          metadata,
                        },
                        orderBy: {
                          category: 'asc',
                        },
                      },
                      metadata,
                    },
                  },
                  biogenicEmissions: {
                    select: {
                      total: true,
                      unit: true,
                      metadata,
                    },
                  },
                  scope1And2: {
                    select: {
                      total: true,
                      unit: true,
                      metadata,
                    },
                  },
                  statedTotalEmissions: {
                    select: {
                      total: true,
                      unit: true,
                      metadata,
                    },
                  },
                },
              },
              metadata,
            },
            orderBy: {
              startDate: 'desc',
            },
          },
          industry: {
            select: {
              industryGics: {
                select: {
                  sectorCode: true,
                  groupCode: true,
                  industryCode: true,
                  subIndustryCode: true,
                },
              },
              metadata,
            },
          },
          goals: {
            select: {
              id: true,
              description: true,
              year: true,
              baseYear: true,
              target: true,
              metadata,
            },
            orderBy: {
              year: 'desc',
            },
          },
          initiatives: {
            select: {
              id: true,
              title: true,
              description: true,
              year: true,
              scope: true,
              metadata,
            },
            orderBy: {
              year: 'desc',
            },
          },
        },
      })

      if (!company) {
        return next(new GarboAPIError('Company not found', { statusCode: 404 }))
      }

      res.json(
        [company]
          // Calculate total emissions for each scope type
          .map((company) => ({
            ...company,
            reportingPeriods: company.reportingPeriods.map(
              (reportingPeriod) => ({
                ...reportingPeriod,
                emissions: {
                  ...reportingPeriod.emissions,
                  scope2:
                    (reportingPeriod.emissions?.scope2 && {
                      ...reportingPeriod.emissions.scope2,
                      calculatedTotalEmissions:
                        reportingPeriod.emissions.scope2.mb ??
                        reportingPeriod.emissions.scope2.lb ??
                        reportingPeriod.emissions.scope2.unknown,
                    }) ||
                    undefined,
                  scope3:
                    (reportingPeriod.emissions?.scope3 &&
                      Object.keys(
                        removeEmptyValues(reportingPeriod.emissions?.scope3)
                      ).length && {
                        ...removeEmptyValues(reportingPeriod.emissions.scope3),
                        calculatedTotalEmissions:
                          reportingPeriod.emissions.scope3.categories.some(
                            (c) => Boolean(c.metadata.verifiedBy)
                          )
                            ? reportingPeriod.emissions.scope3.categories.reduce(
                                (total, category) =>
                                  isNumber(category.total)
                                    ? category.total + total
                                    : total,
                                0
                              )
                            : reportingPeriod.emissions.scope3
                                .statedTotalEmissions?.total ?? 0,
                      }) ||
                    undefined,
                },
                metadata: reportingPeriod.metadata[0],
              })
            ),
            // Add translations for GICS data
            industry: company.industry
              ? {
                  ...company.industry,
                  industryGics: {
                    ...company.industry.industryGics,
                    ...getGics(company.industry.industryGics.subIndustryCode),
                  },
                }
              : undefined,
          }))
          // Calculate total emissions for each reporting period
          // This allows comparing against the statedTotalEmissions provided by the company report
          // In cases where we find discrepancies between the statedTotalEmissions and the actual total emissions,
          // we should highlight this in the UI.
          .map((company) => ({
            ...company,
            reportingPeriods: company.reportingPeriods.map(
              (reportingPeriod) => ({
                ...reportingPeriod,
                emissions: Object.keys(
                  removeEmptyValues(reportingPeriod.emissions)
                ).length
                  ? {
                      ...removeEmptyValues(reportingPeriod.emissions),
                      calculatedTotalEmissions:
                        // if either scope 1 and scope 2 have verification, then we use them for the total.
                        // Otherwise, we use the combined scope1And2 if it exists
                        (Boolean(
                          reportingPeriod.emissions?.scope1?.metadata
                            ?.verifiedBy
                        ) ||
                        Boolean(
                          reportingPeriod.emissions?.scope2?.metadata
                            ?.verifiedBy
                        )
                          ? (reportingPeriod.emissions?.scope1?.total || 0) +
                            (reportingPeriod.emissions?.scope2
                              ?.calculatedTotalEmissions || 0)
                          : reportingPeriod.emissions?.scope1And2?.total || 0) +
                        (reportingPeriod.emissions?.scope3
                          ?.calculatedTotalEmissions || 0),
                    }
                  : null,
              })
            ),
          }))
          .at(0)
      )
    } catch (error) {
      next(
        new GarboAPIError('Failed to load company', {
          original: error,
          statusCode: 500,
        })
      )
    }
  }
)

// Error handler middleware
router.use(
  (err: GarboAPIError, req: Request, res: Response, next: NextFunction) => {
    res.status(err.statusCode || 500).json({
      error: err.message,
      details: err.original || null,
    })
  }
)

export default router
