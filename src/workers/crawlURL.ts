import { PlaywrightCrawler, Dataset } from 'crawlee'

import { Worker, Job } from 'bullmq'
import redis from '../config/redis'
import { downloadPDF } from '../queues'

class JobData extends Job {
  data: {
    url: string
  }
}

const worker = new Worker(
  'crawlURL',
  async (job: JobData) => {
    const url = job.data.url
    job.log(`Downloading from url: ${url}`)

    // Add first URL to the queue and start the crawl.
    const result = await crawler.run([url])

    /*downloadPDF.add('download PDF ' + pdfURL.slice(0, 20), {
      url: pdfURL,
      text,
    })
*/
    return result
  },
  {
    connection: redis,
    autorun: false,
  }
)

export default worker

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
  // Use the requestHandler to process each of the crawled pages.
  async requestHandler({ request, page, enqueueLinks, log }) {
    const title = await page.title()
    log.info(`Title of ${request.loadedUrl} is '${title}'`)

    const lowerCaseTitle = title.toLowerCase()
    if (
      lowerCaseTitle.includes('sustainability') ||
      lowerCaseTitle.includes('esg') ||
      lowerCaseTitle.includes('environmental') ||
      lowerCaseTitle.includes('social') ||
      lowerCaseTitle.includes('governance') ||
      lowerCaseTitle.includes('sustainable') ||
      lowerCaseTitle.includes('climate') ||
      lowerCaseTitle.includes('green') ||
      lowerCaseTitle.includes('csr') ||
      lowerCaseTitle.includes('hållbarhet') || // Swedish
      lowerCaseTitle.includes('bærekraft') || // Norwegian
      lowerCaseTitle.includes('bæredygtighed') || // Danish
      lowerCaseTitle.includes('bærekraftig') || // Norwegian
      lowerCaseTitle.includes('bæredygtig') // Danish
    ) {
      console.log('request.loadedUrl', title, request.loadedUrl)
      downloadPDF.add('download PDF ' + request.loadedUrl.slice(0, 20), {
        url: request.loadedUrl,
      })
    }

    // Save results as JSON to ./storage/datasets/default
    await Dataset.pushData({ title, url: request.loadedUrl })

    console.log('request.loadedUrl', title, request.loadedUrl)

    // Extract links from the current page
    // and add them to the crawling queue.
    await enqueueLinks({
      filter: (url) => url.startsWith
    })
  },

  // Uncomment this option to see the browser window.
  headless: false,
})
