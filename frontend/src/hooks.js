import {useEffect,useState} from 'react';
export function useHash(){
  const g=()=>window.location.hash.replace(/^#\/?/,'');
  const [h,s]=useState(g());
  useEffect(()=>{const f=()=>s(g());window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);
  return h;
}
