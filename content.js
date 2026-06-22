// content.js — 注入 Temu 列表页，添加悬停下载按钮

// ─── 工具函数 ───────────────────────────────────────────────

/** 清理文件名，去除 Windows 非法字符，限制长度 */
function sanitizeFilename(title) {
  return (title || '')
    .replace(/[\/\\:*?"<>|]/g, '') // Windows 非法字符
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/** 从商品卡片中提取商品标题 */
function getTitle(card) {
  // 优先用 aria-label（最稳定）
  const group = card.querySelector('[role="group"][aria-label]');
  if (group) {
    const label = group.getAttribute('aria-label').trim();
    if (label) return label;
  }
  // 备选：h3 内的 span 文字
  const h3Span = card.querySelector('h3 span');
  if (h3Span && h3Span.innerText.trim()) return h3Span.innerText.trim();
  // 兜底
  return `temu_${Date.now()}`;
}

/** 从商品卡片中提取主图 URL（最高清版本） */
function getImageUrl(card) {
  // 第一优先：data-js-main-img 属性的 img
  const mainImg = card.querySelector('img[data-js-main-img="true"]');
  if (mainImg) {
    const src = mainImg.src || mainImg.getAttribute('src') || '';
    if (src.startsWith('https://')) {
      return upgradeImageQuality(src);
    }
  }

  // 第二优先：从商品链接 href 的 top_gallery_url 参数提取
  const goodsLink = card.querySelector('a[href*="goods.html"]');
  if (goodsLink) {
    try {
      const href = goodsLink.getAttribute('href');
      const url = new URL(href, location.origin);
      const galleryUrl = url.searchParams.get('top_gallery_url');
      if (galleryUrl) {
        return upgradeImageQuality(decodeURIComponent(galleryUrl));
      }
    } catch (_) {}
  }

  // 第三优先：data-tooltip-title 属性里可能有图片信息，最后尝试任意 img src
  const anyImg = card.querySelector('img[src*="kwcdn.com"]');
  if (anyImg) return upgradeImageQuality(anyImg.src);

  return null;
}

/** 将图片 URL 升级为原图最高质量 */
function upgradeImageQuality(url) {
  try {
    const u = new URL(url);

    // ① 去掉所有 query 参数
    //    Temu CDN 通过 ?imageView2/2/w/238/q/70/format/webp 限制尺寸
    //    去掉后直接返回原图
    u.search = '';

    // ② 去掉路径里的 _NNNxNNN 尺寸后缀（部分 URL 用这种方式）
    u.pathname = u.pathname.replace(/_\d+x\d+[^./]*/g, '');

    // ③ 把 .webp 换成 .jpg，保证下载后能直接打开
    if (u.pathname.toLowerCase().endsWith('.webp')) {
      u.pathname = u.pathname.slice(0, -5) + '.jpg';
    }

    return u.toString();
  } catch (_) {
    // URL 解析失败时兜底：至少去掉 query string
    return url.split('?')[0];
  }
}

// ─── 注入下载按钮 ───────────────────────────────────────────

function injectDownloadButton(card) {
  // 找到图片容器，用于相对定位
  const imgContainer = card.querySelector(
    '[class*="goods-image-container"], [class*="goods-img"]'
  );
  if (!imgContainer) return;

  // 确保容器有相对定位
  const containerStyle = getComputedStyle(imgContainer);
  if (containerStyle.position === 'static') {
    imgContainer.style.position = 'relative';
  }

  // 创建按钮
  const btn = document.createElement('button');
  btn.className = 'temu-dl-btn';
  btn.title = '下载图片';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z"/>
    </svg>
  `;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const imageUrl = getImageUrl(card);
    const title = getTitle(card);

    if (!imageUrl) {
      setButtonState(btn, 'error', '无法获取图片');
      return;
    }

    setButtonState(btn, 'loading');

    try {
      // 从 storage 获取子文件夹设置
      const { subfolder = 'Temu' } = await chrome.storage.sync.get('subfolder');
      const filename = sanitizeFilename(title);

      // 发消息给 background.js 执行下载
      chrome.runtime.sendMessage(
        {
          action: 'downloadImage',
          url: imageUrl,
          filename: filename,
          subfolder: subfolder,
        },
        (response) => {
          if (chrome.runtime.lastError || (response && !response.success)) {
            setButtonState(btn, 'error', '下载失败');
          } else {
            setButtonState(btn, 'success');
          }
        }
      );
    } catch (err) {
      console.error('[Temu DL]', err);
      setButtonState(btn, 'error', '下载失败');
    }
  });

  imgContainer.appendChild(btn);
}

/** 设置按钮状态 */
function setButtonState(btn, state, tooltip) {
  btn.className = `temu-dl-btn temu-dl-btn--${state}`;
  if (tooltip) btn.title = tooltip;

  if (state === 'loading') {
    btn.innerHTML = `<span class="temu-dl-spinner"></span>`;
    return;
  }

  if (state === 'success') {
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;
    setTimeout(() => {
      btn.className = 'temu-dl-btn';
      btn.title = '下载图片';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z"/></svg>`;
    }, 1800);
    return;
  }

  if (state === 'error') {
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    setTimeout(() => {
      btn.className = 'temu-dl-btn';
      btn.title = '下载图片';
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="16" height="16"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 2h14v2H5v-2z"/></svg>`;
    }, 2000);
  }
}

// ─── 扫描并注入 ─────────────────────────────────────────────

function scanAndInject() {
  // Temu 商品卡片：role="group" 且有 aria-label 的 div
  const cards = document.querySelectorAll(
    'div[role="group"][aria-label]:not([data-temu-dl-inited])'
  );
  cards.forEach((card) => {
    card.setAttribute('data-temu-dl-inited', '1');
    injectDownloadButton(card);
  });
}

// 初始扫描
scanAndInject();

// MutationObserver 处理无限滚动动态加载的商品
const observer = new MutationObserver(() => {
  scanAndInject();
});

observer.observe(document.body, { childList: true, subtree: true });
