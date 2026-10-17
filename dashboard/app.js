/* Dashboard Qoala Gadget Protection - vanilla JS, no deps. Works via file:// */
(function(){
"use strict";
var DATA = window.DASHBOARD_DATA || null;
var BLANK = "(Kosong)";
function clean(s){ if(s==="#-1"||s===""||s==null) return BLANK; return s; }
function isBlankEntry(s){ return s==="#-1"||s===""||s==null; }
function norm(s){ return String(s==null?"":s).trim().toLowerCase().replace(/\s+/g," "); }
function fmtInt(n){ return Math.round(n).toLocaleString("id-ID"); }
function fmtIDR(n){
  if(n==null||isNaN(n)) return "Rp 0";
  var a=Math.abs(n);
  if(a>=1e9) return "Rp "+(n/1e9).toLocaleString("id-ID",{maximumFractionDigits:2})+" M";
  if(a>=1e6) return "Rp "+(n/1e6).toLocaleString("id-ID",{maximumFractionDigits:2})+" jt";
  if(a>=1e3) return "Rp "+(n/1e3).toLocaleString("id-ID",{maximumFractionDigits:1})+" rb";
  return "Rp "+fmtInt(n);
}
function fmtPct(x){ if(!isFinite(x)) return "—"; var s=(x>=0?"+":"")+(x*100).toLocaleString("id-ID",{maximumFractionDigits:1}); return s+"%"; }
var MON=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
function ymLabel(ym){ var p=ym.split("-"); var m=+p[1]; return MON[m-1]+" "+p[0]; }
function daysInMonthOf(ym){ return new Date(+ym.slice(0,4), +ym.slice(5,7), 0).getDate(); }
function elapsedOf(){
  if(!DATA.targetMeta) return 0;
  var i=(DATA.months||[]).indexOf(DATA.targetMeta.month);
  var v=(i>=0&&DATA.monthLastDay)?DATA.monthLastDay[i]:0;
  if(!v) v=DATA.targetMeta.lastDay||0;
  if(!v) v=DATA.targetMeta.daysInMonth||daysInMonthOf(DATA.targetMeta.month);
  return v||0;
}
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function $(id){ return document.getElementById(id); }

/* fakta: [mi,ins,part,prod,store,status,am,spa,pa,prom,gwp,nop] */
var F = {year:"ALL",month:"ALL",ins:"ALL",part:"ALL",am:"ALL",spa:"ALL",pa:"ALL",prom:"ALL",prod:"ALL",store:"ALL",status:"ALL"};
var SCOPE = {spa:"ALL", pa:"ALL", prom:"ALL"};
var ROUTE = "summary";
var monthMode="both";
var TGT = {summary:{q:"",sort:"tg",tab:"all"},spa:{q:"",sort:"tg",tab:"all"},pa:{q:"",sort:"tg",tab:"all"},promotor:{q:"",sort:"tg",tab:"all"}};

var PAGES = {
  summary:{title:"Summary", scope:null},
  spa:{title:"SPA", scope:"spa", list:"spa", label:"Pilih SPA"},
  pa:{title:"PA", scope:"pa", list:"pa", label:"Pilih PA"},
  promotor:{title:"Promotor", scope:"prom", list:"prom", label:"Pilih Promotor"}
};
var BREAKS = {
  summary:[{id:"B1",t:"Top produk",map:"byProd"},{id:"B2",t:"Top store",map:"byStore"},{id:"B3",t:"Top PA",map:"byPa"}],
  spa:[{id:"B1",t:"Top area_manager",map:"byAm"},{id:"B2",t:"Top PA",map:"byPa"}],
  pa:[{id:"B1",t:"Top produk",map:"byProd"},{id:"B2",t:"Top store",map:"byStore"},{id:"B3",t:"Top Promotor",map:"byProm"}],
  promotor:[{id:"B1",t:"Top produk",map:"byProd"},{id:"B2",t:"Top store",map:"byStore"}]
};

function scopeVal(){
  if(ROUTE==="spa") return SCOPE.spa;
  if(ROUTE==="pa") return SCOPE.pa;
  if(ROUTE==="promotor") return SCOPE.prom;
  return "ALL";
}
function passFact(f, ignoreYearMonth){
  var ym=DATA.months[f[0]];
  if(LOCK && String(f[LOCK.field])!==String(LOCK.idx)) return false;
  if(!ignoreYearMonth){
    if(F.year!=="ALL" && ym.slice(0,4)!==F.year) return false;
    if(F.month!=="ALL" && ym.slice(5,7)!==F.month) return false;
  }
  if(F.ins!=="ALL"&&String(f[1])!==F.ins) return false;
  if(F.part!=="ALL"&&String(f[2])!==F.part) return false;
  if(F.am!=="ALL"&&String(f[6])!==F.am) return false;
  if(F.spa!=="ALL"&&String(f[7])!==F.spa) return false;
  if(F.pa!=="ALL"&&String(f[8])!==F.pa) return false;
  if(F.prom!=="ALL"&&String(f[9])!==F.prom) return false;
  if(F.prod!=="ALL"&&String(f[3])!==F.prod) return false;
  if(F.store!=="ALL"&&String(f[4])!==F.store) return false;
  if(F.status!=="ALL"&&String(f[5])!==F.status) return false;
  if(ROUTE==="spa"&&SCOPE.spa!=="ALL"&&String(f[7])!==SCOPE.spa) return false;
  if(ROUTE==="pa"&&SCOPE.pa!=="ALL"&&String(f[8])!==SCOPE.pa) return false;
  if(ROUTE==="promotor"&&SCOPE.prom!=="ALL"&&String(f[9])!==SCOPE.prom) return false;
  return true;
}

function aggregate(){
  var nM=DATA.months.length;
  var mNop=new Array(nM).fill(0), mGwp=new Array(nM).fill(0);
  var byYear={}, byProd={}, byStore={}, byPart={}, byStatus={}, byIns={};
  var byAm={}, bySpa={}, byPa={}, byProm={};
  var totN=0, totG=0;
  var facts=DATA.facts;
  for(var k=0;k<facts.length;k++){
    var f=facts[k];
    if(!passFact(f,false)) continue;
    mNop[f[0]]+=f[11]; mGwp[f[0]]+=f[10];
    totN+=f[11]; totG+=f[10];
    var y=DATA.months[f[0]].slice(0,4);
    if(!byYear[y]) byYear[y]={n:0,g:0}; byYear[y].n+=f[11]; byYear[y].g+=f[10];
    addM(byProd,clean(DATA.product[f[3]]),f); addM(byStore,clean(DATA.store[f[4]]),f);
    addM(byPart,clean(DATA.partner[f[2]]),f); addM(byStatus,clean(DATA.status[f[5]]),f);
    addM(byIns,clean(DATA.insurance[f[1]]),f);
    addM(byAm,clean(DATA.am[f[6]]),f); addM(bySpa,clean(DATA.spa[f[7]]),f);
    addM(byPa,clean(DATA.pa[f[8]]),f); addM(byProm,clean(DATA.prom[f[9]]),f);
  }
  return {mNop:mNop,mGwp:mGwp,byYear:byYear,byProd:byProd,byStore:byStore,byPart:byPart,byStatus:byStatus,byIns:byIns,byAm:byAm,bySpa:bySpa,byPa:byPa,byProm:byProm,totN:totN,totG:totG};
}
function addM(map,key,f){ if(!map[key])map[key]={n:0,g:0}; map[key].n+=f[11]; map[key].g+=f[10]; }
function visibleMonths(){
  var out=[];
  for(var i=0;i<DATA.months.length;i++){
    var ym=DATA.months[i];
    if(F.year!=="ALL"&&ym.slice(0,4)!==F.year) continue;
    if(F.month!=="ALL"&&ym.slice(5,7)!==F.month) continue;
    out.push(i);
  }
  return out;
}
function topEntries(map,lim){ var a=Object.keys(map).map(function(k){return {k:k,n:map[k].n,g:map[k].g};}); a.sort(function(x,y){return y.g-x.g;}); return a.slice(0,lim||8); }

function dualChart(elId, labels, nop, gwp, mode){
  var el=$(elId); if(!el) return; el.innerHTML="";
  var W=980,H=330,pl=64,pr=64,pt=16,pb=56;
  var iw=W-pl-pr, ih=H-pt-pb;
  var maxN=Math.max.apply(null,nop.concat([1])), maxG=Math.max.apply(null,gwp.concat([1]));
  maxN*=1.12; maxG*=1.18;
  var ns="http://www.w3.org/2000/svg";
  var svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 "+W+" "+H); svg.setAttribute("width","100%"); svg.style.minWidth="640px"; svg.style.height="auto";
  function X(i){ return pl+iw*(labels.length===1?0.5:(i/(labels.length-1))); }
  function YN(v){ return pt+ih-(v/maxN)*ih; }
  function YG(v){ return pt+ih-(v/maxG)*ih; }
  for(var gi=0;gi<=4;gi++){
    var yv=pt+ih*gi/4;
    var ln=document.createElementNS(ns,"line");
    ln.setAttribute("x1",pl);ln.setAttribute("x2",W-pr);ln.setAttribute("y1",yv);ln.setAttribute("y2",yv);
    ln.setAttribute("stroke","#e6ebf2");svg.appendChild(ln);
    var t1=document.createElementNS(ns,"text");
    t1.setAttribute("x",pl-8);t1.setAttribute("y",yv+4);t1.setAttribute("text-anchor","end");t1.setAttribute("font-size","11");t1.setAttribute("fill","#64748b");
    t1.textContent=fmtInt(maxN*(1-gi/4));svg.appendChild(t1);
    var t2=document.createElementNS(ns,"text");
    t2.setAttribute("x",W-pr+8);t2.setAttribute("y",yv+4);t2.setAttribute("font-size","11");t2.setAttribute("fill","#64748b");
    var gv=maxG*(1-gi/4);
    t2.textContent=gv>=1e9?(gv/1e9).toLocaleString("id-ID",{maximumFractionDigits:1})+"M":Math.round(gv/1e6)+"jt";
    svg.appendChild(t2);
  }
  var bw=Math.min(46, iw/Math.max(labels.length,1)*0.52);
  var pts=[];
  for(var i=0;i<labels.length;i++){
    var x=X(i);
    if(mode!=="gwp"){
      var bh=(nop[i]/maxN)*ih;
      var r=document.createElementNS(ns,"rect");
      r.setAttribute("x",x-bw/2);r.setAttribute("y",pt+ih-bh);r.setAttribute("width",bw);r.setAttribute("height",Math.max(bh,1.5));
      r.setAttribute("rx","6");r.setAttribute("fill","#93b4fd");r.setAttribute("stroke","#2563eb");r.setAttribute("stroke-width","1.2");
      r.dataset.tip=labels[i]+"\nNoP: "+fmtInt(nop[i])+"\nGWP: "+fmtIDR(gwp[i]);
      svg.appendChild(r);
    }
    if(mode!=="nop"){ pts.push([x,YG(gwp[i])]); var c=document.createElementNS(ns,"circle");
      c.setAttribute("cx",x);c.setAttribute("cy",YG(gwp[i]));c.setAttribute("r","4.5");c.setAttribute("fill","#0d9488");c.setAttribute("stroke","#fff");c.setAttribute("stroke-width","2");
      c.dataset.tip=labels[i]+"\nNoP: "+fmtInt(nop[i])+"\nGWP: "+fmtIDR(gwp[i]);
      svg.appendChild(c); }
    if(labels.length<=21||i%2===0){
      var tx=document.createElementNS(ns,"text");
      tx.setAttribute("x",x);tx.setAttribute("y",H-12);tx.setAttribute("text-anchor",labels.length>12?"end":"middle");
      tx.setAttribute("font-size","11");tx.setAttribute("fill","#475569");
      if(labels.length>12){tx.setAttribute("transform","rotate(-32 "+x+" "+(H-12)+")");}
      tx.textContent=labels[i];svg.appendChild(tx);
    }
  }
  if(mode!=="nop"&&pts.length>1){
    var d="M"+pts.map(function(p){return p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" L");
    var pa=document.createElementNS(ns,"path");
    pa.setAttribute("d",d);pa.setAttribute("fill","none");pa.setAttribute("stroke","#0d9488");pa.setAttribute("stroke-width","3");pa.setAttribute("stroke-linecap","round");
    svg.insertBefore(pa,svg.firstChild);
  }
  el.appendChild(svg);
  bindTips(svg);
}
function bindTips(svg){
  var tip=document.querySelector(".tip");
  if(!tip){ tip=document.createElement("div"); tip.className="tip"; document.body.appendChild(tip); }
  svg.querySelectorAll("[data-tip]").forEach(function(n){
    n.addEventListener("mousemove",function(e){ tip.style.display="block"; tip.style.left=(e.clientX+12)+"px"; tip.style.top=(e.clientY+12)+"px"; tip.innerText=n.dataset.tip; });
    n.addEventListener("mouseleave",function(){ tip.style.display="none"; });
  });
}

/* ---- harian ---- */
function dailySeries(mi){
  var ym=DATA.months[mi], dim=daysInMonthOf(ym);
  var nop=new Array(dim+1).fill(0), gwp=new Array(dim+1).fill(0), last=0, cnt=new Array(dim+1).fill(0);
  var facts=DATA.facts;
  for(var k=0;k<facts.length;k++){
    var f=facts[k];
    if(f[0]!==mi) continue;
    if(!passFact(f,false)) continue;
    var d=f[12]||0; if(d<1||d>dim) continue;
    nop[d]+=f[11]; gwp[d]+=f[10]; cnt[d]++; if(d>last) last=d;
  }
  return {ym:ym,dim:dim,nop:nop,gwp:gwp,cnt:cnt,last:last};
}
function cumChart(elId, labels, actual, target){
  var el=$(elId); if(!el) return; el.innerHTML="";
  var n=labels.length; if(!n) return;
  var W=980,H=300,pl=64,pr=22,pt=16,pb=44, iw=W-pl-pr, ih=H-pt-pb;
  var mx=Math.max.apply(null, actual.concat(target||[]).concat([1]))*1.08;
  var ns="http://www.w3.org/2000/svg";
  var svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 "+W+" "+H); svg.setAttribute("width","100%"); svg.style.minWidth="640px"; svg.style.height="auto";
  function X(i){ return pl+iw*(n===1?0.5:i/(n-1)); }
  function Y(v){ return pt+ih-(v/mx)*ih; }
  for(var gi=0;gi<=4;gi++){
    var yv=pt+ih*gi/4;
    var ln=document.createElementNS(ns,"line");
    ln.setAttribute("x1",pl);ln.setAttribute("x2",W-pr);ln.setAttribute("y1",yv);ln.setAttribute("y2",yv);
    ln.setAttribute("stroke","#e6ebf2"); svg.appendChild(ln);
    var t=document.createElementNS(ns,"text");
    t.setAttribute("x",pl-8);t.setAttribute("y",yv+4);t.setAttribute("text-anchor","end");t.setAttribute("font-size","11");t.setAttribute("fill","#64748b");
    t.textContent=fmtInt(mx*(1-gi/4)); svg.appendChild(t);
  }
  var dt="",da="";
  for(var i=0;i<n;i++){ da+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(actual[i]).toFixed(1)+" "; if(target) dt+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(target[i]).toFixed(1)+" "; }
  var ar=document.createElementNS(ns,"path");
  ar.setAttribute("d",da+"L"+X(n-1).toFixed(1)+" "+(pt+ih)+" L"+X(0).toFixed(1)+" "+(pt+ih)+" Z");
  ar.setAttribute("fill","rgba(37,99,235,.12)"); svg.appendChild(ar);
  if(target){
    var pt2=document.createElementNS(ns,"path");
    pt2.setAttribute("d",dt); pt2.setAttribute("fill","none"); pt2.setAttribute("stroke","#f59e0b"); pt2.setAttribute("stroke-width","2.5"); pt2.setAttribute("stroke-dasharray","7 5");
    svg.appendChild(pt2);
  }
  var p2=document.createElementNS(ns,"path");
  p2.setAttribute("d",da); p2.setAttribute("fill","none"); p2.setAttribute("stroke","#2563eb"); p2.setAttribute("stroke-width","3"); p2.setAttribute("stroke-linecap","round");
  svg.appendChild(p2);
  for(var j=0;j<n;j++){
    var cc=document.createElementNS(ns,"circle");
    cc.setAttribute("cx",X(j)); cc.setAttribute("cy",Y(actual[j])); cc.setAttribute("r",j===n-1?5:4);
    cc.setAttribute("fill",j===n-1?"#2563eb":"transparent"); cc.setAttribute("stroke",j===n-1?"#fff":"none"); cc.setAttribute("stroke-width","2");
    cc.dataset.tip="Tgl "+labels[j]+"\nAktual kumulatif: "+fmtInt(actual[j])+(target?("\nPace target: "+fmtInt(target[j])+"\nSelisih: "+(actual[j]-target[j]>=0?"+":"")+fmtInt(actual[j]-target[j])):"");
    svg.appendChild(cc);
    var tx=document.createElementNS(ns,"text");
    tx.setAttribute("x",X(j)); tx.setAttribute("y",H-12); tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-size","10.5"); tx.setAttribute("fill","#475569");
    if(n<=16||j%2===0) tx.textContent=labels[j];
    svg.appendChild(tx);
  }
  el.appendChild(svg);
  bindTips(svg);
}
function renderDaily(){
  var el=$("dailyChart"); if(!el) return;
  var vis=visibleMonths();
  if(!vis.length){ el.innerHTML='<p class="muted">Tidak ada bulan pada filter ini.</p>'; if($("cumChart"))$("cumChart").innerHTML=""; if($("dailyNote"))$("dailyNote").textContent=""; if($("dailyMonth"))$("dailyMonth").textContent="—"; return; }
  var mi=vis[vis.length-1], s=dailySeries(mi);
  if(!s.last){ el.innerHTML='<p class="muted">Belum ada data harian pada bulan ini.</p>'; if($("cumChart"))$("cumChart").innerHTML=""; return; }
  var labels=[], nop=[], gwp=[], cumA=[], acc=0;
  for(var d=1;d<=s.last;d++){ labels.push(String(d)); nop.push(s.nop[d]); gwp.push(s.gwp[d]); acc+=s.nop[d]; cumA.push(acc); }
  if($("dailyMonth")) $("dailyMonth").textContent=ymLabel(s.ym);
  dualChart("dailyChart",labels,nop,gwp,monthMode);
  var elapsed=s.last, dim=s.dim, isTgt=!!(DATA.targetMeta&&DATA.targetMeta.month===s.ym);
  var totN=acc, totG=0; for(var d2=1;d2<=s.last;d2++) totG+=s.gwp[d2];
  var rows=targetFilterRows(), tN=0, tG=0;
  rows.forEach(function(t){ tN+=(t.tn||0); tG+=(t.tg||0); });
  var cumT=[]; for(var i=0;i<labels.length;i++) cumT.push(tN*(i+1)/dim);
  var cumG=[]; acc=0; for(var i2=0;i2<labels.length;i2++){ acc+=gwp[i2]; cumG.push(acc); }
  var note="Data tgl 1–"+elapsed+" "+ymLabel(s.ym)+" · hari berjalan "+elapsed+"/"+dim+" ("+(elapsed/dim*100).toLocaleString("id-ID",{maximumFractionDigits:0})+"%) · rata-rata "+(totN/Math.max(elapsed,1)).toLocaleString("id-ID",{maximumFractionDigits:1})+" polis/hari · "+fmtIDR(totG/Math.max(elapsed,1))+"/hari";
  if(isTgt&&tN>0) note+=" · proyeksi EOM: "+fmtInt(totN*dim/elapsed)+" polis / "+fmtIDR(totG*dim/elapsed)+" ("+((totN*dim/elapsed)/tN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"% dari target)";
  if($("dailyNote")) $("dailyNote").textContent=note;
  if($("cumChart")){
    var useTgt=(isTgt&&tN>0);
    var lg=$("cumPaceLegend"); if(lg) lg.style.display=useTgt?"":"none";
    cumChart("cumChart",labels,cumA,useTgt?cumT:null);
  }
  if($("cumNote")) $("cumNote").textContent = (isTgt&&tN>0) ? ("Target "+fmtInt(tN)+" polis pada "+ymLabel(s.ym)+" · pace "+ (tN/dim).toLocaleString("id-ID",{maximumFractionDigits:1}) +" polis/hari · posisi tgl "+elapsed+": aktual "+fmtInt(totN)+" vs pace "+fmtInt(tN*elapsed/dim)+" ("+(totN/Math.max(tN*elapsed/dim,1)*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%)") : ("Kumulatif sampai tgl "+elapsed+" "+ymLabel(s.ym)+": "+fmtInt(totN)+" polis / "+fmtIDR(totG)+" · perbandingan target hanya untuk bulan "+(DATA.targetMeta?ymLabel(DATA.targetMeta.month):"—")+".");
}


function barList(elId, entries){
  var el=$(elId); if(!el) return; el.innerHTML="";
  if(!entries.length){ el.innerHTML='<p class="muted">Tidak ada data.</p>'; return; }
  var mx=entries[0].g||1;
  entries.forEach(function(e){
    var d=document.createElement("div"); d.className="bar-row";
    d.innerHTML='<span class="n">'+esc(e.k)+'</span><span class="v">'+fmtInt(e.n)+' · '+fmtIDR(e.g)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,(e.g/mx*100)).toFixed(1)+'%"></div></div>';
    el.appendChild(d);
  });
}

function fill(sel, items, fmt){
  var el=$(sel); if(!el) return; el.innerHTML="";
  var o=document.createElement("option"); o.value="ALL"; o.textContent="Semua"; el.appendChild(o);
  items.forEach(function(v,i){ var op=document.createElement("option"); op.value=String(i); op.textContent=fmt?fmt(v):v; el.appendChild(op); });
}

function render(agg){
  var vis=visibleMonths();
  var labels=vis.map(function(i){return ymLabel(DATA.months[i]);});
  var nop=vis.map(function(i){return agg.mNop[i];});
  var gwp=vis.map(function(i){return agg.mGwp[i];});
  var active=vis.filter(function(i){return agg.mNop[i]>0;}).length;
  var avg=agg.totN?agg.totG/agg.totN:0;
  var nzNop=nop.filter(function(v){return v>0;});
  var last=nzNop.length?nzNop[nzNop.length-1]:0, prev=nzNop.length>1?nzNop[nzNop.length-2]:0;
  var momN=(prev>0)?(last-prev)/prev:NaN;
  var gnz=gwp.filter(function(v){return v>0;});
  var lastG=gnz.length?gnz[gnz.length-1]:0, prevG=gnz.length>1?gnz[gnz.length-2]:0;
  var momG=(prevG>0)?(lastG-prevG)/prevG:NaN;
  function delta(v){ var c=!isFinite(v)?"flat":(v>0.0005?"up":(v<-0.0005?"down":"flat")); return '<div class="d '+c+'">'+fmtPct(v)+' MoM</div>'; }
  var scopeName=scopeLabel();
  $("kpis").innerHTML=
    '<div class="kpi"><div class="t">Total NoP'+scopeName+'</div><div class="v">'+fmtInt(agg.totN)+'</div>'+delta(momN)+'</div>'+
    '<div class="kpi"><div class="t">Total GWP'+scopeName+'</div><div class="v">'+fmtIDR(agg.totG)+'</div>'+delta(momG)+'</div>'+
    '<div class="kpi"><div class="t">Rata-rata / polis</div><div class="v">'+fmtIDR(avg)+'</div><div class="d flat">'+active+' bulan aktif</div></div>'+
    '<div class="kpi"><div class="t">Periode tampil</div><div class="v" style="font-size:17px">'+(labels.length?(labels[0]+" → "+labels[labels.length-1]):"—")+'</div><div class="d flat">'+fmtInt(agg.totN/Math.max(active,1))+' polis/bln · '+fmtIDR(agg.totG/Math.max(active,1))+'/bln</div></div>';
  if($("monthlyChart")){
    if(!labels.length){ $("monthlyChart").innerHTML='<p class="muted">Tidak ada bulan yang cocok dengan filter.</p>'; }
    else dualChart("monthlyChart",labels,nop,gwp,monthMode);
  }
  if($("yearChart")){
    var ys=Object.keys(agg.byYear).sort();
    if(!ys.length){ $("yearChart").innerHTML='<p class="muted">Tidak ada data.</p>'; $("yearTable").innerHTML=""; }
    else{
      dualChart("yearChart",ys,ys.map(function(y){return agg.byYear[y].n;}),ys.map(function(y){return agg.byYear[y].g;}),monthMode);
      var rows=ys.map(function(y){
        var p0=agg.byYear[y];
        return '<tr><td>'+y+'</td><td>'+fmtInt(p0.n)+'</td><td>'+fmtIDR(p0.g)+'</td><td>'+fmtIDR(p0.g/Math.max(p0.n,1))+'</td></tr>';
      }).join("");
      if(ys.length>1){
        var yoyN=(agg.byYear[ys[0]].n>0)?(agg.byYear[ys[ys.length-1]].n-agg.byYear[ys[0]].n)/agg.byYear[ys[0]].n:NaN;
        var yoyG=(agg.byYear[ys[0]].g>0)?(agg.byYear[ys[ys.length-1]].g-agg.byYear[ys[0]].g)/agg.byYear[ys[0]].g:NaN;
        rows+='<tr><td><b>YoY</b></td><td><b>'+fmtPct(yoyN)+'</b></td><td><b>'+fmtPct(yoyG)+'</b></td><td></td></tr>';
      }
      $("yearTable").innerHTML='<div class="tbl-wrap"><table><thead><tr><th>Tahun</th><th>NoP</th><th>GWP</th><th>Rata-rata</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }
  }
  if($("mixBox")){
    var mix=[["Partner",agg.byPart],["Status",agg.byStatus],["Insurance",agg.byIns]];
    var mh="";
    mix.forEach(function(pair){
      mh+='<h3 style="font-size:13px;margin:12px 0 4px">'+pair[0]+'</h3>';
      topEntries(pair[1],6).forEach(function(e){
        var tot=agg.totG||1, top0=topEntries(pair[1],6)[0];
        mh+='<div class="bar-row"><span class="n">'+esc(e.k)+'</span><span class="v">'+(e.g/tot*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'%</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,e.g/((top0&&top0.g)||1)*100).toFixed(1)+'%"></div></div>';
      });
    });
    $("mixBox").innerHTML=mh;
  }
  (BREAKS[ROUTE]||[]).forEach(function(b){
    var map=agg[b.map];
    barList(b.id, topEntries(map||{},8));
  });
  renderTrend(agg,vis);
  renderTable(agg,vis);
  renderDaily();
  renderTarget();
  var actF=[F.year,F.month,F.ins,F.part,F.am,F.spa,F.pa,F.prom,F.prod,F.store,F.status].filter(function(v){return v!=="ALL";}).length;
  if(scopeVal()!=="ALL") actF++;
  $("filterCount").textContent=actF?actF+" filter aktif · "+fmtInt(agg.totN)+" polis":"Tanpa filter · "+fmtInt(agg.totN)+" polis";
  var sc=scopeLabel();
  $("periodSub").textContent=(labels.length?("Periode tampil: "+labels[0]+" → "+labels[labels.length-1]):"Periode kosong")+(sc?" · "+sc:"")+" · Sumber: Data-raw.xlsx ("+fmtInt(DATA.facts.length)+" baris)";
  $("metaLine").textContent="Dibuat "+(DATA.meta&&DATA.meta.generated?DATA.meta.generated:"")+" · NoP=SUM(NoP) · GWP=SUM(gwp) · Target: "+((DATA.targetMeta&&DATA.targetMeta.source)||"Target.xlsx")+" ("+((DATA.target&&DATA.target.length)||0)+" store, bulan "+((DATA.targetMeta&&DATA.targetMeta.month)||"—")+" s/d tgl "+elapsedOf()+")";
}
function scopeLabel(){
  var v=scopeVal();
  if(v==="ALL") return "";
  var nm=ROUTE==="spa"?"SPA":ROUTE==="pa"?"PA":"Promotor";
  var list=ROUTE==="spa"?DATA.spa:ROUTE==="pa"?DATA.pa:DATA.prom;
  return " · "+nm+" "+clean(list[+v]);
}

function renderTrend(agg,vis){
  if(!$("trendCards")) return;
  var cards=[],items=[];
  if(!vis.length){ $("trendCards").innerHTML=""; $("trendList").innerHTML="<li>Tidak ada data pada filter ini.</li>"; return; }
  var bi=vis[0],wi=vis[0],bg=-1,wg=Infinity;
  vis.forEach(function(i){ if(agg.mGwp[i]>bg){bg=agg.mGwp[i];bi=i;} if(agg.mNop[i]>0&&agg.mGwp[i]<wg){wg=agg.mGwp[i];wi=i;} });
  var nz=vis.filter(function(i){return agg.mNop[i]>0;});
  if(!nz.length){ $("trendCards").innerHTML=""; $("trendList").innerHTML="<li>Tidak ada data pada filter ini.</li>"; return; }
  var avgN=agg.totN/Math.max(nz.length,1), avgG=agg.totG/Math.max(nz.length,1);
  var l1=nz[nz.length-1],l0=nz.length>1?nz[nz.length-2]:null;
  var momNt=l0!=null&&agg.mNop[l0]>0?(agg.mNop[l1]-agg.mNop[l0])/agg.mNop[l0]:NaN;
  var momGt=l0!=null&&agg.mGwp[l0]>0?(agg.mGwp[l1]-agg.mGwp[l0])/agg.mGwp[l0]:NaN;
  var lastYm=DATA.months[l1], mm=lastYm.slice(5,7), y0=String(+lastYm.slice(0,4)-1), ym0=y0+"-"+mm;
  var i0=DATA.months.indexOf(ym0);
  var yoyNt=NaN,yoyGt=NaN;
  if(i0>=0){
    var t1={n:0,g:0},t0={n:0,g:0};
    for(var k=0;k<DATA.facts.length;k++){ var f=DATA.facts[k];
      if(!passFact(f,true)) continue;
      var ym=DATA.months[f[0]];
      if(ym===lastYm){t1.n+=f[11];t1.g+=f[10];}
      if(ym===ym0){t0.n+=f[11];t0.g+=f[10];}
    }
    if(t0.n>0)yoyNt=(t1.n-t0.n)/t0.n;
    if(t0.g>0)yoyGt=(t1.g-t0.g)/t0.g;
  }
  cards.push({t:"Bulan terbaik (GWP)",v:ymLabel(DATA.months[bi])+" · "+fmtIDR(bg)});
  cards.push({t:"MoM terakhir",v:fmtPct(momGt)+" GWP · "+fmtPct(momNt)+" NoP"});
  cards.push({t:"YoY "+ymLabel(lastYm)+(i0>=0?" vs "+ymLabel(ym0):""),v:(isFinite(yoyGt)?fmtPct(yoyGt)+" GWP":"—")+" · "+(isFinite(yoyNt)?fmtPct(yoyNt)+" NoP":"—")});
  cards.push({t:"Rata-rata / bulan aktif",v:fmtInt(avgN)+" polis · "+fmtIDR(avgG)});
  $("trendCards").innerHTML=cards.map(function(c){return '<div class="tc"><div class="t">'+c.t+'</div><div class="v">'+esc(c.v)+'</div></div>';}).join("");
  items.push("Total <b>"+fmtInt(agg.totN)+"</b> polis dengan GWP <b>"+fmtIDR(agg.totG)+"</b> pada "+vis.length+" bulan tampil ("+nz.length+" bulan aktif).");
  items.push("Bulan tertinggi GWP: <b>"+ymLabel(DATA.months[bi])+"</b> ("+fmtInt(agg.mNop[bi])+" polis, "+fmtIDR(agg.mGwp[bi])+"). Terendah: <b>"+ymLabel(DATA.months[wi])+"</b> ("+fmtIDR(agg.mGwp[wi])+").");
  if(l0!=null) items.push("Perubahan bulan terakhir ("+ymLabel(DATA.months[l0])+" → "+ymLabel(DATA.months[l1])+"): NoP <b>"+fmtPct(momNt)+"</b>, GWP <b>"+fmtPct(momGt)+"</b>.");
  if(i0>=0&&isFinite(yoyGt)) items.push("Year-on-year "+ymLabel(ym0)+" → "+ymLabel(lastYm)+": NoP <b>"+fmtPct(yoyNt)+"</b>, GWP <b>"+fmtPct(yoyGt)+"</b> (filter non-tahun sama).");
  var tp=topEntries(agg.byProd,1)[0],ts=topEntries(agg.byStore,1)[0],ta=topEntries(agg.byPa,1)[0],tn=topEntries(agg.byPart,1)[0];
  if(tp) items.push("Produk dominan: <b>"+esc(tp.k)+"</b> ("+fmtIDR(tp.g)+", "+fmtInt(tp.n)+" polis).");
  if(ts) items.push("Store dominan: <b>"+esc(ts.k)+"</b> ("+fmtIDR(ts.g)+").");
  if(ta) items.push("PA dominan: <b>"+esc(ta.k)+"</b> ("+fmtIDR(ta.g)+", "+fmtInt(ta.n)+" polis).");
  if(tn) items.push("Partner dominan: <b>"+esc(tn.k)+"</b> ("+fmtIDR(tn.g)+").");
  var st=topEntries(agg.byStatus,3);
  if(st.length) items.push("Status: "+st.map(function(e){return esc(e.k)+" "+(e.n/Math.max(agg.totN,1)*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%";}).join(" · ")+".");
  if(isFinite(momGt)&&momGt<-0.15) items.push("<b>Perhatian:</b> GWP turun &gt;15% MoM — cek store/produk yang turun pada tabel bulanan.");
  if(isFinite(yoyGt)&&yoyGt>0.1) items.push("Momentum tahunan positif (>10% YoY) — pertahankan strategi pada produk &amp; PA teratas.");
  $("trendList").innerHTML=items.map(function(s){return "<li>"+s+"</li>";}).join("");
}

function renderTable(agg,vis){
  var t=$("monthTable"); if(!t) return;
  var tb=t.querySelector("tbody"); tb.innerHTML="";
  vis.slice().reverse().forEach(function(i){
    var n=agg.mNop[i],g=agg.mGwp[i];
    var tr=document.createElement("tr");
    tr.innerHTML="<td>"+ymLabel(DATA.months[i])+"</td><td>"+fmtInt(n)+"</td><td>"+fmtIDR(g)+"</td><td>"+(n?fmtIDR(g/n):"—")+"</td><td>"+(agg.totN?(n/agg.totN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+"</td><td>"+(agg.totG?(g/agg.totG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+"</td>";
    tb.appendChild(tr);
  });
}

function tgtStatus(estAch, hasTarget){
  if(!hasTarget) return {t:"Tanpa target",c:"p-gray"};
  if(estAch>=1) return {t:"Tercapai",c:"p-green"};
  if(estAch>=0.7) return {t:"Mendekati",c:"p-amber"};
  if(estAch>=0.4) return {t:"Berisiko",c:"p-orange"};
  return {t:"Tertinggal",c:"p-red"};
}
/* samakan pilihan dropdown dgn baris target (toleran beda kapital + "(Kosong)"=blank) */
function selNorm(list, val){
  if(val==="ALL") return null;
  var e=list[+val];
  if(isBlankEntry(e)) return "";
  return norm(clean(e));
}
function targetFilterRows(){
  if(!DATA.target) return [];
  var selStore=selNorm(DATA.store,F.store), selPart=selNorm(DATA.partner,F.part), selSpa=selNorm(DATA.spa,F.spa);
  var selPa=selNorm(DATA.pa,F.pa), selProm=selNorm(DATA.prom,F.prom), selAm=selNorm(DATA.am,F.am);
  var scSpa=ROUTE==="spa"?selNorm(DATA.spa,SCOPE.spa):null;
  var scPa=ROUTE==="pa"?selNorm(DATA.pa,SCOPE.pa):null;
  var scProm=ROUTE==="promotor"?selNorm(DATA.prom,SCOPE.prom):null;
  return DATA.target.filter(function(t){
    if(LOCK&&norm(t[LOCK.key]||"")!==norm(DATA[LOCK.list][LOCK.idx])) return false;
    if(selStore!==null&&norm(t.s)!==selStore) return false;
    if(selPart!==null&&norm(t.p||"")!==selPart) return false;
    if(selAm!==null&&norm(t.am||"")!==selAm) return false;
    if(selSpa!==null&&norm(t.spa||"")!==selSpa) return false;
    if(selPa!==null&&norm(t.pa||"")!==selPa) return false;
    if(selProm!==null&&norm(t.pr||"")!==selProm) return false;
    if(scSpa!==null&&norm(t.spa||"")!==scSpa) return false;
    if(scPa!==null&&norm(t.pa||"")!==scPa) return false;
    if(scProm!==null&&norm(t.pr||"")!==scProm) return false;
    return true;
  });
}
function renderTarget(){
  if(!$("tgtTable")||!DATA.target||!DATA.target.length||!DATA.targetMeta) return;
  var st=TGT[ROUTE];
  var tm=DATA.targetMeta, octIdx=DATA.months.indexOf(tm.month);
  var dim=tm.daysInMonth||daysInMonthOf(tm.month);
  var elapsed=(DATA.monthLastDay&&DATA.monthLastDay[octIdx])||tm.lastDay||dim;
  if(elapsed<=0) elapsed=dim;
  var fac=dim/elapsed;
  var selStore=selNorm(DATA.store,F.store), selPart=selNorm(DATA.partner,F.part);
  var scSpa=ROUTE==="spa"?selNorm(DATA.spa,SCOPE.spa):null;
  var scPa=ROUTE==="pa"?selNorm(DATA.pa,SCOPE.pa):null;
  var scProm=ROUTE==="promotor"?selNorm(DATA.prom,SCOPE.prom):null;
  var extraActive=(F.prod!=="ALL"||F.ins!=="ALL"||F.status!=="ALL");
  var act={};
  if(octIdx>=0){
    var facts=DATA.facts;
    for(var k=0;k<facts.length;k++){
      var f=facts[k];
      if(f[0]!==octIdx) continue;
      if(LOCK&&String(f[LOCK.field])!==String(LOCK.idx)) continue;
      if(F.prod!=="ALL"&&String(f[3])!==F.prod) continue;
      if(F.ins!=="ALL"&&String(f[1])!==F.ins) continue;
      if(F.status!=="ALL"&&String(f[5])!==F.status) continue;
      if(F.am!=="ALL"&&String(f[6])!==F.am) continue;
      if(F.spa!=="ALL"&&String(f[7])!==F.spa) continue;
      if(F.pa!=="ALL"&&String(f[8])!==F.pa) continue;
      if(F.prom!=="ALL"&&String(f[9])!==F.prom) continue;
      if(selPart!==null&&norm(clean(DATA.partner[f[2]]))!==selPart) continue;
      if(selStore!==null&&norm(clean(DATA.store[f[4]]))!==selStore) continue;
      if(scSpa!==null&&norm(clean(DATA.spa[f[7]]))!==scSpa) continue;
      if(scPa!==null&&norm(clean(DATA.pa[f[8]]))!==scPa) continue;
      if(scProm!==null&&norm(clean(DATA.prom[f[9]]))!==scProm) continue;
      var sn=norm(clean(DATA.store[f[4]]));
      if(!act[sn]) act[sn]={n:0,g:0};
      act[sn].n+=f[11]; act[sn].g+=f[10];
    }
  }
  var rows=targetFilterRows().map(function(t){
    var a=act[norm(t.s)]||{n:0,g:0};
    var hasT=(t.tg||0)>0||(t.tn||0)>0;
    var achN=t.tn>0?a.n/t.tn:NaN, achG=t.tg>0?a.g/t.tg:NaN;
    var eN=a.n*fac, eG=a.g*fac;
    var estA=(t.tg>0)?eG/t.tg:(t.tn>0?eN/t.tn:NaN);
    return {s:t.s,pa:t.pa||"—",tn:t.tn||0,tg:t.tg||0,an:a.n,ag:a.g,achN:achN,achG:achG,eN:eN,eG:eG,estA:estA,st:tgtStatus(estA,hasT)};
  });
  var fr=rows.filter(function(r){
    if(st.tab==="done") return r.st.t==="Tercapai";
    if(st.tab==="behind") return r.st.t!=="Tercapai";
    return true;
  });
  var q=norm(st.q);
  if(q) fr=fr.filter(function(r){ return norm(r.s+" "+r.pa).indexOf(q)>=0; });
  var tN=0,tG=0,aN=0,aG=0;
  rows.forEach(function(r){ tN+=r.tn; tG+=r.tg; aN+=r.an; aG+=r.ag; });
  var achN=tN>0?aN/tN:NaN, achG=tG>0?aG/tG:NaN, eNt=aN*fac, eGt=aG*fac;
  var estAN=tN>0?eNt/tN:NaN, estAG=tG>0?eGt/tG:NaN;
  $("tgtKpis").innerHTML=
    '<div class="kpi"><div class="t">Ach NoP (tgl '+elapsed+')</div><div class="v">'+(isFinite(achN)?(achN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtInt(aN)+' / '+fmtInt(tN)+'</div></div>'+
    '<div class="kpi"><div class="t">Ach GWP (tgl '+elapsed+')</div><div class="v">'+(isFinite(achG)?(achG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtIDR(aG)+' / '+fmtIDR(tG)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach NoP (EOM)</div><div class="v">'+(isFinite(estAN)?(estAN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtInt(eNt)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach GWP (EOM)</div><div class="v">'+(isFinite(estAG)?(estAG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtIDR(eGt)+'</div></div>';
  var pace=elapsed/dim;
  var yLbl=ymLabel(tm.month);
  $("tgtNote").textContent="Periode dikunci "+yLbl+" · data per tgl "+elapsed+" "+yLbl.split(" ")[0]+" (pace linear "+(pace*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%) · estimasi EOM = aktual ×"+(dim/elapsed).toLocaleString("id-ID",{maximumFractionDigits:2})+" · mengikuti filter Store/Partner"+(extraActive?" · aktual juga difilter Produk/Insurance/Status (target tetap level store)":"")+" · "+rows.length+" store tampil.";
  fr.sort(function(a,b){
    if(st.sort==="achLo") return (isFinite(a.achG)?a.achG:-1)-(isFinite(b.achG)?b.achG:-1);
    if(st.sort==="achHi") return (isFinite(b.achG)?b.achG:-1)-(isFinite(a.achG)?a.achG:-1);
    if(st.sort==="gap") return (b.tg-b.ag)-(a.tg-a.ag);
    return b.tg-a.tg;
  });
  function achCell(v){
    if(!isFinite(v)) return '<span class="flat">—</span>';
    var p=Math.max(0,Math.min(100,v*100));
    return '<span class="ach"><span class="bar-track"><span class="bar-fill" style="display:block;width:'+p.toFixed(1)+'%"></span></span>'+(v*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'%</span>';
  }
  var tb=$("tgtTable").querySelector("tbody"); tb.innerHTML="";
  if(!fr.length){ tb.innerHTML='<tr><td colspan="12">Tidak ada store yang cocok.</td></tr>'; return; }
  var html="";
  fr.forEach(function(r){
    html+='<tr><td class="sticky" title="'+esc(r.s)+'">'+esc(r.s)+'</td><td>'+esc(r.pa)+'</td><td>'+fmtInt(r.tn)+'</td><td>'+fmtInt(r.an)+'</td><td>'+achCell(r.achN)+'</td><td>'+fmtIDR(r.tg)+'</td><td>'+fmtIDR(r.ag)+'</td><td>'+achCell(r.achG)+'</td><td>'+fmtInt(r.eN)+'</td><td>'+fmtIDR(r.eG)+'</td><td>'+(isFinite(r.estA)?(r.estA*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</td><td><span class="pill '+r.st.c+'">'+r.st.t+'</span></td></tr>';
  });
  tb.innerHTML=html;
}

/* ---- halaman ---- */
function pageHTML(){
  var breaks=(BREAKS[ROUTE]||[]).map(function(b){
    return '<section class="card"><h2>'+b.t+'</h2><div id="'+b.id+'"></div></section>';
  });
  var grid1=breaks.slice(0,2).join("");
  var rest=breaks.slice(2).join("");
  var h='<section class="kpis" id="kpis"></section>';
  h+='<section class="card"><div class="card-h row"><div><h2>Tren bulanan — NoP &amp; GWP</h2><p class="muted">NoP (batang) vs GWP (garis).</p></div>'+
     '<div class="tabs" id="monthTabs"><button data-m="both" class="on">Keduanya</button><button data-m="nop">NoP</button><button data-m="gwp">GWP</button></div></div>'+
     '<div id="monthlyChart" class="chart"></div><div class="legend"><span><i class="sw bar"></i>NoP</span><span><i class="sw line"></i>GWP (Rp)</span></div></section>';
  h+='<section class="card"><div class="card-h row"><div><h2>Penjualan harian — <span id="dailyMonth">—</span></h2><p class="muted" id="dailyNote"></p></div></div>'+
     '<div id="dailyChart" class="chart"></div><div class="legend"><span><i class="sw bar"></i>NoP</span><span><i class="sw line"></i>GWP (Rp)</span></div>'+
     '<h3 class="sub-head">Kumulatif NoP — aktual vs pace target</h3><p class="muted" id="cumNote"></p>'+
     '<div id="cumChart" class="chart"></div><div class="legend"><span><i class="sw line"></i>Kumulatif aktual</span><span id="cumPaceLegend"><i class="sw line dash"></i>Pace target</span></div></section>';
  if(ROUTE==="summary"){
    h+='<div class="cols2"><section class="card"><h2>Perbandingan tahunan</h2><p class="muted">Total NoP &amp; GWP per tahun (mengikuti filter).</p><div id="yearChart" class="chart"></div><div id="yearTable"></div></section>'+
       '<section class="card trend"><h2>Ringkasan tren</h2><p class="muted">Dihitung otomatis dari data terfilter.</p><div id="trendCards" class="trend-cards"></div><ul id="trendList" class="trend-list"></ul></section></div>';
  } else {
    h+='<section class="card trend"><h2>Ringkasan tren</h2><p class="muted">Dihitung otomatis dari data terfilter.</p><div id="trendCards" class="trend-cards"></div><ul id="trendList" class="trend-list"></ul></section>';
  }
  var tmLbl=(DATA.targetMeta&&DATA.targetMeta.month)?ymLabel(DATA.targetMeta.month):"—";
  var el0=elapsedOf();
  h+='<section class="card" id="tgtSec"><div class="card-h row"><div><h2>Target vs Achievement — '+tmLbl+' <span class="muted-sm">data per tgl '+(el0||"—")+'</span></h2><p class="muted" id="tgtNote"></p></div>'+
     '<div class="tabs" id="tgtTabs"><button data-t="all" class="on">Semua</button><button data-t="behind">Belum 100%</button><button data-t="done">Tercapai</button></div></div>'+
     '<div class="kpis" id="tgtKpis" style="margin-top:12px"></div>'+
     '<div class="tgt-controls"><input id="tgtSearch" type="search" placeholder="Cari store / PA…"><select id="tgtSort"><option value="tg">Urut: Target GWP terbesar</option><option value="achLo">Urut: Achievement GWP terendah</option><option value="achHi">Urut: Achievement GWP tertinggi</option><option value="gap">Urut: Selisih GWP terbesar</option></select></div>'+
     '<div class="tbl-wrap tgt-wrap"><table id="tgtTable" class="tgt"><thead><tr><th class="sticky">Store</th><th>PA</th><th>Tgt NoP</th><th>Akt NoP</th><th>Ach NoP</th><th>Tgt GWP</th><th>Akt GWP</th><th>Ach GWP</th><th>Est NoP</th><th>Est GWP</th><th>Est Ach</th><th>Status</th></tr></thead><tbody></tbody></table></div></section>';
  if(grid1) h+='<div class="cols2">'+grid1+'</div>';
  if(rest) h+=rest;
  if(ROUTE==="summary"){
    h+='<section class="card"><h2>Komposisi <span class="muted-sm">partner · status · insurance</span></h2><div id="mixBox"></div></section>';
    h+='<section class="card"><div class="card-h row"><div><h2>Detail bulanan</h2><p class="muted">NoP, GWP, dan rata-rata GWP/polis per bulan.</p></div></div>'+
       '<div class="tbl-wrap"><table id="monthTable"><thead><tr><th>Bulan</th><th>NoP</th><th>GWP</th><th>Rata-rata/polis</th><th>Share NoP</th><th>Share GWP</th></tr></thead><tbody></tbody></table></div></section>';
  }
  return h;
}
function pageHeadHTML(){
  var p=PAGES[ROUTE];
  if(!p.scope) return '<div class="pagehead"><h2>'+p.title+'</h2></div>';
  if(LOCK && LOCK.route===ROUTE)
    return '<div class="pagehead"><h2>'+p.title+'</h2><span class="scopelock">'+esc(p.label.replace("Pilih ",""))+': <b>'+esc(LOCK.name)+'</b> · terkunci</span></div>';
  var list=DATA[p.list]||[];
  var cur=p.scope==="spa"?SCOPE.spa:p.scope==="pa"?SCOPE.pa:SCOPE.prom;
  var opts='<option value="ALL">Semua '+p.title+'</option>'+list.map(function(v,i){return '<option value="'+i+'"'+(String(i)===cur?" selected":"")+'>'+esc(clean(v))+'</option>';}).join("");
  return '<div class="pagehead"><h2>'+p.title+'</h2><label class="scopebar">'+p.label+' <select id="scopeSel">'+opts+'</select></label></div>';
}
function bindPage(){
  var mt=$("monthTabs");
  if(mt) mt.querySelectorAll("button").forEach(function(b){
    if(b.dataset.m===monthMode) { mt.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); }
    b.addEventListener("click",function(){
      mt.querySelectorAll("button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); monthMode=b.dataset.m; render(aggregate());
    });
  });
  var ss=$("scopeSel");
  if(ss) ss.addEventListener("change",function(e){
    var v=e.target.value;
    if(ROUTE==="spa") SCOPE.spa=v; else if(ROUTE==="pa") SCOPE.pa=v; else if(ROUTE==="promotor") SCOPE.prom=v;
    render(aggregate());
  });
  var st=TGT[ROUTE], ts=$("tgtSearch"), so=$("tgtSort"), tt=$("tgtTabs");
  if(ts){ ts.value=st.q; ts.addEventListener("input",function(e){ st.q=e.target.value; renderTarget(); }); }
  if(so){ so.value=st.sort; so.addEventListener("change",function(e){ st.sort=e.target.value; renderTarget(); }); }
  if(tt) tt.querySelectorAll("button").forEach(function(b){
    if(b.dataset.t===st.tab){ tt.querySelectorAll("button").forEach(function(x){x.classList.remove("on");}); b.classList.add("on"); }
    b.addEventListener("click",function(){
      tt.querySelectorAll("button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); st.tab=b.dataset.t; renderTarget();
    });
  });
}
function renderRoute(){
  if(ALLOWED_ROUTES.indexOf(ROUTE)<0){
    ROUTE=ALLOWED_ROUTES[ALLOWED_ROUTES.length-1]||"summary";
    if(location.hash!=="#/"+ROUTE) location.hash="#/"+ROUTE;
  }
  document.querySelectorAll(".side-nav a").forEach(function(a){
    a.classList.toggle("on", a.dataset.route===ROUTE);
  });
  var BRAND="Qoala Gadget Protection x MAP Tech";
  $("pageTitle").textContent=BRAND;
  $("eyebrow").textContent="SALES MONITORING · "+((PAGES[ROUTE]&&PAGES[ROUTE].title||"Summary").toUpperCase());
  var g=$("greet");
  if(g){
    if(USER){
      var hh=new Date().getHours();
      g.textContent="Selamat "+(hh<11?"Pagi":hh<15?"Siang":hh<19?"Sore":"Malam")+", "+(USER.n||USER.u);
      g.hidden=false;
    } else { g.hidden=true; }
  }
  var spaRoute=(ROUTE==="spa"), paRoute=(ROUTE==="pa"), promRoute=(ROUTE==="promotor");
  syncOrgFilters();
  if(spaRoute&&F.spa!=="ALL"){ F.spa="ALL"; if($("fSpa")) $("fSpa").value="ALL"; }
  if(paRoute&&F.pa!=="ALL"){ F.pa="ALL"; if($("fPa")) $("fPa").value="ALL"; }
  if(promRoute&&F.prom!=="ALL"){ F.prom="ALL"; if($("fProm")) $("fProm").value="ALL"; }
  $("pageHead").innerHTML=pageHeadHTML();
  $("pageBody").innerHTML=pageHTML();
  bindPage();
  render(aggregate());
  document.body.classList.remove("nav-open");
  window.scrollTo(0,0);
}

/* ================= LOGIN + PEMBATASAN SCOPE =================
   Password disimpan sebagai hash FNV-1a 32-bit (hex) di data/summary.js.
   Ini gerbang akses, bukan keamanan sungguhan: seluruh data tetap ada di file JSON. */
var USER=null, LOCK=null, ALLOWED_ROUTES=["summary","spa","pa","promotor"];
function hashPw(s){
  var h=2166136261>>>0; s=String(s==null?"":s);
  for(var i=0;i<s.length;i++){ h=(h^s.charCodeAt(i))>>>0; h=Math.imul(h,16777619)>>>0; }
  var x=(h>>>0).toString(16); while(x.length<8) x="0"+x; return x;
}
function firstTok(s){ return (norm(s).split(" ")[0]||""); }
function levSim(a,b){
  var m=a.length,n=b.length; if(!m||!n) return (m===n)?1:0;
  var prev=[],cur=[],i,j;
  for(j=0;j<=n;j++) prev[j]=j;
  for(i=1;i<=m;i++){
    cur[0]=i;
    for(j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1));
    }
    var t=prev; prev=cur; cur=t;
  }
  return 1-prev[n]/Math.max(m,n);
}
function findScopeIdx(arr,name){
  var n=norm(name); if(!n||!arr) return -1;
  var ft=firstTok(name), cand=-1, i;
  for(i=0;i<arr.length;i++){
    var e=arr[i]; if(isBlankEntry(e)) continue;
    var v=norm(e);
    if(v===n) return i;
    if(cand<0 && (v.indexOf(n)===0 || n.indexOf(v)===0 || firstTok(e)===ft)) cand=i;
  }
  if(cand>=0) return cand;
  /* toleransi salah ketik: ambil kandidat terdekat bila jelas paling mirip */
  var best=-1,bs=0,second=0;
  for(i=0;i<arr.length;i++){
    var e2=arr[i]; if(isBlankEntry(e2)) continue;
    var s=levSim(n,norm(e2));
    if(s>bs){ second=bs; bs=s; best=i; } else if(s>second) second=s;
  }
  if(best>=0 && bs>=0.82 && (bs-second)>=0.08) return best;
  return -1;
}
function findUser(login){
  var l=norm(login), us=(DATA&&DATA.users)||[];
  for(var i=0;i<us.length;i++){ if(norm(us[i].u)===l) return us[i]; }
  return null;
}
function applyUser(u){
  USER=u||null; LOCK=null; ALLOWED_ROUTES=["summary","spa","pa","promotor"];
  var warn="";
  if(USER && norm(USER.r)!=="admin"){
    var r=norm(USER.r);
    var spec = r==="spa"?{list:"spa",field:7,tkey:"spa",route:"spa",level:1}
             : r==="pa"?{list:"pa",field:8,tkey:"pa",route:"pa",level:2}
             : {list:"prom",field:9,tkey:"pr",route:"promotor",level:3};
    var arr=DATA[spec.list]||[], idx=findScopeIdx(arr,USER.n);
    if(idx>=0){
      LOCK={field:spec.field,key:spec.tkey,idx:idx,route:spec.route,level:spec.level,list:spec.list,name:clean(arr[idx])};
      ALLOWED_ROUTES=["summary",LOCK.route];
      F.am="ALL"; F.spa="ALL"; F.pa="ALL"; F.prom="ALL";
    }else{
      warn="Akun <b>"+esc(USER.n||USER.u)+"</b> ("+esc(USER.r)+") belum cocok dengan daftar "+spec.route+" pada data, jadi pembatasan data tidak diterapkan. Mohon periksa ejaan nama di Master_user.xlsx.";
    }
  }
  applyAccessUI();
  var wb=$("warnBar");
  if(wb){ if(warn){ wb.innerHTML=warn; wb.hidden=false; } else { wb.innerHTML=""; wb.hidden=true; } }
}
function applyAccessUI(){
  document.querySelectorAll(".side-nav a").forEach(function(a){
    a.style.display=ALLOWED_ROUTES.indexOf(a.dataset.route)>=0?"":"none";
  });
  var su=$("sideUser");
  if(su){
    if(USER){
      su.hidden=false;
      $("suName").textContent=USER.n||USER.u;
      $("suRole").textContent=LOCK?(USER.r+" · akses terkunci"):(USER.r+" · akses semua data");
    } else su.hidden=true;
  }
}
function syncOrgFilters(){
  var lvl=LOCK?LOCK.level:-1;
  var hide={am:(LOCK&&lvl>=0),spa:(LOCK&&lvl>=1)||ROUTE==="spa",pa:(LOCK&&lvl>=2)||ROUTE==="pa",prom:(LOCK&&lvl>=3)||ROUTE==="promotor"};
  var map={am:"lblAm",spa:"lblSpa",pa:"lblPa",prom:"lblProm"};
  Object.keys(map).forEach(function(k){ var el=$(map[k]); if(el) el.style.display=hide[k]?"none":""; });
}
function enter(u,persist){
  applyUser(u);
  if(persist){ try{ sessionStorage.setItem("qoala.session",u.u); }catch(e){} }
  var lg=$("login"); if(lg) lg.hidden=true;
  var le=$("loginErr"); if(le){ le.textContent=""; le.classList.remove("on"); }
  var lp=$("loginPass"); if(lp) lp.value="";
  document.body.classList.remove("locked");
  startDashboard();
}
function showLogin(msg){
  var lg=$("login"); if(lg) lg.hidden=false;
  document.body.classList.add("locked");
  var e=$("loginErr");
  if(e){ if(msg){ e.innerHTML=msg; e.classList.add("on"); } else { e.innerHTML=""; e.classList.remove("on"); } }
  var iu=$("loginUser"); if(iu) iu.focus();
}
function doLogin(){
  var u=findUser($("loginUser").value);
  if(!u){ showLogin("Email tidak terdaftar."); return; }
  if(u.h!==hashPw($("loginPass").value)){ showLogin("Password salah."); return; }
  enter(u,true);
}
function doLogout(){
  try{ sessionStorage.removeItem("qoala.session"); }catch(e){}
  window.location.reload();
}
var _lf=$("loginForm"); if(_lf) _lf.addEventListener("submit",function(e){ e.preventDefault(); doLogin(); });
var _lo=$("btnLogout"); if(_lo) _lo.addEventListener("click",doLogout);

function init(){
  if(!DATA){ document.body.innerHTML="<p style='padding:24px'>data/summary.js tidak ditemukan. Buka via folder dashboard/ atau jalankan tools/aggregate.ps1.</p>"; return; }
  if(!(DATA.users&&DATA.users.length)){ enter(null,false); return; }
  var saved=null; try{ saved=sessionStorage.getItem("qoala.session"); }catch(e){}
  var u=saved?findUser(saved):null;
  if(u) enter(u,false); else showLogin("");
}
function startDashboard(){
  var years=[...new Set(DATA.months.map(function(m){return m.slice(0,4);}))].sort();
  var yEl=$("fYear"); yEl.innerHTML='<option value="ALL">Semua</option>'+years.map(function(y){return '<option>'+y+'</option>';}).join("");
  var mEl=$("fMonth"); mEl.innerHTML='<option value="ALL">Semua</option>'+MON.map(function(m,i){var v=String(i+1).padStart(2,"0");return '<option value="'+v+'">'+m+'</option>';}).join("");
  fill("fIns",DATA.insurance,clean); fill("fPart",DATA.partner,clean);
  fill("fAm",DATA.am,clean); fill("fSpa",DATA.spa,clean);
  fill("fPa",DATA.pa,clean); fill("fProm",DATA.prom,clean);
  fill("fProd",DATA.product,clean); fill("fStore",DATA.store,clean);
  fill("fStatus",DATA.status,clean);
  [["fYear","year"],["fMonth","month"],["fIns","ins"],["fPart","part"],["fAm","am"],["fSpa","spa"],["fPa","pa"],["fProm","prom"],["fProd","prod"],["fStore","store"],["fStatus","status"]].forEach(function(p){
    $(p[0]).addEventListener("change",function(e){ F[p[1]]=e.target.value; render(aggregate()); });
  });
  $("btnReset").addEventListener("click",function(){
    F={year:"ALL",month:"ALL",ins:"ALL",part:"ALL",am:"ALL",spa:"ALL",pa:"ALL",prom:"ALL",prod:"ALL",store:"ALL",status:"ALL"};
    ["fYear","fMonth","fIns","fPart","fAm","fSpa","fPa","fProm","fProd","fStore","fStatus"].forEach(function(id){$(id).value="ALL";});
    render(aggregate());
  });
  $("btnCsv").addEventListener("click",function(){
    var agg=aggregate(),vis=visibleMonths();
    var csv="bulan,nop,gwp,avg_per_polis\n"+vis.map(function(i){return DATA.months[i]+","+agg.mNop[i]+","+Math.round(agg.mGwp[i])+","+Math.round(agg.mNop[i]?agg.mGwp[i]/agg.mNop[i]:0);}).join("\n");
    var b=new Blob([csv],{type:"text/csv"}); var a=document.createElement("a");
    a.href=URL.createObjectURL(b); a.download="tren-bulanan-"+ROUTE+".csv"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
  });
  $("burger").addEventListener("click",function(){ document.body.classList.toggle("nav-open"); });
  $("scrim").addEventListener("click",function(){ document.body.classList.remove("nav-open"); });
  document.querySelectorAll(".side-nav a").forEach(function(a){
    a.addEventListener("click",function(){ document.body.classList.remove("nav-open"); });
  });
  window.addEventListener("hashchange",function(){
    var h=(location.hash||"").replace("#/","");
    if(PAGES[h]){ ROUTE=h; renderRoute(); }
  });
  var h0=(location.hash||"").replace("#/","");
  ROUTE=PAGES[h0]?h0:"summary";
  if(!location.hash) location.hash="#/summary";
  $("sideFoot").innerHTML=fmtInt(DATA.facts.length)+" polis · "+DATA.months.length+" bulan<br>Target Okt-2026: "+((DATA.target&&DATA.target.length)||0)+" store";
  renderRoute();
}
if(DATA&&DATA.months){ init(); }
else{
  fetch("data/summary.json").then(function(r){return r.json();}).then(function(j){ DATA=j; init(); }).catch(function(){
    document.body.innerHTML="<p style='padding:24px'>Gagal memuat data. Pastikan <b>dashboard/data/summary.js</b> ada atau buka via HTTP server.</p>";
  });
}
})();
