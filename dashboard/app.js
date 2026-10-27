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
function fmtPctPlain(x){ if(!isFinite(x)) return "—"; return (x*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%"; }
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

/* fakta: [mi,ins,part,prod,store,status,am,spa,pa,prom,gwp,nop,day,brand,cat,dur]
   brand = indeks DATA.brand (device brand), cat = DATA.cat (kategori perangkat),
   dur = DATA.dur (durasi polis dalam bulan) — dipakai kartu Kontribusi. */
/* setiap filter = array pilihan (multi-pilih). array kosong = semua */
var F = {year:[],month:[],ins:[],part:[],am:[],spa:[],pa:[],prom:[],prod:[],store:[],status:[]};
function fAll(v){ return !v||v.length===0; }
function fHit(v,val){ return fAll(v)||v.indexOf(String(val))>=0; }
var SCOPE = {spa:"ALL", pa:"ALL", prom:"ALL"};
var ROUTE = "summary";
var monthMode="both";
var TGT = {summary:{q:"",sort:"tg",tab:"all"},spa:{q:"",sort:"tg",tab:"all"},pa:{q:"",sort:"tg",tab:"all"},promotor:{q:"",sort:"tg",tab:"all"}};
/* ---- pencarian nama (store / PA / promotor / AM) --------------------------
   Kotak "Cari nama" berlaku untuk SELURUH halaman: kartu KPI, tren bulanan/harian,
   blok peringkat & kontribusi, sampai tabel Target vs Achievement.
   Haystack per-store dibangun sekali setiap kata kunci berubah supaya passFact
   (dipanggil 148 ribu kali per render) tetap cepat. */
var SEARCH_Q="", SEARCH_HAY=null, SEARCH_READY=false, searchTimer=null;
/* Mode laporan (khusus Administrator): sembunyikan kolom PA, Promotor & kolom NoP,
   tampilkan semua baris tabel supaya mudah di-screenshot. Default mati. */
var RPT=false, SHOT=false;
function isAdminUser(){ return !!(USER && roleKind(USER.r)==="admin"); }
function searchPrep(){
  var q=norm((TGT[ROUTE]&&TGT[ROUTE].q)||"");
  if(SEARCH_READY && q===SEARCH_Q) return;
  SEARCH_Q=q; SEARCH_HAY=null; SEARCH_READY=true;
  if(!q) return;
  var a=[], facts=DATA.facts;
  for(var k=0;k<facts.length;k++){
    var f=facts[k], si=f[4];
    if(si==null||si<0||a[si]) continue;
    a[si]=norm(clean(DATA.store[si])+" "+clean(DATA.pa[f[8]])+" "+clean(DATA.prom[f[9]])+" "+clean(DATA.am[f[6]]));
  }
  SEARCH_HAY=a;
}
function searchHitStore(si){
  if(!SEARCH_Q) return true;
  var h=SEARCH_HAY?SEARCH_HAY[si]:null;
  return !!h && h.indexOf(SEARCH_Q)>=0;
}
function searchHitText(str){
  if(!SEARCH_Q) return true;
  return norm(str||"").indexOf(SEARCH_Q)>=0;
}

var PAGES = {
  summary:{title:"Summary", scope:null},
  spa:{title:"SPA", scope:"spa", list:"spa", label:"Pilih SPA"},
  pa:{title:"PA", scope:"pa", list:"pa", label:"Pilih PA"},
  promotor:{title:"Promotor", scope:"prom", list:"prom", label:"Pilih Promotor"},
  best:{title:"Best Achievement", scope:null, eyebrow:"SALES MONITORING · BEST ACHIEVEMENT"},
  campaign:{title:"Campaign 2026", scope:null, eyebrow:"SALES MONITORING · CAMPAIGN 2026"},
  account:{title:"Account", scope:null, eyebrow:"SETTING · ACCOUNT", admin:1},
  keamanan:{title:"Keamanan", scope:null, eyebrow:"SETTING · KEAMANAN", admin:1}
};
var BREAKS = {
  summary:[{id:"B1",t:"Top produk",map:"byProd"},{id:"B2",t:"Top store",map:"byStore"},{id:"B3",t:"Rank By Partnership Associate",map:"byPa"}],
  spa:[{id:"B1",t:"Rank By Area Manager",map:"byAm"},{id:"B2",t:"Rank By Partnership Associate",map:"byPa"},{id:"B3",t:"Rank By Promoters",map:"byProm"},
       {id:"B4",t:"Contribution By Product",map:"byProd",c:1,half:1},
       {id:"B5",t:"Contribution By Tenor",map:"byDurM",c:1,half:1,m:1},
       {id:"B6",t:"Contribution By Brand <span class='muted-sm'>(Apple, Samsung, etc.)</span>",map:"byBrandM",c:1,half:1,m:1},
       {id:"B7",t:"Contribution By Category <span class='muted-sm'>(smartphone, watch, etc.)</span>",map:"byCatM",c:1,half:1,m:1},
       {id:"B8",t:"Contribution By Business Unit <span class='muted-sm'>(Digimap &amp; Digiplus)</span>",sc:1,partners:["Digimap","Digiplus"]}],
  pa:[{id:"B1",t:"Top produk",map:"byProd"},{id:"B2",t:"Top store",map:"byStore"},{id:"B3",t:"Rank By Promoters",map:"byProm"}],
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
  if(BLOCKED) return false;
  if(SEARCH_Q && !searchHitStore(f[4])) return false;
  if(!ignoreYearMonth){
    if(!fHit(F.year,ym.slice(0,4))) return false;
    if(!fHit(F.month,ym.slice(5,7))) return false;
  }
  if(!fHit(F.ins,f[1])) return false;
  if(!fHit(F.part,f[2])) return false;
  if(!fHit(F.am,f[6])) return false;
  if(!fHit(F.spa,f[7])) return false;
  if(!fHit(F.pa,f[8])) return false;
  if(!fHit(F.prom,f[9])) return false;
  if(!fHit(F.prod,f[3])) return false;
  if(!fHit(F.store,f[4])) return false;
  if(!fHit(F.status,f[5])) return false;
  if(ROUTE==="spa"&&SCOPE.spa!=="ALL"&&String(f[7])!==SCOPE.spa) return false;
  if(ROUTE==="pa"&&SCOPE.pa!=="ALL"&&String(f[8])!==SCOPE.pa) return false;
  if(ROUTE==="promotor"&&SCOPE.prom!=="ALL"&&String(f[9])!==SCOPE.prom) return false;
  return true;
}

function aggregate(){
  searchPrep();
  var nM=DATA.months.length;
  var mNop=new Array(nM).fill(0), mGwp=new Array(nM).fill(0);
  var byYear={}, byProd={}, byStore={}, byPart={}, byStatus={}, byIns={};
  var byAm={}, bySpa={}, byPa={}, byProm={};
  /* byProdM/byStoreM = khusus bulan berjalan (bulan terakhir yang lolos filter) */
  var byProdM={}, byStoreM={}, byBrandM={}, byCatM={}, byDurM={};
  var visM=visibleMonths(), miF=visM.length?visM[visM.length-1]:-1;
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
    if(f[0]===miF){
      addM(byProdM,clean(DATA.product[f[3]]),f); addM(byStoreM,clean(DATA.store[f[4]]),f);
      /* kontribusi (bulan berjalan): brand, kategori perangkat, durasi polis */
      addM(byBrandM,clean((DATA.brand||[])[f[13]])||"(tanpa brand)",f);
      addM(byCatM,clean((DATA.cat||[])[f[14]])||"(tanpa kategori)",f);
      var dv0=(DATA.dur||[])[f[15]];
      addM(byDurM, (dv0==null||dv0==="") ? "(tanpa durasi)" : (dv0+" bulan"), f);
    }
    addM(byPart,clean(DATA.partner[f[2]]),f); addM(byStatus,clean(DATA.status[f[5]]),f);
    addM(byIns,clean(DATA.insurance[f[1]]),f);
    addM(byAm,clean(DATA.am[f[6]]),f); addM(bySpa,clean(DATA.spa[f[7]]),f);
    addM(byPa,clean(DATA.pa[f[8]]),f); addM(byProm,clean(DATA.prom[f[9]]),f);
  }
  return {mNop:mNop,mGwp:mGwp,byYear:byYear,byProd:byProd,byStore:byStore,byProdM:byProdM,byStoreM:byStoreM,byBrandM:byBrandM,byCatM:byCatM,byDurM:byDurM,miF:miF,byPart:byPart,byStatus:byStatus,byIns:byIns,byAm:byAm,bySpa:bySpa,byPa:byPa,byProm:byProm,totN:totN,totG:totG};
}
function addM(map,key,f){ if(!map[key])map[key]={n:0,g:0}; map[key].n+=f[11]; map[key].g+=f[10]; }
function visibleMonths(){
  var out=[];
  for(var i=0;i<DATA.months.length;i++){
    var ym=DATA.months[i];
    if(!fHit(F.year,ym.slice(0,4))) continue;
    if(!fHit(F.month,ym.slice(5,7))) continue;
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
    ln.setAttribute("stroke","#ede7dd");svg.appendChild(ln);
    var t1=document.createElementNS(ns,"text");
    t1.setAttribute("x",pl-8);t1.setAttribute("y",yv+4);t1.setAttribute("text-anchor","end");t1.setAttribute("font-size","11");t1.setAttribute("fill","#78716c");
    t1.textContent=fmtInt(maxN*(1-gi/4));svg.appendChild(t1);
    var t2=document.createElementNS(ns,"text");
    t2.setAttribute("x",W-pr+8);t2.setAttribute("y",yv+4);t2.setAttribute("font-size","11");t2.setAttribute("fill","#78716c");
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
      r.setAttribute("rx","6");r.setAttribute("fill","#fdba74");r.setAttribute("stroke","#d97706");r.setAttribute("stroke-width","1.2");
      r.dataset.tip=labels[i]+"\nNoP: "+fmtInt(nop[i])+"\nGWP: "+fmtIDR(gwp[i]);
      svg.appendChild(r);
    }
    if(mode!=="nop"){ pts.push([x,YG(gwp[i])]); var c=document.createElementNS(ns,"circle");
      c.setAttribute("cx",x);c.setAttribute("cy",YG(gwp[i]));c.setAttribute("r","4.5");c.setAttribute("fill","#1d4ed8");c.setAttribute("stroke","#fff");c.setAttribute("stroke-width","2");
      c.dataset.tip=labels[i]+"\nNoP: "+fmtInt(nop[i])+"\nGWP: "+fmtIDR(gwp[i]);
      svg.appendChild(c); }
    if(labels.length<=21||i%2===0){
      var tx=document.createElementNS(ns,"text");
      tx.setAttribute("x",x);tx.setAttribute("y",H-12);tx.setAttribute("text-anchor",labels.length>12?"end":"middle");
      tx.setAttribute("font-size","11");tx.setAttribute("fill","#57534e");
      if(labels.length>12){tx.setAttribute("transform","rotate(-32 "+x+" "+(H-12)+")");}
      tx.textContent=labels[i];svg.appendChild(tx);
    }
  }
  if(mode!=="nop"&&pts.length>1){
    var d="M"+pts.map(function(p){return p[0].toFixed(1)+" "+p[1].toFixed(1);}).join(" L");
    var pa=document.createElementNS(ns,"path");
    pa.setAttribute("d",d);pa.setAttribute("fill","none");pa.setAttribute("stroke","#1d4ed8");pa.setAttribute("stroke-width","3");pa.setAttribute("stroke-linecap","round");
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
    ln.setAttribute("stroke","#ede7dd"); svg.appendChild(ln);
    var t=document.createElementNS(ns,"text");
    t.setAttribute("x",pl-8);t.setAttribute("y",yv+4);t.setAttribute("text-anchor","end");t.setAttribute("font-size","11");t.setAttribute("fill","#78716c");
    t.textContent=fmtInt(mx*(1-gi/4)); svg.appendChild(t);
  }
  var dt="",da="";
  for(var i=0;i<n;i++){ da+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(actual[i]).toFixed(1)+" "; if(target) dt+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(target[i]).toFixed(1)+" "; }
  var ar=document.createElementNS(ns,"path");
  ar.setAttribute("d",da+"L"+X(n-1).toFixed(1)+" "+(pt+ih)+" L"+X(0).toFixed(1)+" "+(pt+ih)+" Z");
  ar.setAttribute("fill","rgba(29,78,216,.12)"); svg.appendChild(ar);
  if(target){
    var pt2=document.createElementNS(ns,"path");
    pt2.setAttribute("d",dt); pt2.setAttribute("fill","none"); pt2.setAttribute("stroke","#d97706"); pt2.setAttribute("stroke-width","2.5"); pt2.setAttribute("stroke-dasharray","7 5");
    svg.appendChild(pt2);
  }
  var p2=document.createElementNS(ns,"path");
  p2.setAttribute("d",da); p2.setAttribute("fill","none"); p2.setAttribute("stroke","#1d4ed8"); p2.setAttribute("stroke-width","3"); p2.setAttribute("stroke-linecap","round");
  svg.appendChild(p2);
  for(var j=0;j<n;j++){
    var cc=document.createElementNS(ns,"circle");
    cc.setAttribute("cx",X(j)); cc.setAttribute("cy",Y(actual[j])); cc.setAttribute("r",j===n-1?5:4);
    cc.setAttribute("fill",j===n-1?"#1d4ed8":"transparent"); cc.setAttribute("stroke",j===n-1?"#fff":"none"); cc.setAttribute("stroke-width","2");
    cc.dataset.tip="Tgl "+labels[j]+"\nAktual kumulatif: "+fmtInt(actual[j])+(target?("\nPace target: "+fmtInt(target[j])+"\nSelisih: "+(actual[j]-target[j]>=0?"+":"")+fmtInt(actual[j]-target[j])):"");
    svg.appendChild(cc);
    var tx=document.createElementNS(ns,"text");
    tx.setAttribute("x",X(j)); tx.setAttribute("y",H-12); tx.setAttribute("text-anchor","middle"); tx.setAttribute("font-size","10.5"); tx.setAttribute("fill","#57534e");
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

/* kontribusi (share) per dimensi — mengikuti filter yang aktif.
   Basis share = GWP periode yang sama dengan baris yang ditampilkan,
   ditampilkan juga share NoP-nya. */
function contribList(elId, entries, baseG, baseN, note){
  var el=$(elId); if(!el) return;
  if(!entries.length){ el.innerHTML='<p class="muted">Tidak ada data pada filter ini.</p>'; return; }
  var mx=entries[0].g||1, tot=baseG||0, totN=baseN||0;
  var h='<p class="muted contrib-note">'+(note||"")+' Total: '+fmtIDR(tot)+' · '+fmtInt(totN)+' polis</p>';
  entries.forEach(function(e){
    var sh=tot>0?(e.g/tot*100):0, shN=totN>0?(e.n/totN*100):0;
    h+='<div class="bar-row contrib">'+
         '<span class="n" title="'+esc(e.k)+'">'+esc(e.k)+'</span>'+
         '<span class="v">'+sh.toLocaleString("id-ID",{maximumFractionDigits:1})+'%</span>'+
         '<div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,(e.g/mx*100)).toFixed(1)+'%"></div></div>'+
         '<span class="v2">'+fmtInt(e.n)+' polis ('+shN.toLocaleString("id-ID",{maximumFractionDigits:1})+'%) · '+fmtIDR(e.g)+'</span>'+
       '</div>';
  });
  el.innerHTML=h;
}

/* Scorecard kontribusi per partner (Digimap & Digiplus):
   NoP, GWP, ASP, MoM, YoY, share kontribusi.
   - NoP/GWP/ASP = aktual bulan berjalan (sudah ikut semua filter aktif)
   - MoM & YoY    = estimasi EOM bulan berjalan vs AKTUAL bulan kalender sebelumnya
                    / bulan yang sama tahun lalu (sama seperti kartu KPI), jadi tetap
                    tampil walaupun bulan pembanding tidak ikut filter Tahun/Bulan
   - Share        = porsi terhadap total bulan berjalan pada filter aktif */
function renderPartnerScore(b, agg){
  var el=$(b.id), sub=$(b.id+"sub");
  if(!el) return;
  var cmp=agg.cmp;
  if(!cmp){ el.innerHTML='<p class="muted">Tidak ada data pada filter ini.</p>'; return; }
  if(sub) sub.textContent=ymLabel(cmp.ym);
  var want=(b.partners||["Digimap","Digiplus"]), pool=DATA.partner||[];
  var rows=[], i, k;
  for(i=0;i<want.length;i++){
    var low=norm(want[i]), nm=want[i];
    for(k=0;k<pool.length;k++){ if(norm(pool[k])===low) nm=clean(pool[k]); }
    var m={}; m[cmp.ym]={n:0,g:0}; m[cmp.momYm]={n:0,g:0}; m[cmp.yoyYm]={n:0,g:0};
    rows.push({low:low,nm:nm,m:m});
  }
  var facts=DATA.facts;
  for(k=0;k<facts.length;k++){
    var f=facts[k], lp=norm(DATA.partner[f[2]]), slot=null;
    for(i=0;i<rows.length;i++){ if(rows[i].low===lp){ slot=rows[i].m[DATA.months[f[0]]]; break; } }
    if(!slot) continue;
    if(!passFact(f,true)) continue; /* abaikan filter Tahun/Bulan */
    slot.n+=f[11]; slot.g+=f[10];
  }
  var mi=(agg.miF>=0?agg.miF:DATA.months.indexOf(cmp.ym));
  var totN=agg.mNop[mi]||0, totG=agg.mGwp[mi]||0;
  function pc(a,bs){ return bs>0?((a-bs)/bs):NaN; }
  function sh(v,tot){ return tot>0?(v/tot*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—"; }
  function line(lbl,html){ return '<div class="gl"><span class="g-lbl">'+lbl+'</span>'+html+'</div>'; }
  var h='<p class="muted contrib-note">Bulan berjalan <b>'+ymLabel(cmp.ym)+'</b> · NoP/GWP/ASP = aktual s/d tgl '+cmp.elapsed+
        ' · <b>MoM</b> vs '+ymLabel(cmp.momYm)+' &amp; <b>YoY</b> vs '+ymLabel(cmp.yoyYm)+
        ' pakai estimasi EOM bulan berjalan (aktual ×'+cmp.fac.toLocaleString("id-ID",{maximumFractionDigits:2})+
        '), bulan pembanding tetap aktual penuh · share = porsi dari total bulan berjalan pada filter aktif'+
        ' · Digimap &amp; Digiplus adalah nilai kolom <b>Partner</b>. Tiap sel MoM/YoY/share: baris atas GWP, bawah NoP.</p>';
  h+='<div class="tbl-wrap"><table class="sc"><thead><tr><th>Brand</th><th>NoP</th><th>GWP</th><th>ASP</th><th>MoM</th><th>YoY</th><th>Share kontribusi</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var cur=r.m[cmp.ym], mom=r.m[cmp.momYm], yoy=r.m[cmp.yoyYm];
    if(!cur.n&&!cur.g){
      h+='<tr><th scope="row" title="'+esc(r.nm)+'">'+esc(r.nm)+'</th><td>0</td><td>—</td><td>—</td>'+
         '<td class="g-flat">—</td><td class="g-flat">—</td><td class="g-flat">—</td></tr>';
      return;
    }
    var estN=cur.n*cmp.fac, estG=cur.g*cmp.fac;
    h+='<tr><th scope="row" title="'+esc(r.nm)+'">'+esc(r.nm)+'</th>'+
       '<td>'+fmtInt(cur.n)+'</td>'+
       '<td>'+fmtIDR(cur.g)+'</td>'+
       '<td>'+(cur.n?fmtIDR(cur.g/cur.n):"—")+'</td>'+
       '<td>'+line("GWP",growthSpan(pc(estG,mom.g),mom.g>0))+line("NoP",growthSpan(pc(estN,mom.n),mom.n>0))+'</td>'+
       '<td>'+line("GWP",growthSpan(pc(estG,yoy.g),yoy.g>0))+line("NoP",growthSpan(pc(estN,yoy.n),yoy.n>0))+'</td>'+
       '<td>'+line("GWP",'<span class="sh-v">'+sh(cur.g,totG)+'</span>')+line("NoP",'<span class="sh-v">'+sh(cur.n,totN)+'</span>')+'</td>'+
       '</tr>';
  });
  h+='</tbody></table></div>';
  el.innerHTML=h;
}

/* blok Top AM / Top PA / Top Promotor — mode bulan berjalan: aktual vs target.
   Dihitung dari baris target yang sama dengan tabel Target vs Achievement,
   hanya dikelompokkan per AM / PA / Promotor. */
function renderAchBreak(b){
  var el=$(b.id); if(!el) return;
  var rd=targetRowData();
  if(!rd||!rd.rows.length){ el.innerHTML='<p class="muted">Tidak ada data target untuk filter ini.</p>'; return; }
  var key = b.map==="byAm"?"am":(b.map==="byPa"?"pa":"pr");
  var lbl = b.map==="byAm"?"AM":(b.map==="byPa"?"PA":"Promotor");
  var g={}, skipN=0, skipNop=0;
  rd.rows.forEach(function(t){
    var raw=t[key];
    if(isBlankEntry(raw)||!norm(raw)){ skipN++; skipNop+=((rd.act[norm(t.s)]||{n:0}).n); return; }
    var k=clean(raw);
    if(!g[k]) g[k]={k:k,tn:0,tg:0,an:0,ag:0,nst:0};
    var a=rd.act[norm(t.s)]||{n:0,g:0};
    g[k].tn+=t.tn||0; g[k].tg+=t.tg||0; g[k].an+=a.n; g[k].ag+=a.g; g[k].nst++;
  });
  var list=Object.keys(g).map(function(k){
    var o=g[k];
    o.ach=o.tg>0?o.ag/o.tg:(o.tn>0?o.an/o.tn:NaN);
    o.est=isFinite(o.ach)?o.ach*rd.fac:NaN;
    o.st=tgtStatus(o.est,(o.tg||0)>0||(o.tn||0)>0);
    return o;
  });
  list.sort(function(a,b2){
    var x=isFinite(a.ach)?a.ach:-1, y=isFinite(b2.ach)?b2.ach:-1;
    if(y!==x) return y-x;
    return b2.ag-a.ag;
  });
  var pace=rd.elapsed/rd.dim;
  var h='<p class="muted ach-note">Bulan berjalan <b>'+ymLabel(DATA.targetMeta.month)+'</b> · aktual s/d tgl '+rd.elapsed+
        ' · urut % achievement · <b>est</b> = proyeksi akhir bulan (aktual ×'+rd.fac.toLocaleString("id-ID",{maximumFractionDigits:2})+
        ') · batang gelap = pace target '+(pace*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'%'+
        (skipN?(' · '+skipN+' store tanpa '+lbl+' ('+fmtInt(skipNop)+' polis) tidak dihitung'):'')+'</p>';
  if(!list.length){ el.innerHTML=h+'<p class="muted">Semua store pada filter ini belum punya '+lbl+'.</p>'; return; }
  h+='<div class="ach-list">'+list.map(function(o){
    var p=isFinite(o.ach)?Math.max(0,Math.min(1,o.ach))*100:0;
    var pc=isFinite(o.ach)?(o.ach*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—";
    var sc="t-"+o.st.c.replace("p-","");
    var estPc=isFinite(o.est)?(o.est*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—";
    var tip=o.st.t+" · "+o.nst+" store";
    return '<div class="bar-row">'+
      '<span class="n" title="'+esc(o.k)+'">'+esc(o.k)+'</span>'+
      '<span class="achvw" title="'+esc(tip)+'"><span class="achv '+sc+'">'+pc+'</span>'+
        '<span class="achvest '+sc+'">est '+estPc+'</span></span>'+
      '<span class="v2">NoP '+fmtInt(o.an)+' / '+fmtInt(o.tn)+' · GWP '+fmtIDR(o.ag)+' / '+fmtIDR(o.tg)+
        ' · est '+fmtInt(o.an*rd.fac)+' polis / '+fmtIDR(o.ag*rd.fac)+'</span>'+
      '<div class="bar-track"><div class="bar-fill" style="width:'+p.toFixed(1)+'%"></div>'+
      '<div class="bar-mark" style="left:'+(pace*100).toFixed(2)+'%" title="pace"></div></div>'+
    '</div>';
  }).join("")+'</div>';
  el.innerHTML=h;
}

/* ================= filter multi-pilih (checkbox dropdown) ================= */
var MSW = {};
function msCloseAll(except){
  Object.keys(MSW).forEach(function(k){
    var w=MSW[k]; if(w===except||w.panel.hidden) return;
    w.panel.hidden=true; w.host.classList.remove("open"); w.btn.setAttribute("aria-expanded","false");
  });
}
function msPlace(w){
  if(!w.panel.offsetParent) return;
  w.panel.style.left="0"; w.panel.style.right="auto";
  var r=w.panel.getBoundingClientRect(), vw=document.documentElement.clientWidth;
  if(r.right>vw-8){ w.panel.style.left="auto"; w.panel.style.right="0"; }
}
function msFilter(w,q){
  var n=norm(q), shown=0;
  w.checks.forEach(function(c){
    var t=w.byV[c.v]?w.byV[c.v].t:c.v;
    var ok=(!n||norm(t).indexOf(n)>=0);
    c.el.parentNode.style.display=ok?"":"none";
    if(ok) shown++;
  });
  var e=w.panel.querySelector(".ms-empty");
  if(e) e.style.display=shown?"none":"";
}
function msBuild(w){
  if(w.built) return;
  var h="";
  if(w.opts.search||w.items.length>10) h+='<input class="ms-q" type="search" placeholder="Cari…" spellcheck="false" autocomplete="off">';
  h+='<div class="ms-list">'+w.items.map(function(it){
       return '<label class="ms-opt"><input type="checkbox" value="'+esc(it.v)+'"><span>'+esc(it.t)+'</span></label>';
     }).join("")+'</div><div class="ms-empty" style="display:none">Tidak ada yang cocok.</div>';
  h+='<div class="ms-foot"><button type="button" class="ms-clear">Bersihkan</button><span class="ms-n"></span></div>';
  w.panel.innerHTML=h;
  w.list=w.panel.querySelector(".ms-list");
  w.q=w.panel.querySelector(".ms-q");
  w.checks=[];
  w.list.querySelectorAll("input[type=checkbox]").forEach(function(cb){
    w.checks.push({v:cb.value,el:cb});
    cb.addEventListener("change",function(){
      F[w.field]=w.checks.filter(function(c){return c.el.checked;}).map(function(c){return c.v;});
      msSync(w); render(aggregate());
    });
  });
  var cl=w.panel.querySelector(".ms-clear");
  if(cl) cl.addEventListener("click",function(){
    F[w.field]=[]; msSync(w); render(aggregate()); if(w.q) w.q.focus();
  });
  if(w.q){
    w.q.addEventListener("input",function(){ msFilter(w,w.q.value); });
    w.q.addEventListener("keydown",function(e){ if(e.key==="Escape"){ e.stopPropagation(); msCloseAll(); } });
  }
  w.built=true;
}
function msSync(w){
  var sel=F[w.field]||[], txt;
  if(!sel.length) txt="Semua";
  else if(sel.length===1) txt=(w.byV[sel[0]]?w.byV[sel[0]].t:sel[0]);
  else txt=sel.length+" dipilih";
  w.txt.textContent=txt;
  w.btn.classList.toggle("on",sel.length>0);
  w.btn.title=sel.length?sel.map(function(v){return w.byV[v]?w.byV[v].t:v;}).join(", "):"Semua";
  if(w.built){
    w.checks.forEach(function(c){ c.el.checked=sel.indexOf(c.v)>=0; });
    var n=w.panel.querySelector(".ms-n");
    if(n) n.textContent=sel.length?(sel.length+" dari "+w.items.length+" dipilih"):"Tanpa centang = semua";
  }
}
function msInit(hostId, field, items, opts){
  var host=$(hostId); if(!host) return null;
  var w={host:host,field:field,items:items,opts:opts||{},built:false,checks:[],byV:{}};
  items.forEach(function(it){ w.byV[it.v]=it; });
  var btn=document.createElement("button");
  btn.type="button"; btn.className="ms-btn"; btn.setAttribute("aria-haspopup","true"); btn.setAttribute("aria-expanded","false");
  btn.innerHTML='<span class="ms-txt"></span><span class="ms-car">▾</span>';
  host.appendChild(btn);
  var panel=document.createElement("div");
  panel.className="ms-panel"; panel.hidden=true;
  host.appendChild(panel);
  w.btn=btn; w.txt=btn.querySelector(".ms-txt"); w.panel=panel;
  btn.addEventListener("click",function(e){
    e.stopPropagation();
    var wasOpen=!panel.hidden;
    msCloseAll(w);
    if(wasOpen){ panel.hidden=true; host.classList.remove("open"); btn.setAttribute("aria-expanded","false"); return; }
    msBuild(w);
    panel.hidden=false; host.classList.add("open"); btn.setAttribute("aria-expanded","true");
    if(w.q){ w.q.value=""; msFilter(w,""); }
    msPlace(w);
  });
  panel.addEventListener("click",function(e){ e.stopPropagation(); });
  MSW[hostId]=w;
  msSync(w);
  return w;
}
function msSyncField(field){
  Object.keys(MSW).forEach(function(k){ if(MSW[k].field===field) msSync(MSW[k]); });
}
function msClearAll(){
  Object.keys(MSW).forEach(function(k){ F[MSW[k].field]=[]; msSync(MSW[k]); });
}
function msDimItems(list){
  return (list||[]).map(function(v,i){ return {v:String(i),t:clean(v)}; });
}

/* --- Perbandingan bulan berjalan: MoM & YoY -------------------------------
   Bulan berjalan datanya belum penuh (baru s/d tanggal tertentu), jadi dipakai
   ESTIMASI EOM (aktual x hari dalam bulan / hari berjalan) supaya perbandingannya
   apple-to-apple. Bulan pembanding tetap dihitung walaupun tidak ikut filter
   Tahun/Bulan (mis. filter Bulan = Okt saja):
     MoM = bulan kalender sebelumnya, YoY = bulan yang sama tahun lalu.
   Filter lain (Insurance/Partner/AM/SPA/PA/Promotor/Produk/Store/Status) tetap dihormati. */
function sumMonths(yms){
  var want={}, i;
  for(i=0;i<yms.length;i++){ if(yms[i]) want[yms[i]]={n:0,g:0}; }
  var facts=DATA.facts;
  for(var k=0;k<facts.length;k++){
    var f=facts[k], o=want[DATA.months[f[0]]];
    if(!o) continue;
    if(!passFact(f,true)) continue; /* abaikan filter Tahun/Bulan */
    o.n+=f[11]; o.g+=f[10];
  }
  return want;
}
function compareInfo(agg, vis){
  var nz=[], i;
  for(i=0;i<vis.length;i++){ if(agg.mNop[vis[i]]>0) nz.push(vis[i]); }
  if(!nz.length) return null;
  var li=nz[nz.length-1], ym=DATA.months[li];
  var dim=daysInMonthOf(ym), el=(DATA.monthLastDay&&DATA.monthLastDay[li])||0;
  if(el<=0) el=dim;
  var est=el<dim, fac=est?(dim/el):1;
  var momYm=prevYm(ym), yoyYm=String(+ym.slice(0,4)-1)+ym.slice(4);
  var sums=sumMonths([ym,momYm,yoyYm]);
  var curN=agg.mNop[li], curG=agg.mGwp[li], eN=curN*fac, eG=curG*fac;
  var mom=sums[momYm]||{n:0,g:0}, yoy=sums[yoyYm]||{n:0,g:0};
  function pc(a,b){ return b>0?((a-b)/b):NaN; }
  return {ym:ym,momYm:momYm,yoyYm:yoyYm,est:est,fac:fac,dim:dim,elapsed:el,
    curN:curN,curG:curG,estN:eN,estG:eG,momN:mom.n,momG:mom.g,yoyN:yoy.n,yoyG:yoy.g,
    pctN:{mom:pc(eN,mom.n),yoy:pc(eN,yoy.n)},
    pctG:{mom:pc(eG,mom.g),yoy:pc(eG,yoy.g)}};
}
function deltaLine(pct, label, est, tip){
  var c=!isFinite(pct)?"flat":(pct>0.0005?"up":(pct<-0.0005?"down":"flat"));
  return '<div class="d '+c+'" title="'+esc(tip)+'">'+fmtPct(pct)+' '+label+(est?' <span class="est-tag">est EOM</span>':'')+'</div>';
}
function cmpTip(c, kind, isNoP){
  var fmt=isNoP?fmtInt:fmtIDR;
  var other=(kind==="mom"?c.momYm:c.yoyYm);
  var ref=(kind==="mom"?{n:c.momN,g:c.momG}:{n:c.yoyN,g:c.yoyG});
  var cur=isNoP?c.curN:c.curG, est=isNoP?c.estN:c.estG, rv=(isNoP?ref.n:ref.g);
  var head=(kind==="mom"?("MoM - bulan sebelumnya "+ymLabel(other)):("YoY - bulan sama tahun lalu "+ymLabel(other)));
  if(!isFinite(isNoP?c.pctN[kind]:c.pctG[kind])) return head+": belum ada data pembanding.";
  if(c.est) return head+": bulan berjalan "+ymLabel(c.ym)+" = estimasi EOM "+fmt(est)+" (aktual s/d tgl "+c.elapsed+" = "+fmt(cur)+" x "+(c.dim/c.elapsed).toLocaleString("id-ID",{maximumFractionDigits:2})+") dibanding "+ymLabel(other)+" aktual = "+fmt(rv)+".";
  return head+": "+ymLabel(c.ym)+" aktual = "+fmt(cur)+" dibanding "+ymLabel(other)+" aktual = "+fmt(rv)+".";
}

function render(agg){
  if(ROUTE==="best"){ renderBest(); return; }
  if(ROUTE==="campaign"){ renderCampaign(); return; }
  var vis=visibleMonths();
  var labels=vis.map(function(i){return ymLabel(DATA.months[i]);});
  var nop=vis.map(function(i){return agg.mNop[i];});
  var gwp=vis.map(function(i){return agg.mGwp[i];});
  var active=vis.filter(function(i){return agg.mNop[i]>0;}).length;
  var avg=agg.totN?agg.totG/agg.totN:0;
  var cmp=compareInfo(agg,vis); agg.cmp=cmp;
  var scopeName=scopeLabel();
  $("kpis").innerHTML=
    '<div class="kpi"><div class="t">Total NoP'+scopeName+'</div><div class="v">'+fmtInt(agg.totN)+'</div>'+
      (cmp?(deltaLine(cmp.pctN.mom,"MoM",cmp.est,cmpTip(cmp,"mom",true))+deltaLine(cmp.pctN.yoy,"YoY",cmp.est,cmpTip(cmp,"yoy",true))):'')+'</div>'+
    '<div class="kpi"><div class="t">Total GWP'+scopeName+'</div><div class="v">'+fmtIDR(agg.totG)+'</div>'+
      (cmp?(deltaLine(cmp.pctG.mom,"MoM",cmp.est,cmpTip(cmp,"mom",false))+deltaLine(cmp.pctG.yoy,"YoY",cmp.est,cmpTip(cmp,"yoy",false))):'')+'</div>'+
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
        mh+='<div class="bar-row"><span class="n">'+esc(e.k)+'</span><span class="v">'+(e.g/tot*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'%</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,e.g/((top0&&top0.g)||1)*100).toFixed(1)+'%"></div></div></div>';
      });
    });
    $("mixBox").innerHTML=mh;
  }
  (BREAKS[ROUTE]||[]).forEach(function(b){
    if(b.map==="byAm"||b.map==="byPa"||b.map==="byProm") renderAchBreak(b);
    else if(b.sc) renderPartnerScore(b,agg);
    else{
      var src=(b.map==="byProd")?agg.byProdM:(b.map==="byStore"?agg.byStoreM:agg[b.map]);
      var sub=$(b.id+"sub"); if(sub) sub.textContent=(agg.miF>=0?ymLabel(DATA.months[agg.miF]):"—");
      if(b.c){
        var isM=(b.map==="byProd"||b.map==="byStore"||b.m===1);
        contribList(b.id, topEntries(src||{},b.top||10),
          isM?(agg.mGwp[agg.miF]||0):agg.totG,
          isM?(agg.mNop[agg.miF]||0):agg.totN,
          "Share GWP & polis "+(agg.miF>=0?ymLabel(DATA.months[agg.miF]):"—")+" — ikut semua filter aktif.");
      }
      else barList(b.id, topEntries(src||{},8));
    }
  });
  renderTrend(agg,vis);
  renderTable(agg,vis);
  renderDaily();
  renderTarget();
  var fVals=[F.year,F.month,F.ins,F.part,F.am,F.spa,F.pa,F.prom,F.prod,F.store,F.status];
  var actF=fVals.filter(function(v){return v&&v.length;}).length;
  var nVal=fVals.reduce(function(s,v){return s+(v?v.length:0);},0);
  if(scopeVal()!=="ALL") actF++;
  $("filterCount").textContent=((actF?(actF+" filter aktif"+(nVal>actF?" ("+nVal+" pilihan)":"")):"Tanpa filter")+(SEARCH_Q?(' · cari "'+SEARCH_Q+'"'):""))+" · "+fmtInt(agg.totN)+" polis";
  var sc=scopeLabel();
  $("periodSub").innerHTML=esc((labels.length?("Periode tampil: "+labels[0]+" → "+labels[labels.length-1]):"Periode kosong")+(sc?" · "+sc:""))+'<span class="hide-sm">'+esc(" · Sumber: Data-raw.xlsx ("+fmtInt(DATA.facts.length)+" baris)")+'</span>';
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
  /* MoM (bulan kalender sebelumnya) & YoY (bulan sama tahun lalu) dari compareInfo;
     bulan pembanding tetap dihitung walau tidak ikut filter Tahun/Bulan. */
  var cmp=agg.cmp||compareInfo(agg,vis);
  var momNt=cmp?cmp.pctN.mom:NaN, momGt=cmp?cmp.pctG.mom:NaN;
  var yoyNt=cmp?cmp.pctN.yoy:NaN, yoyGt=cmp?cmp.pctG.yoy:NaN;
  var momEst=cmp?cmp.est:false;
  var lastYm=cmp?cmp.ym:DATA.months[l1];
  cards.push({t:"Bulan terbaik (GWP)",v:ymLabel(DATA.months[bi])+" · "+fmtIDR(bg)});
  cards.push({t:"MoM "+(cmp?ymLabel(cmp.momYm)+" → ":"")+ymLabel(lastYm)+(momEst?" (est EOM)":""),v:fmtPct(momGt)+" GWP · "+fmtPct(momNt)+" NoP"});
  cards.push({t:"YoY "+(cmp?ymLabel(cmp.yoyYm)+" → ":"")+ymLabel(lastYm)+(momEst?" (est EOM)":""),v:(isFinite(yoyGt)?fmtPct(yoyGt)+" GWP":"—")+" · "+(isFinite(yoyNt)?fmtPct(yoyNt)+" NoP":"—")});
  cards.push({t:"Rata-rata / bulan aktif",v:fmtInt(avgN)+" polis · "+fmtIDR(avgG)});
  $("trendCards").innerHTML=cards.map(function(c){return '<div class="tc"><div class="t">'+c.t+'</div><div class="v">'+esc(c.v)+'</div></div>';}).join("");
  items.push("Total <b>"+fmtInt(agg.totN)+"</b> polis dengan GWP <b>"+fmtIDR(agg.totG)+"</b> pada "+vis.length+" bulan tampil ("+nz.length+" bulan aktif).");
  items.push("Bulan tertinggi GWP: <b>"+ymLabel(DATA.months[bi])+"</b> ("+fmtInt(agg.mNop[bi])+" polis, "+fmtIDR(agg.mGwp[bi])+"). Terendah: <b>"+ymLabel(DATA.months[wi])+"</b> ("+fmtIDR(agg.mGwp[wi])+").");
  if(cmp) items.push("MoM ("+ymLabel(cmp.momYm)+" → "+ymLabel(cmp.ym)+"): NoP <b>"+fmtPct(momNt)+"</b>, GWP <b>"+fmtPct(momGt)+"</b>"+(cmp.est?(" — bulan berjalan "+ymLabel(cmp.ym)+" dihitung dari estimasi EOM: "+fmtInt(cmp.estN)+" polis / "+fmtIDR(cmp.estG)+" vs "+ymLabel(cmp.momYm)+" aktual "+fmtInt(cmp.momN)+" polis / "+fmtIDR(cmp.momG)):"")+".");
  if(cmp&&isFinite(cmp.pctG.yoy)) items.push("YoY ("+ymLabel(cmp.yoyYm)+" → "+ymLabel(cmp.ym)+"): NoP <b>"+fmtPct(yoyNt)+"</b>, GWP <b>"+fmtPct(yoyGt)+"</b>"+(cmp.est?(" — bulan berjalan pakai estimasi EOM: "+fmtInt(cmp.estN)+" polis / "+fmtIDR(cmp.estG)+" vs "+ymLabel(cmp.yoyYm)+" aktual "+fmtInt(cmp.yoyN)+" polis / "+fmtIDR(cmp.yoyG)):"")+".");
  else if(cmp) items.push("YoY ("+ymLabel(cmp.yoyYm)+" → "+ymLabel(cmp.ym)+"): belum ada data bulan yang sama tahun lalu pada filter ini.");
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
/* versi multi-pilih: null = tanpa filter, selain itu daftar nama ternormalisasi */
function selNormArr(list, arr){
  if(!arr||!arr.length) return null;
  return arr.map(function(v){ var e=list[+v]; return isBlankEntry(e)?"":norm(clean(e)); });
}
function inSel(a,name){ return a===null||a.indexOf(name)>=0; }
function targetFilterRows(){
  if(!DATA.target) return [];
  if(BLOCKED) return [];
  searchPrep();
  var selStore=selNormArr(DATA.store,F.store), selPart=selNormArr(DATA.partner,F.part), selSpa=selNormArr(DATA.spa,F.spa);
  var selPa=selNormArr(DATA.pa,F.pa), selProm=selNormArr(DATA.prom,F.prom), selAm=selNormArr(DATA.am,F.am);
  var scSpa=ROUTE==="spa"?selNorm(DATA.spa,SCOPE.spa):null;
  var scPa=ROUTE==="pa"?selNorm(DATA.pa,SCOPE.pa):null;
  var scProm=ROUTE==="promotor"?selNorm(DATA.prom,SCOPE.prom):null;
  return DATA.target.filter(function(t){
    if(LOCK&&norm(t[LOCK.key]||"")!==norm(DATA[LOCK.list][LOCK.idx])) return false;
    if(SEARCH_Q&&!searchHitText(t.s+" "+(t.pa||"")+" "+(t.pr||"")+" "+(t.am||""))) return false;
    if(!inSel(selStore,norm(t.s))) return false;
    if(!inSel(selPart,norm(t.p||""))) return false;
    if(!inSel(selAm,norm(t.am||""))) return false;
    if(!inSel(selSpa,norm(t.spa||""))) return false;
    if(!inSel(selPa,norm(t.pa||""))) return false;
    if(!inSel(selProm,norm(t.pr||""))) return false;
    if(scSpa!==null&&norm(t.spa||"")!==scSpa) return false;
    if(scPa!==null&&norm(t.pa||"")!==scPa) return false;
    if(scProm!==null&&norm(t.pr||"")!==scProm) return false;
    return true;
  });
}
/* aktual per store pada bulan target — dipakai tabel Target vs Achievement DAN
   blok Top AM / Top PA / Top Promotor supaya angkanya selalu sinkron. */
function targetRowData(){
  if(!DATA.target||!DATA.targetMeta) return null;
  var tm=DATA.targetMeta, octIdx=DATA.months.indexOf(tm.month);
  if(octIdx<0) return null;
  var dim=tm.daysInMonth||daysInMonthOf(tm.month);
  var elapsed=(DATA.monthLastDay&&DATA.monthLastDay[octIdx])||tm.lastDay||dim;
  if(elapsed<=0) elapsed=dim;
  var selStore=selNormArr(DATA.store,F.store), selPart=selNormArr(DATA.partner,F.part);
  /* AM/SPA/PA/Promotor sengaja TIDAK difilter di sini: baris store sudah difilter di
     targetFilterRows() memakai kolom dari Target.xlsx. Jadi tabel Target vs Achievement dan
     blok Top AM/PA/Promotor selalu menghasilkan angka yang sama — termasuk untuk polis yang
     kolom AM/SPA/PA/Promotor-nya kosong di Data-raw. */
  function keep(f){
    if(SEARCH_Q && !searchHitStore(f[4])) return false;
    if(!fHit(F.prod,f[3])) return false;
    if(!fHit(F.ins,f[1])) return false;
    if(!fHit(F.status,f[5])) return false;
    if(!inSel(selPart,norm(clean(DATA.partner[f[2]])))) return false;
    if(!inSel(selStore,norm(clean(DATA.store[f[4]])))) return false;
    return true;
  }
  /* prev = aktual bulan sebelumnya (bulan tepat sebelum bulan target), filter sama
     persis dengan aktual bulan berjalan supaya growth apple-to-apple.
     yoy  = aktual bulan yang sama TAHUN LALU (untuk kartu YoY). */
  var yoyIdx=DATA.months.indexOf(String(+tm.month.slice(0,4)-1)+tm.month.slice(4));
  var act={}, prev={}, yoy={}, facts=DATA.facts, pIdx=octIdx>0?octIdx-1:-1;
  for(var k=0;k<facts.length;k++){
    var f=facts[k];
    if(f[0]!==octIdx&&f[0]!==pIdx&&f[0]!==yoyIdx) continue;
    if(!keep(f)) continue;
    var sn=norm(clean(DATA.store[f[4]]));
    var box=(f[0]===octIdx)?act:(f[0]===pIdx?prev:yoy);
    if(!box[sn]) box[sn]={n:0,g:0};
    box[sn].n+=f[11]; box[sn].g+=f[10];
  }
  return {octIdx:octIdx,dim:dim,elapsed:elapsed,fac:dim/elapsed,act:act,prev:prev,prevYm:(pIdx>=0?DATA.months[pIdx]:null),
          yoy:yoy,yoyYm:(yoyIdx>=0?DATA.months[yoyIdx]:null),
          rows:targetFilterRows(),extraActive:(!fAll(F.prod)||!fAll(F.ins)||!fAll(F.status))};
}
/* ---- growth: estimasi EOM bulan berjalan vs realisasi bulan sebelumnya ---- */
function prevYm(ym){
  var y=parseInt(ym.slice(0,4),10), m=parseInt(ym.slice(5,7),10)-1;
  if(m===0){ m=12; y--; }
  return y+"-"+("0"+m).slice(-2);
}
function growthSpan(v,has){
  if(!has) return '<span class="g-flat">baru</span>';
  if(!isFinite(v)) return '<span class="g-flat">—</span>';
  var c=v>0.0005?"g-up":(v<-0.0005?"g-down":"g-flat");
  return '<span class="'+c+'">'+(v>0?"+":"")+(v*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%</span>";
}
function growthCell(r){
  return '<div class="gl"><span class="g-lbl">NoP</span>'+growthSpan(r.gN,r.pn>0)+'</div>'+
         '<div class="gl"><span class="g-lbl">GWP</span>'+growthSpan(r.gG,r.pg>0)+'</div>';
}
/* kolom YoY: est EOM bulan berjalan vs realisasi bulan yang sama TAHUN LALU */
function growthCellYoy(r){
  return '<div class="gl"><span class="g-lbl">NoP</span>'+growthSpan(r.yyN,r.yn>0)+'</div>'+
         '<div class="gl"><span class="g-lbl">GWP</span>'+growthSpan(r.yyG,r.yg>0)+'</div>';
}
/* keterangan otomatis untuk Mode screenshot: filter aktif + periode target + urutan */
function reportCaption(){
  var bits=[];
  [].slice.call(document.querySelectorAll(".filters .fld")).forEach(function(f){
    var lblEl=f.querySelector("span"), txt=f.querySelector(".ms-txt");
    if(!lblEl||!txt) return;
    if(getComputedStyle(f).display==="none") return;
    var v=(txt.textContent||"").trim();
    if(v&&v!=="Semua") bits.push(lblEl.textContent.trim()+": "+v);
  });
  var tm=DATA.targetMeta||{}, el=elapsedOf();
  var st=TGT[ROUTE]||{};
  var sl={estHi:"Estimasi % tertinggi",tg:"Target GWP terbesar",achLo:"Achievement GWP terendah",achHi:"Achievement GWP tertinggi",gap:"Selisih GWP terbesar"}[st.sort]||"Target GWP terbesar";
  return (bits.length?bits.join(" · ")+" · ":"")+"Target: "+(tm.month?ymLabel(tm.month):"—")+" (data per tgl "+(el||"—")+") · urutan: "+sl+(st.q?(' · cari "'+st.q+'"'):"");
}
var shotTimer=null;
function shotDim(){
  var b=$("shotExit"); if(b) b.classList.remove("dim");
  if(shotTimer){ clearTimeout(shotTimer); shotTimer=null; }
}
/* tombol Keluar ditampilkan sebentar lalu memudar supaya tidak ikut terfoto;
   gerakkan mouse untuk memunculkannya lagi. */
function shotArm(){
  var b=$("shotExit"); if(!b) return;
  b.classList.remove("dim");
  if(shotTimer) clearTimeout(shotTimer);
  shotTimer=setTimeout(function(){ var x=$("shotExit"); if(x&&SHOT) x.classList.add("dim"); },2600);
}
/* Mode screenshot: kalau tabel masih lebih tinggi dari layar, perkecil skala
   kartu target supaya semua baris + baris TOTAL masuk satu tangkapan layar. */
function shotFit(){
  var sec=$("tgtSec"); if(!sec) return;
  var tbl=$("tgtTable");
  sec.style.zoom=""; sec.style.transform=""; sec.style.width="";
  if(!SHOT) return;
  var top=sec.getBoundingClientRect().top;
  var availH=window.innerHeight-top-20;
  var h=sec.getBoundingClientRect().height;
  var availW=sec.clientWidth-2;
  var tw=tbl?tbl.getBoundingClientRect().width:0;
  var kH=(availH>120&&h>0)?availH/h:1;
  var kW=(availW>200&&tw>0)?availW/tw:1;
  var k=Math.min(1,kH,kW);
  if(k<0.999) sec.style.zoom=Math.max(0.4,k).toFixed(3);   /* zoom (bukan transform) supaya tinggi & lebar layout ikut mengecil */
}
function renderTarget(){
  if(!$("tgtTable")||!DATA.target||!DATA.target.length||!DATA.targetMeta) return;
  var _sec=$("tgtSec");
  var _on=!!(RPT||SHOT);
  if(_sec){ _sec.classList.toggle("rpt-mode",_on); _sec.classList.toggle("shot-mode",!!SHOT); _sec.style.transform=""; _sec.style.width=""; }
  document.body.classList.toggle("shot-mode",!!SHOT);
  var _rb=$("tgtRpt");
  if(_rb){ var a1=(RPT&&!SHOT); _rb.classList.toggle("on",a1); _rb.setAttribute("aria-pressed",a1?"true":"false"); _rb.textContent=a1?"Mode laporan: AKTIF":"Mode laporan"; }
  var _sb=$("tgtShot");
  if(_sb){ _sb.classList.toggle("on",!!SHOT); _sb.setAttribute("aria-pressed",SHOT?"true":"false"); _sb.textContent=SHOT?"Mode screenshot: AKTIF":"Mode screenshot"; }
  var _cap=$("shotCap");
  if(_cap){ _cap.hidden=!SHOT; _cap.textContent=SHOT?reportCaption():""; }
  var st=TGT[ROUTE];
  var tm=DATA.targetMeta;
  var rd=targetRowData();
  var dim=tm.daysInMonth||daysInMonthOf(tm.month);
  var elapsed=(rd&&rd.elapsed)||tm.lastDay||dim;
  if(elapsed<=0) elapsed=dim;
  var fac=(rd&&rd.fac)||(dim/elapsed);
  var act=(rd&&rd.act)||{};
  var prev=(rd&&rd.prev)||{};
  var extraActive=(rd&&rd.extraActive)||false;
  var yoy=(rd&&rd.yoy)||{};
  var rows=(rd?rd.rows:targetFilterRows()).map(function(t){
    var a=act[norm(t.s)]||{n:0,g:0};
    var p0=prev[norm(t.s)]||{n:0,g:0};
    var y0=yoy[norm(t.s)]||{n:0,g:0};
    var hasT=(t.tg||0)>0||(t.tn||0)>0;
    var achN=t.tn>0?a.n/t.tn:NaN, achG=t.tg>0?a.g/t.tg:NaN;
    var eN=a.n*fac, eG=a.g*fac;
    var estA=(t.tg>0)?eG/t.tg:(t.tn>0?eN/t.tn:NaN);
    var gN=(p0.n>0)?(eN-p0.n)/p0.n:NaN, gG=(p0.g>0)?(eG-p0.g)/p0.g:NaN;
    var yyN=(y0.n>0)?(eN-y0.n)/y0.n:NaN, yyG=(y0.g>0)?(eG-y0.g)/y0.g:NaN;
    return {s:t.s,pa:t.pa||"—",pr:t.pr||"—",tn:t.tn||0,tg:t.tg||0,an:a.n,ag:a.g,achN:achN,achG:achG,eN:eN,eG:eG,estA:estA,
            gN:gN,gG:gG,pn:p0.n,pg:p0.g,yn:y0.n,yg:y0.g,yyN:yyN,yyG:yyG,st:tgtStatus(estA,hasT)};
  });
  var fr=rows.filter(function(r){
    if(st.tab==="done") return r.st.t==="Tercapai";
    if(st.tab==="behind") return r.st.t!=="Tercapai";
    return true;
  });
  var q=norm(st.q);
  if(q) fr=fr.filter(function(r){ return norm(r.s+" "+r.pa+" "+r.pr).indexOf(q)>=0; });
  var tN=0,tG=0,aN=0,aG=0,pN=0,pG=0,yN=0,yG=0;
  rows.forEach(function(r){ tN+=r.tn; tG+=r.tg; aN+=r.an; aG+=r.ag; pN+=r.pn; pG+=r.pg; yN+=r.yn; yG+=r.yg; });
  var achN=tN>0?aN/tN:NaN, achG=tG>0?aG/tG:NaN, eNt=aN*fac, eGt=aG*fac;
  var estAN=tN>0?eNt/tN:NaN, estAG=tG>0?eGt/tG:NaN;
  /* MoM = est EOM bulan berjalan vs realisasi bulan sebelumnya
     YoY = est EOM bulan berjalan vs realisasi bulan yang sama tahun lalu
     (mengikuti store yang tampil = filter + pencarian nama) */
  var momN=pN>0?(eNt-pN)/pN:NaN, momG=pG>0?(eGt-pG)/pG:NaN;
  var yoyN=yN>0?(eNt-yN)/yN:NaN, yoyG=yG>0?(eGt-yG)/yG:NaN;
  function dcls(v){ return !isFinite(v)?"flat":(v>0.0005?"up":(v<-0.0005?"down":"flat")); }
  var pmLbl2=(rd&&rd.prevYm)?ymLabel(rd.prevYm):"—", yyLbl2=(rd&&rd.yoyYm)?ymLabel(rd.yoyYm):"—";
  $("tgtKpis").innerHTML=
    '<div class="kpi"><div class="t">Ach NoP (tgl '+elapsed+')</div><div class="v">'+(isFinite(achN)?(achN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtInt(aN)+' / '+fmtInt(tN)+'</div></div>'+
    '<div class="kpi"><div class="t">Ach GWP (tgl '+elapsed+')</div><div class="v">'+(isFinite(achG)?(achG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">'+fmtIDR(aG)+' / '+fmtIDR(tG)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach NoP (EOM)</div><div class="v">'+(isFinite(estAN)?(estAN*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtInt(eNt)+'</div></div>'+
    '<div class="kpi"><div class="t">Est Ach GWP (EOM)</div><div class="v">'+(isFinite(estAG)?(estAG*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—")+'</div><div class="d flat">est '+fmtIDR(eGt)+'</div></div>'+
    '<div class="kpi"><div class="t">MoM NoP &middot; <span class="muted-sm">vs '+pmLbl2+'</span></div><div class="v '+dcls(momN)+'">'+fmtPct(momN)+'</div><div class="d '+dcls(momG)+'">GWP '+fmtPct(momG)+'</div></div>'+
    '<div class="kpi"><div class="t">YoY NoP &middot; <span class="muted-sm">vs '+yyLbl2+'</span></div><div class="v '+dcls(yoyN)+'">'+fmtPct(yoyN)+'</div><div class="d '+dcls(yoyG)+'">GWP '+fmtPct(yoyG)+'</div></div>';
  var pace=elapsed/dim;
  var yLbl=ymLabel(tm.month);
  $("tgtNote").textContent="Periode dikunci "+yLbl+" · data per tgl "+elapsed+" "+yLbl.split(" ")[0]+" (pace linear "+(pace*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%) · estimasi EOM = aktual ×"+(dim/elapsed).toLocaleString("id-ID",{maximumFractionDigits:2})+" · baris & kartu mengikuti filter AM/SPA/PA/Promotor/Store/Partner dari Target.xlsx"+(extraActive?" · aktual juga difilter Produk/Insurance/Status (target tetap level store)":"")+" · MoM = est EOM vs realisasi "+(rd&&rd.prevYm?ymLabel(rd.prevYm):"bulan sebelumnya")+" · YoY = est EOM vs realisasi "+(rd&&rd.yoyYm?ymLabel(rd.yoyYm):"bulan sama tahun lalu")+(SEARCH_Q?(" · pencarian \""+SEARCH_Q+"\""):"")+" · "+rows.length+" store tampil.";
  fr.sort(function(a,b){
    if(st.sort==="estHi") return (isFinite(b.estA)?b.estA:-1)-(isFinite(a.estA)?a.estA:-1);
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
  var tfEl=$("tgtTable").querySelector("tfoot");
  if(!fr.length){
    tb.innerHTML='<tr><td colspan="17">Tidak ada store yang cocok.</td></tr>';
    if(tfEl) tfEl.innerHTML="";
    return;
  }
  var html="";
  var remDays=Math.max(0,dim-elapsed);
  function dayNeed(tg,ag){
    if(!(tg>0)||remDays<=0) return NaN;
    var left=tg-ag;
    return left>0?left/remDays:0;
  }
  fr.forEach(function(r,i){
    var nd=dayNeed(r.tg,r.ag);
    html+='<tr><td class="sticky rk">'+(i+1)+'</td><td class="sticky" title="'+esc(r.s)+'">'+esc(r.s)+'</td><td>'+esc(r.pa)+'</td><td>'+esc(r.pr)+'</td><td>'+fmtInt(r.tn)+'</td><td>'+fmtInt(r.an)+'</td><td>'+achCell(r.achN)+'</td><td>'+fmtIDR(r.tg)+'</td><td>'+fmtIDR(r.ag)+'</td><td>'+achCell(r.achG)+'</td><td>'+fmtInt(r.eN)+'</td><td>'+fmtIDR(r.eG)+'</td><td>'+achCell(r.estA)+'</td><td>'+(isFinite(nd)?(nd<=0?'<span class="flat">—</span>':fmtIDR(nd)):'<span class="flat">—</span>')+'</td><td class="gcell">'+growthCell(r)+'</td><td class="gcell">'+growthCellYoy(r)+'</td><td><span class="pill '+r.st.c+'">'+r.st.t+'</span></td></tr>';
  });
  tb.innerHTML=html;
  /* ---- baris TOTAL / grand total dari baris yang sedang tampil ---- */
  var tN2=0,tG2=0,aN2=0,aG2=0,pN2=0,pG2=0,yN2=0,yG2=0,nDone=0;
  fr.forEach(function(r){
    tN2+=r.tn; tG2+=r.tg; aN2+=r.an; aG2+=r.ag;
    pN2+=r.pn; pG2+=r.pg; yN2+=r.yn; yG2+=r.yg;
    if(r.st.t==="Tercapai") nDone++;
  });
  var eN2=aN2*fac, eG2=aG2*fac;
  var achN2=tN2>0?aN2/tN2:NaN, achG2=tG2>0?aG2/tG2:NaN;
  var est2=(tG2>0)?eG2/tG2:(tN2>0?eN2/tN2:NaN);
  var totRow={gN:pN2>0?(eN2-pN2)/pN2:NaN,pn:pN2,gG:pG2>0?(eG2-pG2)/pG2:NaN,pg:pG2,
              yyN:yN2>0?(eN2-yN2)/yN2:NaN,yn:yN2,yyG:yG2>0?(eG2-yG2)/yG2:NaN,yg:yG2};
  if(!tfEl){ tfEl=document.createElement("tfoot"); $("tgtTable").appendChild(tfEl); }
  tfEl.innerHTML='<tr class="totrow"><td class="sticky rk"></td><td class="sticky">TOTAL &middot; '+fr.length+' store</td><td></td><td></td>'+
    '<td>'+fmtInt(tN2)+'</td><td>'+fmtInt(aN2)+'</td><td>'+achCell(achN2)+'</td>'+
    '<td>'+fmtIDR(tG2)+'</td><td>'+fmtIDR(aG2)+'</td><td>'+achCell(achG2)+'</td>'+
    '<td>'+fmtInt(eN2)+'</td><td>'+fmtIDR(eG2)+'</td>'+
    '<td>'+achCell(est2)+'</td>'+
    '<td>'+((function(){ var n=dayNeed(tG2,aG2); return isFinite(n)?(n<=0?'<span class="flat">—</span>':fmtIDR(n)):'<span class="flat">—</span>'; })())+'</td>'+
    '<td class="gcell">'+growthCell(totRow)+'</td><td class="gcell">'+growthCellYoy(totRow)+'</td>'+
    '<td>'+nDone+' / '+fr.length+' tercapai</td></tr>';
  shotFit();
  if(SHOT) shotArm(); else shotDim();
}

/* ================= BEST ACHIEVEMENT (peringkat PA / Promotor) =================
   Angka diambil dari mesin yang sama dengan tabel Target vs Achievement:
   baris target (Target.xlsx) + aktual bulan target (Data-raw.xlsx), setelah
   semua filter & pembatasan scope (LOCK) diterapkan. Jadi total di halaman ini
   selalu sama dengan baris TOTAL tabel tersebut. */
var BESTS={kind:"pa",sort:"ach"};
function bestHTML(){
  var tm=DATA.targetMeta||{};
  var lbl=tm.month?ymLabel(tm.month):"—";
  var el0=elapsedOf();
  return '<section class="card" id="bestSec">'+
    '<div class="card-h row"><div><h2>Peringkat — '+lbl+' <span class="muted-sm">data per tgl '+(el0||"—")+'</span></h2>'+
      '<p class="muted" id="bestNote"></p></div>'+
      '<div class="tabs" id="bestTabs"><button data-k="pa" type="button">By PA</button><button data-k="prom" type="button">By Promotor</button></div></div>'+
    '<div class="tgt-controls"><select id="bestSort">'+
      '<option value="ach">Urut: Achievement % tertinggi</option>'+
      '<option value="gap">Urut: Sisa target GWP terbesar</option>'+
      '<option value="gwp">Urut: GWP aktual terbesar</option>'+
      '<option value="tg">Urut: Target GWP terbesar</option></select>'+
      '<span class="muted-sm hide-sm">Achievement = realisasi s/d tanggal berjalan · Estimasi = perkiraan akhir bulan · medali untuk 3 pencapaian terbaik</span></div>'+
    '<div id="bestList" class="ba-list"></div>'+
    '<p class="muted-sm" id="bestFoot" style="margin:10px 0 0"></p>'+
  '</section>';
}
function bestGroupRows(rd,kind){
  var g={}, arr=[];
  (rd.rows||[]).forEach(function(t){
    var raw=String((kind==="pa"?(t.pa||""):(t.pr||""))||"").trim();
    var isB=(!raw||isBlankEntry(raw)||norm(raw)==="(kosong)"||raw==="-");
    var nm=isB?("(Tanpa "+(kind==="pa"?"PA":"Promotor")+")"):raw;
    var k=norm(nm), o=g[k];
    if(!o){ o=g[k]={name:nm,blank:isB,tn:0,tg:0,an:0,ag:0,ns:0,par:{}}; arr.push(o); }
    var a=rd.act[norm(t.s)]||{n:0,g:0};
    o.tn+=t.tn||0; o.tg+=t.tg||0; o.an+=a.n; o.ag+=a.g; o.ns++;
    var pn=clean(kind==="pa"?(t.spa||BLANK):(t.pa||BLANK));
    o.par[pn]=(o.par[pn]||0)+1;
  });
  arr.forEach(function(o){
    var best=null,bc=-1;
    Object.keys(o.par).forEach(function(p){ if(o.par[p]>bc){ bc=o.par[p]; best=p; } });
    o.parent=best;
    o.eG=o.ag*rd.fac;
    o.ach=(o.tg>0)?o.ag/o.tg:(o.tn>0?o.an/o.tn:NaN);
    o.est=(o.tg>0)?o.eG/o.tg:(o.tn>0?(o.an*rd.fac)/o.tn:NaN);
    o.st=tgtStatus(o.est,(o.tg>0||o.tn>0));
    delete o.par;
  });
  return arr;
}
function renderBest(){
  var list=$("bestList"); if(!list) return;
  var tabs=$("bestTabs");
  if(tabs) tabs.querySelectorAll("button").forEach(function(b){ b.classList.toggle("on",b.dataset.k===BESTS.kind); });
  var so=$("bestSort"); if(so) so.value=BESTS.sort;
  var note=$("bestNote"), foot=$("bestFoot");
  var rd=targetRowData();
  if(!rd||!rd.rows||!rd.rows.length){
    list.innerHTML='<p class="muted">Belum ada data target untuk filter ini.</p>';
    if(note) note.textContent="Target.xlsx belum tersedia atau semua store tersaring filter.";
    if(foot) foot.textContent="";
    return;
  }
  var rows=bestGroupRows(rd,BESTS.kind), s=BESTS.sort;
  rows.sort(function(a,b){
    if(s==="gap") return (b.tg-b.ag)-(a.tg-a.ag);
    if(s==="gwp") return b.ag-a.ag;
    if(s==="tg") return b.tg-a.tg;
    return (isFinite(b.ach)?b.ach:-1)-(isFinite(a.ach)?a.ach:-1);
  });
  /* grup tanpa nama (store belum punya PA/Promotor) selalu di bawah */
  rows=rows.filter(function(o){ return !o.blank; }).concat(rows.filter(function(o){ return o.blank; }));
  function p1(v){ return isFinite(v)?(v*100).toLocaleString("id-ID",{maximumFractionDigits:1})+"%":"—"; }
  var tG=0,aG=0,tN=0,aN=0,done=0;
  rows.forEach(function(o){ tG+=o.tg; aG+=o.ag; tN+=o.tn; aN+=o.an; if(o.st.t==="Tercapai") done++; });
  var ach=tG>0?aG/tG:(tN>0?aN/tN:NaN);
  var eG=aG*rd.fac, est=tG>0?eG/tG:(tN>0?aN*rd.fac/tN:NaN);
  var kindTxt=BESTS.kind==="pa"?"PA":"Promotor";
  var nNamed=rows.filter(function(o){ return !o.blank; }).length, nBlank=rows.length-nNamed;
  var tmLbl=ymLabel(DATA.targetMeta.month);
  if(note) note.textContent=tmLbl+" · data per tgl "+rd.elapsed+" · "+nNamed+" "+kindTxt+(nBlank?" (+"+nBlank+" tanpa "+(BESTS.kind==="pa"?"PA":"promotor")+")":"")+" · target "+fmtIDR(tG)+" · aktual "+fmtIDR(aG)+" ("+p1(ach)+") · estimasi "+fmtIDR(eG)+" ("+p1(est)+") · "+done+" tercapai"+(SEARCH_Q?(' · cari "'+SEARCH_Q+'"'):"");
  var html="";
  rows.forEach(function(o,i){
    var rk=i+1;
    var medal=("ach"===BESTS.sort&&!o.blank)?(rk===1?"🥇":rk===2?"🥈":rk===3?"🥉":""):"";
    var w=isFinite(o.ach)?Math.max(0,Math.min(100,o.ach*100)):0;
    var we=isFinite(o.est)?Math.max(0,Math.min(100,o.est*100)):0;
    html+='<div class="ba-card'+((rk<=3&&BESTS.sort==="ach"&&!o.blank)?" r"+rk:"")+'">'+
      '<div class="ba-rank">'+(medal?'<span class="ba-medal">'+medal+'</span>':'<span class="ba-no">'+rk+'</span>')+'</div>'+
      '<div class="ba-id"><div class="ba-name" title="'+esc(o.name)+'">'+esc(o.name)+'</div>'+
        '<div class="ba-sub">'+esc(o.blank?(fmtInt(o.ns)+' store · tanpa '+(BESTS.kind==="pa"?"PA":"promotor")):((BESTS.kind==="pa"?"SPA ":"PA ")+(o.parent||"—")+' · '+fmtInt(o.ns)+' store'))+'</div></div>'+
      '<div class="ba-mid"><span class="bar-track"><span class="bar-fill" style="width:'+w.toFixed(1)+'%"></span>'+
        (we>w?'<span class="ba-estmark" style="left:'+Math.min(99.5,we).toFixed(1)+'%"></span>':'')+'</span>'+
        '<div class="ba-legend"><b>Ach '+p1(o.ach)+'</b><span>Est '+p1(o.est)+'</span></div></div>'+
      '<div class="ba-money"><b>'+fmtIDR(o.ag)+'</b><span>dari '+fmtIDR(o.tg)+'</span></div>'+
      '<div class="ba-stat"><span class="pill '+o.st.c+'">'+o.st.t+'</span></div>'+
    '</div>';
  });
  list.innerHTML=html;
  if(foot) foot.textContent="Total di atas hanya store yang punya target (Target.xlsx) dan lolos filter — angkanya sama dengan baris TOTAL pada tabel Target vs Achievement. Estimasi EOM = aktual ×"+rd.fac.toLocaleString("id-ID",{maximumFractionDigits:2})+".";
  var fVals=[F.year,F.month,F.ins,F.part,F.am,F.spa,F.pa,F.prom,F.prod,F.store,F.status];
  var actF=fVals.filter(function(v){return v&&v.length;}).length;
  var nVal=fVals.reduce(function(x,v){return x+(v?v.length:0);},0);
  if($("filterCount")) $("filterCount").textContent=((actF?(actF+" filter aktif"+(nVal>actF?" ("+nVal+" pilihan)":"")):"Tanpa filter")+(SEARCH_Q?(' · cari "'+SEARCH_Q+'"'):""))+" · "+rows.length+" "+kindTxt;
  if($("periodSub")) $("periodSub").textContent="Periode target: "+tmLbl+" · data per tgl "+rd.elapsed+" · "+rows.length+" "+kindTxt;
  if($("metaLine")) $("metaLine").textContent="Dibuat "+((DATA.meta&&DATA.meta.generated)||"")+" · Sumber: Target.xlsx ("+((DATA.target&&DATA.target.length)||0)+" store) + Data-raw.xlsx · estimasi EOM = aktual ×"+rd.fac.toLocaleString("id-ID",{maximumFractionDigits:2});
}

/* ================= SETTING (khusus Administrator) =================
   Halaman Account (info akun + ubah kata sandi) dan Keamanan (riwayat akses).
   Dashboard ini statis (tanpa server), jadi:
   - kata sandi baru disimpan sebagai hash di localStorage browser ini, dan bisa
     diterapkan permanen lewat patch + tools/apply-password.ps1 lalu refresh data;
   - riwayat akses dicatat di localStorage perangkat ini. */
var SESS_KEY="qoala.sessions", SESS_CUR="qoala.sessid", PW_KEY="qoala.pw";
var pendingPatch=[];

function lsGet(k,d){
  try{ var v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; }
}
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function dlFile(name,text,mime){
  var b=new Blob([text],{type:mime||"text/plain;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(b); a.download=name; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
}
function deviceLabel(){
  var ua=navigator.userAgent||"";
  var os=/Windows/i.test(ua)?"Windows":/Android/i.test(ua)?"Android":/iPhone|iPad|iPod/i.test(ua)?"iOS":/Mac OS X/i.test(ua)?"macOS":/Linux/i.test(ua)?"Linux":"Lainnya";
  var br=/Edg\//i.test(ua)?"Edge":/OPR\//i.test(ua)?"Opera":/Chrome\//i.test(ua)?"Chrome":/Firefox\//i.test(ua)?"Firefox":/Safari\//i.test(ua)?"Safari":"Browser";
  return os+" · "+br;
}
function sessList(){ var a=lsGet(SESS_KEY,[]); return Array.isArray(a)?a:[]; }
function sessCurrentId(){ try{ return sessionStorage.getItem(SESS_CUR); }catch(e){ return null; } }
function sessStart(u){
  var arr=sessList();
  var id="s"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
  arr.push({id:id,u:u.u,n:u.n||u.u,r:u.r||"",t0:Date.now(),t1:Date.now(),dev:deviceLabel()});
  if(arr.length>300) arr=arr.slice(arr.length-300);
  lsSet(SESS_KEY,arr);
  try{ sessionStorage.setItem(SESS_CUR,id); }catch(e){}
  return id;
}
function sessTouch(){
  var id=sessCurrentId(); if(!id) return;
  var arr=sessList(), hit=false;
  for(var i=0;i<arr.length;i++){ if(arr[i].id===id){ arr[i].t1=Date.now(); hit=true; } }
  if(hit) lsSet(SESS_KEY,arr);
}
function fmtDur(ms){
  if(!isFinite(ms)||ms<0) return "—";
  var s=Math.floor(ms/1000), m=Math.floor(s/60), h=Math.floor(m/60);
  if(h>0) return h+" j "+String(m%60).padStart(2,"0")+" m";
  if(m>0) return m+" m "+String(s%60).padStart(2,"0")+" d";
  return "<1 m";
}
function fmtTime(ts){
  if(!ts) return "—";
  var d=new Date(ts);
  var mo=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()];
  return d.getDate()+" "+mo+" "+d.getFullYear()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}
/* --- kata sandi: hash efektif (patch lokal menimpa hash dari Master_user) --- */
function effHash(u){ if(!u) return ""; var m=lsGet(PW_KEY,{})||{}; return m[u.u]||u.h; }
function setLocalPw(u,plain){
  var m=lsGet(PW_KEY,{})||{};
  m[u.u]=hashPw(plain);
  lsSet(PW_KEY,m);
  u.h=m[u.u];
}
/* --- halaman Account --- */
function accountHTML(){
  return '<section class="card"><div class="card-h row"><div><h2>Account</h2><p class="muted">Informasi akun dan penggantian kata sandi.</p></div>'+
    '<div class="tabs" id="accTabs"><button type="button" data-a="info" class="on">Info</button><button type="button" data-a="pw">Ubah Kata Sandi</button></div></div>'+
    '<div id="accInfo" class="acc-pane"></div><div id="accPw" class="acc-pane" hidden></div></section>';
}
function renderAccountInfo(){
  if(!USER||!$("accInfo")) return;
  var scopeTxt = LOCK ? ((LOCK.level===1?"SPA ":"PA ")+LOCK.name) : (BLOCKED?"Tanpa akses":"Semua data (semua SPA)");
  var cur=sessList().filter(function(s){ return s.id===sessCurrentId(); })[0]||null;
  var m=lsGet(PW_KEY,{})||{};
  $("accInfo").innerHTML='<div class="kv">'+
    '<div>Nama</div><div><b>'+esc(USER.n||"—")+'</b></div>'+
    '<div>Email</div><div>'+esc(USER.u||"—")+'</div>'+
    '<div>Role</div><div><span class="pill ok">'+esc(USER.r||"—")+'</span></div>'+
    '<div>Akses data</div><div>'+esc(scopeTxt)+'</div>'+
    '<div>Kata sandi</div><div>•••••••• <span class="muted-sm">'+(m[USER.u]?"· diubah di browser ini":"· dari Master_user.xlsx")+'</span></div>'+
    '<div>Sesi ini</div><div>'+(cur?("mulai "+fmtTime(cur.t0)+" · "+fmtDur(Date.now()-cur.t0)):"—")+'</div>'+
    '<div>Perangkat</div><div>'+esc(deviceLabel())+'</div>'+
  '</div>';
}
function renderAccountPw(){
  var box=$("accPw"); if(!box) return;
  box.innerHTML=
    '<form id="pwForm" class="form-col" autocomplete="off">'+
      '<label>Password sekarang<input id="pwCur" type="password" autocomplete="current-password" spellcheck="false"></label>'+
      '<label>Password baru<input id="pwNew" type="password" autocomplete="new-password" spellcheck="false" placeholder="minimal 6 karakter"></label>'+
      '<label>Konfirmasi password baru<input id="pwNew2" type="password" autocomplete="new-password" spellcheck="false"></label>'+
      '<div class="row-btns"><button class="btn primary" type="submit">Simpan kata sandi</button>'+
        '<button class="btn ghost" type="button" id="pwPatch" hidden>Unduh patch password</button></div>'+
      '<div id="pwMsg" class="notice" hidden></div>'+
      '<p class="muted">Password baru langsung berlaku di browser ini. Agar berlaku untuk semua perangkat: unduh patch, lalu jalankan <code>tools\\apply-password.ps1 -File password-patch.json</code> dan <code>tools\\refresh.bat</code>.</p>'+
    '</form>';
  bindPwForm();
}
function bindPwForm(){
  var f=$("pwForm"); if(!f) return;
  f.addEventListener("submit",function(ev){
    ev.preventDefault();
    if(!USER) return;
    var cur=$("pwCur").value, n1=$("pwNew").value, n2=$("pwNew2").value;
    function msg(t,ok){ var m=$("pwMsg"); if(!m) return; m.textContent=t; m.className="notice "+(ok?"ok":"err"); m.hidden=false; }
    if(!cur) return msg("Masukkan password sekarang.",false);
    if(effHash(USER)!==hashPw(cur)) return msg("Password sekarang salah.",false);
    if(n1.length<6) return msg("Password baru minimal 6 karakter.",false);
    if(n1!==n2) return msg("Konfirmasi password baru tidak sama.",false);
    if(n1===cur) return msg("Password baru harus berbeda dari password sekarang.",false);
    setLocalPw(USER,n1);
    pendingPatch.push({email:USER.u,name:USER.n||USER.u,role:USER.r||"",password:n1});
    $("pwCur").value=""; $("pwNew").value=""; $("pwNew2").value="";
    var pb=$("pwPatch"); if(pb) pb.hidden=false;
    msg("Kata sandi berhasil diubah dan langsung berlaku di browser ini.",true);
    renderAccountInfo();
  });
  var pb=$("pwPatch");
  if(pb) pb.addEventListener("click",function(){
    if(!pendingPatch.length) return;
    var payload={generated:new Date().toISOString(),
      note:"Patch kata sandi dashboard Qoala. Jalankan: tools/apply-password.ps1 -File <file ini>",
      items:pendingPatch};
    dlFile("password-patch.json",JSON.stringify(payload,null,2),"application/json");
  });
}
/* --- halaman Keamanan --- */
function securityHTML(){
  return '<section class="card"><div class="card-h"><div><h2>Sesi saat ini</h2><p class="muted">Sesi login yang sedang dipakai di perangkat ini.</p></div></div><div id="secNow"></div></section>'+
    '<section class="card"><div class="card-h row"><div><h2>Riwayat akses web</h2><p class="muted">Akun yang pernah membuka dashboard di browser/perangkat ini.</p></div>'+
      '<div class="row-btns"><button class="btn ghost sm" type="button" id="secCsv">Ekspor CSV</button><button class="btn ghost sm" type="button" id="secClear">Hapus riwayat</button></div></div>'+
      '<div class="tbl-wrap"><table class="sc sec-table" id="secTable"><thead><tr><th>Akun</th><th class="hide-sm">Role</th><th>Masuk</th><th class="hide-sm">Terakhir aktif</th><th>Durasi</th><th class="hide-sm">Perangkat</th></tr></thead><tbody></tbody></table></div>'+
      '<p class="muted">Catatan: dashboard ini statis (tanpa server), jadi riwayat hanya tercatat di browser ini dan tidak tergabung dari perangkat lain.</p></section>';
}
function renderSecurity(){
  var arr=sessList().slice().sort(function(a,b){ return (b.t0||0)-(a.t0||0); });
  var cur=sessCurrentId(), now=Date.now();
  var c=arr.filter(function(s){ return s.id===cur; })[0]||null;
  if($("secNow")){
    $("secNow").innerHTML = c ? ('<div class="kv"><div>Akun</div><div><b>'+esc(c.n)+'</b> · '+esc(c.u)+'</div>'+
      '<div>Role</div><div>'+esc(c.r||"—")+'</div>'+
      '<div>Masuk</div><div>'+fmtTime(c.t0)+'</div>'+
      '<div>Durasi berjalan</div><div><b id="secNowDur">'+fmtDur(now-c.t0)+'</b></div>'+
      '<div>Perangkat</div><div>'+esc(c.dev||"—")+'</div></div>')
      : '<p class="muted">Tidak ada sesi aktif.</p>';
  }
  var tb=$("secTable")?$("secTable").querySelector("tbody"):null;
  if(tb){
    tb.innerHTML = arr.length ? arr.map(function(s){
      var dur=(s.t1||s.t0)-(s.t0||s.t1), active=(s.id===cur);
      return '<tr><td>'+esc(s.n||"")+'<div class="muted-sm">'+esc(s.u||"")+'</div></td>'+
        '<td class="hide-sm">'+esc(s.r||"—")+(active?' <span class="pill ok">aktif</span>':'')+'</td>'+
        '<td>'+fmtTime(s.t0)+'</td><td class="hide-sm">'+fmtTime(s.t1)+'</td><td>'+fmtDur(dur)+'</td><td class="hide-sm">'+esc(s.dev||"—")+'</td></tr>';
    }).join("") : '<tr><td colspan="6">Belum ada riwayat.</td></tr>';
  }
  if($("secCsv")) $("secCsv").onclick=function(){
    var head="akun,email,role,masuk,terakhir_aktif,durasi_menit,perangkat\n";
    var rows=arr.map(function(s){
      var dur=((s.t1||s.t0)-(s.t0||s.t1))/60000;
      return [s.n||"",s.u||"",s.r||"",new Date(s.t0).toISOString(),new Date(s.t1||s.t0).toISOString(),(Math.round(dur*10)/10),s.dev||""]
        .map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(",");
    }).join("\n");
    dlFile("riwayat-akses-"+new Date().toISOString().slice(0,10)+".csv",head+rows,"text/csv;charset=utf-8");
  };
  if($("secClear")) $("secClear").onclick=function(){
    if(!confirm("Hapus seluruh riwayat akses di browser ini?")) return;
    lsSet(SESS_KEY,[]);
    try{ sessionStorage.removeItem(SESS_CUR); }catch(e){}
    if(USER) sessStart(USER);
    renderSecurity();
  };
  if(window.__secTimer){ clearInterval(window.__secTimer); window.__secTimer=null; }
  var _lastTouch=Date.now();
  window.__secTimer=setInterval(function(){
    var el=$("secNowDur");
    if(!el){ clearInterval(window.__secTimer); window.__secTimer=null; return; }
    if(c) el.textContent=fmtDur(Date.now()-c.t0);
    if(Date.now()-_lastTouch>15000){ _lastTouch=Date.now(); sessTouch(); }
  },1000);
}
function renderSetting(){
  if(ROUTE==="account"){
    renderAccountInfo(); renderAccountPw();
    var tabs=$("accTabs");
    if(tabs) tabs.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click",function(){
        tabs.querySelectorAll("button").forEach(function(x){ x.classList.remove("on"); });
        b.classList.add("on");
        var info=$("accInfo"), pw=$("accPw");
        if(info) info.hidden=(b.dataset.a!=="info");
        if(pw) pw.hidden=(b.dataset.a!=="pw");
      });
    });
  }else if(ROUTE==="keamanan"){
    renderSecurity();
  }
  var ml=$("metaLine");
  if(ml) ml.textContent="Setting · akun & keamanan · data "+(DATA.meta&&DATA.meta.generated?DATA.meta.generated:"—");
}

/* ================= CAMPAIGN 2026 (Sep–Des 2026) =================
   Program Reward & Trip Qoala Protection x MAP Tech.
   Target : Target-Campaign-2026.xlsx (per store, per bulan Sep–Des).
   Realisasi: Data-raw.xlsx (GWP & polis per store per bulan).
   Growth : rata-rata GWP/bulan Sep–Des vs rata-rata Mei–Agu.
   Syarat T&C: capaian ≥90% target + minimum polis & revenue per BU. */
var CAMP = {bu:"ALL", q:"", sort:"score", tab:"all"};
var CAMP_VOUCHER = {
  store:[{r:1,n:1,v:10000000},{r:2,n:1,v:9000000},{r:3,n:1,v:8000000},{r:4,n:2,v:6000000},{r:5,n:3,v:5000000},{r:6,n:7,v:4000000},{r:7,n:60,v:2500000}],
  am:[{r:1,n:1,v:10000000},{r:2,n:1,v:8500000},{r:3,n:1,v:6500000},{r:4,n:3,v:4500000},{r:5,n:5,v:3500000},{r:6,n:7,v:2000000}],
  rh:[{r:1,n:1,v:8000000},{r:2,n:2,v:5500000},{r:3,n:2,v:4000000}]
};
function campTier(list,pos){
  var acc=0;
  for(var i=0;i<list.length;i++){ acc+=list[i].n; if(pos<=acc) return list[i]; }
  return null;
}
var CAMP_CACHE=null;
function campaignData(){
  var C=DATA.campaign||[];
  var meta=DATA.campaignMeta||{};
  var cm=meta.months||["2026-09","2026-10","2026-11","2026-12"];
  var bm=meta.base||["2026-05","2026-06","2026-07","2026-08"];
  var lockKey=LOCK?(LOCK.field+":"+LOCK.idx):"ALL";
  if(CAMP_CACHE && CAMP_CACHE.lock===lockKey) return CAMP_CACHE;
  var mi={},i;
  for(i=0;i<DATA.months.length;i++) mi[DATA.months[i]]=i;
  var cmIdx=cm.map(function(x){ return mi[x]==null?-1:mi[x]; });
  var cmSet={}, bmSet={};
  cmIdx.forEach(function(x){ if(x>=0) cmSet[x]=1; });
  bm.forEach(function(x){ if(mi[x]!=null) bmSet[mi[x]]=1; });
  var sim={};
  for(i=0;i<DATA.store.length;i++) sim[DATA.store[i]]=i;
  var byName={}, byNorm={}, byIdx={}, rows=[];
  C.forEach(function(t){
    var o={t:t, si:(sim[t.s]==null?-1:sim[t.s]), base:0, baseN:0, m:{}, n:{}};
    rows.push(o);
    byName[t.s]=o;
    byNorm[norm(t.s)]=o;
    if(o.si>=0) byIdx[o.si]=o;
  });
  var facts=DATA.facts;
  for(i=0;i<facts.length;i++){
    var f=facts[i];
    var sn=DATA.store[f[4]];
    var o=byName[sn]||byNorm[norm(sn)]||byIdx[f[4]];
    if(!o) continue;
    if(LOCK){
      if(String(f[LOCK.field])!==String(LOCK.idx)) continue;
      o.scope=1;   /* store ini milik user yang terkunci */
    }
    var m=f[0];
    if(bmSet[m]){ o.base+=f[10]; o.baseN+=f[11]; }
    else if(cmSet[m]){ o.m[m]=(o.m[m]||0)+f[10]; o.n[m]=(o.n[m]||0)+f[11]; }
  }
  /* user PA/Promotor hanya melihat store dalam lingkupnya (ditandai o.scope) */

  /* bulan campaign yang sudah ada datanya (mis. Sep & Okt) */
  var live=[];
  cm.forEach(function(ym,k){ if(mi[ym]!=null && cmIdx[k]>=0) live.push({ym:ym, k:k, idx:cmIdx[k]}); });
  var tgtF=function(T){ return [T.ts,T.to,T.tn,T.td]; };
  var nLive=live.length||1;
  rows.forEach(function(o){
    var T=tgtF(o.t);
    o.tgt4=T.reduce(function(a,b){return a+(b||0);},0);
    o.tgtE=0; o.act=0; o.pol=0;
    live.forEach(function(L){
      o.tgtE+=T[L.k]||0;
      o.act+=o.m[L.idx]||0;
      o.pol+=o.n[L.idx]||0;
    });
    o.ach=o.tgtE>0?o.act/o.tgtE:0;
    o.baseAvg=o.base/4;
    o.actAvg=o.act/nLive;
    o.growth=(o.baseAvg>0)?(o.actAvg/o.baseAvg-1):null;
    o.gIdx=(o.growth==null)?0.5:Math.max(0,Math.min(1,0.5+o.growth/2));
    o.score=0.5*o.ach+0.5*o.gIdx;
    o.achAll=o.tgt4>0?o.act/o.tgt4:0;
    var minCfg=(meta.min||{})[o.t.p]||{polis:0,rev:0};
    var scale=nLive/4;
    o.minPolis=(minCfg.polis||0)*scale;
    o.minRev=(minCfg.rev||0)*scale;
    o.eligible=(o.ach>=(meta.threshold||0.9)) && o.pol>=o.minPolis && o.act>=o.minRev;
    o.bu=o.t.p||"(tanpa BU)";
  });
  CAMP_CACHE={lock:lockKey, rows:rows, tot:campTotals(rows,cm,live), cm:cm, live:live, meta:meta};
  return CAMP_CACHE;
}
function campTotals(rows, cm, live){
  var nLive=live.length||1;
  var tot={tgt4:0,tgtE:0,act:0,pol:0,base:0,baseN:0,tgtBy:{},actBy:{},polBy:{}};
  rows.forEach(function(o){
    var T=[o.t.ts,o.t.to,o.t.tn,o.t.td];
    tot.tgt4+=o.tgt4; tot.tgtE+=o.tgtE; tot.act+=o.act; tot.pol+=o.pol;
    tot.base+=o.base; tot.baseN+=o.baseN;
    live.forEach(function(L){
      tot.actBy[L.ym]=(tot.actBy[L.ym]||0)+(o.m[L.idx]||0);
      tot.polBy[L.ym]=(tot.polBy[L.ym]||0)+(o.n[L.idx]||0);
    });
    cm.forEach(function(ym,k){ tot.tgtBy[ym]=(tot.tgtBy[ym]||0)+(T[k]||0); });
  });
  cm.forEach(function(ym){ if(tot.tgtBy[ym]==null) tot.tgtBy[ym]=0; });
  tot.months=cm; tot.live=live; tot.ach=tot.tgtE>0?tot.act/tot.tgtE:0;
  tot.baseAvg=tot.base/4; tot.actAvg=tot.act/nLive;
  tot.growth=tot.baseAvg>0?(tot.actAvg/tot.baseAvg-1):null;
  return tot;
}
function campGroup(rows, field){
  var m={}, order=[];
  rows.forEach(function(o){
    var k=clean(o.t[field])||"(Kosong)";
    if(!m[k]){ m[k]={k:k,tgt4:0,tgtE:0,act:0,pol:0,base:0,n:0,eligible:0,maxScore:0,sumScore:0}; order.push(k); }
    var g=m[k];
    g.tgt4+=o.tgt4; g.tgtE+=o.tgtE; g.act+=o.act; g.pol+=o.pol; g.base+=o.base; g.n++;
    if(o.eligible) g.eligible++;
    g.sumScore+=o.score; if(o.score>g.maxScore) g.maxScore=o.score;
  });
  order.forEach(function(k){
    var g=m[k];
    g.ach=g.tgtE>0?g.act/g.tgtE:0;
    g.baseAvg=g.base/4; g.actAvg=g.act/((campaignData().live.length)||1);
    g.growth=g.baseAvg>0?(g.actAvg/g.baseAvg-1):null;
    g.gIdx=(g.growth==null)?0.5:Math.max(0,Math.min(1,0.5+g.growth/2));
    g.score=0.5*g.ach+0.5*g.gIdx;
  });
  var arr=order.map(function(k){return m[k];});
  arr.sort(function(a,b){return b.score-a.score;});
  arr.forEach(function(g,i){ g.rank=i+1; });
  return arr;
}
function campRowsFiltered(){
  var D=campaignData();
  var base=LOCK?D.rows.filter(function(o){ return o.scope; }):D.rows;
  var rows=base.filter(function(o){
    if(CAMP.bu!=="ALL" && CAMP.bu!=="Digiplus75" && CAMP.bu!=="Digimap75" && o.bu!==CAMP.bu) return false;
    if(CAMP.q){ var hay=norm(o.t.s+" "+clean(o.t.rh)+" "+clean(o.t.pa)+" "+clean(o.t.am)+" "+clean(o.t.spa)); if(hay.indexOf(CAMP.q)<0) return false; }
    if(CAMP.tab==="ok" && !o.eligible) return false;
    if(CAMP.tab==="no" && o.eligible) return false;
    return true;
  });
  return {D:D, rows:rows};
}
function campaignHTML(){
  return '<section class="kpis" id="cKpis"></section>'+
    '<section class="card"><div class="card-h row"><div><h2>Progres campaign per bulan <span class="muted-sm">Sep–Des 2026</span></h2><p class="muted" id="cMonthNote"></p></div></div>'+
      '<div class="tbl-wrap"><table id="cMonthTable" class="tgt"><thead><tr><th>Bulan</th><th>Tgt GWP</th><th>Akt GWP</th><th>Ach</th><th>Polis</th><th>Progres</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></section>'+
    '<section class="card" id="cLeadCard"><div class="card-h row"><div><h2 id="cLeadTitle">Leaderboard store — voucher MAP</h2><p class="muted" id="cNote"></p></div>'+
      '<div class="tabs" id="cBuTabs"><button data-b="ALL" class="on">Semua</button><button data-b="Digiplus">Digiplus</button><button data-b="Digimap">Digimap</button><button data-b="Digiplus75">75 store Digiplus by %</button><button data-b="Digimap75">75 store Digimap by %</button></div></div>'+
      '<div id="cLeadBody">'+
        '<div class="kpis" id="cBuKpis" style="margin-top:12px"></div>'+
        '<div class="tgt-controls"><input id="cSearch" type="search" placeholder="Cari store / PA / AM / SPA…">'+
          '<select id="cSort"><option value="score">Urut: Skor (Ach+Growth)</option><option value="ach">Urut: Achievement</option><option value="growth">Urut: Growth</option><option value="act">Urut: Aktual GWP</option><option value="tgt">Urut: Target terbesar</option></select>'+
          '<div class="tabs" id="cTabTabs"><button data-t="all" class="on">Semua</button><button data-t="ok">Memenuhi syarat</button><button data-t="no">Belum memenuhi</button></div>'+
          '<button class="btn ghost sm" id="cCsv" type="button">Unduh CSV</button></div>'+
        '<div class="tbl-wrap"><table id="cTable" class="tgt camp-tbl"><thead><tr><th class="sticky rk">Rank</th><th class="sticky">Store</th><th>BU</th><th>RH</th><th>AM</th><th>SPA</th><th>PA</th><th>Target Sep–Des</th><th>Target s/d bln ini</th><th>GWP Campaign</th><th>Ach</th><th>Policy Campaign</th><th>Growth vs Mei–Agu</th><th>Skor</th><th>Status</th><th>Voucher</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div>'+
      '</div>'+
      '<div id="cTopBody" style="display:none">'+
        '<p class="muted" id="cTopNote" style="margin:0 0 8px"></p>'+
        '<div class="tbl-wrap"><table id="cTopTable" class="tgt camp-tbl"><thead><tr><th class="sticky rk">Rank</th><th class="sticky">Store</th><th>RH</th><th>AM</th><th>SPA</th><th>PA</th><th>Target Sep–Des</th><th>GWP MTD</th><th>Ach %</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div>'+
      '</div></section>'+
    '<div class="cols2"><section class="card"><h2>Leaderboard AM <span class="muted-sm">voucher MAP · 18 pemenang</span></h2><div id="cAm"></div></section>'+
      '<section class="card"><h2>Leaderboard SPV &amp; RH <span class="muted-sm">best SPV per BU · best RH</span></h2><div id="cSpa"></div></section></div>'+
    '<section class="card"><h2>Grand Prize — Trip Korea Selatan <span class="muted-sm">simulasi 25 pemenang</span></h2><div id="cGrand" class="grand-grid"></div></section>'+
    '<section class="card"><h2>Syarat &amp; ketentuan ringkas <span class="muted-sm">QOALA Program Reward 2026</span></h2><ul id="cTc" class="trend-list"></ul></section>';
}
function renderCampaign(){
  var D=campaignData(), meta=D.meta;
  var R=LOCK?D.rows.filter(function(o){ return o.scope; }):D.rows;
  var T=(R.length===D.rows.length)?D.tot:campTotals(R,D.cm,D.live);
  var liveNames=D.live.map(function(L){ return ymLabel(L.ym); });
  var lastLive=liveNames.length?liveNames[liveNames.length-1]:"—";
  if($("periodSub")) $("periodSub").innerHTML=esc("Periode: Sep–Des 2026 · realisasi s/d "+lastLive)+(LOCK?'<span class="hide-sm">'+esc(" · data terkunci")+'</span>':'');
  if($("metaLine")) $("metaLine").textContent="Dibuat "+((DATA.meta&&DATA.meta.generated)||"—")+" · target: Target-Campaign-2026.xlsx ("+D.rows.length+" store) · realisasi: Data-raw.xlsx";
  if(CAMP_CACHE) CAMP_CACHE.live=D.live;
  if(!D.rows.length){
    $("cKpis").innerHTML='<div class="kpi"><div class="t">Campaign 2026</div><div class="v">Belum ada target</div></div>';
    return;
  }
  /* ---- KPI ---- */
  var eligibleAll=R.filter(function(o){return o.eligible;}).length;
  var actMonth=D.live.length?T.act/liveNames.length:0;
  $("cKpis").innerHTML=
    '<div class="kpi"><div class="t">Target campaign Sep–Des</div><div class="v">'+fmtIDR(T.tgt4)+'</div><div class="d flat">'+R.length+' store · '+esc(meta.label||"Campaign 2026")+'</div></div>'+
    '<div class="kpi"><div class="t">Realisasi s/d '+esc(lastLive)+'</div><div class="v">'+fmtIDR(T.act)+'</div><div class="d flat">target '+esc(liveNames.join(" + "))+' = '+fmtIDR(T.tgtE)+'</div></div>'+
    '<div class="kpi"><div class="t">Achievement</div><div class="v">'+fmtPctPlain(T.ach)+'</div><div class="d '+(T.ach>=0.9?"up":(T.ach>=0.7?"flat":"down"))+'">syarat T&amp;C ≥ 90%</div></div>'+
    '<div class="kpi"><div class="t">Growth vs Mei–Agu</div><div class="v">'+fmtPct(T.growth)+'</div><div class="d flat">'+fmtIDR(T.actAvg)+'/bln vs '+fmtIDR(T.baseAvg)+'/bln</div></div>'+
    '<div class="kpi"><div class="t">Store memenuhi syarat</div><div class="v">'+fmtInt(eligibleAll)+' / '+R.length+'</div><div class="d flat">ach ≥ 90% + minimum polis &amp; revenue</div></div>'+
    '<div class="kpi"><div class="t">Voucher store (simulasi)</div><div class="v" id="cVoucher">—</div><div class="d flat">kuota '+((meta.winnerSlots||75)*2)+' pemenang (75 per BU)</div></div>';
  /* ---- progres bulanan ---- */
  var mb="";
  D.cm.forEach(function(ym,k){
    var tg=T.tgtBy[ym]||0, ac=T.actBy[ym];
    var has=(ac!=null);
    var pct=tg>0&&has?ac/tg:NaN;
    mb+='<tr><td><b>'+esc(ymLabel(ym))+'</b></td><td>'+fmtIDR(tg)+'</td><td>'+(has?fmtIDR(ac):'<span class="flat">belum ada data</span>')+'</td>'+
      '<td>'+(isFinite(pct)?fmtPctPlain(pct):'—')+'</td><td>'+(has?fmtInt(T.polBy[ym]||0):'—')+'</td>'+
      '<td><div class="bar-track"><div class="bar-fill" style="width:'+(isFinite(pct)?Math.max(1,Math.min(100,pct*100)):0).toFixed(1)+'%"></div></div></td></tr>';
  });
  if($("cMonthTable")){
    $("cMonthTable").querySelector("tbody").innerHTML=mb;
    $("cMonthTable").querySelector("tfoot").innerHTML='<tr><td><b>TOTAL</b></td><td>'+fmtIDR(T.tgt4)+'</td><td>'+fmtIDR(T.act)+'</td><td>'+fmtPct(T.ach)+'</td><td>'+fmtInt(T.pol)+'</td><td></td></tr>';
  }
  if($("cMonthNote")) $("cMonthNote").textContent="Target dari Target-Campaign-2026.xlsx. Bulan yang belum berjalan hanya menampilkan target.";
  /* ---- per BU ---- */
  var buKpis="";
  ["Digiplus","Digimap"].forEach(function(bu){
    var g=R.filter(function(o){return o.bu===bu;});
    var tg=g.reduce(function(a,o){return a+o.tgtE;},0), ac=g.reduce(function(a,o){return a+o.act;},0);
    var el=g.filter(function(o){return o.eligible;}).length;
    buKpis+='<div class="kpi"><div class="t">'+bu+'</div><div class="v">'+fmtPctPlain(tg>0?ac/tg:0)+'</div><div class="d flat">'+fmtIDR(ac)+' / '+fmtIDR(tg)+' · '+el+'/'+g.length+' layak · kuota '+(meta.winnerSlots||75)+'</div></div>';
  });
  if($("cBuKpis")) $("cBuKpis").innerHTML=buKpis;
  /* ---- tabel store + peringkat voucher ---- */
  var f=campRowsFiltered().rows;
  var sortFn={
    score:function(a,b){return b.score-a.score;},
    ach:function(a,b){return b.ach-a.ach;},
    growth:function(a,b){return (b.growth==null?-9:b.growth)-(a.growth==null?-9:a.growth);},
    act:function(a,b){return b.act-a.act;},
    tgt:function(a,b){return b.tgt4-a.tgt4;}
  }[CAMP.sort]||function(a,b){return b.score-a.score;};
  f.sort(sortFn);
  /* peringkat & voucher per BU dihitung dari seluruh store BU tsb (bukan hasil filter) */
  var rankMap={}, voucherMap={}, voucherTotal=0;
  ["Digiplus","Digimap"].forEach(function(bu){
    var pool=D.rows.filter(function(o){return o.bu===bu && o.eligible;}).sort(function(a,b){return b.score-a.score;});
    pool.forEach(function(o,i){
      var pos=i+1, tier=campTier(CAMP_VOUCHER.store,pos);
      rankMap[o.t.s]=pos;
      if(tier){ voucherMap[o.t.s]=tier; voucherTotal+=tier.v; }
    });
  });
  if($("cVoucher")) $("cVoucher").textContent=fmtIDR(voucherTotal);
  var body=f.map(function(o){
    var rk=rankMap[o.t.s];
    var v=voucherMap[o.t.s];
    return '<tr'+(o.eligible?'':' class="dim"')+'><td class="sticky rk">'+(rk?fmtInt(rk):'—')+'</td>'+
      '<td class="sticky"><b>'+esc(o.t.s)+'</b></td><td>'+esc(o.bu)+'</td><td>'+esc(clean(o.t.rh))+'</td><td>'+esc(clean(o.t.am))+'</td><td>'+esc(clean(o.t.spa))+'</td><td>'+esc(clean(o.t.pa))+'</td>'+
      '<td>'+fmtIDR(o.tgt4)+'</td><td>'+fmtIDR(o.tgtE)+'</td><td>'+fmtIDR(o.act)+'</td>'+
      '<td><div class="bar-row mini"><span class="v">'+fmtPctPlain(o.ach)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(1,Math.min(100,o.ach*100)).toFixed(1)+'%"></div></div></div></td>'+
      '<td>'+fmtInt(o.pol)+'</td><td>'+fmtPct(o.growth)+'</td><td>'+(o.score*100).toLocaleString("id-ID",{maximumFractionDigits:1})+'</td>'+
      '<td>'+(o.eligible?'<span class="pill ok">Layak</span>':'<span class="pill gray">Belum</span>')+'</td>'+
      '<td>'+(v?fmtIDR(v.v)+' <span class="muted-sm">#'+v.r+'</span>':'—')+'</td></tr>';
  }).join("");
  if($("cTable")){
    $("cTable").querySelector("tbody").innerHTML=body||'<tr><td colspan="16">Tidak ada store yang cocok.</td></tr>';
    var tgtS=f.reduce(function(a,o){return a+o.tgtE;},0), actS=f.reduce(function(a,o){return a+o.act;},0);
    var polS=f.reduce(function(a,o){return a+o.pol;},0);
    $("cTable").querySelector("tfoot").innerHTML='<tr><td class="sticky rk"></td><td class="sticky"><b>TOTAL · '+f.length+' store</b></td><td></td><td></td><td></td><td></td><td></td><td>'+fmtIDR(f.reduce(function(a,o){return a+o.tgt4;},0))+'</td><td>'+fmtIDR(tgtS)+'</td><td>'+fmtIDR(actS)+'</td><td>'+fmtPctPlain(tgtS>0?actS/tgtS:0)+'</td><td>'+fmtInt(polS)+'</td><td></td><td></td><td>'+f.filter(function(o){return o.eligible;}).length+' layak</td><td>'+fmtIDR(f.reduce(function(a,o){var v=voucherMap[o.t.s];return a+(v?v.v:0);},0))+'</td></tr>';
  }
  if($("cNote")) $("cNote").textContent="Peringkat dihitung per BU dari store yang memenuhi syarat (ach ≥ 90% + minimum polis/revenue). Skor = 50% achievement + 50% growth. Voucher = simulasi posisi saat ini.";
  /* ---- mode "75 store by %": Target akumulasi Sep–Des vs GWP MTD (tanpa growth/status/skor) ---- */
  var topBu=(CAMP.bu==="Digiplus75")?"Digiplus":((CAMP.bu==="Digimap75")?"Digimap":null);
  if($("cLeadBody")) $("cLeadBody").style.display=topBu?"none":"";
  if($("cTopBody")) $("cTopBody").style.display=topBu?"":"none";
  if($("cLeadTitle")) $("cLeadTitle").innerHTML=topBu?("75 store "+topBu+" by %"):"Leaderboard store — voucher MAP";
  if($("cNote")) $("cNote").style.display=topBu?"none":"";
  if(topBu && $("cTopTable")){
    var list=R.filter(function(o){ return o.bu===topBu; }).sort(function(a,b){ return b.achAll-a.achAll; }).slice(0,75);
    if($("cTopNote")) $("cTopNote").textContent="Peringkat berdasarkan % target akumulasi Sep–Des vs GWP MTD (s/d "+lastLive+"). Tanpa growth, status, dan skor.";
    var tb=list.map(function(o,i){
      return '<tr><td class="sticky rk">'+(i+1)+'</td><td class="sticky"><b>'+esc(o.t.s)+'</b></td><td>'+esc(clean(o.t.rh))+'</td><td>'+esc(clean(o.t.am))+'</td><td>'+esc(clean(o.t.spa))+'</td><td>'+esc(clean(o.t.pa))+'</td>'+
        '<td>'+fmtIDR(o.tgt4)+'</td><td>'+fmtIDR(o.act)+'</td>'+
        '<td><div class="bar-row mini"><span class="v">'+fmtPctPlain(o.achAll)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(1,Math.min(100,o.achAll*100)).toFixed(1)+'%"></div></div></div></td></tr>';
    }).join("");
    $("cTopTable").querySelector("tbody").innerHTML=tb||'<tr><td colspan="9">Tidak ada store.</td></tr>';
    var tt=list.reduce(function(a,o){return a+o.tgt4;},0), ta=list.reduce(function(a,o){return a+o.act;},0);
    $("cTopTable").querySelector("tfoot").innerHTML='<tr><td class="sticky rk"></td><td class="sticky"><b>TOTAL · '+list.length+' store</b></td><td></td><td></td><td></td><td></td><td>'+fmtIDR(tt)+'</td><td>'+fmtIDR(ta)+'</td><td>'+fmtPctPlain(tt>0?ta/tt:0)+'</td></tr>';
  }
  /* ---- AM ---- */
  var ams=campGroup(R,"am");
  var amHTML=ams.slice(0,18).map(function(g,i){
    var tier=campTier(CAMP_VOUCHER.am,i+1);
    return '<div class="bar-row"><span class="n">'+(i+1)+'. '+esc(g.k)+' <span class="muted-sm">'+g.n+' store</span></span><span class="v">'+fmtPctPlain(g.ach)+' · '+fmtPct(g.growth)+'</span>'+
      '<div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,Math.min(100,g.score*100)).toFixed(1)+'%"></div></div>'+
      '<span class="muted-sm">'+(tier?fmtIDR(tier.v):'—')+'</span></div>';
  }).join("");
  if($("cAm")) $("cAm").innerHTML=amHTML+'<p class="muted-sm" style="margin-top:8px">Skor AM = agregat achievement &amp; growth seluruh store campaign di bawahnya.</p>';
  /* ---- Best SPV (per BU, berbasis store) + Best RH (kolom RH) ---- */
  var spvHTML="";
  ["Digiplus","Digimap"].forEach(function(bu){
    var g=R.filter(function(o){return o.bu===bu && o.eligible;}).sort(function(a,b){return b.score-a.score;}).slice(0,7);
    spvHTML+='<h3 class="sub-head">Best SPV '+bu+' <span class="muted-sm">7 store · grand prize</span></h3>';
    spvHTML+=g.map(function(o,i){ return '<div class="bar-row"><span class="n">'+(i+1)+'. '+esc(o.t.s)+'</span><span class="v">'+fmtPctPlain(o.ach)+' · '+fmtPct(o.growth)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,Math.min(100,o.score*100)).toFixed(1)+'%"></div></div></div>'; }).join("")||'<p class="muted-sm">Belum ada store yang memenuhi syarat.</p>';
  });
  var rhs=campGroup(R,"rh");
  spvHTML+='<h3 class="sub-head">Best RH <span class="muted-sm">5 voucher · grand prize 2</span></h3>'+
    rhs.slice(0,5).map(function(x,i){ var tier=campTier(CAMP_VOUCHER.rh,i+1); return '<div class="bar-row"><span class="n">'+(i+1)+'. '+esc(x.k)+' <span class="muted-sm">'+x.n+' store</span></span><span class="v">'+fmtPctPlain(x.ach)+'</span><div class="bar-track"><div class="bar-fill" style="width:'+Math.max(2,Math.min(100,x.score*100)).toFixed(1)+'%"></div></div><span class="muted-sm">'+(tier?fmtIDR(tier.v):'—')+'</span></div>'; }).join("")+
    '<p class="muted-sm" style="margin-top:8px">Best SPV = peringkat <b>store</b> per BU (7 store). Best RH = agregat store per RH (kolom RH di Target-Campaign-2026). Kategori HO belum tersedia di data.</p>';
  if($("cSpa")) $("cSpa").innerHTML=spvHTML;
  /* ---- grand prize ---- */
  var grand=[];
  ["Digiplus","Digimap"].forEach(function(bu){
    var spv=R.filter(function(o){return o.bu===bu && o.eligible;}).sort(function(a,b){return b.score-a.score;}).slice(0,7);
    grand.push({t:"Best SPV "+bu+" (7)",items:spv.map(function(o,i){return (i+1)+". "+o.t.s;} )});
  });
  ["Digiplus","Digimap"].forEach(function(bu){
    var am=campGroup(R.filter(function(o){return o.bu===bu;}),"am").slice(0,3);
    grand.push({t:"Best AM "+bu+" (3)",items:am.map(function(x,i){return (i+1)+". "+x.k;} )});
  });
  grand.push({t:"Best RH (2)",items:rhs.slice(0,2).map(function(x,i){return (i+1)+". "+x.k;})});
  grand.push({t:"HO (3)",items:["Belum tersedia di data"]});
  if($("cGrand")) $("cGrand").innerHTML=grand.map(function(g){
    return '<div class="grand-card"><div class="gc-t">'+esc(g.t)+'</div><ol>'+g.items.map(function(s,i){return '<li>'+esc(s)+'</li>';}).join("")+'</ol></div>';
  }).join("");
  /* ---- T&C ---- */
  if($("cTc")) $("cTc").innerHTML=[
    "Periode program <b>September–Desember 2026</b>; berlaku untuk store dengan penjualan minimal <b>90% dari target</b>.",
    "Peserta: <b>75 store Digimap</b> dan <b>75 store Digiplus</b> (kuota pemenang voucher). Minimum per BU: Digimap <b>100 polis / Rp 100 jt</b>, Digiplus <b>70 polis / Rp 70 jt</b> selama periode.",
    "Metrik penilaian: <b>pencapaian target</b> dan <b>growth Sep–Des vs Mei–Agu</b>.",
    "Voucher store per BU: Rp 10 jt (1), Rp 9 jt (1), Rp 8 jt (1), Rp 6 jt (2), Rp 5 jt (3), Rp 4 jt (7), Rp 2,5 jt (60) → total 75 pemenang per BU.",
    "Voucher AM: Rp 10 jt (1), Rp 8,5 jt (1), Rp 6,5 jt (1), Rp 4,5 jt (3), Rp 3,5 jt (5), Rp 2 jt (7) → 18 pemenang.",
    "Voucher RH: Rp 8 jt (1), Rp 5,5 jt (2), Rp 4 jt (2) → 5 pemenang.",
    "Grand Prize: trip Korea Selatan (± April 2027) untuk <b>25 pemenang</b>: Best SPV Digimap 7, Best SPV Digiplus 7, Best AM Digimap 3, Best AM Digiplus 3, Best RH 2, HO 3."
  ].map(function(s){return "<li>"+s+"</li>";}).join("");
  /* ---- binding ---- */
  var cs=$("cSearch");
  if(cs){ cs.value=CAMP.q; cs.oninput=function(e){ CAMP.q=norm(e.target.value); renderCampaign(); }; }
  var so=$("cSort");
  if(so){ so.value=CAMP.sort; so.onchange=function(e){ CAMP.sort=e.target.value; renderCampaign(); }; }
  ["cBuTabs","cTabTabs"].forEach(function(id){
    var box=$(id); if(!box) return;
    var key=(id==="cBuTabs")?"bu":"tab";
    box.querySelectorAll("button").forEach(function(b){
      var v=(id==="cBuTabs")?b.dataset.b:b.dataset.t;
      b.classList.toggle("on",CAMP[key]===v);
      b.onclick=function(){ CAMP[key]=v; renderCampaign(); };
    });
  });
  var csv=$("cCsv");
  if(csv) csv.onclick=function(){
    var head="rank,store,bu,rh,am,spa,pa,target_sep_des,target_sd_bulan,aktual_sd_bulan,ach_pct,polis,growth_pct,skor,layak,voucher\n";
    var lines=f.map(function(o){
      var v=voucherMap[o.t.s];
      return [rankMap[o.t.s]||"",o.t.s,o.bu,o.t.rh||"",o.t.am||"",o.t.spa||"",o.t.pa||"",Math.round(o.tgt4),Math.round(o.tgtE),Math.round(o.act),
        (o.ach*100).toFixed(1),o.pol,(o.growth==null?"":(o.growth*100).toFixed(1)),(o.score*100).toFixed(1),(o.eligible?"ya":"belum"),v?v.v:""]
        .map(function(x){ return '"'+String(x).replace(/"/g,'""')+'"'; }).join(",");
    }).join("\n");
    dlFile("campaign-2026-"+new Date().toISOString().slice(0,10)+".csv",head+lines,"text/csv;charset=utf-8");
  };
}

/* ---- halaman ---- */
function pageHTML(){
  if(ROUTE==="campaign") return campaignHTML();
  if(ROUTE==="account") return accountHTML();
  if(ROUTE==="keamanan") return securityHTML();
  if(ROUTE==="best") return bestHTML();
  var cards=(BREAKS[ROUTE]||[]).map(function(b){
    var isAch=(b.map==="byAm"||b.map==="byPa"||b.map==="byProm");
    var sub=isAch?"":' <span class="muted-sm" id="'+b.id+'sub"></span>';
    return {html:'<section class="card"><h2>'+b.t+sub+'</h2><div id="'+b.id+'"></div></section>', half:!!b.half};
  });
  var grid1=cards.slice(0,2).map(function(c){return c.html;}).join("");
  var rest="", buf=[];
  function flush(){ if(buf.length){ rest+='<div class="cols2">'+buf.join("")+'</div>'; buf=[]; } }
  cards.slice(2).forEach(function(c){ if(c.half) buf.push(c.html); else { flush(); rest+=c.html; } });
  flush();
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
  var pmLbl=(DATA.targetMeta&&DATA.targetMeta.month)?ymLabel(prevYm(DATA.targetMeta.month)).slice(0,3):"bln lalu";
  var yyM=(DATA.targetMeta&&DATA.targetMeta.month)?(parseInt(DATA.targetMeta.month.slice(0,4),10)-1)+DATA.targetMeta.month.slice(4):null;
  var yyLbl=yyM?ymLabel(yyM).slice(0,3):"thn lalu";
  var yyLblFull=yyM?ymLabel(yyM):"bulan yang sama tahun lalu";
  var el0=elapsedOf();
  var adminBtns="", exitBtn="";
  if(isAdminUser()){
    adminBtns='<button id="tgtRpt" class="btn ghost sm" type="button" aria-pressed="false" title="Mode laporan: sembunyikan kolom PA, Promotor, dan NoP + tampilkan semua baris supaya mudah di-screenshot">Mode laporan</button>'+
      '<button id="tgtShot" class="btn ghost sm" type="button" aria-pressed="false" title="Mode screenshot: tabel dirapatkan + kartu/tab/kontrol disembunyikan supaya semua store dan baris TOTAL muat dalam satu tangkapan layar">Mode screenshot</button>';
    exitBtn='<button id="shotExit" class="shot-exit" type="button" title="Keluar dari mode screenshot (Esc)">&times; Keluar mode screenshot</button>';
  }
  h+='<section class="card" id="tgtSec"><div class="card-h row"><div><h2>Target vs Achievement — '+tmLbl+' <span class="muted-sm">data per tgl '+(el0||"—")+'</span></h2><p class="muted" id="tgtNote"></p></div>'+
     '<div class="tabs" id="tgtTabs"><button data-t="all" class="on">Semua</button><button data-t="behind">Belum 100%</button><button data-t="done">Tercapai</button></div></div>'+
     '<div class="kpis" id="tgtKpis" style="margin-top:12px"></div>'+
     '<div class="tgt-controls"><input id="tgtSearch" type="search" placeholder="Cari store / PA / promotor…"><span class="muted-sm hide-sm">pencarian berlaku ke seluruh halaman (kartu KPI, tren, blok, tabel)</span><select id="tgtSort"><option value="estHi">Urut: Estimasi % tertinggi</option><option value="tg">Urut: Target GWP terbesar</option><option value="achLo">Urut: Achievement GWP terendah</option><option value="achHi">Urut: Achievement GWP tertinggi</option><option value="gap">Urut: Selisih GWP terbesar</option></select>'+
          adminBtns+'</div>'+
     '<div id="shotCap" class="shot-cap" hidden></div>'+
     '<div class="tbl-wrap tgt-wrap"><table id="tgtTable" class="tgt"><thead><tr><th class="sticky rk">No</th><th class="sticky">Store</th><th>PA</th><th>Promotor</th><th>Tgt NoP</th><th>Akt NoP</th><th>Ach NoP</th><th>Tgt GWP</th><th>Akt GWP</th><th>Ach GWP</th><th>Est NoP</th><th>Est GWP</th><th>Est Ach</th><th title="Target harian = sisa target GWP ÷ sisa hari bulan berjalan. GWP yang harus masuk tiap hari agar target store tercapai.">Target/hari</th><th class="gcol" title="Growth = estimasi akhir bulan (EOM) bulan berjalan vs realisasi '+pmLbl+'">Growth vs '+pmLbl+'</th><th class="gcol" title="YoY = estimasi akhir bulan (EOM) bulan berjalan vs realisasi '+yyLblFull+'">YoY vs '+yyLbl+'</th><th>Status</th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></section>'+exitBtn;
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
  if(ROUTE==="account") return '<div class="pagehead"><h2>Account</h2><span class="muted-sm">Info akun &amp; ubah kata sandi</span></div>';
  if(ROUTE==="keamanan") return '<div class="pagehead"><h2>Keamanan</h2><span class="muted-sm">Riwayat akun yang membuka web</span></div>';
  if(ROUTE==="best") return '<div class="pagehead"><h2>Best Achievement</h2><span class="muted-sm">Peringkat PA &amp; Promotor berdasarkan pencapaian target GWP</span></div>';
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
  if(ts){
    ts.value=st.q;
    function goSearch(){ if(searchTimer){ clearTimeout(searchTimer); searchTimer=null; } searchPrep(); render(aggregate()); }
    ts.addEventListener("input",function(e){
      st.q=e.target.value;
      if(searchTimer) clearTimeout(searchTimer);
      searchTimer=setTimeout(goSearch,250);   /* tunggu user selesai mengetik */
    });
    ts.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); goSearch(); } });
  }
  if(so){ so.value=st.sort; so.addEventListener("change",function(e){ st.sort=e.target.value; renderTarget(); }); }
  var rp=$("tgtRpt");
  if(rp) rp.addEventListener("click",function(){ if(RPT&&!SHOT){ RPT=false; } else { RPT=true; SHOT=false; } renderTarget(); });
  var sp=$("tgtShot");
  if(sp) sp.addEventListener("click",function(){ if(SHOT){ SHOT=false; RPT=false; } else { SHOT=true; RPT=true; } renderTarget(); });
  var sx=$("shotExit");
  if(sx) sx.addEventListener("click",function(){ SHOT=false; RPT=false; renderTarget(); });
  var bt=$("bestTabs");
  if(bt) bt.querySelectorAll("button").forEach(function(b){
    b.addEventListener("click",function(){ BESTS.kind=b.dataset.k; renderBest(); });
  });
  var bso=$("bestSort");
  if(bso) bso.addEventListener("change",function(e){ BESTS.sort=e.target.value; renderBest(); });
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
  var _pg=PAGES[ROUTE]||{};
  $("eyebrow").textContent=_pg.eyebrow||("SALES MONITORING · "+((_pg.title||"Summary").toUpperCase()));
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
  if(spaRoute&&!fAll(F.spa)){ F.spa=[]; msSyncField("spa"); }
  if(paRoute&&!fAll(F.pa)){ F.pa=[]; msSyncField("pa"); }
  if(promRoute&&!fAll(F.prom)){ F.prom=[]; msSyncField("prom"); }
  $("pageHead").innerHTML=pageHeadHTML();
  $("pageBody").innerHTML=pageHTML();
  bindPage();
  /* pindah halaman = kembali ke tampilan normal (mode laporan/screenshot tidak ikut pindah) */
  SHOT=false; RPT=false; document.body.classList.remove("shot-mode");
  var isSet=(ROUTE==="account"||ROUTE==="keamanan");
  document.body.classList.toggle("settings-mode",isSet);
  document.body.classList.toggle("campaign-mode",ROUTE==="campaign");
  if(isSet){
    var ps=$("periodSub"); if(ps) ps.textContent="Pengaturan akun & keamanan";
    renderSetting();
  }else{
    render(aggregate());
  }
  document.body.classList.remove("nav-open");
  window.scrollTo(0,0);
}

/* ================= LOGIN + PEMBATASAN SCOPE =================
   Password disimpan sebagai hash FNV-1a 32-bit (hex) di data/summary.js.
   Ini gerbang akses, bukan keamanan sungguhan: seluruh data tetap ada di file JSON. */
var USER=null, LOCK=null, BLOCKED=false, ALLOWED_ROUTES=["summary","spa","pa","promotor","best","campaign"];
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
/* ---- pemetaan organisasi: PA -> SPA, Promotor -> PA ----
   Sumber utama Target.xlsx (kolom spa/pa/pr per store), cadangan dari data transaksi. */
function parentName(kind, idx){
  var list=DATA[kind==="pa"?"pa":"prom"]||[];
  var n=norm(clean(list[idx]||""));
  if(!n) return null;
  var cnt={}, best=null, bc=0, i;
  function bump(v){ if(!v) return; var k=norm(v); cnt[k]=(cnt[k]||0)+1; if(cnt[k]>bc){ bc=cnt[k]; best=v; } }
  var t=DATA.target||[];
  for(i=0;i<t.length;i++){
    if(kind==="pa"){ if(norm(t[i].pa||"")===n) bump(t[i].spa); }
    else { if(norm(t[i].pr||"")===n) bump(t[i].pa); }
  }
  if(best) return best;
  var fa=DATA.facts||[];
  for(i=0;i<fa.length;i++){
    var f=fa[i];
    if(kind==="pa"){ if(f[8]===idx) bump(DATA.spa[f[7]]); }
    else { if(f[9]===idx) bump(DATA.pa[f[8]]); }
  }
  return best;
}
/* ---- nama dari Target.xlsx tetap dikenali walau promotor/PA belum punya transaksi ----
   Ditambahkan di belakang supaya indeks dimensi yang dipakai facts tidak bergeser. */
function mergeTargetDims(){
  var t=(DATA&&DATA.target)||[]; if(!t.length) return;
  [["prom","pr"],["pa","pa"],["spa","spa"],["am","am"]].forEach(function(m){
    var key=m[0], col=m[1], arr=DATA[key]||[], seen={};
    arr.forEach(function(v){ var k=norm(clean(v||"")); if(k) seen[k]=1; });
    t.forEach(function(row){
      var v=clean((row&&row[col])||""); if(!v) return;
      var k=norm(v); if(seen[k]) return;
      seen[k]=1; arr.push(v);
    });
    DATA[key]=arr;
  });
}
function roleKind(r){
  r=norm(r||"");
  if(!r) return "admin";   /* akun tanpa role = perilaku lama (akses semua) */
  if(r==="admin"||r.indexOf("admin")===0) return "admin";
  if(r.indexOf("partnership")>=0||r==="pa") return "pa";
  if(r==="spa"||r.indexOf("spa")===0||r.indexOf("spa ")>0) return "spa";
  if(r.indexOf("promot")>=0) return "prom";
  return "?";
}
function applyUser(u){
  USER=u||null; LOCK=null; BLOCKED=false; ALLOWED_ROUTES=["summary","spa","pa","promotor","best","campaign"];
  var warn="";
  if(USER){
    var kind=roleKind(USER.r), want=null, hint="";
    if(kind==="pa"){
      /* Partnership Associate: seluruh data SPA-nya (mis. Hari -> All SPA Denisahri) */
      var paIdx=findScopeIdx(DATA.pa||[],USER.n);
      if(paIdx>=0){
        var spaName=parentName("pa",paIdx);
        var spaIdx=spaName?findScopeIdx(DATA.spa||[],spaName):-1;
        if(spaIdx>=0) want={level:1,route:"spa",list:"spa",key:"spa",field:7,idx:spaIdx};
        else hint="SPA induk untuk PA <b>"+esc(USER.n)+"</b> tidak ditemukan";
      } else hint="nama <b>"+esc(USER.n||USER.u)+"</b> tidak ada di daftar PA";
    }else if(kind==="spa"){
      var si=findScopeIdx(DATA.spa||[],USER.n);
      if(si>=0) want={level:1,route:"spa",list:"spa",key:"spa",field:7,idx:si};
      else hint="nama <b>"+esc(USER.n||USER.u)+"</b> tidak ada di daftar SPA";
    }else if(kind==="prom"){
      /* Promotor: seluruh data PA-nya (semua promotor & store di PA tsb) */
      var prIdx=findScopeIdx(DATA.prom||[],USER.n);
      if(prIdx>=0){
        var paName=parentName("prom",prIdx);
        var paIdx2=paName?findScopeIdx(DATA.pa||[],paName):-1;
        if(paIdx2>=0) want={level:2,route:"pa",list:"pa",key:"pa",field:8,idx:paIdx2};
        else hint="PA induk untuk promotor <b>"+esc(USER.n)+"</b> tidak ditemukan";
      } else hint="nama <b>"+esc(USER.n||USER.u)+"</b> tidak ada di daftar Promotor";
    }else if(kind!=="admin"){
      hint="role <b>"+esc(USER.r||"(kosong)")+"</b> belum dikenali";
    }
    if(kind!=="admin"){
      if(want){
        LOCK={field:want.field,key:want.key,idx:want.idx,route:want.route,level:want.level,list:want.list,name:clean(DATA[want.list][want.idx])};
        ALLOWED_ROUTES=["summary",LOCK.route,"best","campaign"];
        F.am=[]; F.spa=[]; F.pa=[]; F.prom=[];
      }else{
        BLOCKED=true; ALLOWED_ROUTES=[];
        warn="Akses belum dibuka: "+hint+". Demi keamanan data tidak ditampilkan. Perbaiki nama/role di <b>Master_user.xlsx</b>, lalu jalankan refresh data.";
      }
    }else{
      ALLOWED_ROUTES=["summary","spa","pa","promotor","best","campaign","account","keamanan"];
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
  var sl=document.getElementById("sideSetLbl");
  if(sl) sl.style.display=(ALLOWED_ROUTES.indexOf("account")>=0)?"":"none";
  var su=$("sideUser");
  if(su){
    if(USER){
      su.hidden=false;
      $("suName").textContent=USER.n||USER.u;
      $("suRole").textContent=USER.r+(LOCK?(" · "+(LOCK.level===1?"SPA ":"PA ")+LOCK.name):(BLOCKED?" · tanpa akses":" · semua data"));
    } else su.hidden=true;
  }
}
function syncOrgFilters(){
  var lvl=LOCK?LOCK.level:-1;
  var hide={am:(LOCK&&lvl>=3),spa:(LOCK&&lvl>=1)||ROUTE==="spa",pa:(LOCK&&lvl>=2)||ROUTE==="pa",prom:(LOCK&&lvl>=3)||ROUTE==="promotor"};
  var map={am:"lblAm",spa:"lblSpa",pa:"lblPa",prom:"lblProm"};
  Object.keys(map).forEach(function(k){ var el=$(map[k]); if(el) el.style.display=hide[k]?"none":""; });
}
function enter(u,persist){
  applyUser(u);
  if(persist){ try{ sessionStorage.setItem("qoala.session",u.u); }catch(e){} }
  if(persist||!sessCurrentId()) sessStart(u); else sessTouch();
  var lg=$("login"); if(lg) lg.hidden=true;
  var le=$("loginErr"); if(le){ le.textContent=""; le.classList.remove("on"); }
  var lp=$("loginPass"); if(lp){ lp.value=""; lp.type="password"; }
  var pt=$("pwToggle"); if(pt){ pt.classList.remove("on"); pt.setAttribute("aria-pressed","false"); pt.title="Tampilkan kata sandi"; pt.setAttribute("aria-label",pt.title); }
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
  if(effHash(u)!==hashPw($("loginPass").value)){ showLogin("Password salah."); return; }
  enter(u,true);
}
function doLogout(){
  sessTouch();
  try{ sessionStorage.removeItem("qoala.session"); }catch(e){}
  try{ sessionStorage.removeItem("qoala.sessid"); }catch(e){}
  window.location.reload();
}
var _lf=$("loginForm"); if(_lf) _lf.addEventListener("submit",function(e){ e.preventDefault(); doLogin(); });
var _pt=$("pwToggle"); if(_pt) _pt.addEventListener("click",function(){
  var p=$("loginPass"); if(!p) return;
  var show=p.type==="password";
  p.type=show?"text":"password";
  _pt.classList.toggle("on",show);
  _pt.setAttribute("aria-pressed",show?"true":"false");
  _pt.title=show?"Sembunyikan kata sandi":"Tampilkan kata sandi";
  _pt.setAttribute("aria-label",_pt.title);
  p.focus();
});
var _lo=$("btnLogout"); if(_lo) _lo.addEventListener("click",doLogout);

function init(){
  if(!DATA){ document.body.innerHTML="<p style='padding:24px'>data/summary.js tidak ditemukan. Buka via folder dashboard/ atau jalankan tools/aggregate.ps1.</p>"; return; }
  mergeTargetDims();
  if(!(DATA.users&&DATA.users.length)){ enter(null,false); return; }
  var saved=null; try{ saved=sessionStorage.getItem("qoala.session"); }catch(e){}
  var u=saved?findUser(saved):null;
  if(u) enter(u,false); else showLogin("");
}
function startDashboard(){
  var years=[...new Set(DATA.months.map(function(m){return m.slice(0,4);}))].sort();
  msInit("msYear","year",years.map(function(y){return {v:y,t:y};}));
  msInit("msMonth","month",MON.map(function(m,i){return {v:String(i+1).padStart(2,"0"),t:m};}));
  msInit("msIns","ins",msDimItems(DATA.insurance));
  msInit("msPart","part",msDimItems(DATA.partner));
  msInit("msAm","am",msDimItems(DATA.am));
  msInit("msSpa","spa",msDimItems(DATA.spa));
  msInit("msPa","pa",msDimItems(DATA.pa));
  msInit("msProm","prom",msDimItems(DATA.prom));
  msInit("msProd","prod",msDimItems(DATA.product));
  msInit("msStore","store",msDimItems(DATA.store));
  msInit("msStatus","status",msDimItems(DATA.status));
  document.addEventListener("click",function(){ msCloseAll(); });
  document.addEventListener("keydown",function(e){
    if(e.key!=="Escape") return;
    msCloseAll();
    if(SHOT||RPT){ SHOT=false; RPT=false; document.body.classList.remove("shot-mode"); renderTarget(); }
  });
  document.addEventListener("mousemove",function(){ if(SHOT){ var b=$("shotExit"); if(b&&b.classList.contains("dim")) shotArm(); } });
  window.addEventListener("resize",function(){ if(SHOT) shotFit(); });
  $("btnReset").addEventListener("click",function(){
    F={year:[],month:[],ins:[],part:[],am:[],spa:[],pa:[],prom:[],prod:[],store:[],status:[]};
    msClearAll();
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
  document.querySelectorAll("#side a").forEach(function(a){
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
  setInterval(sessTouch,20000);
  document.addEventListener("visibilitychange",function(){ if(document.hidden) sessTouch(); });
  window.addEventListener("beforeunload",sessTouch);
  renderRoute();
}
if(DATA&&DATA.months){ init(); }
else{
  fetch("data/summary.json").then(function(r){return r.json();}).then(function(j){ DATA=j; init(); }).catch(function(){
    document.body.innerHTML="<p style='padding:24px'>Gagal memuat data. Pastikan <b>dashboard/data/summary.js</b> ada atau buka via HTTP server.</p>";
  });
}
})();
