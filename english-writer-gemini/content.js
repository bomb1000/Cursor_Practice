// Global variables
let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let isExtensionEnabled = true;
// let keyBuffer = ""; // REMOVED
// let keyDebounceTimer = null; // REMOVED

// Initialize on load
if (chrome.runtime?.id) {
  chrome.storage.sync.get(['isEnabled', 'writingStyle'], (result) => {
    isExtensionEnabled = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
    // The writingStyle is implicitly handled by triggerTranslation if not set here
    if (isExtensionEnabled) {
      initializeUI();
    }
  });
} else {
  console.log("EW: Context invalidated during initial setup. Extension may not load correctly.");
  // isExtensionEnabled will remain its default (true or what it was before)
  // or could be explicitly set to false here:
  // isExtensionEnabled = false; 
  // For now, just log, as default behavior might be okay if context is briefly unavailable.
}

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
  } else if (request.type === 'DISPLAY_TRANSLATION') {
    if (!sidebar || !sidebarContent || !sidebarToggle) { // Check if sidebar elements are available
      console.log("EW: Sidebar not fully initialized, creating it now for DISPLAY_TRANSLATION.");
      createSidebar(); // Attempt to create it if not present
      // It's possible createSidebar might not fully complete synchronously if it involves async storage calls
      // For now, we'll assume it makes sidebarContent, etc., available or rely on the next access.
    }

    const copyButton = document.getElementById('ew-copy-button');

    if (request.data) {
      if (request.data.translatedText && request.data.translatedText.trim() !== "") {
        sidebarContent.textContent = request.data.translatedText;
        if (copyButton) copyButton.style.display = 'block';
      } else if (request.data.error) {
        sidebarContent.textContent = request.data.error;
        if (copyButton) copyButton.style.display = 'none';
      } else {
        sidebarContent.textContent = '無翻譯結果或未知錯誤。';
        if (copyButton) copyButton.style.display = 'none';
      }
    } else {
      sidebarContent.textContent = '收到無效的翻譯資料。'; // Received invalid translation data.
      if (copyButton) copyButton.style.display = 'none';
    }

    // Ensure sidebar is visible and expanded
    if (sidebar && sidebarToggle) {
      sidebar.style.display = 'block'; // Ensure it's not display:none from a previous TOGGLE_ENABLED to false
      if (sidebar.classList.contains('ew-sidebar-collapsed')) {
        sidebar.classList.remove('ew-sidebar-collapsed');
        sidebarToggle.textContent = '<';
        // Optionally save this expanded state
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ sidebarCollapsed: false });
        }
      }
    }
    sendResponse({ status: "Translation displayed" });
  }
  return true; // Indicates asynchronous response
});

// Initialize UI elements and event listeners
function initializeUI() {
  if (!document.getElementById('ew-sidebar')) {
    createSidebar();
  }
  // REMOVED global key listener attachment
  // if (!document.ewKeydownListenerAttached) {
  //   document.addEventListener('keydown', handleGlobalKeyDown);
  //   document.ewKeydownListenerAttached = true;
  // }
}

// Remove UI elements and event listeners
function removeUI() {
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
    sidebarContent = null;
    sidebarToggle = null;
  }
  // REMOVED global key listener detachment and timer/buffer clearing
  // if (document.ewKeydownListenerAttached) {
  //   document.removeEventListener('keydown', handleGlobalKeyDown);
  //   document.ewKeydownListenerAttached = false;
  // }
  // clearTimeout(keyDebounceTimer);
  // keyBuffer = ""; 
}

// DELETED handleGlobalKeyDown function
// DELETED processBufferedKeys function

// Trigger translation and update sidebar
function triggerTranslation(text) {
  console.log("EW: triggerTranslation called with text:", text); // ADD LOG
  if (!isExtensionEnabled || !text) {
    if (sidebarContent) sidebarContent.textContent = '...'; // Reset sidebar if no text
    keyBuffer = ""; // Clear buffer if no action taken
    return;
  }

  if (sidebarContent) sidebarContent.textContent = '翻譯中...';
  const copyButton = document.getElementById('ew-copy-button'); // Fetch once
  if (copyButton) copyButton.style.display = 'none'; // Hide initially

  if (chrome.runtime?.id) {
    chrome.storage.sync.get(['writingStyle'], (settings) => {
      if (chrome.runtime.lastError) { // Check for errors during storage.get itself
        console.error("EW: Error getting writingStyle:", chrome.runtime.lastError.message);
        if (sidebarContent) sidebarContent.textContent = '錯誤: 無法讀取風格設定。';
        if (copyButton) copyButton.style.display = 'none';
        keyBuffer = ""; // Clear buffer on error
        return;
      }
      console.log("EW: Writing style fetched:", settings.writingStyle); // ADD LOG

      // Now, check context *before* sendMessage
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text: text, style: settings.writingStyle }, (response) => {
          console.log("EW: Response from background:", response); // ADD LOG
          keyBuffer = ""; // Clear buffer after response or error from sendMessage
          
          if (chrome.runtime.lastError) {
            console.error("Error sending message:", chrome.runtime.lastError.message);
            if (sidebarContent) sidebarContent.textContent = `錯誤: ${chrome.runtime.lastError.message}`;
            if (copyButton) copyButton.style.display = 'none';
            return; // keyBuffer already cleared
          }
          
          if (response && response.translatedText) {
            if (sidebarContent) sidebarContent.textContent = response.translatedText;
          } else if (response && response.error) {
            console.error('Translation API error:', response.error);
            if (sidebarContent) sidebarContent.textContent = `翻譯錯誤: ${response.error}`;
          } else {
            if (sidebarContent) sidebarContent.textContent = '無翻譯結果';
          }

          // Update copy button visibility based on the final state of sidebarContent
          if (copyButton) {
            if (sidebarContent && sidebarContent.textContent && 
                !sidebarContent.textContent.startsWith('錯誤:') && 
                !sidebarContent.textContent.startsWith('翻譯中...') &&
                !sidebarContent.textContent.startsWith('輸入中:') &&
                sidebarContent.textContent !== '...' &&
                sidebarContent.textContent !== '無翻譯結果') {
              copyButton.style.display = 'block';
            } else {
              copyButton.style.display = 'none';
            }
          }
        });
      } else {
        console.log("EW: Context invalidated, cannot send translation request.");
        if (sidebarContent) sidebarContent.textContent = '錯誤: 擴充功能連線已中斷，請嘗試刷新頁面。';
        if (copyButton) copyButton.style.display = 'none';
        keyBuffer = ""; // Clear buffer on error
      }
    });
  } else {
    // This outer else handles the case where chrome.runtime.id was null before even trying storage.get
    console.log("EW: Context invalidated, cannot fetch writing style for translation (outer check).");
    if (sidebarContent) sidebarContent.textContent = '錯誤: 擴充功能內部錯誤 (無法讀取設定)';
    if (copyButton) copyButton.style.display = 'none';
    keyBuffer = ""; // Clear buffer on error
  }
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
    if (chrome.runtime?.id) {
      chrome.storage.local.set({ sidebarCollapsed: sidebar.classList.contains('ew-sidebar-collapsed') });
    } else {
      console.log("EW: Context invalidated, cannot save sidebar state.");
    }
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
  if (chrome.runtime?.id) {
    chrome.storage.local.get('sidebarCollapsed', (result) => {
      if (chrome.runtime.lastError) { // Check for errors during storage.get
        console.error("EW: Error restoring sidebar state:", chrome.runtime.lastError.message);
        return;
      }
      if (result.sidebarCollapsed === false) { // Check for explicitly false
          sidebar.classList.remove('ew-sidebar-collapsed');
          sidebarToggle.textContent = '<';
      } else {
          sidebar.classList.add('ew-sidebar-collapsed');
          sidebarToggle.textContent = '>';
      }
    });
  } else {
    console.log("EW: Context invalidated, cannot restore sidebar state.");
  }
}

// Ensure UI is initialized when the script loads if enabled
if (isExtensionEnabled) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initializeUI();
  } else {
    document.addEventListener("DOMContentLoaded", initializeUI);
  }
}