# ⚡ Ash Ketchum - Pokémon Specialist & Voice Chatbot 🧢

An interactive, voice-enabled Pokémon specialist chatbot powered by **Ash Ketchum**'s energetic Pallet Town persona and encyclopedic Pokémon nerd knowledge! Ash can answer **any** question about Pokémon across all 9 Generations (Kanto through Paldea), including competitive battle mechanics (BST, IVs/EVs, damage calcs, Smogon tiers), type matchups, lore, evolutions, shiny odds, anime trivia, and glitch Pokémon.

![Ash Ketchum Chatbot](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif)

---

## ✨ Features

- **🎙️ Two-Way Real-Time Voice Chat**:
  - **Speech-to-Text (STT)**: Speak directly to Ash with push-to-talk or continuous **Hands-Free Mode** (talk to Ash like a phone call!).
  - **Text-to-Speech (TTS)**: Ash speaks back with customizable pitch, speed, and energetic Pallet Town tone.
  - Interactive sound wave equalizer and animated Ash & Pikachu avatar.
- **📱 Live Rotom-Dex Scanner**:
  - Automatic Pokémon detection from conversation.
  - Displays official **Pokémon Showdown animated battle sprites** (Gen 1 to Gen 9).
  - **✨ Shiny Sprite toggle**: Switch between normal and shiny forms with one click.
  - **🔊 Official Sound Cries**: Plays authentic Pokémon cries powered by PokéAPI.
  - **Base Stats Radar Bars**: HP, Attack, Defense, Sp. Atk, Sp. Def, Speed & Base Stat Total (BST).
  - Official Type Badges, Height, Weight, Abilities (including Hidden Abilities), and Pokédex lore.
- **🧠 Hybrid AI Intelligence**:
  - Direct integration with **Google Gemini API** (`gemini-3.8-flash` default with automatic cascading fallback to `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-1.5-flash`).
  - Enter your API key in the UI Settings modal or as `GEMINI_API_KEY` in Vercel.
  - Built-in **Smart Offline Pokédex Brain** with varied, authentic Ash dialogue when offline.
- **⚡ 100% Vercel & Cloud Ready**:
  - Pre-configured with `vercel.json` and serverless API handlers in `/api` for instant 1-click deployment.

---

## 🚀 Quick Start (Local Setup)

### 1. Clone & Install
```bash
git clone <your-github-repo-url>
cd ash_chatbot
npm install
```

### 2. Configure Environment (Optional)
Create a `.env` file (or set your key in the web app's Settings):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
*(Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/))*

### 3. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🐙 Push to GitHub

To create a new repository on GitHub and push this project:

1. **Initialize Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Ash Ketchum Pokémon Specialist & Voice Chatbot"
   ```

2. **Create a new repository on GitHub**:
   - Go to [GitHub New Repository](https://github.com/new).
   - Enter repository name: `ash-pokemon-chatbot`.
   - Choose **Public** or **Private**.
   - Do **not** initialize with a README, .gitignore, or license (they are already included).

3. **Link and Push**:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/ash-pokemon-chatbot.git
   git branch -M main
   git push -u origin main
   ```

---

## ▲ Deploy to Vercel

### Method 1: Deploy with Vercel Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Click **Import** next to your newly created `ash-pokemon-chatbot` GitHub repository.
3. In the **Environment Variables** section, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
4. Click **Deploy**!
5. Your app will be live on a `*.vercel.app` URL with full voice and Pokédex capabilities!

### Method 2: Deploy using Vercel CLI
```bash
npm install -g vercel
vercel
```
Follow the interactive prompts and add `GEMINI_API_KEY` when prompted or in your project settings.

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), CSS3 Glassmorphism, Web Speech API (Recognition + Synthesis), PokéAPI Cries & Showdown Animated Sprites.
- **Backend**: Node.js, Express.js (runs both as a standalone server and as Vercel serverless functions).
- **APIs**: Google Gemini API, PokéAPI (Official Pokémon REST API).
