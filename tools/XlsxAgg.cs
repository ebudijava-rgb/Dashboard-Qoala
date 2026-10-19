using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class XlsxAgg
{
    class Raw { public int a,c,i,j,am,ar,as_,at,au,p; public double gwp,nop; public int ao,ap; public int br,cat,dur; } // gwp = kolom X "after marketing support"
    // --- normalisasi nama brand (data mentah campur huruf besar/kecil: APPLE / Apple) ---
    static Dictionary<string,string> _brandMap;
    static Dictionary<string,string> BrandMap(){
        if(_brandMap==null){
            _brandMap=new Dictionary<string,string>();
            _brandMap["APPLE"]="Apple"; _brandMap["SAMSUNG"]="Samsung"; _brandMap["XIAOMI"]="Xiaomi";
            _brandMap["OPPO"]="OPPO"; _brandMap["VIVO"]="VIVO"; _brandMap["HUAWEI"]="Huawei";
            _brandMap["INFINIX"]="Infinix"; _brandMap["REALME"]="REALME"; _brandMap["SONY"]="Sony";
            _brandMap["MOTOROLA"]="Motorola"; _brandMap["AMAZFIT"]="Amazfit"; _brandMap["ANKER"]="Anker";
            _brandMap["JBL"]="JBL"; _brandMap["HARMAN KARDON"]="Harman Kardon"; _brandMap["OTHER"]="Other";
        }
        return _brandMap;
    }
    static string TitleCase(string s){
        if(string.IsNullOrEmpty(s)) return "";
        var parts=s.Trim().Split(' ');
        for(int i=0;i<parts.Length;i++){
            string w=parts[i]; if(w.Length==0) continue;
            parts[i]=char.ToUpper(w[0])+w.Substring(1).ToLower();
        }
        return string.Join(" ",parts);
    }
    static string NormBrand(string s){
        string v=(s==null?"":s).Trim(); if(v=="") return "Tanpa brand";
        string m; if(BrandMap().TryGetValue(v.ToUpper(),out m)) return m;
        return TitleCase(v);
    }
    static string NormCat(string s){
        string v=(s==null?"":s).Trim(); if(v=="") return "Tanpa kategori";
        return TitleCase(v);
    }
    // literal cache untuk kolom formula (AR/AS/AT/AU bertipe t="str" atau angka): kode negatif -(idx+2), -1 = kosong
    static int LitCode(Dictionary<string,int> lit, string v){ if(v==null) v=""; v=v.Trim(); if(v=="0") v=""; int i; if(lit.TryGetValue(v,out i)) return -(i+2); i=lit.Count; lit[v]=i; return -(i+2); }
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    static string ExcelSerialToYm(int serial){
        DateTime baseD = new DateTime(1899,12,30);
        DateTime d = baseD.AddDays(serial);
        return string.Format("{0:0000}-{1:00}", d.Year, d.Month);
    }
    static string Escape(string s){ return s.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r"," ").Replace("\n"," "); }

    public static string Run(string xlsxPath, string outJson)
    {
        var raws = new List<Raw>(150000);
        var need = new HashSet<string>(new[]{"A","C","I","J","AM","AR","AS","AT","AU","P","AI","AH","AK"});
        var siSets = new Dictionary<string, HashSet<int>>();
        foreach(var c in need) siSets[c]=new HashSet<int>();
        var litAr=new Dictionary<string,int>(); var litAs=new Dictionary<string,int>(); var litAt=new Dictionary<string,int>(); var litAu=new Dictionary<string,int>(); var litP=new Dictionary<string,int>();
        var litAi=new Dictionary<string,int>(); var litAh=new Dictionary<string,int>(); var litAk=new Dictionary<string,int>();

        using (var zip = ZipFile.OpenRead(xlsxPath))
        {
            var entry = zip.GetEntry("xl/worksheets/sheet1.xml");
            using (var stream = entry.Open())
            using (var reader = XmlReader.Create(stream, new XmlReaderSettings(){IgnoreWhitespace=true}))
            {
                var row = new Dictionary<string,string>();
                var rowT = new Dictionary<string,string>();
                while (reader.Read())
                {
                    if (reader.NodeType==XmlNodeType.Element && reader.Name=="row")
                    {
                        string rowR = reader.GetAttribute("r");
                        if (rowR=="1"){ if(!reader.IsEmptyElement){reader.Skip();} continue; }
                        if (reader.IsEmptyElement) continue;
                        row.Clear(); rowT.Clear();
                        while (reader.Read())
                        {
                            if (reader.NodeType==XmlNodeType.Element && reader.Name=="c")
                            {
                                string cr = reader.GetAttribute("r"); string ct = reader.GetAttribute("t");
                                string col = ColOf(cr); string v=null;
                                if (!reader.IsEmptyElement)
                                {
                                    while(reader.Read()){
                                        if(reader.NodeType==XmlNodeType.Element && reader.Name=="v"){ v=reader.ReadElementContentAsString(); break; }
                                        else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="c") break;
                                    }
                                } else v="";
                                row[col]=v??""; rowT[col]=ct??"";
                            }
                            else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        var r = new Raw(){a=-1,c=-1,i=-1,j=-1,am=-1,ar=-1,as_=-1,at=-1,au=-1,p=-1,gwp=0,nop=0,ao=0,ap=0,br=-1,cat=-1,dur=-1};
                        int tmp;
                        if(row.ContainsKey("A")&&rowT["A"]=="s"&&int.TryParse(row["A"],out tmp)){r.a=tmp; siSets["A"].Add(tmp);}
                        if(row.ContainsKey("C")&&rowT["C"]=="s"&&int.TryParse(row["C"],out tmp)){r.c=tmp; siSets["C"].Add(tmp);}
                        if(row.ContainsKey("I")&&rowT["I"]=="s"&&int.TryParse(row["I"],out tmp)){r.i=tmp; siSets["I"].Add(tmp);}
                        if(row.ContainsKey("J")&&rowT["J"]=="s"&&int.TryParse(row["J"],out tmp)){r.j=tmp; siSets["J"].Add(tmp);}
                        if(row.ContainsKey("AM")&&rowT["AM"]=="s"&&int.TryParse(row["AM"],out tmp)){r.am=tmp; siSets["AM"].Add(tmp);}
                        // AR/AS/AT/AU: shared string ATAU cache literal formula (t="str"/angka)
                        if(row.ContainsKey("AR")){ if(rowT["AR"]=="s"&&int.TryParse(row["AR"],out tmp)){r.ar=tmp; siSets["AR"].Add(tmp);} else r.ar=LitCode(litAr,row["AR"]); }
                        if(row.ContainsKey("AS")){ if(rowT["AS"]=="s"&&int.TryParse(row["AS"],out tmp)){r.as_=tmp; siSets["AS"].Add(tmp);} else r.as_=LitCode(litAs,row["AS"]); }
                        if(row.ContainsKey("AT")){ if(rowT["AT"]=="s"&&int.TryParse(row["AT"],out tmp)){r.at=tmp; siSets["AT"].Add(tmp);} else r.at=LitCode(litAt,row["AT"]); }
                        if(row.ContainsKey("AU")){ if(rowT["AU"]=="s"&&int.TryParse(row["AU"],out tmp)){r.au=tmp; siSets["AU"].Add(tmp);} else r.au=LitCode(litAu,row["AU"]); }
                        // P = policy start date (teks ISO / shared string)
                        if(row.ContainsKey("P")){ if(rowT["P"]=="s"&&int.TryParse(row["P"],out tmp)){r.p=tmp; siSets["P"].Add(tmp);} else r.p=LitCode(litP,row["P"]); }
                        // AI = device brand, AH = device category, AK = duration unit (bulan)
                        if(row.ContainsKey("AI")){ if(rowT["AI"]=="s"&&int.TryParse(row["AI"],out tmp)){r.br=tmp; siSets["AI"].Add(tmp);} else r.br=LitCode(litAi,row["AI"]); }
                        if(row.ContainsKey("AH")){ if(rowT["AH"]=="s"&&int.TryParse(row["AH"],out tmp)){r.cat=tmp; siSets["AH"].Add(tmp);} else r.cat=LitCode(litAh,row["AH"]); }
                        if(row.ContainsKey("AK")){ if(rowT["AK"]=="s"&&int.TryParse(row["AK"],out tmp)){r.dur=tmp; siSets["AK"].Add(tmp);} else r.dur=LitCode(litAk,row["AK"]); }
                        bool hasX=row.ContainsKey("X")&&row["X"]!="", hasV=row.ContainsKey("V")&&row["V"]!="", hasQ=row.ContainsKey("AQ")&&row["AQ"]!="", hasM=row.ContainsKey("AO")&&row["AO"]!="";
                        if(!hasX&&!hasV&&!hasQ&&!hasM) continue; // lewati baris kosong berformat
                        double d;
                        // GWP = kolom X "after marketing support" (bukan V "gwp").
                        // Label di dashboard tetap "GWP" - hanya sumber angkanya yang beda.
                        if(row.ContainsKey("X")&&double.TryParse(row["X"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) r.gwp=d;
                        if(row.ContainsKey("AQ")&&double.TryParse(row["AQ"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) r.nop=d; else r.nop=1;
                        if(row.ContainsKey("AO")&&int.TryParse(row["AO"],out tmp)) r.ao=tmp;
                        if(row.ContainsKey("AP")&&int.TryParse(row["AP"],out tmp)) r.ap=tmp;
                        raws.Add(r);
                    }
                }
            }
        }

        // resolve shared strings for needed si
        var allNeeded = new HashSet<int>();
        foreach(var kv in siSets) foreach(var s in kv.Value) allNeeded.Add(s);
        var siToStr = new Dictionary<int,string>(allNeeded.Count);
        using (var zip = ZipFile.OpenRead(xlsxPath))
        {
            var e = zip.GetEntry("xl/sharedStrings.xml");
            using (var stream = e.Open())
            using (var reader = XmlReader.Create(stream, new XmlReaderSettings(){IgnoreWhitespace=true}))
            {
                int idx=-1;
                reader.MoveToContent();
                while(!reader.EOF)
                {
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="si")
                    {
                        idx++;
                        if(allNeeded.Contains(idx))
                        {
                            string outer = reader.ReadOuterXml();
                            // extract all <t> and concat
                            var sb2=new StringBuilder();
                            int p=0;
                            while(true){ int s1=outer.IndexOf("<t",p); if(s1<0)break; int s2=outer.IndexOf(">",s1); if(s2<0)break; int e1=outer.IndexOf("</t>",s2); if(e1<0)break; sb2.Append(outer.Substring(s2+1,e1-s2-1)); p=e1+4; }
                            string val=sb2.ToString();
                            // basic unescape
                            val=val.Replace("&amp;","&").Replace("&lt;","<").Replace("&gt;",">").Replace("&quot;","\"").Replace("&apos;","'");
                            siToStr[idx]=val;
                        }
                        else
                        {
                            reader.Skip();
                        }
                    }
                    else reader.Read();
                }
            }
        }

        Func<int,string> L = (si)=> siToStr.ContainsKey(si)? siToStr[si] : ("#"+si);
        var lstAr=new string[litAr.Count]; foreach(var kv in litAr) lstAr[kv.Value]=kv.Key;
        var lstAs=new string[litAs.Count]; foreach(var kv in litAs) lstAs[kv.Value]=kv.Key;
        var lstAt=new string[litAt.Count]; foreach(var kv in litAt) lstAt[kv.Value]=kv.Key;
        var lstAu=new string[litAu.Count]; foreach(var kv in litAu) lstAu[kv.Value]=kv.Key;
        var lstP=new string[litP.Count]; foreach(var kv in litP) lstP[kv.Value]=kv.Key;
        var lstAi=new string[litAi.Count]; foreach(var kv in litAi) lstAi[kv.Value]=kv.Key;
        var lstAh=new string[litAh.Count]; foreach(var kv in litAh) lstAh[kv.Value]=kv.Key;
        var lstAk=new string[litAk.Count]; foreach(var kv in litAk) lstAk[kv.Value]=kv.Key;
        Func<string[],int,string> LC=(lst,code)=> code==-1? "#-1" : (code>=0? L(code) : lst[-code-2]);
        // brand / kategori / durasi: -1 = kolom kosong
        Func<int,string> LB=(code)=> code==-1? "" : (code>=0? L(code) : lstAi[-code-2]);
        Func<int,string> LH=(code)=> code==-1? "" : (code>=0? L(code) : lstAh[-code-2]);
        Func<int,string> LK=(code)=> code==-1? "" : (code>=0? L(code) : lstAk[-code-2]);
        // hari (day of month) dari policy start date, mis. "2026-10-16 12:00:00+07:00"
        var dayCache=new Dictionary<int,int>();
        Func<int,int> DayOf=(code)=>{
            if(code==-1) return 0;
            int cached; if(dayCache.TryGetValue(code,out cached)) return cached;
            string s = code>=0? L(code) : lstP[-code-2];
            int day=0;
            if(!string.IsNullOrEmpty(s) && s.Length>=10 && s[4]=='-' && s[7]=='-'){
                int dd; if(int.TryParse(s.Substring(8,2), out dd)) day=dd;
            } else if(!string.IsNullOrEmpty(s)){
                DateTime dt; if(DateTime.TryParse(s, out dt)) day=dt.Day;
            }
            dayCache[code]=day; return day;
        };
        // build sorted dicts
        var dictIns = new SortedSet<string>(); var dictPart=new SortedSet<string>(); var dictProd=new SortedSet<string>();
        var dictStore=new SortedSet<string>(); var dictStatus=new SortedSet<string>();
        var dictAm=new SortedSet<string>(); var dictSpa=new SortedSet<string>(); var dictPa=new SortedSet<string>(); var dictProm=new SortedSet<string>();
        var dictBrand=new SortedSet<string>(); var dictCat=new SortedSet<string>(); var dictDur=new SortedSet<string>();
        var monthSet=new SortedSet<string>();
        foreach(var r in raws){
            dictIns.Add(L(r.a)); dictPart.Add(L(r.c)); dictProd.Add(L(r.i)); dictStatus.Add(L(r.j)); dictStore.Add(L(r.am));
            dictAm.Add(LC(lstAr,r.ar)); dictSpa.Add(LC(lstAs,r.as_)); dictPa.Add(LC(lstAt,r.at)); dictProm.Add(LC(lstAu,r.au));
            dictBrand.Add(NormBrand(LB(r.br))); dictCat.Add(NormCat(LH(r.cat))); dictDur.Add(LK(r.dur));
            if(r.ao>0) monthSet.Add(ExcelSerialToYm(r.ao));
            else if(r.ap>0) monthSet.Add(string.Format("{0:0000}-01", r.ap));
        }
        var lIns=new List<string>(dictIns); var lPart=new List<string>(dictPart); var lProd=new List<string>(dictProd);
        var lStore=new List<string>(dictStore); var lStatus=new List<string>(dictStatus);
        var lAm=new List<string>(dictAm); var lSpa=new List<string>(dictSpa); var lPa=new List<string>(dictPa); var lProm=new List<string>(dictProm);
        var lBrand=new List<string>(dictBrand); var lCat=new List<string>(dictCat); var lDur=new List<string>(dictDur);
        var lMonth=new List<string>(monthSet);
        var mIns=new Dictionary<string,int>(); for(int k=0;k<lIns.Count;k++)mIns[lIns[k]]=k;
        var mPart=new Dictionary<string,int>(); for(int k=0;k<lPart.Count;k++)mPart[lPart[k]]=k;
        var mProd=new Dictionary<string,int>(); for(int k=0;k<lProd.Count;k++)mProd[lProd[k]]=k;
        var mStore=new Dictionary<string,int>(); for(int k=0;k<lStore.Count;k++)mStore[lStore[k]]=k;
        var mStatus=new Dictionary<string,int>(); for(int k=0;k<lStatus.Count;k++)mStatus[lStatus[k]]=k;
        var mAm=new Dictionary<string,int>(); for(int k=0;k<lAm.Count;k++)mAm[lAm[k]]=k;
        var mSpa=new Dictionary<string,int>(); for(int k=0;k<lSpa.Count;k++)mSpa[lSpa[k]]=k;
        var mPa=new Dictionary<string,int>(); for(int k=0;k<lPa.Count;k++)mPa[lPa[k]]=k;
        var mProm=new Dictionary<string,int>(); for(int k=0;k<lProm.Count;k++)mProm[lProm[k]]=k;
        var mBrand=new Dictionary<string,int>(); for(int k=0;k<lBrand.Count;k++)mBrand[lBrand[k]]=k;
        var mCat=new Dictionary<string,int>(); for(int k=0;k<lCat.Count;k++)mCat[lCat[k]]=k;
        var mDur=new Dictionary<string,int>(); for(int k=0;k<lDur.Count;k++)mDur[lDur[k]]=k;
        var mMonth=new Dictionary<string,int>(); for(int k=0;k<lMonth.Count;k++)mMonth[lMonth[k]]=k;

        // hari (day) terakhir yang ada datanya per bulan -> dasar "tanggal berjalan"
        var monthLastDay=new int[lMonth.Count];
        foreach(var r in raws){
            string ym = r.ao>0? ExcelSerialToYm(r.ao) : string.Format("{0:0000}-01", r.ap);
            int mi=mMonth[ym]; int dy=DayOf(r.p); if(dy>monthLastDay[mi]) monthLastDay[mi]=dy;
        }

        Directory.CreateDirectory(Path.GetDirectoryName(outJson));
        using(var w=new StreamWriter(outJson,false,new UTF8Encoding(false))){
            w.Write("{\"meta\":{\"rows\":"); w.Write(raws.Count);
            w.Write(",\"generated\":\""); w.Write(DateTime.Now.ToString("yyyy-MM-dd HH:mm")); w.Write("\"}");
            w.Write(",\"months\":["); for(int k=0;k<lMonth.Count;k++){if(k>0)w.Write(","); w.Write("\""); w.Write(lMonth[k]); w.Write("\"");} w.Write("]");
            w.Write(",\"monthLastDay\":["); for(int k=0;k<monthLastDay.Length;k++){if(k>0)w.Write(","); w.Write(monthLastDay[k]);} w.Write("]");
            Action<string,List<string>> WL=(n,l)=>{ w.Write(",\""); w.Write(n); w.Write("\":["); for(int k=0;k<l.Count;k++){if(k>0)w.Write(","); w.Write("\""); w.Write(Escape(l[k])); w.Write("\"");} w.Write("]"); };
            WL("insurance",lIns); WL("partner",lPart); WL("product",lProd); WL("store",lStore); WL("status",lStatus);
            WL("am",lAm); WL("spa",lSpa); WL("pa",lPa); WL("prom",lProm);
            WL("brand",lBrand); WL("cat",lCat); WL("dur",lDur);
            w.Write(",\"facts\":[");
            bool first=true;
            foreach(var r in raws){
                string ym = r.ao>0? ExcelSerialToYm(r.ao) : string.Format("{0:0000}-01", r.ap);
                int mi=mMonth[ym];
                int ii=mIns[L(r.a)], pi=mPart[L(r.c)], pr=mProd[L(r.i)], st=mStore[L(r.am)], ss=mStatus[L(r.j)];
                int am=mAm[LC(lstAr,r.ar)], sp=mSpa[LC(lstAs,r.as_)], pa=mPa[LC(lstAt,r.at)], pm=mProm[LC(lstAu,r.au)];
                int br=mBrand[NormBrand(LB(r.br))], ct=mCat[NormCat(LH(r.cat))], du=mDur[LK(r.dur)];
                if(!first) w.Write(",");
                first=false;
                w.Write("["); w.Write(mi); w.Write(","); w.Write(ii); w.Write(","); w.Write(pi); w.Write(","); w.Write(pr);
                w.Write(","); w.Write(st); w.Write(","); w.Write(ss);
                w.Write(","); w.Write(am); w.Write(","); w.Write(sp); w.Write(","); w.Write(pa); w.Write(","); w.Write(pm);
                w.Write(","); w.Write(r.gwp.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(","); w.Write(r.nop.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(","); w.Write(DayOf(r.p)); w.Write(","); w.Write(br); w.Write(","); w.Write(ct); w.Write(","); w.Write(du); w.Write("]");
            }
            w.Write("]}");
        }
        return "facts="+raws.Count+" months="+lMonth.Count+" ins="+lIns.Count+" part="+lPart.Count+" prod="+lProd.Count+" store="+lStore.Count+" status="+lStatus.Count+" am="+lAm.Count+" spa="+lSpa.Count+" pa="+lPa.Count+" prom="+lProm.Count+" brand="+lBrand.Count+" cat="+lCat.Count+" dur="+lDur.Count;
    }
}
