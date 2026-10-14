export default function Logo({size=22}){
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:size*.45,fontFamily:'Newsreader,Georgia,serif',fontSize:size,fontWeight:400,lineHeight:1}}>
      <svg width={size*1.9} height={size*1.3} viewBox="0 0 46 34" fill="none" stroke="#D8A99F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 18h8l4-10 5 22 5-26 5 22 3-8h12"/></svg>
      <span>Sentiment <span style={{color:'#D8B4AB'}}>Pulse</span></span>
    </span>
  );
}
