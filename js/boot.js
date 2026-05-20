(function(){
  var t = localStorage.getItem('rwa_theme') || 'light';
  if (t === 'dark') document.documentElement.setAttribute('data-theme','dark');
})();
