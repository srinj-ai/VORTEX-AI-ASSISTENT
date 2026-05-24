const modelSelect = document.querySelector("#modelSelect");
const sessionModel = document.querySelector("#sessionModel");
const messagesEl = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const micButton = document.querySelector(".mic-button");
const clearButton = document.querySelector("#clearButton");
const temperatureInput = document.querySelector("#temperatureInput");
const temperatureValue = document.querySelector("#temperatureValue");
const maxTokensInput = document.querySelector("#maxTokensInput");
const maxTokensValue = document.querySelector("#maxTokensValue");

const systemPrompt = "You are VORTEX AI, a helpful, concise assistant. You were developed by Srinjoy Das and Utkarsh Gyan and designed by Pratyush Roy.";
const messages = [];
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

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

function updateTemperatureValue() {
  temperatureValue.textContent = Number(temperatureInput.value).toFixed(1);
}

function updateMaxTokensValue() {
  maxTokensValue.textContent = maxTokensInput.value;
}

function resizeComposer() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

function setListeningState(nextIsListening) {
  isListening = nextIsListening;
  micButton.classList.toggle("listening", isListening);
  micButton.setAttribute("aria-pressed", String(isListening));
  micButton.title = isListening ? "Stop voice input" : "Start voice input";
}

function appendTranscript(transcript) {
  const separator = messageInput.value.trim() ? " " : "";
  messageInput.value = `${messageInput.value}${separator}${transcript.trim()}`;
  resizeComposer();
  messageInput.focus();
}

function setupVoiceInput() {
  if (!SpeechRecognition) {
    micButton.disabled = true;
    micButton.title = "Voice input is not supported in this browser.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.addEventListener("result", (event) => {
    const result = event.results[event.results.length - 1];
    appendTranscript(result[0].transcript);
  });

  recognition.addEventListener("end", () => {
    setListeningState(false);
  });

  recognition.addEventListener("error", () => {
    setListeningState(false);
  });

  setListeningState(false);
}

async function sendMessage(prompt) {
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
    messages[thinkingIndex].content = response.ok
      ? data.reply
      : data.detail || "The selected model could not answer right now.";
  } catch (error) {
    messages[thinkingIndex].content = error.message;
  } finally {
    renderMessages();
    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

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
  if (!recognition) {
    return;
  }

  if (isListening) {
    recognition.stop();
    setListeningState(false);
    return;
  }

  recognition.start();
  setListeningState(true);
});

modelSelect.addEventListener("change", updateSessionModel);
temperatureInput.addEventListener("input", updateTemperatureValue);
maxTokensInput.addEventListener("input", updateMaxTokensValue);

renderMessages();
updateTemperatureValue();
updateMaxTokensValue();
setupVoiceInput();
loadModels().catch((error) => {
  addMessage("system", error.message);
});
