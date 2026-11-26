// content.js — Bridge between Chrome Extension side panel/background and webpage DOM
import {
  admitpilotPageExtract,
  admitpilotPageFill,
  admitpilotAttachFiles,
  admitpilotPageAnalyze,
} from '../injected/page-funcs';

function isValidOrigin(sender: chrome.runtime.MessageSender): boolean {
  if (sender.url?.startsWith('chrome-extension://')) {
    return true;
  }
  if (!sender.url) {
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isValidOrigin(sender)) {
    console.warn('Blocked message from invalid origin:', sender.url);
    sendResponse({ success: false, error: 'Invalid origin' });
    return true;
  }

  if (message.action === 'PING') {
    sendResponse({ success: true, status: 'pong', url: window.location.href });
    return true;
  }

  if (message.action === 'SCAN_FORM') {
    try {
      const fields = admitpilotPageExtract();
      sendResponse({ success: true, fields });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.action === 'ANALYZE_PAGE') {
    try {
      const pageInfo = admitpilotPageAnalyze();
      sendResponse({ success: true, pageInfo });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.action === 'FILL_FORM') {
    try {
      const result = admitpilotPageFill(message.mappings || []);
      sendResponse({ success: true, result });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.action === 'ATTACH_FILES') {
    try {
      const result = admitpilotAttachFiles(message.attachments || []);
      sendResponse({ success: true, result });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  return false;
});
