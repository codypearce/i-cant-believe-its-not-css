// Import the virtual CSS produced by the icbincss plugin
import 'virtual:icbincss.css';

// Small dev overlay: press '?' to toggle tips
function ensureOverlay() {
  const id = 'icbincss-dev-overlay';
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id;
  el.style.position = 'fixed';
  el.style.right = '12px';
  el.style.bottom = '12px';
  el.style.padding = '10px 12px';
  el.style.zIndex = '99999';
  el.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  el.style.fontSize = '12px';
  el.style.lineHeight = '1.4';
  el.style.color = '#111';
  el.style.background = 'rgba(255,255,200,0.95)';
  el.style.border = '1px solid #ddd';
  el.style.borderRadius = '6px';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  el.style.maxWidth = '320px';
  el.style.display = 'none';
  el.innerHTML = `
    <strong>ICBINCSS Dev Tips</strong><br/>
    • HMR: edit <code>icbincss/**/*.sql</code> to rebuild CSS.<br/>
    • Inspect: in a terminal, run<br/>
      <code>npx icbincss inspect btn --final</code>
  `;
  document.body.appendChild(el);
  return el;
}

window.addEventListener('keydown', (e) => {
  if (e.key === '?') {
    const el = ensureOverlay();
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
});

console.log('ICBINCSS + Vite example loaded (press ? for tips)');
