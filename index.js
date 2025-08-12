// index.js — working setup with public node

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const { Manager } = require("erela.js");

// HTTP keep-alive server for platforms like Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive and running!"));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

//  Working public Lavalink node from Reddit post
const nodes = [
  {
    identifier: "PublicMiciumNode",
    host: "lavalink.micium-hosting.com",
    port: 80,
    password: "micium-hosting.com",
    secure: false,
  },
];

client.manager = new Manager({
  nodes,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

// Lavalink events logging
client.manager
  .on("nodeConnect", (node) =>
    console.log(`✅ Connected to node: ${node.options.identifier}`)
  )
  .on("nodeError", (node, error) =>
    console.error(`❗ Node error (${node.options.identifier}):`, error)
  )
  .on("trackStart", (player, track) => {
    const text = client.channels.cache.get(player.textChannel);
    if (text) text.send(`🎶 Now playing: **${track.title}**`);
  })
  .on("queueEnd", (player) => {
    const text = client.channels.cache.get(player.textChannel);
    if (text) text.send("✅ Queue ended.");
    player.destroy();
  });

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
});

// Important for voice updates
client.on("raw", (d) => client.manager.updateVoiceState(d));

// Commands: play, skip, stop
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  const args = message.content.trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (cmd === "!play") {
    const { channel } = message.member.voice;
    if (!channel) return message.reply("You need to be in a voice channel!");

    const query = args.join(" ");
    if (!query) return message.reply("Provide a search term or URL!");

    let res;
    try {
      const search = query.startsWith("http") ? query : `ytsearch:${query}`;
      res = await client.manager.search(search, message.author);
      if (!res.tracks.length) return message.reply("No results found.");
    } catch (err) {
      console.error(err);
      return message.reply("Search error occurred.");
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
    message.reply(`Queued: **${res.tracks[0].title}**`);
    if (!player.playing && !player.paused) player.play();
  }

  if (cmd === "!skip" || cmd === "!next") {
    const player = client.manager.players.get(message.guild.id);
    return player ? (player.stop(), message.reply("Skipped!")) : message.reply("Nothing playing.");
  }

  if (cmd === "!stop") {
    const player = client.manager.players.get(message.guild.id);
    return player ? (player.destroy(), message.reply("Stopped!")) : message.reply("Nothing playing.");
  }
});

client.login(process.env.BOT_TOKEN);
