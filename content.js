// Content script for AI-powered inline text suggestions
// Handles all types of text inputs: standard inputs, textareas, and rich text editors

// Configuration
const config = {
  minCharsForSuggestion: 10, // Minimum characters before showing suggestions
  debounceTime: 300, // Debounce time for input events (ms)
  ignoredTypes: ["password"], // Input types to ignore
  ghostTextColor: "#8a8a8a", // Color for ghost text suggestions
  ghostTextOpacity: 0.7, // Opacity for ghost text
};

// State management
let typingTimer = null;
let activeElement = null;
let lastInputText = "";
let currentSuggestion = "";
let isModelAvailable = false;
let ghostElement = null;
let tooltipElement = null;
let isPositionUpdateInProgress = false;

// Initialize the content script
function initialize() {
  console.log("Initializing AI text suggestion content script");

  // Check if the AI model is available
  checkModelAvailability();

  // Create necessary DOM elements and styles
  createGhostElements();
  injectStyles();

  // Set up event listeners
  attachEventListeners();
}

// Check if the AI model is available via background script
function checkModelAvailability() {
  chrome.runtime.sendMessage(
    { action: "checkModelAvailability" },
    (response) => {
      isModelAvailable = response && response.isAvailable === true;
      console.log("AI model availability:", isModelAvailable);
    }
  );
}

// Create ghost text and tooltip elements
function createGhostElements() {
  // Create tooltip (will be positioned globally)
  tooltipElement = document.createElement("div");
  tooltipElement.className = "ghost-tooltip";
  tooltipElement.textContent = "Press Tab to accept";
  tooltipElement.style.cssText = `
   position: absolute;
   background-color: rgba(0, 0, 0, 0.7);
   color: white;
   padding: 3px 6px;
   border-radius: 3px;
   font-size: 11px;
   z-index: 2147483647;
   pointer-events: none;
   opacity: 0;
   transition: opacity 0.2s ease;
   display: none;
 `;
  document.body.appendChild(tooltipElement);

  console.log("Ghost tooltip created and added to DOM");
}

// Inject necessary styles with !important to prevent overrides
function injectStyles() {
  const styleElement = document.createElement("style");
  styleElement.textContent = `
    .ghost-text {
      position: absolute !important;
      pointer-events: none !important;
      color: ${config.ghostTextColor} !important;
      opacity: ${config.ghostTextOpacity} !important;
      white-space: pre !important;
      z-index: 2147483647 !important;
      display: none !important;
      background: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      overflow: visible !important;
    }
    
    .ghost-text.visible {
      display: inline !important;
    }
    
    .ghost-tooltip {
      position: absolute !important;
      background-color: rgba(0, 0, 0, 0.7) !important;
      color: white !important;
      padding: 3px 6px !important;
      border-radius: 3px !important;
      font-size: 11px !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      opacity: 0 !important;
      transition: opacity 0.2s ease !important;
      display: none !important;
    }
    
    .ghost-tooltip.visible {
      opacity: 1 !important;
      display: block !important;
    }
  `;
  document.head.appendChild(styleElement);
  console.log("Ghost text styles injected");
}

// Attach all necessary event listeners
function attachEventListeners() {
  // Focus event for text inputs
  document.addEventListener("focusin", (event) => {
    if (isTextInput(event.target)) {
      activeElement = event.target;
      console.log(
        `Focus on text input: ${activeElement.tagName.toLowerCase()}`
      );
    } else {
      activeElement = null;
      hideSuggestion();
    }
  });

  // Blur event to hide suggestion when focus is lost
  document.addEventListener("focusout", (event) => {
    if (event.target === activeElement) {
      activeElement = null;
      hideSuggestion();
    }
  });

  // Input event for detecting text changes
  document.addEventListener("input", (event) => {
    if (!isModelAvailable || !isTextInput(event.target)) return;

    activeElement = event.target;
    const currentText = getElementText(activeElement);

    if (currentText.length >= config.minCharsForSuggestion) {
      // Debounce input events
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        if (currentText !== lastInputText) {
          requestTextSuggestion(currentText);
          lastInputText = currentText;
        }
      }, config.debounceTime);
    } else {
      hideSuggestion();
    }
  });

  // Keydown event for accepting suggestions with Tab
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && currentSuggestion && activeElement) {
      event.preventDefault();
      applySuggestion();
    } else if (event.key === "Escape" && currentSuggestion) {
      event.preventDefault();
      hideSuggestion();
    }
  });

  // Scroll event for inputs - sync the ghost element's scroll position
  document.addEventListener(
    "scroll",
    (event) => {
      if (
        activeElement &&
        ghostElement &&
        (event.target === activeElement || event.target.contains(activeElement))
      ) {
        if (ghostElement.scrollTop !== undefined) {
          ghostElement.scrollTop = activeElement.scrollTop;
          ghostElement.scrollLeft = activeElement.scrollLeft;
        }
      }
    },
    true
  );

  console.log("Event listeners attached");
}

// Check if an element is a text input
function isTextInput(element) {
  if (!element) return false;

  // Check for standard inputs
  if (element.tagName === "TEXTAREA") return true;

  if (element.tagName === "INPUT") {
    const type = element.getAttribute("type")?.toLowerCase() || "text";
    return (
      !config.ignoredTypes.includes(type) &&
      ["text", "email", "search", "url"].includes(type)
    );
  }

  // Check for contentEditable elements
  return element.isContentEditable;
}

// Get text from different types of inputs
function getElementText(element) {
  if (!element) return "";

  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    return element.value;
  }

  if (element.isContentEditable) {
    return element.textContent;
  }

  return "";
}

// Request text suggestion from background script
function requestTextSuggestion(text) {
  chrome.runtime.sendMessage(
    { action: "getTextCompletion", text },
    (response) => {
      if (response && response.completion && !response.error) {
        console.log("Received suggestion:", response.completion);
        displaySuggestion(text, response.completion);
      } else if (response && response.error) {
        console.error("Suggestion error:", response.error);
      }
    }
  );
}

// Display the suggestion as ghost text
function displaySuggestion(originalText, completion) {
  console.log(
    "DISPLAY - Active element:",
    activeElement.tagName,
    "isContentEditable:",
    activeElement.isContentEditable,
    "Website:",
    window.location.hostname
  );
  if (!activeElement) {
    console.log("Cannot display suggestion: No active element");
    return;
  }

  // Extract only the new part from the completion
  let suggestion = "";

  if (completion.startsWith(originalText)) {
    suggestion = completion.substring(originalText.length);
  } else {
    suggestion = completion;
  }

  suggestion = suggestion.trim();

  if (!suggestion) {
    hideSuggestion();
    return;
  }

  // Add space at the beginning if needed
  if (
    originalText.length > 0 &&
    !originalText.endsWith(" ") &&
    !suggestion.startsWith(" ")
  ) {
    suggestion = " " + suggestion;
  }

  // Store the current suggestion
  currentSuggestion = suggestion;

  // Remove any existing ghost element
  if (ghostElement) {
    ghostElement.remove();
  }

  // Create a new ghost element inside or directly after the active element
  const isContentEditable = activeElement.isContentEditable;
  const isStandardInput =
    activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA";

  if (isContentEditable) {
    console.log("Content editable?: True");
    // For contentEditable, we'll insert the ghost element at the current caret position
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    ghostElement = document.createElement("span");
    ghostElement.className = "ghost-text-contenteditable";
    ghostElement.textContent = suggestion;
    ghostElement.style.cssText = `
      display: inline;
      color: ${config.ghostTextColor};
      opacity: ${config.ghostTextOpacity};
      pointer-events: none;
      user-select: none;
      position: relative;
    `;

    // Insert at cursor position
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(false);
    range.insertNode(ghostElement);

    // Reposition selection
    range.setStartBefore(ghostElement);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (isStandardInput) {
    console.log("Content editable?: False");
    // For standard inputs, position a ghost element on top using an overlay
    const elementRect = activeElement.getBoundingClientRect();
    const styles = window.getComputedStyle(activeElement);

    // Position an overlay container
    const overlayContainer = document.createElement("div");
    overlayContainer.className = "ghost-overlay-container";
    overlayContainer.style.cssText = `
      position: absolute;
      top: ${elementRect.top + window.scrollY}px;
      left: ${elementRect.left + window.scrollX}px;
      width: ${elementRect.width}px;
      height: ${elementRect.height}px;
      overflow: hidden;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(overlayContainer);

    // Create mirror of input with full text including suggestion
    ghostElement = document.createElement("div");
    ghostElement.className = "ghost-text-mirror";

    // Copy all visual styles
    const stylesToCopy = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "textTransform",
      "wordSpacing",
      "textIndent",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
      "width",
      "height",
      "boxSizing",
      "borderRadius",
      "textAlign",
    ];

    stylesToCopy.forEach((style) => {
      ghostElement.style[style] = styles[style];
    });

    // Additional styles
    ghostElement.style.cssText += `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    // Get current text and append suggestion with different color
    const currentText = getElementText(activeElement);
    ghostElement.innerHTML =
      escapeHTML(currentText) +
      `<span style="color: ${config.ghostTextColor}; opacity: ${config.ghostTextOpacity};">` +
      escapeHTML(suggestion) +
      "</span>";

    // Append to overlay container
    overlayContainer.appendChild(ghostElement);

    // Update scrolling to match active element
    ghostElement.scrollTop = activeElement.scrollTop;
    ghostElement.scrollLeft = activeElement.scrollLeft;
  }

  // Position tooltip below the input
  const elementRect = activeElement.getBoundingClientRect();
  tooltipElement.style.left = `${elementRect.left + window.scrollX}px`;
  tooltipElement.style.top = `${elementRect.bottom + window.scrollY + 5}px`;
  tooltipElement.style.display = "block";
  tooltipElement.style.opacity = "1";
}

// Get accurate caret position for placing ghost text
function getCaretCoordinates() {
  try {
    if (!activeElement) return null;

    const isStandardInput =
      activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA";
    const isEditableDiv = activeElement.isContentEditable;

    // For contentEditable elements - use selection API
    if (isEditableDiv) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);

      // Create a range at the caret position
      const caretRange = range.cloneRange();
      caretRange.collapse(false); // Collapse to end

      // Get bounding rect of the caret
      const rect = caretRange.getBoundingClientRect();

      return {
        x: rect.left,
        y: rect.top,
        height: rect.height,
      };
    }

    // For standard inputs and textareas - create a mirror
    if (isStandardInput) {
      const styles = window.getComputedStyle(activeElement);
      const elementRect = activeElement.getBoundingClientRect();

      // Get selection position
      const cursorPosition = activeElement.selectionEnd;

      // Create mirror element to calculate position
      const mirror = document.createElement("div");
      mirror.style.cssText = `
        position: absolute;
        overflow: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        top: 0;
        left: 0;
        visibility: hidden;
        width: ${activeElement.clientWidth}px;
      `;

      // Copy all relevant styles
      const stylesToCopy = [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "letterSpacing",
        "lineHeight",
        "textTransform",
        "wordSpacing",
        "textIndent",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
        "borderLeft",
        "borderRight",
        "borderTop",
        "borderBottom",
      ];

      stylesToCopy.forEach((style) => {
        mirror.style[style] = styles[style];
      });

      // Get text before cursor
      const text = activeElement.value || "";
      const textBeforeCursor = text.substring(0, cursorPosition);

      // Handle newlines for textareas
      if (activeElement.tagName === "TEXTAREA") {
        const lines = textBeforeCursor.split("\n");
        lines.forEach((line, index) => {
          const span = document.createElement("span");
          span.textContent = line + (index < lines.length - 1 ? "\n" : "");
          mirror.appendChild(span);
        });
      } else {
        mirror.textContent = textBeforeCursor;
      }

      // Add a span to represent cursor position
      const endSpan = document.createElement("span");
      endSpan.id = "cursor-position";
      endSpan.textContent = "."; // Needs content for getBoundingClientRect to work
      mirror.appendChild(endSpan);

      // Append to body to calculate dimensions
      document.body.appendChild(mirror);

      // Get cursor position
      const cursorSpan = document.getElementById("cursor-position");
      const spanRect = cursorSpan.getBoundingClientRect();

      // Clean up
      document.body.removeChild(mirror);

      // Calculate offsets
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      const borderTop = parseFloat(styles.borderTopWidth) || 0;

      return {
        x: elementRect.left + spanRect.left - mirror.scrollLeft + borderLeft,
        y: elementRect.top + spanRect.top - mirror.scrollTop + borderTop,
        height: parseFloat(styles.lineHeight) || spanRect.height,
      };
    }
  } catch (error) {
    console.error("Error getting caret position:", error);

    // Fallback to basic positioning
    if (activeElement) {
      const rect = activeElement.getBoundingClientRect();
      return {
        x: rect.left + 5,
        y: rect.top + 5,
        height: 20,
      };
    }
  }

  return null;
}

// Update ghost element position based on caret
function updateGhostPosition() {
  if (isPositionUpdateInProgress || !activeElement || !currentSuggestion)
    return;

  try {
    isPositionUpdateInProgress = true;

    // Get caret coordinates
    const caret = getCaretCoordinates();
    if (!caret) return;

    // Get styles from active element
    const styles = window.getComputedStyle(activeElement);

    // Position ghost text at caret
    ghostElement.style.left = `${caret.x + window.scrollX}px`;
    ghostElement.style.top = `${caret.y + window.scrollY}px`;

    // Copy text styles from active element
    ghostElement.style.fontFamily = styles.fontFamily;
    ghostElement.style.fontSize = styles.fontSize;
    ghostElement.style.fontWeight = styles.fontWeight;
    ghostElement.style.letterSpacing = styles.letterSpacing;
    ghostElement.style.lineHeight = styles.lineHeight;
    ghostElement.style.textTransform = styles.textTransform;

    // Position tooltip below the input
    const elementRect = activeElement.getBoundingClientRect();
    tooltipElement.style.left = `${elementRect.left + window.scrollX}px`;
    tooltipElement.style.top = `${elementRect.bottom + window.scrollY + 5}px`;
  } finally {
    isPositionUpdateInProgress = false;
  }
}

// Apply suggestion to the input
function applySuggestion() {
  console.log(
    "APPLY - Was this triggered programmatically?",
    "Current suggestion:",
    currentSuggestion,
    "Website:",
    window.location.hostname
  );
  if (!activeElement || !currentSuggestion) return;

  const currentText = getElementText(activeElement);

  // Apply suggestion based on input type
  if (
    activeElement.tagName === "TEXTAREA" ||
    activeElement.tagName === "INPUT"
  ) {
    // Standard inputs
    activeElement.value = currentText + currentSuggestion;
    activeElement.selectionStart = activeElement.selectionEnd =
      activeElement.value.length;
  } else if (activeElement.isContentEditable) {
    // ContentEditable elements - simply remove the ghost element
    if (ghostElement && ghostElement.parentNode) {
      const textNode = document.createTextNode(currentSuggestion);
      ghostElement.parentNode.replaceChild(textNode, ghostElement);

      // Move cursor to end
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // Hide suggestion
  hideSuggestion();

  // Trigger input event
  const inputEvent = new Event("input", { bubbles: true });
  activeElement.dispatchEvent(inputEvent);

  // Update last text
  lastInputText = getElementText(activeElement);
}

// Hide suggestion elements
function hideSuggestion() {
  currentSuggestion = "";

  // Remove ghost elements
  if (ghostElement && ghostElement.parentNode) {
    // If it's in an overlay container, remove the container too
    const container = ghostElement.closest(".ghost-overlay-container");
    if (container) {
      container.remove();
    } else {
      ghostElement.remove();
    }
    ghostElement = null;
  }

  // Hide tooltip
  if (tooltipElement) {
    tooltipElement.style.display = "none";
    tooltipElement.style.opacity = "0";
  }
}

// Helper function to escape HTML
function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Throttle function for performance
function throttle(func, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

// Initialize on load
initialize();
