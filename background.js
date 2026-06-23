// background.js — Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadImage') {
    const { url, filename, subfolder } = message;

    // ── 基本校验 ──────────────────────────────────────────────
    if (!url || !url.startsWith('http')) {
      console.error('[Temu DL] Invalid URL:', url);
      sendResponse({ success: false, error: 'Invalid URL: ' + url });
      return true;
    }

    const folder = (subfolder || 'Temu').replace(/\\/g, '/').replace(/\/$/, '');
    const safeName = (filename || `temu_${Date.now()}`).replace(/[\/\\:*?"<>|]/g, '').trim() || `temu_${Date.now()}`;
    const downloadPath = `${folder}/${safeName}.jpg`;

    console.log('[Temu DL] Downloading:', { url, downloadPath });

    try {
      chrome.downloads.download(
        {
          url: url,
          filename: downloadPath,
          conflictAction: 'uniquify',
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message;
            console.error('[Temu DL] Download failed:', errMsg);
            sendResponse({ success: false, error: errMsg });
          } else {
            console.log('[Temu DL] Download started, id:', downloadId);
            sendResponse({ success: true, downloadId });
          }
        }
      );
    } catch (err) {
      console.error('[Temu DL] Exception in download:', err.message);
      sendResponse({ success: false, error: err.message });
    }

    return true; // 保持消息通道异步开放
  }
});
