import { readFile } from 'fs/promises'
import { resolve } from 'path'

async function main() {
  const pdf = await readFile(
    resolve(import.meta.dirname, '../garbo_pdfs/astra-zeneca-2023.pdf'),
  )

  let res: Response
  try {
    res = await fetch('http://localhost:3000/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: new Blob([pdf]),
    })
  } catch (error) {
    console.error('Fetch failed:', error.message)
    return
  }

  if (!res.ok) {
    const error = await res.json()
    console.error('Server error:', error)
    return
  }

  const data = await res.text()

  console.log(data.slice(5000))
  console.log('\n\nReceived markdown length:', data.length)
}

await main()
