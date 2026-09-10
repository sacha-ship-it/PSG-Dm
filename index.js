const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js')

const TOKEN = process.env.TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const GUILD_ID = process.env.GUILD_ID
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
})

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function sendDMToMembers(members, content, imageUrl, interaction) {
  let success = 0
  let failed = 0
  const total = members.size

  await interaction.editReply({ content: `Envoi en cours... 0/${total}` })

  for (const [id, member] of members) {
    if (member.user.bot) continue

    try {
      const finalContent = content.replace(/\\n/g, '\n')

      if (imageUrl) {
        await member.user.send({ content: finalContent, files: [imageUrl] })
      } else {
        await member.user.send({ content: finalContent })
      }

      success++
    } catch (e) {
      failed++
    }

    if ((success + failed) % 10 === 0) {
      await interaction.editReply({ content: `Envoi en cours... ${success + failed}/${total} — Réussis : ${success} — Échecs : ${failed}` })
    }

    await delay(1200)
  }

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID)
  await logChannel.send(`✅ DM terminé — ${success} envoyés / ${failed} échoués / ${total} membres ciblés`)

  await interaction.editReply({ content: `✅ Terminé — ${success} DM envoyés / ${failed} échoués` })
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('dm-all')
      .setDescription('Envoyer un DM à tous les membres (admin)')
      .addStringOption(o => o.setName('message').setDescription('Message à envoyer (\\n pour sauts de ligne)').setRequired(true))
      .addStringOption(o => o.setName('image').setDescription('URL de l\'image (optionnel)').setRequired(false)),

    new SlashCommandBuilder()
      .setName('dm-role')
      .setDescription('Envoyer un DM à un rôle spécifique (admin)')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à cibler').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message à envoyer (\\n pour sauts de ligne)').setRequired(true))
      .addStringOption(o => o.setName('image').setDescription('URL de l\'image (optionnel)').setRequired(false)),

  ].map(c => c.toJSON())

  const rest = new REST({ version: '10' }).setToken(TOKEN)
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
  console.log('Commandes enregistrees')
}

client.on('ready', async () => {
  console.log(`Bot connecte : ${client.user.tag}`)
  await registerCommands()
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return

  const isAdmin = interaction.member.permissions.has('Administrator')
  if (!isAdmin) return interaction.reply({ content: 'Permission refusee.', ephemeral: true })

  if (interaction.commandName === 'dm-all') {
    const message = interaction.options.getString('message')
    const imageUrl = interaction.options.getString('image') || null

    await interaction.reply({ content: 'Chargement des membres...', ephemeral: true })

    const guild = await client.guilds.fetch(GUILD_ID)
    await guild.members.fetch()
    const members = guild.members.cache.filter(m => !m.user.bot)

    await sendDMToMembers(members, message, imageUrl, interaction)
  }

  if (interaction.commandName === 'dm-role') {
    const role = interaction.options.getRole('role')
    const message = interaction.options.getString('message')
    const imageUrl = interaction.options.getString('image') || null

    await interaction.reply({ content: `Chargement des membres avec le rôle ${role.name}...`, ephemeral: true })

    const guild = await client.guilds.fetch(GUILD_ID)
    await guild.members.fetch()
    const members = guild.members.cache.filter(m => !m.user.bot && m.roles.cache.has(role.id))

    await sendDMToMembers(members, message, imageUrl, interaction)
  }
})

client.login(TOKEN)
