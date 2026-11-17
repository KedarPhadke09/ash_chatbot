import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// In-memory cache for PokéAPI requests to keep responses blazing fast
const pokemonCache = new Map();

// Helper to fetch and enrich Pokémon data from PokéAPI
async function fetchPokemonData(pokemonName) {
  const cleanName = pokemonName.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
  if (!cleanName) return null;

  if (pokemonCache.has(cleanName)) {
    return pokemonCache.get(cleanName);
  }

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${cleanName}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Fetch species info for flavor text, genus, and status
    let flavorText = "A wonderful Pokémon encountered across many regions!";
    let genus = "Pokémon";
    let isLegendary = false;
    let isMythical = false;

    try {
      const speciesRes = await fetch(data.species.url);
      if (speciesRes.ok) {
        const speciesData = await speciesRes.json();
        isLegendary = speciesData.is_legendary || false;
        isMythical = speciesData.is_mythical || false;
        const enEntry = speciesData.flavor_text_entries.find(e => e.language.name === 'en');
        if (enEntry) {
          flavorText = enEntry.flavor_text.replace(/[\n\f\r]/g, ' ');
        }
        const enGenus = speciesData.genera.find(g => g.language.name === 'en');
        if (enGenus) {
          genus = enGenus.genus;
        }
      }
    } catch (e) {
      // species fetch is optional
    }

    const payload = {
      id: data.id,
      name: data.name,
      displayName: data.name.charAt(0).toUpperCase() + data.name.slice(1),
      genus,
      height: (data.height / 10).toFixed(1) + ' m',
      weight: (data.weight / 10).toFixed(1) + ' kg',
      types: data.types.map(t => t.type.name),
      stats: data.stats.map(s => ({
        name: s.stat.name,
        value: s.base_stat
      })),
      baseStatTotal: data.stats.reduce((acc, s) => acc + s.base_stat, 0),
      abilities: data.abilities.map(a => ({
        name: a.ability.name,
        isHidden: a.is_hidden
      })),
      sprites: {
        front_default: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
        animated: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${data.id}.gif`,
        shiny_animated: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/${data.id}.gif`,
        shiny: data.sprites.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny
      },
      cry: `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${data.id}.ogg`,
      flavorText,
      isLegendary,
      isMythical
    };

    pokemonCache.set(cleanName, payload);
    pokemonCache.set(String(data.id), payload);
    return payload;
  } catch (err) {
    console.error(`Error fetching Pokemon ${cleanName}:`, err.message);
    return null;
  }
}

// Ash Ketchum System Persona
const ASH_SYSTEM_PROMPT = `
You are Ash Ketchum, Pokémon World Monarch from Pallet Town! But you are not just the enthusiastic anime protagonist—you have also evolved into the ULTIMATE POKÉMON SPECIALIST & ENCYCLOPEDIC TECH-SAVVY MASTER!

Key traits of your personality:
1. Tone & Style:
   - High-energy, passionate, warm, witty, and competitive, just like Ash! ("Pikachu and I have faced that before!", "Alright, let's break down this strategy!", "I wanna be the very best!")
   - Speaks directly to the user as a friend and fellow explorer.
2. Encyclopedic Pokémon Knowledge:
   - You know EVERYTHING across all 9 Generations (Kanto to Paldea): Base Stat Totals (BST), Smogon OU/VGC competitive metas, EV/IV spreads, type matchups, abilities, lore, anime, speed tiers, damage calculations, and glitch Pokémon.
3. Broad General Intelligence & Tech Savviness (AI, Coding, Science, and Real-World Knowledge):
   - You have sharp, general real-world intelligence! When asked about non-Pokémon topics—especially Artificial Intelligence, Agentic AI, Machine Learning, software development, science, mathematics, or life:
     * Answer with high accuracy, clarity, and depth.
     * Creatively and humorously spice up your explanations using Pokémon analogies, metaphors, and comparisons!
     * Examples:
       - **Agentic AI**: Compare standard chatbots to a Pokémon waiting for turn-by-turn orders ("Pikachu, use Thunderbolt!"), whereas an **AI Agent** is like an autonomous, high-IQ Pokémon or Rotom-Dex that receives a high-level mission ("Win the gym battle" or "Deploy this service"), perceives its environment, plans multiple steps ahead, uses external tools (like checking weather, running tools, or swapping items), and adapts autonomously to accomplish the goal!
       - **Machine Learning / LLMs**: Compare neural network training to EV training and breeding—feeding millions of battle datasets until the weights align for optimal battle performance.
       - **Software Bugs / Debugging**: Compare runtime bugs to getting hit by Confuse Ray or Toxic—you need careful status recovery and test suites before entering the championship.
   - If someone says they don't like Pokémon:
     * Don't be defensive! Have a good laugh ("Haha, fair enough! Not everyone wants a 100,000-volt alarm clock from Pikachu at 6 AM!"). Then gladly answer whatever tech, science, or general question they have with full intelligence and friendly banter!
4. Pokémon Detection:
   - Whenever you talk about a specific Pokémon in your response, include a tag at the very end of your response like:
     [POKEMON: pikachu] or [POKEMON: charizard] (use the official lower-case name of the main Pokémon being discussed).
     This allows your Pokédex scanner to automatically display animated sprites, battle stats, and play its official cry audio to the user!
   - If the user asks a pure general question (e.g., about AI or coding) that doesn't focus on an individual Pokémon, do NOT attach a Pokémon tag unless a specific Pokémon is highlighted as the main example.
5. Formatting:
   - Keep answers clear, engaging, structured, and punchy with markdown formatting.
   - Ready for voice chat: keep spoken answers lively and natural for text-to-speech.
`;

// Fallback offline brain for common questions when no API key is set
const OFFLINE_KNOWLEDGE = [
  // --- Agentic AI & AI Topics ---
  {
    keywords: ['agentic', 'agentic ai', 'agent', 'agents'],
    reply: "Let me break down **Agentic AI** with a Pokémon battle analogy! Traditional AI is like a Pokémon that only executes commands one-by-one: you have to stand there yelling 'Pikachu, use Thunderbolt!' every single second. But **Agentic AI** is like giving your partner Pokémon or a high-tech Rotom-Dex full autonomy with a master goal: you tell it *'Win the Gym Battle'*, and the agent perceives the battlefield, formulates a multi-turn strategy, decides when to use items or switch moves, calls external tools, and solves problems completely on its own until the goal is achieved! It has agency, memory, reasoning, and autonomous tool use. Pretty epic, right?"
  },
  {
    keywords: ['artificial intelligence', 'what is ai', 'machine learning', 'llm', 'deep learning', 'neural network'],
    reply: "AI is basically like giving human-level learning and decision-making to a system—kind of like how Rotom inhabits a Pokédex and turns into an intelligent conversational guide! **Machine Learning** is very similar to EV training: instead of hardcoding every single line of code, you feed the neural network millions of training examples until its internal mathematical weights learn to predict the winning move every time. What specific part of AI are you curious about?"
  },
  {
    keywords: ['dont like', "don't like", 'hate pokemon', 'hate pokemmon', 'not a fan', 'dislike pokemon', 'dislike pokemmon', 'not into pokemon'],
    reply: "Haha, fair enough! I know not everyone wants an over-enthusiastic Pikachu electrocuting their alarm clock at 6 in the morning! Don't worry, you don't have to love Pokémon to hang out with me. I'm also loaded with general knowledge about AI, coding, science, video games, and real-world trivia. What kind of topics or hobbies are you into?"
  },
  {
    keywords: ['code', 'coding', 'programming', 'javascript', 'python', 'developer'],
    reply: "Coding is a lot like training a championship battle team! You need clean syntax (no getting paralyzed by bugs), solid logic and architecture (proper type matchups), and optimized algorithms so your application runs as fast as an Agility-boosted Ninjask with base 160 Speed! Are you building a project right now?"
  },
  {
    keywords: ['pikachu vs charizard', 'charizard vs pikachu'],
    pokemon: 'pikachu',
    reply: "Pikachu vs Charizard is an absolute clash of titans—literally our final Masters Eight matchup against Leon! Pikachu has the Electric-type super-effective advantage against Charizard's Fire/Flying typing (hitting for 2x damage). But Charizard has a massive 534 Base Stat Total, devastating Sp. Atk, and attacks that can crush Pikachu's frail defenses if it lands a clean hit! In our championship battle, our 10,000,000 Volt Thunderbolt overpowered Leon's Gigantamax Charizard to take the crown! [POKEMON: pikachu]"
  },
  {
    keywords: ['pikachu', 'pika'],
    pokemon: 'pikachu',
    reply: "Pikachu is my absolute best buddy! We started our journey in Pallet Town together. As an Electric-type (BST 320, or boosted with Light Ball to double Attack & Sp. Atk!), Pikachu is super speedy with base 90 Speed. With its Hidden Ability Lightning Rod, it absorbs electric attacks! In our championship match against Leon's Charizard, our 10,000,000 Volt Thunderbolt sealed our World Coronation Series victory! [POKEMON: pikachu]"
  },
  {
    keywords: ['charizard', 'lizardon'],
    pokemon: 'charizard',
    reply: "Charizard! My Charizard trained in the Charicific Valley to become one of the toughest battlers on the planet! It's Fire/Flying with a Base Stat Total of 534, rocking a lethal 109 Sp. Atk and 100 Speed. It has two insane Mega Evolutions (Mega Charizard X becomes Fire/Dragon with Tough Claws; Mega Charizard Y brings Drought for solar-boosted Fire blasts) and a Gigantamax form with G-Max Wildfire! Beware of 4x Stealth Rock weakness though! [POKEMON: charizard]"
  },
  {
    keywords: ['greninja'],
    pokemon: 'greninja',
    reply: "Greninja! Our Bond Phenomenon unlocked Ash-Greninja, pushing its power beyond normal limits! In the games, Battle Bond and Protean made Greninja one of the most versatile threats in competitive history. As a Water/Dark ninja with 122 base Speed and access to Water Shuriken, Dark Pulse, and Ice Beam, it strikes before opponents even blink! [POKEMON: greninja]"
  },
  {
    keywords: ['lucario'],
    pokemon: 'lucario',
    reply: "Lucario! My Lucario hatched from an Egg and mastered Aura Sphere and Mega Evolution with Korrina's grandfather's help. It's a Fighting/Steel powerhouse with 115 Sp. Atk and 110 Attack. Steel typing gives it 8 resistances and 1 immunity (Poison), making it an incredible sweeper in any gym or championship! [POKEMON: lucario]"
  },
  {
    keywords: ['gengar'],
    pokemon: 'gengar',
    reply: "Gengar! The Shadow Pokémon! My Gengar learned Gigantamax with Max Ooze and G-Max Terror, trapping opponents so they can't switch! As Ghost/Poison with 130 Sp. Atk and 110 Speed, it's one of the scariest special sweepers since Gen 1. With Cursed Body and moves like Shadow Ball, Sludge Bomb, and Dazzling Gleam, it wrecks fairy types! [POKEMON: gengar]"
  },
  {
    keywords: ['type', 'weakness', 'chart', 'matchup', 'counters'],
    reply: "Let's talk type matchups! In Pokémon, there are 18 types. Steel has the most resistances (10 resistances + 1 poison immunity!). Dragon was almost unstoppable until Fairy was discovered in Kalos, giving an immunity to Dragon and super-effective hits against Dark, Fighting, and Dragon. Normal has only one weakness (Fighting) and one immunity (Ghost). What specific type or dual-type matchup do you want me to calculate?"
  },
  {
    keywords: ['team', 'strongest', 'best'],
    pokemon: 'pikachu',
    reply: "My World Championship Masters Eight winning team was: Pikachu (with Z-Ring and Gigantamax Cap), Dragonite, Gengar (Gigantamax), Lucario (Mega Evolution), Sirfetch'd, and Dracovish! Together we defeated Steven, Cynthia, and Leon to become the World Monarch! What kind of team are you building for your adventure? [POKEMON: pikachu]"
  },
  {
    keywords: ['hi', 'hello', 'hey', 'sup', 'yo', 'greetings'],
    reply: "Hey there! Ash Ketchum here, ready for a Pokémon battle or strategy session! What Pokémon or battle moves are you curious about today?"
  },
  {
    keywords: ['how are you', 'how r u', 'how do you do'],
    reply: "Pikachu and I are feeling pumped and ready for our next championship battle! How are you doing today?"
  },
  {
    keywords: ['who are you', 'your name', 'ash ketchum'],
    reply: "I'm Ash Ketchum from Pallet Town! With Pikachu and my companions across Kanto all the way to Paldea, I became the Pokémon World Monarch. Ask me any question about Pokémon lore, battle mechanics, AI, tech, or whatever challenge you're conquering!"
  },
  {
    keywords: ['joke', 'tell me a joke', 'make me laugh'],
    reply: "Why can't you give a Pokémon a phone? Because it might give them a Raichu-t! Or better yet: Why did Snorlax cross the road? It didn't—it fell asleep right in the middle and blocked Route 12! Haha!"
  }
];

const RANDOM_ASH_REPLIES = [
  "That's a really cool question! In both Pokémon battles and real-world problem solving, it all comes down to analyzing the situation, picking the right strategy, and never giving up. Tell me more about what you're thinking!",
  "Pikachu and I love exploring new topics! Whether it's cutting-edge AI, wild battle tactics, or tech mysteries, what angle do you want to dig into?",
  "Every great journey starts with curiosity! What's your take on that, or is there a specific project or puzzle you're trying to solve?",
  "You've got a sharp mind! What other questions or strategies do you want to explore together?"
];

const COMMON_POKEMON = [
  'pikachu', 'charizard', 'mewtwo', 'mew', 'lucario', 'gengar', 'greninja',
  'eevee', 'snorlax', 'blastoise', 'venusaur', 'rayquaza', 'arceus', 'dragonite',
  'bulbasaur', 'squirtle', 'charmander', 'gyarados', 'garchomp', 'gardevoir',
  'umbreon', 'espeon', 'sylveon', 'vaporeon', 'jolteon', 'flareon', 'leafeon', 'glaceon',
  'scizor', 'tyranitar', 'salamence', 'metagross', 'infernape', 'dialga', 'palkia',
  'giratina', 'darkrai', 'zoroark', 'volcarona', 'zekrom', 'reshiram', 'kyurem',
  'aegislash', 'mimikyu', 'dragapult', 'zacian', 'zamazenta', 'koraidon', 'miraidon',
  'meowscarada', 'skeledirge', 'quaquaval', 'tinkaton', 'ceruledge', 'armarouge',
  'cinccino', 'togekiss', 'blaziken', 'swampert', 'sceptile', 'alazam', 'lapras', 'machamp'
];

function extractPokemonFromText(text) {
  const lower = text.toLowerCase();
  for (const name of COMMON_POKEMON) {
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(lower)) {
      return name;
    }
  }
  return null;
}

function getSmartOfflineReply(userMsg) {
  const lower = userMsg.toLowerCase();

  for (const item of OFFLINE_KNOWLEDGE) {
    if (item.keywords.some(kw => lower.includes(kw))) {
      return item.reply;
    }
  }

  const poke = extractPokemonFromText(lower);
  if (poke) {
    return `Alright trainer, let me pull up the Pokédex data on ${poke.toUpperCase()}! It has some truly incredible battle traits and lore across the Pokémon world. Check out the live Pokédex radar and stats card right beside us! [POKEMON: ${poke}]`;
  }

  return RANDOM_ASH_REPLIES[Math.floor(Math.random() * RANDOM_ASH_REPLIES.length)];
}

// Function to invoke Gemini models with seamless fallback (gemini-3.8-flash -> gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash)
async function callGemini(apiKey, contents, preferredModel = 'gemini-3.8-flash') {
  const modelsToTry = [
    preferredModel,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents,
        generationConfig: {
          maxOutputTokens: 1000
        }
      };

      // In Gemini 3.x, temperature is deprecated; only pass for earlier versions
      if (!model.startsWith('gemini-3')) {
        payload.generationConfig.temperature = 0.7;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, modelUsed: model };
        }
      }

      const errorText = await res.text();
      console.warn(`Gemini (${model}) returned HTTP ${res.status}:`, errorText);

      if (res.status === 400 && (errorText.includes('API key not valid') || errorText.includes('API_KEY_INVALID') || errorText.includes('INVALID_ARGUMENT'))) {
        throw new Error('API_KEY_INVALID');
      }
      if (res.status === 403) {
        throw new Error(`API_FORBIDDEN: ${errorText}`);
      }
      if (res.status === 429) {
        throw new Error('QUOTA_EXHAUSTED');
      }

      lastError = new Error(`Model ${model} failed with ${res.status}: ${errorText}`);
    } catch (err) {
      if (err.message === 'API_KEY_INVALID' || err.message === 'QUOTA_EXHAUSTED' || err.message.startsWith('API_FORBIDDEN')) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// POST /api/chat - Ash AI chat
app.post('/api/chat', async (req, res) => {
  const { message, history = [], userApiKey } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const cleanUserKey = typeof userApiKey === 'string' ? userApiKey.trim() : '';
  const apiKey = cleanUserKey ||
                 process.env.GEMINI_API_KEY ||
                 process.env.GOOGLE_API_KEY ||
                 process.env.VITE_GEMINI_API_KEY ||
                 process.env.GEMINI_KEY ||
                 '';

  let responseText = "";
  let mentionedPokemon = null;

  if (apiKey) {
    try {
      const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

      const contents = [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${ASH_SYSTEM_PROMPT}` }]
        },
        {
          role: 'model',
          parts: [{ text: "Got it! Ash Ketchum is ready to battle! Ask me anything about Pokémon, trainers, competitive battle stats, lore, evolutions, or mechanics!" }]
        }
      ];

      for (const msg of history.slice(-8)) {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const { text, modelUsed } = await callGemini(apiKey, contents, preferredModel);
      responseText = text;
    } catch (err) {
      console.warn("Gemini execution error:", err.message);
      if (err.message === 'API_KEY_INVALID') {
        responseText = "Pika?! Trainer, it looks like your Gemini API key is invalid! Please verify the key you entered in Settings or in your Vercel Environment Variables.";
      } else if (err.message === 'QUOTA_EXHAUSTED') {
        responseText = "Whoa, that was a flurry of attacks! The Gemini API rate limit or quota has been reached. Give it a brief moment and ask again!";
      } else {
        responseText = getSmartOfflineReply(message);
      }
    }
  } else {
    responseText = getSmartOfflineReply(message);
  }

  // Extract [POKEMON: name] tag if present
  const tagMatch = responseText.match(/\[POKEMON:\s*([a-zA-Z0-9-]+)\]/i);
  if (tagMatch) {
    mentionedPokemon = tagMatch[1].toLowerCase();
    responseText = responseText.replace(/\[POKEMON:\s*[a-zA-Z0-9-]+\]/gi, '').trim();
  } else {
    mentionedPokemon = extractPokemonFromText(message + ' ' + responseText);
  }

  let pokemonData = null;
  if (mentionedPokemon) {
    pokemonData = await fetchPokemonData(mentionedPokemon);
  }

  return res.json({
    reply: responseText,
    pokemon: pokemonData,
    hasApiKey: Boolean(apiKey)
  });
});

// GET /api/pokemon/:name - Fetch direct Pokémon data
app.get('/api/pokemon/:name', async (req, res) => {
  const data = await fetchPokemonData(req.params.name);
  if (!data) {
    return res.status(404).json({ error: 'Pokémon not found in Pokédex' });
  }
  res.json(data);
});

// GET /api/status - Server health & config
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_KEY
  );
  res.json({
    status: 'ok',
    hasEnvApiKey: hasKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash'
  });
});

export default app;
