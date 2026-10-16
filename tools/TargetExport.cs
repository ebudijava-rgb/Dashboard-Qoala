using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class TargetExport
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    static string Esc(string s){ return (s??"").Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r"," ").Replace("\n"," "); }
    public static string Run(string tgtPath, string outJson)
    {
        var rows=new Dictionary<string,Dictionary<string,string>>();
        using(var zip=ZipFile.OpenRead(tgtPath)){
            var e=zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        var row=new Dictionary<string,string>();
                        if(!reader.IsEmptyElement){
                            while(reader.Read()){
                                if(reader.NodeType==XmlNodeType.Element && reader.Name=="c"){
                                    string cr=reader.GetAttribute("r"); string col=ColOf(cr); string v=null;
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
        var need=new HashSet<int>();
        foreach(var kv in rows){ if(kv.Key=="1") continue; foreach(var c in new[]{"A","B","C","D","E","F","G"}){ if(kv.Value.ContainsKey(c)){ int si; if(int.TryParse(kv.Value[c],out si)) need.Add(si); } } }
        var map=new Dictionary<int,string>();
        using(var zip=ZipFile.OpenRead(tgtPath)){
            var e=zip.GetEntry("xl/sharedStrings.xml");
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
        Func<string,string> S=(si)=>{ int x; if(int.TryParse(si,out x)&&map.ContainsKey(x)) return map[x]; return si; };
        Directory.CreateDirectory(Path.GetDirectoryName(outJson));
        int n=0;
        using(var w=new StreamWriter(outJson,false,new UTF8Encoding(false))){
            w.Write("[");
            bool first=true;
            foreach(var kv in rows){
                if(kv.Key=="1") continue; var r=kv.Value;
                if(!r.ContainsKey("A")) continue;
                string store=S(r.ContainsKey("A")?r["A"]:"").Trim();
                if(store=="") continue;
                string partner=S(r.ContainsKey("B")?r["B"]:"").Trim();
                string stype=S(r.ContainsKey("C")?r["C"]:"").Trim();
                string am=S(r.ContainsKey("D")?r["D"]:"").Trim();
                string spa=S(r.ContainsKey("E")?r["E"]:"").Trim();
                string pa=S(r.ContainsKey("F")?r["F"]:"").Trim();
                string prom=S(r.ContainsKey("G")?r["G"]:"").Trim();
                double tn=0,tg=0,d;
                if(r.ContainsKey("H")&&double.TryParse(r["H"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) tn=d;
                if(r.ContainsKey("I")&&double.TryParse(r["I"],System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out d)) tg=d;
                if(!first) w.Write(",");
                first=false; n++;
                w.Write("{\"s\":\""+Esc(store)+"\"");
                w.Write(",\"p\":\""+Esc(partner)+"\"");
                w.Write(",\"am\":\""+Esc(am)+"\"");
                w.Write(",\"spa\":\""+Esc(spa)+"\"");
                w.Write(",\"pa\":\""+Esc(pa)+"\"");
                w.Write(",\"pr\":\""+Esc(prom)+"\"");
                w.Write(",\"tn\":"+tn.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(",\"tg\":"+tg.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write("}");
            }
            w.Write("]");
        }
        return "targets="+n;
    }
}
