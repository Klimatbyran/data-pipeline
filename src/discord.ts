import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  TextChannel,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Message,
  ThreadChannel,
} from 'discord.js'
import commands from './discord/commands'
import config from './config/discord'
import elastic from './elastic'
import { discordReview, userFeedback } from './queues'
import retry from './discord/interactions/retry'
import approve from './discord/interactions/approve'
import feedback from './discord/interactions/feedback'
import reject from './discord/interactions/reject'
import mentioned from './discord/interactions/mentioned'

export class Discord {
  client: Client<boolean>
  rest: REST
  commands: Array<any>
  token: string
  channelId: string

  constructor({ token, guildId, clientId, channelId }) {
    this.token = token
    this.channelId = channelId
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] })
    this.rest = new REST().setToken(token)
    this.commands = commands.map((command) => command.data.toJSON())
    this.client.on('ready', () => {
      console.log('discord connected')
      const url = Routes.applicationGuildCommands(clientId, guildId)
      this.rest.put(url, { body: this.commands })
    })

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return
      const user = message.mentions.users
        .filter((user) => user.id === this.client.user.id)
        .first()
      if (user) {
        console.log('mentioned user:', user.username)
        const job = (await discordReview.getCompleted())
          .filter((job) => job.data.threadId === message.channel.id)
          .at(0)
        mentioned.execute(message.interaction, job)
      }
    })

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isCommand()) {
        const command = commands.find(
          (command) => command.data.name === interaction.commandName
        )
        try {
          await command.execute(interaction)
        } catch (error) {
          console.error('Discord error:', error)
          await interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
          })
        }
      } else if (interaction.isButton()) {
        const [action, jobId] = interaction.customId.split('~')
        switch (action) {
          case 'approve': {
            const job = await discordReview.getJob(jobId)
            await approve.execute(interaction, job)
            break
          }
          case 'feedback': {
            const job = await discordReview.getJob(jobId)
            await feedback.execute(interaction, job)
            break
          }
          case 'reject': {
            const job = await discordReview.getJob(jobId)
            await reject.execute(interaction, job)
            break
          }
          case 'retry': {
            const job = await discordReview.getJob(jobId)
            retry.execute(interaction, job)
            break
          }
        }
      }
    })
  }

  login(token = this.token) {
    this.client.login(token)
    return this
  }

  public createButtonRow = (jobId: string) => {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve~${jobId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`feedback~${jobId}`)
        .setLabel('Feedback')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`reject~${jobId}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`retry~${jobId}`)
        .setLabel('🔁')
        .setStyle(ButtonStyle.Secondary)
    )
  }

  async sendMessage({ threadId }: { threadId: string }, msg: string) {
    try {
      const thread = (await this.client.channels.fetch(
        threadId
      )) as ThreadChannel
      await thread.sendTyping()
      return thread.send(msg)
    } catch (e) {
      console.error('Error sending message to thread', e)
    }
  }

  async createThread(
    { channelId, messageId }: { channelId: string; messageId: string },
    name: string
  ) {
    const channel = (await this.client.channels.fetch(channelId)) as TextChannel
    const message = await channel.messages.fetch(messageId)
    return message.startThread({
      name: name,
      autoArchiveDuration: 60,
    })
  }

  async sendMessageToChannel(channelId, message): Promise<Message> {
    const channel = (await this.client.channels.fetch(channelId)) as TextChannel
    return await channel.send(message)
  }
}

export default new Discord(config)
