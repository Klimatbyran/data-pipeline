import { promises as fs } from 'fs'
import { join } from 'path'

async function splitJsonByCompany() {
  try {
    // Read the source JSON file
    const data = await fs.readFile('before/before.json', 'utf8')
    const companies = JSON.parse(data)

    // Create output directory if it doesn't exist
    const outputDir = 'companies'
    await fs.mkdir(outputDir, { recursive: true })

    // Process each company
    for (const company of companies) {
      const fileName = company.wikidataId || company.name.replace(/\s+/g, '_')
      const filePath = join(outputDir, `${fileName}.json`)

      // Write individual company data to separate files
      await fs.writeFile(filePath, JSON.stringify(company, null, 2), 'utf8')

      console.log(`Created file: ${filePath}`)
    }

    console.log('Splitting complete!')
  } catch (error) {
    console.error('Error:', error.message)
  }
}

splitJsonByCompany()
