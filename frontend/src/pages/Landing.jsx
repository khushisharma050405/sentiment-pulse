import Logo from '../components/Logo';
import {Chat,Doc,Trend,Target,Arrow,Play,XIcon,Insta,Fb,SmileEmoji,NeutralEmoji,FrownEmoji,HeartEmoji,SparkleEmoji} from '../components/Icons';
const POSTS=[[<XIcon/>,'@user123','This product is actually amazing! Totally worth it. 😍','Positive','p'],[<Insta/>,'@foodie_23','Delivery took longer than expected…','Negative','n'],[<Fb/>,'@techlover','The design is okay, nothing special.','Neutral','u']];
const FEATS=[[<Chat s={26}/>,'Social Media Analysis','Track sentiment from real conversations across platforms.'],[<Doc s={26}/>,'Text Sentiment Analysis','Analyze any text, from reviews to feedback to comments.'],[<Trend s={26}/>,'Easy to Understand','Clear visualizations, meaningful insights, no complexity.'],[<Target s={26}/>,'Make Better Decisions','Understand your audience, improve your brand, and stay ahead.']];
const LIST=['Monitor brand perception','Identify key topics & trends','Understand customer feedback','Stay informed, always'];
const MENU=['Overview','Social Media','Text Analysis','Reports','Settings'];
const STATS=[['Positive','58%','▲ 12%','up'],['Neutral','24%','▲ 3%','flat'],['Negative','18%','▼ 5%','down']];
function Donut(){
  const r=38,c=2*Math.PI*r;let off=0;
  return <svg width="112" height="112" viewBox="0 0 100 100" style={{transform:'rotate(-90deg)'}} aria-hidden="true">{[[58,'#7A8050'],[24,'#B9ABA6'],[18,'#C99AA0']].map(([p,col])=>{const d=c*p/100;const el=<circle key={col} cx="50" cy="50" r={r} fill="none" stroke={col} strokeWidth="16" strokeDasharray={`${d} ${c-d}`} strokeDashoffset={-off}/>;off+=d;return el})}</svg>;
}
export default function Landing(){
  return (
    <div className="pg-landing">
      <header className="top">
        <div className="w">
          <nav>
            <a href="#/" aria-label="Sentiment Pulse home"><Logo size={26}/></a>
            <div className="links"><a className="on" href="#/">Home</a><a href="#features">Features</a><a href="#about">About</a></div>
            <a className="pill line" href="#/login">Login</a>
          </nav>
          <div className="hero">
            <div className="copy">
              <p className="eyebrow">LISTEN / ANALYZE / UNDERSTAND</p>
              <h1>Real Conversations.<br/>Real Emotions.<br/><em>In One Place.</em></h1>
              <p className="lead">Track and analyze sentiment from social media, reviews and text data. Understand what people feel, what they talk about, and what matters most — all in one platform.</p>
              <div className="cta"><a className="pill rose" href="#/login">Get Started <Arrow s={18}/></a><a className="pill line" href="#/app/write"><Play s={20}/> Watch Demo</a></div>
            </div>
            <div className="comp">
              <span className="hero-emoji em-1" aria-hidden="true"><SmileEmoji s={34}/></span>
              <span className="hero-emoji em-2" aria-hidden="true"><SparkleEmoji s={24}/></span>
              <span className="hero-emoji em-3" aria-hidden="true"><HeartEmoji s={28}/></span>
              <span className="hero-emoji em-4" aria-hidden="true"><NeutralEmoji s={28}/></span>
              <span className="hero-emoji em-5" aria-hidden="true"><FrownEmoji s={32}/></span>
              <div className="posts">{POSTS.map(([ic,u,t,tag,k])=>(
                <article className="post" key={u}><div className="ph">{ic}<b>{u}</b></div><p>{t}</p><span className={'tagc '+k}>{tag}</span></article>))}
              </div>
              <div className="phone"><div className="score">
                <b>Overall Sentiment</b>
                <div className="sr"><Donut/><ul><li><strong>58%</strong> Positive</li><li><strong>24%</strong> Neutral</li><li><strong>18%</strong> Negative</li></ul></div>
                <svg viewBox="0 0 240 60" className="spark" aria-hidden="true"><path d="M2 40C14 20 22 46 36 34S58 12 72 30 96 48 110 28 134 14 150 32 176 38 190 22 214 12 238 8" fill="none" stroke="#8B5E63" strokeWidth="2"/></svg>
              </div></div>
            </div>
          </div>
        </div>
      </header>


      <section className="feats w" id="features">
        {FEATS.map(([ic,t,d])=><div className="feat" key={t}><div className="ic">{ic}</div><h3>{t}</h3><p>{d}</p></div>)}
      </section>

      <section className="insight w" id="about">
        <div className="prev"><div className="dash">
          <div className="side"><Logo size={12}/>{MENU.map((m,i)=><div key={m} className={'mi'+(i?'':' on')}><i/>{m}</div>)}</div>
          <div className="dm">
            <div className="mh"><b>Sentiment Overview</b><span>Last 7 days ⌄</span></div>
            <svg viewBox="0 0 300 90" className="area" aria-hidden="true">
              <path d="M0 62C20 44 36 70 62 52S104 34 128 52 172 24 202 42 252 30 300 18V90H0z" fill="rgba(122,128,80,.22)"/>
              <path d="M0 62C20 44 36 70 62 52S104 34 128 52 172 24 202 42 252 30 300 18" fill="none" stroke="#7A8050" strokeWidth="1.6"/>
              <path d="M0 72C26 56 44 76 74 62S120 50 150 62 196 40 226 54 268 44 300 34" fill="none" stroke="#B5646C" strokeWidth="1.4" opacity=".8"/>
            </svg>
            <div className="stats">{STATS.map(([l,v,t,k])=><div key={l}><small>{l}</small><strong>{v}</strong><em className={k}>{t}</em></div>)}</div>
          </div>
        </div></div>
        <div className="txt">
          <p className="eyebrow dk">ONE PLATFORM. TWO PERSPECTIVES.</p>
          <h2>From Social Feeds to Real Insights</h2>
          <p>Whether it's a trending topic or a customer review, get a complete picture of public opinion with powerful sentiment analysis.</p>
          <ul className="list">{LIST.map(x=><li key={x}><span className="ck">✓</span>{x}</li>)}</ul>
        </div>
      </section>

      <footer className="foot"><div className="w"><p>Because every opinion matters.</p><hr/></div></footer>
    </div>
  );
}

