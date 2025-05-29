console.log("EW_CONTENT: Script started injecting/running. Timestamp:", Date.now());
// Global variables
let sidebar = null;
let sidebarContent = null;
let sidebarToggle = null;
let ewSidebarHeader = null; 
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

// Initialize on load
if (chrome.runtime?.id) {
  chrome.storage.sync.get(['isEnabled', 'writingStyle'], (result) => {
    isExtensionEnabled = typeof result.isEnabled === 'undefined' ? true : result.isEnabled;
    if (isExtensionEnabled) {
      initializeUI();
    }
  });
} else {
  console.log("EW: Context invalidated during initial setup.");
}

// Listen for messages from popup or background
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        if (!sidebar || !sidebarContent || !sidebarToggle) {
            console.log("EW: Sidebar not fully initialized (top frame), creating it now for TRANSLATION_STARTED.");
            createSidebar(); // createSidebar itself is guarded
        }
        
        if (sidebarContent) {
            sidebarContent.innerHTML = '<span class="ew-loading-spinner"></span> 翻譯進行中...';
        }

        const copyButton = document.getElementById('ew-copy-button');
        if (copyButton) {
            copyButton.style.display = 'none';
        }

        if (sidebar && sidebarToggle) { 
            sidebar.style.display = 'block'; 
            if (sidebar.classList.contains('ew-sidebar-collapsed')) {
                // sidebar.classList.remove('ew-sidebar-collapsed'); // This is handled by ewHandleSidebarExpand
                // sidebarToggle.textContent = '<';
                ewHandleSidebarExpand(); // Use the main function to ensure consistent behavior
                if (chrome.runtime?.id) {
                    chrome.storage.local.set({ sidebarCollapsed: false });
                }
            }
        }
      } else {
        console.log("EW: TRANSLATION_STARTED received in iframe, not creating or manipulating sidebar.");
      }
      sendResponse({ status: "Translation started UI updated" });

    } else if (request.type === 'DISPLAY_TRANSLATION') {
      console.log("EW: content.js received DISPLAY_TRANSLATION message.");
      if (window.self === window.top) { // Explicit check for top frame
        if (!sidebar || !sidebarContent || !sidebarToggle) { 
          console.log("EW: Sidebar not fully initialized (top frame), creating it now for DISPLAY_TRANSLATION.");
          createSidebar(); // createSidebar itself is guarded
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

        if (sidebar && sidebarToggle) {
          sidebar.style.display = 'block'; 
          if (sidebar.classList.contains('ew-sidebar-collapsed')) {
            // sidebar.classList.remove('ew-sidebar-collapsed'); // Handled by ewHandleSidebarExpand
            // sidebarToggle.textContent = '<';
            ewHandleSidebarExpand(); // Use the main function
            if (chrome.runtime?.id) {
              chrome.storage.local.set({ sidebarCollapsed: false });
            }
          }
        }
      } else {
        console.log("EW: DISPLAY_TRANSLATION received in iframe, not creating or manipulating sidebar.");
      }
      sendResponse({ status: "Translation displayed" });
    }
    return true; 
  });
  console.log("EW_CONTENT: Message listener attached successfully.");
} catch (e) {
  console.error("EW_CONTENT: Error attaching message listener:", e);
}

// Initialize UI elements and event listeners
function initializeUI() {
  console.log("EW_CONTENT: initializeUI called.");
  if (window.self !== window.top) {
    console.log("EW_CONTENT: initializeUI called in an iframe, skipping sidebar creation and UI setup.");
    return;
  }

  if (!document.getElementById('ew-sidebar')) {
    createSidebar(); 
  } else {
    if (!document.getElementById('ew-font-controls') && sidebar) {
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
  }

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
          console.warn("EW: Shortcut display div not found.");
          return;
      }
      if (chrome.runtime.lastError) {
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
}

function applyFontSize(multiplier) {
  if (sidebarContent) {
    sidebarContent.style.fontSize = `${EW_BASE_FONT_SIZE * multiplier}px`;
  }
  const shortcutDisplay = document.getElementById('ew-shortcut-display');
  if (shortcutDisplay) {
    shortcutDisplay.style.fontSize = `${(EW_BASE_FONT_SIZE - 2) * multiplier}px`; 
  }
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
    return;
  }
  applyDefaultDimensions();
  if (chrome.runtime?.id) {
    chrome.storage.local.get(['sidebarCollapsed', 'ewSidebarTop', 'ewSidebarLeft', 'ewSidebarWidth', 'ewSidebarHeight'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("EW: Error loading initial state:", chrome.runtime.lastError.message);
        sidebar.classList.add('ew-sidebar-collapsed'); // Default to collapsed on error
        if (sidebarToggle) sidebarToggle.textContent = '>';
        applyFontSize(ewFontSizeMultiplier); 
        return;
      }

      let shouldBeCollapsed = typeof result.sidebarCollapsed === 'undefined' ? true : result.sidebarCollapsed;

      if (shouldBeCollapsed) {
        sidebar.classList.add('ew-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.textContent = '>';
        // Position is already default from applyDefaultDimensions, which is correct for collapsed state
      } else {
        // If it's not supposed to be collapsed, set its open position and dimensions
        sidebar.classList.remove('ew-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.textContent = '<';
        
        // Restore position and dimensions if available and not collapsed
        if (result.ewSidebarTop) sidebar.style.top = result.ewSidebarTop;
        if (result.ewSidebarLeft) sidebar.style.left = result.ewSidebarLeft;
        // If left is restored, right should be auto
        if (result.ewSidebarLeft && result.ewSidebarLeft !== 'auto') sidebar.style.right = 'auto'; 

        if (result.ewSidebarWidth) sidebar.style.width = result.ewSidebarWidth;
        if (result.ewSidebarHeight) sidebar.style.height = result.ewSidebarHeight;
      }
      loadAndApplyFontSize();
    });
  } else {
    // Fallback if chrome.storage is not available
    sidebar.classList.add('ew-sidebar-collapsed');
    if (sidebarToggle) sidebarToggle.textContent = '>';
    applyFontSize(ewFontSizeMultiplier); 
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
  if (window.self !== window.top) {
    console.log("EW_CONTENT: Attempted to create sidebar in an iframe, aborted.");
    return;
  }
  if (document.getElementById('ew-sidebar')) return; 

  sidebar = document.createElement('div');
  sidebar.id = 'ew-sidebar';
  // Class 'ew-sidebar-collapsed' is added by applyInitialSidebarStateAndSettings based on stored state

  sidebarToggle = document.createElement('div');
  sidebarToggle.id = 'ew-sidebar-toggle';
  // textContent for toggle is set by applyInitialSidebarStateAndSettings
  sidebarToggle.addEventListener('click', () => {
    if (!sidebar) return; 
    const isCollapsed = sidebar.classList.contains('ew-sidebar-collapsed');
    if (isCollapsed) {
      ewHandleSidebarExpand();
    } else {
      ewHandleSidebarCollapse();
    }
  });

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
  fixedControls.appendChild(fontControlsContainer); // Append to fixedControls

  const shortcutDisplay = document.createElement('div');
  shortcutDisplay.id = 'ew-shortcut-display';
  shortcutDisplay.textContent = 'Shortcut: ...'; 
  fixedControls.appendChild(shortcutDisplay); // Append to fixedControls

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
  sidebar.appendChild(sidebarToggle);
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
  document.body.appendChild(sidebar);
  
  // Initial state application is now primarily in initializeUI via applyInitialSidebarStateAndSettings
}

function ewHandleSidebarExpand() {
  if (!sidebar || !sidebarToggle) return;

  // Ensure it's positioned correctly for expansion at the default edge
  sidebar.style.left = 'auto';
  sidebar.style.right = '0px';
  sidebar.style.top = '20%'; 
  
  // Remove the collapsed class to trigger the transform animation
  // Make sure transform is cleared if it was set to translateX directly for some reason
  sidebar.style.transform = ''; // Clear any direct transform
  sidebar.classList.remove('ew-sidebar-collapsed');
  sidebarToggle.textContent = '<';

  if (chrome.runtime?.id) {
    chrome.storage.local.set({ sidebarCollapsed: false });
  }
}

function ewHandleSidebarCollapse() {
  if (!sidebar || !sidebarToggle) return;

  const sidebarRect = sidebar.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight; // Get window height for percentage calculation
  
  const sidebarCurrentWidth = sidebarRect.width; // Get current width for targetLeft calculation

  // Default docked position (target)
  const targetTopPercent = 20;
  const targetTopPx = windowHeight * (targetTopPercent / 100);
  // Target right is 0px, so target left depends on sidebar width
  const targetLeftPx = windowWidth - sidebarCurrentWidth; 

  // Current position
  const currentTopPx = sidebarRect.top;
  const currentLeftPx = sidebarRect.left;

  // Threshold to decide if animation is needed
  const positionThreshold = 5; // 5px threshold

  const isAtTargetTop = Math.abs(currentTopPx - targetTopPx) < positionThreshold;
  // For 'left', compare with targetLeftPx (calculated from right:0)
  const isAtTargetLeft = Math.abs(currentLeftPx - targetLeftPx) < positionThreshold;

  // If the sidebar is significantly away from its target docked position
  if (!isAtTargetTop || !isAtTargetLeft) {
    // Ensure sidebar is positioned with left/top for JS animation
    sidebar.style.right = 'auto'; // Important: allow left to be controlled
    sidebar.style.left = currentLeftPx + 'px';
    sidebar.style.top = currentTopPx + 'px';

    const animationDuration = 200; // ms for the slide to edge animation
    let startTime = null;

    function animateReturnToEdge(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const fraction = Math.min(progress / animationDuration, 1);

      // Linear interpolation (ease-out could be added with a simple easing function)
      const newLeft = currentLeftPx + (targetLeftPx - currentLeftPx) * fraction;
      const newTop = currentTopPx + (targetTopPx - currentTopPx) * fraction;

      sidebar.style.left = newLeft + 'px';
      sidebar.style.top = newTop + 'px';

      if (fraction < 1) {
        requestAnimationFrame(animateReturnToEdge);
      } else {
        // Animation complete: Snap to final target position and then collapse
        sidebar.style.left = 'auto';
        sidebar.style.right = '0px';
        sidebar.style.top = targetTopPercent + '%'; // Use percentage for final state

        sidebar.classList.add('ew-sidebar-collapsed');
        sidebarToggle.textContent = '>';
        if (chrome.runtime?.id) {
          chrome.storage.local.set({ sidebarCollapsed: true });
        }
      }
    }
    requestAnimationFrame(animateReturnToEdge);

  } else {
    // If already at (or very near) the target docked position, just collapse directly.
    // Ensure it's perfectly at the default position before transform.
    sidebar.style.left = 'auto';
    sidebar.style.right = '0px';
    sidebar.style.top = targetTopPercent + '%'; // Use percentage
    
    sidebar.classList.add('ew-sidebar-collapsed');
    sidebarToggle.textContent = '>';
    if (chrome.runtime?.id) {
      chrome.storage.local.set({ sidebarCollapsed: true });
    }
  }
}

if (isExtensionEnabled) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initializeUI();
  } else {
    document.addEventListener("DOMContentLoaded", initializeUI);
  }
}