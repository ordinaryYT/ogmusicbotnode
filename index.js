// index.js
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// ======= Lavalink nodes (your provided config) =======
const nodes = [
  {
    identifier: "Felix Node2",
    host: "node2.axmilin.in.th",
    port: 60285,
    password: "github.com/AxMilin",
    secure: false,
    // helpful retries
    retryAmount: 5,
    retryDelay: 5000,
  },
];

// Create manager
client.manager = new Manager({
  nodes,
  send: (id, payload) => {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

// Node / player events
client.manager
  .on("nodeConnect", (node) =>
    console.log(`🔌 Lavalink node connected: ${node.options.identifier || node.options.host}`)
  )
  .on("nodeError", (node, err) =>
    console.error(`❗ Lavalink node error (${node.options.identifier || node.options.host}):`, err)
  )
  .on("nodeDisconnect", (node) =>
    console.warn(`⚠️ Lavalink node disconnected: ${node.options.identifier || node.options.host}`)
  )
  .on("trackStart", (player, track) => {
    const text = client.channels.cache.get(player.textChannel);
    if (text) text.send(`🎶 Now playing: **${track.title}**`);
  })
  .on("queueEnd", (player) => {
    const text = client.channels.cache.get(player.textChannel);
    if (text) text.send("✅ Queue has ended.");
    player.destroy();
  });

// Helper: debug nodes status
function logNodesStatus() {
  console.log("=== Lavalink Nodes Status ===");
  client.manager.nodes.forEach((n) => {
    console.log(
      `• ${n.options.identifier || n.options.host}:${n.options.port} - connected=${n.connected}`
    );
  });
  console.log("=============================");
}

// Helper: wait for at least one node to be connected (timeout ms)
function waitForNode(timeout = 10000) {
  return new Promise((resolve) => {
    // if already connected, resolve immediately
    if (client.manager.nodes.some((n) => n.connected)) return resolve(true);

    const onConnect = () => {
      cleanup();
      resolve(true);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    const cleanup = () => {
      client.manager.off("nodeConnect", onConnect);
      clearTimeout(timer);
    };

    client.manager.on("nodeConnect", onConnect);
  });
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.manager.init(client.user.id);
  // give manager a moment (it will attempt node connections)
  // log node status after a short delay so you can see if it connected
  setTimeout(logNodesStatus, 2000);
});

// discord.js raw event forwarding for Erela.js voice updates
client.on("raw", (d) => client.manager.updateVoiceState(d));

// ====== Message handler (play, skip, stop) ======
client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (cmd === "!play") {
    const { channel } = message.member.voice;
    if (!channel) return message.reply("❌ You must be in a voice channel!");

    const query = args.join(" ");
    if (!query) return message.reply("❌ Please provide a search term or URL!");

    // Wait up to 10s for a node to be connected
    const hasNode = await waitForNode(10000);
    if (!hasNode) {
      // helpful debug info to user & console
      logNodesStatus();
      return message.reply(
        "❌ No available Lavalink nodes are connected. Please check your node config (host/port/password/secure) and that the node is reachable."
      );
    }

    // safe to search/create player now
    let res;
    try {
      const searchQuery = query.startsWith("http") ? query : `ytsearch:${query}`;
      res = await client.manager.search(searchQuery, message.author);
      if (!res || !res.tracks.length) return message.reply("❌ No results found.");
    } catch (err) {
      console.error("Search error:", err);
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

    // if manager hasn't connected player to a node yet, player.connect() triggers join
    try {
      if (player.state !== "CONNECTED") await player.connect();
    } catch (err) {
      console.error("Player connect error:", err);
      return message.reply("❌ Failed to connect player to a node.");
    }

    // queue and play
    player.queue.add(res.tracks[0]);
    message.reply(`✅ Queued: **${res.tracks[0].title}**`);

    // if nothing is playing start playback
    if (!player.playing && !player.paused) {
      try {
        player.play();
      } catch (err) {
        console.error("Play error:", err);
        return message.reply("❌ Failed to start playback.");
      }
    }
  }

  if (cmd === "!skip" || cmd === "!next") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");
    player.stop();
    message.reply("⏭ Skipped!");
  }

  if (cmd === "!stop") {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply("❌ Nothing playing.");
    player.destroy();
    message.reply("🛑 Stopped and left the channel!");
  }
});

// Login (make sure BOT_TOKEN env var is set)
client.login(process.env.BOT_TOKEN);
