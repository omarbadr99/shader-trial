(()=>{const f=[...document.querySelectorAll('iframe')].find(x=>x.title==='Organic O')||document.querySelector('iframe');
if(!f)return console.log('[O] no iframe found');
const r=f.getBoundingClientRect();let c=null;try{c=f.contentDocument.querySelector('canvas')}catch(e){}
let sx=1,sy=1,chain=[];for(let el=f;el&&el!==document.documentElement;el=el.parentElement){
const t=getComputedStyle(el).transform;if(t&&t!=='none'){const m=new DOMMatrix(t);
if(Math.abs(m.a-1)>1e-3||Math.abs(m.d-1)>1e-3){sx*=m.a;sy*=m.d;chain.push((el.tagName+(el.className?'.'+String(el.className).split(' ')[0]:''))+' scale '+m.a.toFixed(3)+'x'+m.d.toFixed(3))}}}
const eff=c?c.width/r.width:0;
console.log('[O] devicePixelRatio',devicePixelRatio,
'\n[O] iframe on screen',Math.round(r.width)+'x'+Math.round(r.height),'css px',
'\n[O] canvas backing  ',c?c.width+'x'+c.height:'??','device px',
'\n[O] effective       ',eff.toFixed(2)+'x  (want '+devicePixelRatio+'x — lower means it is being upscaled)',
'\n[O] ancestor scale  ',sx.toFixed(3)+' x '+sy.toFixed(3),chain.length?'<- '+chain.join(' | '):'(none)',
'\n[O] verdict         ',!c?'canvas unreachable':eff>=devicePixelRatio-0.05?'RESOLUTION IS FINE — blur is coming from somewhere else':
(Math.abs(sx-1)>0.01?'BLUR: a parent is scaling the iframe by '+sx.toFixed(2)+'x':'BLUR: quality/DPR too low — canvas is '+(devicePixelRatio/eff).toFixed(2)+'x short'));
try{console.log('[O] inside iframe   ','innerWidth',f.contentWindow.innerWidth,'EMBED_DPR',f.contentWindow.eval('typeof EMBED_DPR!=="undefined"?EMBED_DPR:"?"'))}catch(e){}
const fl=[];for(let el=f;el&&el!==document.documentElement;el=el.parentElement){const s=getComputedStyle(el);
if(s.filter&&s.filter!=='none')fl.push(el.tagName+' filter:'+s.filter);if(s.opacity&&+s.opacity<1)fl.push(el.tagName+' opacity:'+s.opacity)}
if(fl.length)console.log('[O] filters/opacity ',fl.join(' | '));})()
