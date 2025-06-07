console.log("EW_BACKGROUND_TOPLEVEL: background.js script started parsing.");
// 監聽來自 content_script 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TRANSLATE_TEXT') {
    handleTranslationRequest(request.text, request.style)
      .then(sendResponse)
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ error: error.message || 'Translation failed' });
      });
    return true; // 表示我們將異步發送響應
  } else if (request.type === 'GET_SHORTCUT_INFO') {
    console.log("EW_BACKGROUND: Received GET_SHORTCUT_INFO request.");
    chrome.commands.getAll(commands => {
      if (chrome.runtime.lastError) {
        console.error("EW_BACKGROUND: Error getting commands:", chrome.runtime.lastError.message);
        sendResponse({ shortcut: "Error: Could not retrieve shortcuts" });
        return;
      }
      const translateCmd = commands.find(cmd => cmd.name === "translate-selection");
      if (translateCmd) {
        console.log("EW_BACKGROUND: Sending 'translate-selection' shortcut:", translateCmd.shortcut);
        sendResponse({ shortcut: translateCmd.shortcut || "N/A" }); // "N/A" if user cleared it
      } else {
        console.error("EW_BACKGROUND: 'translate-selection' command not found.");
        sendResponse({ shortcut: "Error: Command not found" });
      }
    });
    return true; // Important for async response
  }
});

function sendMessagePromise(tabId, item, options) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, item, options, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

async function handleTranslationRequest(text, style) {
  if (!text.trim()) {
    return { translatedText: '' };
  }

  const settings = await chrome.storage.sync.get(['apiProvider', 'geminiApiKey', 'openaiApiKey', 'writingStyle', 'geminiUserSelectedModel', 'openaiUserSelectedModel']);
  const apiProvider = settings.apiProvider || 'gemini';
  const currentStyle = style || settings.writingStyle || 'formal';

  const prompt = buildPrompt(text, currentStyle);

  if (apiProvider === 'openai') {
    // OpenAI API
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API Key not configured. Please set it in the extension options.');
    }
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openaiApiKey}`
        },
        body: JSON.stringify({
          model: settings.openaiUserSelectedModel || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: currentStyle === 'formal' ?
              'You are a professional English translator. Translate Traditional Chinese to formal, written English suitable for academic or professional contexts.' :
              'You are a native English speaker. Translate Traditional Chinese to casual, spoken English as if chatting with a friend.' },
            { role: 'user', content: text }
          ]
        })
      });
      if (!response.ok) {
        let errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: { message: errorText } }; }
        throw new Error(`API Error: ${JSON.stringify(errorData)}`);
      }
      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        return { translatedText: data.choices[0].message.content.trim() };
      } else {
        throw new Error('Could not extract translation from OpenAI API response.');
      }
    } catch (error) {
      throw error;
    }
  } else {
    // Gemini API (預設)
    if (!settings.geminiApiKey) {
      throw new Error('Gemini API Key not configured. Please set it in the extension options.');
    }
    const geminiModelToUse = settings.geminiUserSelectedModel || 'gemini-1.5-pro-latest';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelToUse}:generateContent?key=${settings.geminiApiKey}`;
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
        }),
      });
      if (!response.ok) {
        let errorText = await response.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch (e) { errorData = { error: { message: errorText } }; }
        throw new Error(`API Error: ${JSON.stringify(errorData)}`);
      }
      const data = await response.json();
      console.log("EW_BACKGROUND_API_RESPONSE: Raw JSON response from Gemini API:", JSON.parse(JSON.stringify(data)));
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
        const translatedText = data.candidates[0].content.parts[0].text;
        return { translatedText: translatedText.trim() };
      } else if (data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error(`Content blocked by API: ${data.promptFeedback.blockReason}`);
      } else {
        throw new Error('Could not extract translation from Gemini API response.');
      }
    } catch (error) {
      throw error;
    }
  }
}

function buildPrompt(chineseText, style) {
  let styleDescription = "";
  if (style === 'formal') {
    styleDescription = "Please translate the following Traditional Chinese text into formal, written English suitable for academic or professional contexts. Ensure the translation is accurate, grammatically correct, and maintains a professional tone.";
  } else {
    styleDescription = "Please translate the following Traditional Chinese text into casual, spoken English, like how a native speaker would chat with a friend. Use common idioms and contractions if appropriate, but keep it natural.";
  }
  return `${styleDescription}\n\nTraditional Chinese: \"${chineseText}\"\n\nEnglish Translation:`;
}

// Function to setup context menus
function setupContextMenus() {
  console.log("EW_BACKGROUND_SETUP: Entering setupContextMenus function, about to remove all menus.");
  try {
    chrome.contextMenus.removeAll(() => { // Remove all to prevent duplicates during development
      console.log("EW_BACKGROUND_SETUP: All context menus removed (if any). Ready to create new ones.");
      
      console.log("EW_BACKGROUND_SETUP: Creating context menu item: toggleExtensionState");
      chrome.contextMenus.create({
        id: "toggleExtensionState",
        title: "啟用/停用英文寫作助手", // Enable/Disable English Writing Assistant
        contexts: ["action"] // Changed from "all" to "action" (browser action icon)
      });
      
      console.log("EW_BACKGROUND_SETUP: Creating context menu item: translateSelectedText");
      chrome.contextMenus.create({
        id: "translateSelectedText",
        title: "翻譯選取文字", // Translate Selected Text
        contexts: ["selection"]
      });
      
      console.log("EW_BACKGROUND_SETUP: Finished attempting to create context menus.");
    });
  } catch (e) {
    console.error("EW_BACKGROUND_SETUP: Error during setupContextMenus:", e);
  }
}

// Call setup on install or startup
chrome.runtime.onInstalled.addListener((details) => {
  console.log("EW_BACKGROUND_INSTALL: onInstalled event triggered. Details:", JSON.parse(JSON.stringify(details)));
  setupContextMenus();
});
// chrome.runtime.onStartup.addListener(setupContextMenus); // Optional: re-create on browser startup

// Refactored function to get selected text and translate
async function getSelectedTextAndTranslate(tab, style = null) {
  console.log("EW_BACKGROUND: getSelectedTextAndTranslate called. Tab ID:", tab?.id);
  if (!tab || typeof tab.id === 'undefined') {
    console.error("EW_BACKGROUND: Invalid tab object or Tab ID is missing in getSelectedTextAndTranslate.");
    // Cannot send message to content script if tab.id is missing.
    return;
  }

  try {
    console.log(`EW_BACKGROUND: Pinging content script in tab ${tab.id}`);
    const pong = await sendMessagePromise(tab.id, { type: "PING_CONTENT_SCRIPT" }, { frameId: 0 });
    if (pong?.type !== "PONG_FROM_CONTENT") {
      console.error(`EW_BACKGROUND: Content script in tab ${tab.id} did not respond correctly to ping.`);
      chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: "Error: Content script not responsive. Please try refreshing the page." } }, { frameId: 0 });
      return;
    }
    console.log(`EW_BACKGROUND: Content script in tab ${tab.id} responded to ping.`);
  } catch (pingError) {
    console.error(`EW_BACKGROUND: Error pinging content script in tab ${tab.id}:`, pingError.message);
    chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: "Error: Content script unreachable. Please try refreshing the page." } }, { frameId: 0 });
    return;
  }

  // Now, proceed with TRANSLATION_STARTED (already specifying frameId: 0 from previous fix)
  console.log("EW_BACKGROUND: Sending TRANSLATION_STARTED to tab:", tab.id);
  // Note: This sendMessage doesn't need a response, so not using sendMessagePromise here.
  chrome.tabs.sendMessage(tab.id, { type: "TRANSLATION_STARTED" }, { frameId: 0 });

  console.log("EW_BACKGROUND: Attempting to execute script to get selection in tab:", tab.id);
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: () => window.getSelection().toString()
  }, async (injectionResults) => { // Made this callback async to use await for handleTranslationRequest
    if (chrome.runtime.lastError) {
      console.error("EW_BACKGROUND: Error executing script to get selection:", chrome.runtime.lastError.message);
      chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: "Error getting selected text: " + chrome.runtime.lastError.message } }, { frameId: 0 });
      return;
    }
    console.log("EW_BACKGROUND: Injection results received:", JSON.parse(JSON.stringify(injectionResults)));

    if (!injectionResults || injectionResults.length === 0 || !injectionResults[0].result) {
      console.log("EW_BACKGROUND: No text selected or could not retrieve selection.");
      chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: "No text was selected to translate." } }, { frameId: 0 });
      return;
    }
    
    const selectedText = injectionResults[0].result.trim();
    
    if (selectedText) {
      console.log("EW_BACKGROUND: Selected text for translation:", selectedText);
      try {
        const translationResult = await handleTranslationRequest(selectedText, style);
        console.log("EW_BACKGROUND: Translation successful, sending to content script. Result:", JSON.parse(JSON.stringify(translationResult)));
        chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: translationResult }, { frameId: 0 });
      } catch (error) {
        console.error("EW_BACKGROUND: Translation failed, sending error to content script. Error:", error.message);
        chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: error.message || "An unknown error occurred during translation." } }, { frameId: 0 });
      }
    } else {
      console.log("EW_BACKGROUND: Selected text is empty after trim.");
      chrome.tabs.sendMessage(tab.id, { type: "DISPLAY_TRANSLATION", data: { error: "Selected text is empty." } }, { frameId: 0 });
    }
  });
}

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggleExtensionState") {
    // Ensure tab.id check for sendMessage
    if (tab && tab.id) { 
      chrome.storage.sync.get(['isEnabled'], (result) => {
        const newState = typeof result.isEnabled === 'undefined' ? false : !result.isEnabled;
        chrome.storage.sync.set({ isEnabled: newState }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error setting isEnabled:", chrome.runtime.lastError);
            return;
          }
          chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled: newState }, { frameId: 0 }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn("EW: Could not send TOGGLE_ENABLED to tab " + tab.id + ". It might be a system page or closed.", chrome.runtime.lastError.message);
            }
          });
        });
      });
    }
  } else if (info.menuItemId === "translateSelectedText") {
    console.log("EW_BACKGROUND: 'translateSelectedText' context menu clicked. Info:", JSON.parse(JSON.stringify(info)), "Tab:", JSON.parse(JSON.stringify(tab)));
    getSelectedTextAndTranslate(tab); // Call the refactored function
  }
});

// Listener for keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  console.log("EW_BACKGROUND: Command received:", command, "Tab:", JSON.parse(JSON.stringify(tab)));
  if (command === "translate-selection") {
    if (tab) {
      getSelectedTextAndTranslate(tab); // Call the refactored function
    } else {
      console.error("EW_BACKGROUND: Tab object is undefined for command:", command);
    }
  }
});