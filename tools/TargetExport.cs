using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Xml;

/* TargetExport
   Membaca Target.xlsx (target per bulan) dan menulis JSON per store:
     s, p, am, spa, pa, pr  = identitas store
     tn, tg                 = target NoP & GWP untuk bulan terpilih (monthKey, mis. "2026-10")
     tu                     = target "up" (kolom "Up Target ...", hanya area tertentu)
     tm                     = 12 angka target GWP Jan..Des (0 kalau tidak ada kolomnya)

   Kolom dicari dari BARIS HEADER, bukan posisi tetap, supaya aman saat user
   menambah/menggeser kolom bulan (mis. menambah Nov & Des). */
public static class TargetExport
{
    static readonly string[] MN = { "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec" };

    static string ColOf(string r) { int k = 0; while (k < r.Length && !char.IsDigit(r[k])) k++; return r.Substring(0, k); }
    static string Esc(string s) { return (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", " ").Replace("\n", " "); }
    static string Norm(string s)
    {
        if (s == null) return "";
        s = s.ToLowerInvariant().Replace("&amp;", "&");
        return System.Text.RegularExpressions.Regex.Replace(s, "\\s+", " ").Trim();
    }
    static int MonIdx(string word)
    {
        word = Norm(word).Replace("sept", "sep");
        if (word.Length < 3) return -1;
        string k = word.Substring(0, 3);
        return Array.IndexOf(MN, k);
    }

    public static string Run(string tgtPath, string outJson, string monthKey)
    {
        var rows = new Dictionary<string, Dictionary<string, string>>();
        using (var zip = ZipFile.OpenRead(tgtPath))
        {
            var e = zip.GetEntry("xl/worksheets/sheet1.xml");
            using (var s = e.Open()) using (var reader = XmlReader.Create(s, new XmlReaderSettings() { IgnoreWhitespace = true }))
            {
                while (reader.Read())
                {
                    if (reader.NodeType == XmlNodeType.Element && reader.Name == "row")
                    {
                        string rr = reader.GetAttribute("r");
                        var row = new Dictionary<string, string>();
                        if (!reader.IsEmptyElement)
                        {
                            while (reader.Read())
                            {
                                if (reader.NodeType == XmlNodeType.Element && reader.Name == "c")
                                {
                                    string cr = reader.GetAttribute("r"); string col = ColOf(cr); string v = null;
                                    if (!reader.IsEmptyElement)
                                    {
                                        while (reader.Read())
                                        {
                                            if (reader.NodeType == XmlNodeType.Element && reader.Name == "v") { v = reader.ReadElementContentAsString(); break; }
                                            else if (reader.NodeType == XmlNodeType.EndElement && reader.Name == "c") break;
                                        }
                                    }
                                    else v = "";
                                    row[col] = v ?? "";
                                }
                                else if (reader.NodeType == XmlNodeType.EndElement && reader.Name == "row") break;
                            }
                        }
                        rows[rr] = row;
                    }
                }
            }
        }

        var need = new HashSet<int>();
        foreach (var kv in rows)
        {
            /* baris header: butuh semua kolom (untuk mencari nama bulan) */
            if (kv.Key == "1") { foreach (var c in kv.Value.Values) { int si; if (int.TryParse(c, out si)) need.Add(si); } continue; }
            foreach (var c in new[] { "A", "B", "C", "D", "E", "F", "G" }) { if (kv.Value.ContainsKey(c)) { int si; if (int.TryParse(kv.Value[c], out si)) need.Add(si); } }
        }
        var map = new Dictionary<int, string>();
        using (var zip = ZipFile.OpenRead(tgtPath))
        {
            var e = zip.GetEntry("xl/sharedStrings.xml");
            using (var s = e.Open()) using (var reader = XmlReader.Create(s, new XmlReaderSettings() { IgnoreWhitespace = true }))
            {
                int idx = -1; reader.MoveToContent();
                while (!reader.EOF)
                {
                    if (reader.NodeType == XmlNodeType.Element && reader.Name == "si")
                    {
                        idx++;
                        if (need.Contains(idx))
                        {
                            string outer = reader.ReadOuterXml();
                            var sb2 = new StringBuilder(); int p = 0;
                            while (true) { int s1 = outer.IndexOf("<t", p); if (s1 < 0) break; int s2 = outer.IndexOf(">", s1); if (s2 < 0) break; int e1 = outer.IndexOf("</t>", s2); if (e1 < 0) break; sb2.Append(outer.Substring(s2 + 1, e1 - s2 - 1)); sb2.Append(" "); p = e1 + 4; }
                            map[idx] = sb2.ToString().Trim().Replace("&amp;", "&").Replace("&lt;", "<").Replace("&gt;", ">").Replace("&quot;", "\"").Replace("&apos;", "'");
                        }
                        else reader.Skip();
                    }
                    else reader.Read();
                }
            }
        }
        Func<string, string> S = (si) => { int x; if (int.TryParse(si, out x) && map.ContainsKey(x)) return map[x]; return si; };

        /* ---- baca header: cari kolom "Target NoP <bulan>", "Target GWP <bulan>", "Up Target ..." ---- */
        var gwpCol = new Dictionary<int, string>();   /* 0..11 -> kolom */
        var nopCol = new Dictionary<int, string>();
        string upCol = null;
        if (rows.ContainsKey("1"))
        {
            foreach (var kv in rows["1"])
            {
                string h = Norm(S(kv.Value));
                if (h.Length == 0) continue;
                if (h.StartsWith("up target")) { upCol = kv.Key; continue; }
                if (h.StartsWith("target gwp"))
                {
                    int mi = MonIdx(h.Substring("target gwp".Length).Trim());
                    if (mi >= 0) gwpCol[mi] = kv.Key;
                }
                else if (h.StartsWith("target nop"))
                {
                    int mi = MonIdx(h.Substring("target nop".Length).Trim());
                    if (mi >= 0) nopCol[mi] = kv.Key;
                }
            }
        }
        /* fallback layout lama: H=NoP, I=GWP, J=Up */
        if (gwpCol.Count == 0) { nopCol[9] = "H"; gwpCol[9] = "I"; if (upCol == null) upCol = "J"; }

        int sel = -1;
        if (!string.IsNullOrEmpty(monthKey) && monthKey.Length >= 7)
        {
            int mm; if (int.TryParse(monthKey.Substring(5, 2), out mm)) sel = mm - 1;
        }
        if (sel < 0 || !gwpCol.ContainsKey(sel))
        {
            /* kalau bulan terpilih tidak ada, pakai bulan terakhir yang tersedia */
            int best = -1; foreach (var k in gwpCol.Keys) if (k > best) best = k;
            sel = best;
        }

        Func<Dictionary<string, string>, string, double> Num = (r, col) =>
        {
            double d;
            if (col != null && r.ContainsKey(col) && double.TryParse(r[col], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out d)) return d;
            return 0;
        };

        Directory.CreateDirectory(Path.GetDirectoryName(outJson));
        int n = 0;
        using (var w = new StreamWriter(outJson, false, new UTF8Encoding(false)))
        {
            w.Write("[");
            bool first = true;
            foreach (var kv in rows)
            {
                if (kv.Key == "1") continue; var r = kv.Value;
                if (!r.ContainsKey("A")) continue;
                string store = S(r.ContainsKey("A") ? r["A"] : "").Trim();
                if (store == "") continue;
                string partner = S(r.ContainsKey("B") ? r["B"] : "").Trim();
                string am = S(r.ContainsKey("D") ? r["D"] : "").Trim();
                string spa = S(r.ContainsKey("E") ? r["E"] : "").Trim();
                string pa = S(r.ContainsKey("F") ? r["F"] : "").Trim();
                string prom = S(r.ContainsKey("G") ? r["G"] : "").Trim();
                double tn = sel >= 0 && nopCol.ContainsKey(sel) ? Num(r, nopCol[sel]) : 0;
                double tg = sel >= 0 && gwpCol.ContainsKey(sel) ? Num(r, gwpCol[sel]) : 0;
                double tu = Num(r, upCol);
                if (!first) w.Write(",");
                first = false; n++;
                w.Write("{\"s\":\"" + Esc(store) + "\"");
                w.Write(",\"p\":\"" + Esc(partner) + "\"");
                w.Write(",\"am\":\"" + Esc(am) + "\"");
                w.Write(",\"spa\":\"" + Esc(spa) + "\"");
                w.Write(",\"pa\":\"" + Esc(pa) + "\"");
                w.Write(",\"pr\":\"" + Esc(prom) + "\"");
                w.Write(",\"tn\":" + tn.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(",\"tg\":" + tg.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(",\"tu\":" + tu.ToString(System.Globalization.CultureInfo.InvariantCulture));
                w.Write(",\"tm\":[");
                for (int i = 0; i < 12; i++)
                {
                    if (i > 0) w.Write(",");
                    double v = gwpCol.ContainsKey(i) ? Num(r, gwpCol[i]) : 0;
                    w.Write(v.ToString(System.Globalization.CultureInfo.InvariantCulture));
                }
                w.Write("]}");
            }
            w.Write("]");
        }
        return "targets=" + n + " (bulan " + (sel >= 0 ? MN[sel] : "-") + ", kolom GWP " + (sel >= 0 && gwpCol.ContainsKey(sel) ? gwpCol[sel] : "-") + ", up " + (upCol ?? "-") + ")";
    }

    /* kompatibilitas pemanggilan lama */
    public static string Run(string tgtPath, string outJson) { return Run(tgtPath, outJson, null); }
}
