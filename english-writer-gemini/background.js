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
  }
});

async function handleTranslationRequest(text, style) {
  if (!text.trim()) {
    return { translatedText: '' };
  }

  const settings = await chrome.storage.sync.get(['apiProvider', 'geminiApiKey', 'openaiApiKey', 'writingStyle']);
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
          model: 'gpt-3.5-turbo',
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
    const model = 'models/gemini-1.5-pro';
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${settings.geminiApiKey}`;
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

// (可選) 添加右鍵選單來快速開/關插件
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggleExtensionState",
    title: "啟用/停用英文寫作助手",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggleExtensionState" && tab && tab.id) {
    chrome.storage.sync.get(['isEnabled'], (result) => {
      const newState = typeof result.isEnabled === 'undefined' ? false : !result.isEnabled;
      chrome.storage.sync.set({ isEnabled: newState });
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ENABLED', enabled: newState });
    });
  }
}); 