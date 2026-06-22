// background.js — Service Worker
// 只负责接收 content.js 的消息并执行下载，不与 popup 通信

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadImage') {
    const { url, filename, subfolder } = message;

    // 构建下载路径：subfolder/filename.jpg
    const folder = (subfolder || 'Temu').replace(/\\/g, '/').replace(/\/$/, '');
    const safeName = filename || `temu_${Date.now()}`;
    const downloadPath = `${folder}/${safeName}.jpg`;

    chrome.downloads.download(
      {
        url: url,
        filename: downloadPath,
        conflictAction: 'uniquify', // 同名自动重命名
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[Temu DL] Download failed:', chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[Temu DL] Download started, id:', downloadId);
          sendResponse({ success: true, downloadId });
        }
      }
    );

    return true; // 保持消息通道开放，等待异步回调
  }
});
