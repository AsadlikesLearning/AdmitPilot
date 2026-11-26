// background.js — MV3 Service Worker for AdmitPilot AI

// Validate message origin for security
function isValidOrigin(sender: chrome.runtime.MessageSender): boolean {
  // Allow messages from our extension's pages (side panel, popup, etc.)
  if (sender.url?.startsWith('chrome-extension://')) {
    return true;
  }
  // Allow internal runtime messages (e.g., from other extension components)
  if (!sender.url) {
    return true;
  }
  return false;
}

// Configure side panel to open on action click where supported
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('SidePanel API error:', err);
    });
  }
});

// Manage message relay between side panel and active tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Origin validation
  if (!isValidOrigin(sender)) {
    console.warn('Blocked message from invalid origin:', sender.url);
    sendResponse({ success: false, error: 'Invalid origin' });
    return true;
  }

  if (message.action === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }

  if (message.action === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id && chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId: tabs[0].id }).then(() => {
          sendResponse({ success: true });
        }).catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      } else {
        sendResponse({ success: false, error: 'SidePanel not available' });
      }
    });
    return true;
  }

  return false;
});

