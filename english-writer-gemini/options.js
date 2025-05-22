document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const writingStyleSelect = document.getElementById('writingStyle');
  const saveButton = document.getElementById('saveOptions');
  const statusDiv = document.getElementById('status');
  const apiProviderSelect = document.getElementById('apiProvider');
  const geminiKeyGroup = document.getElementById('geminiKeyGroup');
  const openaiKeyGroup = document.getElementById('openaiKeyGroup');
  const openaiApiKeyInput = document.getElementById('openaiApiKey');

  // 載入儲存的設定
  chrome.storage.sync.get(['apiProvider', 'geminiApiKey', 'openaiApiKey', 'writingStyle'], (result) => {
    if (result.apiProvider) {
      apiProviderSelect.value = result.apiProvider;
      geminiKeyGroup.style.display = result.apiProvider === 'gemini' ? 'block' : 'none';
      openaiKeyGroup.style.display = result.apiProvider === 'openai' ? 'block' : 'none';
    }
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.openaiApiKey) {
      openaiApiKeyInput.value = result.openaiApiKey;
    }
    if (result.writingStyle) {
      writingStyleSelect.value = result.writingStyle;
    }
  });

  apiProviderSelect.addEventListener('change', () => {
    const provider = apiProviderSelect.value;
    geminiKeyGroup.style.display = provider === 'gemini' ? 'block' : 'none';
    openaiKeyGroup.style.display = provider === 'openai' ? 'block' : 'none';
  });

  // 儲存設定
  saveButton.addEventListener('click', () => {
    const provider = apiProviderSelect.value;
    const apiKey = apiKeyInput.value.trim();
    const openaiKey = openaiApiKeyInput.value.trim();
    const style = writingStyleSelect.value;

    if (provider === 'gemini' && !apiKey) {
      statusDiv.textContent = '請輸入 Gemini API 金鑰。';
      statusDiv.style.color = 'red';
      return;
    }
    if (provider === 'openai' && !openaiKey) {
      statusDiv.textContent = '請輸入 OpenAI API 金鑰。';
      statusDiv.style.color = 'red';
      return;
    }

    chrome.storage.sync.set({
      apiProvider: provider,
      geminiApiKey: apiKey,
      openaiApiKey: openaiKey,
      writingStyle: style
    }, () => {
      statusDiv.textContent = '設定已儲存！';
      statusDiv.style.color = 'green';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    });
  });
}); 