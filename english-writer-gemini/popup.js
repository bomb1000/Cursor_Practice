document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const openOptionsLink = document.getElementById('openOptions');

  // 載入儲存的狀態
  chrome.storage.sync.get(['isEnabled'], (result) => {
    enabledToggle.checked = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
  });

  // 監聽開關變化
  enabledToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ isEnabled: enabledToggle.checked });
    // 通知 content script 狀態改變
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ENABLED', enabled: enabledToggle.checked });
      }
    });
  });

  openOptionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}); 