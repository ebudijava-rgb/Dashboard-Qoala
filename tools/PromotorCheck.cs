using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class PromotorCheck
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    public static string Run(string tgtPath)
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
        foreach(var kv in rows){ if(kv.Key=="1") continue; foreach(var c in new[]{"A","F","G"}){ if(kv.Value.ContainsKey(c)){ int si; if(int.TryParse(kv.Value[c],out si)) need.Add(si); } } }
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
                            map[idx]=sb2.ToString().Trim().Replace("&amp;","&").Replace("&lt;","<").Replace("&gt;",">");
                        } else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        Func<string,string> S=(si)=>{ int x; if(int.TryParse(si,out x)&&map.ContainsKey(x)) return map[x]; return si; };
        var promStores=new Dictionary<string,HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        var promPa=new Dictionary<string,HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        int blank=0, filled=0, total=0;
        foreach(var kv in rows){
            if(kv.Key=="1") continue; var r=kv.Value;
            if(!r.ContainsKey("A")) continue; total++;
            string store=S(r.ContainsKey("A")?r["A"]:"").Trim();
            string pa=S(r.ContainsKey("F")?r["F"]:"").Trim();
            string prom=(r.ContainsKey("G")?S(r["G"]):"").Trim();
            if(prom==""){ blank++; continue; }
            filled++;
            if(!promStores.ContainsKey(prom)){ promStores[prom]=new HashSet<string>(StringComparer.OrdinalIgnoreCase); promPa[prom]=new HashSet<string>(StringComparer.OrdinalIgnoreCase); }
            promStores[prom].Add(store); promPa[prom].Add(pa);
        }
        var sb=new StringBuilder();
        sb.AppendLine("total="+total+" filled="+filled+" blank="+blank+" distinct=" + promStores.Count);
        var keys=new List<string>(promStores.Keys); keys.Sort();
        foreach(var k in keys) sb.AppendLine(k+" | stores="+promStores[k].Count+" | pa="+string.Join(",",promPa[k])+" | ex="+string.Join(";",new List<string>(promStores[k]).GetRange(0,Math.Min(3,promStores[k].Count))));
        return sb.ToString();
    }
}
