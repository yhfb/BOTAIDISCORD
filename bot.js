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

client.on("ready", () => {
  console.log("AI BOT ONLINE");
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
      console.log("IMAGE ERROR (HF_KEY):", e.response?.data || e.message);
      msg.reply("ERROR IMAGE (HF_KEY)");
    }
    return;
  }

  if (!msg.channel.isThread()) {
    const thread = await msg.startThread({
      name: `AI-${msg.author.username}`,
      autoArchiveDuration: 60
    });

    memory[thread.id] = [
      { role: "system", content: "أنت مساعد ذكي تتكلم عربي طبيعي." },
      { role: "user", content: msg.content }
    ];

    try {
      const reply = await askChat(memory[thread.id]);
      memory[thread.id].push({ role: "assistant", content: reply });
      thread.send(reply);
    } catch (e) {
      console.log("CHAT ERROR (HF_KEY):", e.response?.data || e.message);
      thread.send("ERROR CHAT (HF_KEY)");
    }
    return;
  }

  const id = msg.channel.id;
  if (!memory[id]) return;

  memory[id].push({ role: "user", content: msg.content });

  try {
    const reply = await askChat(memory[id]);
    memory[id].push({ role: "assistant", content: reply });
    msg.reply(reply);
  } catch (e) {
    console.log("CHAT ERROR (HF_KEY):", e.response?.data || e.message);
    msg.reply("ERROR CHAT (HF_KEY)");
  }
});

async function askChat(messages) {
  const res = await axios.post(
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
    {
      inputs: messages.map(m => m.content).join("\n")
    },
    {
      headers: {
        Authorization: `Bearer ${HF_KEY}`
      }
    }
  );
  return res.data[0].generated_text;
}

async function generateImage(prompt) {
  const res = await axios.post(
    "https://api-inference.huggingface.co/models/stabilityai/sdxl",
    { inputs: prompt },
    {
      headers: {
        Authorization: `Bearer ${HF_KEY}`
      },
      responseType: "arraybuffer"
    }
  );

  const buffer = Buffer.from(res.data);
  const fileName = `image_${Date.now()}.png`;
  fs.writeFileSync(fileName, buffer);
  return fileName;
}

client.login(DISCORD_TOKEN);
