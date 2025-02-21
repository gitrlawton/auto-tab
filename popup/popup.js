// this file is where you can add javascript to the popup

ocument.addEventListener("DOMContentLoaded", () => {
  // You could add functionality here to toggle the extension on/off
  // or adjust settings if you want to extend the project

  const statusElement = document.getElementById("status");

  // Check if extension is active
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getStatus" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Handle error or extension not active on this page
            statusElement.textContent = "Not available on this page";
            statusElement.style.color = "#ff4d4f";
          } else if (response && response.active) {
            statusElement.textContent = "Active";
            statusElement.style.color = "#52c41a";
          }
        }
      );
    }
  });
});
