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

// Initialize UI elements and event listeners
function initializeUI() {
  if (!document.getElementById('ew-sidebar')) {
    createSidebar(); 
  } else {
    // If sidebar exists, ensure font controls are there or re-add them,
    // and re-attach listeners. This can happen if the script is re-injected.
    if (!document.getElementById('ew-font-controls')) {
        // This is a simplified case; ideally, createSidebar would be idempotent
        // or we'd have a separate function to ensure UI elements.
        // For now, assume createSidebar being called again is okay or handled.
        // Alternatively, directly add font controls if sidebar exists but they don't.
    }
  }
  
  // Attach listeners to font controls
  const fontDecreaseButton = document.getElementById('ew-font-decrease');
  const fontIncreaseButton = document.getElementById('ew-font-increase');

  if (fontDecreaseButton) {
    fontDecreaseButton.addEventListener('click', () => {
      ewFontSizeMultiplier -= 0.1;
      if (ewFontSizeMultiplier < 0.7) ewFontSizeMultiplier = 0.7; // Min limit
      applyFontSize(ewFontSizeMultiplier);
      if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
    });
  }

  if (fontIncreaseButton) {
    fontIncreaseButton.addEventListener('click', () => {
      ewFontSizeMultiplier += 0.1;
      if (ewFontSizeMultiplier > 2.0) ewFontSizeMultiplier = 2.0; // Max limit
      applyFontSize(ewFontSizeMultiplier);
      if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
    });
  }

  // Load and Apply Initial Font Size
  if (chrome.runtime?.id) {
    chrome.storage.local.get('fontSizeMultiplier', (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error loading fontSizeMultiplier", chrome.runtime.lastError.message);
        applyFontSize(ewFontSizeMultiplier); // Apply default
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
    applyFontSize(ewFontSizeMultiplier); // Apply default if context invalid
  }

  // Request shortcut info
  if (chrome.runtime?.id) { 
    console.log("EW: content.js sending GET_SHORTCUT_INFO to background.");
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

function applyDefaultDimensions() {
  if (sidebar) {
    sidebar.style.width = '280px'; // Default width from CSS
    sidebar.style.height = 'auto';  // Default height behavior
    // sidebar.style.left = 'auto'; // Let draggable handle this if not set
    // sidebar.style.right = '0px'; // Default position from CSS
    console.log("EW: Applied default sidebar dimensions.");
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
function createSidebar() {
  if (document.getElementById('ew-sidebar')) return; // Already exists

  sidebar = document.createElement('div');
  sidebar.id = 'ew-sidebar';
  sidebar.classList.add('ew-sidebar-collapsed'); // Start collapsed

  sidebarToggle = document.createElement('div');
  sidebarToggle.id = 'ew-sidebar-toggle';
  sidebarToggle.textContent = '>'; // Indicate it can be expanded

  sidebarToggle.addEventListener('click', () => {
    const isCurrentlyCollapsed = sidebar.classList.contains('ew-sidebar-collapsed');
    const currentTop = sidebar.style.top || window.getComputedStyle(sidebar).top || '20%'; 

    if (isCurrentlyCollapsed) { // EXPANDING
      // 1. Remove class (this will start the transition if any styles change immediately)
      sidebar.classList.remove('ew-sidebar-collapsed');
      // 2. Set toggle text
      sidebarToggle.textContent = '<';
      // 3. Retrieve and apply stored position or default
      if (chrome.runtime?.id) {
        chrome.storage.local.get(['ewSidebarLastDraggedLeft', 'ewSidebarLastDraggedTop'], (result) => {
          if (chrome.runtime.lastError) {
            console.error("EW: Error getting last dragged pos for expand:", chrome.runtime.lastError.message);
            sidebar.style.left = 'auto';
            sidebar.style.right = '0px';
            sidebar.style.top = '20%'; // Default top
            return;
          }
          if (result.ewSidebarLastDraggedLeft && result.ewSidebarLastDraggedTop) {
            console.log("EW: Restoring last dragged position on expand:", result);
            sidebar.style.left = result.ewSidebarLastDraggedLeft;
            sidebar.style.top = result.ewSidebarLastDraggedTop;
            sidebar.style.right = 'auto'; // Override default CSS 'right:0'
          } else {
            console.log("EW: No last dragged position found, defaulting to right edge on expand.");
            sidebar.style.left = 'auto';
            sidebar.style.right = '0px';
            sidebar.style.top = '20%'; // Default top from CSS
          }
        });
      } else {
        console.warn("EW: Context invalidated, defaulting sidebar position on expand.");
        sidebar.style.left = 'auto';
        sidebar.style.right = '0px';
        sidebar.style.top = '20%'; // Default top
      }
    } else { // COLLAPSING
      // 1. Check if sidebar.style.left is set and not 'auto', indicating it has been dragged.
      if (sidebar.style.left && sidebar.style.left !== 'auto') {
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ 
            ewSidebarLastDraggedLeft: sidebar.style.left, 
            ewSidebarLastDraggedTop: sidebar.style.top 
          }, () => { 
            if (chrome.runtime.lastError) console.error("EW: Error saving last dragged pos:", chrome.runtime.lastError.message); 
            else console.log("EW: Saved last dragged position:", {left: sidebar.style.left, top: sidebar.style.top});
          });
        }
      } else {
        // 2. If not dragged (or already at default edge), explicitly clear any stored drag position
        if (chrome.runtime?.id) {
          chrome.storage.local.remove(['ewSidebarLastDraggedLeft', 'ewSidebarLastDraggedTop'], () => {
             if (chrome.runtime.lastError) console.error("EW: Error clearing last dragged pos:", chrome.runtime.lastError.message);
             else console.log("EW: Sidebar was at default right edge, cleared stored drag pos.");
          });
        }
      }
      
      // 3. Prepare for collapse: ensure it's positioned at the right edge for the transform.
      sidebar.style.left = 'auto';
      sidebar.style.right = '0px'; 
      sidebar.style.top = currentTop; // Ensure top is explicitly set based on its value before collapse starts
      
      // 4. Add class to trigger collapse animation
      sidebar.classList.add('ew-sidebar-collapsed');
      // 5. Set toggle text
      sidebarToggle.textContent = '>';
    }

    // Store sidebar collapsed state (boolean)
    if (chrome.runtime?.id) {
      chrome.storage.local.set({ sidebarCollapsed: sidebar.classList.contains('ew-sidebar-collapsed') }, () => {
         if (chrome.runtime.lastError) console.error("EW: Error saving sidebar collapsed state:", chrome.runtime.lastError.message);
      });
    } else {
      console.warn("EW: Context invalidated, cannot save sidebar collapsed state.");
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
  if (ewSidebarHeader) { // Attach mousedown listener for dragging
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
  if (resizeHandleLeft) resizeHandleLeft.addEventListener('mousedown', ewOnResizeMouseDown);
  if (resizeHandleBottom) resizeHandleBottom.addEventListener('mousedown', ewOnResizeMouseDown);
  
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

  // Restore sidebar position
  if (chrome.runtime?.id && sidebar) { // Ensure sidebar exists and context is valid
    chrome.storage.local.get(['ewSidebarTop', 'ewSidebarLeft'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error loading sidebar position:", chrome.runtime.lastError.message);
        return;
      }
      
      let restored = false;
      if (result.ewSidebarLeft && result.ewSidebarLeft !== 'auto') { // Check if a valid 'left' was stored
        sidebar.style.left = result.ewSidebarLeft;
        sidebar.style.right = 'auto'; // Important: override initial 'right:0'
        restored = true;
        console.log("EW: Restored sidebar left:", result.ewSidebarLeft);
      }
      if (result.ewSidebarTop && result.ewSidebarTop !== 'auto') { // Check if a valid 'top' was stored
        sidebar.style.top = result.ewSidebarTop;
        sidebar.style.bottom = 'auto'; // Important: override initial 'bottom' if it was ever used
        restored = true;
        console.log("EW: Restored sidebar top:", result.ewSidebarTop);
      }

      if (restored) {
          console.log("EW: Sidebar position restored.");
      } else {
          console.log("EW: No saved sidebar position found or applied, relying on CSS defaults.");
      }
    });
  } else if (!sidebar) {
      console.warn("EW: Sidebar not available to restore position (at restore code block).");
  } else {
      console.warn("EW: Context invalidated, cannot restore sidebar position (at restore code block).");
  }

  // Restore sidebar dimensions (width, height)
  if (chrome.runtime?.id && sidebar) { 
    chrome.storage.local.get(['ewSidebarWidth', 'ewSidebarHeight'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error loading sidebar dimensions:", chrome.runtime.lastError.message);
        applyDefaultDimensions(); 
        return;
      }
      
      let dimensionsRestored = false;
      if (result.ewSidebarWidth) {
        const newWidth = parseFloat(result.ewSidebarWidth);
        if (!isNaN(newWidth) && newWidth >= EW_SIDEBAR_MIN_WIDTH && newWidth <= EW_SIDEBAR_MAX_WIDTH) {
          sidebar.style.width = newWidth + 'px';
          dimensionsRestored = true;
          console.log("EW: Restored sidebar width:", newWidth + 'px');
        }
      }
      if (result.ewSidebarHeight) {
        const newHeight = parseFloat(result.ewSidebarHeight);
        const currentMaxHeight = Math.floor(window.innerHeight * 0.9); // Recalculate or use EW_SIDEBAR_MAX_HEIGHT
        if (!isNaN(newHeight) && newHeight >= EW_SIDEBAR_MIN_HEIGHT && newHeight <= currentMaxHeight) {
          sidebar.style.height = newHeight + 'px';
          dimensionsRestored = true;
          console.log("EW: Restored sidebar height:", newHeight + 'px');
        }
      }

      if (dimensionsRestored) {
          console.log("EW: Sidebar dimensions restored.");
      } else {
          console.log("EW: No saved sidebar dimensions found/applied, using defaults or CSS.");
          // Apply default only if nothing was restored, to avoid overriding a single restored dimension
          if (!result.ewSidebarWidth && !result.ewSidebarHeight) {
            applyDefaultDimensions();
          }
      }
    });
  } else if (!sidebar) {
      console.warn("EW: Sidebar not available to restore dimensions (at dimension restore block).");
  } else {
      console.warn("EW: Context invalidated, cannot restore sidebar dimensions (at dimension restore block).");
      applyDefaultDimensions(); 
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