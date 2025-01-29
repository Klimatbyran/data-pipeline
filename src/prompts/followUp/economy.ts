import { z } from 'zod'

export const schema = z.object({
  economy: z.array(
    z.object({
      year: z.number(),
      economy: z
        .object({
          turnover: z
            .object({
              value: z.number().nullable().optional(),
              currency: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
          employees: z
            .object({
              value: z.number().nullable().optional(),
              unit: z.enum(['FTE', 'EOY', 'AVG']).nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
    })
  ),
})

// NOTE: Maybe split this into two parts, one for turnover and another for employees, to allow re-running them separately

export const prompt = `
*** Golden Rule ***
- Extract values only if explicitly available in the context. Do not infer or create data. Leave optional fields absent or explicitly set to null if no data is provided.
*** Turnover ***
- Extract turnover as a numerical value. Use the turnover field to specify the turnover (intäkter, omsättning) of the company. If the currency is not specified, assume SEK. 
- Prefer turnover to be extracted as net sales (nettomsättning) over revenue if both are present.
  Be as accurate as possible. Extract this data for all available years.
- Convert units like "MSEK", "kSEK", "kEUR" etc. into the base numerical value in the local currency.
  Example:  
  - 250 MSEK → 250000000 SEK
  - 4.2 KEUR → 4200 EUR
- Specify the **currency** as a separate field (e.g., SEK, USD, EUR).
*** Employees: ***
- Extract the number of employees for all available years. 
- Acceptable units include:
  - FTE (Full-Time Equivalent)
  - AVG (genomsnittligt antal anställda)
  - EOY (Antal anställda vid årets slut)
- If no unit is specified, extract the value as is and set the unit field to null.
*** Dates: ***
- if no year is specified, assume the current year ${new Date().getFullYear()}

*** Example***
This is only an example format; do not include this specific data in the output and do not use markdown in the output:
{
  "economy": [
    {
      "year": 2023,
      "turnover": {
        "value": 4212299000,
        "currency": "SEK"
      },
      "employees": {
        "value": 3298,
        "unit": "FTE"
      }
    },
    {
      "year": 2022,
      "turnover": {
        "value": 3993948000,
        "currency": "SEK"
      },
      "employees": {
        "value": 3045,
        "unit": "AVG"
      }
    }
  ]
}
`

const queryTexts = [
  'Extract turnover (intäkter, omsättning) values in SEK or EUR for all available years.',
  'Extract the number of employees with their units (e.g., FTE) for all available years.',
  'Retrieve company economy data including turnover in SEK or EUR and number of employees with units for each year.',
  'Net sales ( nettomsättning )',
  'Revenue',
]

export default { prompt, schema, queryTexts }
