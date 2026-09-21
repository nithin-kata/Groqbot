/**
 * Groq AI Chatbot - Frontend Engine
 * Handles real-time SSE streaming, Markdown parsing, code highlighting, and UI interactions.
 */

// Application State
const state = {
  conversation: [],
  isGenerating: false,
  abortController: null,
  model: 'llama-3.1-8b-instant',
  temperature: 0.7,
  systemPrompt: 'You are an intelligent, helpful, and friendly AI assistant powered by Groq and LLaMA.'
};

// DOM References
const elements = {
  chatContainer: document.getElementById('chatContainer'),
  welcomeHero: document.getElementById('welcomeHero'),
  messagesList: document.getElementById('messagesList'),
  typingIndicator: document.getElementById('typingIndicator'),
  chatForm: document.getElementById('chatForm'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  modelSelect: document.getElementById('modelSelect'),
  statusIndicator: document.getElementById('statusIndicator'),
  keyAlertBanner: document.getElementById('keyAlertBanner'),
  dismissAlertBtn: document.getElementById('dismissAlertBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  tempSlider: document.getElementById('tempSlider'),
  tempValue: document.getElementById('tempValue'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn')
};

// ============================================================================
// Initialization & Configuration
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupMarkdownRenderer();
  checkApiStatus();
  fetchModels();
  registerEventListeners();
  autoResizeTextarea();
});

// Configure Marked.js options
function setupMarkdownRenderer() {
  if (window.marked) {
    const renderer = new marked.Renderer();

    // Custom code block renderer with copy button & language header
    renderer.code = function(code, language) {
      const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
      const highlighted = hljs.highlight(code, { language: validLanguage }).value;
      const langLabel = language || 'code';

      return `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span>${langLabel}</span>
            <button type="button" class="copy-code-btn" onclick="copyCodeSnippet(this)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>
        </div>
      `;
    };

    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: true
    });
  }
}

// Global copy helper for dynamically generated code blocks
window.copyCodeSnippet = function(button) {
  const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
  if (!codeBlock) return;

  navigator.clipboard.writeText(codeBlock.innerText).then(() => {
    const originalText = button.innerHTML;
    button.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span style="color:#10B981">Copied!</span>
    `;
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
};

// ============================================================================
// Status & Models API
// ============================================================================
async function checkApiStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    if (data.configured) {
      elements.statusIndicator.className = 'status-pill status-ready';
      elements.statusIndicator.innerHTML = '<span class="status-dot"></span><span>Groq Ready</span>';
      elements.keyAlertBanner.classList.add('hidden');
    } else {
      elements.statusIndicator.className = 'status-pill status-warning';
      elements.statusIndicator.innerHTML = '<span class="status-dot"></span><span>Key Missing</span>';
      elements.keyAlertBanner.classList.remove('hidden');
    }

    if (data.default_model) {
      state.model = data.default_model;
      if (elements.modelSelect.querySelector(`option[value="${data.default_model}"]`)) {
        elements.modelSelect.value = data.default_model;
      }
    }
  } catch (err) {
    console.warn('Status check failed:', err);
    elements.statusIndicator.className = 'status-pill status-warning';
    elements.statusIndicator.innerHTML = '<span class="status-dot"></span><span>Offline</span>';
  }
}

async function fetchModels() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.models && data.models.length > 0) {
      elements.modelSelect.innerHTML = '';
      if (data.default) {
        state.model = data.default;
      }
      data.models.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = `${m.name} ${m.badge ? `(${m.badge})` : ''}`;
        if (m.id === state.model) {
          option.selected = true;
        }
        elements.modelSelect.appendChild(option);
      });
    }
  } catch (e) {
    console.warn('Could not load custom models list, using defaults.');
  }
}

// ============================================================================
// Event Listeners
// ============================================================================
function registerEventListeners() {
  // Input form submission
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  // Shift + Enter for newline, Enter for send
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Stop button
  elements.stopBtn.addEventListener('click', stopGeneration);

  // Model selection changed
  elements.modelSelect.addEventListener('change', (e) => {
    state.model = e.target.value;
  });

  // Suggestion card clicks
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      elements.userInput.value = prompt;
      elements.userInput.style.height = 'auto';
      sendMessage();
    });
  });

  // Clear chat
  elements.clearChatBtn.addEventListener('click', () => {
    if (state.conversation.length === 0) return;
    if (confirm('Clear the entire conversation?')) {
      clearChat();
    }
  });

  // Dismiss alert banner
  elements.dismissAlertBtn.addEventListener('click', () => {
    elements.keyAlertBanner.classList.add('hidden');
  });

  // Settings Modal handlers
  elements.settingsBtn.addEventListener('click', openSettingsModal);
  elements.closeModalBtn.addEventListener('click', closeSettingsModal);
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettingsModal();
  });

  elements.tempSlider.addEventListener('input', (e) => {
    elements.tempValue.textContent = e.target.value;
  });

  elements.saveSettingsBtn.addEventListener('click', () => {
    state.systemPrompt = elements.systemPromptInput.value.trim();
    state.temperature = parseFloat(elements.tempSlider.value);
    closeSettingsModal();
  });

  elements.resetSettingsBtn.addEventListener('click', () => {
    elements.systemPromptInput.value = 'You are an intelligent, helpful, and friendly AI assistant powered by Groq and LLaMA.';
    elements.tempSlider.value = '0.7';
    elements.tempValue.textContent = '0.7';
  });
}

function autoResizeTextarea() {
  elements.userInput.addEventListener('input', () => {
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 180) + 'px';
  });
}

function openSettingsModal() {
  elements.systemPromptInput.value = state.systemPrompt;
  elements.tempSlider.value = state.temperature;
  elements.tempValue.textContent = state.temperature;
  elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  elements.settingsModal.classList.add('hidden');
}

function clearChat() {
  if (state.isGenerating) {
    stopGeneration();
  }
  state.conversation = [];
  elements.messagesList.innerHTML = '';
  elements.welcomeHero.classList.remove('hidden');
}

// ============================================================================
// Chat Messaging & SSE Streaming Engine
// ============================================================================
async function sendMessage() {
  const text = elements.userInput.value.trim();
  if (!text || state.isGenerating) return;

  // Hide welcome hero on first message
  elements.welcomeHero.classList.add('hidden');

  // Add User Message
  appendMessage('user', text);
  state.conversation.push({ role: 'user', content: text });

  // Reset input field
  elements.userInput.value = '';
  elements.userInput.style.height = 'auto';
  elements.userInput.focus();

  // Create UI placeholder for Assistant Message
  const assistantBubble = createAssistantPlaceholder();
  const contentElement = assistantBubble.querySelector('.message-bubble');

  // Toggle generating state
  setGeneratingState(true);
  state.abortController = new AbortController();

  let accumulatedContent = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.conversation,
        model: state.model,
        temperature: state.temperature,
        system_prompt: state.systemPrompt,
        stream: true
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }

    // Process Server-Sent Events (SSE) Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.content) {
            accumulatedContent += parsed.content;
            renderAssistantStream(contentElement, accumulatedContent);
            scrollToBottom();
          }
        } catch (jsonErr) {
          // If JSON parse fails or is error
          if (jsonErr.message && !jsonErr.message.includes('JSON')) {
            throw jsonErr;
          }
        }
      }
    }

    // Final render without cursor
    contentElement.innerHTML = window.marked ? marked.parse(accumulatedContent) : accumulatedContent;
    state.conversation.push({ role: 'assistant', content: accumulatedContent });

  } catch (err) {
    if (err.name === 'AbortError') {
      contentElement.innerHTML += '<p><em>[Generation stopped by user]</em></p>';
      if (accumulatedContent) {
        state.conversation.push({ role: 'assistant', content: accumulatedContent });
      }
    } else {
      console.error('Chat error:', err);
      contentElement.innerHTML = `
        <div style="color: #F87171; border-left: 3px solid #EF4444; padding-left: 10px;">
          <strong>Error:</strong> ${err.message || 'Failed to generate response.'}
          <br><small style="color: #9CA3AF;">Please verify your <code>GROQ_API_KEY</code> in the <code>.env</code> file.</small>
        </div>
      `;
    }
  } finally {
    setGeneratingState(false);
    scrollToBottom();
  }
}

function stopGeneration() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  setGeneratingState(false);
}

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  if (isGenerating) {
    elements.sendBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
    elements.typingIndicator.classList.remove('hidden');
  } else {
    elements.sendBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.typingIndicator.classList.add('hidden');
  }
}

// Progressive typewriter update
function renderAssistantStream(element, text) {
  if (window.marked) {
    element.innerHTML = marked.parse(text) + '<span class="streaming-cursor"></span>';
  } else {
    element.textContent = text;
  }
}

// Append a finished message
function appendMessage(role, text) {
  const item = document.createElement('div');
  item.className = `message-item message-${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'user' ? 'U' : '⚡';

  const wrapper = document.createElement('div');
  wrapper.className = 'message-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = time;

  wrapper.appendChild(bubble);
  wrapper.appendChild(meta);

  item.appendChild(avatar);
  item.appendChild(wrapper);

  elements.messagesList.appendChild(item);
  scrollToBottom();
  return item;
}

// Create placeholder for streaming assistant response
function createAssistantPlaceholder() {
  const item = document.createElement('div');
  item.className = 'message-item message-assistant';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = '⚡';

  const wrapper = document.createElement('div');
  wrapper.className = 'message-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML = '<span class="streaming-cursor"></span>';

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const modelName = elements.modelSelect.options[elements.modelSelect.selectedIndex]?.text || 'Groq LPU';
  meta.textContent = `${modelName} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  wrapper.appendChild(bubble);
  wrapper.appendChild(meta);

  item.appendChild(avatar);
  item.appendChild(wrapper);

  elements.messagesList.appendChild(item);
  scrollToBottom();
  return item;
}

function scrollToBottom() {
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}
