console.log("EW_CONTENT: Script started injecting/running. Timestamp:", Date.now());
// Global variables
let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let ewSidebarHeader = null; // ADDED
let isExtensionEnabled = true;
let ewFontSizeMultiplier = 1.0; 
const EW_BASE_FONT_SIZE = 14; // Assuming base font size in px for sidebar content

let isEwDragging = false;
let ewDragStartX = 0, ewDragStartY = 0;
let ewSidebarInitialX = 0, ewSidebarInitialY = 0;

let isEwResizing = false;
let ewResizeType = ''; // Will be 'left', 'bottom'
let ewResizeStartX = 0, ewResizeStartY = 0;
let ewInitialSidebarWidth = 0, ewInitialSidebarHeight = 0;
let ewInitialSidebarLeft = 0; // Only needed for 'left' resize

const EW_SIDEBAR_MIN_WIDTH = 200; // px
const EW_SIDEBAR_MAX_WIDTH = 800; // px
const EW_SIDEBAR_MIN_HEIGHT = 150; // px
// Calculate MAX_HEIGHT dynamically, e.g., in createSidebar or when resizing starts
let EW_SIDEBAR_MAX_HEIGHT = 600; // Default, will be updated
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
try {
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
  } else if (request.type === 'TRANSLATION_STARTED') {
    console.log("EW: content.js received TRANSLATION_STARTED message.");
    if (!sidebar || !sidebarContent || !sidebarToggle) { // Ensure sidebar elements are created
        console.log("EW: Sidebar not fully initialized, creating it now for TRANSLATION_STARTED.");
        createSidebar();
    }
    
    if (sidebarContent) {
        sidebarContent.innerHTML = '<span class="ew-loading-spinner"></span> 翻譯進行中...';
    }

    const copyButton = document.getElementById('ew-copy-button');
    if (copyButton) {
        copyButton.style.display = 'none';
    }

    if (sidebar && sidebarToggle) { // Ensure these elements exist before manipulating them
        sidebar.style.display = 'block'; // Ensure it's visible
        if (sidebar.classList.contains('ew-sidebar-collapsed')) {
            sidebar.classList.remove('ew-sidebar-collapsed');
            sidebarToggle.textContent = '<';
            // Optionally save this expanded state
            if (chrome.runtime?.id) {
                chrome.storage.local.set({ sidebarCollapsed: false });
            }
        }
    }
    sendResponse({ status: "Translation started UI updated" });

  } else if (request.type === 'DISPLAY_TRANSLATION') {
    console.log("EW: content.js received DISPLAY_TRANSLATION message. Request object:", JSON.parse(JSON.stringify(request)));
    // Ensure sidebar elements are available. This is crucial because DISPLAY_TRANSLATION might be the first message
    // if the content script was just injected for the translation.
    if (!sidebar || !sidebarContent || !sidebarToggle) { 
      console.log("EW: Sidebar not fully initialized, creating it now for DISPLAY_TRANSLATION.");
      createSidebar(); // Attempt to create it if not present
      // It's possible createSidebar might not fully complete synchronously if it involves async storage calls
      // For now, we'll assume it makes sidebarContent, etc., available or rely on the next access.
    }

    const copyButton = document.getElementById('ew-copy-button');

    if (request.data) {
      if (request.data.translatedText && request.data.translatedText.trim() !== "") {
        console.log("EW: Displaying translated text in sidebar:", request.data.translatedText);
        sidebarContent.textContent = request.data.translatedText;
        if (copyButton) copyButton.style.display = 'block';
      } else if (request.data.error) {
        console.log("EW: Displaying error in sidebar:", request.data.error);
        sidebarContent.textContent = request.data.error;
        if (copyButton) copyButton.style.display = 'none';
      } else {
        console.log("EW: Displaying default message for no translation/unknown error.");
        sidebarContent.textContent = '無翻譯結果或未知錯誤。';
        if (copyButton) copyButton.style.display = 'none';
      }
    } else {
      console.log("EW: Displaying default message for invalid/missing data in DISPLAY_TRANSLATION.");
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
  console.log("EW_CONTENT: Message listener attached successfully. Timestamp:", Date.now());
} catch (e) {
  console.error("EW_CONTENT: Error attaching message listener:", e);
}

// Initialize UI elements and event listeners
function initializeUI() {
  console.log("EW_CONTENT: initializeUI called. Timestamp:", Date.now());
  if (!document.getElementById('ew-sidebar')) {
    createSidebar(); 
  } else {
    // If sidebar exists, ensure font controls are there or re-add them.
    // This can happen if the script is re-injected.
    // Also, ensure event listeners for font controls are re-attached if necessary.
    if (!document.getElementById('ew-font-controls') && sidebar) {
        const fontControlsContainer = document.createElement('div');
        fontControlsContainer.id = 'ew-font-controls';
        const newFontDecreaseButton = document.createElement('button'); // Use new var names
        newFontDecreaseButton.id = 'ew-font-decrease';
        newFontDecreaseButton.textContent = 'A-';
        const newFontIncreaseButton = document.createElement('button'); // Use new var names
        newFontIncreaseButton.id = 'ew-font-increase';
        newFontIncreaseButton.textContent = 'A+';
        fontControlsContainer.appendChild(newFontDecreaseButton);
        fontControlsContainer.appendChild(newFontIncreaseButton);
        
        const shortcutDisplay = document.getElementById('ew-shortcut-display');
        if (shortcutDisplay) {
            sidebar.insertBefore(fontControlsContainer, shortcutDisplay);
        } else if (sidebarContent) {
            sidebar.insertBefore(fontControlsContainer, sidebarContent);
        } else {
            sidebar.appendChild(fontControlsContainer);
        }
        // Re-attach listeners specifically for newly created buttons
        newFontDecreaseButton.addEventListener('click', handleFontDecrease);
        newFontDecreaseButton.ewListenerAttached = true; 
        newFontIncreaseButton.addEventListener('click', handleFontIncrease);
        newFontIncreaseButton.ewListenerAttached = true;
    }
  }

  applyInitialSidebarStateAndSettings(); // Handles default position/dimensions, collapsed state, and font size.

  // Attach listeners to font controls (if they were already there or just added)
  // Ensure listeners are only attached once.
  const fontDecreaseButton = document.getElementById('ew-font-decrease');
  const fontIncreaseButton = document.getElementById('ew-font-increase');

  if (fontDecreaseButton && !fontDecreaseButton.ewListenerAttached) {
    fontDecreaseButton.addEventListener('click', () => {
      ewFontSizeMultiplier -= 0.1;
      if (ewFontSizeMultiplier < 0.7) ewFontSizeMultiplier = 0.7; // Min limit
      applyFontSize(ewFontSizeMultiplier);
      if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
    });
    fontDecreaseButton.ewListenerAttached = true; 
  }

  if (fontIncreaseButton && !fontIncreaseButton.ewListenerAttached) {
    fontIncreaseButton.addEventListener('click', handleFontIncrease);
    fontIncreaseButton.ewListenerAttached = true; 
  }

  // Request shortcut info
  if (chrome.runtime?.id) { 
    console.log("EW_CONTENT: content.js sending GET_SHORTCUT_INFO to background.");
    chrome.runtime.sendMessage({ type: "GET_SHORTCUT_INFO" }, (response) => {
      const shortcutDiv = document.getElementById('ew-shortcut-display');
      if (!shortcutDiv) { 
          console.warn("EW: Shortcut display div not found when trying to set shortcut text.");
          return;
      }
      if (chrome.runtime.lastError) {
        console.error("EW: Error getting shortcut info:", chrome.runtime.lastError.message);
        shortcutDiv.textContent = 'Shortcut: Error';
        return;
      }
      if (response && response.shortcut) {
        console.log("EW: content.js received shortcut info:", response.shortcut);
        shortcutDiv.textContent = `Shortcut: ${response.shortcut}`; 
      } else {
        console.log("EW: content.js received no shortcut info or error in response. Response:", response);
        shortcutDiv.textContent = 'Shortcut: N/A';
      }
    });
  } else {
    console.warn("EW: Context invalidated, cannot request shortcut info.");
    const shortcutDiv = document.getElementById('ew-shortcut-display');
    if (sidebar && shortcutDiv) { 
        shortcutDiv.textContent = 'Shortcut: N/A';
    } else if (document.getElementById('ew-sidebar') && !shortcutDiv) {
        console.warn("EW: Sidebar exists but shortcut display div not found during context invalidation fallback.");
    }
  }
}

// Apply font size to relevant elements
function applyFontSize(multiplier) {
  if (sidebarContent) {
    sidebarContent.style.fontSize = `${EW_BASE_FONT_SIZE * multiplier}px`;
  }
  const shortcutDisplay = document.getElementById('ew-shortcut-display');
  if (shortcutDisplay) {
    // Adjust shortcut display font size proportionally or keep it smaller
    shortcutDisplay.style.fontSize = `${(EW_BASE_FONT_SIZE - 2) * multiplier}px`; // e.g., base 12px
  }
  // Future: Could adjust line-height or other elements here too if needed
}

// Helper for font decrease button click
function handleFontDecrease() {
    ewFontSizeMultiplier -= 0.1;
    if (ewFontSizeMultiplier < 0.7) ewFontSizeMultiplier = 0.7; // Min limit
    applyFontSize(ewFontSizeMultiplier);
    if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
}

// Helper for font increase button click
function handleFontIncrease() {
    ewFontSizeMultiplier += 0.1;
    if (ewFontSizeMultiplier > 2.0) ewFontSizeMultiplier = 2.0; // Max limit
    applyFontSize(ewFontSizeMultiplier);
    if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
}


function applyDefaultDimensions() {
  if (sidebar) {
    sidebar.style.width = ''; // Reset to allow CSS default (e.g., 280px)
    sidebar.style.height = ''; // Reset to allow CSS default (e.g., auto)
    sidebar.style.left = 'auto'; 
    sidebar.style.right = '0px'; // Default position from CSS
    sidebar.style.top = '20%';   // Default position from CSS
    sidebar.style.bottom = 'auto';
    console.log("EW_CONTENT: Applied default sidebar position and dimensions via CSS reset.");
  }
}

function applyInitialSidebarStateAndSettings() {
  if (!sidebar) {
    console.warn("EW_CONTENT: applyInitialSidebarState called but sidebar is null.");
    return;
  }

  console.log("EW_CONTENT: Applying initial sidebar state and settings.");
  // ALWAYS APPLY DEFAULT CSS POSITION AND DIMENSIONS ON INITIALIZATION
  applyDefaultDimensions();

  // Load and Apply Collapsed State
  if (chrome.runtime?.id) {
    chrome.storage.local.get('sidebarCollapsed', (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW_CONTENT: Error loading sidebarCollapsed state:", chrome.runtime.lastError.message);
        sidebar.classList.add('ew-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.textContent = '>';
        // Fallback for font size if storage fails for collapsed state
        applyFontSize(ewFontSizeMultiplier); 
        return;
      }

      let shouldBeCollapsed;
      if (typeof result.sidebarCollapsed === 'undefined') {
        console.log("EW_CONTENT: sidebarCollapsed not found in storage, defaulting to collapsed (true).");
        shouldBeCollapsed = true;
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ sidebarCollapsed: true }); // Save the default
        }
      } else {
        shouldBeCollapsed = result.sidebarCollapsed;
        console.log("EW_CONTENT: sidebarCollapsed loaded from storage:", shouldBeCollapsed);
      }

      if (shouldBeCollapsed) {
        sidebar.classList.add('ew-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.textContent = '>';
        // Position is already default from applyDefaultDimensions
      } else {
        sidebar.classList.remove('ew-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.textContent = '<';
        // If expanded by default, it should be at the default right edge.
        // The toggle click handler is responsible for restoring a *dragged* position.
        sidebar.style.left = 'auto';
        sidebar.style.right = '0px';
        sidebar.style.top = '20%'; 
      }
      // Load and Apply Font Size after collapsed state is determined
      loadAndApplyFontSize();
    });
  } else {
    console.warn("EW_CONTENT: Context invalidated, defaulting to collapsed state and CSS position.");
    sidebar.classList.add('ew-sidebar-collapsed');
    if (sidebarToggle) sidebarToggle.textContent = '>';
    applyFontSize(ewFontSizeMultiplier); // Apply default font size
  }
}

function loadAndApplyFontSize() {
  if (chrome.runtime?.id) {
    chrome.storage.local.get('fontSizeMultiplier', (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW_CONTENT: Error loading fontSizeMultiplier", chrome.runtime.lastError.message);
        applyFontSize(ewFontSizeMultiplier); // Apply current default or last known
        return;
      }
      if (result.fontSizeMultiplier) {
        let loadedMultiplier = parseFloat(result.fontSizeMultiplier);
        if (isNaN(loadedMultiplier) || loadedMultiplier < 0.7 || loadedMultiplier > 2.0) {
           ewFontSizeMultiplier = 1.0; // Reset if invalid
        } else {
           ewFontSizeMultiplier = loadedMultiplier;
        }
      }
      applyFontSize(ewFontSizeMultiplier);
    });
  } else {
    applyFontSize(ewFontSizeMultiplier); // Apply current default or last known if context invalid
  }
}


// Resize Sidebar Functions
function ewOnResizeMouseDown(event) {
  if (event.button !== 0 || !sidebar) return; // Only left mouse button and if sidebar exists

  isEwResizing = true;
  ewResizeType = event.target.dataset.resizeType; 
  
  ewResizeStartX = event.clientX;
  ewResizeStartY = event.clientY;
  
  ewInitialSidebarWidth = sidebar.offsetWidth;
  ewInitialSidebarHeight = sidebar.offsetHeight;
  // For 'left' resizing, we need the initial 'left' CSS value (or calculated if 'auto')
  // and initial 'right' CSS value to correctly adjust width and left.
  // getComputedStyle is more reliable for 'auto' or complex values.
  const computedStyle = window.getComputedStyle(sidebar);
  ewInitialSidebarLeft = parseFloat(computedStyle.left) || 0; // Use 0 if 'auto' or not parseable

  // Update max height based on current viewport
  EW_SIDEBAR_MAX_HEIGHT = Math.floor(window.innerHeight * 0.9);

  document.documentElement.style.userSelect = 'none';
  document.documentElement.addEventListener('mousemove', ewOnResizeMouseMove, { passive: false });
  document.documentElement.addEventListener('mouseup', ewOnResizeMouseUp, { once: true });
  event.preventDefault();
}

function ewOnResizeMouseMove(event) {
  if (!isEwResizing || !sidebar) return;
  event.preventDefault();

  const dx = event.clientX - ewResizeStartX;
  const dy = event.clientY - ewResizeStartY;

  if (ewResizeType === 'left') {
    let newWidth = ewInitialSidebarWidth - dx;
    
    // Apply constraints
    newWidth = Math.max(EW_SIDEBAR_MIN_WIDTH, Math.min(newWidth, EW_SIDEBAR_MAX_WIDTH));
    
    const widthChange = ewInitialSidebarWidth - newWidth;
    let newLeft = ewInitialSidebarLeft + widthChange;

    // Boundary check for left position (don't go off-screen left)
    newLeft = Math.max(0, newLeft);
    // Boundary check for right position (don't go off-screen right due to width change)
    if (newLeft + newWidth > window.innerWidth) {
      newLeft = window.innerWidth - newWidth; // Adjust left to keep right edge within viewport
      // Recalculate newWidth if newLeft was capped, to ensure it doesn't exceed max width or viewport
      newWidth = window.innerWidth - newLeft;
      newWidth = Math.max(EW_SIDEBAR_MIN_WIDTH, Math.min(newWidth, EW_SIDEBAR_MAX_WIDTH));
    }


    sidebar.style.width = newWidth + 'px';
    sidebar.style.left = newLeft + 'px';
    sidebar.style.right = 'auto'; // Ensure left positioning takes precedence
  } else if (ewResizeType === 'bottom') {
    let newHeight = ewInitialSidebarHeight + dy;
    newHeight = Math.max(EW_SIDEBAR_MIN_HEIGHT, Math.min(newHeight, EW_SIDEBAR_MAX_HEIGHT));
    sidebar.style.height = newHeight + 'px';
  }
}

function ewOnResizeMouseUp(event) {
  if (!isEwResizing || !sidebar) return;
  isEwResizing = false;

  document.documentElement.style.userSelect = 'auto';
  document.documentElement.removeEventListener('mousemove', ewOnResizeMouseMove);

  const finalWidth = sidebar.style.width;
  const finalHeight = sidebar.style.height;
  const finalLeft = sidebar.style.left; 

  let dimensionsToSave = {};
  if (finalWidth && finalWidth !== 'auto') dimensionsToSave.ewSidebarWidth = finalWidth;
  if (finalHeight && finalHeight !== 'auto') dimensionsToSave.ewSidebarHeight = finalHeight;
  // Only save 'left' if it was actively changed during a 'left' resize
  if (ewResizeType === 'left' && finalLeft && finalLeft !== 'auto') {
     dimensionsToSave.ewSidebarLeft = finalLeft;
  }

  if (Object.keys(dimensionsToSave).length > 0 && chrome.runtime?.id) {
    chrome.storage.local.set(dimensionsToSave, () => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error saving sidebar dimensions:", chrome.runtime.lastError.message);
      } else {
        console.log("EW: Sidebar dimensions saved:", dimensionsToSave);
      }
    });
  }
  ewResizeType = ''; 
}


// Drag and Drop Sidebar Functions
function ewOnMouseDown(event) {
  if (event.button !== 0 || !sidebar) return; // Only react to left mouse button and if sidebar exists

  isEwDragging = true;
  ewDragStartX = event.clientX;
  ewDragStartY = event.clientY;
  
  const sidebarRect = sidebar.getBoundingClientRect();
  ewSidebarInitialX = sidebarRect.left;
  ewSidebarInitialY = sidebarRect.top;

  // Apply dragging styles and listeners
  sidebar.style.userSelect = 'none'; // Prevent text selection on the sidebar itself
  document.documentElement.style.userSelect = 'none'; // Prevent text selection on the page
  
  // Use non-passive listeners to allow preventDefault
  document.documentElement.addEventListener('mousemove', ewOnMouseMove, { passive: false });
  document.documentElement.addEventListener('mouseup', ewOnMouseUp, { once: true }); 
  
  event.preventDefault(); // Prevent default drag behaviors or text selection on the header
}

function ewOnMouseMove(event) {
  if (!isEwDragging || !sidebar) return;
  event.preventDefault(); // Essential for smooth dragging

  let dx = event.clientX - ewDragStartX;
  let dy = event.clientY - ewDragStartY;

  let newLeft = ewSidebarInitialX + dx;
  let newTop = ewSidebarInitialY + dy;

  // Boundary Checks
  const sidebarWidth = sidebar.offsetWidth;
  const sidebarHeight = sidebar.offsetHeight;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - sidebarWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - sidebarHeight));

  sidebar.style.left = newLeft + 'px';
  sidebar.style.top = newTop + 'px';
  sidebar.style.right = 'auto';  // Override initial 'right:0' CSS if it was used
  sidebar.style.bottom = 'auto'; // In case it was positioned with bottom
}

function ewOnMouseUp(event) {
  if (!isEwDragging || !sidebar) return; // Check if still dragging and sidebar exists
  isEwDragging = false;
  
  sidebar.style.userSelect = 'auto';
  document.documentElement.style.userSelect = 'auto';
  document.documentElement.removeEventListener('mousemove', ewOnMouseMove);
  // mouseup listener is auto-removed due to {once: true}

  // Save Position
  const finalTop = sidebar.style.top;
  const finalLeft = sidebar.style.left;

  if (chrome.runtime?.id) {
    chrome.storage.local.set({ ewSidebarTop: finalTop, ewSidebarLeft: finalLeft }, () => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error saving sidebar position:", chrome.runtime.lastError.message);
      } else {
        console.log("EW: Sidebar position saved:", {top: finalTop, left: finalLeft});
      }
    });
  }
}


// Remove UI elements and event listeners
function removeUI() {
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
    sidebarContent = null;
    sidebarToggle = null;
    ewSidebarHeader = null; // Clear header reference
  }
  // Clean up global mouse listeners if any were somehow left attached (though mouseup should handle it)
  document.documentElement.removeEventListener('mousemove', ewOnMouseMove);
  document.documentElement.removeEventListener('mouseup', ewOnMouseUp);
  document.documentElement.style.userSelect = 'auto'; // Ensure text selection is re-enabled
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

function ewHandleSidebarExpand() {
  if (!sidebar || !sidebarToggle) return;

  const EW_SIDEBAR_DEFAULT_TOP = '20%';
  const EW_SIDEBAR_DEFAULT_RIGHT = '0px';
  const EW_SIDEBAR_DEFAULT_LEFT = 'auto';

  // Always expand to default CSS position when using the toggle
  sidebar.style.left = EW_SIDEBAR_DEFAULT_LEFT;
  sidebar.style.right = EW_SIDEBAR_DEFAULT_RIGHT;
  sidebar.style.top = EW_SIDEBAR_DEFAULT_TOP; 
  
  sidebar.classList.remove('ew-sidebar-collapsed');
  sidebarToggle.textContent = '<';
  console.log("EW_CONTENT: Sidebar expanded to default edge position via toggle.");

  // This toggle action does not load or save ewSidebarLastDraggedLeft/Top.
  // The main drag logic still saves. The initial load (applyInitialSidebarStateAndSettings) 
  // also still uses ewSidebarLastDraggedLeft/Top if the sidebar was left open and dragged.
  // This specific toggle action ensures it *always* expands to the default edge.
  
  // Store sidebar collapsed state (boolean)
  if (chrome.runtime?.id) {
    chrome.storage.local.set({ sidebarCollapsed: false }, (result) => {
       if (chrome.runtime.lastError) {
          console.error("EW_CONTENT: Error saving sidebar collapsed state (false):", chrome.runtime.lastError.message);
       }
    });
  } else {
    console.warn("EW_CONTENT: Context invalidated, cannot save sidebar collapsed state (false).");
  }
}

function ewHandleSidebarCollapse() {
  if (!sidebar || !sidebarToggle) return;

  const EW_SIDEBAR_DEFAULT_TOP = '20%';
  const EW_SIDEBAR_DEFAULT_RIGHT = '0px';
  const EW_SIDEBAR_DEFAULT_LEFT = 'auto';
  
  // This toggle action does not save or clear ewSidebarLastDraggedLeft/Top.
  
  // Prepare for collapse: ensure it's positioned at the default edge for the transform.
  sidebar.style.left = EW_SIDEBAR_DEFAULT_LEFT;
  sidebar.style.right = EW_SIDEBAR_DEFAULT_RIGHT; 
  sidebar.style.top = EW_SIDEBAR_DEFAULT_TOP; // Ensure fixed default top position
  
  console.log("EW_CONTENT: Sidebar positioned to default edge before collapsing animation."); // Added log
  sidebar.classList.add('ew-sidebar-collapsed');
  sidebarToggle.textContent = '>';
  console.log("EW_CONTENT: Sidebar collapsed to default edge position via toggle.");

  // Store sidebar collapsed state (boolean)
  if (chrome.runtime?.id) {
    chrome.storage.local.set({ sidebarCollapsed: true }, () => { // Removed unused 'result' parameter
       if (chrome.runtime.lastError) {
          console.error("EW_CONTENT: Error saving sidebar collapsed state (true):", chrome.runtime.lastError.message);
       }
    });
  } else {
    console.warn("EW_CONTENT: Context invalidated, cannot save sidebar collapsed state (true).");
  }
}

function createSidebar() {
  console.log("EW_CONTENT: createSidebar called. Timestamp:", Date.now());
  if (document.getElementById('ew-sidebar')) return; // Already exists

  sidebar = document.createElement('div');
  sidebar.id = 'ew-sidebar';
  sidebar.classList.add('ew-sidebar-collapsed'); // Start collapsed

  sidebarToggle = document.createElement('div');
  sidebarToggle.id = 'ew-sidebar-toggle';
  sidebarToggle.textContent = '>'; // Indicate it can be expanded

  sidebarToggle.addEventListener('click', () => {
    if (!sidebar) return; 

    if (sidebar.classList.contains('ew-sidebar-collapsed')) {
      ewHandleSidebarExpand();
    } else {
      ewHandleSidebarCollapse();
    }
  });

  sidebarContent = document.createElement('div');
  sidebarContent.id = 'ew-sidebar-content';
  sidebarContent.textContent = '...'; // Initial text

  const localSidebarHeader = document.createElement('h4'); // Renamed to avoid conflict if global is accessed before assignment
  localSidebarHeader.id = 'ew-sidebar-header'; // ADDED ID
  localSidebarHeader.textContent = "英文寫法";
  localSidebarHeader.style.margin = "0 0 10px 0";
  localSidebarHeader.style.padding = "0";
  ewSidebarHeader = localSidebarHeader; // ASSIGNED to global
  if (ewSidebarHeader) { 
    // Remove existing listener before adding, to prevent duplicates if createSidebar is called multiple times
    ewSidebarHeader.removeEventListener('mousedown', ewOnMouseDown);
    ewSidebarHeader.addEventListener('mousedown', ewOnMouseDown);
  }

  const fontControlsContainer = document.createElement('div');
  fontControlsContainer.id = 'ew-font-controls';

  const fontDecreaseButton = document.createElement('button');
  fontDecreaseButton.id = 'ew-font-decrease';
  fontDecreaseButton.textContent = 'A-';

  const fontIncreaseButton = document.createElement('button');
  fontIncreaseButton.id = 'ew-font-increase';
  fontIncreaseButton.textContent = 'A+';

  fontControlsContainer.appendChild(fontDecreaseButton);
  fontControlsContainer.appendChild(fontIncreaseButton);

  const shortcutDisplay = document.createElement('div');
  shortcutDisplay.id = 'ew-shortcut-display';
  shortcutDisplay.textContent = 'Shortcut: ...'; // Placeholder, updated by initializeUI

  sidebar.appendChild(sidebarToggle);
  sidebar.appendChild(ewSidebarHeader); // Use the global (now assigned) variable
  sidebar.appendChild(fontControlsContainer); // Added font controls
  sidebar.appendChild(shortcutDisplay); 
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

  // Create resize handles
  const resizeHandleLeft = document.createElement('div');
  resizeHandleLeft.id = 'ew-resize-handle-left';
  resizeHandleLeft.dataset.resizeType = 'left'; // Store type for event handler

  const resizeHandleBottom = document.createElement('div');
  resizeHandleBottom.id = 'ew-resize-handle-bottom';
  resizeHandleBottom.dataset.resizeType = 'bottom'; // Store type for event handler
  
  // Append handles to the sidebar
  sidebar.appendChild(resizeHandleLeft);
  sidebar.appendChild(resizeHandleBottom);

  // Attach mousedown listeners for resizing
  if (resizeHandleLeft) {
    resizeHandleLeft.removeEventListener('mousedown', ewOnResizeMouseDown); // Prevent duplicates
    resizeHandleLeft.addEventListener('mousedown', ewOnResizeMouseDown);
  }
  if (resizeHandleBottom) {
    resizeHandleBottom.removeEventListener('mousedown', ewOnResizeMouseDown); // Prevent duplicates
    resizeHandleBottom.addEventListener('mousedown', ewOnResizeMouseDown);
  }
  
  document.body.appendChild(sidebar);

  // NOTE: All restoration logic (collapsed state, position, dimensions, font size) 
  // is now intended to be handled by initializeUI via applyInitialSidebarStateAndSettings.
  // createSidebar should focus only on creating the DOM elements with their default classes and listeners.
}

// Ensure UI is initialized when the script loads if enabled
if (isExtensionEnabled) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initializeUI();
  } else {
    document.addEventListener("DOMContentLoaded", initializeUI);
  }
}