/* Native scroll; all copy is visible before the first animation frame. */
(function(){
 if(!window.gsap||!window.ScrollTrigger)return;
 const gsap=window.gsap,ScrollTrigger=window.ScrollTrigger;
 gsap.registerPlugin(ScrollTrigger);ScrollTrigger.config({ignoreMobileResize:true});
 gsap.matchMedia().add({desktop:'(min-width:701px)',mobile:'(max-width:700px)',reduce:'(prefers-reduced-motion:reduce)'},context=>{
  if(context.conditions.reduce)return;
  const mobile=context.conditions.mobile;
  if(document.querySelector('.opening')){
   gsap.fromTo('.opening-art',{scale:1.015,yPercent:0},{scale:mobile?1.045:1.065,yPercent:mobile?-1.5:-3,ease:'none',scrollTrigger:{trigger:'.opening',start:'top top',end:'bottom top',scrub:.65,invalidateOnRefresh:true}});
   gsap.to('.hero-copy',{y:mobile?-38:-70,ease:'none',scrollTrigger:{trigger:'.opening',start:'top top',end:'65% top',scrub:.65}});
   gsap.fromTo('.statement-photo img',{scale:1.06,yPercent:-1},{scale:1.02,yPercent:1,ease:'none',scrollTrigger:{trigger:'.statement',start:'clamp(top bottom)',end:'clamp(bottom top)',scrub:.8}});
   gsap.fromTo('.closing-art',{y:mobile?8:24},{y:mobile?-4:-16,ease:'none',scrollTrigger:{trigger:'.closing',start:'clamp(top bottom)',end:'clamp(bottom top)',scrub:.7}});
  }
  if(document.querySelector('.shop-banner-art'))gsap.fromTo('.shop-banner-art',{scale:1.01},{scale:1.05,y:mobile?-6:-15,ease:'none',scrollTrigger:{trigger:'.shop-banner',start:'top top',end:'bottom top',scrub:.7}});
 });
 const refresh=()=>ScrollTrigger.refresh();
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(refresh);
 document.querySelectorAll('.opening-art img,.statement-photo img,.closing-art,.shop-banner-art').forEach(img=>{if(!img.complete)img.addEventListener('load',refresh,{once:true})});
 window.addEventListener('load',refresh,{once:true});
})();
