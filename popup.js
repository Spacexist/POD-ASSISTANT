// popup.js
// ⚠️ 只读取 storage 显示信息 + 打开设置页
// ⚠️ 绝对不调用 chrome.tabs.sendMessage（会导致 connection 报错）

document.addEventListener('DOMContentLoaded', async () => {
  // 读取并显示当前子文件夹设置
  const { subfolder = 'Temu' } = await chrome.storage.sync.get('subfolder');
  document.getElementById('current-folder').textContent = subfolder;

  // 打开设置页
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
