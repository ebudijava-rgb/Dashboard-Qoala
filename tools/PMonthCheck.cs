using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class PMonthCheck
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    public static string Run(string xlsxPath)
    {
        var ss = new List<string>();
        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/sharedStrings.xml");
            if(e!=null){
                bool inSi=false; var cur=new StringBuilder();
                using(var s=e.Open()) using(var r=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                    while(r.Read()){
                        if(r.NodeType==XmlNodeType.Element && r.Name=="si"){ inSi=true; cur.Length=0; }
                        else if(inSi && r.NodeType==XmlNodeType.Text){ cur.Append(r.Value); }
                        else if(r.NodeType==XmlNodeType.EndElement && r.Name=="si"){ inSi=false; ss.Add(cur.ToString()); }
                    }
                }
            }
        }
        var crosstab = new Dictionary<string,int>();
        int mismatch=0, total=0;
        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                bool inRow=false; int rowNum=0; string curCol=null,curType=null,wantTag=null;
                var row=new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element){
                        if(reader.Name=="row"){ inRow=true; rowNum=0; int.TryParse(reader.GetAttribute("r"),out rowNum); row.Clear(); rowT.Clear(); curCol=null; wantTag=null; }
                        else if(inRow && reader.Name=="c"){ curCol=ColOf(reader.GetAttribute("r")); curType=reader.GetAttribute("t"); if(curType==null) curType="n"; wantTag=null; }
                        else if(inRow && (reader.Name=="v"||reader.Name=="t")){ wantTag=reader.Name; }
                    } else if(reader.NodeType==XmlNodeType.Text){
                        if(inRow && curCol!=null && wantTag!=null){ row[curCol]=reader.Value; rowT[curCol]=curType; wantTag=null; }
                    } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row"){
                        inRow=false;
                        if(rowNum<=1) continue;
                        string av, pv;
                        if(!row.TryGetValue("AO", out av) || av=="") continue;
                        double ad; if(!double.TryParse(av, NumberStyles.Any, CultureInfo.InvariantCulture, out ad)) continue;
                        string aoYm = new DateTime(1899,12,30).AddDays(ad).ToString("yyyy-MM");
                        string pYm="(kosong)";
                        if(row.TryGetValue("P", out pv) && pv!=""){
                            string pt = rowT.ContainsKey("P")? rowT["P"] : "n";
                            string resolved=null;
                            if(pt=="s"){ int si; if(int.TryParse(pv,out si) && si>=0 && si<ss.Count) resolved=ss[si]; }
                            else resolved=pv;
                            if(resolved!=null && resolved.Length>=7) pYm=resolved.Substring(0,7);
                        }
                        total++;
                        if(pYm!=aoYm) mismatch++;
                        string k=aoYm+"|"+pYm;
                        if(crosstab.ContainsKey(k)) crosstab[k]++; else crosstab[k]=1;
                    }
                }
            }
        }
        var sb=new StringBuilder();
        sb.Append("total=").Append(total).Append(" mismatch=").Append(mismatch).Append("\n");
        var list=new List<string>(crosstab.Keys); list.Sort();
        sb.Append("--- crosstab AO(Month) | P(policy start) : jumlah ---\n");
        foreach(var k in list){ if(crosstab[k]>=5) sb.Append(k).Append(" : ").Append(crosstab[k]).Append("\n"); }
        sb.Append("--- baris mismatch (AO != P bulan) yg < 5: ---\n");
        foreach(var k in list){ if(crosstab[k]<5){ string[] pr=k.Split('|'); if(pr[0]!=pr[1]) sb.Append(k).Append(" : ").Append(crosstab[k]).Append("\n"); } }
        return sb.ToString();
    }
}
