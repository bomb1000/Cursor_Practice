// Global variables
let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let isExtensionEnabled = true;
let keyBuffer = "";
let keyDebounceTimer = null;

// Initialize on load
chrome.storage.sync.get(['isEnabled', 'writingStyle'], (result) => {
  isExtensionEnabled = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
  if (isExtensionEnabled) {
    initializeUI();
  }
});

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TOGGLE_ENABLED') {
    isExtensionEnabled = request.enabled;
    if (isExtensionEnabled) {
      initializeUI();
      if (sidebar) sidebar.style.display = 'block'; // Show sidebar if it exists
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
  return true; // Indicates asynchronous response
});

// Initialize UI elements and event listeners
function initializeUI() {
  if (!document.getElementById('ew-sidebar')) {
    createSidebar();
  }
  // Add global key listener if not already added
  if (!document.ewKeydownListenerAttached) {
    document.addEventListener('keydown', handleGlobalKeyDown);
    document.ewKeydownListenerAttached = true;
  }
}

// Remove UI elements and event listeners
function removeUI() {
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
    sidebarContent = null;
    sidebarToggle = null;
  }
  if (document.ewKeydownListenerAttached) {
    document.removeEventListener('keydown', handleGlobalKeyDown);
    document.ewKeydownListenerAttached = false;
  }
  clearTimeout(keyDebounceTimer);
  keyBuffer = "";
}

// Handle global keydown events
function handleGlobalKeyDown(event) {
  if (!isExtensionEnabled) return;

  const activeEl = document.activeElement;

  // 1. Check for password/readonly/disabled fields first
  if (activeEl) {
    if (activeEl.type === 'password' || activeEl.readOnly || activeEl.disabled) {
      keyBuffer = ""; // Clear buffer
      clearTimeout(keyDebounceTimer);
      if (sidebarContent) sidebarContent.textContent = '...'; // Reset sidebar
      return;
    }
  }

  // 2. Ignore keys with Ctrl, Alt, Meta modifiers (but allow Shift for now)
  if (event.ctrlKey || event.altKey || event.metaKey) {
    // console.log("EW: Ignoring key with modifier:", event.key);
    return;
  }

  const allowedControlKeys = ["Backspace", "Enter", "Escape", "Process"];
  const key = event.key;

  // 3. Handle specific allowed control keys
  if (allowedControlKeys.includes(key)) {
    if (key === "Backspace") {
      keyBuffer = keyBuffer.slice(0, -1);
      if (sidebarContent) sidebarContent.textContent = keyBuffer ? `輸入中: ${keyBuffer}` : '...';
      clearTimeout(keyDebounceTimer);
      if (keyBuffer.length > 0) { // Only set timer if buffer still has content
          keyDebounceTimer = setTimeout(processBufferedKeys, 1000);
      }
    } else if (key === "Enter") {
      if (keyBuffer.length > 0) {
        clearTimeout(keyDebounceTimer);
        processBufferedKeys();
      }
    } else if (key === "Escape") {
      keyBuffer = "";
      clearTimeout(keyDebounceTimer);
      if (sidebarContent) sidebarContent.textContent = '...';
    } else if (key === "Process") {
      // IME is processing. We might get individual characters or composed string later.
      // For now, we don't add "Process" to buffer.
      // Debounce timer will be reset by subsequent valid character keys.
    }
    return; // Processed an allowed control key
  }

  // 4. Filter out other non-printable/navigation keys
  //    Keys like "Shift", "Tab", "CapsLock", Arrows, F1-F12, "Delete", "Home", "End" etc.
  //    will have event.key.length > 1 (or are not single characters).
  //    We only want to buffer single characters.
  if (key.length !== 1) {
    // console.log("EW: Ignoring non-printable/non-allowed control key:", key);
    return;
  }

  // 5. Append printable character to buffer
  keyBuffer += key;
  if (sidebarContent) {
    sidebarContent.textContent = `輸入中: ${keyBuffer}`;
  }

  // Debounce translation trigger
  clearTimeout(keyDebounceTimer);
  keyDebounceTimer = setTimeout(processBufferedKeys, 1000); // 1 second debounce
}

// Process the buffered keys
function processBufferedKeys() {
  if (keyBuffer.trim().length > 0) {
    triggerTranslation(keyBuffer.trim());
  }
  // keyBuffer = ""; // Clear buffer after processing or if empty
  // -> Clearing buffer here means if translation fails or user continues typing, it starts fresh.
  //    Consider if buffer should only be cleared on successful translation or explicit clear (Esc).
  //    For now, let's clear it as per original plan.
  keyBuffer = ""; 
}

// Trigger translation and update sidebar
function triggerTranslation(text) {
  if (!isExtensionEnabled || !text) {
    if (sidebarContent) sidebarContent.textContent = '...'; // Reset sidebar if no text
    return;
  }

  if (sidebarContent) sidebarContent.textContent = '翻譯中...';

  chrome.storage.sync.get(['writingStyle'], (settings) => {
    chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text: text, style: settings.writingStyle }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError.message);
        if (sidebarContent) sidebarContent.textContent = `錯誤: ${chrome.runtime.lastError.message}`;
        return;
      }
      if (response && response.translatedText) {
        if (sidebarContent) sidebarContent.textContent = response.translatedText;
      } else if (response && response.error) {
        console.error('Translation API error:', response.error);
        if (sidebarContent) sidebarContent.textContent = `翻譯錯誤: ${response.error}`;
      } else {
        if (sidebarContent) sidebarContent.textContent = '無翻譯結果';
      }
    });
  });
}

// Create and manage the sidebar
function createSidebar() {
  if (document.getElementById('ew-sidebar')) return; // Already exists

  sidebar = document.createElement('div');
  sidebar.id = 'ew-sidebar';
  sidebar.classList.add('ew-sidebar-collapsed'); // Start collapsed

  sidebarToggle = document.createElement('div');
  sidebarToggle.id = 'ew-sidebar-toggle';
  sidebarToggle.textContent = '>'; // Indicate it can be expanded

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('ew-sidebar-collapsed');
    sidebarToggle.textContent = sidebar.classList.contains('ew-sidebar-collapsed') ? '>' : '<';
    // Store sidebar state
    chrome.storage.local.set({ sidebarCollapsed: sidebar.classList.contains('ew-sidebar-collapsed') });
  });

  sidebarContent = document.createElement('div');
  sidebarContent.id = 'ew-sidebar-content';
  sidebarContent.textContent = '...'; // Initial text

  const sidebarHeader = document.createElement('h4');
  sidebarHeader.textContent = "英文寫法";
  sidebarHeader.style.margin = "0 0 10px 0";
  sidebarHeader.style.padding = "0";

  sidebar.appendChild(sidebarToggle);
  sidebar.appendChild(sidebarHeader);
  sidebar.appendChild(sidebarContent);

  const copyButton = document.createElement('button');
  copyButton.id = 'ew-copy-button';
  copyButton.textContent = '複製翻譯';
  copyButton.style.display = 'none'; // Initially hidden
  copyButton.addEventListener('click', () => {
    if (sidebarContent && sidebarContent.textContent && !sidebarContent.textContent.startsWith('翻譯中...') && !sidebarContent.textContent.startsWith('錯誤:') && sidebarContent.textContent !== '...' && sidebarContent.textContent !== '無翻譯結果' && !sidebarContent.textContent.startsWith('輸入中:')) {
      navigator.clipboard.writeText(sidebarContent.textContent).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = '已複製!';
        setTimeout(() => {
          copyButton.textContent = originalText;
        }, 1500);
      }).catch(err => {
        console.error('EW: Could not copy text: ', err);
        // Optionally, provide error feedback on the button itself
      });
    }
  });
  sidebar.appendChild(copyButton);

  document.body.appendChild(sidebar);

  // Restore sidebar state
  chrome.storage.local.get('sidebarCollapsed', (result) => {
    if (result.sidebarCollapsed === false) { // Check for explicitly false
        sidebar.classList.remove('ew-sidebar-collapsed');
        sidebarToggle.textContent = '<';
    } else {
        sidebar.classList.add('ew-sidebar-collapsed');
        sidebarToggle.textContent = '>';
    }
  });
}

// Ensure UI is initialized when the script loads if enabled
if (isExtensionEnabled) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initializeUI();
  } else {
    document.addEventListener("DOMContentLoaded", initializeUI);
  }
}