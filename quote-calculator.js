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
  if(d.invoiceType==='final'&&Array.isArray(d.performedWork)){
   if(d.performedWork.length>1000)throw Error('Zu viele Arbeitskarten für den PDF-Leistungsnachweis');
   for(const item of d.performedWork){
    if(!item||typeof item.akNumber!=='string'||String(item.workDone||'').length>12000||String(item.service||'').length>300)throw Error('Ungültiger Leistungsnachweis in der Schlussrechnung');
   }
  }
  return d;
 }
 function createDocument(d){validateDocument(d);return structuredClone(d)}
 async function pdf(d,options={}){
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
  function encodeCanvas(canvas){
   const raw=atob(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);
   const jpg=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)jpg[i]=raw.charCodeAt(i);
   return jpg;
  }
  const measureCanvas=document.createElement('canvas'),measure=measureCanvas.getContext('2d');
  function wrapDetail(value,width,font='20px Arial'){
   measure.font=font;
   const words=String(value||'–').replace(/\s+/g,' ').trim().split(' ');
   const lines=[];let line='';
   for(const word of words){
    const parts=[];
    if(measure.measureText(word).width>width){
     let piece='';for(const ch of word){if(piece&&measure.measureText(piece+ch).width>width){parts.push(piece);piece=''}piece+=ch}if(piece)parts.push(piece)
    }else parts.push(word);
    for(const w of parts){const candidate=line?line+' '+w:w;
     if(line&&measure.measureText(candidate).width>width){lines.push(line);line=w}else line=candidate;
    }
   }
   if(line)lines.push(line);
   return lines.length?lines:['–'];
  }
  const appendix=Array.isArray(d.performedWork)&&d.invoiceType==='final'?d.performedWork:[];
  const compactFinal=d.kind==='invoice'&&d.invoiceType==='final'&&appendix.length>0;
  // Compact AK descriptions for the invoice. Full original notes remain in stored AKs.
  function shortWork(w){
   const raw=String(w.workDone||'').trim().replace(/\s+/g,' ');
   const service=String(w.service||'').trim();
   if(!raw||raw.toLocaleLowerCase('de-DE')===service.toLocaleLowerCase('de-DE'))return '';
   let parts=raw.split(/\s*\|\s*/).map(x=>x.trim()).filter(Boolean);
   if(parts.length>1){
    if(parts[0].toLocaleLowerCase('de-DE')===service.toLocaleLowerCase('de-DE'))parts.shift();
    return parts.map(x=>x.split(/\s*·\s*/).slice(0,2).join(' · ')).join(' · ');
   }
   return raw;
  }
  const detailItems=appendix.flatMap(w=>{
   const title=wrapDetail('AK '+w.akNumber+' · '+formatPdfDate(w.date)+' · '+String(w.service||''),1065,'bold 22px Arial');
   const detail=wrapDetail(String(w.workDone||'Leistung gemäß Arbeitskarte ausgeführt'),1060,'20px Arial');
   const status=wrapDetail('Vereinbart: '+euros(w.net)+' netto · '+(w.priorInvoice?'Bereits abgerechnet: '+w.priorInvoice:'Mit dieser Schlussrechnung abgerechnet')+(w.employee?' · '+w.employee:''),1060,'19px Arial');
   // Eine umfangreiche Leistungsbeschreibung darf niemals abgeschnitten werden.
   const available=Math.max(31,1150-35*title.length-30*status.length-30);
   const maxLines=Math.max(1,Math.floor(available/31));
   const blocks=[];
   for(let i=0;i<detail.length;i+=maxLines){
    const chunk=detail.slice(i,i+maxLines);
    blocks.push({work:w,title,detail:chunk,status,
     height:35*title.length+31*chunk.length+30*status.length+30});
   }
   return blocks;
  });
  const detailPages=[];let page=[],used=0;
  for(const item of detailItems){
   if(item.height>1190)throw Error('Arbeitskarte enthält zu viele Kopfzeilen für den PDF-Leistungsnachweis');
   if(page.length&&used+item.height>1190){detailPages.push(page);page=[];used=0}
   page.push(item);used+=item.height;
  }
  if(page.length)detailPages.push(page);
  // Separater, übersichtlicher Abrechnungsnachweis; die detaillierte AK-Anlage bleibt erhalten.
  const overviewPages=[];
  if(d.invoiceType==='final'&&d.kind==='invoice'&&appendix.length){
   const chunks=(items,max)=>{for(let i=0;i<items.length;i+=max)overviewPages.push({type:items===appendix?'work':'prior',items:items.slice(i,i+max),start:i})};
   const previous=Array.isArray(d.precedingInvoices)?d.precedingInvoices:[];
   if(previous.length)chunks(previous,18);
   chunks(appendix,18);
  }
  function render(pageIndex,rows,pageCount,workItems=null,overview=null){
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
   c.fillText(workItems?'LEISTUNGSNACHWEIS':d.kind==='quote'?'KOSTENVORANSCHLAG':d.invoiceType==='final'?(d.finalizedAt?'SCHLUSSRECHNUNG':'SCHLUSSRECHNUNGSENTWURF'):Number(d.sourceVisitCount)>1?(d.finalizedAt?'TEILRECHNUNG':'TEILRECHNUNGSENTWURF'):(d.finalizedAt?'RECHNUNG':'RECHNUNGSENTWURF'),455,91);
   c.fillStyle=muted;c.font='20px Arial';c.fillText((d.finalizedAt?'Seite ':'Entwurf zur Prüfung  ·  Seite ')+(pageIndex+1)+' von '+pageCount,458,133);
   c.strokeStyle='#c7d8e9';c.lineWidth=2;c.beginPath();c.moveTo(70,199);c.lineTo(1170,199);c.stroke();
   if(overview){
    let y=249;
    c.fillStyle=blue;c.font='bold 29px Arial';c.fillText('Abrechnungsübersicht zur Schlussrechnung',70,y);y+=45;
    c.fillStyle=muted;c.font='19px Arial';c.fillText('Auftrag '+(d.sourceQuoteNumber||'–')+' · alle Beträge beziehen sich auf Rechnungen, nicht auf Zahlungseingänge.',70,y);y+=42;
    c.fillStyle='#eaf3fd';c.fillRect(70,y-23,1100,50);
    c.fillStyle=blue;c.font='bold 21px Arial';
    if(overview.type==='prior'){
     c.fillText('Bereits ausgestellte Teilrechnungen',82,y+8);y+=65;
     c.font='bold 19px Arial';c.fillStyle=dark;
     c.fillText('Rechnungsnummer',85,y);c.fillText('Datum',495,y);c.fillText('Netto',760,y);c.fillText('Brutto',982,y);y+=31;
     for(const invoice of overview.items){
      c.fillStyle='#f5f9ff';c.fillRect(70,y-25,1100,46);
      c.fillStyle=dark;c.font='19px Arial';
      c.fillText(String(invoice.number||'–'),85,y,380);
      c.fillText(formatPdfDate(invoice.date)||String(invoice.date||'–'),495,y);
      c.fillText(euros(invoice.net||0),750,y);
      c.fillText(euros(invoice.gross||0),972,y);y+=53;
     }
    }else{
     c.fillText('Ausgeführte Arbeitskarten ('+appendix.length+')',82,y+8);y+=65;
     c.font='bold 19px Arial';c.fillStyle=dark;
     c.fillText('AK',85,y);c.fillText('Datum',202,y);c.fillText('Leistung',398,y);c.fillText('Netto',785,y);c.fillText('Abgerechnet über',949,y);y+=31;
     for(const work of overview.items){
      c.fillStyle='#f5f9ff';c.fillRect(70,y-25,1100,46);
      c.fillStyle=dark;c.font='18px Arial';
      c.fillText('AK '+work.akNumber,85,y,105);
      c.fillText(formatPdfDate(work.date),202,y,176);
      c.fillText(String(work.service||'–'),398,y,355);
      c.fillText(euros(work.net||0),785,y,145);
      c.fillText(String(work.priorInvoice||'Jetzt'),949,y,210);y+=53;
     }
    }
    c.strokeStyle='#d0e2f1';c.beginPath();c.moveTo(70,1490);c.lineTo(1170,1490);c.stroke();
    c.fillStyle=dark;c.font='20px Arial';
    const oldGross=(Array.isArray(d.precedingInvoices)?d.precedingInvoices:[])
      .reduce((sum,i)=>sum+Math.round(Number(i.gross||0)*100),0)/100;
    c.fillText('Auftragswert: '+euros(oldGross+Number(d.gross||0))+' brutto',75,1530);
    c.fillText('Bereits abgerechnet: '+euros(oldGross)+' brutto',75,1564);
    c.fillStyle=blue;c.font='bold 21px Arial';
    c.fillText('Diese Schlussrechnung: '+euros(d.gross)+' brutto',75,1600);
    c.fillStyle=muted;c.font='17px Arial';
    c.fillText('Bereits fakturierte Leistungen werden nicht erneut berechnet.',75,1650);
    return encodeCanvas(canvas);
   }
   if(workItems){
    let y=245;
    c.font='bold 26px Arial';c.fillStyle=blue;c.fillText('Ausgeführte Arbeiten – Anlage zur Schlussrechnung '+d.number,70,y);y+=46;
    c.font='20px Arial';c.fillStyle=muted;c.fillText('Angenommenes Angebot: '+(d.sourceQuoteNumber||'–')+' · '+appendix.length+' Arbeitskarten',70,y);y+=49;
    for(const item of workItems){
     c.fillStyle='#eef5fd';c.fillRect(66,y-24,1110,item.height-2);
     c.fillStyle=dark;c.font='bold 22px Arial';
     for(const line of item.title){c.fillText(line,82,y);y+=35}
     c.font='20px Arial';for(const line of item.detail){c.fillText(line,82,y);y+=31}
     c.fillStyle=item.work.priorInvoice?'#52677b':'#135389';c.font='19px Arial';
     for(const line of item.status){c.fillText(line,82,y);y+=30}
     y+=30;
    }
    c.strokeStyle='#b8d1e6';c.beginPath();c.moveTo(70,1548);c.lineTo(1170,1548);c.stroke();
    c.fillStyle=blue;c.font='bold 20px Arial';
    c.fillText('Auftrag: '+euros(d.orderNetTotal||d.net)+' netto',72,1584);
    c.fillText('Bereits berechnet: '+euros(d.alreadyInvoicedNet||0)+' netto',72,1616);
    c.fillText('Diese Schlussrechnung: '+euros(d.net)+' netto',72,1648);
    c.font='18px Arial';c.fillStyle=muted;c.fillText('Ausgestellte Teilrechnungen werden nicht erneut berechnet.',610,1648);
    return encodeCanvas(canvas);
   }
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
    for(let i=0;i<4;i++){
     if(compactFinal){
      const l=left[i],r=i===2&&right[i]===right[0]?'':right[i];
      if(!l&&!r)continue;
      y+=Math.max(l?write(l,70,y,490):0,r?write(r,670,y,490):0,29);
     }else y+=Math.max(write(left[i]||'',70,y,490),write(right[i]||'',670,y,490),29);
    }
    y=Math.max(y+35,420);
    write('Nr.: '+d.number,70,y,490,'bold 24px Arial');write('Datum: '+formatPdfDate(d.date),700,y,470,'23px Arial');y+=45;
    write('Leistungszeitraum: '+(formatPdfDate(d.serviceDate)||'bitte ergänzen'),70,y,1050);y+=42;
    if(!compactFinal){write('Arbeitskarte: '+(d.orderNumber||'keine'),70,y,1100);y+=42;}
    if(d.kind==='invoice'&&d.sourceQuoteNumber){
     if(compactFinal)y+=write('Angebot: '+d.sourceQuoteNumber,70,y,1090,'20px Arial');
     else{
      y+=write('Angebot: '+d.sourceQuoteNumber+(d.invoiceType==='final'?' · Schlussrechnung über offene Restleistungen':Number(d.sourceVisitCount)>1?' · Teilrechnung '+d.sourceVisitNumber+' von '+d.sourceVisitCount:' · vollständig abgerechneter Einsatz'),70,y,1090,'20px Arial');
      if(d.invoiceType==='final')y+=write('Auftrag gesamt netto: '+euros(d.orderNetTotal||d.net)+' · vorher berechnet netto: '+euros(d.alreadyInvoicedNet||0)+' · jetzt netto: '+euros(d.net),70,y,1090,'20px Arial');
     }
    }
    if(d.kind==='quote'&&d.formValues?.PlanDate){
     const plan=d.formValues;
     const cadence=plan.PlanRhythm==='1'?'täglich':plan.PlanRhythm==='14'?'alle 2 Wochen':'wöchentlich';
     y+=write('Wunschtermin: '+formatPdfDate(plan.PlanDate)+' · '+(plan.PlanStart||'–')+'–'+(plan.PlanEnd||'–')+' Uhr',70,y,1090,'20px Arial');
     if(Number(d.calculation?.visits)>1)y+=write('Geplant: '+d.calculation.visits+' Einsätze, '+cadence+' · verbindlich erst nach Annahme',70,y,1090,'20px Arial');
    }
    if(!compactFinal)y+=write(d.service,70,y,1080,'bold 25px Arial');
   }else{
    write('Nr.: '+d.number+'  ·  '+d.customerName,70,y,1080,'bold 25px Arial');
    y+=62;
   }
   y+=20;
   c.fillStyle='#e9f2fc';c.fillRect(70,y-10,1100,52);
   write(compactFinal?'AK · Datum · Leistung':'Leistung',85,y+23,660,'bold 21px Arial',blue);
   write(compactFinal?'Abgerechnet':'Menge',780,y+23,160,'bold 21px Arial',blue);
   write(compactFinal?'Netto':'Gesamt',1010,y+23,170,'bold 21px Arial',blue);y+=65;
   for(const row of rows){
    c.fillStyle='#f4f7fc';c.fillRect(70,y-6,1100,82);
    if(compactFinal){
     c.font='bold 20px Arial';c.fillStyle=dark;c.fillText(row.title,84,y+22,675);
     if(row.detail){c.font='17px Arial';c.fillText(row.detail,84,y+52,680)}
     c.font='18px Arial';c.fillText(row.quantity,780,y+22,205);
    }else{
     write(row.title,84,y+22,670,'21px Arial');
     write(row.quantity+' '+row.unit,777,y+22,170,'20px Arial');
    }
    write(euros(row.total),1005,y+22,170,'bold 20px Arial');y+=88;
   }
   if(pageIndex===standardPageCount-1){
    if(compactFinal){
     y+=16;
     y+=write('Auftragswert netto: '+euros(d.orderNetTotal??d.net),70,y,610,'20px Arial');
     y+=write('Bereits in Rechnung gestellt: − '+euros(d.alreadyInvoicedNet||0),70,y,610,'20px Arial');
    }
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
    if(!compactFinal)y+=write(d.notes||'Leistungsumfang und Konditionen vor Versand überprüfen.',70,y+12,1075,'20px Arial');
   }
   c.fillStyle=muted;c.font='19px Arial';c.fillText((d.finalizedAt?'Rechnung – Versand nicht automatisch bestätigt':'Entwurf – nicht automatisch versendet')+' · '+new Date().toLocaleDateString('de-DE'),70,H-65);
   if(d.kind==='invoice'&&!d.finalizedAt){
    c.save();c.translate(285,1480);c.rotate(-Math.PI/11);
    c.fillStyle='rgba(170,25,25,.16)';c.font='bold 115px Arial';c.fillText('ENTWURF',0,0);c.restore();
   }
   return encodeCanvas(canvas);
  }
  // Finale Rechnung: alle AK direkt auf der Rechnung, frühere Teilrechnungen nur als Abzug.
  const displayRows=compactFinal?appendix.map(w=>({
   title:'AK '+w.akNumber+' · '+formatPdfDate(w.date)+' · '+String(w.service||'Reinigung'),
   detail:shortWork(w),quantity:String(w.priorInvoice||'Diese Rechnung'),
   unit:'',total:Number(w.net||0)
  })):d.rows;
  const allPages=[];
  for(let start=0;start<displayRows.length;start+=(compactFinal?5:6))allPages.push(displayRows.slice(start,start+(compactFinal?5:6)));
  if(!allPages.length)allPages.push([]);
  if(!compactFinal&&allPages[allPages.length-1].length>4)allPages.push([]);
  const standardPageCount=allPages.length;
  const pageCount=standardPageCount+(compactFinal?0:overviewPages.length+detailPages.length);
  // PDF-Vorschau und Export verwenden denselben Renderer.
  if(options.firstPageImage===true)return new Blob([render(0,allPages[0],pageCount)],{type:'image/jpeg'});
  allPages.forEach((rows,index)=>jpgs.push(render(index,rows,pageCount)));
  if(!compactFinal){
   overviewPages.forEach((item,i)=>jpgs.push(render(standardPageCount+i,[],pageCount,null,item)));
   detailPages.forEach((items,i)=>jpgs.push(render(standardPageCount+overviewPages.length+i,[],pageCount,items)));
  }
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
 return {compute,validateDocument,createDocument,pdf,previewImage:d=>pdf(d,{firstPageImage:true}),euro,formatPdfDate};
});
