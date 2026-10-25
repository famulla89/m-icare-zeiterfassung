'use strict';
/* Diktat-Feldnormalisierung; keine Netzverbindung, keine sensiblen Daten speichern. */
(function(root,factory){
 const m=factory();
 if(typeof module==='object'&&module.exports)module.exports=m;
 if(root)root.MiCareVoiceInput=m;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const digits={null:'0',zero:'0',ein:'1',eins:'1',eine:'1',einer:'1',zwei:'2',zwo:'2',drei:'3',vier:'4',fünf:'5',fuenf:'5',funf:'5',sechs:'6',sieben:'7',acht:'8',neun:'9'};
 const numbers={zehn:'10',elf:'11',zwölf:'12',zwoelf:'12',zwolf:'12',dreizehn:'13',vierzehn:'14',fünfzehn:'15',fuenfzehn:'15',sechzehn:'16',siebzehn:'17',achtzehn:'18',neunzehn:'19',zwanzig:'20',dreißig:'30',dreissig:'30',vierzig:'40',fünfzig:'50',fuenfzig:'50'};
 function tokens(s){return String(s??'').toLocaleLowerCase('de-DE').replace(/[,.!?:;]+/g,' ').trim().split(/\s+/).filter(Boolean)}
 function toDigitSequence(s){
  const parts=tokens(s).filter(t=>!['plz','postleitzahl','ist','lautet','die','meine','nummer','hausnummer'].includes(t));
  if(!parts.length)return null;
  let out='';
  for(const token of parts){
   if(/^\d+$/.test(token)){out+=token;continue}
   if(Object.hasOwn(digits,token)){out+=digits[token];continue}
   return null;
  }
  return out;
 }
 function postal(s){
  const out=toDigitSequence(s);
  return out!==null&&/^\d{5}$/.test(out)?out:null;
 }
 function houseNumber(s){
  const raw=String(s??'').trim().toLocaleLowerCase('de-DE');
  if(!raw)return '';
  const stripped=raw.replace(/^(?:hausnummer|nummer)\s+/i,'').trim();
  const tokenized=tokens(stripped.replace(/\s*([-\/])\s*/g,' $1 '));
  const out=tokenized.map(t=>{
   if(/^\d+[a-z]?$/.test(t)||t==='-'||t==='/')return t;
   if(Object.hasOwn(digits,t))return digits[t];
   if(Object.hasOwn(numbers,t))return numbers[t];
   if(/^[a-z]$/.test(t))return t;
   return null;
  });
  if(out.includes(null))return null;
  const joined=out.join('').replace(/\s/g,'');
  return /^\d{1,5}[a-z]?(?:[-/]\d{1,5}[a-z]?)?$/.test(joined)?joined:null;
 }
 function phone(s){
  const raw=String(s??'').trim();
  if(!raw)return '';
  const international=/^\s*(?:plus\b|\+)/i.test(raw);
  const cleaned=raw.replace(/^\s*(plus|\+)\s*/i,'').replace(/[-()/]/g,' ');
  const result=toDigitSequence(cleaned);
  return result!==null&&result.length>=3&&result.length<=20?(international?'+':'')+result:null;
 }
 function splitAddress(source){
  const address=String(source||'').trim();
  const match=/^(.+?)\s+(\d{1,5}\s*[a-zA-Z]?(?:\s*[-/]\s*\d{1,5}\s*[a-zA-Z]?)?)$/.exec(address);
  if(!match)return {street:address,houseNumber:''};
  return {street:match[1].trim(),houseNumber:match[2].replace(/\s+/g,'').trim()};
 }
 function address(street,houseNo){
  const s=String(street||'').trim(),h=String(houseNo||'').trim();
  return [s,h].filter(Boolean).join(' ');
 }
 return {postal,houseNumber,phone,splitAddress,address,toDigitSequence};
});