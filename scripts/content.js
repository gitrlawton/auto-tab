// this file is where you can inject code into the page

class AutocompleteManager {
  constructor() {
    this.ghostText = null;
    this.currentField = null;
    this.suggestionText = "";
    this.observingFields = new Set();
    this.completions = {
      hello: " world! How are you today?",
      "i am": " working on a Chrome extension for text autocomplete.",
      the: " quick brown fox jumps over the lazy dog.",
      this: " is an AI-powered text completion suggestion.",
      thank: " you for using this extension!",
      "my name is": " a developer working on AI text completion.",
      please: " help me implement this feature correctly.",
      chrome: " extensions are powerful tools for enhancing web browsing.",
      text: " autocomplete makes writing faster and more efficient.",
      how: " does this text completion work?",
    };

    this.initListeners();
    console.log("AutocompleteManager initialized (standalone version)");
  }

  initListeners() {
    // Listen for keydown events on text fields
    document.addEventListener("focusin", (e) => this.handleFocusIn(e));
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));
    document.addEventListener("input", (e) => this.handleInput(e), true);
    document.addEventListener(
      "scroll",
      () => this.updateGhostTextPosition(),
      true
    );
    document.addEventListener("selectionchange", () =>
      this.handleSelectionChange()
    );

    // Listen for DOM changes to detect dynamically added text fields
    this.setupMutationObserver();
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.findAndAttachToTextFields(node);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial scan for existing text fields
    this.findAndAttachToTextFields(document.body);
  }

  findAndAttachToTextFields(rootElement) {
    const textFields = rootElement.querySelectorAll(
      'input[type="text"], textarea, [contenteditable="true"]'
    );
    textFields.forEach((field) => {
      if (!this.observingFields.has(field)) {
        this.observingFields.add(field);
        console.log("Found text field:", field.tagName, field.id || "[no id]");
      }
    });
  }

  handleFocusIn(event) {
    const target = event.target;

    if (this.isTextField(target)) {
      this.currentField = target;
      console.log(
        "Focus in text field:",
        target.tagName,
        target.id || "[no id]"
      );
      this.updateGhostTextPosition();
    } else {
      this.hideGhostText();
      this.currentField = null;
    }
  }

  handleKeyDown(event) {
    // If Tab is pressed and we have a suggestion, complete the text
    if (event.key === "Tab" && this.suggestionText && this.currentField) {
      if (this.ghostText && this.ghostText.style.display !== "none") {
        event.preventDefault();
        this.acceptSuggestion();
      }
    } else if (event.key === "Escape") {
      this.hideGhostText();
    }
  }

  handleInput(event) {
    if (!this.isTextField(event.target)) return;

    this.currentField = event.target;
    const currentText = this.getFieldText(this.currentField);
    console.log("Input detected:", currentText);

    // Get cursor position
    const cursorPosition = this.getCursorPosition(this.currentField);

    // Only get suggestions if we're at the end of the text
    if (cursorPosition === currentText.length) {
      console.log("Getting local suggestion for:", currentText);
      this.getLocalTextSuggestion(currentText);
    } else {
      this.hideGhostText();
    }
  }

  handleSelectionChange() {
    if (this.currentField) {
      // Update ghost text position if selection changes
      window.requestAnimationFrame(() => {
        this.updateGhostTextPosition();
      });
    }
  }

  // Local suggestion generation (simulating Gemini Nano)
  getLocalTextSuggestion(text) {
    if (!text || text.trim() === "") {
      this.hideGhostText();
      return;
    }

    let suggestion = "";

    // Check for matches in our predefined completions
    for (const [key, value] of Object.entries(this.completions)) {
      if (text.toLowerCase().includes(key)) {
        console.log("Match found:", key);
        suggestion = value;
        break;
      }
    }

    // If no direct match but text is long enough, give a generic completion
    if (!suggestion && text.length > 3) {
      // Generate a simple completion based on text length (simulating AI)
      const words = text.split(" ");
      const lastWord = words[words.length - 1].toLowerCase();

      if (lastWord.length >= 3) {
        if (lastWord.startsWith("a"))
          suggestion = " and the rest of this sentence";
        else if (lastWord.startsWith("b"))
          suggestion = " because that would be interesting";
        else if (lastWord.startsWith("c"))
          suggestion = " could be implemented with AI";
        else if (lastWord.startsWith("d"))
          suggestion = " during the development process";
        else if (lastWord.startsWith("e"))
          suggestion = " effectively demonstrates the concept";
        else suggestion = " would be a good example here";
      }
    }

    if (suggestion) {
      console.log("Suggesting:", suggestion);
      this.suggestionText = suggestion;
      this.showGhostText(suggestion);
    } else {
      this.hideGhostText();
    }
  }

  showGhostText(suggestion) {
    if (!suggestion || suggestion.trim() === "") {
      this.hideGhostText();
      return;
    }

    if (!this.ghostText) {
      this.createGhostElement();
    }

    this.ghostText.textContent = suggestion;
    this.ghostText.style.display = "block";
    console.log("Showing ghost text:", suggestion);
    this.updateGhostTextPosition();
  }

  hideGhostText() {
    if (this.ghostText) {
      this.ghostText.style.display = "none";
      this.suggestionText = "";
    }
  }

  createGhostElement() {
    this.ghostText = document.createElement("div");
    this.ghostText.className = "ai-autocomplete-ghost";

    // Inline styles as fallback in case the CSS file doesn't load
    this.ghostText.style.position = "fixed";
    this.ghostText.style.display = "none";
    this.ghostText.style.color = "#888";
    this.ghostText.style.pointerEvents = "none";
    this.ghostText.style.zIndex = "9999";
    this.ghostText.style.whiteSpace = "pre";
    this.ghostText.style.background = "transparent";
    this.ghostText.style.opacity = "0.7";
    this.ghostText.style.userSelect = "none";

    document.body.appendChild(this.ghostText);
    console.log("Ghost element created");
  }

  updateGhostTextPosition() {
    if (
      !this.ghostText ||
      !this.currentField ||
      this.ghostText.style.display === "none"
    )
      return;

    const fieldRect = this.currentField.getBoundingClientRect();
    const currentText = this.getFieldText(this.currentField);
    const cursorPosition = this.getCursorPosition(this.currentField);

    // Only show suggestion if cursor is at the end of the text
    if (cursorPosition !== currentText.length) {
      this.hideGhostText();
      return;
    }

    // Calculate cursor position for different field types
    let cursorCoords;

    if (
      this.currentField.tagName.toLowerCase() === "textarea" ||
      this.currentField.getAttribute("contenteditable") === "true"
    ) {
      // For textarea and contenteditable, we need to calculate position based on selection
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        cursorCoords = {
          left: rect.right,
          top: rect.top,
          height: rect.height,
        };
      } else {
        // Fallback to field position
        cursorCoords = {
          left: fieldRect.left + 5,
          top: fieldRect.top + 5,
          height:
            parseInt(getComputedStyle(this.currentField).lineHeight, 10) || 20,
        };
      }
    } else {
      // For input elements, approximate cursor position based on text width
      const textWidth = this.measureTextWidth(currentText, this.currentField);
      cursorCoords = {
        left: fieldRect.left + textWidth + 5, // 5px padding
        top: fieldRect.top,
        height: fieldRect.height,
      };
    }

    // Position the ghost text
    this.ghostText.style.left = `${cursorCoords.left}px`;
    this.ghostText.style.top = `${cursorCoords.top}px`;
    this.ghostText.style.height = `${cursorCoords.height}px`;
    this.ghostText.style.lineHeight = `${cursorCoords.height}px`;

    // Match text style from input field
    const fieldStyle = window.getComputedStyle(this.currentField);
    this.ghostText.style.fontFamily = fieldStyle.fontFamily;
    this.ghostText.style.fontSize = fieldStyle.fontSize;
    this.ghostText.style.fontWeight = fieldStyle.fontWeight;

    console.log(
      "Ghost text positioned at:",
      cursorCoords.left,
      cursorCoords.top
    );
  }

  acceptSuggestion() {
    if (!this.currentField || !this.suggestionText) return;

    const currentText = this.getFieldText(this.currentField);
    const newText = currentText + this.suggestionText;

    this.setFieldText(this.currentField, newText);
    this.hideGhostText();
    console.log("Suggestion accepted, new text:", newText);

    // Trigger input event to notify the page of the change
    this.currentField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  getFieldText(field) {
    if (
      field.tagName.toLowerCase() === "input" ||
      field.tagName.toLowerCase() === "textarea"
    ) {
      return field.value;
    } else if (field.getAttribute("contenteditable") === "true") {
      return field.textContent;
    }
    return "";
  }

  setFieldText(field, text) {
    if (
      field.tagName.toLowerCase() === "input" ||
      field.tagName.toLowerCase() === "textarea"
    ) {
      field.value = text;
    } else if (field.getAttribute("contenteditable") === "true") {
      field.textContent = text;
    }
  }

  getCursorPosition(field) {
    if (
      field.tagName.toLowerCase() === "input" ||
      field.tagName.toLowerCase() === "textarea"
    ) {
      return field.selectionStart;
    } else if (field.getAttribute("contenteditable") === "true") {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return range.startOffset;
      }
    }
    return 0;
  }

  isTextField(element) {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();
    if (tagName === "textarea") return true;
    if (
      tagName === "input" &&
      (element.type === "text" ||
        element.type === "search" ||
        element.type === "url" ||
        element.type === "email")
    )
      return true;
    if (element.getAttribute("contenteditable") === "true") return true;

    return false;
  }

  measureTextWidth(text, element) {
    // Create a hidden element to measure text width
    const measurement = document.createElement("span");
    measurement.style.visibility = "hidden";
    measurement.style.position = "absolute";
    measurement.style.whiteSpace = "pre";

    // Copy styles from the input element
    const computedStyle = window.getComputedStyle(element);
    measurement.style.fontFamily = computedStyle.fontFamily;
    measurement.style.fontSize = computedStyle.fontSize;
    measurement.style.fontWeight = computedStyle.fontWeight;
    measurement.style.letterSpacing = computedStyle.letterSpacing;

    measurement.textContent = text;
    document.body.appendChild(measurement);
    const width = measurement.getBoundingClientRect().width;
    document.body.removeChild(measurement);

    return width;
  }
}

// Initialize immediately and also on load
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  console.log("Initializing AutocompleteManager immediately");
  new AutocompleteManager();
} else {
  console.log("Setting up load listener for AutocompleteManager");
  window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM Content Loaded - initializing AutocompleteManager");
    new AutocompleteManager();
  });
}
