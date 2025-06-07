document.addEventListener('DOMContentLoaded', () => {
  const GEMINI_MODELS = ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-pro'];
  const OPENAI_MODELS = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4o']; // Added gpt-4o as a common new one
  const DEFAULT_GEMINI_MODEL = 'gemini-1.5-pro-latest';
  const DEFAULT_OPENAI_MODEL = 'gpt-3.5-turbo';

  const apiKeyInput = document.getElementById('apiKey');
  const writingStyleSelect = document.getElementById('writingStyle');
  const currentGeminiModelSpan = document.getElementById('currentGeminiModel');
  const geminiModelSelect = document.getElementById('geminiModelSelect');
  const currentOpenAIModelSpan = document.getElementById('currentOpenAIModel');
  const openaiModelSelect = document.getElementById('openaiModelSelect');
  const saveButton = document.getElementById('saveOptions');
  const statusDiv = document.getElementById('status');
  const apiProviderSelect = document.getElementById('apiProvider');
  const geminiKeyGroup = document.getElementById('geminiKeyGroup');
  const openaiKeyGroup = document.getElementById('openaiKeyGroup');
  const openaiApiKeyInput = document.getElementById('openaiApiKey');

  function populateSelect(selectElement, models) {
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      selectElement.appendChild(option);
    });
  }
  populateSelect(geminiModelSelect, GEMINI_MODELS);
  populateSelect(openaiModelSelect, OPENAI_MODELS);

  // 載入儲存的設定
  chrome.storage.sync.get(['apiProvider', 'geminiApiKey', 'openaiApiKey', 'writingStyle', 'geminiUserSelectedModel', 'openaiUserSelectedModel'], (result) => {
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
    // After other settings are loaded...
    const savedGeminiModel = result.geminiUserSelectedModel || DEFAULT_GEMINI_MODEL;
    currentGeminiModelSpan.textContent = savedGeminiModel;
    geminiModelSelect.value = savedGeminiModel;

    const savedOpenAIModel = result.openaiUserSelectedModel || DEFAULT_OPENAI_MODEL;
    currentOpenAIModelSpan.textContent = savedOpenAIModel;
    openaiModelSelect.value = savedOpenAIModel;
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
      writingStyle: style,
      geminiUserSelectedModel: geminiModelSelect.value,
      openaiUserSelectedModel: openaiModelSelect.value,
    }, () => {
      statusDiv.textContent = '設定已儲存！';
      currentGeminiModelSpan.textContent = geminiModelSelect.value;
      currentOpenAIModelSpan.textContent = openaiModelSelect.value;
      statusDiv.style.color = 'green';
      setTimeout(() => { statusDiv.textContent = ''; }, 3000);
    });
  });
}); 