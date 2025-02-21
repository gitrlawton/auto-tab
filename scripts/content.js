// this file is where you can inject code into the page

function createGhostTextOverlay(textElement) {
  // Get the computed styles of the original textarea
  const computedStyle = window.getComputedStyle(textElement);
  const rect = textElement.getBoundingClientRect();

  // Create a positioned wrapper if it doesn't exist yet
  let wrapper = textElement.parentNode.querySelector(".ghost-text-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "ghost-text-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block";

    // Only wrap the element if it's not already wrapped
    if (textElement.parentNode.className !== "ghost-text-wrapper") {
      textElement.parentNode.insertBefore(wrapper, textElement);
      wrapper.appendChild(textElement);
    }
  }

  // Create or get the ghost overlay element
  let ghostEl = wrapper.querySelector(".ghost-text-overlay");
  if (!ghostEl) {
    ghostEl = document.createElement("div");
    ghostEl.className = "ghost-text-overlay";
    wrapper.appendChild(ghostEl);
  }

  // Match the exact dimensions and positioning
  ghostEl.style.position = "absolute";
  ghostEl.style.top = "0";
  ghostEl.style.left = "0";
  ghostEl.style.width = `${textElement.offsetWidth}px`;
  ghostEl.style.height = `${textElement.offsetHeight}px`;
  ghostEl.style.pointerEvents = "none";
  ghostEl.style.zIndex = "1000";
  ghostEl.style.overflow = "hidden";

  // Copy ALL text styling properties for perfect matching
  [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-indent",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "box-sizing",
    "border-width",
    "white-space",
    "word-spacing",
    "text-transform",
    "direction",
  ].forEach((property) => {
    ghostEl.style[property] = computedStyle[property];
  });

  return ghostEl;
}

function updateGhostText(textElement, suggestion) {
  const ghostEl = createGhostTextOverlay(textElement);
  const cursorPos = textElement.selectionStart;
  const text = textElement.value;

  // Get text before cursor and suggestion text
  const beforeCursor = text.substring(0, cursorPos);

  // Create spans for user text and suggestion with exact positioning
  ghostEl.innerHTML = `
    <div style="position:absolute; top:0; left:0; right:0; bottom:0; padding:inherit;">
      <span style="visibility:hidden;">${beforeCursor}</span>
      <span style="color:#888; opacity:0.7;">${suggestion}</span>
    </div>
  `;

  // For textarea scrolling sync
  ghostEl.scrollTop = textElement.scrollTop;
}

function completeText(element, suggestion) {
  // Store current state for undo
  const originalText = element.value;
  const cursorPos = element.selectionStart;

  // Apply the completion
  const newText =
    originalText.substring(0, cursorPos) +
    suggestion +
    originalText.substring(cursorPos);

  // Create a proper InputEvent to ensure undo/redo works correctly
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: suggestion,
  });

  // Set the value and trigger the event
  element.value = newText;
  element.dispatchEvent(inputEvent);

  // Set cursor position after the inserted text
  element.selectionStart = element.selectionEnd = cursorPos + suggestion.length;

  // Ensure element maintains focus
  element.focus();

  // Remove ghost text after completion
  hideGhostText(element);
}

// Handle keydown events
function handleKeyDown(event) {
  const element = event.target;

  // Handle Tab key for accepting completions
  if (event.key === "Tab" && element.ghostTextActive) {
    event.preventDefault();
    const suggestion = element.ghostTextSuggestion || "";
    if (suggestion) {
      completeText(element, suggestion);
    }
  }

  // Ensure Esc key dismisses ghost text
  if (event.key === "Escape" && element.ghostTextActive) {
    event.preventDefault();
    hideGhostText(element);
  }
}

class SuggestionManager {
  constructor() {
    this.cache = new Map();
    this.pendingRequest = null;
    this.lastRequestTime = 0;
    this.debounceTime = 300; // ms
    this.minTimeBetweenRequests = 1000; // ms
    this.currentContext = "";
    this.currentElement = null;
  }

  // Smart debouncing with cache
  async getSuggestion(element, context) {
    this.currentElement = element;
    this.currentContext = context;

    // Clear any pending request
    if (this.pendingRequest) {
      clearTimeout(this.pendingRequest);
    }

    // Check cache first
    const cachedSuggestion = this.checkCache(context);
    if (cachedSuggestion) {
      return cachedSuggestion;
    }

    // Set up debounced request
    return new Promise((resolve) => {
      this.pendingRequest = setTimeout(async () => {
        // Rate limiting
        const now = Date.now();
        const timeElapsed = now - this.lastRequestTime;

        if (timeElapsed < this.minTimeBetweenRequests) {
          await new Promise((r) =>
            setTimeout(r, this.minTimeBetweenRequests - timeElapsed)
          );
        }

        // Only proceed if this is still the active context
        if (context === this.currentContext) {
          try {
            const suggestion = await this.fetchSuggestionWithTimeout();
            this.cache.set(context, suggestion);
            this.lastRequestTime = Date.now();
            resolve(suggestion);
          } catch (error) {
            console.error("Error getting suggestion:", error);
            resolve(""); // Empty suggestion on error
          }
        } else {
          resolve(""); // Context changed, don't show outdated suggestion
        }
      }, this.debounceTime);
    });
  }

  checkCache(context) {
    // Check exact match
    if (this.cache.has(context)) {
      return this.cache.get(context);
    }

    // Check for similar contexts to reduce API calls
    for (const [cachedContext, suggestion] of this.cache.entries()) {
      if (
        context.startsWith(cachedContext) &&
        cachedContext.length > context.length * 0.8
      ) {
        return suggestion.substring(cachedContext.length - context.length);
      }
    }

    return null;
  }

  async fetchSuggestionWithTimeout() {
    // Set a timeout for the request to handle network delays
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 2000);
    });

    try {
      const requestPromise = chrome.runtime.sendMessage({
        action: "getSuggestion",
        context: this.currentContext,
      });

      // Race between the actual request and the timeout
      const response = await Promise.race([requestPromise, timeoutPromise]);
      return response.suggestion || "";
    } catch (error) {
      console.warn("Suggestion request failed:", error);
      return "";
    }
  }

  // Manage cache size to keep extension lightweight
  pruneCache() {
    if (this.cache.size > 100) {
      // Remove oldest entries
      const entriesToRemove = this.cache.size - 50;
      const entries = Array.from(this.cache.entries());
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}

// Initialize the manager
const suggestionManager = new SuggestionManager();
