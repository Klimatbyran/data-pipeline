import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import $RefParser from '@apidevtools/json-schema-ref-parser'

import { DoclingDocumentSchema } from './lib/docling-schema'

const docId = '5ee1f2b6-a86a-4f26-86bc-2223c937528b'
const outDir = resolve(`/tmp/pdf2markdown/${docId}`)

async function loadDoclingJSON() {
  const rawJSON = await readFile(resolve(outDir, 'parsed.json'), {
    encoding: 'utf-8',
  }).then(JSON.parse)

  let json = DoclingDocumentSchema.parse(rawJSON)
  try {
    await $RefParser.dereference(json, {
      dereference: {
        circular: 'ignore',
      },
    })
  } catch (error) {
    console.error(error)
  }

  // dump the dereferenced json file to a file for exploration
  await writeFile(
    resolve(outDir, 'document.json'),
    JSON.stringify($RefParser.bundle(json)),
    {
      encoding: 'utf-8',
    },
  )

  // compare size - is it smaller when using the JSON schema format?

  // TODO: Create another zod schema with the actual document data
  // TODO: Rename the
  // TODO: Parse the document another time with zod to get a more useful data structure
  // In the future, we don't have to write the file in between.
  // Then use the parsed json document to process images
}

async function main() {
  await loadDoclingJSON()
}

await main()
