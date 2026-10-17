using System;
using System.Collections.Generic;
using System.IO.Compression;
using System.Xml;

public static class DateCheck
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    public static string Run(string xlsxPath)
    {
        var days = new SortedDictionary<int,int>();
        int rows=0; int minS=int.MaxValue, maxS=0;
        using(var zip = ZipFile.OpenRead(xlsxPath)){
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using(var s = e.Open())
            using(var reader = XmlReader.Create(s, new XmlReaderSettings(){IgnoreWhitespace=true})){
                string curCol=null; string curType=null; bool inRow=false;
                int rowAO=0; string vA=null, vV=null;
                while(reader.Read()){
                    if(reader.NodeType==XmlNodeType.Element){
                        if(reader.Name=="row"){ inRow=true; rowAO=0; vA=null; vV=null; }
                        else if(inRow && reader.Name=="c"){ curCol=ColOf(reader.GetAttribute("r")); curType=reader.GetAttribute("t"); }
                        else if(inRow && reader.Name=="v"){
                            string val=reader.ReadElementContentAsString();
                            if(curCol=="A") vA=val;
                            else if(curCol=="AO"){ int x; if(int.TryParse(val,out x)) rowAO=x; }
                            else if(curCol=="V") vV=val;
                            curCol=null;
                        }
                    } else if(reader.NodeType==XmlNodeType.EndElement && reader.Name=="row"){
                        inRow=false;
                        if(vV!=null && vV!=""){
                            rows++;
                            if(rowAO>0){ if(rowAO<minS) minS=rowAO; if(rowAO>maxS) maxS=rowAO; days[rowAO]= (days.ContainsKey(rowAO)?days[rowAO]:0)+1; }
                        }
                    }
                }
            }
        }
        DateTime baseD = new DateTime(1899,12,30);
        var sb = new System.Text.StringBuilder();
        sb.Append("rows(gwp non-empty)=").Append(rows).Append(" min=").Append(baseD.AddDays(minS).ToString("yyyy-MM-dd")).Append(" max=").Append(baseD.AddDays(maxS).ToString("yyyy-MM-dd")).Append("\n");
        sb.Append("--- 25 hari terakhir ---\n");
        int cnt=0; var keys=new List<int>(days.Keys);
        for(int i=keys.Count-1;i>=0 && cnt<25;i--,cnt++){
            sb.Append(baseD.AddDays(keys[i]).ToString("yyyy-MM-dd")).Append(" : ").Append(days[keys[i]]).Append("\n");
        }
        return sb.ToString();
    }
}
