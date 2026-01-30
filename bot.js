import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import fs from "fs";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const HF_KEY = process.env.HF_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memory = {};
const MAX_MEMORY = 15;
const MODELS = [
  "HuggingFaceH4/zephyr-7b-beta",
  "mistralai/Mistral-7B-Instruct-v0.2",
  "meta-llama/Llama-2-7b-chat-hf"
];

client.on("ready", () => {
  console.log("AI BOT ONLINE PRO");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (msg.content.startsWith("ارسم")) {
    const prompt = msg.content.replace("ارسم", "").trim();
    try {
      const img = await generateImage(prompt);
      await msg.reply({ files: [img] });
      fs.unlinkSync(img);
    } catch (e) {
      logError("IMAGE", e);
      msg.reply("ERROR IMAGE");
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

// ===== Chat Core =====
async function handleChat(channel, content) {
  const id = channel.id;
  if (!memory[id]) memory[id] = [];

  memory[id].push({ role: "user", content });
  if (memory[id].length > MAX_MEMORY)
    memory[id] = memory[id].slice(-MAX_MEMORY);

  try {
    const reply = await askChatSmart(memory[id]);
    memory[id].push({ role: "assistant", content: reply });
    sendLong(channel, reply);
  } catch (e) {
    logError("CHAT", e);
    channel.send("الذكاء الاصطناعي مشغول حالياً");
  }
}

// ===== Smart Chat =====
async function askChatSmart(messages) {
  for (const model of MODELS) {
    try {
      const res = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          inputs: messages.map(m => m.content).join("\n")
        },
        {
          headers: { Authorization: `Bearer ${HF_KEY}` },
          timeout: 30000
        }
      );
      return res.data[0].generated_text;
    } catch (e) {
      console.log("MODEL FAILED:", model);
    }
  }
  throw new Error("ALL MODELS DOWN");
}

// ===== Image =====
async function generateImage(prompt) {
  const res = await axios.post(
    "https://api-inference.huggingface.co/models/stabilityai/sdxl",
    { inputs: prompt },
    {
      headers: { Authorization: `Bearer ${HF_KEY}` },
      responseType: "arraybuffer",
      timeout: 60000
    }
  );

  const fileName = `image_${Date.now()}.png`;
  fs.writeFileSync(fileName, Buffer.from(res.data));
  return fileName;
}

// ===== Utils =====
function sendLong(channel, text) {
  const parts = text.match(/[\s\S]{1,1900}/g);
  for (const p of parts) channel.send(p);
}

function logError(type, e) {
  console.log(`${type} ERROR:`, e.response?.data || e.message);
}

client.login(DISCORD_TOKEN);
