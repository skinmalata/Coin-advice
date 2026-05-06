document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('a');
    btn.href = 'https://t.me/mycoinadvice';
    btn.target = '_blank';
    btn.innerHTML = '📢 Join Telegram';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#0088cc;color:#fff;padding:12px 18px;border-radius:30px;font-weight:600;box-shadow:0 4px 12px rgba(0,136,204,0.4);z-index:9999;text-decoration:none;font-size:14px;';
    document.body.appendChild(btn);
});
