import { FastifyInstance, AuthenticatedFastifyRequest } from 'fastify'

import { emissionsService } from '../services/emissionsService'
import { companyService } from '../services/companyService'
import { reportingPeriodService } from '../services/reportingPeriodService'
import {
  getErrorSchemas,
  okResponseSchema,
  postReportingPeriodsSchema,
  wikidataIdParamSchema,
} from '../schemas'
import { getTags } from '../../config/openapi'
import { WikidataIdParams, PostReportingPeriodsBody } from '../types'
import { metadataService } from '../services/metadataService'

export async function companyReportingPeriodsRoutes(app: FastifyInstance) {
  app.post(
    '/:wikidataId/reporting-periods',
    {
      schema: {
        summary: 'Create or update reporting periods',
        description:
          'Create or update reporting periods for a specific company. This is used to update emissions and economy data.',
        tags: getTags('ReportingPeriods'),
        params: wikidataIdParamSchema,
        body: postReportingPeriodsSchema,
        response: {
          200: okResponseSchema,
          ...getErrorSchemas(400, 404),
        },
      },
    },
    async (
      request: AuthenticatedFastifyRequest<{
        Params: WikidataIdParams
        Body: PostReportingPeriodsBody
      }>,
      reply
    ) => {
      const { wikidataId } = request.params
      const { reportingPeriods, metadata } = request.body
      const user = request.user

      const company = await companyService.getCompany(wikidataId)

      await Promise.allSettled(
        reportingPeriods.map(
          async ({
            emissions = {},
            economy = {},
            startDate,
            endDate,
            reportURL,
          }) => {
            const year = endDate.getFullYear().toString()
            const createdMetadata = await metadataService.createMetadata({
              metadata,
              user,
            })
            const reportingPeriod =
              await reportingPeriodService.upsertReportingPeriod(
                company,
                createdMetadata,
                {
                  startDate,
                  endDate,
                  reportURL,
                  year,
                }
              )

            const [dbEmissions, dbEconomy] = await Promise.all([
              emissions &&
                emissionsService.upsertEmissions({
                  emissionsId: reportingPeriod.emissions?.id ?? '',
                  reportingPeriodId: reportingPeriod.id,
                }),
              economy &&
                companyService.upsertEconomy({
                  economyId: reportingPeriod.economy?.id ?? '',
                  reportingPeriodId: reportingPeriod.id,
                }),
            ])

            const {
              scope1,
              scope2,
              scope3,
              statedTotalEmissions,
              biogenic,
              scope1And2,
            } = emissions
            const { turnover, employees } = economy

            if (turnover?.currency) {
              turnover.currency = turnover.currency.trim().toUpperCase()
            }

            await Promise.allSettled([
              dbEmissions &&
                (scope1 &&
                  emissionsService.upsertScope1(
                    dbEmissions,
                    scope1,
                    createdMetadata
                  ),
                scope2 &&
                  emissionsService.upsertScope2(
                    dbEmissions,
                    scope2,
                    createdMetadata
                  ),
                scope3 &&
                  emissionsService.upsertScope3(dbEmissions, scope3, () =>
                    metadataService.createMetadata({
                      metadata,
                      user,
                    })
                  ),
                statedTotalEmissions !== undefined &&
                  emissionsService.upsertStatedTotalEmissions(
                    dbEmissions,
                    createdMetadata,
                    statedTotalEmissions
                  ),
                biogenic &&
                  emissionsService.upsertBiogenic(
                    dbEmissions,
                    biogenic,
                    createdMetadata
                  ),
                scope1And2 &&
                  emissionsService.upsertScope1And2(
                    dbEmissions,
                    scope1And2,
                    createdMetadata
                  )),
              dbEconomy &&
                (turnover &&
                  companyService.upsertTurnover({
                    economy: dbEconomy,
                    metadata: createdMetadata,
                    turnover,
                  }),
                employees &&
                  companyService.upsertEmployees({
                    economy: dbEconomy,
                    employees,
                    metadata: createdMetadata,
                  })),
            ])
          }
        )
      )

      reply.send({ ok: true })
    }
  )
}
