using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Xml;

public static class XlsxStats
{
    static string ColOf(string cellRef)
    {
        int i = 0;
        while (i < cellRef.Length && !char.IsDigit(cellRef[i])) i++;
        return cellRef.Substring(0, i);
    }
    public static string Run(string xlsxPath, int maxRows)
    {
        var needStr = new HashSet<string>(new[]{"A","C","I","J","AM","AR"});
        var distinctSi = new Dictionary<string, HashSet<int>>();
        foreach (var c in needStr) distinctSi[c] = new HashSet<int>();
        var years = new HashSet<string>();
        var months = new HashSet<string>();
        long rows = 0;
        double sumGwp = 0, sumNop = 0;
        double minGwp = double.MaxValue, maxGwp = double.MinValue;
        long aoMin = long.MaxValue, aoMax = long.MinValue;

        using (var zip = ZipFile.OpenRead(xlsxPath))
        {
            var entry = zip.GetEntry("xl/worksheets/sheet1.xml");
            using (var stream = entry.Open())
            using (var reader = XmlReader.Create(stream, new XmlReaderSettings(){IgnoreWhitespace=true}))
            {
                string curCol = null; string curT = null; string curR = null;
                var row = new Dictionary<string,string>();
                var rowT = new Dictionary<string,string>();
                string rowR = null;
                while (reader.Read())
                {
                    if (reader.NodeType == XmlNodeType.Element && reader.Name == "row")
                    {
                        row.Clear(); rowT.Clear();
                        rowR = reader.GetAttribute("r");
                        if (rowR == "1") { reader.Skip(); continue; }
                        if (reader.IsEmptyElement) continue;
                        // read cells inside row
                        while (reader.Read())
                        {
                            if (reader.NodeType == XmlNodeType.Element && reader.Name == "c")
                            {
                                curR = reader.GetAttribute("r");
                                curT = reader.GetAttribute("t");
                                curCol = ColOf(curR);
                                string v = null;
                                if (reader.IsEmptyElement) { v = ""; }
                                else
                                {
                                    while (reader.Read())
                                    {
                                        if (reader.NodeType == XmlNodeType.Element && reader.Name == "v") { v = reader.ReadElementContentAsString(); break; }
                                        else if (reader.NodeType == XmlNodeType.EndElement && reader.Name == "c") break;
                                    }
                                }
                                row[curCol] = v ?? "";
                                rowT[curCol] = curT ?? "";
                            }
                            else if (reader.NodeType == XmlNodeType.EndElement && reader.Name == "row") break;
                        }
                        rows++;
                        // numeric
                        double gwp = 0, nop = 0;
                        if (row.ContainsKey("V")) double.TryParse(row["V"], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out gwp);
                        if (row.ContainsKey("AQ")) double.TryParse(row["AQ"], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out nop);
                        sumGwp += gwp; sumNop += nop;
                        if (gwp < minGwp) minGwp = gwp;
                        if (gwp > maxGwp) maxGwp = gwp;
                        if (row.ContainsKey("AP")) years.Add(row["AP"]);
                        if (row.ContainsKey("AO"))
                        {
                            months.Add(row["AO"]);
                            long ao; if (long.TryParse(row["AO"], out ao)) { if (ao < aoMin) aoMin = ao; if (ao > aoMax) aoMax = ao; }
                        }
                        foreach (var c in needStr)
                        {
                            if (row.ContainsKey(c) && rowT.ContainsKey(c) && rowT[c]=="s")
                            {
                                int si; if (int.TryParse(row[c], out si)) distinctSi[c].Add(si);
                            }
                        }
                        if (maxRows > 0 && rows >= maxRows) break;
                    }
                }
            }
        }
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("{");
        sb.AppendLine("  \"rows\": " + rows + ",");
        sb.AppendLine("  \"sumGwp\": " + sumGwp.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",");
        sb.AppendLine("  \"sumNop\": " + sumNop.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",");
        sb.AppendLine("  \"minGwp\": " + minGwp.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",");
        sb.AppendLine("  \"maxGwp\": " + maxGwp.ToString(System.Globalization.CultureInfo.InvariantCulture) + ",");
        sb.AppendLine("  \"years\": [" + string.Join(",", years) + "],");
        sb.AppendLine("  \"monthSerialsDistinct\": " + months.Count + ",");
        sb.AppendLine("  \"aoMin\": " + aoMin + ", \"aoMax\": " + aoMax + ",");
        foreach (var kv in distinctSi) sb.AppendLine("  \"distinctSi_" + kv.Key + "\": " + kv.Value.Count + ",");
        sb.AppendLine("  \"ok\": true");
        sb.AppendLine("}");
        return sb.ToString();
    }
}
