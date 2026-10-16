using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class TargetJoin
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    class TRow{ public string store,partner,stype,am,spa,pa,prom; public double tnop,tgwp; }
    static Dictionary<string,Dictionary<string,string>> ReadSheet(string xlsx,string sheet){
        var rows=new Dictionary<string,Dictionary<string,string>>();
        using(var zip=ZipFile.OpenRead(xlsx)){
            var e=zip.GetEntry(sheet);
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        var row=new Dictionary<string,string>();
                        if(!reader.IsEmptyElement){
                            while(reader.Read()){
                                if(reader.NodeType==XmlNodeType.Element && reader.Name=="c"){
                                    string cr=reader.GetAttribute("r");
                                    string col=ColOf(cr); string v=null;
                                    if(!reader.IsEmptyElement){
                                        while(reader.Read()){
                                            if(reader.NodeType==XmlNodeType.Element && reader.Name=="v"){ v=reader.ReadElementContentAsString(); break; }
                                            else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="c") break;
                                        }
                                    } else v="";
                                    row[col]=v??"";
                                } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                            }
                        }
                        rows[rr]=row;
                    }
                }
            }
        }
        return rows;
    }
    static Dictionary<int,string> ReadStrings(string xlsx, HashSet<int> need){
        var map=new Dictionary<int,string>();
        using(var zip=ZipFile.OpenRead(xlsx)){
            var e=zip.GetEntry("xl/sharedStrings.xml");
            if(e==null) return map;
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                int idx=-1; reader.MoveToContent();
                while(!reader.EOF){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="si"){
                        idx++;
                        if(need.Contains(idx)){
                            string outer=reader.ReadOuterXml();
                            var sb2=new StringBuilder(); int p=0;
                            while(true){ int s1=outer.IndexOf("<t",p); if(s1<0)break; int s2=outer.IndexOf(">",s1); if(s2<0)break; int e1=outer.IndexOf("</t>",s2); if(e1<0)break; sb2.Append(outer.Substring(s2+1,e1-s2-1)); sb2.Append(" "); p=e1+4; }
                            map[idx]=sb2.ToString().Trim().Replace("&amp;","&").Replace("&lt;","<").Replace("&gt;",">").Replace("&quot;","\"").Replace("&apos;","'");
                        } else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        return map;
    }
    static string Norm(string s){ return (s??"").Trim().ToLowerInvariant(); }
    public static string Run(string rawPath, string tgtPath)
    {
        // --- target ---
        var trows=ReadSheet(tgtPath,"xl/worksheets/sheet1.xml");
        var tneeds=new HashSet<int>();
        foreach(var kv in trows){ foreach(var c in new[]{"A","B","C","D","E","F","G"}){ if(kv.Value.ContainsKey(c)){ int si; if(int.TryParse(kv.Value[c],out si)) tneeds.Add(si); } } }
        var tstr=ReadStrings(tgtPath,tneeds);
        Func<string,string> Ts=(si)=>{ int x; if(int.TryParse(si,out x)&&tstr.ContainsKey(x)) return tstr[x]; return si; };
        var targets=new List<TRow>();
        foreach(var kv in trows){
            if(kv.Key=="1") continue;
            var r=kv.Value;
            if(!r.ContainsKey("A")) continue;
            var t=new TRow();
            t.store=Ts(r.ContainsKey("A")?r["A"]:""); t.partner=Ts(r.ContainsKey("B")?r["B"]:"");
            t.stype=Ts(r.ContainsKey("C")?r["C"]:""); t.am=Ts(r.ContainsKey("D")?r["D"]:"");
            t.spa=Ts(r.ContainsKey("E")?r["E"]:""); t.pa=Ts(r.ContainsKey("F")?r["F"]:"");
            t.prom=Ts(r.ContainsKey("G")?r["G"]:"");
            double d; if(r.ContainsKey("H")&&double.TryParse(r["H"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) t.tnop=d;
            if(r.ContainsKey("I")&&double.TryParse(r["I"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) t.tgwp=d;
            if(t.store=="") continue;
            targets.Add(t);
        }
        // --- actual oct per store ---
        var araws=ReadSheet(rawPath,"xl/worksheets/sheet1.xml");
        var aneeds=new HashSet<int>();
        foreach(var kv in araws){ var r=kv.Value; if(kv.Key=="1") continue; if(!r.ContainsKey("AO")||r["AO"]!="46296") continue; if(r.ContainsKey("AM")){ int si; if(int.TryParse(r["AM"],out si)) aneeds.Add(si); } }
        var astr=ReadStrings(rawPath,aneeds);
        Func<string,string> As=(si)=>{ int x; if(int.TryParse(si,out x)&&astr.ContainsKey(x)) return astr[x]; return si; };
        var actual=new Dictionary<string,double[]>(); // norm -> [nop,gwp] + keep display name
        var disp=new Dictionary<string,string>();
        double actN=0, actG=0;
        foreach(var kv in araws){
            if(kv.Key=="1") continue; var r=kv.Value;
            if(!r.ContainsKey("AO")||r["AO"]!="46296") continue;
            string store=As(r.ContainsKey("AM")?r["AM"]:"");
            string k=Norm(store);
            double nop=1,gwp=0; double d;
            if(r.ContainsKey("AQ")&&double.TryParse(r["AQ"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) nop=d;
            if(r.ContainsKey("V")&&double.TryParse(r["V"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) gwp=d;
            if(!actual.ContainsKey(k)){ actual[k]=new double[2]; disp[k]=store; }
            actual[k][0]+=nop; actual[k][1]+=gwp;
            actN+=nop; actG+=gwp;
        }
        double tgtN=0,tgtG=0; foreach(var t in targets){ tgtN+=t.tnop; tgtG+=t.tgwp; }
        var sb=new StringBuilder();
        sb.AppendLine("target_rows="+targets.Count+" actual_oct_stores="+actual.Count);
        sb.AppendLine("target_nop="+tgtN+" target_gwp="+tgtG);
        sb.AppendLine("actual_nop="+actN+" actual_gwp="+actG);
        sb.AppendLine("ach_nop="+(tgtN>0?(actN/tgtN*100).ToString("0.0"):"-")+"% ach_gwp="+(tgtG>0?(actG/tgtG*100).ToString("0.0"):"-")+"%");
        double f=31.0/15.0;
        sb.AppendLine("est_nop="+Math.Round(actN*f)+" est_gwp="+Math.Round(actG*f));
        sb.AppendLine("est_ach_nop="+(tgtN>0?(actN*f/tgtN*100).ToString("0.0"):"-")+"% est_ach_gwp="+(tgtG>0?(actG*f/tgtG*100).ToString("0.0"):"-")+"%");
        // unmatched
        int match=0; foreach(var t in targets){ if(actual.ContainsKey(Norm(t.store))) match++; }
        sb.AppendLine("target_matched="+match+" unmatched="+(targets.Count-match));
        // top 10 by target gwp
        targets.Sort((a,b)=>b.tgwp.CompareTo(a.tgwp));
        sb.AppendLine("--- TOP10 by target GWP ---");
        for(int i=0;i<Math.Min(10,targets.Count);i++){
            var t=targets[i]; string k=Norm(t.store);
            double an=actual.ContainsKey(k)?actual[k][0]:0, ag=actual.ContainsKey(k)?actual[k][1]:0;
            sb.AppendLine(t.store+" | tgtN="+t.tnop+" actN="+an+" achN="+(t.tnop>0?(an/t.tnop*100).ToString("0.0"):"-")+"% estN="+Math.Round(an*f)+" | tgtG="+t.tgwp+" actG="+ag+" achG="+(t.tgwp>0?(ag/t.tgwp*100).ToString("0.0"):"-")+"% estG="+Math.Round(ag*f)+" | PA="+t.pa);
        }
        // bottom 5 matched (lowest ach gwp with target>0)
        sb.AppendLine("--- BOTTOM5 matched by ach GWP ---");
        var matched=new List<TRow>(); foreach(var t in targets){ if(actual.ContainsKey(Norm(t.store))&&t.tgwp>0) matched.Add(t); }
        matched.Sort((a,b)=>(actual[Norm(a.store)][1]/a.tgwp).CompareTo(actual[Norm(b.store)][1]/b.tgwp));
        for(int i=0;i<Math.Min(5,matched.Count);i++){
            var t=matched[i]; string k=Norm(t.store);
            double an=actual[k][0], ag=actual[k][1];
            sb.AppendLine(t.store+" | tgtN="+t.tnop+" actN="+an+" achN="+(an/t.tnop*100).ToString("0.0")+"% | tgtG="+t.tgwp+" actG="+ag+" achG="+(ag/t.tgwp*100).ToString("0.0")+"% | PA="+t.pa);
        }
        // target stores with zero actual
        sb.AppendLine("--- TARGET tanpa aktual (5 pertama) ---");
        int cz=0; foreach(var t in targets){ if(!actual.ContainsKey(Norm(t.store))){ sb.AppendLine(t.store+" | tgtN="+t.tnop+" tgtG="+t.tgwp+" | PA="+t.pa); if(++cz>=5) break; } }
        return sb.ToString();
    }
}
