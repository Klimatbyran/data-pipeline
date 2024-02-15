import dotenv from 'dotenv'
dotenv.config() // keep this line first in file

import express from 'express'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'

import discord from './discord'

// keep this line, otherwise the workers won't be started
import * as workers from './workers'
import {
  discordReview,
  downloadPDF,
  indexParagraphs,
  parseText,
  reflectOnAnswer,
  searchVectors,
  splitText,
  crawlURL,
} from './queues'

// add dummy job
// downloadPDF.add('dummy', {
//   url: 'https://mb.cision.com/Main/17348/3740648/1941181.pdf',
// })

/*
downloadPDF.add('volvo', {
  url: 'https://www.volvogroup.com/content/dam/volvo-group/markets/master/investors/reports-and-presentations/annual-reports/AB-Volvo-Annual-Report-2022.pdf',
})*/

crawlURL.add('crawl url', {
  url: 'https://www.volvogroup.com/',
})

// start workers
Object.values(workers).forEach((worker) => worker.run())

// start ui
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(crawlURL),
    new BullMQAdapter(downloadPDF),
    new BullMQAdapter(splitText),
    new BullMQAdapter(indexParagraphs),
    new BullMQAdapter(searchVectors),
    new BullMQAdapter(parseText),
    new BullMQAdapter(reflectOnAnswer),
    new BullMQAdapter(discordReview),
  ],
  serverAdapter: serverAdapter,
  options: {
    uiConfig: {
      boardTitle: 'Klimatkollen',
    },
  },
})

const app = express()
discord.login()

app.use('/admin/queues', serverAdapter.getRouter())
app.listen(3000, () => {
  console.log('Running on 3000...')
  console.log('For the UI, open http://localhost:3000/admin/queues')
})
