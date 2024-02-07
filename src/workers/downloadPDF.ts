import { Worker, Job } from 'bullmq'
import redis from '../config/redis'
import pdf from 'pdf-parse'
import { splitText } from '../queues'

class JobData extends Job {
  data: {
    url: string
  }
}

const worker = new Worker(
  'downloadPDF',
  async (job: JobData) => {
    const { url } = job.data
    job.log(`Downloading from url: ${url}`)

    const buffer = await fetch(job.data.url).then((res) => res.arrayBuffer())
    const doc = await pdf(buffer)
    const { text } = doc

    splitText.add('split text ' + text.slice(0, 20), {
      url,
      text,
    })

    return doc.text
  },
  {
    connection: redis,
    autorun: false,
  }
)

export default worker
