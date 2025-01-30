import { resolve, join } from 'path'
import { PythonShell } from 'python-shell'
import { writeFile, readFile, mkdir } from 'fs/promises'

import {
  DoclingDocument,
  DoclingDocumentSchema,
  Image,
  Table,
} from './docling-schema'
import { extractTextViaVisionAPI } from './jsonExtraction'

const OUTPUT_DIR = resolve('/tmp/pdf2markdown')

export async function convertPDF(
  buffer: Buffer,
  docId: string,
): Promise<{ json: DoclingDocument; markdown: string }> {
  const outDir = resolve(OUTPUT_DIR, docId)
  await mkdir(outDir, { recursive: true })
  const inputPDF = resolve(outDir, 'input.pdf')

  // NOTE: Maybe there's a way to pass the input PDF without writing a file
  await writeFile(inputPDF, buffer, { encoding: 'utf-8' })

  try {
    // TODO: Figure out how to get both the stdout and stderr from the child process

    // await new Promise<void>((success, reject) => {
    //   const shell = new PythonShell(
    //     resolve(import.meta.dirname, '../parse_pdf.py'),
    //     {
    //       args: [inputPDF, outDir],
    //       stdio: 'inherit',
    //     },
    //   )

    //   shell.childProcess.stdout?.on?.('data', (chunk: any) => {
    //     console.log(chunk.toString())
    //   })

    //   shell.once('pythonError', (err) => {
    //     reject(err)
    //   })

    //   shell.once('close', () => {
    //     success()
    //   })
    // })
    await PythonShell.run(resolve(import.meta.dirname, '../parse_pdf.py'), {
      // IDEA: Maybe pass searchTerms to only extract the page images for the tables we want
      // The python PDF parser could return only the data needed to extract with the Vision API.
      args: [inputPDF, outDir],
      stdio: ['pipe', 'inherit', 'pipe', 'pipe'],
    })
  } catch (e) {
    throw new Error('Conversion failed! ' + e)
  }

  const [rawJSON, markdown] = await Promise.all([
    readFile(resolve(outDir, 'parsed.json'), {
      encoding: 'utf-8',
    }).then(JSON.parse),
    readFile(resolve(outDir, 'parsed.md'), {
      encoding: 'utf-8',
    }),
  ])

  const {
    success,
    data: json,
    error,
  } = DoclingDocumentSchema.safeParse(rawJSON)
  if (!success) {
    console.error('Schema validation failed:', error.format())
    throw new Error('Invalid response format from Docling')
  }

  // Get unique page numbers, also for tables spanning multiple pages
  const uniquePages = new Set(
    json.tables.flatMap((t) => t.prov.map(({ page_no }) => page_no)),
  )

  console.log(
    'Found',
    json.tables.length,
    'tables on',
    uniquePages.size,
    'pages:',
    uniquePages,
  )
  console.log('Markdown length: ', markdown.length)

  return { json, markdown }
}

type Page = {
  pageNumber: number
  tables: Table[]
  image: Image
}

export function findRelevantTablesGroupedOnPages(
  json: DoclingDocument,
  searchTerms: string[],
): Page[] {
  // HACK: JSON.stringify() the page with the table, and then check if it includes any relevant search terms
  // Actually, we need to evaluate each node and its value
  // Example implementation for evaluating the strings and replacing nodes with referenced values: https://stackoverflow.com/a/42398875
  // This needs to happen before the zod parsing though
  // const tables = json.tables.filter((table) => {
  //   const tableContent = JSON.stringify(table)
  //   searchTerms.some((term) =>
  //     content.toLowerCase().includes(term.toLowerCase()),
  //   )
  // })

  // NOTE: Until content filtering is available, we need to process all tables
  return Object.values(
    json.tables.reduce((acc: Record<number, Page>, table: Table, i) => {
      for (const n of table.prov.map((item) => item.page_no)) {
        const { page_no, image } = json.pages[n]

        if (!image) {
          throw new Error(
            `Page ${page_no} don't have an image, but needs it for table ${i}`,
          )
        }

        acc[page_no] ??= {
          pageNumber: page_no,
          tables: [],
          image,
        }

        acc[page_no].tables.push(table)
      }

      return acc
    }, {}),
  )
}

export async function extractTablesWithVisionAPI(
  { json, markdown }: { json: DoclingDocument; markdown: string },
  searchTerms: string[] = [],
): Promise<{ markdown: string }> {
  const pages = findRelevantTablesGroupedOnPages(json, searchTerms)

  const tables: { page_idx: number; markdown: string }[] = await pages.reduce(
    async (resultsPromise, { pageNumber, image }) => {
      const results = await resultsPromise
      const lastPageMarkdown = results.at(-1)?.markdown || ''
      const markdown = await extractTextViaVisionAPI(
        { imageBase64: image.uri },
        lastPageMarkdown,
      )
      // TODO: Send to s3 bucket (images)
      return [
        ...results,
        {
          page_idx: Number(pageNumber - 1),
          markdown,
        },
      ]
    },
    Promise.resolve([] as any),
  )

  console.log('Extracted tables: ' + tables.map((t) => t.markdown).join(', '))

  return {
    markdown:
      markdown +
      '\n\nHere are some of the important tables from the markdown with more precision:' +
      tables
        .map(
          ({ page_idx, markdown }) =>
            `\n#### Page ${page_idx}: 
                ${markdown}`,
        )
        .join('\n'),
  }
}
