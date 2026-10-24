'use strict';
/* LA COUR: directional scroll, glass navigation and repeating reveals. */
(()=>{
 const header=document.querySelector('.site-header');
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let previousY=window.scrollY,direction='down',frame=0;
 const hero=document.querySelector('.opening-art img');
 const body=document.body;
 function updateScroll(){
  frame=0;
  const y=Math.max(0,window.scrollY),delta=y-previousY;
  if(delta!==0)direction=delta>0?'down':'up';
  body.dataset.scrollDirection=direction;
  header?.classList.toggle('is-scrolled',y>40);
  header?.classList.toggle('scroll-up',y>40&&direction==='up');
  header?.classList.toggle('scroll-down',y>40&&direction==='down');
  if(!reduce.matches&&hero){hero.style.setProperty('--hero-shift',Math.min(y*.075,45)+'px')}
  if(!reduce.matches)document.documentElement.style.setProperty('--petal-shift',Math.sin(y/420)*12+'px');
  previousY=y;
 }
 updateScroll();
 window.addEventListener('scroll',()=>{if(!frame)frame=requestAnimationFrame(updateScroll)},{passive:true});
 window.addEventListener('pageshow',updateScroll);
 if(reduce.matches||!('IntersectionObserver' in window)){window.mahachRevealCards=()=>{};return}
 const seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const el=entry.target;
   if(entry.isIntersecting){el.dataset.enterFrom=direction;el.classList.add('is-visible')}
   else {el.classList.remove('is-visible');el.dataset.enterFrom=direction}
  }
 },{threshold:.07,rootMargin:'0px 0px -14px 0px'});
 function register(nodes){
  [...nodes].forEach((el,i)=>{
   if(seen.has(el))return;seen.add(el);
   el.dataset.enterFrom=direction;el.classList.add('motion-item');
   el.style.setProperty('--motion-delay',Math.min(i%4,3)*45+'ms');
   observer.observe(el);
  });
 }
 register(document.querySelectorAll('.featured-heading,.featured-card,.about-copy,.about-values li,.collection-strip>div,.lacour-discover>*,.story-intro>*,.story-intro-grid>*,.story-quote,.story-value,.footer-top,.company-details'));
 window.mahachRevealCards=container=>{if(container)register(container.querySelectorAll('.product-card'))};
 reduce.addEventListener('change',()=>{
  if(reduce.matches){observer.disconnect();document.querySelectorAll('.motion-item').forEach(el=>el.classList.add('is-visible'));hero?.style.removeProperty('--hero-shift');document.documentElement.style.removeProperty('--petal-shift')}
 });
})();
