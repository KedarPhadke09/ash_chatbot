// Ash Ketchum Chatbot Client Logic

// State
const state = {
  history: [],
  currentPokemon: null,
  isShiny: false,
  isSpeaking: false,
  isListening: false,
  isHandsFree: false,
  isMuted: false,
  voices: [],
  selectedVoice: null,
  pitch: 1.25,
  rate: 1.05,
  userApiKey: localStorage.getItem('ash_gemini_api_key') || '',
};

// DOM Elements
const chatHistory = document.getElementById('chatHistory');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const handsFreeBtn = document.getElementById('handsFreeBtn');
const handsFreeLabel = document.getElementById('handsFreeLabel');
const muteSpeechBtn = document.getElementById('muteSpeechBtn');
const volumeIcon = document.getElementById('volumeIcon');
const voiceIndicator = document.getElementById('voiceIndicator');
const voiceStatusText = document.getElementById('voiceStatusText');
const voiceTranscriptBanner = document.getElementById('voiceTranscriptBanner');
const liveTranscriptText = document.getElementById('liveTranscriptText');
const ashHeroCard = document.querySelector('.ash-hero-card');
const ashMouth = document.getElementById('ashMouth');
const ashQuote = document.getElementById('ashQuote');

// Pokédex DOM Elements
const pokedexEmpty = document.getElementById('pokedexEmpty');
const pokedexContent = document.getElementById('pokedexContent');
const pokeSprite = document.getElementById('pokeSprite');
const shinyToggleBtn = document.getElementById('shinyToggleBtn');
const pokeId = document.getElementById('pokeId');
const pokeName = document.getElementById('pokeName');
const pokeGenus = document.getElementById('pokeGenus');
const pokeTypes = document.getElementById('pokeTypes');
const pokeHeight = document.getElementById('pokeHeight');
const pokeWeight = document.getElementById('pokeWeight');
const pokeBst = document.getElementById('pokeBst');
const statsList = document.getElementById('statsList');
const abilityTags = document.getElementById('abilityTags');
const pokeFlavor = document.getElementById('pokeFlavor');
const playCryBtn = document.getElementById('playCryBtn');
const cryAudio = document.getElementById('cryAudio');

// Settings DOM Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const voiceSelect = document.getElementById('voiceSelect');
const pitchSlider = document.getElementById('pitchSlider');
const pitchVal = document.getElementById('pitchVal');
const rateSlider = document.getElementById('rateSlider');
const rateVal = document.getElementById('rateVal');
const testVoiceBtn = document.getElementById('testVoiceBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Quotes for Ash
const ASH_QUOTES = [
  "There's no limit to what you and your Pokémon can achieve together!",
  "Pikachu and I have faced legendaries, titans, and champions!",
  "A true Pokémon master understands both passion and battle mechanics!",
  "I choose you! Let's conquer the next Pokémon challenge!"
];

// 1. Initialize Speech Synthesis (TTS)
function initSpeechSynthesis() {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  const loadVoices = () => {
    state.voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    // Filter or rank voices
    const englishVoices = state.voices.filter(v => v.lang.startsWith('en'));
    const voicesToUse = englishVoices.length > 0 ? englishVoices : state.voices;

    voicesToUse.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });

    // Try finding young energetic voice (e.g. Google US English, Samantha, David, etc.)
    const preferredVoice = voicesToUse.find(v => 
      v.name.includes('Google US English') ||
      v.name.includes('David') ||
      v.name.includes('Guy') ||
      v.name.includes('Natural')
    ) || voicesToUse[0];

    if (preferredVoice) {
      state.selectedVoice = preferredVoice;
      voiceSelect.value = preferredVoice.name;
    }
  };

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Speak text as Ash Ketchum
function speakAsAsh(text) {
  if (state.isMuted || !('speechSynthesis' in window)) return;

  // Clean markdown tags, emojis, and brackets from spoken text for clean speech
  const cleanSpeechText = text
    .replace(/\[POKEMON:[^\]]*\]/gi, '')
    .replace(/[*_#`~]/g, '')
    .replace(/http\S+/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();

  if (!cleanSpeechText) return;

  window.speechSynthesis.cancel(); // Stop any previous speech

  const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
  if (state.selectedVoice) {
    utterance.voice = state.selectedVoice;
  }
  utterance.pitch = state.pitch;
  utterance.rate = state.rate;

  utterance.onstart = () => {
    state.isSpeaking = true;
    ashHeroCard.classList.add('speaking');
    voiceIndicator.classList.add('speaking');
    voiceStatusText.textContent = "Ash is Speaking...";
    // Animate mouth
    ashMouth.setAttribute('d', 'M42,60 Q50,70 58,60');
  };

  utterance.onend = () => {
    state.isSpeaking = false;
    ashHeroCard.classList.remove('speaking');
    voiceIndicator.classList.remove('speaking');
    ashMouth.setAttribute('d', 'M44,61 Q50,67 56,61');

    if (state.isHandsFree) {
      voiceStatusText.textContent = "Listening for you...";
      startListening();
    } else {
      voiceStatusText.textContent = "Voice Ready";
    }
  };

  utterance.onerror = (e) => {
    console.warn('Speech error:', e);
    state.isSpeaking = false;
    ashHeroCard.classList.remove('speaking');
    voiceIndicator.classList.remove('speaking');
    ashMouth.setAttribute('d', 'M44,61 Q50,67 56,61');
    voiceStatusText.textContent = "Voice Ready";
  };

  window.speechSynthesis.speak(utterance);
}

// 2. Initialize Speech Recognition (STT)
let recognition = null;

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.";
    micBtn.disabled = true;
    micBtn.style.opacity = '0.5';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    state.isListening = true;
    micBtn.classList.add('recording');
    ashHeroCard.classList.add('listening');
    voiceIndicator.classList.add('listening');
    voiceStatusText.textContent = "Listening...";
    voiceTranscriptBanner.classList.remove('hidden');
    liveTranscriptText.textContent = "Listening for your Pokémon question...";
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    liveTranscriptText.textContent = `"${transcript}"`;

    if (event.results[0].isFinal) {
      userInput.value = transcript;
      handleSendMessage(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopListening();
  };

  recognition.onend = () => {
    stopListening();
  };
}

function startListening() {
  if (state.isSpeaking) {
    window.speechSynthesis.cancel();
  }
  try {
    if (recognition && !state.isListening) {
      recognition.start();
    }
  } catch (e) {
    console.warn(e);
  }
}

function stopListening() {
  state.isListening = false;
  micBtn.classList.remove('recording');
  ashHeroCard.classList.remove('listening');
  voiceIndicator.classList.remove('listening');
  voiceTranscriptBanner.classList.add('hidden');
  voiceStatusText.textContent = state.isHandsFree ? "Hands-Free Active" : "Voice Ready";
}

// 3. Chat Messaging Flow
async function handleSendMessage(customText) {
  const text = (customText || userInput.value).trim();
  if (!text) return;

  // Add User Message to UI
  appendMessage('user', text);
  userInput.value = '';
  userInput.style.height = 'auto';

  // Add loading bubble for Ash
  const loadingBubble = appendLoadingBubble();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.history,
        userApiKey: state.userApiKey
      })
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    loadingBubble.remove();

    // Append Ash response
    appendMessage('ash', data.reply);

    // Save to conversation history
    state.history.push({ sender: 'user', text });
    state.history.push({ sender: 'ash', text: data.reply });

    // Update quote randomly
    ashQuote.textContent = `"${ASH_QUOTES[Math.floor(Math.random() * ASH_QUOTES.length)]}"`;

    // Update Pokédex if Pokémon data returned
    if (data.pokemon) {
      renderPokedex(data.pokemon);
    }

    // Voice response
    speakAsAsh(data.reply);
  } catch (err) {
    console.error('Chat error:', err);
    loadingBubble.remove();
    appendMessage('ash', "Pika-whaat?! Looks like our Poké-Comm connection got static! Check your internet or try asking again!");
  }
}

// Render message in chat history
function appendMessage(sender, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender === 'user' ? 'user-msg' : 'ash-msg'}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (sender === 'user') {
    bubble.innerHTML = `
      <div class="sender-avatar">YOU</div>
      <div class="bubble-content">
        <div class="bubble-header">
          <strong>Trainer</strong>
          <span class="time-stamp">${timeStr}</span>
        </div>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  } else {
    bubble.innerHTML = `
      <div class="sender-avatar">
        <div class="pokeball-icon tiny"></div>
      </div>
      <div class="bubble-content">
        <div class="bubble-header">
          <strong>Ash Ketchum</strong>
          <span class="time-stamp">${timeStr}</span>
        </div>
        <div class="bubble-body">${formatMarkdown(text)}</div>
      </div>
    `;
  }

  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return bubble;
}

function appendLoadingBubble() {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ash-msg loading';
  bubble.innerHTML = `
    <div class="sender-avatar">
      <div class="pokeball-icon tiny spinning"></div>
    </div>
    <div class="bubble-content">
      <div class="bubble-header">
        <strong>Ash Ketchum</strong>
        <span class="time-stamp">Consulting Rotom-Dex...</span>
      </div>
      <p>Pikachu and I are thinking...</p>
    </div>
  `;
  chatHistory.appendChild(bubble);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return bubble;
}

// 4. Pokédex Renderer
function renderPokedex(data) {
  state.currentPokemon = data;
  state.isShiny = false;
  shinyToggleBtn.textContent = "✨ Shiny";

  pokedexEmpty.classList.add('hidden');
  pokedexContent.classList.remove('hidden');

  pokeId.textContent = `#${String(data.id).padStart(3, '0')}`;
  pokeName.textContent = data.displayName;
  pokeGenus.textContent = data.genus || "Pokémon";
  pokeHeight.textContent = data.height;
  pokeWeight.textContent = data.weight;
  pokeBst.textContent = data.baseStatTotal;
  pokeFlavor.textContent = data.flavorText;

  // Sprite
  pokeSprite.src = data.sprites.animated || data.sprites.front_default;
  pokeSprite.onerror = () => {
    pokeSprite.src = data.sprites.front_default;
  };

  // Type Badges
  pokeTypes.innerHTML = '';
  data.types.forEach(type => {
    const badge = document.createElement('span');
    badge.className = `type-badge type-${type}`;
    badge.textContent = type;
    pokeTypes.appendChild(badge);
  });

  // Base Stats Radar Bars
  statsList.innerHTML = '';
  data.stats.forEach(stat => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const percent = Math.min(100, Math.round((stat.value / 200) * 100));
    const statCleanName = stat.name.replace('-', ' ');
    row.innerHTML = `
      <span class="stat-name">${statCleanName}</span>
      <span class="stat-num">${stat.value}</span>
      <div class="stat-track">
        <div class="stat-fill stat-${stat.name}" style="width: ${percent}%;"></div>
      </div>
    `;
    statsList.appendChild(row);
  });

  // Abilities
  abilityTags.innerHTML = '';
  data.abilities.forEach(ab => {
    const tag = document.createElement('span');
    tag.className = `ability-tag ${ab.isHidden ? 'hidden-ab' : ''}`;
    tag.textContent = ab.isHidden ? `${ab.name} (Hidden)` : ab.name;
    abilityTags.appendChild(tag);
  });

  // Setup Cry Audio
  if (data.cry) {
    cryAudio.src = data.cry;
    // Play cry with low volume automatically
    cryAudio.volume = 0.5;
    cryAudio.play().catch(() => {});
  }
}

// Quick Ask function for prompt pills
window.quickAsk = function(query) {
  userInput.value = query;
  handleSendMessage(query);
};

// Markdown Formatter Helper
function formatMarkdown(str) {
  return str
    .replace(/^### (.*$)/gim, '<h4 style="color:#ffcb05;margin:6px 0;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="color:#ffcb05;margin:8px 0;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br/>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 5. Event Listeners
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleSendMessage();
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Auto-expand textarea
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
});

// Mic Button (Click to toggle listening)
micBtn.addEventListener('click', () => {
  if (state.isListening) {
    recognition.stop();
  } else {
    startListening();
  }
});

// Hands Free Voice Toggle
handsFreeBtn.addEventListener('click', () => {
  state.isHandsFree = !state.isHandsFree;
  handsFreeBtn.classList.toggle('active', state.isHandsFree);
  handsFreeLabel.textContent = state.isHandsFree ? "Hands-Free: ON" : "Hands-Free: OFF";

  if (state.isHandsFree) {
    voiceStatusText.textContent = "Hands-Free Listening...";
    startListening();
  } else {
    stopListening();
  }
});

// Mute Speech Output Toggle
muteSpeechBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  muteSpeechBtn.classList.toggle('muted', state.isMuted);

  if (state.isMuted) {
    window.speechSynthesis.cancel();
    volumeIcon.innerHTML = `
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    `;
  } else {
    volumeIcon.innerHTML = `
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    `;
  }
});

// Shiny Sprite Toggle
shinyToggleBtn.addEventListener('click', () => {
  if (!state.currentPokemon) return;
  state.isShiny = !state.isShiny;
  if (state.isShiny) {
    pokeSprite.src = state.currentPokemon.sprites.shiny_animated || state.currentPokemon.sprites.shiny;
    shinyToggleBtn.textContent = "⭐ Normal";
  } else {
    pokeSprite.src = state.currentPokemon.sprites.animated || state.currentPokemon.sprites.front_default;
    shinyToggleBtn.textContent = "✨ Shiny";
  }
});

// Play Cry Button
playCryBtn.addEventListener('click', () => {
  if (cryAudio.src) {
    cryAudio.currentTime = 0;
    cryAudio.volume = 0.7;
    cryAudio.play().catch(e => console.warn(e));
  }
});

// Settings Modal Controls
settingsBtn.addEventListener('click', () => {
  apiKeyInput.value = state.userApiKey;
  pitchSlider.value = state.pitch;
  pitchVal.textContent = `${state.pitch}x`;
  rateSlider.value = state.rate;
  rateVal.textContent = `${state.rate}x`;
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add('hidden');
  }
});

pitchSlider.addEventListener('input', (e) => {
  state.pitch = parseFloat(e.target.value);
  pitchVal.textContent = `${state.pitch}x`;
});

rateSlider.addEventListener('input', (e) => {
  state.rate = parseFloat(e.target.value);
  rateVal.textContent = `${state.rate}x`;
});

voiceSelect.addEventListener('change', (e) => {
  state.selectedVoice = state.voices.find(v => v.name === e.target.value);
});

testVoiceBtn.addEventListener('click', () => {
  speakAsAsh("Pikachu, let's show them our Pallet Town spirit! Full power 10,000,000 Volt Thunderbolt!");
});

saveSettingsBtn.addEventListener('click', () => {
  state.userApiKey = apiKeyInput.value.trim();
  localStorage.setItem('ash_gemini_api_key', state.userApiKey);
  settingsModal.classList.add('hidden');
});

// Init on Page Load
window.addEventListener('DOMContentLoaded', () => {
  initSpeechSynthesis();
  initSpeechRecognition();
});
