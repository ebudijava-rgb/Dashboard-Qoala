using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

// Baca Master_user.xlsx (kolom A=ID_User, B=Password, C=Role, D=Name)
// Hasil: JSON array [{u:email, h:hash, r:role, n:name}]
// Password disimpan sebagai hash FNV-1a 32-bit (hex) supaya tidak ada plaintext di file yang ikut Git.
public static class UserExport
{
    static string ColOf(string cellRef){ int k=0; while(k<cellRef.Length && !char.IsDigit(cellRef[k])) k++; return cellRef.Substring(0,k); }
    static string Esc(string s){ return (s==null?"":s).Replace("\\","\\\\").Replace("\"","\\\"").Replace("\r"," ").Replace("\n"," "); }
    public static string Hash(string s)
    {
        unchecked {
            uint h = 2166136261u;
            if (s == null) s = "";
            for (int i = 0; i < s.Length; i++) { h ^= (uint)s[i]; h *= 16777619u; }
            return h.ToString("x8");
        }
    }
    static List<string> ReadShared(ZipArchive zip)
    {
        var ss = new List<string>();
        var e = zip.GetEntry("xl/sharedStrings.xml");
        if (e == null) return ss;
        bool inSi = false; var cur = new StringBuilder();
        using (var s = e.Open()) using (var r = XmlReader.Create(s, new XmlReaderSettings() { IgnoreWhitespace = true }))
        {
            while (r.Read())
            {
                if (r.NodeType == XmlNodeType.Element && r.Name == "si") { inSi = true; cur.Length = 0; }
                else if (inSi && r.NodeType == XmlNodeType.Text) { cur.Append(r.Value); }
                else if (r.NodeType == XmlNodeType.EndElement && r.Name == "si") { inSi = false; ss.Add(cur.ToString()); }
            }
        }
        return ss;
    }
    public static string Run(string xlsxPath, string outJson)
    {
        var sb = new StringBuilder();
        int n = 0;
        using (var zip = ZipFile.OpenRead(xlsxPath))
        {
            var ss = ReadShared(zip);
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            var rows = new List<Dictionary<string, string>>();
            using (var s = e.Open()) using (var reader = XmlReader.Create(s, new XmlReaderSettings() { IgnoreWhitespace = true }))
            {
                bool inRow = false; int rowNum = 0; string curCol = null, curType = null, wantTag = null;
                var row = new Dictionary<string, string>(); var rowT = new Dictionary<string, string>();
                while (reader.Read())
                {
                    if (reader.NodeType == XmlNodeType.Element)
                    {
                        if (reader.Name == "row") { inRow = true; rowNum = 0; int.TryParse(reader.GetAttribute("r"), out rowNum); row.Clear(); rowT.Clear(); curCol = null; wantTag = null; }
                        else if (inRow && reader.Name == "c") { curCol = ColOf(reader.GetAttribute("r")); curType = reader.GetAttribute("t"); if (curType == null) curType = "n"; wantTag = null; }
                        else if (inRow && (reader.Name == "v" || reader.Name == "t")) { wantTag = reader.Name; }
                    }
                    else if (reader.NodeType == XmlNodeType.Text)
                    {
                        if (inRow && curCol != null && wantTag != null) { row[curCol] = reader.Value; rowT[curCol] = curType; wantTag = null; }
                    }
                    else if (reader.NodeType == XmlNodeType.EndElement && reader.Name == "row")
                    {
                        inRow = false;
                        if (rowNum <= 1) continue;
                        var clean = new Dictionary<string, string>();
                        foreach (var kv in row)
                        {
                            string v = kv.Value; string t;
                            if (rowT.ContainsKey(kv.Key)) t = rowT[kv.Key]; else t = "n";
                            if (t == "s") { int si; if (int.TryParse(v, out si) && si >= 0 && si < ss.Count) v = ss[si]; }
                            clean[kv.Key] = v == null ? "" : v.Trim();
                        }
                        rows.Add(clean);
                    }
                }
            }
            sb.Append("[");
            foreach (var r in rows)
            {
                string u, p, role, name;
                r.TryGetValue("A", out u); r.TryGetValue("B", out p); r.TryGetValue("C", out role); r.TryGetValue("D", out name);
                if (string.IsNullOrEmpty(u)) continue;
                if (n > 0) sb.Append(",");
                sb.Append("{\"u\":\"").Append(Esc(u)).Append("\"");
                sb.Append(",\"h\":\"").Append(Hash(p)).Append("\"");
                sb.Append(",\"r\":\"").Append(Esc(role)).Append("\"");
                sb.Append(",\"n\":\"").Append(Esc(name)).Append("\"}");
                n++;
            }
            sb.Append("]");
        }
        File.WriteAllText(outJson, sb.ToString(), new UTF8Encoding(false));
        return "users=" + n;
    }
}
