// index.js
// =======================
// Simple HTTP server (for Render or Replit keep-alive)
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// ======= Public Lavalink node config =======
// ⚠ Public nodes are for testing. For production, run your own Lavalink.
const nodes = [
  {
    identifier: "JM Lite LAVALINK",
    host: "46.202.82.164",
    port: 1027,
    password: "jmlitelavalink",
    secure: false,
  },
];

// Create Erela.js Manager
client.manager = new Manager({
  nodes,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

// Lavalink events
client.manager
  .on("nodeConnect", (node) =>
    console.log(`🔌 Lavalink node connected: ${node.options.identifier}`)
  )
  .on("nodeError", (node, err) =>
    console.error(`❗ Lavalink node error (${node.options.identifier}):`, err)
  )
  .on("trackStart", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send(`🎶 Now playing: **${track.title}**`);
  })
  .on("queueEnd", (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send("✅ Queue has ended.");
    player.destroy();
  });

// Ready event
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
});

// Raw voice state event forwarding
client.on("raw", (d) => client.manager.updateVoiceState(d));

// ====== Message commands ======
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (cmd === "!play") {
    const { channel } = message.member.voice;
    if (!channel) return message.reply("❌ You must be in a voice channel!");

    const query = args.join(" ");
    if (!query) return message.reply("❌ Please provide a search term or URL!");

    let res;
    try {
      const searchQuery = query.startsWith("http") ? query : `ytsearch:${query}`;
      res = await client.manager.search(searchQuery, message.author);
      if (!res.tracks.length) return message.reply("❌ No results found.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Error while searching for the track.");
    }

    let player = client.manager.players.get(message.guild.id);
    if (!player) {
      player = client.manager.create({
        guild: message.guild.id,
        voiceChannel: channel.id,
        textChannel: message.channel.id,
        selfDeafen: true,
      });
    }

    if (player.state !== "CONNECTED") player.connect();

    player.queue.add(res.tracks[0]);
    message.reply(`✅ Queued: **${res.tracks[0].title}**`);

    if (!player.playing && !player.paused) player.play();
  }

  if (cmd === "!skip" || cmd === "!next") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    player.stop();
    message.reply("⏭ Skipped!");
  }

  if (cmd === "!stop") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing is playing.");
    player.destroy();
    message.reply("🛑 Stopped and left the channel!");
  }
});

// Login — set BOT_TOKEN in your environment
client.login(process.env.BOT_TOKEN);
