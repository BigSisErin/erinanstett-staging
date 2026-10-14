(function(){
'use strict';
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

/* ---------- sound: synthesized plastic click, no audio file ---------- */
var ctx=null,muted=false;
try{muted=localStorage.getItem('ea-sound')==='off'}catch(e){}
function unlock(){
  if(!ctx){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC)ctx=new AC()}catch(e){}}
  if(ctx&&ctx.state!=='running'&&ctx.resume){try{var r=ctx.resume();if(r&&r.catch)r.catch(function(){})}catch(e){}}
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
function play(){var t=ctx.currentTime;clack(t,2300,0.5);clack(t+0.075,1500,0.38)}
function click(){
  if(muted||!ctx)return;
  if(ctx.state==='running'){play();return}
  /* first gesture: context is still waking up, so play once it is running (only if that is immediate) */
  var t0=Date.now();
  try{var r=ctx.resume();if(r&&r.then)r.then(function(){if(!muted&&ctx.state==='running'&&Date.now()-t0<400)play()}).catch(function(){})}catch(e){}
}
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
  var track=$('.track',stage),frames=$$('.frame',track),n=frames.length;
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
    if(changed){click();if(hint)hint.classList.add('gone')}
    dotBtns.forEach(function(b,k){if(k===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    if(pos)pos.textContent=(i+1)+' / '+n;
    stage.dispatchEvent(new CustomEvent('reelchange',{detail:i}));
    if(i===n-1)stage.classList.add('done');
    frames.forEach(function(f,k){f.setAttribute('aria-hidden',k===i?'false':'true');f.inert=k!==i;
      if(f.dataset.vimeo||f.dataset.yt||f.dataset.mp4){k===i?mountVideo(f):unmountVideo(f)}});
  }
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
      if(e.target.closest('a,button,.vbox,.copy,iframe,input,video'))return;
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
function mountYT(f,box){
  var id=f.dataset.yt,snd=$('.vsound',box);
  var fr=document.createElement('iframe');
  fr.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay='+(RM?0:1)+'&mute=1&controls='+(RM?1:0)+'&loop=1&playlist='+id+'&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin='+encodeURIComponent(location.origin);
  fr.allow='autoplay; fullscreen; picture-in-picture';fr.setAttribute('title',f.dataset.title||'Video');
  box.insertBefore(fr,box.firstChild);
  function cmd(fn,args){try{fr.contentWindow.postMessage(JSON.stringify({event:'command',func:fn,args:args||[]}),'*')}catch(e){}}
  fr.addEventListener('load',function(){
    var wt=$('.vwait',box);if(wt)wt.remove();
    if(snd){snd.disabled=false;snd.setAttribute('aria-pressed','false');
      snd.onclick=function(e){e.stopPropagation();var on=snd.getAttribute('aria-pressed')==='false';
        if(on){cmd('unMute');cmd('setVolume',[100]);cmd('playVideo')}else cmd('mute');
        snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}}
  });
  setTimeout(function(){var w=$('.vwait',box);if(w)w.remove()},5000);
}
function mountMP4(f,box){
  var v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('muted','');
  v.preload='auto';if(f.dataset.poster)v.poster=f.dataset.poster;v.setAttribute('aria-label',f.dataset.title||'Video');
  v.src=f.dataset.mp4;box.insertBefore(v,box.firstChild);f._v=v;
  var snd=$('.vsound',box);
  v.addEventListener('loadeddata',function(){var w=$('.vwait',box);if(w)w.remove()});
  if(snd){snd.disabled=false;snd.setAttribute('aria-pressed','false');
    snd.onclick=function(e){e.stopPropagation();var on=snd.getAttribute('aria-pressed')==='false';v.muted=!on;if(on)v.play().catch(function(){});
      snd.setAttribute('aria-pressed',on?'true':'false');snd.setAttribute('aria-label',on?'Video sound on. Turn off':'Video sound off. Turn on')}}
  if(!RM)v.play().catch(function(){});else v.controls=true;
  setTimeout(function(){var w=$('.vwait',box);if(w)w.remove()},4000);
}
function mountVideo(f){
  var box=$('.vbox',f);if(!box||box.dataset.on)return;box.dataset.on='1';
  if(f.dataset.yt){mountYT(f,box);return}
  if(f.dataset.mp4){mountMP4(f,box);return}
  var id=f.dataset.vimeo,h=f.dataset.vh;
  function url(m){return 'https://player.vimeo.com/video/'+id+'?title=0&byline=0&portrait=0&playsinline=1&dnt=1&loop=1&muted='+(m?1:0)+'&autoplay='+(RM?0:1)+'&controls='+(RM?1:0)+(h?'&h='+h:'')}
  var fr=document.createElement('iframe');
  fr.src=url(true);fr.allow='autoplay; fullscreen; picture-in-picture';fr.setAttribute('title',f.dataset.title||'Video');fr.setAttribute('loading','lazy');
  box.insertBefore(fr,box.firstChild);
  var snd=$('.vsound',box),soundOn=false;
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
    snd.disabled=false;setLabel(false);
    snd.onclick=function(e){
      e.stopPropagation();soundOn=!soundOn;setLabel(soundOn);var p=player();
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
    var W=surface.clientWidth,d=W<520?180:W<900?240:300,pad=Math.max(14,d*0.14),n=lis.length;
    surface.style.setProperty('--d',d+'px');
    var tagH=46,rnd=mulberry(seed),placed=[],H,ds=$('.dropsleeve',surface),dsz=d*1.05,dp=null;var th=surface.parentNode.querySelector('.tophead'),top=th?th.offsetTop+th.offsetHeight+14:0;
    if(tidy){
      var gap=Math.max(18,d*.16),cols=Math.max(1,Math.floor((W-pad*2+gap)/(d+gap))),rows=Math.ceil((n+1)/cols);
      var rowH=d+tagH+gap,usedW=Math.min(n+1,cols)*(d+gap)-gap,x0=(W-usedW)/2;
      H=Math.max(innerHeight,top+rows*rowH+pad*2);
      dp={cx:x0+d/2,cy:top+pad+d/2,rot:0};
      lis.forEach(function(li,i){var k=i+1,c=k%cols,r=Math.floor(k/cols);placed.push({cx:x0+c*(d+gap)+d/2,cy:top+pad+r*rowH+d/2,rot:0,trot:0,tdx:0})});
    }else{
      var area=n*Math.pow(d+tagH+70,2)*1.2;H=Math.max(innerHeight,top+Math.ceil(area/Math.max(W,1)));
      var minX=d/2+pad*.5,maxX=W-d/2-pad*.5,minY=top+d/2+pad*.3,maxY=H-d/2-tagH-pad*.6;
      dp={cx:W-dsz*.18,cy:top+(H-top)*.58,rot:14};placed.push({cx:dp.cx,cy:dp.cy,tdx:0,rect:{l:dp.cx-dsz/2,r:dp.cx+dsz/2,t:dp.cy-dsz/2,b:dp.cy+dsz/2}});
      var base=placed.length;
      lis.forEach(function(li,i){
        var best=null,bestScore=-1e9;
        for(var k=0;k<36;k++){
          var cx=minX+rnd()*(maxX-minX),cy=minY+rnd()*(maxY-minY);
          var tdx=(rnd()-.5)*d*.3,tw=tagEls[i].offsetWidth||140;
          var rect={l:cx+tdx-tw/2-8,r:cx+tdx+tw/2+8,t:cy+d/2-8,b:cy+d/2+tagH};
          var s=1e9,hit=false;
          placed.forEach(function(p){
            var dist=Math.hypot(p.cx-cx,p.cy-cy);s=Math.min(s,dist);
            var o=p.rect;if(!(rect.r<o.l||rect.l>o.r||rect.b<o.t||rect.t>o.b))hit=true;
            if(Math.hypot(p.cx-(cx+tdx),p.cy-(cy+d/2+10))<d*.35)hit=true;
            if(Math.hypot(cx-(p.cx+p.tdx),cy-(p.cy+d/2+10))<d*.35)hit=true;
          });
          if(placed.length&&s<d*.78)s-=400;
          if(hit)s-=1000;
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
        stat.textContent='Page view '+(i+1)+' of '+views.length;click();
        leafAnim(kind,oldV,views[k],function(){busy=false});return}
    }
    i=k;
    ps.forEach(function(p){p.classList.remove('on','enter-r','enter-l');p.inert=true;p.setAttribute('aria-hidden','true')});
    views[i].forEach(function(p,n){p.classList.add('on');p.inert=false;p.removeAttribute('aria-hidden');
      if(anim&&ch&&!reduce){void p.offsetWidth;p.classList.add(dir==='r'?(p.dataset.side==='r'||views[i].length===1?'enter-r':'enter-l'):'enter-l')}});
    $$('button',dots).forEach(function(b,x){if(x===i)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});
    prev.hidden=i===0;next.hidden=i===views.length-1;next.textContent=i===0?'Open':'Turn page \u203a';
    stat.textContent='Page view '+(i+1)+' of '+views.length;
    if(anim&&ch)click();
  }
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
  function f(){bar.classList.toggle('solid',sec.getBoundingClientRect().bottom<bar.offsetHeight+10)}
  addEventListener('scroll',f,{passive:true});addEventListener('resize',f);f()})();
document.addEventListener('DOMContentLoaded',function(){
  $$('[data-guide]').forEach(Manual);
  $$('.stage[data-reel]').forEach(Reel);
  $$('.tv').forEach(TV);
  $$('.surface[data-table]').forEach(Table);
});
})();
