// this file is where you can add javascript to the popup

document.addEventListener("DOMContentLoaded", function () {
  // Get UI elements
  const enableExtension = document.getElementById("enableExtension");
  const suggestionSpeed = document.getElementById("suggestionSpeed");
  const contextLength = document.getElementById("contextLength");
  const enableCurrentSite = document.getElementById("enableCurrentSite");
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");
  const openOptions = document.getElementById("openOptions");
  const reportIssue = document.getElementById("reportIssue");

  // Load saved settings
  chrome.storage.sync.get(
    {
      enabled: true,
      speed: 3,
      context: "balanced",
      siteExceptions: {},
    },
    function (items) {
      enableExtension.checked = items.enabled;
      suggestionSpeed.value = items.speed;
      contextLength.value = items.context;

      // Check if current site is enabled
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;

          // If site is in exceptions and set to disabled
          if (items.siteExceptions[domain] === false) {
            enableCurrentSite.checked = false;
            updateStatus(false);
          } else {
            enableCurrentSite.checked = true;
            updateStatus(items.enabled);
          }
        }
      });
    }
  );

  // Save settings when changed
  enableExtension.addEventListener("change", function () {
    chrome.storage.sync.set({ enabled: this.checked });
    updateStatus(this.checked && enableCurrentSite.checked);

    // Notify content scripts about the change
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          enabled: enableExtension.checked,
        });
      }
    });
  });

  suggestionSpeed.addEventListener("change", function () {
    chrome.storage.sync.set({ speed: this.value });

    // Notify content scripts about the change
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          speed: parseInt(this.value),
        });
      }
    });
  });

  contextLength.addEventListener("change", function () {
    chrome.storage.sync.set({ context: this.value });

    // Notify content scripts about the change
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "updateSettings",
          context: this.value,
        });
      }
    });
  });

  enableCurrentSite.addEventListener("change", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;

        // Get current exceptions
        chrome.storage.sync.get({ siteExceptions: {} }, function (items) {
          const exceptions = items.siteExceptions;

          if (enableCurrentSite.checked) {
            // Remove from exceptions if it exists
            if (domain in exceptions) {
              delete exceptions[domain];
            }
          } else {
            // Add to exceptions
            exceptions[domain] = false;
          }

          // Save updated exceptions
          chrome.storage.sync.set({ siteExceptions: exceptions });

          // Update status and notify content script
          updateStatus(enableExtension.checked && enableCurrentSite.checked);
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateSiteStatus",
            enabled: enableCurrentSite.checked,
          });
        });
      }
    });
  });

  // Handle link clicks
  openOptions.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

  reportIssue.addEventListener("click", function () {
    chrome.tabs.create({
      url: "https://github.com/gitrlawton/auto-tab/issues",
    });
  });

  // Helper function to update status display
  function updateStatus(isActive) {
    if (isActive) {
      statusIndicator.className = "status-indicator active";
      statusText.textContent = "Active on this page";
    } else {
      statusIndicator.className = "status-indicator inactive";
      statusText.textContent = "Disabled on this page";
    }
  }
});
