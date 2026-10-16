(()=>{
'use strict';
const E=window.AluEngine;
async function download(blob,name){const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не удалось подготовить файл.'));reader.readAsDataURL(blob);});const a=document.querySelector('#file-download');a.href=url;a.download=name;a.textContent='Скачать '+name;a.hidden=false;a.click();}
function readProject(text){
 if(text.length>10000000)throw Error('Файл проекта слишком большой.');
 const data=JSON.parse(text);if(data.format!=='alu-project'||data.version!==1||!Array.isArray(data.docs)||!data.docs.length||data.docs.length>100)throw Error('Нужен файл проекта ALU версии 1, содержащий от 1 до 100 изделий.');
 const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const clean=(v,depth=0)=>{if(depth>60)throw Error('Слишком сложная структура изделия.');if(typeof v==='number'&&!Number.isFinite(v))throw Error('Некорректное число.');if(Array.isArray(v)){if(v.length>2000)throw Error('Слишком много элементов.');v.forEach(x=>clean(x,depth+1));}else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Некорректное поле проекта.');clean(x,depth+1);}};clean(data);
 const ids=new Set();const docs=data.docs.map(raw=>{if(!Object.hasOwn(E.presets,raw.type)||!Number.isInteger(raw.id)||raw.id<1||ids.has(raw.id)||!num(raw.w,1,100000)||!num(raw.h,1,100000)||!Number.isInteger(raw.quantity)||!num(raw.quantity,1,100)||!raw.tree||!raw.profile||!Number.isInteger(raw.next)||raw.next<2||![1,2].includes(raw.doorLeaves)||!['left','right'].includes(raw.workingSide))throw Error('Некорректные параметры изделия.');ids.add(raw.id);
  const d=E.make(raw.type,raw.id,1);for(const key of ['w','h','quantity','tree','selected','next','facadeFrame','doorLeaves','workingSide','passiveSpan','facadeGrid'])if(raw[key]!==undefined)d[key]=raw[key];
  for(const key of Object.keys(d.profile))if(raw.profile[key]!==undefined){if(key==='name'){d.profile.name=String(raw.profile.name).slice(0,100);continue;}if(!num(raw.profile[key],0,10000))throw Error('Некорректный размер профиля.');d.profile[key]=raw.profile[key];}
  const nodeIds=new Set();function tree(n){if(!n||!Number.isInteger(n.id)||nodeIds.has(n.id)||n.id<1||n.id>=d.next)throw Error('Некорректная секция изделия.');nodeIds.add(n.id);if(n.axis){if(!['v','h'].includes(n.axis))throw Error('Некорректная ось.');tree(n.a);tree(n.b);}}tree(d.tree);
  E.rename(d,String(raw.number??'1').slice(0,24));const result=E.calculate(d);if(result.errors.length)throw Error(d.title+': '+result.errors[0]);return d;
 });
 if(!Array.isArray(data.stocks)||data.stocks.length>2000)throw Error('Некорректный список профилей.');
 const stocks=data.stocks.map(s=>{if(!E.presets[s.type]||!['frame','sash','sashZ','impost','bead','threshold','profile'].includes(s.role)||(s.width!==''&&!num(s.width,0.1,10000))||(s.length!==null&&!num(s.length,1,100000)))throw Error('Некорректный профиль для раскроя.');return {type:s.type,role:s.role,width:s.width,length:s.length};});
 const cutting=data.cutting||{};if(!num(cutting.kerf,0,100)||!num(cutting.restMin,0,100000)||!num(cutting.restMax,0,100000)||!['standard','desired'].includes(cutting.mode))throw Error('Некорректные настройки раскроя.');
 return {docs,stocks,cutting};
}
const shortType={window:'ок',door:'дв',facade:'ф'};
function partLabel(p){return shortType[p.type]+' '+(p.instanceLabel||String(p.source).replace(/^(Окно|Дверь|Фасад)\s+/,''));}
function glazing(docs){return docs.flatMap(d=>{const rows=new Map();for(const g of E.calculate(d).sections){if(g.n.axis||g.inserted||!g.glass)continue;const key=g.glass.w+'|'+g.glass.h;if(!rows.has(key))rows.set(key,{label:shortType[d.type]+' '+d.number,w:g.glass.w,h:g.glass.h,quantity:0});rows.get(key).quantity+=d.quantity;}return [...rows.values()];});}
function materials(d){const p=d.profile,fmt=n=>String(n).replace('.',',');const fields=d.type==='facade'?[['Профиль фасада','frame']]:[['Рама','frame'],['Створка','sash'],...(d.type==='door'&&d.doorLeaves===2?[['Створка Z','sashZ']]:[]),['Импост','impost'],['Штапик','bead'],...(d.type==='door'?[['Порог','threshold']]:[])];return fields.map(([name,key])=>name+' '+fmt(p[key])+' мм').join(' · ');}
function pdfBlob(images){
 const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
 const add=s=>{const b=typeof s==='string'?encoder.encode(s):s;chunks.push(b);length+=b.length;};
 const object=(id,s)=>{offsets[id]=length;add(id+' 0 obj\n');add(s);add('\nendobj\n');};
 add('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,'<< /Type /Pages /Kids ['+images.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+images.length+' >>');
 images.forEach((canvas,i)=>{const id=3+i*3,binary=atob(canvas.toDataURL('image/jpeg',.94).split(',')[1]),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),stream='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ';object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);object(id+1,`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);offsets[id+2]=length;add(`${id+2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);add(bytes);add('\nendstream\nendobj\n');});
 const start=length;add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const offset of offsets.slice(1))add(String(offset).padStart(10,'0')+' 00000 n \n');add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);return new Blob(chunks,{type:'application/pdf'});
}
async function makePdf(drawings,groups,glass=[]){
 const pages=[],W=794,H=1123;let canvas,ctx,y;
 function page(title){canvas=document.createElement('canvas');canvas.width=W*2;canvas.height=H*2;ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.fillStyle='#263744';ctx.font='bold 21px Arial';ctx.fillText(title,32,40);ctx.font='11px Arial';ctx.fillText('ALU · Размеры в мм',32,H-22);ctx.fillText(String(pages.length+1),W-44,H-22);pages.push(canvas);y=70;}
 function text(value,size=13,bold=false){ctx.font=(bold?'bold ':'')+size+'px Arial';const words=String(value).split(/\s+/);let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>W-64&&line){if(y>H-62)page('Раскрой · продолжение');ctx.fillText(line,32,y);y+=size+6;line=word;}else line=next;}if(y>H-62)page('Раскрой · продолжение');ctx.fillText(line,32,y);y+=size+6;}
 for(const d of drawings){page(d.title+' · '+d.quantity+' шт.');text(d.materials,13,true);y+=8;const image=new Image(),url=URL.createObjectURL(new Blob([d.svg],{type:'image/svg+xml'}));try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Не удалось подготовить чертёж для PDF.'));image.src=url;});const factor=Math.min((W-64)/d.width,Math.min(780,H-y-110)/d.height),height=d.height*factor,width=d.width*factor;ctx.drawImage(image,(W-width)/2,y,width,height);y+=height+20;}finally{URL.revokeObjectURL(url);}for(const h of d.hardware){if(y>H-90)page(d.title+' · фурнитура');text(h);}}
 page('Раскрой');for(const group of groups){if(y>H-170)page('Раскрой · продолжение');text(group.title,16,true);text(group.summary);for(const bar of group.bars){if(y>H-185){page('Раскрой · продолжение');text(group.title,16,true);}text(bar.title,12);let x=32;for(const piece of bar.pieces){const w=(W-64)*piece.ratio;ctx.fillStyle=piece.rest?'#e5eaed':'#259387';ctx.fillRect(x,y,w,26);ctx.strokeStyle='white';ctx.strokeRect(x,y,w,26);if(piece.text){ctx.fillStyle=piece.rest?'#263744':'white';ctx.font='10px Arial';if(ctx.measureText(piece.text).width+4<=w){ctx.fillText(piece.text,x+(w-ctx.measureText(piece.text).width)/2,y+17);}else{ctx.save();ctx.fillStyle='#263744';ctx.translate(x+w/2,y+30);ctx.rotate(Math.PI/2);ctx.fillText(piece.text,0,3);ctx.restore();}}x+=w;}ctx.fillStyle='#263744';y+=75;text(bar.caption,11);y+=10;}y+=14;}
 if(glass.length){page('Стеклопакеты');for(const g of glass)text('('+g.label+') '+String(g.w).replace('.',',')+' × '+String(g.h).replace('.',',')+' — '+g.quantity+' шт.');}
 return pdfBlob(pages);
}
window.AluFiles={download,readProject,makePdf,partLabel,glazing,materials};
})();
