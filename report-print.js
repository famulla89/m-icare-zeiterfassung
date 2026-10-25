'use strict';
/* Dedizierte PDF-Druckansicht für Reports: niemals die editierbare Oberfläche drucken. */
(function(root){
 function makeSnapshot(){
  document.getElementById('reportPrintSnapshot')?.remove();
  const $=id=>document.getElementById(id);
  const clone=document.createElement('section');clone.id='reportPrintSnapshot';
  const header=document.createElement('div');header.className='printReportHeader';
  const logo=document.createElement('img');logo.src='./logo.svg';logo.alt='M-iCare Gebäudereinigung';
  const heading=document.createElement('div');
  const h=document.createElement('h1');h.textContent=$('reportTitle').textContent;
  const date=document.createElement('p');date.textContent='Zeitraum: '+formatDate($('reportFrom').value)+' bis '+formatDate($('reportTo').value)+' · Erstellt: '+new Date().toLocaleDateString('de-DE');
  heading.append(h,date);header.append(logo,heading);clone.append(header);
  const filters=document.createElement('p');filters.className='printReportFilters';filters.textContent=$('reportActiveFilters').textContent;clone.append(filters);
  const summary=$('reportSummary').cloneNode(true);summary.removeAttribute('id');clone.append(summary);
  for(const panel of $('reportPanels').children){
   const copy=panel.cloneNode(true);copy.removeAttribute('id');
   if(copy.tagName==='BUTTON')continue;
   copy.querySelectorAll('button,input,select,textarea').forEach(x=>x.remove());
   const main=copy.querySelector('h3')?.textContent==='Arbeitskarten durchsuchen und direkt öffnen';
   if(main){
    copy.classList.add('printMainAK');
    // 13 Spalten -> 10. Korrekturhistorie wird in eigener Liste darunter gedruckt.
    for(const tr of copy.querySelectorAll('tr')){
     const cells=[...tr.children],keep=[0,1,2,3,4,5,6,7,8,11];
     cells.forEach((cell,i)=>{if(!keep.includes(i))cell.remove()});
     const conflict=cells[11];
     if(conflict){
      if(tr.closest('thead'))conflict.textContent='Konflikt';
      else{
       const summary=conflict.querySelector('summary')?.textContent||'';
       const count=Number(summary.match(/[0-9]+/)?.[0]||0);
       conflict.textContent=count>0?'Ja ('+count+')':'Nein';
      }
     }
    }
    copy.querySelector('h3').textContent='Arbeitskarten – Übersicht';
   }
   // Detail-Buttons sind fort, geöffnete Konflikthinweise bleiben als Klartext.
   copy.querySelectorAll('details').forEach(d=>d.open=true);
   clone.append(copy);
  }
  const footer=document.createElement('p');footer.className='printReportFooter';footer.textContent='M-iCare · Bericht aus den lokal vorhandenen Daten · keine interaktiven Aktionen';clone.append(footer);
  document.body.append(clone);return clone;
 }
 function makeStyle(){
  document.getElementById('reportPrintOnly')?.remove();
  const style=document.createElement('style');style.id='reportPrintOnly';
  style.textContent=[
  '#reportPrintSnapshot{display:none}',
  '@media print {',
  ' @page{size:A4 landscape;margin:31mm 12mm 12mm;',
  '  @top-left{content:"";background-image:url("./logo.svg");background-repeat:no-repeat;background-size:46mm auto;background-position:left center;width:49mm;height:27mm}',
  '  @top-right{content:"M-iCare Gebäudereinigung";font:bold 10pt Arial,sans-serif;color:#174b76}',
  ' }',
  ' html,body{background:#fff!important;color:#173047!important;width:auto!important;overflow:visible!important}',
  ' body>*:not(#reportPrintSnapshot){display:none!important}',
  ' body #reportPrintSnapshot{display:block!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;font:9pt/1.4 Arial,sans-serif;color:#1b334a}',
  ' #reportPrintSnapshot *{box-sizing:border-box}',
  ' #reportPrintSnapshot .printReportHeader{display:flex;align-items:center;gap:12mm;padding:0 0 4mm;border-bottom:1.5pt solid #2e6a9b;break-after:avoid}',
  ' #reportPrintSnapshot .printReportHeader img{display:none!important}',
  ' #reportPrintSnapshot h1{font-size:18pt!important;margin:0 0 3mm!important;color:#143e64}',
  ' #reportPrintSnapshot h2,#reportPrintSnapshot h3{font-size:11pt!important;margin:4mm 0 2mm!important;color:#143e64;break-after:avoid}',
  ' #reportPrintSnapshot .printReportHeader p,#reportPrintSnapshot .printReportFilters{margin:0 0 3mm!important;font-size:9pt!important;color:#42586d}',
  ' #reportPrintSnapshot .printReportFilters{padding-top:3mm}',
  ' #reportPrintSnapshot .objectPanel,#reportPrintSnapshot .status{border:0!important;box-shadow:none!important;margin:0 0 3mm!important;padding:0!important;background:white!important;overflow:visible!important;max-width:none!important}',
  ' #reportPrintSnapshot .reportMetrics{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:2.5mm!important}',
  ' #reportPrintSnapshot .reportMetric{background:#eaf2f9!important;border:1px solid #d3e1ee!important;border-radius:2mm!important;padding:2mm!important;min-height:0!important}',
  ' #reportPrintSnapshot .tablewrap{width:100%!important;overflow:visible!important;max-width:none!important}',
  ' #reportPrintSnapshot table{width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse!important;font-size:8pt!important}',
  ' #reportPrintSnapshot thead{display:table-header-group}',
  ' #reportPrintSnapshot tr{break-inside:avoid-page;page-break-inside:avoid}',
  ' #reportPrintSnapshot th,#reportPrintSnapshot td{padding:1.5mm 1.1mm!important;border-bottom:.5pt solid #dae5ee!important;white-space:normal!important;overflow-wrap:break-word!important;word-break:normal!important;vertical-align:top!important;line-height:1.3!important}',
  ' #reportPrintSnapshot th{background:#e7f0fa!important;font-weight:700}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(1),#reportPrintSnapshot .printMainAK td:nth-child(1){width:6%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(2),#reportPrintSnapshot .printMainAK td:nth-child(2){width:9%;white-space:nowrap!important}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(3),#reportPrintSnapshot .printMainAK td:nth-child(3){width:22%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(4),#reportPrintSnapshot .printMainAK td:nth-child(4){width:13%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(5),#reportPrintSnapshot .printMainAK td:nth-child(5){width:12%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(6),#reportPrintSnapshot .printMainAK td:nth-child(6){width:10%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(7),#reportPrintSnapshot .printMainAK td:nth-child(7),#reportPrintSnapshot .printMainAK th:nth-child(8),#reportPrintSnapshot .printMainAK td:nth-child(8){width:7%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(9),#reportPrintSnapshot .printMainAK td:nth-child(9){width:9%}',
  ' #reportPrintSnapshot .printMainAK th:nth-child(10),#reportPrintSnapshot .printMainAK td:nth-child(10){width:5%}',
  ' #reportPrintSnapshot button,#reportPrintSnapshot input,#reportPrintSnapshot select,#reportPrintSnapshot .actions{display:none!important}',
  ' #reportPrintSnapshot .printReportFooter{margin:5mm 0 0;color:#65788a;font-size:8pt}',
  ' #reportPrintSnapshot .reportBars{break-inside:avoid}',
  '}'
  ].join('\n');
  document.head.append(style);return style;
 }
 function prepare(){
  return {snapshot:makeSnapshot(),style:makeStyle()};
 }
 function print(){
  const {snapshot,style}=prepare();
  const done=()=>{snapshot.remove();style.remove();window.removeEventListener('afterprint',done)};
  window.addEventListener('afterprint',done);
  window.print();
 }
 root.MiCareReportPrint={prepare,print};
})(globalThis);
