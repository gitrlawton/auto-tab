// Content script to handle text field detection and suggestion display

// Configuration
const config = {
  minCharsForSuggestion: 10, // Minimum characters before showing suggestions
  debounceTime: 500, // Time in ms to wait after typing stops
  ignoredElements: ["password"], // Input types to ignore
};

// State
let typingTimer = null;
let suggestionBox = null;
let lastText = "";
let activeElement = null;
let isModelAvailable = false;

// Initialize
function init() {
  checkModelAvailability();
  setupEventListeners();
  createSuggestionBox();
}

// Check if the Gemini model is available
function checkModelAvailability() {
  chrome.runtime.sendMessage(
    { action: "checkModelAvailability" },
    (response) => {
      isModelAvailable = response && response.isAvailable === true;
      console.log("Model availability:", isModelAvailable);
    }
  );
}

// Setup event listeners for text inputs
function setupEventListeners() {
  // Listen for focus events on input fields and text areas
  document.addEventListener("focusin", (event) => {
    if (isTextInputElement(event.target)) {
      activeElement = event.target;
    }
  });

  // Listen for blur events
  document.addEventListener("focusout", (event) => {
    if (event.target === activeElement) {
      activeElement = null;
      hideSuggestion();
    }
  });

  // Listen for input events (when user types)
  document.addEventListener("input", (event) => {
    if (!isModelAvailable || !isTextInputElement(event.target)) return;

    activeElement = event.target;
    const text = getInputText(activeElement);

    // Only process if text is long enough
    if (text.length >= config.minCharsForSuggestion) {
      // Debounce the typing event
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        if (text !== lastText) {
          requestCompletion(text);
          lastText = text;
        }
      }, config.debounceTime);
    } else {
      hideSuggestion();
    }
  });

  // Listen for keydown events
  document.addEventListener("keydown", (event) => {
    // If Tab key and suggestion is visible, accept suggestion
    if (
      event.key === "Tab" &&
      suggestionBox &&
      suggestionBox.style.display === "block"
    ) {
      const suggestion = suggestionBox.textContent;
      if (suggestion) {
        event.preventDefault();
        acceptSuggestion();
      }
    }
    // If Escape key and suggestion is visible, hide suggestion
    else if (
      event.key === "Escape" &&
      suggestionBox &&
      suggestionBox.style.display === "block"
    ) {
      event.preventDefault();
      hideSuggestion();
    }
  });
}

// Check if element is a text input
function isTextInputElement(element) {
  if (!element) return false;

  // Check if it's an input or textarea
  if (element.tagName === "TEXTAREA") return true;

  if (element.tagName === "INPUT") {
    const type = element.getAttribute("type")?.toLowerCase() || "text";
    return (
      !config.ignoredElements.includes(type) &&
      (type === "text" ||
        type === "email" ||
        type === "search" ||
        type === "url")
    );
  }

  // Check if it's a contenteditable element
  return element.isContentEditable;
}

// Get text from input element
function getInputText(element) {
  if (!element) return "";

  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    return element.value;
  }

  if (element.isContentEditable) {
    return element.textContent;
  }

  return "";
}

// Request completion from background script
function requestCompletion(text) {
  chrome.runtime.sendMessage(
    { action: "getTextCompletion", text },
    (response) => {
      if (response && response.completion && !response.error) {
        showSuggestion(text, response.completion);
      } else if (response && response.error) {
        console.error("Completion error:", response.error);
      }
    }
  );
}

// Create suggestion box element
function createSuggestionBox() {
  if (suggestionBox) return;

  suggestionBox = document.createElement("div");
  suggestionBox.className = "gemini-autocompletion-suggestion";
  suggestionBox.addEventListener("click", acceptSuggestion);
  document.body.appendChild(suggestionBox);
}

// Show suggestion box with completion
function showSuggestion(originalText, completion) {
  if (!suggestionBox || !activeElement) return;

  // Determine what to show as suggestion (only the new part)
  let suggestionText = "";

  if (completion.startsWith(originalText)) {
    // Extract just the new part
    suggestionText = completion.substring(originalText.length);
  } else {
    // If the model returned something that doesn't start with original text
    // Don't add ellipsis, just use the completion directly
    suggestionText = completion;
  }

  // Ensure suggestionText is clean and non-empty
  suggestionText = suggestionText.trim();

  if (!suggestionText) {
    hideSuggestion();
    return;
  }

  // Position the suggestion box
  positionSuggestionBox();

  // Show suggestion
  suggestionBox.textContent = suggestionText;
  suggestionBox.style.display = "block";
  suggestionBox.classList.add("visible");
}

// Position suggestion box near the cursor
function positionSuggestionBox() {
  if (!activeElement || !suggestionBox) return;

  const rect = activeElement.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  let { top, left, height } = rect;

  // Calculate position - place below the input field
  suggestionBox.style.top = `${top + height + scrollY}px`;
  suggestionBox.style.left = `${left + scrollX}px`;
}

// Accept suggestion and apply to input
function acceptSuggestion() {
  if (
    !suggestionBox ||
    !activeElement ||
    suggestionBox.style.display !== "block"
  )
    return;

  const currentText = getInputText(activeElement);
  let suggestion = suggestionBox.textContent;

  // Add a leading space if needed (when the suggestion doesn't start with space
  // and the current text doesn't end with space)
  if (
    suggestion.length > 0 &&
    !suggestion.startsWith(" ") &&
    currentText.length > 0 &&
    !currentText.endsWith(" ")
  ) {
    suggestion = " " + suggestion;
  }

  // Apply suggestion
  if (
    activeElement.tagName === "TEXTAREA" ||
    activeElement.tagName === "INPUT"
  ) {
    activeElement.value = currentText + suggestion;

    // Set cursor position to the end
    activeElement.selectionStart = activeElement.selectionEnd =
      activeElement.value.length;
  } else if (activeElement.isContentEditable) {
    activeElement.textContent = currentText + suggestion;

    // For contentEditable elements, we need to use range/selection
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(activeElement);
    range.collapse(false); // collapse to the end
    selection.removeAllRanges();
    selection.addRange(range);
  }

  hideSuggestion();

  // Trigger input event to notify the page
  const inputEvent = new Event("input", { bubbles: true });
  activeElement.dispatchEvent(inputEvent);

  // Update lastText to prevent repeated suggestions
  lastText = getInputText(activeElement);
}

// Hide suggestion box
function hideSuggestion() {
  if (!suggestionBox) return;
  suggestionBox.style.display = "none";
  suggestionBox.classList.remove("visible");
}

// Initialize when content script loads
init();
