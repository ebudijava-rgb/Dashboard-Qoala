using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class GwpCheck
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    static string ExcelSerialToYm(int serial){
        DateTime baseD = new DateTime(1899,12,30);
        DateTime d = baseD.AddDays(serial);
        return string.Format("{0:0000}-{1:00}", d.Year, d.Month);
    }
    static double Num(Dictionary<string,string> row, Dictionary<string,string> rowT, string col, List<string> ss){
        if(!row.ContainsKey(col)) return double.NaN;
        string v=row[col]; if(v==null||v=="") return double.NaN;
        string t = rowT.ContainsKey(col)? rowT[col] : "n";
        if(t=="s"){
            int si; if(int.TryParse(v,out si) && si>=0 && si<ss.Count) v=ss[si]; else return double.NaN;
        }
        double d;
        if(double.TryParse(v, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out d)) return d;
        return double.NaN;
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

        long rows=0, hasV=0, hasX=0, both=0, onlyV=0, onlyX=0, none=0, xZero=0, vZero=0;
        double sumV=0, sumX=0;
        var perMonth = new SortedDictionary<string,double[]>(); // [sumV, sumX, rows]

        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                bool inRow=false; int rowNum=0; string curCol=null,curType=null,wantTag=null;
                var row=new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
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
                            if(rowNum<=1) continue;
                            if(row.Count==0) continue;
                            double v=Num(row,rowT,"V",ss), x=Num(row,rowT,"X",ss);
                            bool hasv=!double.IsNaN(v), hasx=!double.IsNaN(x);
                            rows++;
                            if(hasv) hasV++; if(hasx) hasX++;
                            if(hasv&&hasx) both++; else if(hasv) onlyV++; else if(hasx) onlyX++; else none++;
                            if(hasx&&x==0) xZero++;
                            if(hasv&&v==0) vZero++;
                            if(hasv) sumV+=v;
                            if(hasx) sumX+=x;
                            // bulan dari AO (serial)
                            int ser; string ym=null;
                            if(row.ContainsKey("AO") && int.TryParse(row["AO"], out ser) && ser>0) ym=ExcelSerialToYm(ser);
                            if(ym==null){
                                string ap; int y;
                                if(row.TryGetValue("AP", out ap) && int.TryParse(ap, out y) && y>2000) ym=string.Format("{0:0000}-01", y);
                            }
                            if(ym==null) ym="(tanpa bulan)";
                            double[] a; if(!perMonth.TryGetValue(ym, out a)){ a=new double[3]; perMonth[ym]=a; }
                            a[0]+= hasv? v:0; a[1]+= hasx? x:0; a[2]+=1;
                        }
                    }
                }
            }
        }

        var sb=new StringBuilder();
        sb.Append("baris data = ").Append(rows).Append("\n");
        sb.Append("V (gwp) terisi = ").Append(hasV).Append("   X (after marketing support) terisi = ").Append(hasX).Append("\n");
        sb.Append("dua-duanya terisi = ").Append(both).Append("   hanya V = ").Append(onlyV).Append("   hanya X = ").Append(onlyX).Append("   kosong dua-duanya = ").Append(none).Append("\n");
        sb.Append("baris X = 0 = ").Append(xZero).Append("   baris V = 0 = ").Append(vZero).Append("\n");
        sb.Append("TOTAL V = ").Append(sumV.ToString("0.##")).Append("   TOTAL X = ").Append(sumX.ToString("0.##")).Append("   (X/V = ").Append((sumV!=0?(sumX/sumV*100).ToString("0.##"):"-")).Append("%)\n");
        sb.Append("\n--- per bulan (12 terakhir) ---\n");
        var keys=new List<string>(perMonth.Keys);
        int c=0;
        for(int i=keys.Count-1;i>=0 && c<12;i--,c++){
            var a=perMonth[keys[i]];
            sb.Append(keys[i]).Append(" : baris=").Append(a[2].ToString("0"))
              .Append("  V=").Append(a[0].ToString("0")).Append("  X=").Append(a[1].ToString("0"))
              .Append("  X/V=").Append(a[0]!=0?(a[1]/a[0]*100).ToString("0.#")+"%":"-").Append("\n");
        }
        return sb.ToString();
    }
}
