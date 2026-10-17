using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Text;
using System.Xml;

public static class DumpSheet
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    public static string Run(string xlsxPath, int maxRows)
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
        var sb=new StringBuilder();
        sb.Append("sharedStrings=").Append(ss.Count).Append("\n");
        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s=e.Open()) using(var reader=XmlReader.Create(s,new XmlReaderSettings(){IgnoreWhitespace=true})){
                bool inRow=false; int rowNum=0, printed=0; string curCol=null,curType=null,wantTag=null;
                var row=new Dictionary<string,string>(); var rowT=new Dictionary<string,string>();
                var order=new List<string>();
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element){
                        if(reader.Name=="row"){ inRow=true; rowNum=0; int.TryParse(reader.GetAttribute("r"),out rowNum); row.Clear(); rowT.Clear(); order.Clear(); curCol=null; wantTag=null; }
                        else if(inRow && reader.Name=="c"){ curCol=ColOf(reader.GetAttribute("r")); curType=reader.GetAttribute("t"); if(curType==null) curType="n"; wantTag=null; if(!order.Contains(curCol)) order.Add(curCol); }
                        else if(inRow && (reader.Name=="v"||reader.Name=="t")){ wantTag=reader.Name; }
                    } else if(reader.NodeType==XmlNodeType.Text){
                        if(inRow && curCol!=null && wantTag!=null){ row[curCol]=reader.Value; rowT[curCol]=curType; wantTag=null; }
                    } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row"){
                        inRow=false;
                        if(printed>=maxRows) continue;
                        printed++;
                        var line=new StringBuilder(); line.Append("r").Append(rowNum).Append(": ");
                        foreach(var c in order){
                            string v; row.TryGetValue(c,out v); string t; rowT.TryGetValue(c,out t);
                            if(t=="s"){ int si; if(v!=null && int.TryParse(v,out si) && si>=0 && si<ss.Count) v=ss[si]; }
                            if(v==null) v="";
                            line.Append("[").Append(c).Append("]").Append(v).Append(" | ");
                        }
                        sb.Append(line.ToString().TrimEnd(' ','|')).Append("\n");
                    }
                }
            }
        }
        return sb.ToString();
    }
}
