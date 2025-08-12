// =======================
// Simple HTTP server (Render requirement)
// =======================
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.send("✅ Discord Lavalink Music Bot is running!");
});
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// =======================
// Discord.js + Erela.js Lavalink Music Bot
// =======================
const { Client, GatewayIntentBits } = require("discord.js");
const { Manager } = require("erela.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Lavalink connection config
const nodes = [
  {
    identifier: "Felix Node2",
    host: "node2.axmilin.in.th",
    port: 60285,
    password: "github.com/AxMilin",
    secure: false
  }
];

// Create manager for Lavalink
client.manager = new Manager({
  nodes,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

// Discord ready
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
});

// Required for erela.js voice updates
client.on("raw", (d) => client.manager.updateVoiceState(d));

// Simple play/skip/stop commands
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (cmd === "play") {
    if (!message.member.voice.channel) {
      return message.reply("❌ You must be in a voice channel!");
    }

    const player = client.manager.create({
      guild: message.guild.id,
      voiceChannel: message.member.voice.channel.id,
      textChannel: message.channel.id
    });

    if (player.state !== "CONNECTED") player.connect();

    const search = args.join(" ");
    let res;
    try {
      res = await player.search(search, message.author);
      if (res.loadType === "NO_MATCHES") return message.reply("❌ No results found.");
    } catch (err) {
      return message.reply(`❌ Error: ${err.message}`);
    }

    player.queue.add(res.tracks[0]);
    message.reply(`🎶 Queued: **${res.tracks[0].title}**`);
    if (!player.playing && !player.paused && player.queue.totalSize === 1) player.play();
  }

  if (cmd === "skip") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");
    player.stop();
    message.reply("⏭ Skipped!");
  }

  if (cmd === "stop") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");
    player.destroy();
    message.reply("🛑 Stopped and left the channel!");
  }
});

// Login bot (use Render's Environment Variables for the token)
client.login(process.env.BOT_TOKEN);
