import 'dotenv/config'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import apiConfig from '../src/config/api'
import { apiFetch } from '../src/lib/api'
import { getReportingPeriodDates } from '../src/lib/reportingPeriodDates'

async function main() {
  const data = JSON.parse(
    await readFile(resolve('output/companies.json'), 'utf-8')
  )
  for (const company of data) {
    const {
      wikidataId,
      name,
      tags,
      internalComment,
      reportingPeriods,
      description,
    } = company
    await apiFetch('/companies', {
      method: 'POST',
      body: {
        wikidataId,
        name,
        description,
        tags,
        internalComment,
        metadata: { comment: 'Import verified data from spreadsheet' },
      },
    })
    const existingCompany = await apiFetch(`/companies/${wikidataId}`).catch(
      () => null
    )
    const adjustedReportingPeriods = reportingPeriods
      ? reportingPeriods.map((rp: any) => {
          const year = new Date(rp.endDate).getFullYear()
          const computed = getReportingPeriodDates(year, 1, 12)
          let startDate = new Date(rp.startDate)
          if (isNaN(startDate.getTime())) {
            startDate = new Date(computed[0])
          }
          let endDate = new Date(rp.endDate)
          if (isNaN(endDate.getTime())) {
            endDate = new Date(computed[1])
          }
          if (existingCompany && existingCompany.reportingPeriods) {
            const existingRP = existingCompany.reportingPeriods.find(
              (r: any) => new Date(r.endDate).getFullYear() === year
            )
            if (existingRP) {
              const exStart = new Date(existingRP.startDate)
              const exEnd = new Date(existingRP.endDate)
              if (!isNaN(exStart.getTime()) && !isNaN(exEnd.getTime())) {
                startDate = exStart
                endDate = exEnd
              }
            }
          }

          return {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            reportURL: rp.reportURL ?? undefined,
            emissions: rp.emissions ?? undefined,
            economy: rp.economy ?? undefined,
          }
        })
      : []
    await apiFetch(`/companies/${wikidataId}/reporting-periods`, {
      method: 'POST',
      body: {
        reportingPeriods: adjustedReportingPeriods,
        metadata: { comment: 'Import verified data from spreadsheet' },
      },
    })
  }
}

await main()
