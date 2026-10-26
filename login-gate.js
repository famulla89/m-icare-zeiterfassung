'use strict';
/* Local, offline M-iCare login gate. A login is per installation/device; credentials are never exported. */
(function(){
 const KEY='micare-local-account-v1';
 const BIO_KEY='micare-local-bio-v1';
 const TRUST_KEY='micare-trusted-device-v1';
 const ITERATIONS=310000;
 let current=null,authPending=false,bioChallenge='',bioMode='';
 const el=id=>document.getElementById(id);
 const text=id=>el(id)?.value||'';
 const enc=new TextEncoder();
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const fromHex=str=>new Uint8Array((str.match(/.{2}/g)||[]).map(h=>parseInt(h,16)));
 function readAccount(){
  try{const v=JSON.parse(localStorage.getItem(KEY));return v&&v.v===1&&typeof v.username==='string'&&/^[0-9a-f]{32}$/.test(v.salt)&&/^[0-9a-f]{64}$/.test(v.hash)?v:null}catch{return null}
 }
 async function derive(password,salt){
  if(!crypto?.subtle)throw Error('Sichere Anmeldung ist hier nicht verfügbar. Bitte App auf Android, Windows oder HTTPS öffnen.');
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:fromHex(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256);
  return hex(new Uint8Array(bits));
 }
 function constantEquals(a,b){
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
 }
 function message(s,warning=false){el('micareLoginMessage').textContent=s;el('micareLoginMessage').style.color=warning?'#a42e2e':'#425d77'}
 function nativeBio(){return Boolean(window.MiCareAuthNative && typeof window.MiCareAuthNative.authenticate==='function' && window.MiCareAuthNative.isAvailable())}
 function showAuth(){
  current=readAccount();
  document.body.classList.remove('micare-authenticated');
  el('micareLock').hidden=false;
  const setup=!current;el('micareSetup').hidden=!setup;
  el('micareLoginTitle').textContent=setup?'M-iCare einrichten':'M-iCare entsperren';
  el('micareLoginSubmit').textContent=setup?'Benutzerkonto erstellen':'Anmelden';
  el('micareConfirmPass').required=setup;
  el('micareLoginMessage').textContent=setup?'Lege einmalig deinen Benutzernamen und ein sicheres Passwort für dieses Gerät fest. Deine vorhandenen Kundendaten bleiben erhalten.':'Melde dich mit deinem Benutzernamen und Passwort an.';
  if(!setup){
   el('micareLoginUser').value=current.username;
   const available=nativeBio()&&localStorage.getItem(BIO_KEY)==='enabled';
   el('micareBioLogin').hidden=!available;
  }
  el('micareLoginPass').value='';
  el('micareConfirmPass').value='';
  el('micareTrustDevice').checked=localStorage.getItem(TRUST_KEY)==='enabled';
  el('micareLoginUser').focus();
 }
 function saveTrustedChoice(){if(el('micareTrustDevice')?.checked)localStorage.setItem(TRUST_KEY,'enabled');else localStorage.removeItem(TRUST_KEY);}
 function unlock(){
  document.body.classList.add('micare-authenticated');
  el('micareLock').hidden=true;
  el('micareLoginPass').value='';
  el('micareConfirmPass').value='';
  document.body.style.overflow='';
  const button=el('micareEnableBio');
  if(button){
   button.hidden=!nativeBio();
   button.textContent=localStorage.getItem(BIO_KEY)==='enabled'?'Fingerabdruck deaktivieren':'Fingerabdruck aktivieren';
  }
 }
 function failures(){try{return JSON.parse(localStorage.getItem('micare-failed-logins-v1')||'{}')}catch{return {}}}
 function lockout(){const f=failures();const seconds=Math.ceil(((Number(f.until)||0)-Date.now())/1000);return seconds>0?seconds:0}
 async function onSubmit(event){
  event.preventDefault();
  if(authPending)return;
  const seconds=lockout();
  if(seconds>0){message('Zu viele Fehlversuche. Bitte in '+seconds+' Sekunden erneut versuchen.',true);return}
  const username=text('micareLoginUser').trim(),pass=text('micareLoginPass');
  if(username.length<3||username.length>64){message('Benutzername: 3–64 Zeichen.',true);return}
  if(!current){
   if(pass.length<10||pass.length>200){message('Passwort: mindestens 10 Zeichen, höchstens 200.',true);return}
   if(pass!==text('micareConfirmPass')){message('Beide Passwörter müssen übereinstimmen.',true);return}
  }
  authPending=true;el('micareLoginSubmit').disabled=true;
  try{
   if(!current){
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash=await derive(pass,salt);
    if(readAccount())throw Error('Dieses Gerät ist bereits eingerichtet. Bitte App neu starten.');
    // No plaintext password, biometric secrets or keys in localStorage.
    localStorage.setItem(KEY,JSON.stringify({v:1,username,salt,hash,createdAt:new Date().toISOString()}));
    current=readAccount();localStorage.removeItem('micare-failed-logins-v1');saveTrustedChoice();unlock();
   }else{
    const hash=await derive(pass,current.salt);
    if(username!==current.username||!constantEquals(hash,current.hash)){
     const f=failures(),count=(Number(f.count)||0)+1;
     const until=count>=5?Date.now()+Math.min(300000,30000*Math.pow(2,Math.min(count-5,4))):0;
     localStorage.setItem('micare-failed-logins-v1',JSON.stringify({count,until}));
     message(count>=5?'Anmeldung vorübergehend gesperrt. Bitte später erneut versuchen.':'Benutzername oder Passwort falsch.',true);
     return;
    }
    localStorage.removeItem('micare-failed-logins-v1');saveTrustedChoice();unlock();
   }
  }catch(err){message('Anmeldung fehlgeschlagen: '+err.message,true)}
  finally{authPending=false;el('micareLoginSubmit').disabled=false;el('micareLoginPass').value='';el('micareConfirmPass').value=''}
 }
 function biometricResult(challenge,success){
  if(!bioChallenge||challenge!==bioChallenge)return;
  const mode=bioMode;bioChallenge='';bioMode='';
  if(success){
   if(mode==='enable'&&document.body.classList.contains('micare-authenticated')){
    localStorage.setItem(BIO_KEY,'enabled');
    el('micareEnableBio').textContent='Fingerabdruck deaktivieren';
    window.alert('Fingerabdruck-Anmeldung für dieses Handy aktiviert.');
   }else if(mode==='login'&&!document.body.classList.contains('micare-authenticated')&&current&&localStorage.getItem(BIO_KEY)==='enabled'){
    localStorage.removeItem('micare-failed-logins-v1');unlock();
   }
  }else if(mode==='login')message('Fingerabdruck nicht bestätigt. Du kannst dich mit deinem Passwort anmelden.',true);
 }
 function requestBio(mode){
  if(!nativeBio()||bioChallenge)return;
  if(mode==='login'&&(document.body.classList.contains('micare-authenticated')||localStorage.getItem(BIO_KEY)!=='enabled'))return;
  if(mode==='enable'&&!document.body.classList.contains('micare-authenticated'))return;
  bioMode=mode;bioChallenge=crypto.randomUUID();
  try{window.MiCareAuthNative.authenticate(bioChallenge)}catch(err){bioChallenge='';bioMode='';message(err.message,true)}
 }
 function init(){
  if(!el('micareLock'))return;
  el('micareLoginForm').addEventListener('submit',onSubmit);
  el('micareBioLogin').onclick=()=>requestBio('login');
  el('micareEnableBio').onclick=()=>{
   if(localStorage.getItem(BIO_KEY)==='enabled'){
    localStorage.removeItem(BIO_KEY);el('micareEnableBio').textContent='Fingerabdruck aktivieren';
   }else requestBio('enable');
  };
  el('micareLogout').onclick=()=>{localStorage.removeItem(TRUST_KEY);document.body.style.overflow='hidden';showAuth()};
  if(readAccount()&&localStorage.getItem(TRUST_KEY)==='enabled')unlock();else showAuth();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.MiCareLogin={biometricResult,lock:()=>{if(localStorage.getItem(TRUST_KEY)==='enabled')return;showAuth();}};
})();
