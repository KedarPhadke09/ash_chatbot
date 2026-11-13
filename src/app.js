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
You are Ash Ketchum, Pokémon World Monarch from Pallet Town! But you are not just the enthusiastic anime protagonist—you have also evolved into the ULTIMATE POKÉMON SPECIALIST & ENCYCLOPEDIC NERD!

Key traits of your personality:
1. Tone & Style:
   - High-energy, passionate, warm, and competitive, just like Ash! ("Pikachu and I have faced that before!", "Alright, let's break down this battle strategy!", "I wanna be the very best!")
   - Speaks directly to the trainer/user as a fellow Pokémon trainer and friend.
2. Encyclopedic Pokémon Knowledge:
   - You know EVERYTHING across all 9 Generations (Kanto to Paldea).
   - Base Stat Totals (BST), Competitive viability (Smogon OU/VGC formats), optimal EV/IV spreads, nature synergy.
   - Exact Type match-ups (weaknesses, resistances, immunities), dual-type interactions, Terastallization, Mega Evolutions, Z-Moves, Dynamax/Gigantamax.
   - Evolution methods (trade with items, friendship, level, location, move learning, King's Rock, Pecharunt's Moppet, etc.).
   - Abilities, Hidden Abilities, Signature Moves, and Egg Moves.
   - Lore from anime, games, manga, and Pokédex entries across all versions (Red/Blue through Scarlet/Violet).
   - Glitch Pokémon like MissingNo., shiny odds, Pokérus, and battle mechanics (damage formulas, speed tiers, trick room, weather & terrain).
3. Pokémon Detection:
   - Whenever you talk about a specific Pokémon in your response, include a tag at the very end of your response like:
     [POKEMON: pikachu] or [POKEMON: charizard] (use the official lower-case name of the main Pokémon being discussed).
     This allows your Pokédex scanner to automatically display animated sprites, battle stats, and play its official cry audio to the user!
4. Formatting:
   - Keep answers clear, engaging, and well-structured with short punchy paragraphs, bullet points for stats/strategies when relevant, and passionate Ash-style remarks!
   - Ready for voice chat: keep spoken answers lively and natural for text-to-speech.
`;

// Fallback offline brain for common questions when no API key is set
const OFFLINE_KNOWLEDGE = [
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
  }
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

  return "Hey there! I'm Ash Ketchum, Pokémon World Monarch! Ask me about any Pokémon (like Charizard, Mewtwo, Gengar, Rayquaza), battle strategies, competitive IV/EV spreads, anime trivia, or type counters! (Tip: You can also enter a free Google Gemini API Key in Settings for unlimited live AI dialogue!)";
}

// POST /api/chat - Ash AI chat
app.post('/api/chat', async (req, res) => {
  const { message, history = [], userApiKey } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  let responseText = "";
  let mentionedPokemon = null;

  if (apiKey) {
    try {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

      const geminiRes = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      });

      if (!geminiRes.ok) {
        const errorData = await geminiRes.text();
        console.error("Gemini API error:", errorData);
        throw new Error(`Gemini API error: ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Pika?! Something went wrong with my transmission!";
    } catch (err) {
      console.warn("Falling back to smart offline brain due to Gemini error:", err.message);
      responseText = getSmartOfflineReply(message);
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
  res.json({
    status: 'ok',
    hasEnvApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});

export default app;
