// Language persistence
document.addEventListener('DOMContentLoaded', function() {
  const saved_lang = localStorage.getItem('docs_language');
  if (saved_lang && window.location.pathname.indexOf(`/${saved_lang}/`) === -1) {
    const current_path = window.location.pathname;
    const base = current_path.split('/').slice(0, 2).join('/');
    window.location.href = `${base}/${saved_lang}/`;
  }

  document.querySelectorAll('a[hreflang]').forEach(function(link) {
    link.addEventListener('click', function() {
      const lang = this.getAttribute('hreflang');
      localStorage.setItem('docs_language', lang);
    });
  });
});
