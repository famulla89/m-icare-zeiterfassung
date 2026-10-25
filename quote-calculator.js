'use strict';
/* M-iCare Kalkulationsmodul – unabhängig von Dateispeicher und Benutzeroberfläche. */
(function(root,factory){
 const m=factory();
 if(typeof module==='object'&&module.exports)module.exports=m;
 if(root)root.MiCareQuote=m;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const euro=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 // Nur die Anzeige im PDF umwandeln. Date-Inputs und gespeicherte Entwürfe behalten YYYY-MM-DD.
 // Keine Date.parse-/Timezone-Umrechnung: 2026-11-23 bleibt sicher der 23. November.
 function formatPdfDate(value){
  const text=String(value??'').trim();
  const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if(!parts)return text; // bereits deutsch formatierte oder frei beschriebene Leistungszeiträume
  const year=Number(parts[1]),month=Number(parts[2]),day=Number(parts[3]);
  const check=new Date(Date.UTC(year,month-1,day));
  if(!Number.isFinite(check.getTime())||check.getUTCFullYear()!==year||check.getUTCMonth()+1!==month||check.getUTCDate()!==day)return text;
  return parts[3]+'.'+parts[2]+'.'+parts[1];
 }

 const amount=(n,max=100000000)=>{const v=Number(n);if(!Number.isFinite(v)||v<0||v>max)throw Error('Ungültiger Geldbetrag oder Zahlenwert');return v};
 function compute(v){
  const euroCents=n=>Math.round((Number(n)+Number.EPSILON)*100);
  const scope=v.scope||'combined';
  if(!['rooms','windows','combined','other'].includes(scope))throw Error('Unbekannte Leistungsart');
  const roomWork=scope==='rooms'||scope==='combined';
  const windowWork=scope==='windows'||scope==='combined';
  const area=amount(v.area,1e7),visits=amount(v.visits,10000),hours=amount(v.hours,1e5),
   hourly=amount(v.hourly,100000),nonwage=amount(v.nonwage,500),overhead=amount(v.overhead,500),
   productivity=amount(v.productivity,100),material=amount(v.material,1000000),
   km=amount(v.km,50000),perKm=amount(v.perKm,1000),margin=amount(v.margin,1000),
   minNet=amount(v.minNet,1e8),vat=amount(v.vat,100),manualNet=amount(v.manualNet,1e8);
  const sqmPerHour=amount(v.sqmPerHour??100,1000000),setupMinutes=amount(v.setupMinutes??0,1000000),
   minSqm=amount(v.minimumSqm??0,1000000),liftRental=amount(v.liftRental??0,1000000),
   fixedProfit=amount(v.fixedProfit??0,1000000);
  const mode=v.mode||'business';
  if(!['business','solo'].includes(mode))throw Error('Betriebsmodus ungültig');
  if(visits<1||!Number.isInteger(visits))throw Error('Einsätze müssen eine positive ganze Zahl sein');
  if(productivity<=0)throw Error('Produktivität muss größer als 0 sein');
  if(roomWork&&hours===0&&sqmPerHour<=0)throw Error('Bei Raumreinigung mit 0 Stunden muss „m² pro Stunde“ größer als 0 sein');
  if(roomWork&&hours===0&&area<=0)throw Error('Raumreinigung benötigt eine Raumfläche oder eine geschätzte Stundenzahl');
  if(scope==='other'&&hours<=0)throw Error('Bei sonstigen Leistungen bitte eine Arbeitszeit in Stunden je Einsatz eingeben');
  const workHours=(hours>0?hours:(roomWork?area/sqmPerHour:0))+setupMinutes/60;
  const laborPer=workHours*hourly*(1+(mode==='solo'?0:nonwage)/100)/(productivity/100);
  const basePer=(laborPer+material+2*km*perKm)*(1+overhead/100);
  const cleaningCost=euro(basePer*visits);
  let windowItems=[];
  if(windowWork&&Array.isArray(v.windowItems)){
   if(v.windowItems.length>8)throw Error('Maximal acht Fensterpositionen pro Kalkulation');
   windowItems=v.windowItems.map((item,i)=>{
    const label=String(item.label||'Fenster').trim();
    if(!label||label.length>100)throw Error('Ungültige Fensterart');
    const qty=amount(item.qty,100000),each=amount(item.each,1e6),
     rate=amount(item.rate,1e5),sides=amount(item.sides,2),soil=amount(item.soil,5),
     frame=!!item.frame,ladder=!!item.ladder,lift=!!item.lift;
    if(!Number.isInteger(qty)||qty<1||each<=0)throw Error('Fenster: Stückzahl und Fläche müssen positiv sein');
    if(sides!==1&&sides!==2)throw Error('Fenster: ein- oder beidseitig auswählen');
    if(soil<=0)throw Error('Fenster: Verschmutzungsfaktor ungültig');
    const extra=euro((frame?1.2:1)*(ladder?1.3:1)*(lift?1.7:1));
    const sqm=euro(qty*each),total=euro(sqm*rate*sides*soil*extra);
    return {id:item.id||'w'+i,label,qty,each,rate,sides,soil,frame,ladder,lift,extra,sqm,total};
   });
  }else if(windowWork&&!Array.isArray(v.windowItems)){
   const sqm=amount(v.windowSqm||0,1e7);
   if(sqm>0){
    const rate=amount(v.windowRate,100000),sides=amount(v.sides,2),soil=amount(v.soil,5),extra=amount(v.extras,5);
    if(sides!==1&&sides!==2)throw Error('Fensterseiten müssen 1 oder 2 sein');
    windowItems=[{id:'legacy',label:'Fensterreinigung',qty:1,each:sqm,rate,sides,soil,extra,sqm,total:euro(sqm*rate*sides*soil*extra)}];
   }
  }
  if(scope==='windows'&&windowItems.length===0)throw Error('Für reine Fensterreinigung mindestens eine Fensterart hinzufügen');
  const windowSqm=euro(windowItems.reduce((sum,w)=>sum+w.sqm,0));
  // Fenster-Verkaufspreise basieren auf der frei gewählten m²-Kalkulation je Einsatz.
  // Die Arbeitsstunden sind interne Lohnkosten und werden NICHT ein zweites Mal als Verkaufspreis berechnet.
  const windowsNet=euro(windowItems.reduce((sum,w)=>sum+w.total,0)*visits);
  const floorArea=roomWork?area:windowWork?windowSqm:0;
  const minimumNet=Math.max(minNet,euro(floorArea*minSqm*visits));
  const profitMarkup=fixedProfit>0?fixedProfit:cleaningCost*margin/100;
  const recommendNet=euro(Math.max(minimumNet,(scope==='windows'?Math.max(windowsNet,cleaningCost+profitMarkup):cleaningCost+profitMarkup+windowsNet)+liftRental));
  const net=euro(manualNet>0?manualNet:recommendNet);
  const tax=euro(net*vat/100),gross=euro(net+tax);
  const serviceTitle=scope==='rooms'?'Raum- und Bodenreinigung':scope==='combined'?'Raum- und Bodenreinigung':scope==='windows'?'Anfahrt, Rüstzeit und Material':String(v.serviceName||'Sonstige Dienstleistung').trim().slice(0,120)||'Sonstige Dienstleistung';
  const rows=[];
  if(scope!=='windows'){
   rows.push({title:serviceTitle+' · '+visits+(visits===1?' Einsatz':' Einsätze'),quantity:1,unit:'Pauschale',total:euro(recommendNet-windowsNet-liftRental)});
  }
  if(windowWork){
   for(const w of windowItems)rows.push({
    title:w.label+' · '+w.qty+' × '+w.each+' m² · '+(w.sides===2?'beidseitig':'einseitig')+(w.frame?' · Rahmen/Falz':'')+(w.ladder?' · Leiter':'')+(w.lift?' · Hebebühne':'')+' · '+visits+(visits===1?' Einsatz':' Einsätze'),
    quantity:1,unit:'Pauschale',total:euro(w.total*visits)
   });
  }
  if(scope==='windows'&&recommendNet>windowsNet+liftRental){
   rows.push({title:'Anfahrt, Rüstzeit, Material und Gemeinkosten · '+visits+(visits===1?' Einsatz':' Einsätze'),quantity:1,unit:'Pauschale',total:euro(recommendNet-windowsNet-liftRental)});
  }
  if(liftRental>0)rows.push({title:'Hebebühne – separate Miete / Aufwand',quantity:1,unit:'Pauschale',total:liftRental});
  if(rows.length===0)throw Error('Keine berechenbare Leistung');
  // Abweichenden eigenen Endpreis anteilig verteilen: Auch bei Pauschalpreis werden die Fensterarten im PDF gezeigt.
  if(manualNet>0&&recommendNet>0){
   let assigned=0;const target=euroCents(net);
   for(let i=0;i<rows.length;i++){
    const cents=i===rows.length-1?target-assigned:Math.max(0,Math.round(euroCents(rows[i].total)*target/euroCents(recommendNet)));
    assigned+=cents;rows[i].total=euro(cents/100);
   }
  }
  const roundedSum=euro(rows.reduce((sum,r)=>sum+r.total,0));
  rows[0].total=euro(rows[0].total+euro(net-roundedSum));
  if(rows.some(r=>r.total<0))throw Error('Angebotspositionen konnten nicht positiv verteilt werden');
  for(const r of rows){r.price=euro(r.total/r.quantity);r.total=euro(r.total)}
  return {scope,mode,area,visits,hoursPerVisit:euro(workHours),setupMinutes,windowSqm,windowItems,cleaningCost,
   windowsNet,liftRental,minimumNet:euro(minimumNet),recommendNet,net,tax,gross,vat,
   profit:euro(net-cleaningCost-liftRental),rows,roomCostIncluded:roomWork,
   estimatedLaborWarning:scope==='windows'&&hours===0?'Fenster-Arbeitszeit nicht angegeben: Der m²-Preis ist bereits ein Verkaufspreis. Ohne Stunden kannst du interne Personalkosten nur unvollständig prüfen.':hours>16?'Achtung: '+hours+' Stunden je Einsatz eingegeben. Falls du Minuten meinst: 0,5 Stunden sind 30 Minuten.':null};
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
  if(d.taxMode==='small'&&(Number(d.vat)!==0||Number(d.tax)!==0))throw Error('Kleinunternehmer-Dokument darf keine Umsatzsteuer ausweisen');
  return d;
 }
 function createDocument(d){validateDocument(d);return structuredClone(d)}
 async function pdf(d){
  validateDocument(d);
  if(typeof document==='undefined')throw Error('PDF benötigt Browsergrafik');
  const W=1240,H=1754,blue='#124e8a',dark='#152b42',muted='#516478',jpgs=[];
  const euros=n=>Number(n).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  // Das bereits mit Android, Windows und PWA ausgelieferte Original-M-iCare-Logo einbetten.
  // Lokal über ein Image-Element laden: keine fremden URLs, Konten oder Netzverbindung.
  // Bei Fehler abbrechen statt unbemerkt eine PDF ohne Firmenlogo auszuliefern.
  async function loadBrandLogo(){
   const picture=new Image();
   picture.decoding='async';
   // Die Eventhandler müssen vor dem Setzen der Quelle stehen (Android WebView / Cache).
   await new Promise((resolve,reject)=>{
    picture.onload=resolve;
    picture.onerror=()=>reject(Error('Das M-iCare-Logo konnte nicht geladen werden. Bitte App-Dateien überprüfen.'));
    picture.src=new URL('./logo.svg',document.baseURI).href;
    if(picture.complete&&picture.naturalWidth>0)resolve();
   });
   if(picture.naturalWidth<1||picture.naturalHeight<1)throw Error('M-iCare-Logo ist leer');
   return picture;
  }
  const brandLogo=await loadBrandLogo();
  function render(pageIndex,rows,pageCount){
   const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const c=canvas.getContext('2d');if(!c)throw Error('Canvas nicht verfügbar');
   c.fillStyle='#fff';c.fillRect(0,0,W,H);
   c.fillStyle=blue;c.fillRect(0,0,W,12);
   // Briefkopf: echtes Logo im Original-Seitenverhältnis, immer sichtbar oben links.
   c.drawImage(brandLogo,70,31,350,154);
   // Sichtbarkeitskontrolle: Ein technisch geladenes SVG kann trotzdem leer gerendert sein.
   // Für Kostenvoranschlag UND Rechnungsentwurf prüfen wir echte farbige Logo-Pixel.
   // Das Rechteck liegt ausschließlich innerhalb des Markenlogos (nicht im blauen PDF-Balken).
   const logoPixels=c.getImageData(70,31,350,154).data;
   let recognizableLogoPixels=0;
   for(let p=0;p<logoPixels.length;p+=4){
    if(logoPixels[p+3]>200&&
       (logoPixels[p]<190||logoPixels[p+1]<190||logoPixels[p+2]<190))
      recognizableLogoPixels++;
   }
   if(recognizableLogoPixels<200)
    throw Error('Das M-iCare-Logo wurde nicht sichtbar ins PDF übernommen. Export abgebrochen.');
   c.fillStyle=blue;c.font='bold 37px Arial';
   c.fillText(d.kind==='quote'?'KOSTENVORANSCHLAG':Number(d.sourceVisitCount)>1?(d.finalizedAt?'TEILRECHNUNG':'TEILRECHNUNGSENTWURF'):(d.finalizedAt?'RECHNUNG':'RECHNUNGSENTWURF'),455,91);
   c.fillStyle=muted;c.font='20px Arial';c.fillText((d.finalizedAt?'Seite ':'Entwurf zur Prüfung  ·  Seite ')+(pageIndex+1)+' von '+pageCount,458,133);
   c.strokeStyle='#c7d8e9';c.lineWidth=2;c.beginPath();c.moveTo(70,199);c.lineTo(1170,199);c.stroke();
   let y=244;
   function write(text,left,top,width,font='22px Arial',color=dark){
    c.font=font;c.fillStyle=color;
    const words=String(text||'—').split(/\s+/);let line='',lines=[];
    for(const word of words){
     const candidate=line?line+' '+word:word;
     if(c.measureText(candidate).width>width&&line){lines.push(line);line=word}else line=candidate;
    }
    lines.push(line);
    for(const l of lines.slice(0,5)){c.fillText(l,left,top);top+=29}
    return Math.min(5,lines.length)*29;
   }
   if(pageIndex===0){
    write('Absender',70,y,490,'bold 25px Arial',blue);write('Empfänger',670,y,490,'bold 25px Arial',blue);y+=43;
    y+=Math.max(write(d.sellerName||'Absender ergänzen',70,y,500,'bold 25px Arial'),write(d.customerName,670,y,500,'bold 25px Arial'));
    const left=[d.sellerAddress,d.sellerTaxId?'Steuernummer / USt-ID: '+d.sellerTaxId:'Steuernummer noch ergänzen',d.sellerEmail,d.sellerPhone?'Tel.: '+d.sellerPhone:''],
    right=[d.customerAddress,d.objectName,d.objectAddress,''];
    for(let i=0;i<4;i++)y+=Math.max(write(left[i]||'',70,y,490),write(right[i]||'',670,y,490),29);
    y=Math.max(y+35,420);
    write('Nr.: '+d.number,70,y,490,'bold 24px Arial');write('Datum: '+formatPdfDate(d.date),700,y,470,'23px Arial');y+=45;
    write('Leistungszeitraum: '+(formatPdfDate(d.serviceDate)||'bitte ergänzen'),70,y,1050);y+=42;
    write('Arbeitskarte: '+(d.orderNumber||'keine'),70,y,1100);y+=42;
    if(d.kind==='invoice'&&d.sourceQuoteNumber){
     y+=write('Angebot: '+d.sourceQuoteNumber+(Number(d.sourceVisitCount)>1?' · Teilrechnung '+d.sourceVisitNumber+' von '+d.sourceVisitCount:' · vollständig abgerechneter Einsatz'),70,y,1090,'20px Arial');
    }
    if(d.kind==='quote'&&d.formValues?.PlanDate){
     const plan=d.formValues;
     const cadence=plan.PlanRhythm==='1'?'täglich':plan.PlanRhythm==='14'?'alle 2 Wochen':'wöchentlich';
     y+=write('Wunschtermin: '+formatPdfDate(plan.PlanDate)+' · '+(plan.PlanStart||'–')+'–'+(plan.PlanEnd||'–')+' Uhr',70,y,1090,'20px Arial');
     if(Number(d.calculation?.visits)>1)y+=write('Geplant: '+d.calculation.visits+' Einsätze, '+cadence+' · verbindlich erst nach Annahme',70,y,1090,'20px Arial');
    }
    y+=write(d.service,70,y,1080,'bold 25px Arial');
   }else{
    write('Nr.: '+d.number+'  ·  '+d.customerName,70,y,1080,'bold 25px Arial');
    y+=62;
   }
   y+=20;
   c.fillStyle='#e9f2fc';c.fillRect(70,y-10,1100,52);
   write('Leistung',85,y+23,600,'bold 21px Arial',blue);
   write('Menge',780,y+23,100,'bold 21px Arial',blue);
   write('Gesamt',1010,y+23,170,'bold 21px Arial',blue);y+=65;
   for(const row of rows){
    c.fillStyle='#f4f7fc';c.fillRect(70,y-6,1100,82);
    write(row.title,84,y+22,670,'21px Arial');
    write(row.quantity+' '+row.unit,777,y+22,170,'20px Arial');
    write(euros(row.total),1005,y+22,170,'bold 20px Arial');y+=88;
   }
   if(pageIndex===pageCount-1){
    y+=25;c.strokeStyle='#bdcde0';c.beginPath();c.moveTo(70,y);c.lineTo(1170,y);c.stroke();y+=50;
    write('Netto',710,y,230);write(euros(d.net),1000,y,180,'bold 24px Arial');y+=49;
    if(d.taxMode==='small'){
     y+=write('Umsatzsteuerfrei gemäß § 19 UStG (Kleinunternehmerregelung).',70,y,1050,'20px Arial');
    }else{
     write('USt. '+d.vat+' %',710,y,240);write(euros(d.tax),1000,y,180,'bold 24px Arial');y+=62;
    }
    c.fillStyle=blue;c.fillRect(700,y-40,470,70);write('Gesamt',720,y+5,250,'bold 29px Arial','#fff');write(euros(d.gross),970,y+5,185,'bold 29px Arial','#fff');y+=100;
    if(d.kind==='quote')y+=write('Angebot gültig bis: '+(formatPdfDate(d.validUntil)||'bitte ergänzen'),70,y,1030);
    else{
     y+=write('Zahlbar bis: '+(formatPdfDate(d.dueDate)||'bitte ergänzen'),70,y,1030);
     y+=write('IBAN: '+(d.iban||'bitte ergänzen'),70,y,1030);
    }
    y+=write(d.notes||'Leistungsumfang und Konditionen vor Versand überprüfen.',70,y+12,1075,'20px Arial');
   }
   c.fillStyle=muted;c.font='19px Arial';c.fillText((d.finalizedAt?'Rechnung – Versand nicht automatisch bestätigt':'Entwurf – nicht automatisch versendet')+' · '+new Date().toLocaleDateString('de-DE'),70,H-65);
   if(d.kind==='invoice'&&!d.finalizedAt){
    c.save();c.translate(285,1480);c.rotate(-Math.PI/11);
    c.fillStyle='rgba(170,25,25,.16)';c.font='bold 115px Arial';c.fillText('ENTWURF',0,0);c.restore();
   }
   const raw=atob(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);
   const jpg=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)jpg[i]=raw.charCodeAt(i);
   return jpg;
  }
  // Maximal 6 Positionen pro Seite; zweite und weitere Seiten haben einen kompakten Kopf.
  const allPages=[];
  for(let start=0;start<d.rows.length;start+=6)allPages.push(d.rows.slice(start,start+6));
  if(!allPages.length)allPages.push([]);
  // Wenn 6 Zeilen auf der letzten Seite zu wenig Platz für Summen lassen: eigene Summenseite.
  if(allPages[allPages.length-1].length>4)allPages.push([]);
  allPages.forEach((rows,index)=>jpgs.push(render(index,rows,allPages.length)));
  const enc=new TextEncoder(),parts=[],offsets=[0];let pos=0;
  function add(v){const b=typeof v==='string'?enc.encode(v):v;parts.push(b);pos+=b.length}
  function obj(id,value){offsets[id]=pos;add(id+' 0 obj\n'+value+'\nendobj\n')}
  add('%PDF-1.4\n');
  const ids=jpgs.map((_,i)=>3+i*3);
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids ['+ids.map(id=>id+' 0 R').join(' ')+'] /Count '+jpgs.length+' >>');
  jpgs.forEach((jpg,i)=>{
   const p=ids[i],img=p+1,cmd=p+2;
   obj(p,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /I '+img+' 0 R >> >> /Contents '+cmd+' 0 R >>');
   offsets[img]=pos;add(img+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+W+' /Height '+H+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');
   add(jpg);add('\nendstream\nendobj\n');
   const commands='q\n595 0 0 842 0 0 cm\n/I Do\nQ\n';
   obj(cmd,'<< /Length '+enc.encode(commands).length+' >>\nstream\n'+commands+'endstream');
  });
  const max=2+jpgs.length*3,xref=pos;
  add('xref\n0 '+(max+1)+'\n0000000000 65535 f \n');
  for(let i=1;i<=max;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  add('trailer\n<< /Size '+(max+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
  return new Blob(parts,{type:'application/pdf'});
 }
 return {compute,validateDocument,createDocument,pdf,euro,formatPdfDate};
});
