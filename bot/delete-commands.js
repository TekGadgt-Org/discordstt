const { REST, Routes } = require('discord.js');
const { commandConfig, commandScope } = require('./lib/command-config');

async function main() {
  const { token, clientId, guildId } = commandConfig();
  const scope = commandScope();
  if (scope === 'guild' && !guildId) throw new Error('DISCORD_GUILD_ID is required for guild command deletion');
  const route = scope === 'guild'
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  const dryRun = process.env.DISCORD_COMMAND_DRY_RUN === '1' || process.env.DISCORD_COMMAND_DRY_RUN === 'true';
  if (dryRun) {
    console.log(`Dry run: would delete ${scope} application commands.`);
    return;
  }
  await new REST({ version: '10' }).setToken(token).put(route, { body: [] });
  console.log(`Successfully deleted ${scope} application commands.`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
