'use strict';
/* Editorial MAHACH: progressive enhancement, native scroll, no layout shift. */
(()=>{
 const header=document.querySelector('.site-header');
 let raf=0;
 function updateHeader(){raf=0;header?.classList.toggle('is-scrolled',window.scrollY>22)}
 updateHeader();
 window.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(updateHeader)},{passive:true});
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduce||!('IntersectionObserver' in window))return;
 const io=new IntersectionObserver(entries=>{
  for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList.add('motion-visible');io.unobserve(entry.target)}
 },{threshold:.06,rootMargin:'0px 0px -20px 0px'});
 const nodes=document.querySelectorAll('.collection-strip>div:first-child,.statement-copy,.closing>.eyebrow,.closing>h2,.closing>.round-link,.footer-top,.company-details');
 document.documentElement.classList.add('motion-ready');
 nodes.forEach(node=>{node.classList.add('editorial-motion');io.observe(node)});
 window.mahachRevealCards=(container)=>{
  if(!container)return;
  const cards=container.querySelectorAll('.product-card');
  cards.forEach(card=>{card.classList.add('motion-enter');io.observe(card)})
 };
})();
