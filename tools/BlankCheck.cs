using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class BlankCheck
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    public static string Run(string xlsxPath, int sampleN)
    {
        string dim="?"; long nRows=0, blankAO=0; long withV=0, withAQ=0;
        var colPresent=new Dictionary<string,long>();
        var samples=new List<Dictionary<string,string>>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="dimension"){ dim=reader.GetAttribute("ref"); }
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        if(rr=="1"){ if(!reader.IsEmptyElement) reader.Skip(); continue; }
                        nRows++;
                        if(reader.IsEmptyElement) continue;
                        var row=new Dictionary<string,string>();
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
                                if(!colPresent.ContainsKey(col)) colPresent[col]=0; colPresent[col]++;
                            } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        if(!row.ContainsKey("AO")||row["AO"]==""){ blankAO++; if(samples.Count<sampleN) samples.Add(row); }
                        if(row.ContainsKey("V")&&row["V"]!="") withV++;
                        if(row.ContainsKey("AQ")&&row["AQ"]!="") withAQ++;
                    }
                }
            }
        }
        var sb=new StringBuilder();
        sb.AppendLine("dim="+dim+" rows="+nRows+" blankAO="+blankAO+" withV="+withV+" withAQ="+withAQ);
        var cols=new List<string>(colPresent.Keys); cols.Sort();
        sb.AppendLine("cols="+string.Join(",",cols));
        // need strings for sample
        var need=new HashSet<int>();
        foreach(var r in samples){ foreach(var kv in r){ int si; if(int.TryParse(kv.Value,out si)) need.Add(si); } }
        var map=new Dictionary<int,string>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/sharedStrings.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                int idx=-1; reader.MoveToContent();
                while(!reader.EOF){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="si"){
                        idx++;
                        if(need.Contains(idx)){
                            string outer=reader.ReadOuterXml();
                            var sb2=new StringBuilder(); int p=0;
                            while(true){ int s1=outer.IndexOf("<t",p); if(s1<0)break; int s2=outer.IndexOf(">",s1); if(s2<0)break; int e1=outer.IndexOf("</t>",s2); if(e1<0)break; sb2.Append(outer.Substring(s2+1,e1-s2-1)); sb2.Append("|"); p=e1+4; }
                            map[idx]=sb2.ToString().Replace("&amp;","&").Replace("&lt;","<").Replace("&gt;",">");
                        } else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        Func<string,string> Rv=(si)=>{ int x; if(int.TryParse(si,out x)&&map.ContainsKey(x)) return map[x]; return si; };
        for(int i=0;i<samples.Count;i++){
            sb.AppendLine("--- blank sample "+(i+1)+" ---");
            foreach(var c in cols){ string v=samples[i].ContainsKey(c)?samples[i][c]:"(missing)"; sb.AppendLine(c+"="+Rv(v)); }
        }
        return sb.ToString();
    }
}
