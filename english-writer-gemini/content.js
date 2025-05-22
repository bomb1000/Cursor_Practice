let currentInput = null;
let bottomBar = null;
let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let debounceTimer = null;
let isExtensionEnabled = true;

chrome.storage.sync.get(['isEnabled', 'writingStyle'], (result) => {
  isExtensionEnabled = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
  if (isExtensionEnabled) {
    initializeUI();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_ENABLED') {
    isExtensionEnabled = request.enabled;
    if (isExtensionEnabled) {
      initializeUI();
      if (sidebar) sidebar.style.display = 'block';
    } else {
      removeUI();
    }
    sendResponse({ status: "Visibility toggled" });
  } else if (request.type === 'UPDATE_SIDEBAR') {
    if (sidebarContent && isExtensionEnabled) {
        sidebarContent.textContent = request.text;
    }
    sendResponse({ status: "Sidebar updated" });
  }
  return true;
});

function initializeUI() {
  if (!document.getElementById('ew-sidebar')) createSidebar();
  document.addEventListener('focusin', handleFocusIn);
  document.addEventListener('focusout', handleFocusOut);
}

function removeUI() {
    if (bottomBar) {
        bottomBar.remove();
        bottomBar = null;
    }
    if (sidebar) {
        sidebar.remove();
        sidebar = null;
        sidebarContent = null;
        sidebarToggle = null;
    }
    document.removeEventListener('focusin', handleFocusIn);
    document.removeEventListener('focusout', handleFocusOut);
    if (currentInput) {
        currentInput.removeEventListener('input', handleInput);
        currentInput = null;
    }
}

function handleFocusIn(event) {
  if (!isExtensionEnabled) return;
  const target = event.target;
  if (target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'search' || target.type === 'email' || target.type === 'url' || target.type === 'password') || target.tagName === 'TEXTAREA') {
    if (target.id === 'ew-bottom-bar-input') return;

    currentInput = target;
    currentInput.addEventListener('input', handleInput);
    showBottomBar(currentInput);
    if (currentInput.value.trim()) {
       triggerTranslation(currentInput.value.trim());
    }
  }
}

function handleFocusOut(event) {
  setTimeout(() => {
    if (currentInput === event.target && !document.activeElement.closest('#ew-bottom-bar')) {
      if (currentInput) {
        currentInput.removeEventListener('input', handleInput);
        currentInput = null;
      }
      if (bottomBar) {
        bottomBar.style.display = 'none';
      }
    }
  }, 200);
}

function handleInput(event) {
  if (!isExtensionEnabled || !currentInput) return;
  const text = event.target.value.trim();
  
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    triggerTranslation(text);
  }, 750);
}

function triggerTranslation(text) {
  if (!isExtensionEnabled || !text) {
    if (bottomBar) bottomBar.textContent = '';
    if (sidebarContent) sidebarContent.textContent = '...';
    return;
  }

  if (bottomBar) bottomBar.textContent = '翻譯中...';
  if (sidebarContent) sidebarContent.textContent = '翻譯中...';
  
  chrome.storage.sync.get(['writingStyle'], (settings) => {
    chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text: text, style: settings.writingStyle }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError.message);
        if (bottomBar) bottomBar.textContent = `錯誤: ${chrome.runtime.lastError.message}`;
        if (sidebarContent) sidebarContent.textContent = `錯誤: ${chrome.runtime.lastError.message}`;
        return;
      }
      if (response && response.translatedText) {
        if (bottomBar && currentInput) bottomBar.textContent = response.translatedText;
        if (sidebarContent) sidebarContent.textContent = response.translatedText;
      } else if (response && response.error) {
        console.error('Translation API error:', response.error);
        if (bottomBar && currentInput) bottomBar.textContent = `翻譯錯誤: ${response.error}`;
        if (sidebarContent) sidebarContent.textContent = `翻譯錯誤: ${response.error}`;
      } else {
        if (bottomBar && currentInput) bottomBar.textContent = '無翻譯結果';
        if (sidebarContent) sidebarContent.textContent = '無翻譯結果';
      }
    });
  });
}

function showBottomBar(targetElement) {
  if (!isExtensionEnabled) return;
  if (!bottomBar) {
    bottomBar = document.createElement('div');
    bottomBar.id = 'ew-bottom-bar';
    document.body.appendChild(bottomBar);
  }
  const rect = targetElement.getBoundingClientRect();
  bottomBar.style.display = 'block';
  bottomBar.style.top = `${window.scrollY + rect.bottom + 2}px`;
  bottomBar.style.left = `${window.scrollX + rect.left}px`;
  bottomBar.style.width = `${rect.width}px`;
  bottomBar.textContent = '...';
}

function createSidebar() {
  if (!isExtensionEnabled || document.getElementById('ew-sidebar')) return;

  sidebar = document.createElement('div');
  sidebar.id = 'ew-sidebar';
  sidebar.classList.add('ew-sidebar-collapsed');

  sidebarToggle = document.createElement('div');
  sidebarToggle.id = 'ew-sidebar-toggle';
  sidebarToggle.textContent = '>';

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('ew-sidebar-collapsed');
    sidebarToggle.textContent = sidebar.classList.contains('ew-sidebar-collapsed') ? '>' : '<';
  });

  sidebarContent = document.createElement('div');
  sidebarContent.id = 'ew-sidebar-content';
  sidebarContent.textContent = '輸入中文後將在此顯示英文翻譯。';
  
  const sidebarHeader = document.createElement('h4');
  sidebarHeader.textContent = "英文寫法";
  sidebarHeader.style.margin = "0 0 10px 0";
  sidebarHeader.style.padding = "0";

  sidebar.appendChild(sidebarToggle);
  sidebar.appendChild(sidebarHeader);
  sidebar.appendChild(sidebarContent);
  document.body.appendChild(sidebar);
}

// ChatGPT 專用：動態偵測 <textarea> 並自動監聽
function observeChatGPTTextarea() {
  let lastTextarea = null;
  function attachToTextarea(textarea) {
    if (lastTextarea === textarea) return;
    if (lastTextarea) lastTextarea.removeEventListener('input', handleInput);
    lastTextarea = textarea;
    textarea.addEventListener('input', handleInput);
    showBottomBar(textarea);
    if (textarea.value.trim()) triggerTranslation(textarea.value.trim());
  }
  // 初始偵測
  const tryAttach = () => {
    // ChatGPT 目前的輸入框通常是 <textarea> 且有 data-id 屬性
    const textarea = document.querySelector('form textarea');
    if (textarea) attachToTextarea(textarea);
  };
  tryAttach();
  // 監控 DOM 變化
  const observer = new MutationObserver(() => {
    tryAttach();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (isExtensionEnabled) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        initializeUI();
        // ChatGPT 支援 (同時支援 chat.openai.com 及 chatgpt.com)
        if (window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com')) {
          observeChatGPTTextarea();
        }
    } else {
        document.addEventListener("DOMContentLoaded", () => {
          initializeUI();
          if (window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com')) {
            observeChatGPTTextarea();
          }
        });
    }
} 