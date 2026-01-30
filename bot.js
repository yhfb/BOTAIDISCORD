import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import fs from "fs";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CF_KEY = process.env.CF_KEY;
const CF_ACC = process.env.CF_ACC;
const ALLOWED_CHANNEL = process.env.ALLOWED_CHANNEL;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memory = {};
const cooldown = {};
const MAX_MEMORY = 20;
const COOLDOWN_TIME = 4000;

const CHAT_MODELS = [
  "@cf/meta/llama-3-8b-instruct",
  "@cf/qwen/qwen1.5-7b-chat",
  "@cf/mistral/mistral-7b-instruct"
];

const IMAGE_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

client.on("ready", () => {
  console.log("AI BOT ONLINE");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.channel.isThread() && msg.channel.id !== ALLOWED_CHANNEL) return;

  const now = Date.now();
  if (cooldown[msg.author.id] && now - cooldown[msg.author.id] < COOLDOWN_TIME)
    return;
  cooldown[msg.author.id] = now;

  if (msg.content.startsWith("ارسم")) {
    const prompt = msg.content.replace("ارسم", "").trim();
    try {
      const img = await generateImage(prompt);
      await msg.reply({ files: [img] });
      fs.unlinkSync(img);
    } catch {
      msg.reply("IMAGE ERROR");
    }
    return;
  }

  if (!msg.channel.isThread()) {
    const thread = await msg.startThread({
      name: `AI-${msg.author.username}`,
      autoArchiveDuration: 60
    });
    memory[thread.id] = [];
    await handleChat(thread, msg.content);
    return;
  }

  await handleChat(msg.channel, msg.content);
});

async function handleChat(channel, content) {
  const id = channel.id;
  if (!memory[id]) memory[id] = [];

  memory[id].push({ role: "user", content });
  if (memory[id].length > MAX_MEMORY)
    memory[id] = memory[id].slice(-MAX_MEMORY);

  try {
    const reply = await askCloudflareChat(memory[id]);
    memory[id].push({ role: "assistant", content: reply });
    channel.send(reply);
  } catch {
    channel.send("CHAT ERROR");
  }
}

async function askCloudflareChat(messages) {
  for (const model of CHAT_MODELS) {
    try {
      const res = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACC}/ai/run/${model}`,
        { messages },
        {
          headers: {
            Authorization: `Bearer ${CF_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      return res.data.result.response;
    } catch {}
  }
  throw new Error("ALL MODELS FAIL");
}

async function generateImage(prompt) {
  const res = await axios.post(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACC}/ai/run/${IMAGE_MODEL}`,
    { prompt },
    {
      headers: {
        Authorization: `Bearer ${CF_KEY}`,
        "Content-Type": "application/json"
      },
      responseType: "arraybuffer"
    }
  );
  const file = `img_${Date.now()}.png`;
  fs.writeFileSync(file, Buffer.from(res.data));
  return file;
}

client.login(DISCORD_TOKEN);
