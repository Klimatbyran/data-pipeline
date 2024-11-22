import { z } from 'zod'

const schema = z.object({
  fiscalYear: z.object({
    startMonth: z.number(),
    endMonth: z.number(),
  }),
})

const prompt = `
Extract the company fiscal year. Sometimes companies have fiscal year which does not align with the calendar year.

Example: 1 apr -> 31 mar means:
startMonth = 4, endMonth = 3.

Standard is 1 jan -> 31 dec which is default and if nothing is mentioned in the report, please return these as default.

Example:
\`\`\`json
{
  "fiscalYear": {
    "startMonth": 1,
    "endMonth": 12
  }
}
\`\`\`
`

const queryTexts = [
  'Fiscal year start and end months',
  'Company fiscal year',
  'Fiscal year dates',
]

export default { schema, prompt, queryTexts }
