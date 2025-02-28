// Background script to handle initialization and communication
let modelSession = null;

// Check if Gemini model is available and initialize it
async function initializeLanguageModel() {
  console.log("Attempting to initialize language model...");

  try {
    // First check if the AI origin trial API exists
    if (!chrome.aiOriginTrial) {
      console.error("Error: chrome.aiOriginTrial is not defined");
      return false;
    }

    // Then check if languageModel exists within aiOriginTrial
    if (!chrome.aiOriginTrial.languageModel) {
      console.error("Error: chrome.aiOriginTrial.languageModel is not defined");
      return false;
    }

    console.log("API access confirmed, checking model capabilities...");

    // Check model availability
    const capabilities =
      await chrome.aiOriginTrial.languageModel.capabilities();
    console.log("Model capabilities:", capabilities);

    if (capabilities.available === "no") {
      console.error("Language model is not available on this device");
      return false;
    }

    console.log("Model is available, creating session...");

    // Create a model session with system prompt optimized for autocomplete
    modelSession = await chrome.aiOriginTrial.languageModel.create({
      systemPrompt:
        "You are an AI assistant that helps users by suggesting what to type next, as they type. " +
        "Provide natural, helpful, and contextually appropriate suggestions.",
      temperature: 0.2, // Lower temperature for more focused completions
      topK: capabilities.defaultTopK,
    });

    console.log("Language model session created successfully:", modelSession);
    return true;
  } catch (error) {
    console.error("Detailed error initializing language model:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return false;
  }
}

// Function to safely check model availability
async function checkModelAvailability() {
  console.log("Checking model availability...");

  try {
    const capabilities =
      await chrome.aiOriginTrial.languageModel.capabilities();
    console.log("Model capabilities result:", capabilities);
    return { isAvailable: capabilities.available !== "no", capabilities };
  } catch (error) {
    console.error("Error details in checkModelAvailability:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return { isAvailable: false, error: error.message };
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);

  if (message.action === "checkModelAvailability") {
    checkModelAvailability()
      .then((result) => {
        console.log("Sending availability response:", result);
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Error checking model availability:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        sendResponse({ isAvailable: false, error: error.message });
      });
    return true; // Keeps the message channel open for async response
  }

  if (message.action === "getTextCompletion") {
    console.log("Text completion requested:", message.text);
    getTextCompletion(message.text)
      .then((completion) => {
        console.log("Completion generated:", completion);
        sendResponse({ completion });
      })
      .catch((error) => {
        console.error("Error in text completion:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        sendResponse({ error: error.message });
      });
    return true; // Keeps the message channel open for async response
  }
});

// Function to get text completion from the language model
async function getTextCompletion(text) {
  console.log("Getting text completion for:", text);

  try {
    // Check if API is available
    if (!chrome.aiOriginTrial || !chrome.aiOriginTrial.languageModel) {
      throw new Error("Language model API not available");
    }

    // Initialize model if not already done
    if (!modelSession) {
      console.log("No active session, initializing model...");
      const initialized = await initializeLanguageModel();
      if (!initialized) {
        throw new Error("Failed to initialize language model");
      }
    }

    // Check session token limits and clone if needed
    if (modelSession.tokensLeft < 100) {
      console.log("Session approaching token limit, creating new session");
      try {
        modelSession = await modelSession.clone();
        console.log("Session cloned successfully");
      } catch (cloneError) {
        console.error("Error cloning session:", {
          name: cloneError.name,
          message: cloneError.message,
          stack: cloneError.stack,
        });
        // Re-initialize instead
        const initialized = await initializeLanguageModel();
        if (!initialized) {
          throw new Error(
            "Failed to initialize new session after clone failure"
          );
        }
      }
    }

    // Generate completion prompt
    const prompt = `Try to guess the next few words for the following text.
        Keep your response to a single, concise suggestion and relevant to the current context.
        Important: Never repeat what the user has already written, and do not try to complete their sentence.
        :\n"${text}"\nContinuation:`;
    console.log("Sending prompt to model:", prompt);

    // Get completion (non-streaming for autocompletion)
    const completion = await modelSession.prompt(prompt, {
      signal: AbortSignal.timeout(3000), // 3 second timeout for fast response
    });

    console.log("Received completion:", completion);

    // Process the completion to be more concise
    let processedCompletion = completion.trim();

    // Remove the original text if it's repeated
    if (processedCompletion.includes(text)) {
      processedCompletion = processedCompletion.replace(text, "");
    }

    // Clean up the suggestion:
    // 1. Remove leading and trailing ellipses
    processedCompletion = processedCompletion
      .replace(/^\.\.\.+\s*/g, "")
      .replace(/\s*\.\.\.+$/g, "");

    // 2. Remove any outer quotation marks
    processedCompletion = processedCompletion.replace(/^"(.*)"$/g, "$1");

    // 3. Remove square brackets and their contents
    processedCompletion = processedCompletion.replace(/\[.*?\]/g, "");

    // 4. Remove any trailing periods
    processedCompletion = processedCompletion.replace(/\.\s*$/g, "");

    // 5. Remove any explanatory text with parentheses
    processedCompletion = processedCompletion.replace(/\(.*?\)/g, "");

    // 6. Remove any leading or trailing whitespace that might remain
    processedCompletion = processedCompletion.trim();

    // 7. Remove double spaces that might have been created during cleanup
    processedCompletion = processedCompletion.replace(/\s{2,}/g, " ");

    console.log("Processed completion:", processedCompletion);
    return processedCompletion;
  } catch (error) {
    console.error("Detailed error in getTextCompletion:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      textLength: text ? text.length : 0,
    });
    throw error;
  }
}

// Initialize when the extension is first installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Extension installed or updated, attempting initialization");

  try {
    // Check if API exists first
    if (!chrome) {
      console.error("chrome namespace not available");
      return;
    }
    if (!chrome.aiOriginTrial.languageModel) {
      console.error("chrome.aiOriginTrial namespace not available");
      return;
    }

    // Log before checking capabilities
    console.log("About to check capabilities");

    const capabilities =
      await chrome.aiOriginTrial.languageModel.capabilities();
    console.log("Detailed capabilities:", JSON.stringify(capabilities));

    if (capabilities.available === "no") {
      console.warn(
        "Model reports as not available, reason may be in capabilities"
      );
      return false;
    } else if (capabilities.available === "after-download") {
      console.log("Model needs to be downloaded first");
      // Add download monitoring here
    } else {
      console.log("Model is readily available");
    }

    const result = await initializeLanguageModel();
    if (result) {
      console.log("Extension initialized successfully");
    } else {
      console.warn("Extension initialized but model is not available");
    }
  } catch (error) {
    console.error(
      "Detailed error during extension initialization:",
      error.name,
      error.message,
      error.stack
    );
  }
});

// Log startup information
console.log("Background script loaded");
console.log("Chrome API status:", {
  chromeExists: typeof chrome !== "undefined",
  runtimeExists: typeof chrome !== "undefined" && !!chrome.runtime,
  aiOriginTrialExists: typeof chrome !== "undefined" && !!chrome.aiOriginTrial,
  languageModelExists:
    typeof chrome !== "undefined" &&
    !!chrome.aiOriginTrial &&
    !!chrome.aiOriginTrial.languageModel,
});
console.log("Chrome API details:", {
  chromeVersion: navigator.userAgent,
  hasAIOriginTrial: typeof chrome !== "undefined" && "aiOriginTrial" in chrome,
  hasLanguageModel:
    typeof chrome !== "undefined" &&
    chrome.aiOriginTrial &&
    "languageModel" in chrome.aiOriginTrial,
});
