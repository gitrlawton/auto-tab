# AutoTab

## Overview

AutoTab is a browser extension designed to enhance the user experience by providing autocomplete suggestions as users type in text fields. Utilizing Gemini Nano, the extension analyzes the user's input and offers contextually relevant suggestions for what to type next, making typing more efficient and intuitive. The extension also features a user-friendly extension interface for adjusting settings related to the autocomplete functionality.

## Features

- **Autocomplete Suggestions**: Provides real-time suggestions based on user input, speeding up typing efficiency.
- **Customizable Settings**: Users can enable or disable the autocomplete feature, set the minimum character threshold for suggestions, and adjust the delay for suggestions to appear.

## Installation

To set up the project, ensure you have a compatible browser (Chrome or Chromium-based) installed. Then, follow these steps:

1. Clone the repository:

   ```
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Load the extension in your browser:

   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click on "Load unpacked" and select the project directory.

3. Configure any necessary settings in the extension's popup interface.

## Usage

1. Click on the AutoTab extension icon in your browser toolbar to open the popup.

2. Adjust the settings as desired, including enabling or disabling the autocomplete feature.

3. Start typing in any text input field on a webpage to see autocomplete suggestions appear as gray text.

4. Use the `Tab` key to accept a suggestion or `Esc` to dismiss it.

## File Descriptions

- **popup.html**: The main HTML file for the extension's popup interface, where users can modify the settings.
- **popup.css**: The stylesheet for styling the popup interface.
- **popup.js**: The JavaScript file managing the popup functionality, including loading settings, handling user interactions, and communicating with the background script.
- **content.js**: The content script that injects the autocomplete functionality into web pages, handling text input events and displaying suggestions.
- **background.js**: The background script responsible for managing the Gemini Nano session and handling communication between the content script and the popup.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.
