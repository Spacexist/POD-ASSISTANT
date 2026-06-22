// options.js

document.addEventListener('DOMContentLoaded', async () => {
  const input = document.getElementById('subfolder');
  const btnSave = document.getElementById('btn-save');
  const toast = document.getElementById('toast');
  const pathPreview = document.getElementById('path-preview');

  // 读取已保存的设置
  const { subfolder = 'Temu' } = await chrome.storage.sync.get('subfolder');
  input.value = subfolder;
  updatePreview(subfolder);

  // 实时更新路径预览
  input.addEventListener('input', () => {
    updatePreview(input.value.trim() || 'Temu');
  });

  // 保存
  btnSave.addEventListener('click', async () => {
    const value = input.value.trim() || 'Temu';
    await chrome.storage.sync.set({ subfolder: value });

    // 显示成功提示
    toast.classList.add('toast--visible');
    setTimeout(() => toast.classList.remove('toast--visible'), 2500);
  });

  function updatePreview(folder) {
    pathPreview.innerHTML = `📁 Chrome下载目录 / <strong>${escapeHtml(folder)}</strong> / 商品标题.jpg`;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
