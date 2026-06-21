/**
 * web chat UI
 *
 * Chat and voice modes share the same message history and /chat API.
 * Voice uses the browser's SpeechRecognition and speechSynthesis APIs.
 */

// --- DOM references ---

// header elements
const modelSelect = document.querySelector("#modelSelect");
const sessionModel = document.querySelector("#sessionModel");
// message list element
const messagesEl = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const micButton = document.querySelector(".mic-button");
// cht settings elements
const clearButton = document.querySelector("#clearButton");
const temperatureInput = document.querySelector("#temperatureInput");
const temperatureValue = document.querySelector("#temperatureValue");
const maxTokensInput = document.querySelector("#maxTokensInput");
const maxTokensValue = document.querySelector("#maxTokensValue");
const chatModeButton = document.querySelector("#chatModeButton");
const voiceModeButton = document.querySelector("#voiceModeButton");
// voice mode elements
const voicePanel = document.querySelector("#voicePanel");
const voiceListenButton = document.querySelector("#voiceListenButton");
const voiceListenLabel = document.querySelector("#voiceListenLabel");
const voiceStatusText = document.querySelector("#voiceStatusText");
const voiceTranscriptText = document.querySelector("#voiceTranscriptText");
const voiceAutoSpeakToggle = document.querySelector("#voiceAutoSpeakToggle");
const voiceSupportHint = document.querySelector("#voiceSupportHint");
// chat panel elements
const chatPanel = document.querySelector(".chat-panel");
const voiceWave = document.querySelector("#voiceWave");

// --- App state ---

const systemPrompt =
  "You are VORTEX AI, a helpful, universal assistant. You were developed by Srinjoy Das.";

/** @type {{ role: string, content: string }[]} */
const messages = [];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let chatRecognition;
let voiceRecognition;
let isChatListening = false;
let isVoiceListening = false;
let activeMode = "chat"; // "chat" | "voice"
let isSpeaking = false;

// --- Message list ---

function addMessage(role, content) {
  messages.push({ role, content });
  renderMessages();
}

function renderMessages() {
  messagesEl.innerHTML = "";

  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "message system";
    empty.textContent = "Choose a model and start chatting.";
    messagesEl.appendChild(empty);
    return;
  }

  for (const message of messages) {
    const node = document.createElement("div");
    node.className = `message ${message.role}`;
    node.textContent = message.content;
    messagesEl.appendChild(node);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Model picker ---

async function loadModels() {
  const response = await fetch("/models");
  if (!response.ok) {
    throw new Error("Could not load models.");
  }

  const data = await response.json();
  modelSelect.innerHTML = "";

  for (const model of data.models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  }

  updateSessionModel();
}

function updateSessionModel() {
  const selected = modelSelect.options[modelSelect.selectedIndex];
  sessionModel.textContent = selected ? selected.textContent : "Select a model";
}

// --- Settings display ---

function updateTemperatureValue() {
  temperatureValue.textContent = Number(temperatureInput.value).toFixed(1);
}

function updateMaxTokensValue() {
  maxTokensValue.textContent = maxTokensInput.value;
}

function resizeComposer() {
  messageInput.style.height = "";
}

// --- Voice UI state ---

function setChatListeningState(nextIsListening) {
  isChatListening = nextIsListening;
  micButton.classList.toggle("listening", isChatListening);
  micButton.setAttribute("aria-pressed", String(isChatListening));
  micButton.title = isChatListening ? "Stop voice input" : "Start voice input";
}

function setVoiceListeningState(nextIsListening) {
  isVoiceListening = nextIsListening;
  voiceListenButton.classList.toggle("listening", isVoiceListening);
  voiceListenButton.setAttribute("aria-pressed", String(isVoiceListening));
  voiceListenLabel.textContent = isVoiceListening ? "Stop listening" : "Start listening";
  voiceStatusText.textContent = isVoiceListening ? "Listening…" : "Idle";
}

function appendTranscript(transcript) {
  const separator = messageInput.value.trim() ? " " : "";
  messageInput.value = `${messageInput.value}${separator}${transcript.trim()}`;
  resizeComposer();
  messageInput.focus();
}

/** Build the animated waveform bars shown during speech output. */
function setupVoiceWave() {
  if (!voiceWave) return;

  const totalBars = 46;
  const minHeight = 18;
  const maxHeight = 92;

  for (let index = 0; index < totalBars; index += 1) {
    const bar = document.createElement("span");
    bar.className = "voice-wave-bar";

    // Taller bars in the center, shorter at the edges
    const midpoint = (totalBars - 1) / 2;
    const distance = Math.abs(index - midpoint) / midpoint;
    const profile = 1 - Math.pow(distance, 1.2);
    const height = Math.round(minHeight + (maxHeight - minHeight) * profile);
    const duration = 680 + Math.round(Math.random() * 420);
    const delay = -Math.round(Math.random() * 900);

    bar.style.height = `${height}px`;
    bar.style.animationDuration = `${duration}ms`;
    bar.style.animationDelay = `${delay}ms`;
    voiceWave.appendChild(bar);
  }
}

function setWaveSpeakingState(isActive) {
  if (!voiceWave) return;
  voiceWave.classList.toggle("speaking", isActive);
}

/**
 * Create a one-shot speech recognition instance.
 * @param {{ onTranscript: (text: string) => void, onEnd: () => void }} handlers
 */
function buildRecognition({ onTranscript, onEnd }) {
  const instance = new SpeechRecognition();
  instance.continuous = false;
  instance.interimResults = false;
  instance.lang = "en-US";

  instance.addEventListener("result", (event) => {
    const result = event.results[event.results.length - 1];
    const transcript =
      result && result[0] && result[0].transcript ? result[0].transcript : "";
    if (transcript) {
      onTranscript(transcript);
    }
  });

  instance.addEventListener("end", () => {
    onEnd();
  });

  instance.addEventListener("error", () => {
    onEnd();
  });

  return instance;
}

function stopAllRecognition() {
  try {
    chatRecognition && chatRecognition.stop();
  } catch {}
  try {
    voiceRecognition && voiceRecognition.stop();
  } catch {}
  setChatListeningState(false);
  setVoiceListeningState(false);
}

function stopSpeaking() {
  if (!("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
  isSpeaking = false;
  setWaveSpeakingState(false);
}

function speak(text, { onEnd } = {}) {
  if (!("speechSynthesis" in window)) return;
  if (!text || !text.trim()) return;

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.addEventListener("start", () => {
    isSpeaking = true;
    voiceStatusText.textContent = "Speaking…";
    setWaveSpeakingState(true);
  });

  utterance.addEventListener("end", () => {
    isSpeaking = false;
    setWaveSpeakingState(false);
    if (activeMode === "voice") {
      voiceStatusText.textContent = isVoiceListening ? "Listening…" : "Idle";
    }
    if (onEnd) onEnd();
  });

  utterance.addEventListener("error", () => {
    isSpeaking = false;
    setWaveSpeakingState(false);
    if (activeMode === "voice") {
      voiceStatusText.textContent = "Idle";
    }
    if (onEnd) onEnd();
  });

  window.speechSynthesis.speak(utterance);
}

function setupVoiceAndChatInput() {
  if (!SpeechRecognition) {
    micButton.disabled = true;
    micButton.title = "Voice input is not supported in this browser.";
    voiceListenButton.disabled = true;
    voiceSupportHint.textContent = "Voice input not supported in this browser.";
    return;
  }

  if (!("speechSynthesis" in window)) {
    voiceSupportHint.textContent = "Speaker output not supported in this browser.";
    voiceAutoSpeakToggle.checked = false;
    voiceAutoSpeakToggle.disabled = true;
  } else {
    voiceSupportHint.textContent = "Uses free browser speech APIs.";
  }

  // Mic in chat mode: append transcript to the text box
  chatRecognition = buildRecognition({
    onTranscript: (transcript) => {
      appendTranscript(transcript);
    },
    onEnd: () => {
      setChatListeningState(false);
    },
  });

  // Voice mode: send transcript directly as a message
  voiceRecognition = buildRecognition({
    onTranscript: async (transcript) => {
      voiceTranscriptText.textContent = transcript.trim();
      if (activeMode !== "voice") return;

      stopAllRecognition();
      await sendMessage(transcript.trim(), { speakReply: voiceAutoSpeakToggle.checked });

      // If the user left voice listening ON, resume after speaking finishes.
      if (activeMode === "voice" && isVoiceListening) {
        // no-op: state isVoiceListening is already false because we stopped all
      }
    },
    onEnd: () => {
      setVoiceListeningState(false);
    },
  });

  setChatListeningState(false);
  setVoiceListeningState(false);
}

function setMode(nextMode) {
  activeMode = nextMode;
  chatModeButton.classList.toggle("active", nextMode === "chat");
  voiceModeButton.classList.toggle("active", nextMode === "voice");

  stopAllRecognition();
  stopSpeaking();

  const isVoice = nextMode === "voice";
  voicePanel.hidden = !isVoice;
  messagesEl.hidden = isVoice;
  chatForm.hidden = isVoice;
  chatPanel.classList.toggle("voice-active", isVoice);

  if (isVoice) {
    voiceStatusText.textContent = "Idle";
    voiceTranscriptText.textContent = "—";
  }
}

// --- Chat API ---

async function sendMessage(prompt, { speakReply = false } = {}) {
  sendButton.disabled = true;
  messageInput.disabled = true;

  addMessage("user", prompt);
  const thinkingIndex = messages.length;
  addMessage("assistant", "Thinking...");

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelSelect.value,
        temperature: Number(temperatureInput.value),
        max_tokens: Number(maxTokensInput.value),
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
            .filter((message) => message.content !== "Thinking...")
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        ],
      }),
    });

    const data = await response.json();
    const replyText = response.ok
      ? data.reply
      : data.detail || "The selected model could not answer right now.";
    messages[thinkingIndex].content = replyText;

    if (activeMode === "voice" && speakReply && response.ok) {
      // Some browsers require a user gesture to start speech synthesis.
      speak(replyText);
    }
  } catch (error) {
    messages[thinkingIndex].content = error.message;
  } finally {
    renderMessages();
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

// --- Event listeners ---

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = messageInput.value.trim();
  if (!prompt) {
    return;
  }

  messageInput.value = "";
  sendMessage(prompt);
});

messageInput.addEventListener("input", () => {
  resizeComposer();
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

clearButton.addEventListener("click", () => {
  messages.length = 0;
  renderMessages();
  messageInput.focus();
});

micButton.addEventListener("click", () => {
  if (!chatRecognition) {
    return;
  }

  if (isChatListening) {
    chatRecognition.stop();
    setChatListeningState(false);
    return;
  }

  stopAllRecognition();
  chatRecognition.start();
  setChatListeningState(true);
});

voiceListenButton.addEventListener("click", () => {
  if (!voiceRecognition) {
    return;
  }

  if (isVoiceListening) {
    voiceRecognition.stop();
    setVoiceListeningState(false);
    return;
  }

  stopAllRecognition();
  voiceTranscriptText.textContent = "—";
  setVoiceListeningState(true);
  voiceRecognition.start();
});

chatModeButton.addEventListener("click", () => setMode("chat"));
voiceModeButton.addEventListener("click", () => setMode("voice"));

modelSelect.addEventListener("change", updateSessionModel);
temperatureInput.addEventListener("input", updateTemperatureValue);
maxTokensInput.addEventListener("input", updateMaxTokensValue);

// --- Boot ---

renderMessages();
updateTemperatureValue();
updateMaxTokensValue();
setupVoiceWave();
setupVoiceAndChatInput();
setMode("chat");
loadModels().catch((error) => {
  addMessage("system", error.message);
});
