(function(){
'use strict';
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* ---------- sound: recorded click samples (synth click kept as fallback) ---------- */
var ctx=null,muted=false;
try{muted=localStorage.getItem('ea-sound')==='off'}catch(e){}
function unlock(){
  if(!ctx){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC)ctx=new AC()}catch(e){}}
  if(ctx&&ctx.state!=='running'&&ctx.resume){try{var r=ctx.resume();if(r&&r.catch)r.catch(function(){})}catch(e){}}
  loadClicks();
}
/* touch browsers only grant audio on touchend/pointerup/click, not touchstart */
['pointerdown','pointerup','touchend','click','keydown'].forEach(function(ev){addEventListener(ev,unlock,{passive:true,capture:true})});
function clack(t,f,gain){
  var n=Math.floor(ctx.sampleRate*0.045),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
  for(var i=0;i<n;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3)}
  var src=ctx.createBufferSource();src.buffer=buf;
  var bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f;bp.Q.value=1.4;
  var g=ctx.createGain();g.gain.value=gain;
  src.connect(bp);bp.connect(g);g.connect(ctx.destination);src.start(t);
  var o=ctx.createOscillator(),og=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(70,t+0.04);
  og.gain.setValueAtTime(gain*0.55,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.05);
  o.connect(og);og.connect(ctx.destination);o.start(t);o.stop(t+0.06);
}
/* real click recordings (two samples), shuffled with a little pitch and level drift so no two transitions sound identical */
var CLK={a:null,b:null,on:false,last:[]};
var CLKBASE=(function(){var sc=document.currentScript||document.querySelector('script[src*="js/site.js"]');try{return new URL('../audio/',sc.src).href}catch(e){return 'audio/'}})();
function loadClicks(){
  if(CLK.on||!ctx||!window.fetch)return;CLK.on=true;
  ['a','b'].forEach(function(k){
    fetch(CLKBASE+'click-'+k+'.wav').then(function(r){return r.arrayBuffer()}).then(function(ab){
      return new Promise(function(res,rej){var p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej)})
    }).then(function(b){CLK[k]=b}).catch(function(){CLK.on=false});
  });
}
function pickClick(){
  var l=CLK.last,k=Math.random()<.5?'a':'b';
  if(l.length>1&&l[l.length-1]===l[l.length-2])k=l[l.length-1]==='a'?'b':'a';   /* never the same sample three times running */
  l.push(k);if(l.length>2)l.shift();return k;
}
function playClick(dl){
  if(!CLK.a||!CLK.b)return false;
  var k=pickClick(),src=ctx.createBufferSource(),g=ctx.createGain();
  src.buffer=CLK[k];src.playbackRate.value=.93+Math.random()*.15;
  g.gain.value=(k==='a'?.95:.8)*(.72+Math.random()*.28);
  src.connect(g);g.connect(ctx.destination);src.start(ctx.currentTime+(dl||0));return true;
}
function play(dl){if(playClick(dl))return;var t=ctx.currentTime+(dl||0);clack(t,2300,0.5);clack(t+0.075,1500,0.38)}
(function(){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC&&!ctx){ctx=new AC();loadClicks()}}catch(e){}})();  /* start decoding the samples at page load; resume() still waits for a gesture */
function click(dl){   /* dl: seconds to wait, so the click lands with the movement rather than the tap */
  if(muted||!ctx)return;
  if(ctx.state==='running'){play(dl);return}
  /* first gesture: context is still waking up, so play once it is running (only if that is immediate) */
  var t0=Date.now();
  try{var r=ctx.resume();if(r&&r.then)r.then(function(){if(!muted&&ctx.state==='running'&&Date.now()-t0<400)play(dl)}).catch(function(){})}catch(e){}
}
window.__ea={ctx:function(){return ctx},muted:function(){return muted},unlock:unlock,base:function(){return CLKBASE}};
function syncSound(){
  $$('.snd,.vsound,.dial.vol').forEach(function(b){b.setAttribute('aria-pressed',muted?'false':'true');b.setAttribute('aria-label',muted?'Sound off. Turn sound on':'Sound on. Turn sound off')});
}
function setMuted(m){muted=m;try{localStorage.setItem('ea-sound',m?'off':'on')}catch(e){}syncSound();if(!m){unlock();setTimeout(click,30)}}
document.addEventListener('click',function(e){
  var b=e.target.closest('.snd,.dial.vol');if(!b)return;setMuted(!muted);
});
syncSound();

/* ---------- menu ---------- */
var menu=$('#menu'),burger=$('.burger');
if(menu&&burger){
  var openM=function(o){menu.hidden=!o;burger.setAttribute('aria-expanded',String(o));document.documentElement.style.overflow=o?'hidden':'';if(o){var c=$('.close',menu);c&&c.focus()}else burger.focus()};
  burger.addEventListener('click',function(){openM(menu.hidden)});
  $('.close',menu).addEventListener('click',function(){openM(false)});
  addEventListener('keydown',function(e){if(e.key==='Escape'&&!menu.hidden)openM(false)});
  $$('a',menu).forEach(function(a){a.addEventListener('click',function(){openM(false)})});
}

/* ---------- reel viewer: wheel transition ---------- */
function Reel(stage){
  var track=$('.track',stage);
  if(!matchMedia('(max-width:700px)').matches)$$('.frame.mobonly',track).forEach(function(x){x.remove()});
  var frames=$$('.frame',track),n=frames.length;
  var prev=$('.prev',stage),next=$('.next',stage),dots=$('.dots',stage),shut=$('.shutter',stage),hint=$('.hint',stage);
  var cur=0,last=0,q=[],busy=false,dotBtns=[],pos=$('.pos',stage);
  var home=!!stage.dataset.home;
  stage.classList.add('wheel');
  if(dots){
    frames.forEach(function(f,i){
      var b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Go to frame '+(i+1)+' of '+n);
      b.addEventListener('click',function(e){e.stopPropagation();if(i!==last)enqueue(i,i>last?1:-1)});dots.insertBefore(b,pos);dotBtns.push(b);
    });
  }
  function active(i){
    var changed=i!==cur;cur=i;
    if(changed){if(!(home&&window.__tvSnd))click(.25);if(hint)hint.classList.add('gone')}
    dotBtns.forEach(function(b,k){if(k===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    if(pos)pos.textContent=(i+1)+' / '+n;
    stage.dispatchEvent(new CustomEvent('reelchange',{detail:i}));
    if(i===n-1)stage.classList.add('done');
    frames.forEach(function(f,k){f.setAttribute('aria-hidden',k===i?'false':'true');f.inert=k!==i;
      if(f.dataset.vimeo||f.dataset.yt||f.dataset.mp4){k===i?mountVideo(f):unmountVideo(f)}});
  }
  function bgv(){frames.forEach(function(f,k){var v=$('video.bgv',f);if(!v)return;if(!v.src&&v.dataset.src)v.src=v.dataset.src;if(RM){v.pause();return}if(k===cur){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()})}
  stage.addEventListener('reelchange',bgv);setTimeout(bgv,0);
  function enqueue(i,dir){q.push({i:i,dir:dir});last=i;if(!busy)run()}
  function step(d){enqueue((last+d+n)%n,d)}
  function run(){
    var t=q.shift();if(!t){busy=false;return}
    busy=true;var from=cur,A=frames[from],B=frames[t.i];
    if(A===B){run();return}
    active(t.i);
    if(RM){A.classList.remove('cur');B.classList.add('cur');run();return}
    if(shut){shut.classList.remove('go');void shut.offsetWidth;shut.classList.add('go')}
    if(home){
      var hd=q.length?300:560;stage._fx&&stage._fx(hd);
      B.classList.add('cur','enter');A.classList.add('leave');
      var oa2=A.animate([{opacity:1,transform:'none'},{opacity:1,offset:.38},{opacity:0,transform:'scaleY(.5) scaleX(1.04)',filter:'brightness(2.4)'}],{duration:hd,easing:'linear',fill:'forwards'});
      var ob2=B.animate([{opacity:0,transform:'translateY(-12%) scaleY(1.12)',filter:'brightness(2.2) contrast(1.5) saturate(.4)'},{opacity:0,offset:.4},{opacity:1,transform:'translateY(2.5%)',filter:'brightness(1.5) contrast(1.2)',offset:.68},{opacity:1,transform:'none',filter:'none'}],{duration:hd,easing:'linear',fill:'forwards'});
      var dn=0;function fin2(){if(++dn<2)return;A.classList.remove('cur','leave');B.classList.remove('enter');try{oa2.cancel();ob2.cancel()}catch(e){}run()}
      oa2.onfinish=fin2;ob2.onfinish=fin2;return;
    }
    var fast=q.length>0,dur=fast?460:860,ang=58*t.dir,ease=fast?'cubic-bezier(.5,0,.3,1)':'cubic-bezier(.62,.04,.22,1)';
    var rad='34px';
    B.classList.add('cur','enter');A.classList.add('leave');
    var oa=A.animate([{transform:'rotate(0deg)',borderRadius:'0px'},{transform:'rotate(0deg)',borderRadius:rad,offset:.12},{transform:'rotate('+(-ang)+'deg)',borderRadius:rad}],{duration:dur,easing:ease,fill:'forwards'});
    var ob=B.animate([{transform:'rotate('+ang+'deg)',borderRadius:rad},{transform:'rotate(0deg)',borderRadius:rad,offset:.88},{transform:'rotate(0deg)',borderRadius:'0px'}],{duration:dur,easing:ease,fill:'forwards'});
    var done=0;function fin(){if(++done<2)return;
      A.classList.remove('cur','leave');B.classList.remove('enter');
      try{oa.cancel();ob.cancel()}catch(e){}run()}
    oa.onfinish=fin;ob.onfinish=fin;
  }
  frames.forEach(function(f){
    f.addEventListener('click',function(e){
      if(e.target.closest('a,button,.vbox,.copy,iframe,input,video,.cmp'))return;
      var r=f.getBoundingClientRect();(e.clientX-r.left)<r.width*0.22?step(-1):step(1);
    });
  });
  if(prev)prev.addEventListener('click',function(e){e.stopPropagation();step(-1)});
  if(next)next.addEventListener('click',function(e){e.stopPropagation();step(1)});
  document.addEventListener('keydown',function(e){
    if(e.target.closest('input,textarea')||(menu&&!menu.hidden)||e.altKey||e.metaKey||e.ctrlKey)return;
    if(home&&Math.abs(stage.getBoundingClientRect().top)>innerHeight*0.6)return;
    if(e.key==='ArrowRight'||e.key==='ArrowDown'&&!home){e.preventDefault();step(1)}
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp'&&!home){e.preventDefault();step(-1)}
    else if(e.key==='Home'){if(last!==0)enqueue(0,-1)}else if(e.key==='End'){if(last!==n-1)enqueue(n-1,1)}
  });
  /* swipe: left or up advances; on the home page only horizontal swipes, so the page still scrolls */
  var sx=0,sy=0,st=0;
  stage.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse')return;sx=e.clientX;sy=e.clientY;st=Date.now()},{passive:true});
  stage.addEventListener('pointerup',function(e){
    if(e.pointerType==='mouse'||!st)return;var dx=e.clientX-sx,dy=e.clientY-sy;st=0;
    if(Math.abs(dx)>=Math.abs(dy)){if(Math.abs(dx)>46){dx<0?step(1):step(-1)}}
    else if(!home&&Math.abs(dy)>46){dy<0?step(1):step(-1)}
  },{passive:true});
  if(!stage.hasAttribute('tabindex'))stage.setAttribute('tabindex','0');
  frames.forEach(function(f,k){f.inert=k!==0;f.setAttribute('aria-hidden',k===0?'false':'true')});
  frames[0].classList.add('cur');
  active(0);
  stage._reel={go:function(i){if(i!==last)enqueue(i,i>last?1:-1)},step:step,idx:function(){return cur},busy:function(){return busy}};
}

/* ---------- Vimeo frames: mounted only while active ---------- */
var VS={on:false};  /* video sound opted in on this page (one project = one page) */
function mountYT(f,box){
  var id=f.dataset.yt,snd=$('.vsound',box);
  var fr=document.createElement('iframe');
  fr.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay='+(RM?0:1)+'&mute=1&controls='+(RM?1:0)+(f.dataset.noloop?'':'&loop=1&playlist='+id)+'&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin='+encodeURIComponent(location.origin);
  fr.allow='autoplay; fullscreen; picture-in-picture';fr.setAttribute('title',f.dataset.title||'Video');
  box.insertBefore(fr,box.firstChild);
  function cmd(fn,args){try{fr.contentWindow.postMessage(JSON.stringify({event:'command',func:fn,args:args||[]}),'*')}catch(e){}}
  fr.addEventListener('load',function(){
    var wt=$('.vwait',box);if(wt)wt.remove();
    if(snd){snd.disabled=false;snd.setAttribute('aria-pressed','false');
      if(VS.on&&!RM){cmd('unMute');cmd('setVolume',[100]);cmd('playVideo');snd.setAttribute('aria-pressed','true');snd.setAttribute('aria-label','Video sound on. Turn off')}
      snd.onclick=function(e){e.stopPropagation();var on=snd.getAttribute('aria-pressed')==='false';VS.on=on;
        if(on){cmd('unMute');cmd('setVolume',[100]);cmd('playVideo')}else cmd('mute');
        snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}}
  });
  setTimeout(function(){var w=$('.vwait',box);if(w)w.remove()},5000);
}
function mountMP4(f,box){
  var v=document.createElement('video');v.muted=!VS.on;v.loop=!f.dataset.noloop;v.playsInline=true;v.setAttribute('playsinline','');if(!VS.on)v.setAttribute('muted','');
  v.preload='auto';if(f.dataset.poster)v.poster=f.dataset.poster;v.setAttribute('aria-label',f.dataset.title||'Video');
  v.src=f.dataset.mp4;box.insertBefore(v,box.firstChild);f._v=v;
  var snd=$('.vsound',box);
  v.addEventListener('loadeddata',function(){var w=$('.vwait',box);if(w)w.remove()});
  function lab(on){if(!snd)return;snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}
  if(snd){snd.disabled=false;lab(VS.on&&!RM);
    snd.onclick=function(e){e.stopPropagation();var on=snd.getAttribute('aria-pressed')==='false';VS.on=on;v.muted=!on;if(on)v.play().catch(function(){});
      snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}}
  if(!RM)v.play().catch(function(){if(!v.muted){v.muted=true;lab(false);v.play().catch(function(){})}});else v.controls=true;
  setTimeout(function(){var w=$('.vwait',box);if(w)w.remove()},4000);
}
function mountVideo(f){
  var box=$('.vbox',f);if(!box||box.dataset.on)return;box.dataset.on='1';
  if(f.dataset.yt){mountYT(f,box);return}
  if(f.dataset.mp4){mountMP4(f,box);return}
  var id=f.dataset.vimeo,h=f.dataset.vh;
  function url(m){return 'https://player.vimeo.com/video/'+id+'?title=0&byline=0&portrait=0&playsinline=1&dnt=1&loop='+(f.dataset.noloop?0:1)+'&muted='+(m?1:0)+'&autoplay='+(RM?0:1)+'&controls='+(RM?1:0)+(h?'&h='+h:'')+(f.dataset.vs?'#t='+f.dataset.vs+'s':'')}
  var fr=document.createElement('iframe');
  fr.src=url(!VS.on);fr.allow='autoplay; fullscreen; picture-in-picture';fr.setAttribute('title',f.dataset.title||'Video');fr.setAttribute('loading','lazy');
  box.insertBefore(fr,box.firstChild);
  var snd=$('.vsound',box),soundOn=!!VS.on&&!RM;
  function setLabel(on){if(!snd)return;snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}
  function player(){
    if(f._p)return f._p;
    if(!window.Vimeo||!window.Vimeo.Player)return null;
    try{f._p=new Vimeo.Player(fr)}catch(e){f._p=null}return f._p;
  }
  /* button is live as soon as the iframe loads; it no longer waits on the player API */
  function ready(){
    var wait=$('.vwait',box);if(wait)wait.remove();
    if(!snd||!snd.disabled)return;
    snd.disabled=false;setLabel(soundOn);
    if(soundOn){ /* carried over from an earlier video: if the browser blocked sound, fall back to muted play */
      setTimeout(function(){var q=player();if(!q||!soundOn)return;
        Promise.all([q.getMuted(),q.getPaused()]).then(function(r){if(!soundOn||!(r[0]||r[1]))return;soundOn=false;setLabel(false);try{f._p&&f._p.destroy()}catch(e){}f._p=null;fr.src=url(true)}).catch(function(){})},1800)}
    snd.onclick=function(e){
      e.stopPropagation();soundOn=!soundOn;VS.on=soundOn;setLabel(soundOn);var p=player();
      if(!soundOn){if(p)p.setMuted(true).catch(function(){});return}
      if(p){p.setMuted(false).catch(function(){});p.setVolume(1).catch(function(){});p.play().catch(function(){})}
      /* if the browser kept the player muted (autoplay rules), reload it unmuted inside this tap */
      setTimeout(function(){
        if(!soundOn)return;
        var q=player();
        var again=function(){try{f._p&&f._p.destroy()}catch(e){}f._p=null;fr.src=url(false)};
        if(!q){again();return}
        var done=false;setTimeout(function(){if(!done&&soundOn){done=true;again()}},600);q.getMuted().then(function(m){if(done)return;done=true;if(m&&soundOn)again()}).catch(function(){if(!done){done=true;again()}});
      },700);
    };
  }
  fr.addEventListener('load',ready);
  setTimeout(ready,3000);
  var p0=player();
  if(p0)p0.ready().then(function(){if(!RM)p0.play().catch(function(){})}).catch(function(){});
  setTimeout(function(){var w=$('.vwait',box);if(w)w.remove()},4000);
}
function unmountVideo(f){
  var box=$('.vbox',f);if(!box||!box.dataset.on)return;
  delete box.dataset.on;var fr=$('iframe',box);
  if(f._v){try{f._v.pause();f._v.removeAttribute('src');f._v.load();f._v.remove()}catch(e){}f._v=null}
  try{f._p&&f._p.destroy()}catch(e){}f._p=null;if(fr)fr.remove();
  var snd=$('.vsound',box);if(snd){snd.setAttribute('aria-pressed','false');snd.disabled=true;snd.onclick=null}
}


/* ---------- full screen video (phones): native where allowed, rotated overlay elsewhere ---------- */
(function(){
  var cur=null;
  function done(){
    if(!cur)return;var b=cur;cur=null;b.classList.remove('fs');document.documentElement.classList.remove('vfs-on');
    var x=$('.vfs',b);if(x)x.setAttribute('aria-label','Full screen. Turn your phone sideways');
    try{if(screen.orientation&&screen.orientation.unlock)screen.orientation.unlock()}catch(e){}
  }
  function exit(){
    if(!cur)return;
    var fe=document.fullscreenElement||document.webkitFullscreenElement;
    if(fe){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}}
    done();
  }
  function enter(box){
    cur=box;var x=$('.vfs',box);if(x)x.setAttribute('aria-label','Exit full screen');
    var rq=box.requestFullscreen||box.webkitRequestFullscreen,v=$('video',box);
    function overlay(){box.classList.add('fs');document.documentElement.classList.add('vfs-on')}
    if(rq){
      var p;try{p=rq.call(box)}catch(e){overlay();return}
      var ok=function(){try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(function(){})}catch(e){}};
      if(p&&p.then)p.then(ok,function(){if(cur)overlay()});else ok();
    }else if(v&&v.webkitEnterFullscreen){
      try{v.webkitEnterFullscreen();v.addEventListener('webkitendfullscreen',function(){cur=null},{once:true})}catch(e){overlay()}
    }else overlay();
  }
  function wire(){
    $$('.vfs').forEach(function(b){if(b._w)return;b._w=1;
      b.addEventListener('click',function(e){e.stopPropagation();e.preventDefault();var box=b.closest('.vbox');if(cur)exit();else enter(box)});
      b.addEventListener('pointerdown',function(e){e.stopPropagation()});b.addEventListener('touchstart',function(e){e.stopPropagation()},{passive:true});
    });
  }
  function fsChange(){if(cur&&!(document.fullscreenElement||document.webkitFullscreenElement)&&!cur.classList.contains('fs'))done()}
  document.addEventListener('fullscreenchange',fsChange);document.addEventListener('webkitfullscreenchange',fsChange);
  addEventListener('keydown',function(e){if(e.key==='Escape')exit()});
  /* leaving the frame drops full screen */
  document.addEventListener('reelchange',exit,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();

/* ---------- tabletop ---------- */
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function Table(surface){
  var list=$('.reels',surface),lis=$$('li',list);
  var tags=document.createElement('div');tags.className='tags';tags.setAttribute('aria-hidden','true');
  surface.appendChild(tags);
  var tagEls=lis.map(function(li,i){
    var a=$('a.disc',li),t=document.createElement('a');t.className='tag'+(li.dataset.off?' off':'');t.href=a.href;t.tabIndex=-1;
    t.innerHTML='<b>'+li.dataset.title+'</b><small>'+(li.dataset.sub||'')+'</small>';
    t.addEventListener('mouseenter',function(){li.classList.add('hot')});t.addEventListener('mouseleave',function(){li.classList.remove('hot')});
    tags.appendChild(t);return t;
  });
  var seed=parseInt(surface.dataset.seed||'7',10),tidy=false,live=false;
  function layout(){
    var mh=+surface.dataset.minh||innerHeight,W=surface.clientWidth,d=Math.min(W<520?244:W<900?328:408,+surface.dataset.dmax||999),pad=Math.max(14,d*0.14),n=lis.length;
    surface.style.setProperty('--d',d+'px');
    var tagH=14,rnd=mulberry(seed),placed=[],H,ds=$('.dropsleeve',surface),dsz=d*1.05,dp=null;var th=surface.parentNode.querySelector('.tophead'),top=th?th.offsetTop+th.offsetHeight+14:0;var tsl=surface.parentNode.querySelector('.topsleeve'),tsr=null;if(tsl){var sr=surface.getBoundingClientRect(),tr=tsl.getBoundingClientRect();tsr={l:tr.left-sr.left,r:tr.right-sr.left,t:tr.top-sr.top,b:tr.bottom-sr.top};if(W<700)top=Math.max(top,tsr.b+8);else top=Math.max(top,+surface.dataset.top||100);}
    if(tidy){
      var o1=(tsl&&W<700)?0:1,gap=Math.max(18,d*.16),cols=Math.max(1,Math.floor((W-pad*2+gap)/(d+gap))),rows=Math.ceil((n+o1)/cols);
      var rowH=d+tagH+gap,usedW=Math.min(n+1,cols)*(d+gap)-gap,x0=(W-usedW)/2;
      H=Math.max(mh,top+rows*rowH+pad*2);
      dp={cx:x0+d/2,cy:top+pad+d/2,rot:0};
      lis.forEach(function(li,i){var k=i+o1,c=k%cols,r=Math.floor(k/cols);placed.push({cx:x0+c*(d+gap)+d/2,cy:top+pad+r*rowH+d/2,rot:0,trot:0,tdx:0})});
    }else{
      var area=n*Math.pow(d+tagH+70,2)*1.2;H=Math.max(mh,top+Math.ceil(area/Math.max(W,1)));
      var minX=d/2+pad*.5,maxX=W-d/2-pad*.5,minY=top+d/2+pad*.3,maxY=H-d/2-tagH-pad*.6;
      dp={cx:W-dsz*.18,cy:top+(H-top)*.58,rot:14};placed.push(tsl?{cx:-9999,cy:-9999,tdx:0,rect:{l:-9999,r:-9998,t:-9999,b:-9998}}:{cx:dp.cx,cy:dp.cy,tdx:0,rect:{l:dp.cx-dsz/2,r:dp.cx+dsz/2,t:dp.cy-dsz/2,b:dp.cy+dsz/2}});
      var base=placed.length;
      lis.forEach(function(li,i){
        var best=null,bestScore=-1e9;
        var sp=!!surface.closest('.spill');  /* drawer: keep wheels apart so none is buried */
        for(var k=0;k<(+surface.dataset.tries||(sp?200:36));k++){
          var cx=minX+rnd()*(maxX-minX),cy=minY+rnd()*(maxY-minY);
          var tdx=(rnd()-.5)*d*.3,tw=d*.5;
          var rect={l:cx+tdx-tw/2-8,r:cx+tdx+tw/2+8,t:cy+d/2-8,b:cy+d/2+tagH};
          var s=1e9,hit=false;
          placed.forEach(function(p){
            var dist=Math.hypot(p.cx-cx,p.cy-cy);s=Math.min(s,dist);
            var o=p.rect;if(!(rect.r<o.l||rect.l>o.r||rect.b<o.t||rect.t>o.b))hit=true;
            if(Math.hypot(p.cx-(cx+tdx),p.cy-(cy+d/2+10))<d*.35)hit=true;
            if(Math.hypot(cx-(p.cx+p.tdx),cy-(p.cy+d/2+10))<d*.35)hit=true;
          });
          if(tsr&&W>=700&&!sp&&cx>tsr.l-d*.42&&cx<tsr.r+d*.42&&cy>tsr.t-d*.42&&cy<tsr.b+d*.42+tagH)hit=true;
          if(placed.length&&s<d*.78)s-=400;
          if(hit)s-=1000;
          if(sp){ /* drawer: wheels may rest on the sleeve but never on each other; spread them as far apart as the room allows */
            var m=1e9;placed.forEach(function(p){m=Math.min(m,Math.hypot(p.cx-cx,p.cy-cy))});
            s=Math.min(m,d*1.15);if(m<d*1.02)s-=1000+(d*1.02-m);
            if(tsr&&W>=700){var ox=Math.max(0,Math.min(cx+d/2,tsr.r)-Math.max(cx-d/2,tsr.l)),oy=Math.max(0,Math.min(cy+d/2,tsr.b)-Math.max(cy-d/2,tsr.t));s-=ox*oy/(d*d)*90}
            if(hit)s-=300;
          }
          if(s>bestScore){bestScore=s;best={cx:cx,cy:cy,tdx:tdx,rect:rect,rot:(rnd()-.5)*34,trot:(rnd()-.5)*8}}
        }
        placed.push(best);
      });
    }
    surface.style.height=H+'px';
    if(ds&&dp){ds.style.setProperty('--ds',(tidy?d:dsz)+'px');ds.style.setProperty('--x',(dp.cx-(tidy?d:dsz)/2)+'px');ds.style.setProperty('--y',(dp.cy-(tidy?d:dsz)/2)+'px');ds.style.setProperty('--r',dp.rot+'deg')}
    lis.forEach(function(li,i){
      var p=placed[i+(tidy?0:1)];li.style.setProperty('--x',(p.cx-d/2)+'px');li.style.setProperty('--y',(p.cy-d/2)+'px');li.style.setProperty('--r',p.rot+'deg');
      li.style.setProperty('--z',String(10+Math.floor(rnd()*30)));
      var t=tagEls[i];t.style.setProperty('--tx',(p.cx+(p.tdx||0))+'px');t.style.setProperty('--ty',(p.cy+d/2-6)+'px');t.style.setProperty('--tr',p.trot+'deg');
    });
  }
  function start(){
    if(live)return;live=true;surface.classList.add('live');
    layout();
  }
  var tb=surface.parentNode.querySelector('.toolbar');
  if(tb){
    var rs=$('[data-act=reshuffle]',tb),tdy=$('[data-act=tidy]',tb);
    if(rs)rs.addEventListener('click',function(){tidy=false;tdy&&(tdy.textContent='Organize neatly');seed=(Math.random()*1e9)|0;layout()});
    if(tdy)tdy.addEventListener('click',function(){tidy=!tidy;tdy.textContent=tidy?'Make a mess':'Organize neatly';layout()});
  }
  start();
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(layout,120)});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(layout);
  surface._layout=layout;
}


/* ---------- home bench: sleeves open into the tabletop ---------- */
function Bench(root){
  var choose=root.closest('#choose'),sleeves=$('.sleeves',root),spills=$$('.spill',root),status=$('[data-benchstatus]',root),cur=null,busy=0;
  var RM=matchMedia('(prefers-reduced-motion:reduce)').matches,SL={direction:1,design:1,build:1};
  function sp(s){return spills.filter(function(x){return x.dataset.sec===s})[0]}
  function barH(){var b=$('.bar');return b?b.offsetHeight:0}
  function toTop(){var y=choose.getBoundingClientRect().top+scrollY-barH()-8;scrollTo({top:Math.max(0,y),behavior:RM?'auto':'smooth'})}
  function spill(s,instant){
    var el=sp(s),sf=$('.surface',el),first=!sf._tbl,lis=$$('.reels li',sf);
    if(!instant&&!RM)sf.classList.add('spilling');
    if(first){sf._tbl=1;sf.setAttribute('data-table','1');Table(sf)}else sf._layout();
    if(instant||RM){sf.classList.remove('spilling');return}
    var ts=$('.topsleeve',el),r=ts.getBoundingClientRect(),q=sf.getBoundingClientRect(),d=parseFloat(sf.style.getPropertyValue('--d'))||240;
    sf.style.setProperty('--sx',(r.left-q.left+r.width*.55-d/2)+'px');sf.style.setProperty('--sy',(r.top-q.top+r.height*.5-d/2)+'px');
    lis.forEach(function(li,i){li.style.transitionDelay=(i*110)+'ms'});
    requestAnimationFrame(function(){requestAnimationFrame(function(){sf.classList.remove('spilling');
      setTimeout(function(){lis.forEach(function(li){li.style.transitionDelay=''})},1500)})});
  }
  function show(s,instant){
    spills.forEach(function(x){x.hidden=x.dataset.sec!==s});
    choose.classList.add('open');cur=s;
    spill(s,instant);
    if(status)status.textContent=sp(s).getAttribute('aria-label')+' open';
  }
  function open(s,push,instant){
    if(!sp(s)||s===cur)return;
    if(push)try{history.pushState(null,'','#'+s)}catch(e){}
    if(cur||instant||RM){show(s,instant||RM);if(!instant){toTop();try{sp(s).focus({preventScroll:true})}catch(e){}}return}
    sleeves.classList.add('out');
    $$('.sleeve-w',sleeves).forEach(function(w){var a=$('a.sleeve',w);w.classList.toggle('sel',!!a&&slugOf(a)===s)});
    setTimeout(function(){show(s,false);toTop();try{sp(s).focus({preventScroll:true})}catch(e){}},360);
  }
  function close(push){
    if(!cur)return;if(push)try{history.pushState(null,'',location.pathname+location.search)}catch(e){}
    spills.forEach(function(x){x.hidden=true});choose.classList.remove('open');cur=null;
    requestAnimationFrame(function(){sleeves.classList.remove('out');toTop()});
    if(status)status.textContent='Reels closed';
  }
  function slugOf(a){var h=a.getAttribute('href')||'',m=h.match(/^(?:\.\/)?(direction|design|build)\/(?:index\.html)?$/);return m&&m[1]}
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]');
    if(a){var s=slugOf(a);if(s&&SL[s]){e.preventDefault();var mn=$('#menu');if(mn&&!mn.hidden){var cl=$('.close',mn);cl&&cl.click()}open(s,true);return}}
    if(e.target.closest&&e.target.closest('.spill-x,.spillhead'))close(true);
  });
  addEventListener('keydown',function(e){if(e.key==='Escape'&&cur&&!document.querySelector('.menu:not([hidden])'))close(true)});
  function fromHash(){var h=(location.hash||'').slice(1);if(SL[h]){if(h!==cur){if(cur)show(h,true);else open(h,false,true)}}else if(cur)close(false)}
  addEventListener('popstate',fromHash);addEventListener('hashchange',fromHash);
  if(SL[(location.hash||'').slice(1)])setTimeout(function(){fromHash();setTimeout(toTop,120)},60);
}
function Manual(m){
  var stage=$('.gstage',m),ps=$$('.gp',m),dots=$('.gdots',m),prev=$('.gprev',m),next=$('.gnext',m),stat=$('[data-gstatus]',m);
  var mq=matchMedia('(max-width:800px)'),views=[],i=0,reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  m.classList.add('js');
  function build(){
    views=[];
    if(mq.matches){ps.forEach(function(p){views.push([p])})}
    else{views.push([ps[0]]);for(var k=1;k<ps.length-1;k+=2)views.push([ps[k],ps[k+1]]);views.push([ps[ps.length-1]])}
    dots.innerHTML='';
    views.forEach(function(v,x){var b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Go to '+(x===0?'front cover':x===views.length-1?'back cover':'spread '+x));b.addEventListener('click',function(){show(x,true)});dots.appendChild(b)});
  }
  function leafAnim(kind,oldV,newV,done){
    var L=document.createElement('div');L.className='gleaf';
    function face(cls,pg){var f=document.createElement('div');f.className=cls;var c=pg.cloneNode(true);c.classList.add('on');c.classList.remove('pend');c.removeAttribute('aria-hidden');c.removeAttribute('data-g');c.removeAttribute('inert');f.appendChild(c);return f}
    var fwd=(kind==='open'||kind==='backclose'||kind==='turn');
    var front,back,pend=[],hide=[];
    if(kind==='open'||kind==='close'){var cover=ps[0],lp=(kind==='open'?newV:oldV)[0];front=face('ff',cover);back=face('fb',lp);
      if(kind==='open'){hide=[cover];pend=[newV[0]]}else{pend=[newV[0]]}}
    else if(kind==='turn'){front=face('ff',oldV[1]);back=face('fb',newV[0]);hide=[oldV[1]];pend=[newV[0]]}
    else if(kind==='turnback'){front=face('ff',newV[1]);back=face('fb',oldV[0]);hide=[oldV[0]];pend=[newV[1]]}
    else{var bc=ps[ps.length-1],spread=(kind==='backclose'?oldV:newV),rp=spread[1];front=face('ff',rp);back=face('fb',bc);
      if(kind==='backclose'){hide=[rp];pend=[newV[0]]}else{hide=[bc];pend=[rp]}}
    L.appendChild(front);L.appendChild(back);
    var startRot=fwd?0:-180,endRot=fwd?-180:0;
    L.style.transform='rotateY('+startRot+'deg)';
    stage.appendChild(L);
    ps.forEach(function(p){p.classList.remove('on','enter-r','enter-l');p.inert=true});
    var show2=oldV.concat(newV);
    show2.forEach(function(p){p.classList.add('on');p.inert=false});
    hide.forEach(function(p){p.classList.add('pend')});pend.forEach(function(p){p.classList.add('pend')});
    if(kind==='close'||kind==='backclose'){}
    void L.offsetWidth;
    var fin=false;function end(){if(fin)return;fin=true;L.remove();ps.forEach(function(p){p.classList.remove('pend','on');p.inert=true});newV.forEach(function(p){p.classList.add('on');p.inert=false});done()}
    requestAnimationFrame(function(){L.style.transform='rotateY('+endRot+'deg)'});
    L.addEventListener('transitionend',function(e){if(e.target===L&&e.propertyName==='transform')end()});setTimeout(end,1100);
  }
  var busy=false;
  function show(k,anim){
    k=Math.max(0,Math.min(views.length-1,k));
    if(busy)return;
    var dir=k>=i?'r':'l',ch=k!==i;
    if(anim&&ch&&!reduce&&!mq.matches&&Math.abs(k-i)===1){
      var n=views.length,kind=null;
      if(i===0&&k===1)kind='open';else if(i===1&&k===0)kind='close';
      else if(i===n-2&&k===n-1)kind='backclose';else if(i>=1&&k>=1&&i<=n-2&&k<=n-2)kind=(k>i?'turn':'turnback');else if(i===n-1&&k===n-2)kind='backopen';
      if(kind){var oldV=views[i];busy=true;i=k;
        $$('button',dots).forEach(function(b,x){if(x===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
        prev.hidden=i===0;next.hidden=i===views.length-1;next.textContent=i===0?'Open':'Turn page \u203a';
        stat.textContent='Page view '+(i+1)+' of '+views.length;
        leafAnim(kind,oldV,views[k],function(){busy=false;m.dispatchEvent(new CustomEvent('guideidle'))});m.dispatchEvent(new CustomEvent('guidechange',{detail:i}));return}
    }
    i=k;
    ps.forEach(function(p){p.classList.remove('on','enter-r','enter-l');p.inert=true;p.setAttribute('aria-hidden','true')});
    views[i].forEach(function(p,n){p.classList.add('on');p.inert=false;p.removeAttribute('aria-hidden');
      if(anim&&ch&&!reduce){void p.offsetWidth;p.classList.add(dir==='r'?(p.dataset.side==='r'||views[i].length===1?'enter-r':'enter-l'):'enter-l')}});
    $$('button',dots).forEach(function(b,x){if(x===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    prev.hidden=i===0;next.hidden=i===views.length-1;next.textContent=i===0?'Open':'Turn page \u203a';
    stat.textContent='Page view '+(i+1)+' of '+views.length;
    m.dispatchEvent(new CustomEvent('guidechange',{detail:i}));
  }
  m._g={show:show,idx:function(){return i},busy:function(){return busy},len:function(){return views.length},mobile:function(){return mq.matches},reduce:reduce};
  m.addEventListener('click',function(e){var t=e.target.closest('[data-g]');if(!t)return;show(t.dataset.g==='next'?i+1:i-1,true)});
  m.setAttribute('tabindex','0');
  m.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();show(i+1,true)}else if(e.key==='ArrowLeft'){e.preventDefault();show(i-1,true)}});
  var sx=null;
  stage.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
  stage.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>45)show(i+(dx<0?1:-1),true)});
  function rebuild(){var cur=views[i]&&views[i][0];build();var k=0;views.forEach(function(v,x){if(v.indexOf(cur)>-1)k=x});show(k,false)}
  (mq.addEventListener?mq.addEventListener('change',rebuild):mq.addListener(rebuild));
  build();show(0,false);
}

/* ---------- old tube TV: CRT static, channel dial, volume dial ---------- */
function TV(tv){
  var stage=$('.hero-stage',tv),R=stage._reel,n=$$('.frame',stage).length;
  var dial=$('.dial.ch',tv),knob=$('.knob',dial),vol=$('.dial.vol',tv);
  /* static layer */
  var fx=document.createElement('div');fx.className='tvfx';fx.setAttribute('aria-hidden','true');
  var cv=document.createElement('canvas');cv.width=192;cv.height=108;fx.appendChild(cv);
  fx.appendChild(document.createElement('b'));fx.appendChild(document.createElement('i'));stage.appendChild(fx);
  var g=cv.getContext('2d'),raf=0;
  function noise(){var im=g.createImageData(192,108),d=im.data;for(var k=0;k<d.length;k+=4){var v=(Math.random()*255)|0;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255}g.putImageData(im,0,0)}
  stage._fx=function(ms){
    if(RM)return;cancelAnimationFrame(raf);
    fx.style.setProperty('--tvd',ms+'ms');fx.classList.remove('go');void fx.offsetWidth;fx.classList.add('go');
    var t0=performance.now(),last=0;
    (function tick(now){if(now-t0>ms){return}if(now-last>45){noise();last=now}raf=requestAnimationFrame(tick)})(t0);
  };
  /* channel dial */
  var step=n>1?Math.min(32,250/(n-1)):0;
  function ang(i){return (i-(n-1)/2)*step}
  function setA(a,drag){knob.style.transition=drag?'none':'';knob.style.transform='rotate('+a+'deg)'}
  var onT;
  stage.addEventListener('reelchange',function(e){
    var i=e.detail;setA(ang(i));dial.setAttribute('aria-valuenow',i+1);dial.setAttribute('aria-valuetext','Channel '+(i+1)+' of '+n);
    
  });
  var drag=null;
  function pa(e,r){return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI}
  dial.addEventListener('pointerdown',function(e){
    var r=dial.getBoundingClientRect();
    drag={a:pa(e,r),r:r,acc:0,moved:0,idx:R.idx(),x0:e.clientX,y0:e.clientY,id:e.pointerId};
    try{dial.setPointerCapture(e.pointerId)}catch(x){}
  });
  dial.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id)return;
    var a=pa(e,drag.r),d=a-drag.a;if(d>180)d-=360;if(d<-180)d+=360;drag.a=a;drag.acc+=d;
    drag.moved=Math.max(drag.moved,Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0));
    if(drag.moved<6)return;
    while(drag.acc>=step*.7&&drag.idx<n-1){drag.acc-=step;drag.idx++;R.go(drag.idx)}
    while(drag.acc<=-step*.7&&drag.idx>0){drag.acc+=step;drag.idx--;R.go(drag.idx)}
    if((drag.idx===n-1&&drag.acc>0)||(drag.idx===0&&drag.acc<0))drag.acc=0;
    setA(ang(drag.idx)+Math.max(-step*.7,Math.min(step*.7,drag.acc)),true);
  });
  function end(e){
    if(!drag||e.pointerId!==drag.id)return;var dg=drag;drag=null;
    if(dg.moved<6){var r=dg.r;(e.clientX<r.left+r.width/2)?R.step(-1):R.step(1)}
    else setA(ang(dg.idx));
  }
  dial.addEventListener('pointerup',end);dial.addEventListener('pointercancel',end);
  dial.addEventListener('keydown',function(e){
    var k=e.key;if(k==='ArrowRight'||k==='ArrowUp'){e.preventDefault();e.stopPropagation();R.step(1)}
    else if(k==='ArrowLeft'||k==='ArrowDown'){e.preventDefault();e.stopPropagation();R.step(-1)}
    else if(k==='Home'){e.preventDefault();e.stopPropagation();R.go(0)}else if(k==='End'){e.preventDefault();e.stopPropagation();R.go(n-1)}
  });
  setA(ang(R.idx()));
}

/* home: nav floats over the wood, turns solid once past the TV */
(function(){var bar=$('.homepage .bar'),sec=$('.tvsec');if(!bar||!sec)return;
  function f(){var h=bar.offsetHeight,ch=$('#choose'),w=false;if(ch){var r=ch.getBoundingClientRect();w=r.top<h&&r.bottom>h+4}bar.classList.toggle('onwood',w);bar.classList.toggle('solid',!w&&sec.getBoundingClientRect().bottom<h+10)}
  addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f()})();
document.addEventListener('DOMContentLoaded',function(){
  $$('[data-guide]').forEach(Manual);
  $$('.stage[data-reel]').forEach(Reel);
  $$('.tv').forEach(TV);
  $$('.surface[data-table]').forEach(Table);
  $$('[data-bench]').forEach(Bench);
});

/* ---------- before/after sliders ---------- */
(function(){
  function init(c){
    var inp=c.querySelector('.cin'),drag=0,rect=null;
    function set(v){v=Math.max(0,Math.min(100,v));c.style.setProperty('--p',v+'%');inp.value=Math.round(v)}
    function fromX(x){rect=rect||c.getBoundingClientRect();set((x-rect.left)/rect.width*100)}
    function touched(){c.classList.add('touched')}
    /* touch and pen: only the handle area drags the divider, so a swipe anywhere else still moves the reel */
    function nearBar(x){var r=c.getBoundingClientRect(),bx=r.left+r.width*(parseFloat(getComputedStyle(c).getPropertyValue('--p'))||50)/100;return Math.abs(x-bx)<=32}
    c.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'){if(e.button!==0)return}else if(!nearBar(e.clientX))return;
      e.stopPropagation();
      touched();drag=1;rect=c.getBoundingClientRect();try{c.setPointerCapture(e.pointerId)}catch(_){}fromX(e.clientX)});
    c.addEventListener('pointermove',function(e){if(drag)fromX(e.clientX)});
    ['pointerup','pointercancel'].forEach(function(t){c.addEventListener(t,function(e){if(drag)e.stopPropagation();drag=0;rect=null;try{c.releasePointerCapture(e.pointerId)}catch(_){}})});
    c.addEventListener('touchstart',function(e){var t=e.touches[0];if(t&&nearBar(t.clientX))e.stopPropagation()},{passive:true});
    c.addEventListener('click',function(e){e.stopPropagation()});
    inp.addEventListener('input',function(){touched();c.style.setProperty('--p',inp.value+'%')});
    inp.addEventListener('keydown',function(e){e.stopPropagation()});
  }
  document.querySelectorAll('[data-cmp]').forEach(init);
})();
})();

/* ---------- PREVIEW ONLY: scroll-driven guide + glass screen glare ---------- */
document.addEventListener('DOMContentLoaded',function(){
'use strict';
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
/* glass: glare slides a little with the pointer */
var hs=document.querySelector('.tv-screen .hero-stage');
if(hs&&!RM){hs.addEventListener('pointermove',function(e){var r=hs.getBoundingClientRect();hs.style.setProperty('--gx',Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)).toFixed(3))});}
/* scroll-driven book */
var m=document.querySelector('.guide[data-guide]'),about=document.querySelector('.about');
if(!m||!m._g||!about)return;
var g=m._g,pin=document.createElement('div');pin.className='apin';
m.parentNode.insertBefore(pin,m);pin.appendChild(m);
var bar=document.querySelector('.bar'),sync=false;
function vh(){return window.innerHeight}
function barH(){return bar?bar.offsetHeight:72}
function dims(){
  var n=g.len(),h=vh(),mob=g.mobile();
  var d={dwell:.55*h,step:(mob?.38:.45)*h,tail:.4*h};
  d.total=d.dwell+(n-2)*d.step+d.tail;
  var top=Math.max(barH()+8,(h-pin.offsetHeight)/2);d.top=top;
  return d;
}
var D=dims();
function layout(){
  D=dims();pin.style.top=D.top+'px';
  var cs=getComputedStyle(about),pt=parseFloat(cs.paddingTop)||0,pb=parseFloat(cs.paddingBottom)||0;
  about.style.height=(pt+pin.offsetHeight+D.total+pb)+'px';
  about._pt=pt;
}
layout();
function scrolled(){return D.top-(about.getBoundingClientRect().top+about._pt)}
function targetView(){
  var s=scrolled(),n=g.len();
  if(s<D.dwell)return 0;
  return Math.min(n-1,1+Math.floor((s-D.dwell)/D.step));
}
function absStart(){return about.getBoundingClientRect().top+window.scrollY+about._pt-D.top}
function drive(){
  if(sync)return;
  var t=targetView(),i=g.idx();
  if(t===i)return;
  if(g.mobile()||g.reduce){g.show(t,true);return}
  if(g.busy())return;
  g.show(i+(t>i?1:-1),true);
}
var tick=false;
addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;drive()})},{passive:true});
m.addEventListener('guideidle',drive);
/* arrows, dots, keys and swipe keep working: move the page to match */
m.addEventListener('guidechange',function(e){
  var k=e.detail;if(targetView()===k)return;
  sync=true;
  var y=absStart()+(k===0?D.dwell*.5:D.dwell+(k-1)*D.step+D.step*.5);
  window.scrollTo({top:y,behavior:'auto'});
  setTimeout(function(){sync=false},120);
});
addEventListener('resize',function(){layout();drive()});
addEventListener('load',layout);
});

/* ---------- PREVIEW ONLY: hero arrows, CRT idle life, channel-switch sound ---------- */
document.addEventListener('DOMContentLoaded',function(){
'use strict';
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var stage=document.querySelector('.tv-screen .hero-stage');
if(!stage||!stage._reel)return;
var R=stage._reel,touch=!(window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches);

/* ----- arrows: hover on desktop, a few beats on touch ----- */
var svg='<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" focusable="false"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function arrow(dir){
  var b=document.createElement('button');b.type='button';b.className='tvarr '+(dir<0?'l':'r');
  b.setAttribute('aria-label',dir<0?'Previous work':'Next work');b.innerHTML=svg;
  b.addEventListener('click',function(e){e.stopPropagation();R.step(dir)});
  stage.appendChild(b);return b;
}
arrow(-1);arrow(1);
var hideT=0;
function flash(ms){stage.classList.add('showarr');clearTimeout(hideT);hideT=setTimeout(function(){stage.classList.remove('showarr')},ms)}
if('IntersectionObserver' in window){
  var seen=false,io=new IntersectionObserver(function(es){
    es.forEach(function(en){if(en.isIntersecting&&en.intersectionRatio>=.55&&!seen){seen=true;setTimeout(function(){flash(touch?3400:2200)},700)}});
  },{threshold:[.55]});io.observe(stage);
}
if(touch)stage.addEventListener('pointerup',function(){flash(2200)},{passive:true});

/* ----- CRT idle layer: scanlines, soft noise, slow tracking band, flicker ----- */
var idle=document.createElement('div');idle.className='tvidle';idle.setAttribute('aria-hidden','true');
var cv=document.createElement('canvas'),W=256,H=144;cv.width=W;cv.height=H;idle.appendChild(cv);
['b','i','u'].forEach(function(t){idle.appendChild(document.createElement(t))});
stage.appendChild(idle);
var g=cv.getContext('2d'),frames=[],NF=6;
for(var f=0;f<NF;f++){var im=g.createImageData(W,H),d=im.data;for(var k=0;k<d.length;k+=4){var v=(Math.random()*255)|0;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255}frames.push(im)}
g.putImageData(frames[0],0,0);
if(!RM){
  var on=false,vis=true,t0=0,fi=0,raf=0;
  function tick(now){
    raf=requestAnimationFrame(tick);
    if(now-t0<90)return;t0=now;fi=(fi+1+((Math.random()*2)|0))%NF;g.putImageData(frames[fi],0,0);
  }
  function upd(){var want=vis&&!document.hidden;if(want&&!on){on=true;raf=requestAnimationFrame(tick)}else if(!want&&on){on=false;cancelAnimationFrame(raf)}}
  if('IntersectionObserver' in window)new IntersectionObserver(function(es){vis=es[0].isIntersecting;idle.classList.toggle('paused',!vis);upd()}).observe(stage);
  document.addEventListener('visibilitychange',upd);upd();
}else idle.classList.add('still');

/* ----- channel switch sound: dull click, then static that follows the on-screen static ----- */
function noiseBuf(c,sec){var n=Math.floor(c.sampleRate*sec),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;return b}
var ST={buf:null,on:false};
function loadStatic(){
  var E=window.__ea,c=E&&E.ctx();if(!c||ST.on||!window.fetch)return;ST.on=true;
  fetch(E.base()+'tv-static.mp3').then(function(r){return r.arrayBuffer()}).then(function(ab){
    return new Promise(function(res,rej){var p=c.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej)})
  }).then(function(b){ST.buf=b}).catch(function(){ST.on=false});
}
loadStatic();
function snd(ms){
  loadStatic();
  var E=window.__ea;if(!E||E.muted())return;var c=E.ctx();if(!c)return;
  function go(){
    var t=c.currentTime+0.005,dur=ms/1000;
    /* dull click: low thump plus a muffled tick */
    var o=c.createOscillator(),og=c.createGain();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(48,t+0.06);
    og.gain.setValueAtTime(0.0001,t);og.gain.linearRampToValueAtTime(0.55,t+0.004);og.gain.exponentialRampToValueAtTime(0.001,t+0.09);
    o.connect(og);og.connect(c.destination);o.start(t);o.stop(t+0.1);
    var tk=c.createBufferSource();tk.buffer=noiseBuf(c,0.05);
    var lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;
    var tg=c.createGain();tg.gain.setValueAtTime(0.35,t);tg.gain.exponentialRampToValueAtTime(0.001,t+0.04);
    tk.connect(lp);lp.connect(tg);tg.connect(c.destination);tk.start(t);
    /* static: a random bit of the recorded TV static each time; envelope matches the screen (up by 18%, easing to 62%, gone at 100%) */
    var s0=t+0.035,sd=Math.max(0.15,dur-0.035);
    var ns=c.createBufferSource(),rate=.93+Math.random()*.14,use=ST.buf,len=sd+0.1;
    if(use&&use.duration>len*rate+0.3){ns.buffer=use;ns.playbackRate.value=rate;ns.__off=0.05+Math.random()*(use.duration-len*rate-0.15)}
    else{ns.buffer=noiseBuf(c,Math.min(1.2,len));ns.__off=0}
    var sg=c.createGain();sg.gain.setValueAtTime(0.0001,s0);
    var top=ns.__off?0.75:0.2;
    sg.gain.linearRampToValueAtTime(top,s0+sd*0.16);
    sg.gain.linearRampToValueAtTime(top*0.75,s0+sd*0.6);
    sg.gain.linearRampToValueAtTime(0.0001,s0+sd);
    ns.connect(sg);sg.connect(c.destination);ns.start(s0,ns.__off);ns.stop(s0+sd+0.05);
  }
  if(c.state==='running')go();
  else{var t1=Date.now();try{var r=c.resume();if(r&&r.then)r.then(function(){if(!E.muted()&&c.state==='running'&&Date.now()-t1<400)go()}).catch(function(){})}catch(e){}}
}
var fx0=stage._fx;
window.__tvSnd=snd;
stage._fx=function(ms){if(fx0)fx0(ms);snd(ms)};
/* reduced motion has no static on screen, so only the click */
if(RM)stage._fx=function(){snd(120)};
});
