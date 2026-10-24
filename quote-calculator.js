'use strict';
/* M-iCare Kalkulationsmodul – unabhängig von Dateispeicher und Benutzeroberfläche. */
(function(root,factory){
 const m=factory();
 if(typeof module==='object'&&module.exports)module.exports=m;
 if(root)root.MiCareQuote=m;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const euro=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const amount=(n,max=100000000)=>{const v=Number(n);if(!Number.isFinite(v)||v<0||v>max)throw Error('Ungültiger Geldbetrag oder Zahlenwert');return v};
 function compute(v){
  const area=amount(v.area,1e7),visits=amount(v.visits,10000),hours=amount(v.hours,1e5),
   hourly=amount(v.hourly,100000),nonwage=amount(v.nonwage,500),overhead=amount(v.overhead,500),
   productivity=amount(v.productivity,100),material=amount(v.material,1000000),
   km=amount(v.km,50000),perKm=amount(v.perKm,1000),margin=amount(v.margin,1000),
   minNet=amount(v.minNet,1e8),vat=amount(v.vat,100),manualNet=amount(v.manualNet,1e8),
   windowSqm=amount(v.windowSqm,1e7),windowRate=amount(v.windowRate,100000),sides=amount(v.sides,2),
   soil=amount(v.soil,5),extras=amount(v.extras,5);
  if(visits<1||!Number.isInteger(visits))throw Error('Einsätze müssen eine positive ganze Zahl sein');
  if(productivity<=0)throw Error('Produktivität muss größer als 0 sein');
  if(sides!==1&&sides!==2)throw Error('Fensterseiten müssen 1 oder 2 sein');
  const workHours=hours>0?hours:area/Math.max(1,Number(v.sqmPerHour)||100);
  const laborPer=workHours*hourly*(1+nonwage/100)/productivity;
  const basePer=(laborPer+material+2*km*perKm)*(1+overhead/100);
  const cleaningCost=basePer*visits;
  const windowsNet=euro(windowSqm*windowRate*sides*soil*extras);
  const recommendNet=euro(Math.max(minNet,cleaningCost*(1+margin/100)+windowsNet));
  const net=euro(manualNet>0?manualNet:recommendNet);
  const tax=euro(net*vat/100),gross=euro(net+tax);
  const rows=(manualNet>0)
    ?[{title:'Individuell kalkulierte Reinigungsleistung (Pauschale)',quantity:1,unit:'Pauschale',price:net,total:net}]
    :[
      {title:'Reinigungsleistung',quantity:visits,unit:'Einsatz',price:0,total:euro(net-windowsNet)},
      ...(windowSqm>0?[{title:'Fensterreinigung ('+windowSqm+' m² × '+sides+' Seite(n), Faktor '+soil+' × '+extras+')',quantity:1,unit:'Pauschale',price:windowsNet,total:windowsNet}]:[])
    ];
  for(const r of rows){r.price=euro(r.total/r.quantity);r.total=euro(r.total)}
  return {area,visits,hoursPerVisit:euro(workHours),windowSqm,cleaningCost:euro(cleaningCost),
    windowsNet,minimumNet:minNet,recommendNet,net,tax,gross,vat,profit:euro(net-cleaningCost-windowsNet),rows};
 }
 function validateDocument(d){
  if(!d||typeof d!=='object'||!['quote','invoice'].includes(d.kind))throw Error('Dokumenttyp fehlt');
  if(typeof d.id!=='string'||d.id.length>100||typeof d.number!=='string'||d.number.length>80)throw Error('Ungültige Dokumentkennung');
  if(typeof d.customerName!=='string'||!d.customerName.trim()||d.customerName.length>200)throw Error('Kundenname fehlt oder ist zu lang');
  if(typeof d.sellerName!=='string'||d.sellerName.length>200)throw Error('Absendername ungültig');
  if(typeof d.service!=='string'||d.service.length>300)throw Error('Leistungsbeschreibung ungültig');
  if(!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>25)throw Error('Ungültige Rechnungspositionen');
  const sum=euro(d.rows.reduce((a,r)=>a+amount(r.total),0));
  if(Math.abs(sum-euro(d.net))>0.02)throw Error('Positionen stimmen nicht mit Nettobetrag überein');
  if(Math.abs(euro(d.net+d.tax)-euro(d.gross))>0.02)throw Error('Gesamtbetrag inkonsistent');
  return d;
 }
 function createDocument(d){validateDocument(d);return structuredClone(d)}
 async function pdf(d){
  validateDocument(d);
  if(typeof document==='undefined')throw Error('PDF benötigt Browsergrafik');
  const c=document.createElement('canvas');c.width=1240;c.height=1754;
  const x=c.getContext('2d');if(!x)throw Error('Canvas nicht verfügbar');
  const W=1240,H=1754;const pages=[];
  const blue='#124e8a',muted='#516478',dark='#152b42';
  function fillText(text,left,top,maxWidth=1050,font='24px Arial',color=dark){
   x.font=font;x.fillStyle=color;
   const words=String(text||'—').split(/\s+/),lines=[];let line='';
   for(const word of words){const candidate=line?line+' '+word:word;if(x.measureText(candidate).width>maxWidth&&line){lines.push(line);line=word}else line=candidate}
   lines.push(line);
   lines.slice(0,8).forEach((row,i)=>x.fillText(row,left,top+i*32));
   return Math.min(lines.length,8)*32;
  }
  function startPage(){
   x.fillStyle='#fff';x.fillRect(0,0,W,H);
   x.fillStyle=blue;x.fillRect(0,0,W,13);
   x.fillStyle=blue;x.font='bold 40px Arial';x.fillText('M-iCare · '+(d.kind==='quote'?'KOSTENVORANSCHLAG':'RECHNUNGSENTWURF'),70,102);
   x.fillStyle=muted;x.font='20px Arial';x.fillText('Entwurf / Voransicht · Vor Versand alle Angaben prüfen',70,140);
   x.fillStyle=dark;
  }
  startPage();let y=200;
  fillText('Absender',70,y,500,'bold 25px Arial',blue);fillText('Empfänger',665,y,500,'bold 25px Arial',blue);y+=48;
  y+=Math.max(fillText(d.sellerName||'Absender ergänzen',70,y,500,'bold 25px Arial'),fillText(d.customerName,665,y,500,'bold 25px Arial'));
  const left=[d.sellerAddress,d.sellerTaxId?('Steuer-ID/Steuernummer: '+d.sellerTaxId):'Steuernummer: bitte ergänzen',d.sellerEmail];
  const right=[d.customerAddress,d.objectName,d.objectAddress];
  for(let i=0;i<Math.max(left.length,right.length);i++){
   const h1=fillText(left[i]||'',70,y,520,'22px Arial');
   const h2=fillText(right[i]||'',665,y,505,'22px Arial');y+=Math.max(h1,h2,34);
  }
  y=Math.max(y+55,505);
  fillText('Dokument: '+d.number,70,y,510,'bold 24px Arial');fillText('Datum: '+d.date,680,y,485,'23px Arial');y+=50;
  fillText('Leistungsdatum/-zeitraum: '+(d.serviceDate||'bitte ergänzen'),70,y,1120,'23px Arial');y+=52;
  fillText('Arbeitskarte: '+(d.orderNumber||'keine')+'   ·   Kunde: '+(d.customerNumber||'—'),70,y,1100,'22px Arial');y+=60;
  y+=fillText(d.service,70,y,1060,'bold 26px Arial');
  y+=20;
  x.fillStyle='#e9f2fd';x.fillRect(70,y,1100,54);x.font='bold 22px Arial';x.fillStyle=blue;x.fillText('Leistung',85,y+34);x.fillText('Menge',700,y+34);x.fillText('Einzelpreis',860,y+34);x.fillText('Gesamt',1060,y+34);y+=68;
  const eur=n=>Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  for(const row of d.rows){
   const height=Math.max(68,Math.ceil(String(row.title).length/48)*32+18);
   x.fillStyle='#f4f7fc';x.fillRect(70,y,1100,height-8);
   fillText(row.title,85,y+31,590,'21px Arial');
   x.fillStyle=dark;x.font='21px Arial';x.fillText(String(row.quantity)+' '+row.unit,700,y+31);x.fillText(eur(row.price),860,y+31);x.fillText(eur(row.total),1060,y+31);
   y+=height;
  }
  y+=18;x.strokeStyle='#d3e1ef';x.beginPath();x.moveTo(70,y);x.lineTo(1170,y);x.stroke();y+=55;
  fillText('Nettobetrag',755,y,280,'23px Arial');fillText(eur(d.net),1030,y,170,'bold 23px Arial');y+=55;
  fillText('Umsatzsteuer '+d.vat+' %',755,y,300,'23px Arial');fillText(eur(d.tax),1030,y,170,'bold 23px Arial');y+=58;
  x.fillStyle=blue;x.fillRect(700,y-35,470,72);x.fillStyle='#fff';x.font='bold 29px Arial';x.fillText('Gesamt',725,y+10);x.fillText(eur(d.gross),953,y+10);y+=103;
  if(d.kind==='quote'){
   y+=fillText('Angebot gültig bis: '+(d.validUntil||'bitte ergänzen'),70,y,1080,'23px Arial');
  }else{
   y+=fillText('Zahlungsziel: '+(d.dueDate||'bitte ergänzen'),70,y,1080,'23px Arial');
   y+=fillText('Bankverbindung: '+(d.iban||'bitte ergänzen'),70,y,1080,'23px Arial');
  }
  y+=fillText(d.notes||'Kalkulation auf Basis der angegebenen Leistungen und Preise.',70,y+20,1090,'22px Arial');
  x.fillStyle=muted;x.font='20px Arial';x.fillText('M-iCare · Entwurf – keine versendete Rechnung · Druckdatum '+new Date().toLocaleDateString('de-DE'),70,H-65);
  if(d.kind==='invoice'){
   x.save();x.translate(210,1020);x.rotate(-Math.PI/8);x.fillStyle='rgba(170,30,30,.18)';x.font='bold 130px Arial';x.fillText('ENTWURF',0,0);x.restore();
  }
  const data=c.toDataURL('image/jpeg',0.88).split(',')[1],bin=atob(data),jpg=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)jpg[i]=bin.charCodeAt(i);
  pages.push(jpg);
  // Eine einzelne A4-Hochformat-Seite; der Kalkulationsentwurf enthält höchstens 2 Positionen.
  const enc=new TextEncoder(),chunks=[],offsets=[0];let pos=0;
  function add(v){let b=typeof v==='string'?enc.encode(v):v;chunks.push(b);pos+=b.length}
  function obj(id,s){offsets[id]=pos;add(id+' 0 obj\n'+s+'\nendobj\n')}
  add('%PDF-1.4\n');
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /I 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4]=pos;add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');add(jpg);add('\nendstream\nendobj\n');
  const commands='q\n595 0 0 842 0 0 cm\n/I Do\nQ\n';
  obj(5,'<< /Length '+enc.encode(commands).length+' >>\nstream\n'+commands+'endstream');
  const xref=pos;add('xref\n0 6\n0000000000 65535 f \n');for(let i=1;i<=5;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  return new Blob(chunks,{type:'application/pdf'});
 }
 return {compute,validateDocument,createDocument,pdf,euro};
});
