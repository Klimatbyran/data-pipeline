import fs from 'fs/promises'
import path from 'path'
import { diffJson } from 'diff'
import { fileURLToPath } from 'url'

type DiffCategory = {
  unitChanges: string[]
  scope3Changes: string[]
  totalValueChanges: string[]
  structuralChanges: string[]
  other: string[]
}

async function getJsonFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir)
  return files.filter(file => file.endsWith('.json'))
}

async function readJsonFile(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

function categorizeChange(beforeData: any, afterData: any): string {
  const differences = diffJson(beforeData, afterData)
  
  // Check for unit changes
  if (JSON.stringify(beforeData).includes('unit') !== JSON.stringify(afterData).includes('unit')) {
    return 'unitChanges'
  }
  
  // Check for scope 3 changes
  if (JSON.stringify(beforeData?.scope3) !== JSON.stringify(afterData?.scope3)) {
    return 'scope3Changes'
  }
  
  // Check for total value changes
  if (beforeData?.statedTotalEmissions?.total !== afterData?.statedTotalEmissions?.total) {
    return 'totalValueChanges'
  }
  
  // Check for structural changes (different keys/structure)
  if (Object.keys(beforeData).sort().join(',') !== Object.keys(afterData).sort().join(',')) {
    return 'structuralChanges'
  }
  
  return 'other'
}

async function analyzeDiffs() {
  const categories: DiffCategory = {
    unitChanges: [],
    scope3Changes: [],
    totalValueChanges: [],
    structuralChanges: [],
    other: []
  }

  const beforeDir = 'data/before'
  const okDir = 'data/_OK'
  
  const beforeFiles = await getJsonFiles(beforeDir)
  
  for (const file of beforeFiles) {
    const beforePath = path.join(beforeDir, file)
    const okPath = path.join(okDir, file)
    
    try {
      const beforeData = await readJsonFile(beforePath)
      const okData = await readJsonFile(okPath)
      
      const category = categorizeChange(beforeData, okData)
      categories[category].push(file)
    } catch (error) {
      console.error(`Error processing ${file}:`, error)
    }
  }

  // Create directories for each category
  for (const [category, files] of Object.entries(categories)) {
    if (files.length > 0) {
      const categoryDir = path.join('data', category)
      await fs.mkdir(categoryDir, { recursive: true })
      
      console.log(`\n${category}:`)
      for (const file of files) {
        console.log(`- ${file}`)
        await fs.copyFile(
          path.join(beforeDir, file),
          path.join(categoryDir, file)
        )
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  analyzeDiffs().catch(console.error)
}
