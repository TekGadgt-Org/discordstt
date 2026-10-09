const { Client, Events, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is required');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
client.commands = new Collection();
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((file) => file.endsWith('.js'))) {
  const command = require(path.join(__dirname, 'commands', file));
  if (command.data && command.execute) client.commands.set(command.data.name, command);
}
client.once(Events.ClientReady, (c) => console.log(`Ready! Logged in as ${c.user.tag}`));
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;
  try { await command.execute(interaction); }
  catch (error) {
    console.error(error);
    const response = { content: 'There was an error while executing this command!', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(response).catch(() => {});
    else await interaction.reply(response).catch(() => {});
  }
});
client.login(token);
