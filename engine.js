/* Geometry: supplied Расчет ALL конструкций.xlsx; bead joints: user's rule.
 * Packing strategy: independent decimal-safe adaptation of lineynyy-raskroy. */
(function(global){
'use strict';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const snap=n=>Math.round(n*2)/2;
const presets={
 window:{name:'Оконный 36 / 68',frame:36,sash:68,impost:36,threshold:14,bead:22,overlap:6,glassGap:7},
 door:{name:'Дверной 46,5 / 66,5',frame:46.5,sash:66.5,sashZ:68.7,impost:36,threshold:14,bead:22,overlap:0,glassGap:7},
 facade:{name:'Фасадный 50',frame:50,sash:68,impost:50,threshold:14,bead:22,overlap:0,glassGap:7}
};
function make(type,id,number){return {id,type,number:String(number),title:{window:'Окно',door:'Дверь',facade:'Фасад'}[type]+' '+number,w:type==='window'?1000:type==='door'?1080:1440,h:type==='window'?1400:type==='door'?2345:2380,profile:{...presets[type]},quantity:1,selected:1,next:2,facadeFrame:false,doorLeaves:1,workingSide:'left',passiveSpan:870,facadeGrid:{posts:[],rails:[],fills:{},openBottom:[]},tree:{id:1,sash:type==='door',hand:'left',scissors:'normal'}};}
function find(n,id){return n.id===id?n:n.a?(find(n.a,id)||find(n.b,id)):null;}
function node(d,id){return d.type==='facade'?[...d.facadeGrid.posts,...d.facadeGrid.rails].find(n=>n.id===id):find(d.tree,id);}
function anchor(d){if(d.type!=='facade')for(const b of calculate(d).bars)if(!Number.isFinite(b.n.position))b.n.position=b.axisPosition;}
function move(d,id,position){anchor(d);const n=node(d,id);if(!n||!Number.isFinite(position))return false;const old=n.position;if(d.type==='facade'){const bound=id=>id==='left'?0:id==='right'?d.w:d.facadeGrid.posts.find(p=>p.id===id)?.position;const peers=(n.axis==='v'?d.facadeGrid.posts:d.facadeGrid.rails.filter(r=>Math.max(bound(r.left),bound(n.left))<Math.min(bound(r.right),bound(n.right)))).filter(r=>r.id!==id);if(peers.some(r=>(r.position-old)*(r.position-position)<=0))return false;}
 const linked=d.type==='door'&&d.doorLeaves===2&&n.axis==='h'?calculate(d).bars.filter(b=>b.n.axis==='h'&&Math.abs(b.axisPosition-old)<.01).map(b=>b.n):[n];const previous=linked.map(n=>n.position);linked.forEach(n=>n.position=snap(position));if(calculate(d).errors.length){linked.forEach((n,i)=>n.position=previous[i]);return false;}return true;}
// Magnetic alignment is used only for pointer dragging, never numeric dimensions.
function moveSnapped(d,id,position,tolerance=100){
 const model=calculate(d),target=model.bars.find(b=>b.n.id===id);if(!target)return false;
 const vertical=target.n.axis==='v',along=vertical?'y':'x',span=vertical?'h':'w';
 const peers=model.bars.filter(b=>b.n.id!==id&&b.n.axis===target.n.axis&&Math.abs(b.axisPosition-position)<=tolerance&&Math.min(b.bar[along]+b.bar[span],target.bar[along]+target.bar[span])-Math.max(b.bar[along],target.bar[along])<=.01&&!(d.type==='door'&&d.doorLeaves===2&&target.n.axis==='h'&&Math.abs(b.axisPosition-target.axisPosition)<.01));
 const axes=[...new Set(peers.map(b=>b.axisPosition))].sort((a,b)=>Math.abs(a-position)-Math.abs(b-position));
 for(const axis of axes)if(move(d,id,axis))return true;
 return move(d,id,position);
}
function moveJoint(d,position){if(d.type!=='door'||d.doorLeaves!==2||!Number.isFinite(position))return false;anchor(d);const old=d.passiveSpan,joint=calculate(d).doorJoint;d.passiveSpan=snap(old+(snap(position)-joint.position)*(d.workingSide==='left'?-1:1));if(calculate(d).errors.length){d.passiveSpan=old;return false;}return true;}
function addDivider(d,axis){
 anchor(d);const m=calculate(d),g=m.sections.find(g=>g.n.id===d.selected)||m.sections[0];
 if(d.type==='facade'){const id=d.next++;if(axis==='v')d.facadeGrid.posts.push({id,axis,position:snap(g.inner.x+g.inner.w/2)});else d.facadeGrid.rails.push({id,axis,position:snap(g.inner.y+g.inner.h/2),left:g.leftBound,right:g.rightBound});return;}
 const n=find(d.tree,g.n.id);if(n.axis)return;const position=snap(axis==='v'?g.inner.x+g.inner.w/2:g.inner.y+g.inner.h/2);
 const targets=d.type==='door'&&d.doorLeaves===2&&axis==='h'?m.sections.filter(s=>!s.n.axis&&s.inner.y<position&&s.inner.y+s.inner.h>position):[g];
 for(const target of targets){const n=target.n;n.axis=axis;n.position=position;n.ratio=.5;n.a={id:d.next++,sash:false};n.b={id:d.next++,sash:false};}d.selected=n.a.id;
}
function setDoorLeaves(d,count){if(count===d.doorLeaves)return;d.doorLeaves=count;d.next=4;d.selected=count===2?2:1;d.tree=count===2?{id:1,doorPair:true,a:{id:2,sash:true,leaf:'working'},b:{id:3,sash:true,leaf:'passive'}}:{id:1,sash:true,hand:d.workingSide};d.passiveSpan=Math.min(870,d.w/2);}
function facade(d){
 const p=d.profile.frame,grid=d.facadeGrid,sections=[],bars=[],parts=[],errors=[];
 if(![d.w,d.h,p].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(d.quantity)||d.quantity<1)errors.push('Проверьте размеры фасада и количество.');
 const posts=[...grid.posts].sort((a,b)=>a.position-b.position),xs=[{id:'left',position:0},...posts,{id:'right',position:d.w}],lookup=id=>xs.find(x=>x.id===id)?.position;
 const part=(length,detail)=>{if(length>0)parts.push({role:'profile',length:round(length),qty:d.quantity,cut:'90°',detail,source:d.title,sourceId:d.id,group:['facade','profile',p,'90°'].join('|'),profileWidth:p,type:'facade',number:d.number||d.title.split(' ').slice(1).join(' '),copies:d.quantity,perCopy:1});};
 part(d.h,'Левая стойка');part(d.h,'Правая стойка');
 for(const n of posts){if(!Number.isFinite(n.position))errors.push('Некорректная отметка стойки.');bars.push({n,bar:{x:n.position-p/2,y:0,w:p,h:d.h},inner:{x:p,y:0,w:d.w-2*p,h:d.h},axisPosition:n.position,length:d.h});part(d.h,'Стойка '+n.id);}
 for(let i=0;i<xs.length-1;i++){
  const a=xs[i],b=xs[i+1],x=a.id==='left'?p:a.position+p/2,right=b.id==='right'?d.w-p:b.position-p/2,w=right-x;
  const rails=grid.rails.filter(n=>{const l=lookup(n.left),r=lookup(n.right);return x+w/2>l&&x+w/2<r;}).sort((a,b)=>a.position-b.position);
  const ys=[{id:'top',position:0},...rails,{id:'bottom',position:d.h}];
  if(w<=30)errors.push('Стойка не может пересекать соседнюю стойку или край фасада.');
  const openBottom=(grid.openBottom||[]).includes(a.id+'|'+b.id);part(w,'Верхний ригель · пролёт '+(i+1));if(!openBottom)part(w,'Нижний ригель · пролёт '+(i+1));
  for(const n of rails){bars.push({n,bar:{x,y:n.position-p/2,w,h:p},inner:{x,y:p,w,h:d.h-2*p},axisPosition:n.position,length:w});part(w,'Ригель '+n.id+' · пролёт '+(i+1));}
  for(let j=0;j<ys.length-1;j++){const c=ys[j],e=ys[j+1],y=c.id==='top'?p:c.position+p/2,bottom=e.id==='bottom'?d.h-(openBottom?0:p):e.position-p/2,h=bottom-y;if(h<=30)errors.push('Ригель не может пересекать соседний ригель или край фасада.');const cellId=`cell-${a.id}-${b.id}-${c.id}-${e.id}`,doorOpening=openBottom&&e.id==='bottom',inserted=doorOpening||grid.fills?.[cellId]==='frame';sections.push({n:{id:cellId,sash:false},bottomBound:e.id,doorOpening,inserted,insertFrame:inserted?{w:round(w-6),h:round(h-(doorOpening?4:6))}:null,r:{x,y,w,h},inner:{x,y,w,h},outer:null,leftBound:a.id,rightBound:b.id,glass:{w:round(w+25),h:round(h+25)},depth:0});}
 }
 return {sections,bars,parts,errors:[...new Set(errors)],opening:{x:p,y:p,w:d.w-2*p,h:d.h-2*p}};
}
function drives(w,h,scissors='normal'){if(scissors==='transom')return {left:round(w/2-135),right:round(w/2-135)};return {lower:round(h/2-201),upper:round(h/2-196),horizontal:round(w-(scissors==='short'?378:468))};}
function hinges(h){const marks=[160,h-549,h-249];if(h>2200)marks.splice(1,0,160+(h-549-160)/2);return marks.map(snap).filter((v,i,a)=>v>0&&v<h&&a.indexOf(v)===i).sort((a,b)=>a-b);}
function frameSizes(d){return {opening:{w:round(d.w+6),h:round(d.h+(d.type==='door'?4:6))},saw:{w:round(d.w+30),h:round(d.h+(d.type==='door'?15:30))}};}
function rename(d,value){d.number=String(value).trim();d.title={window:'Окно',door:'Дверь',facade:'Фасад'}[d.type]+' '+d.number;}
function cutKey(p,stock){return [p.role==='impost'?'shared':p.type,p.role,p.profileWidth,p.cut,p.role==='frame'&&p.facadeFrame?'facade':'ordinary',stock].join('|');}
function setFacadeFill(d,id,frame){const g=calculate(d).sections.find(g=>g.n.id===id);if(!g)return false;d.facadeGrid.fills??={};d.facadeGrid.fills[id]=frame?'frame':'glass';return true;}
function setBottom(d,id,open){const g=calculate(d).sections.find(g=>g.n.id===id);if(!g||g.bottomBound!=='bottom')return false;const grid=d.facadeGrid,key=g.leftBound+'|'+g.rightBound;grid.openBottom??=[];grid.openBottom=grid.openBottom.filter(k=>k!==key);if(open)grid.openBottom.push(key);return true;}
function removeDivider(d,id){
 anchor(d);const saved=JSON.parse(JSON.stringify(d)),m=calculate(d),bar=m.bars.find(b=>b.n.id===id);if(!bar)return false;
 if(d.type==='facade'){
  const grid=d.facadeGrid,n=node(d,id);
  if(n.axis==='v'){const posts=[{id:'left',position:0},...grid.posts.slice().sort((a,b)=>a.position-b.position),{id:'right',position:d.w}],i=posts.findIndex(p=>p.id===id),l=posts[i-1].id,r=posts[i+1].id;grid.posts=grid.posts.filter(p=>p.id!==id);for(const rail of grid.rails){if(rail.left===id)rail.left=l;if(rail.right===id)rail.right=r;}grid.rails=grid.rails.filter((a,i,rs)=>rs.findIndex(b=>b.left===a.left&&b.right===a.right&&b.position===a.position)===i);grid.openBottom=(grid.openBottom||[]).filter(k=>!k.split('|').includes(String(id)));}
  else grid.rails=grid.rails.filter(n=>n.id!==id);
  // Keep frame insert choices for unaffected cells; new merged cells start as glass.
 }else{
  const targets=d.type==='door'&&d.doorLeaves===2&&bar.n.axis==='h'?m.bars.filter(b=>b.n.axis==='h'&&b.axisPosition===bar.axisPosition).map(b=>b.n):[bar.n];
  function merge(a,b,axis){if(!a.axis)return b;if(!b.axis)return a;if(a.axis===axis){a.b=merge(a.b,b,axis);return a;}if(b.axis===axis){b.a=merge(a,b.a,axis);return b;}if(a.position===b.position){a.a=merge(a.a,b.a,axis);a.b=merge(a.b,b.b,axis);return a;}if(a.position<b.position){a.b=merge(a.b,b,axis);return a;}b.a=merge(a,b.a,axis);return b;}
  for(const n of targets){const keep=merge(n.a,n.b,n.axis),id=n.id,meta={sash:n.sash,leaf:n.leaf,hand:n.hand,scissors:n.scissors};for(const k of Object.keys(n))delete n[k];Object.assign(n,keep,meta,{id});}
 }
 const result=calculate(d);if(result.errors.length){Object.assign(d,saved);return false;}d.selected=result.sections.find(g=>!g.n.axis)?.n.id;return true;
}
function calculate(d){
 if(d.type==='facade')return facade(d);
 const p=d.profile,sections=[],bars=[],parts=[],errors=[];
 if(![d.w,d.h,p.frame,p.sash,p.impost,p.threshold,p.bead].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(d.quantity)||d.quantity<1||d.quantity>100)errors.push('Размеры должны быть положительными, количество — от 1 до 100.');
 const part=(role,length,qty=1,cut='90°',detail='')=>{if(length>0)parts.push({role,length:round(length),qty:qty*d.quantity,cut,detail,source:d.title,sourceId:d.id,type:d.type,profileWidth:p[role],group:[d.type,role,p[role],cut,d.facadeFrame?'facade-frame':'ordinary'].join('|'),blocked:null,facadeFrame:!!d.facadeFrame,number:d.number||d.title.split(' ').slice(1).join(' '),copies:d.quantity,perCopy:qty});};
 const opening={x:p.frame,y:p.frame,w:d.w-2*p.frame,h:d.h-p.frame-(d.type==='door'?p.threshold:p.frame)};
 part('frame',d.w+(d.facadeFrame?30:0),d.type==='door'?1:2,'45°','Горизонтальный профиль');part('frame',d.h+(d.facadeFrame?(d.type==='door'?15:30):0),2,'45°','Вертикальный профиль');if(d.type==='door')part('threshold',opening.w-1,1,'90°','Порог');
 function visit(n,r,depth=0,hasSash=false,forcedOuter=null,sashBounds=null){
  const outer=forcedOuter||(n.sash?(d.type==='door'?{x:r.x+5,y:snap(r.y+.25),w:r.w-10,h:r.h-.5}:{x:r.x-p.overlap,y:r.y-p.overlap,w:r.w+2*p.overlap,h:r.h+2*p.overlap}):null);
  const inner=outer?{x:outer.x+p.sash,y:outer.y+p.sash,w:outer.w-2*p.sash,h:outer.h-2*p.sash}:r;
  const reference=outer||sashBounds;const g={n,r,outer,inner,reference,depth,hasSash:hasSash||n.sash};sections.push(g);
  if(inner.w<=2*p.bead||inner.h<=2*p.bead)errors.push('В секции недостаточно места для профилей и штапиков.');
  if(outer){const role=n.leaf==='passive'?'sashZ':'sash';part(role,outer.w,2,'45°','Секция '+n.id+' · горизонтальный');part(role,outer.h,2,'45°','Секция '+n.id+' · вертикальный');if(d.type==='window')g.drives=drives(outer.w,outer.h,n.scissors);}
  if(n.axis){
   const v=n.axis==='v',pos=Number.isFinite(n.position)?n.position-(v?inner.x:inner.y):(v?inner.w:inner.h)*n.ratio;
   if(!Number.isFinite(pos)||pos<=0||pos>=(v?inner.w:inner.h))errors.push('Импост должен находиться между соседними профилями.');
   const bar=v?{x:inner.x+pos-p.impost/2,y:inner.y,w:p.impost,h:inner.h}:{x:inner.x,y:inner.y+pos-p.impost/2,w:inner.w,h:p.impost};
   bars.push({n,bar,inner,reference,length:v?bar.h:bar.w,axisPosition:v?bar.x+bar.w/2:bar.y+bar.h/2});
   part('impost',v?bar.h:bar.w,1,'90°','Секция '+n.id);
   const a=v?{x:inner.x,y:inner.y,w:pos-p.impost/2,h:inner.h}:{x:inner.x,y:inner.y,w:inner.w,h:pos-p.impost/2};
   const b=v?{x:inner.x+pos+p.impost/2,y:inner.y,w:inner.w-pos-p.impost/2,h:inner.h}:{x:inner.x,y:inner.y+pos+p.impost/2,w:inner.w,h:inner.h-pos-p.impost/2};
   visit(n.a,a,depth+1,g.hasSash,null,reference);visit(n.b,b,depth+1,g.hasSash,null,reference);
  }else{
   g.glass={w:round(inner.w+(d.type==='facade'?25:-2*p.glassGap)),h:round(inner.h+(d.type==='facade'?25:-2*p.glassGap))};
   g.bead={w:round(inner.w),h:round(inner.h-2*p.bead)};part('bead',g.bead.w,2,'90°','Секция '+n.id+' · горизонтальный');part('bead',g.bead.h,2,'90°','Секция '+n.id+' · вертикальный');
  }
 }
 if(d.type==='door'&&d.doorLeaves===2){
  // Workbook cells G48 and N48. Z has its own article/stock, while the workbook
  // uses the T effective sightline (AF29) for both infill calculations.
  const passive=d.passiveSpan-p.frame-23.5,working=d.w-d.passiveSpan-p.frame+28.5,h=opening.h-.5;
  if(passive<=2*p.sash||working<=2*p.sash)errors.push('Недостаточная ширина одной из дверных створок.');
  const left=d.workingSide==='left';const work={x:left?p.frame+5:d.w-p.frame-5-working,y:snap(opening.y+.25),w:working,h};
  const pass={x:left?d.w-p.frame-5-passive:p.frame+5,y:snap(opening.y+.25),w:passive,h};
  visit(d.tree.a,work,0,false,work);visit(d.tree.b,pass,0,false,pass);
 }else visit(d.tree,opening);
 const passive=sections.find(g=>g.n.leaf==='passive')?.outer;
 const doorJoint=passive?{position:d.workingSide==='left'?passive.x:passive.x+passive.w,y:passive.y,h:passive.h}:null;
 return {sections,bars,parts,opening,doorJoint,errors:[...new Set(errors)]};
}
function cut(parts,stock,kerf,mode='standard',restMin=50,restMax=300){
 if(!Number.isFinite(stock)||stock<=0||!Number.isFinite(kerf)||kerf<0)throw Error('Проверьте длину хлыста и ширину пропила.');
 let remaining=[],rejected=[];
 for(const p of parts){if(p.length<=0||p.length>stock){rejected.push(p);continue;}for(let i=0;i<p.qty;i++){const instance=Math.floor(i/(p.perCopy||p.qty))+1;remaining.push({...p,instance,instanceLabel:p.number===undefined?p.source:p.number+((p.copies||1)>1?' ('+String(instance).padStart(2,'0')+')':'')});}}
 remaining.sort((a,b)=>b.length-a.length);
 if(remaining.length>2000)throw Error('Поддерживается до 2000 деталей одного профиля за расчёт.');
 const all=[...remaining],bars=[];
 if(mode==='desired'&&remaining.length){
  const gcd=(a,b)=>b?gcd(b,a%b):a;
  const unit=remaining.reduce((v,p)=>gcd(v,Math.round((p.length+kerf)*100)),Math.round((stock+kerf)*100))||1,capacity=Math.round((stock+kerf)*100/unit);
  if(capacity>200000)throw Error('Для таких дробных размеров выберите стандартный раскрой.');
  const low=Math.max(0,Math.min(restMin,restMax)),high=Math.max(low,restMin,restMax);
  while(remaining.length){
   const reachable=new Array(capacity+1);reachable[0]={index:-1,prev:null};
   remaining.forEach((p,index)=>{const weight=Math.round((p.length+kerf)*100/unit);for(let c=capacity-weight;c>=0;c--)if(reachable[c]&&!reachable[c+weight])reachable[c+weight]={index,prev:reachable[c]};});
   const start=Math.max(1,Math.ceil((stock+kerf-high)*100/unit)),end=Math.min(capacity,Math.floor((stock+kerf-low)*100/unit));let chosen=-1;
   for(let i=end;i>=start;i--)if(reachable[i]){chosen=i;break;}
   if(chosen<0)for(let i=end;i>=1;i--)if(reachable[i]){chosen=i;break;}
   if(chosen<0)for(let i=capacity;i>=1;i--)if(reachable[i]){chosen=i;break;}
   if(chosen<0)throw Error('Не удалось разместить детали.');
   const indices=new Set();for(let node=reachable[chosen];node&&node.index>=0;node=node.prev)indices.add(node.index);
   const selected=remaining.filter((_,i)=>indices.has(i)),used=round(selected.reduce((v,p)=>v+p.length,0)+Math.max(0,selected.length-1)*kerf);
   if(used>stock+.001||!selected.length)throw Error('Ошибка размещения деталей.');
   bars.push({cuts:selected,used,rest:round(stock-used)});remaining=remaining.filter((_,i)=>!indices.has(i));
  }
 }else for(const piece of remaining){let best=-1,smallest=Infinity;bars.forEach((bar,i)=>{const rest=round(stock-bar.used-piece.length-kerf);if(rest>=0&&rest<smallest){best=i;smallest=rest;}});if(best<0)bars.push({cuts:[piece],used:piece.length,rest:round(stock-piece.length)});else{const bar=bars[best];bar.cuts.push(piece);bar.used=round(bar.used+piece.length+kerf);bar.rest=round(stock-bar.used);}}
 const totalStock=bars.length*stock,partsLength=round(all.reduce((v,p)=>v+p.length,0));
 return {bars,rejected,totalStock,partsLength,kerfTotal:round(bars.reduce((v,b)=>v+Math.max(0,b.cuts.length-1)*kerf,0)),utilization:totalStock?partsLength/totalStock*100:0};
}
const api={snap,hinges,frameSizes,rename,cutKey,setFacadeFill,setBottom,removeDivider,presets,make,find,node,anchor,move,moveSnapped,moveJoint,addDivider,setDoorLeaves,drives,calculate,cut,round};if(typeof module!=='undefined')module.exports=api;else global.AluEngine=api;
})(typeof window==='undefined'?globalThis:window);
