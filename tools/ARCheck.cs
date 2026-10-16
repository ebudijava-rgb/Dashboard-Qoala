using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class ARCheck
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    public static string Run(string xlsxPath)
    {
        var needSi=new HashSet<int>();
        var arVals=new Dictionary<string,long>();
        var cmpSame=0; long cmpTot=0; var diffEx=new List<string>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                var row=new Dictionary<string,string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        if(rr=="1"){ if(!reader.IsEmptyElement) reader.Skip(); continue; }
                        if(reader.IsEmptyElement) continue;
                        row.Clear();
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
                                if(col=="AR"||col=="AT"||col=="AS"){ int si; if(int.TryParse(row[col],out si)) needSi.Add(si); }
                            } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        if(!row.ContainsKey("V")||row["V"]=="") continue;
                        string ar=row.ContainsKey("AR")?row["AR"]:"";
                        if(!arVals.ContainsKey(ar)) arVals[ar]=0; arVals[ar]++;
                        if(row.ContainsKey("AT")&&row["AT"]!=""){ cmpTot++; if(ar==row["AT"]) cmpSame++; else if(diffEx.Count<5) diffEx.Add("AR="+ar+" AT="+row["AT"]); }
                    }
                }
            }
        }
        var map=new Dictionary<int,string>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/sharedStrings.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                int idx=-1; reader.MoveToContent();
                while(!reader.EOF){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="si"){
                        idx++;
                        if(needSi.Contains(idx)){
                            string outer=reader.ReadOuterXml();
                            var sb2=new StringBuilder(); int p=0;
                            while(true){ int s1=outer.IndexOf("<t",p); if(s1<0)break; int s2=outer.IndexOf(">",s1); if(s2<0)break; int e1=outer.IndexOf("</t>",s2); if(e1<0)break; sb2.Append(outer.Substring(s2+1,e1-s2-1)); sb2.Append(" "); p=e1+4; }
                            map[idx]=sb2.ToString().Trim();
                        } else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        var sb=new StringBuilder();
        sb.AppendLine("AR distinct="+arVals.Count+" AR==AT: "+cmpSame+"/"+cmpTot);
        foreach(var d in diffEx) sb.AppendLine("diff "+d);
        var keys=new List<string>(arVals.Keys);
        var named=new Dictionary<string,long>();
        foreach(var k in keys){ int si; string nm=k; if(int.TryParse(k,out si)&&map.ContainsKey(si)) nm=map[si]; if(!named.ContainsKey(nm)) named[nm]=0; named[nm]+=arVals[k]; }
        var nk=new List<string>(named.Keys); nk.Sort();
        foreach(var k in nk) sb.AppendLine("AR="+k+" x"+named[k]);
        return sb.ToString();
    }
}
