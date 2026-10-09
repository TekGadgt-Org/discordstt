const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { commandConfig, commandScope } = require('./lib/command-config');

async function main() {
  const { token, clientId, guildId } = commandConfig();
  const scope = commandScope();
  if (scope === 'guild' && !guildId) throw new Error('DISCORD_GUILD_ID is required for guild command deployment');
  const commands = fs.readdirSync(path.join(__dirname, 'commands'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => require(path.join(__dirname, 'commands', file)).data.toJSON());
  const route = scope === 'guild'
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  const data = await new REST({ version: '10' }).setToken(token).put(route, { body: commands });
  console.log(`Successfully reloaded ${data.length} ${scope} application (/) commands.`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
