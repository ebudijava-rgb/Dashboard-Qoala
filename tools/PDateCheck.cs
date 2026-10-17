using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class PDateCheck
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    static string[] FMTS = new[]{
        "yyyy-MM-dd HH:mm:ss","yyyy-MM-ddTHH:mm:ss","yyyy-MM-dd",
        "M/d/yyyy H:mm:ss","M/d/yyyy H:mm","M/d/yyyy",
        "MM/dd/yyyy HH:mm:ss","MM/dd/yyyy","d/M/yyyy","dd/MM/yyyy",
        "yyyy/MM/dd HH:mm:ss","yyyy/MM/dd"
    };
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
        var sb = new StringBuilder();
        var pRaw = new Dictionary<string,int>();
        var pType = new Dictionary<string,int>();
        var pDay = new SortedDictionary<string,int>();
        long pEmpty=0, pFail=0;
        string sample1=null, sample2=null;

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
                        string pv, pt; double pd;
                        if(!row.TryGetValue("P", out pv) || pv==""){ pEmpty++; continue; }
                        pt = rowT.ContainsKey("P")? rowT["P"] : "n";
                        if(pType.ContainsKey(pt)) pType[pt]++; else pType[pt]=1;
                        string resolved=null;
                        if(pt=="s"){ int si; if(int.TryParse(pv,out si) && si>=0 && si<ss.Count) resolved=ss[si]; }
                        else if(pt=="str"){ resolved=pv; }
                        else if(double.TryParse(pv, NumberStyles.Any, CultureInfo.InvariantCulture, out pd)){ resolved=new DateTime(1899,12,30).AddDays(pd).ToString("yyyy-MM-dd"); }
                        if(resolved==null){ pFail++; continue; }
                        if(sample1==null) sample1="["+pt+"] "+pv+" -> "+resolved;
                        else if(sample2==null && "["+pt+"] "+pv+" -> "+resolved!=sample1) sample2="["+pt+"] "+pv+" -> "+resolved;
                        var key=resolved.Trim();
                        if(pRaw.ContainsKey(key)) pRaw[key]++; else pRaw[key]=1;
                        DateTime dt;
                        if(DateTime.TryParseExact(key, FMTS, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt)){
                            string d=dt.ToString("yyyy-MM-dd");
                            if(pDay.ContainsKey(d)) pDay[d]++; else pDay[d]=1;
                        } else pFail++;
                    }
                }
            }
        }

        sb.Append("P type counts: ");
        foreach(var kv in pType) sb.Append(kv.Key).Append("=").Append(kv.Value).Append(" ");
        sb.Append("\nP empty=").Append(pEmpty).Append(" failParse=").Append(pFail).Append("\n");
        sb.Append("sample1: ").Append(sample1).Append("\n");
        sb.Append("sample2: ").Append(sample2).Append("\n");
        sb.Append("--- distinct P values (raw), top 25 by count ---\n");
        var list=new List<KeyValuePair<string,int>>(pRaw);
        list.Sort(delegate(KeyValuePair<string,int> a, KeyValuePair<string,int> b){ return b.Value.CompareTo(a.Value); });
        for(int i=0;i<list.Count && i<25;i++) sb.Append(list[i].Key).Append("  x").Append(list[i].Value).Append("\n");
        sb.Append("--- P per tanggal (35 terakhir) ---\n");
        var keys=new List<string>(pDay.Keys);
        for(int i=keys.Count-1;i>=0 && i>=keys.Count-35;i--) sb.Append(keys[i]).Append(" : ").Append(pDay[keys[i]]).Append("\n");
        return sb.ToString();
    }
}
