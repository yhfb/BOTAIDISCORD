import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";

const DISCORD_TOKEN = "PUT_DISCORD_TOKEN_HERE";
const GROQ_KEY = "PUT_GROQ_KEY_HERE";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const memory = {};

client.on("ready", () => {
  console.log("🤖 AI BOT ONLINE");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (!msg.channel.isThread()) {
    const thread = await msg.startThread({
      name: `AI-${msg.author.username}`,
      autoArchiveDuration: 60
    });

    memory[thread.id] = [
      { role: "system", content: "أنت ذكاء اصطناعي عربي ذكي تتكلم طبيعي." },
      { role: "user", content: msg.content }
    ];

    const res = await askAI(memory[thread.id]);
    memory[thread.id].push({ role: "assistant", content: res });
    thread.send(res);
    return;
  }

  const id = msg.channel.id;
  if (!memory[id]) return;

  memory[id].push({ role: "user", content: msg.content });
  const res = await askAI(memory[id]);
  memory[id].push({ role: "assistant", content: res });
  msg.reply(res);
});

async function askAI(messages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama3-70b-8192",
      messages,
      temperature: 0.7
    },
    {
      headers: { Authorization: `Bearer ${GROQ_KEY}` }
    }
  );
  return response.data.choices[0].message.content;
}

client.login(DISCORD_TOKEN);
