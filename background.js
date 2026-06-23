// background.js — Service Worker
// 只负责接收 content.js 的消息并执行下载，不与 popup 通信

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadImage') {
    const { url, filename, subfolder, listing } = message;

    // 读取工作模式
    chrome.storage.sync.get(['mode'], (res) => {
      const mode = res.mode || 'cache';

      if (mode === 'local') {
        // 本地模式：读取本地序号计数器，递增后下载
        chrome.storage.local.get(['local_download_count'], (localRes) => {
          const currentCount = (localRes.local_download_count || 0) + 1;

          chrome.storage.local.set({ local_download_count: currentCount }, () => {
            const seqStr = String(currentCount).padStart(3, '0');
            const folder = (subfolder || 'Temu').replace(/\\/g, '/').replace(/\/$/, '');
            const safeName = filename || `temu_${Date.now()}`;
            const downloadPath = `${folder}/${seqStr}-${safeName}.jpg`;

            chrome.downloads.download(
              {
                url: url,
                filename: downloadPath,
                conflictAction: 'uniquify',
                saveAs: false,
              },
              (downloadId) => {
                if (chrome.runtime.lastError) {
                  console.error('[Temu DL] Download failed:', chrome.runtime.lastError.message);
                  sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                  console.log('[Temu DL] Download started, id:', downloadId);
                  const finalFileName = `${seqStr}-${safeName}.jpg`;
                  sendResponse({ success: true, downloadId, finalFileName });
                }
              }
            );
          });
        });
      } else {
        // 缓存模式：保存 JSON 数据至 local storage
        chrome.storage.local.get(['cached_items'], (localRes) => {
          const items = localRes.cached_items || [];
          // 检查重复（基于 imageurl 属性）
          const exists = items.some(item => item.imageurl === url);
          if (!exists) {
            // 生成编号：当前时间 (YYYYMMDDHHmmss) + 序号 (已缓存数+1，高位补零至4位)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const date = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timeStr = `${year}${month}${date}${hours}${minutes}${seconds}`;
            const seqStr = String(items.length + 1).padStart(4, '0');
            const idStr = `${timeStr}_${seqStr}`;

            // 在 listing 前面加一个 3 位递增数前缀，如 001-
            const prefixSeq = String(items.length + 1).padStart(3, '0');
            const prefixedListing = `${prefixSeq}-${listing}`;

            items.push({
              "编号": idStr,
              "listing": prefixedListing,
              "imageurl": url
            });
          }
          chrome.storage.local.set({ cached_items: items }, () => {
            console.log('[Temu DL] Item cached. Current total:', items.length);
            sendResponse({ success: true, cachedCount: items.length, alreadyExists: exists });
          });
        });
      }
    });

    return true; // 保持消息通道开放，等待异步回调
  }
});
