/* Sales Monitoring Dashboard - vanilla JS, no deps. Works via file:// */
(function(){
"use strict";
var DATA = window.DASHBOARD_DATA || null;
var BLANK = "(Kosong)";
function clean(s){ if(s==="#-1"||s===""||s==null) return BLANK; return s; }
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
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

var F = {year:"ALL",month:"ALL",ins:"ALL",part:"ALL",prod:"ALL",store:"ALL",status:"ALL",pa:"ALL"};
var monthMode="both";
var tgtQ="", tgtSort="tg", tgtTab="all";
function norm(s){ return String(s==null?"":s).trim().toLowerCase().replace(/\s+/g," "); }

function $(id){ return document.getElementById(id); }
function fill(sel, items, fmt){
  var el=$(sel); el.innerHTML="";
  var o=document.createElement("option"); o.value="ALL"; o.textContent="Semua"; el.appendChild(o);
  items.forEach(function(v,i){ var op=document.createElement("option"); op.value=String(i); op.textContent=fmt?fmt(v):v; el.appendChild(op); });
}
function passFact(f, ignoreYearMonth){
  // f=[mi,ins,part,prod,store,status,pa,gwp,nop]
  var ym=DATA.months[f[0]];
  if(!ignoreYearMonth){
    if(F.year!=="ALL" && ym.slice(0,4)!==F.year) return false;
    if(F.month!=="ALL" && ym.slice(5,7)!==F.month) return false;
  }
  if(F.ins!=="ALL"&&String(f[1])!==F.ins) return false;
  if(F.part!=="ALL"&&String(f[2])!==F.part) return false;
  if(F.prod!=="ALL"&&String(f[3])!==F.prod) return false;
  if(F.store!=="ALL"&&String(f[4])!==F.store) return false;
  if(F.status!=="ALL"&&String(f[5])!==F.status) return false;
  if(F.pa!=="ALL"&&String(f[6])!==F.pa) return false;
  return true;
}

function aggregate(){
  var nM=DATA.months.length;
  var mNop=new Array(nM).fill(0), mGwp=new Array(nM).fill(0);
  var byYear={}, byProd={}, byStore={}, byPa={}, byPart={}, byStatus={}, byIns={};
  var totN=0, totG=0;
  var facts=DATA.facts;
  for(var k=0;k<facts.length;k++){
    var f=facts[k];
    if(!passFact(f,false)) continue;
    mNop[f[0]]+=f[8]; mGwp[f[0]]+=f[7];
    totN+=f[8]; totG+=f[7];
    var y=DATA.months[f[0]].slice(0,4);
    if(!byYear[y]) byYear[y]={n:0,g:0}; byYear[y].n+=f[8]; byYear[y].g+=f[7];
    var pn=clean(DATA.product[f[3]]); if(!byProd[pn])byProd[pn]={n:0,g:0}; byProd[pn].n+=f[8]; byProd[pn].g+=f[7];
    var st=clean(DATA.store[f[4]]); if(!byStore[st])byStore[st]={n:0,g:0}; byStore[st].n+=f[8]; byStore[st].g+=f[7];
    var pa=clean(DATA.pa[f[6]]); if(!byPa[pa])byPa[pa]={n:0,g:0}; byPa[pa].n+=f[8]; byPa[pa].g+=f[7];
    var pt=clean(DATA.partner[f[2]]); if(!byPart[pt])byPart[pt]={n:0,g:0}; byPart[pt].n+=f[8]; byPart[pt].g+=f[7];
    var ss=clean(DATA.status[f[5]]); if(!byStatus[ss])byStatus[ss]={n:0,g:0}; byStatus[ss].n+=f[8]; byStatus[ss].g+=f[7];
    var ii=clean(DATA.insurance[f[1]]); if(!byIns[ii])byIns[ii]={n:0,g:0}; byIns[ii].n+=f[8]; byIns[ii].g+=f[7];
  }
  return {mNop:mNop,mGwp:mGwp,byYear:byYear,byProd:byProd,byStore:byStore,byPa:byPa,byPart:byPart,byStatus:byStatus,byIns:byIns,totN:totN,totG:totG};
}
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
  var el=$(elId); el.innerHTML="";
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
  var g0=document.createElementNS(ns,"g");
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
  // tooltip
  var tip=document.querySelector(".tip");
  if(!tip){ tip=document.createElement("div"); tip.className="tip"; document.body.appendChild(tip); }
  svg.querySelectorAll("[data-tip]").forEach(function(n){
    n.addEventListener("mousemove",function(e){ tip.style.display="block"; tip.style.left=(e.clientX+12)+"px"; tip.style.top=(e.clientY+12)+"px"; tip.innerText=n.dataset.tip; });
    n.addEventListener("mouseleave",function(){ tip.style.display="none"; });
  });
}

function barList(elId, entries, totalG){
  var el=$(elId); el.innerHTML="";
  if(!entries.length){ el.innerHTML='<p class="muted">Tidak ada data.</p>'; return; }
  var mx=entries[0].g||1;
  entries.forEach(function(e){
    var d=document.createElement("div"); d.className="bar-row";
    d.innerHTML='<span class="n">'+esc(e.k)+'</span><span class="v">'+fmtInt(e.n)+' · '+fmtIDR(e.g)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,(e.g/mx*100)).toFixed(1)+'%"></div></div>';
    el.appendChild(d);
  });
}

function render(agg){
  var vis=visibleMonths();
  var labels=vis.map(function(i){return ymLabel(DATA.months[i]);});
  var nop=vis.map(function(i){return agg.mNop[i];});
  var gwp=vis.map(function(i){return agg.mGwp[i];});
  // KPIs
  var active=vis.filter(function(i){return agg.mNop[i]>0;}).length;
  var avg=agg.totN?agg.totG/agg.totN:0;
  var nzNop=nop.filter(function(v){return v>0;});
  var last=nzNop.length?nzNop[nzNop.length-1]:0, prev=nzNop.length>1?nzNop[nzNop.length-2]:0;
  var momN=(prev>0)?(last-prev)/prev:NaN;
  var gnz=gwp.filter(function(v){return v>0;});
  var lastG=gnz.length?gnz[gnz.length-1]:0, prevG=gnz.length>1?gnz[gnz.length-2]:0;
  var momG=(prevG>0)?(lastG-prevG)/prevG:NaN;
  function delta(v){ var c=!isFinite(v)?"flat":(v>0.0005?"up":(v<-0.0005?"down":"flat")); return '<div class="d '+c+'">'+fmtPct(v)+' MoM</div>'; }
  $("kpis").innerHTML=
    '<div class="kpi"><div class="t">Total NoP</div><div class="v">'+fmtInt(agg.totN)+'</div>'+delta(momN)+'</div>'+
    '<div class="kpi"><div class="t">Total GWP</div><div class="v">'+fmtIDR(agg.totG)+'</div>'+delta(momG)+'</div>'+
    '<div class="kpi"><div class="t">Rata-rata / polis</div><div class="v">'+fmtIDR(avg)+'</div><div class="d flat">'+active+' bulan aktif</div></div>'+
    '<div class="kpi"><div class="t">Periode tampil</div><div class="v" style="font-size:17px">'+(labels.length?(labels[0]+" → "+labels[labels.length-1]):"—")+'</div><div class="d flat">'+fmtInt(agg.totN/Math.max(active,1))+' polis/bln · '+fmtIDR(agg.totG/Math.max(active,1))+'/bln</div></div>';
  // charts
  if(!labels.length){ $("monthlyChart").innerHTML='<p class="muted">Tidak ada bulan yang cocok dengan filter.</p>'; }
  else dualChart("monthlyChart",labels,nop,gwp,monthMode);
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
  // breakdowns
  barList("topProd",topEntries(agg.byProd,8));
  barList("topStore",topEntries(agg.byStore,8));
  barList("topPa",topEntries(agg.byPa,8));
  var mix=[["Partner",agg.byPart],["Status",agg.byStatus],["Insurance",agg.byIns]];
  var mh="";
  mix.forEach(function(pair){
    mh+='<h3 style="font-size:13px;margin:12px 0 4px">'+pair[0]+'</h3>';
    topEntries(pair[1],6).forEach(function(e){
      var tot=agg.totG||1;
      mh+='<div class="bar-row"><span class="n">'+esc(e.k)+'</span><span class="v">'+(e.g/tot*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'%</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,e.g/(topEntries(pair[1],6)[0].g||1)*100).toFixed(1)+'%"></div></div>';
    });
  });
  $("mixBox").innerHTML=mh;
  renderTrend(agg,vis);
  renderTable(agg,vis);
  renderTarget();
  var actF=[F.year,F.month,F.ins,F.part,F.prod,F.store,F.status,F.pa].filter(function(v){return v!=="ALL";}).length;
  $("filterCount").textContent=actF?actF+" filter aktif · "+fmtInt(agg.totN)+" polis":"Tanpa filter · "+fmtInt(agg.totN)+" polis";
  $("periodSub").textContent=(labels.length?("Periode tampil: "+labels[0]+" → "+labels[labels.length-1]+" · "):"")+"Sumber: Data-raw.xlsx ("+fmtInt(DATA.facts.length)+" baris)";
  $("metaLine").textContent="Dibuat "+(DATA.meta&&DATA.meta.generated?DATA.meta.generated:"")+" · NoP=SUM(NoP) · GWP=SUM(gwp) · Target: "+((DATA.targetMeta&&DATA.targetMeta.source)||"Target.xlsx")+" ("+((DATA.target&&DATA.target.length)||0)+" store, Okt-2026 per 15 Okt)";
}

function renderTrend(agg,vis){
  var cards=[],items=[];
  if(!vis.length){ $("trendCards").innerHTML=""; $("trendList").innerHTML="<li>Tidak ada data pada filter ini.</li>"; return; }
  var bi=vis[0],wi=vis[0],bg=-1,wg=Infinity;
  vis.forEach(function(i){ if(agg.mGwp[i]>bg){bg=agg.mGwp[i];bi=i;} if(agg.mNop[i]>0&&agg.mGwp[i]<wg){wg=agg.mGwp[i];wi=i;} });
  var nz=vis.filter(function(i){return agg.mNop[i]>0;});
  var avgN=agg.totN/Math.max(nz.length,1), avgG=agg.totG/Math.max(nz.length,1);
  // MoM last
  var l1=nz[nz.length-1],l0=nz.length>1?nz[nz.length-2]:null;
  var momNt=l0!=null&&agg.mNop[l0]>0?(agg.mNop[l1]-agg.mNop[l0])/agg.mNop[l0]:NaN;
  var momGt=l0!=null&&agg.mGwp[l0]>0?(agg.mGwp[l1]-agg.mGwp[l0])/agg.mGwp[l0]:NaN;
  // YoY same calendar month, other dims same, year ignored
  var lastYm=DATA.months[l1], mm=lastYm.slice(5,7), y0=String(+lastYm.slice(0,4)-1), ym0=y0+"-"+mm;
  var i0=DATA.months.indexOf(ym0);
  var yoyNt=NaN,yoyGt=NaN;
  if(i0>=0){
    var t1={n:0,g:0},t0={n:0,g:0};
    for(var k=0;k<DATA.facts.length;k++){ var f=DATA.facts[k];
      if(!passFact(f,true)) continue;
      var ym=DATA.months[f[0]];
      if(ym===lastYm){t1.n+=f[8];t1.g+=f[7];}
      if(ym===ym0){t0.n+=f[8];t0.g+=f[7];}
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
  var tb=$("monthTable").querySelector("tbody"); tb.innerHTML="";
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
function renderTarget(){
  var box=$("tgtSec"); if(!box) return;
  if(!DATA.target||!DATA.target.length||!DATA.targetMeta){ box.style.display="none"; return; }
  box.style.display="";
  var tm=DATA.targetMeta, octIdx=DATA.months.indexOf(tm.month), fac=tm.factor||(31/15);
  var selStoreNorm=F.store!=="ALL"?norm(clean(DATA.store[+F.store])):null;
  var selPart=F.part!=="ALL"?norm(clean(DATA.partner[+F.part])):null;
  var selPa=F.pa!=="ALL"?norm(clean(DATA.pa[+F.pa])):null;
  var extraActive=(F.prod!=="ALL"||F.ins!=="ALL"||F.status!=="ALL");
  // aktual Okt per store-norm (hormati filter produk/insurance/status + store/partner/PA)
  var act={};
  if(octIdx>=0){
    var facts=DATA.facts;
    for(var k=0;k<facts.length;k++){
      var f=facts[k];
      if(f[0]!==octIdx) continue;
      if(F.prod!=="ALL"&&String(f[3])!==F.prod) continue;
      if(F.ins!=="ALL"&&String(f[1])!==F.ins) continue;
      if(F.status!=="ALL"&&String(f[5])!==F.status) continue;
      if(selPart&&norm(clean(DATA.partner[f[2]]))!==selPart) continue;
      if(selPa&&norm(clean(DATA.pa[f[6]]))!==selPa) continue;
      var sn=norm(clean(DATA.store[f[4]]));
      if(selStoreNorm&&sn!==selStoreNorm) continue;
      if(!act[sn]) act[sn]={n:0,g:0};
      act[sn].n+=f[8]; act[sn].g+=f[7];
    }
  }
  var rows=DATA.target.filter(function(t){
    if(selStoreNorm&&norm(t.s)!==selStoreNorm) return false;
    if(selPart&&norm(t.p||"")!==selPart) return false;
    if(selPa&&norm(t.pa||"")!==selPa) return false;
    return true;
  }).map(function(t){
    var a=act[norm(t.s)]||{n:0,g:0};
    var hasT=(t.tg||0)>0||(t.tn||0)>0;
    var achN=t.tn>0?a.n/t.tn:NaN, achG=t.tg>0?a.g/t.tg:NaN;
    var eN=a.n*fac, eG=a.g*fac;
    var estA=(t.tg>0)?eG/t.tg:(t.tn>0?eN/t.tn:NaN);
    return {s:t.s,pa:t.pa||"—",tn:t.tn||0,tg:t.tg||0,an:a.n,ag:a.g,achN:achN,achG:achG,eN:eN,eG:eG,estA:estA,st:tgtStatus(estA,hasT)};
  });
  // tab
  var fr=rows.filter(function(r){
    if(tgtTab==="done") return r.st.t==="Tercapai";
    if(tgtTab==="behind") return r.st.t!=="Tercapai";
    return true;
  });
  // search
  var q=norm(tgtQ);
  if(q) fr=fr.filter(function(r){ return norm(r.s+" "+r.pa).indexOf(q)>=0; });
  // totals dari rows (sebelum tab/search agar KPI stabil ikut filter dropdown)
  var tN=0,tG=0,aN=0,aG=0;
  rows.forEach(function(r){ tN+=r.tn; tG+=r.tg; aN+=r.an; aG+=r.ag; });
  var achN=tN>0?aN/tN:NaN, achG=tG>0?aG/tG:NaN, eNt=aN*fac, eGt=aG*fac;
  var estAN=tN>0?eNt/tN:NaN, estAG=tG>0?eGt/tG:NaN;
  function dc(v){ var c=!isFinite(v)?"flat":(v>=1?"up":"down"); return '<div class="d '+c+'">'+(isFinite(v)?(v*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div>'; }
  $("tgtKpis").innerHTML=
    '<div class="kpi"><div class="t">Ach NoP (15 Okt)</div><div class="v">'+(isFinite(achN)?(achN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtInt(aN)+' / '+fmtInt(tN)+'</div></div>'+
    '<div class="kpi"><div class="t">Ach GWP (15 Okt)</div><div class="v">'+(isFinite(achG)?(achG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtIDR(aG)+' / '+fmtIDR(tG)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach NoP (EOM)</div><div class="v">'+(isFinite(estAN)?(estAN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtInt(eNt)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach GWP (EOM)</div><div class="v">'+(isFinite(estAG)?(estAG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtIDR(eGt)+'</div></div>';
  var pace=15/31;
  $("tgtNote").textContent="Periode dikunci Okt-2026 · data per 15 Okt (pace linear "+(pace*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%) · estimasi EOM = aktual ×31/15 · mengikuti filter Store/Partner/PA"+(extraActive?" · aktual juga difilter Produk/Insurance/Status (target tetap level store)":"")+" · "+rows.length+" store tampil.";
  // sort
  fr.sort(function(a,b){
    if(tgtSort==="achLo") return (isFinite(a.achG)?a.achG:-1)-(isFinite(b.achG)?b.achG:-1);
    if(tgtSort==="achHi") return (isFinite(b.achG)?b.achG:-1)-(isFinite(a.achG)?a.achG:-1);
    if(tgtSort==="gap") return (b.tg-b.ag)-(a.tg-a.ag);
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

function init(){
  if(!DATA){ document.body.innerHTML="<p style='padding:24px'>data/summary.js tidak ditemukan. Buka via folder dashboard/ atau jalankan tools/aggregate.ps1.</p>"; return; }
  // normalize -1 labels already handled by clean()
  var years=[...new Set(DATA.months.map(function(m){return m.slice(0,4);}))].sort();
  var yEl=$("fYear"); yEl.innerHTML='<option value="ALL">Semua</option>'+years.map(function(y){return '<option>'+y+'</option>';}).join("");
  var mEl=$("fMonth"); mEl.innerHTML='<option value="ALL">Semua</option>'+MON.map(function(m,i){var v=String(i+1).padStart(2,"0");return '<option value="'+v+'">'+m+'</option>';}).join("");
  fill("fIns",DATA.insurance,clean); fill("fPart",DATA.partner,clean);
  fill("fProd",DATA.product,clean); fill("fStore",DATA.store,clean);
  fill("fStatus",DATA.status,clean); fill("fPa",DATA.pa,clean);
  [["fYear","year"],["fMonth","month"],["fIns","ins"],["fPart","part"],["fProd","prod"],["fStore","store"],["fStatus","status"],["fPa","pa"]].forEach(function(p){
    $(p[0]).addEventListener("change",function(e){ F[p[1]]=e.target.value; render(aggregate()); });
  });
  $("btnReset").addEventListener("click",function(){
    F={year:"ALL",month:"ALL",ins:"ALL",part:"ALL",prod:"ALL",store:"ALL",status:"ALL",pa:"ALL"};
    ["fYear","fMonth","fIns","fPart","fProd","fStore","fStatus","fPa"].forEach(function(id){$(id).value="ALL";});
    render(aggregate());
  });
  $("btnCsv").addEventListener("click",function(){
    var agg=aggregate(),vis=visibleMonths();
    var csv="bulan,nop,gwp,avg_per_polis\n"+vis.map(function(i){return DATA.months[i]+","+agg.mNop[i]+","+Math.round(agg.mGwp[i])+","+Math.round(agg.mNop[i]?agg.mGwp[i]/agg.mNop[i]:0);}).join("\n");
    var b=new Blob([csv],{type:"text/csv"}); var a=document.createElement("a");
    a.href=URL.createObjectURL(b); a.download="tren-bulanan.csv"; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
  });
  document.querySelectorAll("#monthTabs button").forEach(function(b){
    b.addEventListener("click",function(){
      document.querySelectorAll("#monthTabs button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); monthMode=b.dataset.m; render(aggregate());
    });
  });
  var ts=$("tgtSearch"); if(ts) ts.addEventListener("input",function(e){ tgtQ=e.target.value; renderTarget(); });
  var so=$("tgtSort"); if(so) so.addEventListener("change",function(e){ tgtSort=e.target.value; renderTarget(); });
  document.querySelectorAll("#tgtTabs button").forEach(function(b){
    b.addEventListener("click",function(){
      document.querySelectorAll("#tgtTabs button").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on"); tgtTab=b.dataset.t; renderTarget();
    });
  });
  // fallback fetch if summary.js missing but json reachable (http server)
  render(aggregate());
}
if(DATA&&DATA.months){ init(); }
else{
  fetch("data/summary.json").then(function(r){return r.json();}).then(function(j){ DATA=j; init(); }).catch(function(){
    document.body.innerHTML="<p style='padding:24px'>Gagal memuat data. Pastikan <b>dashboard/data/summary.js</b> ada atau buka via HTTP server.</p>";
  });
}
})();
