console.log("EW_CONTENT: Script started injecting/running. Timestamp:", Date.now());
try {
// Global variables
let isFabDragging = false;
let fabDragStartX = 0, fabDragStartY = 0;
let fabInitialX = 0, fabInitialY = 0;
let fabWasDragged = false; // To distinguish drag from click
const EW_FAB_STORAGE_KEY = 'ewFabPosition'; // Unique key

let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let ewSidebarHeader = null; 
let fabButton = null; // Added fabButton
let isExtensionEnabled = true;
let ewFontSizeMultiplier = 1.0; 
const EW_BASE_FONT_SIZE = 14; 

let isEwDragging = false;
let ewDragStartX = 0, ewDragStartY = 0;
let ewSidebarInitialX = 0, ewSidebarInitialY = 0;

let isEwResizing = false;
let ewResizeType = ''; 
let ewResizeStartX = 0, ewResizeStartY = 0;
let ewInitialSidebarWidth = 0, ewInitialSidebarHeight = 0;
let ewInitialSidebarLeft = 0; 

const EW_SIDEBAR_MIN_WIDTH = 200; 
const EW_SIDEBAR_MAX_WIDTH = 800; 
const EW_SIDEBAR_MIN_HEIGHT = 150; 
let EW_SIDEBAR_MAX_HEIGHT = 600; 

// Refactored Initialization Logic
let domReady = (document.readyState === "complete" || document.readyState === "interactive");
let settingsLoaded = false; // Flag to track if settings are loaded

function attemptInitialize() {
    // console.log("EW_CONTENT_DEBUG: attemptInitialize called. domReady:", domReady, "settingsLoaded:", settingsLoaded, "isExtensionEnabled:", isExtensionEnabled);
    if (domReady && settingsLoaded && isExtensionEnabled) {
        console.log("EW_CONTENT: DOM ready, settings loaded, and extension enabled. Initializing UI.");
        initializeUI();
    } else if (domReady && settingsLoaded && !isExtensionEnabled) {
        console.log("EW_CONTENT: DOM ready, settings loaded, but extension is disabled. Not initializing UI.");
        // removeUI(); // Be cautious if removeUI itself depends on initialized elements
    }
}

if (chrome.runtime?.id) {
  chrome.storage.sync.get(['isEnabled', 'writingStyle'], (result) => {
    console.log("EW_CONTENT: Storage settings received.", result);
    isExtensionEnabled = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
    // writingStyle is loaded here but used elsewhere (e.g. triggerTranslation)
    settingsLoaded = true;
    attemptInitialize(); // Attempt to initialize after settings are loaded
  });
} else {
  console.log("EW_CONTENT: Context invalidated, cannot load settings. Assuming disabled.");
  isExtensionEnabled = false;
  settingsLoaded = true; // Mark as loaded to allow domReady check to proceed if it happens
  attemptInitialize();
}

// DOMContentLoaded listener
if (!domReady) {
    document.addEventListener("DOMContentLoaded", () => {
        console.log("EW_CONTENT: DOMContentLoaded event fired.");
        domReady = true;
        attemptInitialize(); // Attempt to initialize once DOM is ready
    });
} else {
    // If DOM is already ready when this part of script runs,
    // settings might not be loaded yet, attemptInitialize will handle that.
    attemptInitialize();
}

// Listen for messages from popup or background
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(`EW_CONTENT: Message received - Type: ${request?.type}, From: ${sender?.id}, Tab: ${sender?.tab?.id}`);
    if (request.type === 'TOGGLE_ENABLED') {
      isExtensionEnabled = request.enabled;
      if (isExtensionEnabled) {
        initializeUI(); // This will correctly do nothing in an iframe
        if (window.self === window.top && sidebar) { // Explicit check for top frame
          sidebar.style.display = 'block'; 
        }
      } else {
        if (window.self === window.top) { // removeUI should only run in top frame
            removeUI();
        }
      }
      sendResponse({ status: "Visibility toggled" });
    } else if (request.type === 'UPDATE_SIDEBAR') {
      if (window.self === window.top) { // Explicit check for top frame
        if (sidebarContent && isExtensionEnabled) {
          sidebarContent.textContent = request.text;
        }
      }
      sendResponse({ status: "Sidebar updated" });
    } else if (request.type === 'TRANSLATION_STARTED') {
      console.log("EW: content.js received TRANSLATION_STARTED message.");
      if (window.self === window.top) { // Explicit check for top frame
        // MODIFIED CONDITION:
        if (!sidebar || !sidebarContent) { // sidebarToggle check removed
            console.log("EW: Sidebar panel not fully initialized (top frame), creating it now for TRANSLATION_STARTED.");
            createSidebar();
        }
        
        if (sidebarContent) {
            sidebarContent.innerHTML = '<span class="ew-loading-spinner"></span> 翻譯進行中...';
        }

        const copyButton = document.getElementById('ew-copy-button');
        if (copyButton) {
            copyButton.style.display = 'none';
        }

        // Ensure the panel is open if a translation is started
        if (sidebar && fabButton && !sidebar.classList.contains('open')) {
           console.log("EW: Translation started, ensuring panel is open.");
           sidebar.classList.add('open');
           fabButton.textContent = '✕';
        }

      } else {
        console.log("EW: TRANSLATION_STARTED received in iframe, not creating or manipulating sidebar.");
      }
      sendResponse({ status: "Translation started UI updated" });

    } else if (request.type === 'DISPLAY_TRANSLATION') {
      console.log("EW: content.js received DISPLAY_TRANSLATION message.");
      if (window.self === window.top) { // Explicit check for top frame
        // MODIFIED CONDITION:
        if (!sidebar || !sidebarContent) { // sidebarToggle check removed
          console.log("EW: Sidebar panel not fully initialized (top frame), creating it now for DISPLAY_TRANSLATION.");
          createSidebar();
        }

        const copyButton = document.getElementById('ew-copy-button');

        if (request.data) {
          if (request.data.translatedText && request.data.translatedText.trim() !== "") {
            if(sidebarContent) sidebarContent.textContent = request.data.translatedText;
            if (copyButton) copyButton.style.display = 'block';
          } else if (request.data.error) {
            if(sidebarContent) sidebarContent.textContent = request.data.error;
            if (copyButton) copyButton.style.display = 'none';
          } else {
            if(sidebarContent) sidebarContent.textContent = '無翻譯結果或未知錯誤。';
            if (copyButton) copyButton.style.display = 'none';
          }
        } else {
          if(sidebarContent) sidebarContent.textContent = '收到無效的翻譯資料。'; 
          if (copyButton) copyButton.style.display = 'none';
        }

        // Ensure the panel is open if a translation is displayed
        if (sidebar && fabButton && !sidebar.classList.contains('open')) {
           console.log("EW: Translation displayed, ensuring panel is open.");
           sidebar.classList.add('open');
           fabButton.textContent = '✕';
        }

      } else {
        console.log("EW: DISPLAY_TRANSLATION received in iframe, not creating or manipulating sidebar.");
      }
      sendResponse({ status: "Translation displayed" });
    } else if (request.type === 'PING_CONTENT_SCRIPT') {
      console.log("EW_CONTENT: Received PING_CONTENT_SCRIPT, sending PONG.");
      sendResponse({ type: "PONG_FROM_CONTENT" });
      return true;
    }
    return true; 
  });
  console.log("EW_CONTENT: Message listener attached successfully.");
} catch (e) {
  console.error("EW_CONTENT: Error attaching message listener:", e);
}

function onFabMouseDown(event) {
  if (event.button !== 0 || !fabButton) return;
  isFabDragging = true;
  fabWasDragged = false; // Reset drag flag
  fabDragStartX = event.clientX;
  fabDragStartY = event.clientY;
  const fabRect = fabButton.getBoundingClientRect();
  fabInitialX = fabRect.left;
  fabInitialY = fabRect.top;
  fabButton.style.cursor = 'move';
  document.documentElement.style.userSelect = 'none';
  document.addEventListener('mousemove', onFabMouseMove, { passive: false });
  document.addEventListener('mouseup', onFabMouseUp, { once: true });
  event.preventDefault();
}

function onFabMouseMove(event) {
  if (!isFabDragging || !fabButton) return;
  event.preventDefault();
  let deltaX = event.clientX - fabDragStartX;
  let deltaY = event.clientY - fabDragStartY;

  // If moved more than a few pixels, consider it a drag
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      fabWasDragged = true;
  }

  let newLeft = fabInitialX + deltaX;
  let newTop = fabInitialY + deltaY;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - fabButton.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - fabButton.offsetHeight));
  fabButton.style.left = newLeft + 'px';
  fabButton.style.top = newTop + 'px';
  fabButton.style.right = 'auto';
  fabButton.style.bottom = 'auto';
}

function onFabMouseUp(event) {
  if (!isFabDragging || !fabButton) return;
  isFabDragging = false;
  fabButton.style.cursor = 'pointer';
  document.documentElement.style.userSelect = 'auto';
  document.removeEventListener('mousemove', onFabMouseMove);
  // event.stopPropagation(); // May not be needed with fabWasDragged flag

  const finalRect = fabButton.getBoundingClientRect();
  if (chrome.runtime?.id) {
    chrome.storage.local.set({ [EW_FAB_STORAGE_KEY]: { left: finalRect.left, top: finalRect.top } });
  }
  // Reset fabWasDragged slightly later to allow click handler to process
  // This is a common pattern, but ensure the click handler logic is robust.
  // If fabWasDragged is checked in click, it should work.
}

// Initialize UI elements and event listeners
function initializeUI() {
    // console.log("EW_CONTENT_DEBUG: initializeUI called.");
    if (window.self !== window.top) {
      // console.log("EW_CONTENT_DEBUG: initializeUI: In an iframe, skipping.");
      return;
    }

    // console.log("EW_CONTENT_DEBUG: initializeUI: Top window, proceeding.");

    if (!document.getElementById('ew-sidebar')) {
      // console.log("EW_CONTENT_DEBUG: initializeUI: #ew-sidebar not found, calling createSidebar().");
      createSidebar();
    } else {
      // console.log("EW_CONTENT_DEBUG: initializeUI: #ew-sidebar already exists.");
    }

    if (!document.getElementById('q-fab-button')) {
      // console.log("EW_CONTENT_DEBUG: initializeUI: #q-fab-button not found, calling createFabButton().");
      createFabButton();
    } else {
      // console.log("EW_CONTENT_DEBUG: initializeUI: #q-fab-button already exists.");
    }

    if (document.getElementById('ew-sidebar') && !document.getElementById('ew-font-controls') && sidebar) {
        // console.log("EW_CONTENT_DEBUG: initializeUI: Re-adding font controls.");
        const fontControlsContainer = document.createElement('div');
        fontControlsContainer.id = 'ew-font-controls';
        const newFontDecreaseButton = document.createElement('button');
        newFontDecreaseButton.id = 'ew-font-decrease';
        newFontDecreaseButton.textContent = 'A-';
        const newFontIncreaseButton = document.createElement('button');
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
        newFontDecreaseButton.addEventListener('click', handleFontDecrease);
        newFontDecreaseButton.ewListenerAttached = true; 
        newFontIncreaseButton.addEventListener('click', handleFontIncrease);
        newFontIncreaseButton.ewListenerAttached = true;
    }

    // console.log("EW_CONTENT_DEBUG: initializeUI: Calling applyInitialSidebarStateAndSettings().");
    applyInitialSidebarStateAndSettings();

    const fontDecreaseButton = document.getElementById('ew-font-decrease');
    const fontIncreaseButton = document.getElementById('ew-font-increase');

    if (fontDecreaseButton && !fontDecreaseButton.ewListenerAttached) {
      fontDecreaseButton.addEventListener('click', handleFontDecrease);
      fontDecreaseButton.ewListenerAttached = true;
    }
    if (fontIncreaseButton && !fontIncreaseButton.ewListenerAttached) {
      fontIncreaseButton.addEventListener('click', handleFontIncrease);
      fontIncreaseButton.ewListenerAttached = true;
    }

    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: "GET_SHORTCUT_INFO" }, (response) => {
        const shortcutDiv = document.getElementById('ew-shortcut-display');
        if (!shortcutDiv) {
            // console.warn("EW_CONTENT_DEBUG: initializeUI: Shortcut display div not found.");
            // Keep original warnings if any, or remove if they were debug only
            console.warn("EW: Shortcut display div not found.");
            return;
        }
        if (chrome.runtime.lastError) {
          // console.error("EW_CONTENT_DEBUG: initializeUI: Error getting shortcut info:", chrome.runtime.lastError.message);
          // Keep original errors if any
          console.error("EW: Error getting shortcut info:", chrome.runtime.lastError.message);
          shortcutDiv.textContent = 'Shortcut: Error';
          return;
        }
        if (response && response.shortcut) {
          shortcutDiv.textContent = `Shortcut: ${response.shortcut}`;
        } else {
          shortcutDiv.textContent = 'Shortcut: N/A';
        }
      });
    } else {
      const shortcutDiv = document.getElementById('ew-shortcut-display');
      if (sidebar && shortcutDiv) {
          shortcutDiv.textContent = 'Shortcut: N/A';
      }
    }
    // console.log("EW_CONTENT_DEBUG: initializeUI completed.");
}

// MODIFIED applyFontSize function
function applyFontSize(multiplier) {
  if (sidebarContent) { // sidebarContent might not exist if UI not fully initialized
    sidebarContent.style.fontSize = `${EW_BASE_FONT_SIZE * multiplier}px`;
  }
  // Removed the block that modifies shortcutDisplay.style.fontSize
}

function handleFontDecrease() {
    ewFontSizeMultiplier -= 0.1;
    if (ewFontSizeMultiplier < 0.7) ewFontSizeMultiplier = 0.7; 
    applyFontSize(ewFontSizeMultiplier);
    if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
}

function handleFontIncrease() {
    ewFontSizeMultiplier += 0.1;
    if (ewFontSizeMultiplier > 2.0) ewFontSizeMultiplier = 2.0; 
    applyFontSize(ewFontSizeMultiplier);
    if (chrome.runtime?.id) chrome.storage.local.set({ fontSizeMultiplier: ewFontSizeMultiplier });
}

function applyDefaultDimensions() {
  if (sidebar) {
    sidebar.style.width = ''; 
    sidebar.style.height = ''; 
    sidebar.style.left = 'auto'; 
    sidebar.style.right = '0px'; 
    sidebar.style.top = '20%';   
    sidebar.style.bottom = 'auto';
  }
}

function applyInitialSidebarStateAndSettings() {
  if (!sidebar) {
    console.warn("EW_CONTENT: applyInitialSidebarStateAndSettings called but sidebar is null.");
    return;
  }

  // applyDefaultDimensions(); // Removed: Initial dimensions/visibility are now CSS controlled.
                               // Stored dimensions for drag/resize can be re-evaluated later if that feature is kept.

  if (chrome.runtime?.id) {
    // All logic related to 'sidebarCollapsed' (reading, applying class, saving) is removed.
    // The primary function here is now to load and apply internal settings like font size.
    if (typeof loadAndApplyFontSize === "function") {
      loadAndApplyFontSize();
    }
  } else {
    // Fallback for invalid context
    console.warn("EW_CONTENT: Context invalidated during applyInitialSidebarStateAndSettings.");
    if (typeof loadAndApplyFontSize === "function") loadAndApplyFontSize();
  }
}

function loadAndApplyFontSize() {
  if (!sidebar) return; 
  if (chrome.runtime?.id) {
    chrome.storage.local.get('fontSizeMultiplier', (result) => {
      if (chrome.runtime.lastError) {
        applyFontSize(ewFontSizeMultiplier); 
        return;
      }
      if (result.fontSizeMultiplier) {
        let loadedMultiplier = parseFloat(result.fontSizeMultiplier);
        ewFontSizeMultiplier = (isNaN(loadedMultiplier) || loadedMultiplier < 0.7 || loadedMultiplier > 2.0) ? 1.0 : loadedMultiplier;
      }
      applyFontSize(ewFontSizeMultiplier);
    });
  } else {
    applyFontSize(ewFontSizeMultiplier); 
  }
}

function ewOnResizeMouseDown(event) {
  if (event.button !== 0 || !sidebar) return; // Only left mouse button and if sidebar exists

  isEwResizing = true;
  ewResizeType = event.target.dataset.resizeType; 
  
  ewResizeStartX = event.clientX;
  ewResizeStartY = event.clientY;
  
  ewInitialSidebarWidth = sidebar.offsetWidth;
  ewInitialSidebarHeight = sidebar.offsetHeight;
  
  const computedStyle = window.getComputedStyle(sidebar);

  if (ewResizeType === 'left') {
    ewInitialSidebarLeft = parseFloat(computedStyle.left) || 0;
  } else if (ewResizeType === 'top') {
    // For 'top' resize, we need initial height and initial Y (top) position.
    // ewInitialSidebarHeight is already captured.
    // ewSidebarInitialY is used for the top position of the sidebar (similar to how ewSidebarInitialX is used for left in drag)
    ewSidebarInitialY = sidebar.getBoundingClientRect().top; 
  }
  // For 'right' resize, ewInitialSidebarWidth is already captured.
  // For 'bottom' resize, ewInitialSidebarHeight is already captured.

  // Update max height dynamically based on current viewport
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
    newWidth = Math.max(EW_SIDEBAR_MIN_WIDTH, Math.min(newWidth, EW_SIDEBAR_MAX_WIDTH));
    const widthChange = ewInitialSidebarWidth - newWidth;
    let newLeft = ewInitialSidebarLeft + widthChange;
    newLeft = Math.max(0, newLeft);
    if (newLeft + newWidth > window.innerWidth) {
      newLeft = window.innerWidth - newWidth;
      newWidth = Math.max(EW_SIDEBAR_MIN_WIDTH, Math.min(window.innerWidth - newLeft, EW_SIDEBAR_MAX_WIDTH));
    }
    sidebar.style.width = newWidth + 'px';
    sidebar.style.left = newLeft + 'px';
    sidebar.style.right = 'auto'; 
  } else if (ewResizeType === 'bottom') {
    let newHeight = ewInitialSidebarHeight + dy;
    newHeight = Math.max(EW_SIDEBAR_MIN_HEIGHT, Math.min(newHeight, EW_SIDEBAR_MAX_HEIGHT));
    sidebar.style.height = newHeight + 'px';
  }
}

function ewOnResizeMouseUp() {
  if (!isEwResizing || !sidebar) return;
  isEwResizing = false;
  document.documentElement.style.userSelect = 'auto';
  document.documentElement.removeEventListener('mousemove', ewOnResizeMouseMove);
  let dimensionsToSave = {
    ewSidebarWidth: sidebar.style.width,
    ewSidebarHeight: sidebar.style.height,
    ...(ewResizeType === 'left' && sidebar.style.left !== 'auto' && { ewSidebarLeft: sidebar.style.left })
  };
  if (chrome.runtime?.id) chrome.storage.local.set(dimensionsToSave);
  ewResizeType = ''; 
}

function ewOnMouseDown(event) {
  if (event.button !== 0 || !sidebar) return; 
  isEwDragging = true;
  ewDragStartX = event.clientX;
  ewDragStartY = event.clientY;
  const sidebarRect = sidebar.getBoundingClientRect();
  ewSidebarInitialX = sidebarRect.left;
  ewSidebarInitialY = sidebarRect.top;
  sidebar.style.userSelect = 'none'; 
  document.documentElement.style.userSelect = 'none'; 
  document.documentElement.addEventListener('mousemove', ewOnMouseMove, { passive: false });
  document.documentElement.addEventListener('mouseup', ewOnMouseUp, { once: true }); 
  event.preventDefault(); 
}

function ewOnMouseMove(event) {
  if (!isEwDragging || !sidebar) return;
  event.preventDefault(); 
  let newLeft = ewSidebarInitialX + (event.clientX - ewDragStartX);
  let newTop = ewSidebarInitialY + (event.clientY - ewDragStartY);
  const sidebarWidth = sidebar.offsetWidth;
  const sidebarHeight = sidebar.offsetHeight;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - sidebarWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - sidebarHeight));
  sidebar.style.left = newLeft + 'px';
  sidebar.style.top = newTop + 'px';
  sidebar.style.right = 'auto';  
  sidebar.style.bottom = 'auto'; 
}

function ewOnMouseUp() {
  if (!isEwDragging || !sidebar) return; 
  isEwDragging = false;
  sidebar.style.userSelect = 'auto';
  document.documentElement.style.userSelect = 'auto';
  document.documentElement.removeEventListener('mousemove', ewOnMouseMove);
  if (chrome.runtime?.id) {
    // Save the final dragged position
    chrome.storage.local.set({ 
        ewSidebarTop: sidebar.style.top, 
        ewSidebarLeft: sidebar.style.left,
        // Also save current dimensions when drag ends, as dragging might be combined with resizing implicitly
        ewSidebarWidth: sidebar.style.width, 
        ewSidebarHeight: sidebar.style.height 
    });
  }
}

function removeUI() {
  if (sidebar) { 
    sidebar.remove();
    sidebar = null;
    sidebarContent = null;
    sidebarToggle = null;
    ewSidebarHeader = null; 
  }
  if (fabButton) { // Remove FAB button
    fabButton.remove();
    fabButton = null;
  }
  document.documentElement.removeEventListener('mousemove', ewOnMouseMove);
  document.documentElement.removeEventListener('mouseup', ewOnMouseUp);
  document.documentElement.style.userSelect = 'auto'; 
}

function triggerTranslation(text) {
  if (!isExtensionEnabled || !text) return;
  if (chrome.runtime?.id) {
    chrome.storage.sync.get(['writingStyle'], (settings) => {
      if (chrome.runtime.lastError) return;
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text: text, style: settings.writingStyle }, (response) => {
          if (chrome.runtime.lastError) console.error("Error sending message:", chrome.runtime.lastError.message);
        });
      }
    });
  }
}

function createSidebar() {
    // console.log("EW_CONTENT_DEBUG: createSidebar called.");
    if (window.self !== window.top) {
      // console.log("EW_CONTENT_DEBUG: createSidebar: In an iframe, aborted.");
      console.log("EW_CONTENT: Attempted to create sidebar in an iframe, aborted."); // Keep original if it was this
      return;
    }
    if (document.getElementById('ew-sidebar')) {
      // console.log("EW_CONTENT_DEBUG: createSidebar: #ew-sidebar already exists. Returning.");
      return;
    }

    sidebar = document.createElement('div');
    sidebar.id = 'ew-sidebar';

    // Create the new fixed controls wrapper
  const fixedControls = document.createElement('div');
  fixedControls.id = 'ew-sidebar-fixed-controls';

  // sidebarContent is created before fixedControls, but appended after
  sidebarContent = document.createElement('div');
  sidebarContent.id = 'ew-sidebar-content';
  sidebarContent.textContent = '...'; 

  ewSidebarHeader = document.createElement('h4'); 
  ewSidebarHeader.id = 'ew-sidebar-header'; 
  ewSidebarHeader.textContent = "英文寫法";
  // Inline styles for margin and padding removed, will be handled by CSS
  ewSidebarHeader.addEventListener('mousedown', ewOnMouseDown);
  fixedControls.appendChild(ewSidebarHeader); // Append to fixedControls

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
  // fixedControls.appendChild(fontControlsContainer); // No longer direct child of fixedControls

  const shortcutDisplay = document.createElement('div');
  shortcutDisplay.id = 'ew-shortcut-display';
  shortcutDisplay.textContent = 'Shortcut: ...'; 
  // fixedControls.appendChild(shortcutDisplay); // No longer direct child of fixedControls

  const fontShortcutWrapper = document.createElement('div');
  fontShortcutWrapper.id = 'ew-font-shortcut-wrapper';
  fontShortcutWrapper.appendChild(fontControlsContainer);
  fontShortcutWrapper.appendChild(shortcutDisplay);
  fixedControls.appendChild(fontShortcutWrapper);

  const copyButton = document.createElement('button');
  copyButton.id = 'ew-copy-button';
  copyButton.textContent = '複製翻譯';
  copyButton.style.display = 'none'; 
  copyButton.addEventListener('click', () => {
    if (sidebarContent && sidebarContent.textContent && !sidebarContent.textContent.startsWith('翻譯中...') && !sidebarContent.textContent.startsWith('錯誤:') && sidebarContent.textContent !== '...' && sidebarContent.textContent !== '無翻譯結果' && !sidebarContent.textContent.startsWith('輸入中:')) {
      navigator.clipboard.writeText(sidebarContent.textContent).then(() => {
        const originalText = copyButton.textContent;
        copyButton.textContent = '已複製!';
        setTimeout(() => { copyButton.textContent = originalText; }, 1500);
      }).catch(err => console.error('EW: Could not copy text: ', err));
    }
  });
  fixedControls.appendChild(copyButton); // Append to fixedControls

  // Append elements to sidebar in the correct order
  // sidebar.appendChild(sidebarToggle); // sidebarToggle is removed
  sidebar.appendChild(fixedControls);    // Append the new wrapper
  sidebar.appendChild(sidebarContent);   // Append content after fixed controls

  const resizeHandleLeft = document.createElement('div');
  resizeHandleLeft.id = 'ew-resize-handle-left';
  resizeHandleLeft.dataset.resizeType = 'left'; 
  resizeHandleLeft.addEventListener('mousedown', ewOnResizeMouseDown);

  const resizeHandleBottom = document.createElement('div');
  resizeHandleBottom.id = 'ew-resize-handle-bottom';
  resizeHandleBottom.dataset.resizeType = 'bottom'; 
  resizeHandleBottom.addEventListener('mousedown', ewOnResizeMouseDown);

  const resizeHandleTop = document.createElement('div');
  resizeHandleTop.id = 'ew-resize-handle-top';
  resizeHandleTop.dataset.resizeType = 'top';
  resizeHandleTop.addEventListener('mousedown', ewOnResizeMouseDown);

  const resizeHandleRight = document.createElement('div');
  resizeHandleRight.id = 'ew-resize-handle-right';
  resizeHandleRight.dataset.resizeType = 'right';
  resizeHandleRight.addEventListener('mousedown', ewOnResizeMouseDown);
  
  sidebar.appendChild(resizeHandleLeft);
  sidebar.appendChild(resizeHandleBottom);
  sidebar.appendChild(resizeHandleTop);
  sidebar.appendChild(resizeHandleRight);
  // console.log("EW_CONTENT_DEBUG: createSidebar: Main sidebar element and children created. Attempting to append to document.body.");
  if (!document.body) {
      // console.error("EW_CONTENT_DEBUG: createSidebar: document.body is not available!");
      // Decide if this is a critical error to keep, or if the script would fail anyway.
      // For now, assuming it's a critical scenario that should be logged if it occurs.
      console.error("EW_CONTENT: createSidebar: document.body is not available! Cannot append sidebar.");
      return;
  }
  document.body.appendChild(sidebar);
  // console.log("EW_CONTENT_DEBUG: createSidebar: Main sidebar element appended to document.body.");
  // console.log("EW_CONTENT_DEBUG: createSidebar completed.");
}

function ewHandleSidebarExpand() {
  // if (!sidebar || !sidebarToggle) return; // sidebarToggle removed + function body commented out
  // Ensure it's positioned correctly for expansion at the default edge
  // sidebar.style.left = 'auto';
  // sidebar.style.right = '0px';
  // sidebar.style.top = '20%';
  
  // Remove the collapsed class to trigger the transform animation
  // Make sure transform is cleared if it was set to translateX directly for some reason
  // sidebar.style.transform = ''; // Clear any direct transform
  // // sidebar.classList.remove('ew-sidebar-collapsed'); // Visibility managed by FAB
  // // sidebarToggle.textContent = '<'; // sidebarToggle removed

  // // if (chrome.runtime?.id) { // Logic for saving state temporarily disabled
  // //   chrome.storage.local.set({ sidebarCollapsed: false });
  // // }
}

function ewHandleSidebarCollapse() {
  // // if (!sidebar || !sidebarToggle) return; // sidebarToggle removed + function body commented out
  // if (!sidebar) return;

  // const sidebarRect = sidebar.getBoundingClientRect();
  // const windowWidth = window.innerWidth;
  // const windowHeight = window.innerHeight; // Get window height for percentage calculation
  
  // const sidebarCurrentWidth = sidebarRect.width; // Get current width for targetLeft calculation

  // // Default docked position (target)
  // const targetTopPercent = 20;
  // const targetTopPx = windowHeight * (targetTopPercent / 100);
  // // Target right is 0px, so target left depends on sidebar width
  // const targetLeftPx = windowWidth - sidebarCurrentWidth;

  // // Current position
  // const currentTopPx = sidebarRect.top;
  // const currentLeftPx = sidebarRect.left;

  // // Threshold to decide if animation is needed
  // const positionThreshold = 5; // 5px threshold

  // const isAtTargetTop = Math.abs(currentTopPx - targetTopPx) < positionThreshold;
  // // For 'left', compare with targetLeftPx (calculated from right:0)
  // const isAtTargetLeft = Math.abs(currentLeftPx - targetLeftPx) < positionThreshold;

  // // If the sidebar is significantly away from its target docked position
  // if (!isAtTargetTop || !isAtTargetLeft) {
  //   // Ensure sidebar is positioned with left/top for JS animation
  //   sidebar.style.right = 'auto'; // Important: allow left to be controlled
  //   sidebar.style.left = currentLeftPx + 'px';
  //   sidebar.style.top = currentTopPx + 'px';

  //   const animationDuration = 200; // ms for the slide to edge animation
  //   let startTime = null;

  //   function animateReturnToEdge(timestamp) {
  //     if (!startTime) startTime = timestamp;
  //     const progress = timestamp - startTime;
  //     const fraction = Math.min(progress / animationDuration, 1);

  //     // Linear interpolation (ease-out could be added with a simple easing function)
  //     const newLeft = currentLeftPx + (targetLeftPx - currentLeftPx) * fraction;
  //     const newTop = currentTopPx + (targetTopPx - currentTopPx) * fraction;

  //     sidebar.style.left = newLeft + 'px';
  //     sidebar.style.top = newTop + 'px';

  //     if (fraction < 1) {
  //       requestAnimationFrame(animateReturnToEdge);
  //     } else {
  //       // Animation complete: Snap to final target position and then collapse
  //       sidebar.style.left = 'auto';
  //       sidebar.style.right = '0px';
  //       sidebar.style.top = targetTopPercent + '%'; // Use percentage for final state

  //       // sidebar.classList.add('ew-sidebar-collapsed'); // Visibility managed by FAB
  //       // sidebarToggle.textContent = '>'; // sidebarToggle removed
  //       // if (chrome.runtime?.id) { // Logic for saving state temporarily disabled
  //       //   chrome.storage.local.set({ sidebarCollapsed: true });
  //       // }
  //     }
  //   }
  //   requestAnimationFrame(animateReturnToEdge);

  // } else {
  //   // If already at (or very near) the target docked position, just collapse directly.
  //   // Ensure it's perfectly at the default position before transform.
  //   sidebar.style.left = 'auto';
  //   sidebar.style.right = '0px';
  //   sidebar.style.top = targetTopPercent + '%'; // Use percentage

  //   // sidebar.classList.add('ew-sidebar-collapsed'); // Visibility managed by FAB
  //   // sidebarToggle.textContent = '>'; // sidebarToggle removed
  //   // if (chrome.runtime?.id) { // Logic for saving state temporarily disabled
  //   //   chrome.storage.local.set({ sidebarCollapsed: true });
  //   // }
  // }
}

// Function to create the FAB
function createFabButton() {
    // console.log("EW_CONTENT_DEBUG: createFabButton called.");
    if (document.getElementById('q-fab-button')) {
        // console.log("EW_CONTENT_DEBUG: createFabButton: #q-fab-button already exists. Returning.");
        return;
    }

    fabButton = document.createElement('div');
    fabButton.id = 'q-fab-button';
    fabButton.textContent = 'Q';

    // console.log("EW_CONTENT_DEBUG: createFabButton: fabButton element created. Attempting to append to document.body.");
    if (!document.body) {
        // console.error("EW_CONTENT_DEBUG: createFabButton: document.body is not available!");
        console.error("EW_CONTENT: createFabButton: document.body is not available! Cannot append FAB.");
        return;
    }
    document.body.appendChild(fabButton);
    // console.log("EW_CONTENT_DEBUG: createFabButton: fabButton appended to document.body.");

    // Add event listener here:
    if (!fabButton.ewFabListenerAttached) {
        fabButton.addEventListener('click', () => {
            if (fabWasDragged) {
                fabWasDragged = false; // Reset for next interaction
                return;
            }
            if (sidebar) {
                sidebar.classList.toggle('open');
                if (sidebar.classList.contains('open')) {
                    fabButton.textContent = '✕';
                } else {
                    fabButton.textContent = 'Q';
                }
            }
        });
        fabButton.ewFabListenerAttached = true;
    }
    fabButton.addEventListener('mousedown', onFabMouseDown);

    if (chrome.runtime?.id) {
      chrome.storage.local.get(EW_FAB_STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          console.error("EW_CONTENT: Error loading FAB position:", chrome.runtime.lastError.message);
        }
        if (fabButton) { // Check if fabButton still exists (e.g. not removed by disabling extension)
          if (result[EW_FAB_STORAGE_KEY]) {
            fabButton.style.left = result[EW_FAB_STORAGE_KEY].left + 'px';
            fabButton.style.top = result[EW_FAB_STORAGE_KEY].top + 'px';
            fabButton.style.right = 'auto';
            fabButton.style.bottom = 'auto';
          } else {
            // Default position if nothing in storage or key is missing
            fabButton.style.left = 'auto'; // Let CSS default or explicitly set
            fabButton.style.top = '20px';  // Default if not in storage
            fabButton.style.right = '20px';
            fabButton.style.bottom = 'auto';
          }
        }
      });
    } else if (fabButton) {
         // Default position if runtime.id is not available (e.g. tests or unusual context)
         fabButton.style.left = 'auto';
         fabButton.style.top = '20px';
         fabButton.style.right = '20px';
         fabButton.style.bottom = 'auto';
    }
    // console.log("EW_CONTENT_DEBUG: createFabButton completed.");
}

// Old initialization block removed as per refactoring.
// if (isExtensionEnabled) {
//   if (document.readyState === "complete" || document.readyState === "interactive") {
//     initializeUI();
//   } else {
//     document.addEventListener("DOMContentLoaded", initializeUI);
//   }
// }
} catch (globalError) {
  console.error("EW_CONTENT: !!! Global unhandled error in content script !!!", globalError.message, globalError.stack, globalError);
}