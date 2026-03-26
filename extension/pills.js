
document.querySelectorAll('.lang-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const lang = pill.getAttribute('data-lang');
    document.getElementById('langSelect').value = lang;
    document.getElementById('langSelect').dispatchEvent(new Event('change'));
  });
});
