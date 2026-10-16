using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class NewColCheck
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    public static string Run(string xlsxPath)
    {
        var need=new HashSet<int>(new[]{44,45,46});
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
                            while(true){ int s1=outer.IndexOf("<t",p); if(s1<0)break; int s2=outer.IndexOf(">",s1); if(s2<0)break; int e1=outer.IndexOf("</t>",s2); if(e1<0)break; sb2.Append(outer.Substring(s2+1,e1-s2-1)); sb2.Append(" "); p=e1+4; }
                            map[idx]=sb2.ToString().Trim();
                        } else if(idx>46) break;
                        else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        var sb=new StringBuilder();
        foreach(var i in need) sb.AppendLine("si"+i+"="+(map.ContainsKey(i)?map[i]:"?"));
        // count non-empty AS/AT/AU in data rows (with V present)
        long n=0,asN=0,atN=0,auN=0;
        var auVals=new Dictionary<string,long>(); var asVals=new Dictionary<string,long>(); var atVals=new Dictionary<string,long>();
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
                            } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        if(!row.ContainsKey("V")||row["V"]=="") continue;
                        n++;
                        if(row.ContainsKey("AS")&&row["AS"]!=""){asN++; if(!asVals.ContainsKey(row["AS"]))asVals[row["AS"]]=0; asVals[row["AS"]]++;}
                        if(row.ContainsKey("AT")&&row["AT"]!=""){atN++; if(!atVals.ContainsKey(row["AT"]))atVals[row["AT"]]=0; atVals[row["AT"]]++;}
                        if(row.ContainsKey("AU")&&row["AU"]!=""){auN++; if(!auVals.ContainsKey(row["AU"]))auVals[row["AU"]]=0; auVals[row["AU"]]++;}
                    }
                }
            }
        }
        sb.AppendLine("datarows="+n+" asFilled="+asN+" atFilled="+atN+" auFilled="+auN);
        foreach(var kv in asVals) sb.AppendLine("AS val="+kv.Key+" x"+kv.Value);
        foreach(var kv in atVals) sb.AppendLine("AT val="+kv.Key+" x"+kv.Value);
        foreach(var kv in auVals) sb.AppendLine("AU val="+kv.Key+" x"+kv.Value);
        return sb.ToString();
    }
}
