using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class HeaderCheck
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    static string Esc(string s){ return (s==null?"":s).Replace("\r"," ").Replace("\n"," "); }

    class ColCmp : IComparer<string>
    {
        public int Compare(string a, string b){
            if(a.Length!=b.Length) return a.Length-b.Length;
            return string.CompareOrdinal(a,b);
        }
    }

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
        sb.Append("sharedStrings=").Append(ss.Count).Append("\n");

        var pDays = new SortedDictionary<int,int>();
        long pNum=0, pEmpty=0, pNotNum=0;
        var aoSum = new Dictionary<int,double>();
        var aqSum = new Dictionary<int,double>();
        var headers = new SortedDictionary<string,string>(new ColCmp());

        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                bool inRow=false; int rowNum=0; string curCol=null,curType=null,wantTag=null;
                var row = new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element){
                        if(reader.Name=="row"){ inRow=true; rowNum=0; int.TryParse(reader.GetAttribute("r"), out rowNum); row.Clear(); rowT.Clear(); curCol=null; wantTag=null; }
                        else if(inRow && reader.Name=="c"){ curCol=ColOf(reader.GetAttribute("r")); curType=reader.GetAttribute("t"); if(curType==null) curType="n"; wantTag=null; }
                        else if(inRow && (reader.Name=="v"||reader.Name=="t")){ wantTag=reader.Name; }
                    } else if(reader.NodeType==XmlNodeType.Text){
                        if(inRow && curCol!=null && wantTag!=null){ row[curCol]=reader.Value; rowT[curCol]=curType; wantTag=null; }
                    } else if(reader.NodeType==XmlNodeType.EndElement){
                        if(reader.Name=="v"||reader.Name=="t") wantTag=null;
                        else if(reader.Name=="row"){
                            inRow=false;
                            if(rowNum==1){
                                foreach(var kv in row){
                                    int si; string txt;
                                    if(rowT[kv.Key]=="s" && int.TryParse(kv.Value, out si) && si>=0 && si<ss.Count) txt=ss[si]; else txt=kv.Value;
                                    headers[kv.Key]="["+rowT[kv.Key]+"] "+Esc(txt);
                                }
                            } else {
                                string pv; double pd; int ser;
                                bool hasP = row.TryGetValue("P", out pv);
                                if(hasP && pv!=""){
                                    pNum++;
                                    if(double.TryParse(pv, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out pd)){
                                        ser=(int)pd; if(pDays.ContainsKey(ser)) pDays[ser]++; else pDays[ser]=1;
                                    } else pNotNum++;
                                } else pEmpty++;
                                string av; double ad;
                                if(row.TryGetValue("AO", out av) && double.TryParse(av, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out ad)){
                                    ser=(int)ad; if(aoSum.ContainsKey(ser)) aoSum[ser]+=ad; else aoSum[ser]=ad;
                                }
                                string qv; double qd;
                                if(row.TryGetValue("AQ", out qv) && double.TryParse(qv, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out qd)){
                                    ser=(int)qd; if(aqSum.ContainsKey(ser)) aqSum[ser]+=qd; else aqSum[ser]=qd;
                                }
                            }
                        }
                    }
                }
            }
        }

        sb.Append("--- HEADER ROW 1 ---\n");
        foreach(var kv in headers){ sb.Append(kv.Key).Append(" = ").Append(kv.Value).Append("\n"); }

        DateTime baseD = new DateTime(1899,12,30);
        sb.Append("\nP (policy start date) numeric cells=").Append(pNum).Append(" empty=").Append(pEmpty).Append(" nonNumeric=").Append(pNotNum).Append("\n");
        if(pDays.Count>0){
            var keys=new List<int>(pDays.Keys);
            sb.Append("P min=").Append(baseD.AddDays(keys[0]).ToString("yyyy-MM-dd"))
              .Append(" max=").Append(baseD.AddDays(keys[keys.Count-1]).ToString("yyyy-MM-dd"))
              .Append(" distinct=").Append(pDays.Count).Append("\n");
            sb.Append("--- distribusi P (35 tanggal terakhir) ---\n");
            int c=0; for(int i=keys.Count-1;i>=0 && c<35;i--,c++){
                sb.Append(baseD.AddDays(keys[i]).ToString("yyyy-MM-dd")).Append(" : ").Append(pDays[keys[i]]).Append("\n");
            }
        }
        sb.Append("--- AO: ").Append(aoSum.Count).Append(" nilai distinct ---\n");
        foreach(var kv in aoSum){ sb.Append("AO=").Append(kv.Key).Append(" (").Append(baseD.AddDays(kv.Key).ToString("yyyy-MM-dd")).Append(") sum=").Append(kv.Value.ToString("0.##")).Append("\n"); }
        sb.Append("--- AQ: ").Append(aqSum.Count).Append(" nilai distinct ---\n");
        foreach(var kv in aqSum){ sb.Append("AQ=").Append(kv.Key).Append(" sum=").Append(kv.Value.ToString("0.##")).Append("\n"); }
        return sb.ToString();
    }
}
