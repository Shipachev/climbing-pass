// Card helper: resolves the compiled design-system namespace, or falls back to
// compiling the component sources in-browser (before the bundle exists).
(function(){
  var base = document.currentScript.src.replace(/[^/]*$/, '');
  var FILES = ['core/Icon','core/Button','core/IconButton','forms/TextField','forms/TextArea','forms/SegmentedControl',
    'training/ProgressSegments','training/StatusLabel','training/SectionHeader','training/StepRow','training/StepCard',
    'training/ActionBar','training/ActiveTrainingCard','training/MembershipStrip','training/HistoryRow','training/Stat',
    'navigation/TabBar','navigation/TopBar','feedback/BottomSheet'];
  function findNS(){
    for (var k of Object.keys(window)) { try { var v = window[k]; if (v && typeof v === 'object' && typeof v.Button === 'function' && typeof v.StepCard === 'function') return v; } catch(e){} }
    return null;
  }
  function loadBundle(){
    return new Promise(function(res){ var s = document.createElement('script'); s.src = base + '../_ds_bundle.js'; s.onload = function(){ res(findNS()); }; s.onerror = function(){ res(null); }; document.head.appendChild(s); });
  }
  window.bootDS = function(){
    var ns = findNS(); if (ns) return Promise.resolve(ns);
    return loadBundle().then(function(found){ if (found) return found; return compile(); });
  };
  function compile(){
    return Promise.all(FILES.map(function(f){ return fetch(base + f + '.jsx').then(function(r){ return r.text(); }); })).then(function(srcs){
      var names = FILES.map(function(f){ return f.split('/')[1]; });
      var code = srcs.map(function(s){ return s.replace(/^import .*$/mg, '').replace(/^export function/mg, 'function'); }).join('\n');
      code = 'window.__cpDS = (function(){\n' + code + '\nreturn {' + names.join(',') + '};\n})();';
      var out = Babel.transform(code, { presets: ['react'] }).code;
      (new Function('React', out))(React);
      return window.__cpDS;
    });
  }
})();
