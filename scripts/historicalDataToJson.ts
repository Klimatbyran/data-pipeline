import 'dotenv/config'
import ExcelJS from 'exceljs'
import { resolve } from 'path'
import { writeFile } from 'fs/promises'
import { getReportingPeriodDates } from '../src/lib/reportingPeriodDates'

const workbook = new ExcelJS.Workbook()
await workbook.xlsx.readFile(
  resolve('src/data/Klimatkollen_ Company GHG data.xlsx')
)

function getSheetHeaders({
  sheet,
  row,
}: {
  sheet: ExcelJS.Worksheet
  row: number
}): string[] {
  return Object.values(sheet.getRow(row).values || []).map(String)
}

function removeNullProperties(data: any): any {
  if (Array.isArray(data)) {
    const arr = data
      .map(removeNullProperties)
      .filter((item) => item !== undefined && item !== null)
    return arr.length ? arr : undefined
  }
  if (typeof data === 'object' && data !== null) {
    const obj = Object.entries(data).reduce((acc, [key, value]) => {
      if (key === 'startDate' || key === 'endDate') {
        acc[key] = value
      } else {
        const cleaned = removeNullProperties(value)
        if (cleaned !== undefined && cleaned !== null) {
          acc[key] = cleaned
        }
      }
      return acc
    }, {} as Record<string, any>)
    return Object.keys(obj).length ? obj : undefined
  }
  return data
}

function getCompanyBaseFacts(): {
  wikidataId: string
  name: string
  tags: string[]
  internalComment: string | null
}[] {
  const sheet = workbook.getWorksheet('import')
  if (!sheet) throw new Error('Worksheet "import" not found')
  const headerRow = 2
  const headers = getSheetHeaders({ sheet, row: headerRow })
  const companies: {
    wikidataId: string
    name: string
    tags: string[]
    internalComment: string | null
  }[] = []
  const allRows = sheet.getSheetValues() as unknown[][]
  allRows.slice(headerRow + 1).forEach((row) => {
    if (!row) return
    const columns = headers.reduce((acc: Record<string, any>, header, i) => {
      const idx = i + 1
      acc[header] = (row[idx] && (row[idx] as any).result) || row[idx]
      return acc
    }, {} as Record<string, any>)
    companies.push({
      wikidataId: columns['Wiki ID'],
      name: columns['Company'],
      tags:
        typeof columns['Batch'] === 'string' &&
        columns['Batch'].toLowerCase() === 'statlig'
          ? ['state-owned']
          : [],
      internalComment: columns['General Comment'] || null,
    })
  })
  return companies
}

function getReportingPeriods(
  companies: { wikidataId: string; name: string }[],
  years: number[]
): Record<string, any[]> {
  const reportingPeriodsByCompany: Record<string, any[]> = {}
  function isEmpty(rp: any): boolean {
    const e = rp.emissions
    const hasEmissions =
      e &&
      ((e.scope1 && Number.isFinite(e.scope1.total)) ||
        (e.scope2 &&
          (Number.isFinite(e.scope2.mb) || Number.isFinite(e.scope2.lb))) ||
        (e.scope1And2 && Number.isFinite(e.scope1And2.total)) ||
        (e.scope3 && Number.isFinite(e.scope3.statedTotalEmissions?.total)) ||
        (e.scope3 &&
          e.scope3.categories &&
          e.scope3.categories.some((c: any) => Number.isFinite(c.total))) ||
        (e.statedTotalEmissions &&
          Number.isFinite(e.statedTotalEmissions.total)) ||
        (e.biogenic && Number.isFinite(e.biogenic.total)))
    const econ = rp.economy
    const hasEconomy =
      econ &&
      ((econ.turnover && Number.isFinite(econ.turnover.value)) ||
        (econ.employees && Number.isFinite(econ.employees.value)))
    return !(hasEmissions || hasEconomy)
  }
  for (const year of years) {
    const sheet = workbook.getWorksheet(year.toString())
    if (!sheet) continue
    const headerRow = 2
    const headers = getSheetHeaders({ sheet, row: headerRow })
    const allRows = sheet.getSheetValues() as unknown[][]
    allRows.slice(headerRow + 1).forEach((row) => {
      if (!row) return
      const cols = headers.reduce((acc: Record<string, any>, header, i) => {
        const idx = i + 1
        acc[header] =
          (row[idx] && (row[idx] as any).result) ||
          (row[idx] && (row[idx] as any).hyperlink) ||
          row[idx]
        return acc
      }, {} as Record<string, any>)
      const company = companies.find(
        (c) =>
          c.name.trim().toLowerCase() ===
          (typeof cols['Company'] === 'string'
            ? cols['Company'].trim().toLowerCase()
            : '')
      )
      if (!company) return
      const [startDate, endDate] = getReportingPeriodDates(year, 1, 12)
      const categories = Array.from({ length: 15 }, (_, i) => i + 1)
        .map((category) => ({
          category,
          total: cols[`Cat ${category}`],
        }))
        .concat([{ category: 16, total: cols['Other'] }])
        .filter((c) => Number.isFinite(c.total))
      const rp = {
        companyId: company.wikidataId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reportURL: cols[`URL ${year}`] || null,
        emissions: {
          scope1: { total: cols['Scope 1'] || null },
          scope2: {
            mb: cols['Scope 2 (MB)'] || null,
            lb: cols['Scope 2 (LB)'] || null,
          },
          scope1And2: { total: cols['Scope 1+2'] || null },
          scope3: {
            statedTotalEmissions: { total: cols['Scope 3 (total)'] || null },
            categories: categories.length ? categories : undefined,
          },
          statedTotalEmissions: { total: cols['Total'] || null },
          biogenic: { total: cols['Biogenic (outside of scopes)'] || null },
        },
        economy: {
          turnover: {
            value: cols['Turnover'] || null,
            currency: cols['Currency'] || null,
          },
          employees: {
            value: cols['No of Employees'] || null,
            unit: cols['Unit'] || null,
          },
        },
      }
      const sanitizedRp = removeNullProperties(rp)
      if (!isEmpty(sanitizedRp)) {
        reportingPeriodsByCompany[company.wikidataId] =
          reportingPeriodsByCompany[company.wikidataId] || []
        reportingPeriodsByCompany[company.wikidataId].push(sanitizedRp)
      }
    })
  }
  return reportingPeriodsByCompany
}

async function main() {
  const companies = getCompanyBaseFacts()
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]
  const periods = getReportingPeriods(companies, years)
  const output = companies.map((company) => ({
    ...company,
    reportingPeriods: periods[company.wikidataId] || [],
  }))
  await writeFile(
    resolve('output/companies.json'),
    JSON.stringify(removeNullProperties(output), null, 2)
  )
}

await main()
