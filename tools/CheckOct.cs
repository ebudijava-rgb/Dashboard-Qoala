using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class CheckOct
{
    static string ColOf(string r){ int k=0; while(k<r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0,k); }
    static string Ym(int serial){ DateTime b=new DateTime(1899,12,30); DateTime d=b.AddDays(serial); return string.Format("{0:0000}-{1:00}",d.Year,d.Month); }
    public static string Run(string xlsxPath)
    {
        var aoCount=new Dictionary<string,long>();
        var sample=new List<Dictionary<string,string>>();
        var sampleT=new List<Dictionary<string,string>>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                var row=new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        if(rr=="1"){ if(!reader.IsEmptyElement) reader.Skip(); continue; }
                        if(reader.IsEmptyElement) continue;
                        row.Clear(); rowT.Clear();
                        while(reader.Read()){
                            if(reader.NodeType==XmlNodeType.Element && reader.Name=="c"){
                                string cr=reader.GetAttribute("r"), ct=reader.GetAttribute("t");
                                string col=ColOf(cr); string v=null;
                                if(!reader.IsEmptyElement){
                                    while(reader.Read()){
                                        if(reader.NodeType==XmlNodeType.Element && reader.Name=="v"){ v=reader.ReadElementContentAsString(); break; }
                                        else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="c") break;
                                    }
                                } else v="";
                                row[col]=v??""; rowT[col]=ct??"";
                            } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        string ao=row.ContainsKey("AO")?row["AO"]:"";
                        if(!aoCount.ContainsKey(ao)) aoCount[ao]=0; aoCount[ao]++;
                    }
                }
            }
        }
        var sb=new StringBuilder();
        sb.AppendLine("AO distinct="+aoCount.Count);
        var keys=new List<string>(aoCount.Keys);
        keys.Sort();
        foreach(var k in keys){
            string ym=k; int s; if(int.TryParse(k,out s)) ym=Ym(s)+" ("+k+")";
            sb.AppendLine(ym+" count="+aoCount[k]);
        }
        return sb.ToString();
    }
    public static string Sample(string xlsxPath, string aoWant, int n)
    {
        var rows=new List<Dictionary<string,string>>();
        var rowTs=new List<Dictionary<string,string>>();
        using(var zip=ZipFile.OpenRead(xlsxPath)){
            var e=zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                var row=new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element && reader.Name=="row"){
                        string rr=reader.GetAttribute("r");
                        if(rr=="1"){ if(!reader.IsEmptyElement) reader.Skip(); continue; }
                        if(reader.IsEmptyElement) continue;
                        row.Clear(); rowT.Clear();
                        while(reader.Read()){
                            if(reader.NodeType==XmlNodeType.Element && reader.Name=="c"){
                                string cr=reader.GetAttribute("r"), ct=reader.GetAttribute("t");
                                string col=ColOf(cr); string v=null;
                                if(!reader.IsEmptyElement){
                                    while(reader.Read()){
                                        if(reader.NodeType==XmlNodeType.Element && reader.Name=="v"){ v=reader.ReadElementContentAsString(); break; }
                                        else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="c") break;
                                    }
                                } else v="";
                                row[col]=v??""; rowT[col]=ct??"";
                            } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row") break;
                        }
                        string ao=row.ContainsKey("AO")?row["AO"]:"";
                        if(ao==aoWant){ rows.Add(new Dictionary<string,string>(row)); rowTs.Add(new Dictionary<string,string>(rowT)); if(rows.Count>=n) break; }
                    }
                }
            }
        }
        // collect si needed for cols A,C,I,J,AM,AR,O,P,R,V,AQ
        var need=new HashSet<int>();
        string[] cols=new[]{"A","C","I","J","AM","AR","O","P","R","T","U"};
        foreach(var r in rows){ for(int i=0;i<cols.Length;i++){ string c=cols[i]; if(r.ContainsKey(c)){ int si; if(int.TryParse(r[c],out si)) need.Add(si); } } }
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
                            string val=sb2.ToString().Replace("&amp;","&").Replace("&lt;","<").Replace("&gt;",">");
                            map[idx]=val;
                        } else reader.Skip();
                    } else reader.Read();
                }
            }
        }
        Func<string,string,string> Rv=(col,si)=>{ int x; if(int.TryParse(si,out x)&&map.ContainsKey(x)) return map[x]; return si; };
        var sb=new StringBuilder();
        sb.AppendLine("sample rows ao="+aoWant+" n="+rows.Count);
        for(int k=0;k<rows.Count;k++){
            var r=rows[k];
            sb.AppendLine("--- row "+(k+1)+" ---");
            sb.AppendLine("A_ins="+Rv("A",r.ContainsKey("A")?r["A"]:""));
            sb.AppendLine("C_part="+Rv("C",r.ContainsKey("C")?r["C"]:""));
            sb.AppendLine("O_purchase="+Rv("O",r.ContainsKey("O")?r["O"]:""));
            sb.AppendLine("P_start="+Rv("P",r.ContainsKey("P")?r["P"]:""));
            sb.AppendLine("R_created="+Rv("R",r.ContainsKey("R")?r["R"]:""));
            sb.AppendLine("AM_store="+Rv("AM",r.ContainsKey("AM")?r["AM"]:""));
            sb.AppendLine("AR_pa="+Rv("AR",r.ContainsKey("AR")?r["AR"]:""));
            sb.AppendLine("V_gwp="+(r.ContainsKey("V")?r["V"]:"")+" AQ_nop="+(r.ContainsKey("AQ")?r["AQ"]:"")+" AP_year="+(r.ContainsKey("AP")?r["AP"]:""));
        }
        return sb.ToString();
    }
}
