using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class DimCheck
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
        Func<string,string> TV = (v)=>{ return v==null? "" : v; };

        var cols = new string[]{"AF","AG","AH","AI","AJ","AK","AL"};
        var counts = new Dictionary<string,Dictionary<string,long>>();
        var gwpSum = new Dictionary<string,Dictionary<string,double>>();
        foreach(var c in cols){ counts[c]=new Dictionary<string,long>(); gwpSum[c]=new Dictionary<string,double>(); }

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
                            double gwp=0; string xv;
                            if(row.TryGetValue("X", out xv) && xv!=""){ double dd; if(double.TryParse(xv, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out dd)) gwp=dd; }
                            foreach(var c in cols){
                                if(!row.ContainsKey(c)) continue;
                                string v=row[c]; string t=rowT[c];
                                if(v==null) v="";
                                if(t=="s"){ int si; if(int.TryParse(v,out si) && si>=0 && si<ss.Count) v=ss[si]; }
                                v=TV(v).Trim(); if(v=="") v="(kosong)";
                                var dc=counts[c]; long n; dc.TryGetValue(v, out n); dc[v]=n+1;
                                var dg=gwpSum[c]; double g2; dg.TryGetValue(v, out g2); dg[v]=g2+gwp;
                            }
                        }
                    }
                }
            }
        }

        var sb=new StringBuilder();
        var names=new Dictionary<string,string>{
            {"AF","device type"},{"AG","device imei/sn"},{"AH","device category"},{"AI","device brand"},{"AJ","device price"},{"AK","duration unit"},{"AL","duration type"}};
        foreach(var c in cols){
            if(c=="AG") continue; // imei unik, skip
            var dc=counts[c]; var dg=gwpSum[c];
            var keys=new List<string>(dc.Keys); keys.Sort();
            sb.Append("=== ").Append(c).Append(" = ").Append(names[c]).Append(" === distinct=").Append(keys.Count).Append("\n");
            foreach(var k in keys){
                double g; dg.TryGetValue(k, out g);
                sb.Append("   ").Append(k).Append("  |  ").Append(dc[k].ToString("N0")).Append(" polis  |  GWP ").Append(g.ToString("N0")).Append("\n");
            }
            sb.Append("\n");
        }
        return sb.ToString();
    }
}
