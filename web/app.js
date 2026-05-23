const modelSelect = document.querySelector("#modelSelect");
const messagesEl = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");

const messages = [];

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
        messages: messages
          .filter((message) => message.content !== "Thinking...")
          .map((message) => ({
            role: message.role,
            content: message.content,
          })),
      }),
    });

    const data = await response.json();
    messages[thinkingIndex].content = response.ok
      ? data.reply
      : data.detail || "Request failed.";
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
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
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

renderMessages();
loadModels().catch((error) => {
  addMessage("system", error.message);
});
