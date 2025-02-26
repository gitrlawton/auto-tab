// Popup functionality for managing extension settings

// Get DOM elements
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const statusDot = document.querySelector(".indicator-dot");
const enabledToggle = document.getElementById("enabled-toggle");
const minCharsSlider = document.getElementById("min-chars");
const minCharsValue = document.getElementById("min-chars-value");
const delaySlider = document.getElementById("delay-slider");
const delayValue = document.getElementById("delay-value");
const modelDetails = document.getElementById("model-details");
const testButton = document.getElementById("test-btn");

// Default settings
const defaultSettings = {
  enabled: true,
  minChars: 10,
  delay: 500,
};

// Initialize
async function init() {
  await loadSettings();
  checkModelStatus();
  setupEventListeners();
}

// Load saved settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get("geminiAutocompleteSettings");
    const settings = result.geminiAutocompleteSettings || defaultSettings;

    // Apply settings to UI
    enabledToggle.checked = settings.enabled;
    minCharsSlider.value = settings.minChars;
    minCharsValue.textContent = settings.minChars;
    delaySlider.value = settings.delay;
    delayValue.textContent = settings.delay;
  } catch (error) {
    console.error("Error loading settings:", error);
    // Use defaults on error
    applySettings(defaultSettings);
  }
}

// Save settings to storage
async function saveSettings() {
  const settings = {
    enabled: enabledToggle.checked,
    minChars: parseInt(minCharsSlider.value, 10),
    delay: parseInt(delaySlider.value, 10),
  };

  try {
    await chrome.storage.sync.set({ geminiAutocompleteSettings: settings });

    // Notify content script about updated settings
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "updateSettings",
        settings: settings,
      });
    }
  } catch (error) {
    console.error("Error saving settings:", error);
  }
}

// Apply settings to UI
function applySettings(settings) {
  enabledToggle.checked = settings.enabled;
  minCharsSlider.value = settings.minChars;
  minCharsValue.textContent = settings.minChars;
  delaySlider.value = settings.delay;
  delayValue.textContent = settings.delay;
}

// Check if the language model is available
async function checkModelStatus() {
  updateStatus("checking", "Checking...");

  try {
    // Send message to background script to check model availability
    chrome.runtime.sendMessage(
      { action: "checkModelAvailability" },
      async (response) => {
        if (response && response.isAvailable) {
          updateStatus("active", "Model available");
          await getModelCapabilities();
        } else {
          updateStatus("error", "Model unavailable");
          modelDetails.innerHTML = `<p>Gemini model is not available on this device.</p>
                                 <p>Try installing Gemini Nano or check if your device meets the requirements.</p>`;
        }
      }
    );
  } catch (error) {
    console.error("Error checking model status:", error);
    updateStatus("error", "Error checking model");
  }
}

// Get model capabilities
async function getModelCapabilities() {
  try {
    // Get capabilities from Chrome API
    const capabilities =
      await chrome.aiOriginTrial.languageModel.capabilities();

    let status = "unknown";

    switch (capabilities.available) {
      case "yes":
        status = "Available and ready to use";
        break;
      case "no":
        status = "Not available on this device";
        break;
      case "maybe":
        status = "May be available (needs user permission)";
        break;
      default:
        status = "Status unknown";
    }

    // Display model details
    modelDetails.innerHTML = `
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Default Temperature:</strong> ${capabilities.defaultTemperature}</p>
      <p><strong>Default TopK:</strong> ${capabilities.defaultTopK}</p>
      <p><strong>Max TopK:</strong> ${capabilities.maxTopK}</p>
      <p><strong>Session Token Limit:</strong> ${capabilities.maxTokens || "Unknown"}</p>
    `;
  } catch (error) {
    console.error("Error getting model capabilities:", error);
    modelDetails.innerHTML = "<p>Error retrieving model capabilities</p>";
  }
}

// Update the status indicator
function updateStatus(status, message) {
  statusText.textContent = message;
  statusDot.className = "indicator-dot";

  if (status === "active") {
    statusDot.classList.add("active");
  } else if (status === "error") {
    statusDot.classList.add("error");
  }
}

// Set up event listeners
function setupEventListeners() {
  // Toggle event
  enabledToggle.addEventListener("change", saveSettings);

  // Min chars slider
  minCharsSlider.addEventListener("input", () => {
    minCharsValue.textContent = minCharsSlider.value;
  });
  minCharsSlider.addEventListener("change", saveSettings);

  // Delay slider
  delaySlider.addEventListener("input", () => {
    delayValue.textContent = delaySlider.value;
  });
  delaySlider.addEventListener("change", saveSettings);

  // Test button
  testButton.addEventListener("click", testAutocomplete);
}

// Test autocomplete functionality
async function testAutocomplete() {
  const testText = "I'm writing an email about the upcoming";

  updateStatus("checking", "Testing...");

  try {
    chrome.runtime.sendMessage(
      { action: "getTextCompletion", text: testText },
      (response) => {
        if (response && response.completion && !response.error) {
          let suggestionText = "";
          if (response.completion.startsWith(testText)) {
            suggestionText = response.completion.substring(testText.length);
          } else {
            suggestionText = "... " + response.completion;
          }

          // Show test result in model details area
          modelDetails.innerHTML = `
            <p><strong>Test Prompt:</strong> "${testText}"</p>
            <p><strong>Suggestion:</strong> "${suggestionText}"</p>
          `;

          updateStatus("active", "Test successful");
        } else {
          updateStatus("error", "Test failed");
          modelDetails.innerHTML = `<p>Error testing autocomplete: ${response?.error || "Unknown error"}</p>`;
        }
      }
    );
  } catch (error) {
    console.error("Error testing autocomplete:", error);
    updateStatus("error", "Test failed");
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", init);
