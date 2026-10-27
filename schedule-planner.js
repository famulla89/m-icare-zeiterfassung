'use strict';
/* M-iCare schedule contract helper. Local calendar days, no UTC drift. */
(function(root,factory){const lib=factory();if(typeof module==='object'&&module.exports)module.exports=lib;root.MiCareSchedulePlanner=lib})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const pad=n=>String(n).padStart(2,'0');
 const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))throw Error('Bitte ein vollständiges Datum auswählen');const [y,m,d]=s.split('-').map(Number);const v=new Date(y,m-1,d,12);if(v.getFullYear()!==y||v.getMonth()+1!==m||v.getDate()!==d)throw Error('Ungültiges Kalenderdatum');return v};
 const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
 const mondayOf=s=>{const d=parse(s);d.setDate(d.getDate()-(d.getDay()+6)%7);return d};
 const betweenWeeks=(first,current)=>Math.round((mondayOf(current)-mondayOf(first))/604800000);
 function build(p){
  const mode=p.mode==='range'?'range':'count';
  const start=iso(parse(p.start));
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime||'')||p.startTime>=p.endTime)throw Error('Start-/Endzeit bitte prüfen');
  const dates=[];
  if(mode==='range'){
   const end=iso(parse(p.end));
   if(end<start)throw Error('Vertragsende liegt vor dem Vertragsbeginn');
   const days=Array.from(new Set((p.weekdays||[]).map(Number)));
   if(!days.length||days.some(n=>!Number.isInteger(n)||n<0||n>6))throw Error('Bitte mindestens einen gültigen Wochentag auswählen');
   const interval=Number(p.intervalWeeks||1);
   if(![1,2,3,4].includes(interval))throw Error('Wochenrhythmus ungültig');
   if((parse(end)-parse(start))>366*2*864e5)throw Error('Ein Vertrag darf in dieser Version maximal zwei Jahre dauern');
   for(let d=start;d<=end;d=addDays(d,1)){
    if(days.includes(parse(d).getDay())&&betweenWeeks(start,d)%interval===0){dates.push(d);if(dates.length>104)throw Error('Maximal 104 Einsätze je Auftrag – Zeitraum verkürzen')}
   }
   if(!dates.length)throw Error('Keine Einsätze an den ausgewählten Wochentagen im Zeitraum');
  }else{
   const count=Number(p.visits),rhythm=Number(p.rhythm||7);
   if(!Number.isInteger(count)||count<1||count>52)throw Error('Zwischen 1 und 52 Einsätze wählen');
   if(![1,7,14].includes(rhythm))throw Error('Ungültiger Intervallabstand');
   for(let i=0;i<count;i++)dates.push(addDays(start,i*rhythm));
  }
  return dates;
 }
 // Calendar-based lead times. An accepted quote retains the resolved integer reminderDays.
 // Existing records with only reminderDays remain compatible.
 const dayDistance=(from,to)=>{const a=parse(from),b=parse(to);return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/864e5)};
 function subtractMonths(end,months){
  const d=parse(end),first=new Date(d.getFullYear(),d.getMonth()-months,1,12);
  const lastDay=new Date(first.getFullYear(),first.getMonth()+1,0,12).getDate();
  first.setDate(Math.min(d.getDate(),lastDay));
  return iso(first);
 }
 function reminderSettings({start,end,selection='auto',customValue=1,customUnit='days'}){
  const from=iso(parse(start)),until=iso(parse(end)),duration=dayDistance(from,until);
  if(duration<0)throw Error('Vertragsende liegt vor dem Vertragsbeginn');
  let requestedDate,label;
  if(selection==='-1')return {disabled:true,reminderDays:-1,date:'',label:'deaktiviert',adjusted:false};
  if(selection==='auto'){
   const days=duration<=14?Math.min(2,duration):duration<=30?7:duration<=60?14:30;
   requestedDate=addDays(until,-days);
   label='Automatisch: '+days+' '+(days===1?'Tag':'Tage')+' vorher';
  }else if(selection==='custom'){
   const n=Number(customValue);
   if(!Number.isInteger(n)||n<1)throw Error('Bitte eine ganze Zahl ab 1 eingeben');
   const max={days:730,weeks:104,months:24};
   if(!Object.prototype.hasOwnProperty.call(max,customUnit)||n>max[customUnit])throw Error('Eigener Zeitraum: maximal 730 Tage, 104 Wochen oder 24 Monate');
   requestedDate=customUnit==='months'?subtractMonths(until,n):addDays(until,-n*(customUnit==='weeks'?7:1));
   label=n+' '+(customUnit==='days'?(n===1?'Tag':'Tage'):customUnit==='weeks'?(n===1?'Woche':'Wochen'):(n===1?'Monat':'Monate'))+' vorher';
  }else{
   const n=Number(selection);
   if(!Number.isInteger(n)||n<0||n>730)throw Error('Ungültige Erinnerungseinstellung');
   requestedDate=addDays(until,-n);
   label=n===0?'Am letzten Auftragstag':n+' '+(n===1?'Tag':'Tage')+' vorher';
  }
  const adjusted=requestedDate<from,date=adjusted?from:requestedDate;
  return {disabled:false,reminderDays:dayDistance(date,until),date,label,adjusted};
 }
 return Object.freeze({build,iso,parse,addDays,dayDistance,reminderSettings});
});
