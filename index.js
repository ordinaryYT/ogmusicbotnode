const { Client, GatewayIntentBits } = require("discord.js");
const { Manager } = require("erela.js");
const express = require("express");

// Keep-alive web server
const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("Web server running"));

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// Lavalink nodes (your provided config)
const nodes = [
  {
    identifier: "Felix Node2",
    host: "node2.axmilin.in.th",
    port: 60285,
    password: "github.com/AxMilin",
    secure: false,
  },
];

// Erela.js Manager setup
client.manager = new Manager({
  nodes,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
})
  .on("nodeConnect", (node) => console.log(`Lavalink connected: ${node.options.identifier}`))
  .on("nodeError", (node, error) => console.error(`Node error: ${error.message}`))
  .on("trackStart", (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send(`🎶 Now playing: **${track.title}**`);
  })
  .on("queueEnd", (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send("✅ Queue has ended.");
    player.destroy();
  });

// Client ready event
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
});

// Raw event for Erela.js
client.on("raw", (d) => client.manager.updateVoiceState(d));

// Message commands
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
      // Auto-convert plain text to YouTube search
      const searchQuery = query.startsWith("http") ? query : `ytsearch:${query}`;
      res = await client.manager.search(searchQuery, message.author);

      if (!res.tracks.length)
        return message.reply("❌ No results found.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Error while searching.");
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

    if (!player.playing && !player.paused && !player.queue.size) player.play();
  }
});

client.login(process.env.TOKEN);
