import {useState} from 'react';
import Logo from '../components/Logo';
import {login,register} from '../lib/api';
import {Mail,Lock,User,Eye,Arrow} from '../components/Icons';
const mail=/\S+@\S+\.\S+/;
export default function Login(){
  const [mode,setMode]=useState('in');
  const [f,setF]=useState({name:'',email:'',pw:''});
  const [show,setShow]=useState(false);
  const [err,setErr]=useState({t:'',muted:false});
  const [ok,setOk]=useState('');
  const [busy,setBusy]=useState(false);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  const done=msg=>{setOk(msg);setTimeout(()=>{window.location.hash='#/app/write'},700)};
  const submit=async e=>{
    e.preventDefault();
    if(mode==='up'&&!f.name.trim())return setErr({t:'Enter your full name.'});
    if(!mail.test(f.email))return setErr({t:'Enter a valid email address.'});
    if(f.pw.length<8)return setErr({t:'Password must be at least 8 characters.'});
    setErr({t:''});setBusy(true);
    try{
      if(mode==='in')await login(f.email,f.pw);else await register(f.name.trim(),f.email,f.pw);
      done(mode==='in'?'Signed in as '+f.email:'Account created for '+f.email);
    }catch(x){setErr({t:x.message})}finally{setBusy(false)}
  };
  const swap=e=>{e.preventDefault();setMode(mode==='in'?'up':'in');setErr({t:''})};
  return (
    <div className="pg-login">
      <svg className="book" viewBox="0 0 420 200" aria-hidden="true"><g transform="rotate(-9 210 100)"><rect x="20" y="40" width="360" height="130" rx="10" fill="#2b2523"/><rect x="20" y="40" width="360" height="12" rx="6" fill="#3a312e"/><rect x="150" y="14" width="260" height="8" rx="4" fill="#15110f" transform="rotate(8 150 14)"/></g></svg>

      <div className="col">
        <a className="brand" href="#/" aria-label="Sentiment Pulse home"><Logo size={38}/><span className="tag">OPINIONS SHAPE TOMORROW</span></a>
        <form onSubmit={submit} noValidate>
          {ok?<div className="ok"><h2>You're in</h2><p>{ok}</p></div>:<>
            <h2>{mode==='in'?'Welcome Back':'Create Account'}</h2>
            <p className="sub">{mode==='in'?'Sign in to continue to your sentiment insights.':'Start analyzing text and social posts.'}</p>
            {mode==='up'&&<><label htmlFor="nm">Full Name</label><div className="fld"><User s={20}/><input id="nm" autoComplete="name" placeholder="Your name" value={f.name} onChange={set('name')}/></div></>}
            <label htmlFor="em">Email Address</label>
            <div className="fld"><Mail s={20}/><input id="em" type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set('email')}/></div>
            <label htmlFor="pw">Password</label>
            <div className="fld"><Lock s={20}/><input id="pw" type={show?'text':'password'} autoComplete={mode==='in'?'current-password':'new-password'} placeholder="At least 8 characters" value={f.pw} onChange={set('pw')}/>
              <button className="eye" type="button" aria-label={show?'Hide password':'Show password'} onClick={()=>setShow(!show)}><Eye s={20}/></button></div>
            <p className="err" role="alert" style={err.muted?{color:'var(--muted)'}:undefined}>{err.t}</p>
            <div className="row"><label className="rm"><input type="checkbox"/> Remember me</label></div>
            <button className="go" type="submit" disabled={busy} style={busy?{opacity:.7}:undefined}>{busy?'Please wait…':mode==='in'?'Log In':'Create Account'} {!busy&&<Arrow s={18}/>}</button>
            <p className="swap">{mode==='in'?"Don't have an account? ":'Already have an account? '}<a href="#" onClick={swap}>{mode==='in'?'Sign up':'Log in'}</a></p>
          </>}
        </form>
      </div>
    </div>
  );
}
