import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("starter", Path(__file__).parents[1] / "scripts/start-report.py")
starter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(starter)


class SourcePreparationTests(unittest.TestCase):
    def test_note_positions_text_and_internal_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / 'notes.docx'
            ns = starter.W[1:-1]
            with zipfile.ZipFile(source, 'w') as z:
                z.writestr('word/document.xml', f'<w:document xmlns:w="{ns}"><w:body>'
                    '<w:p><w:r><w:t>미국 소비</w:t></w:r><w:r><w:footnoteReference w:id="42"/></w:r>'
                    '<w:r><w:t> 이후</w:t></w:r><w:r><w:endnoteReference w:id="42"/></w:r>'
                    '<w:r><w:footnoteReference w:id="99"/></w:r></w:p>'
                    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>목차</w:t></w:r>'
                    '<w:r><w:footnoteReference w:id="42"/></w:r></w:p></w:tc></w:tr></w:tbl>'
                    '</w:body></w:document>')
                z.writestr('word/footnotes.xml', f'<w:footnotes xmlns:w="{ns}">'
                    '<w:footnote w:id="-1" w:type="separator"><w:p/></w:footnote>'
                    '<w:footnote w:id="42"><w:p><w:r><w:t>1/4분기 4.9 → 8.4</w:t><w:br/><w:t>둘째 줄</w:t></w:r></w:p>'
                    '<w:p><w:r><w:t>다음 문단</w:t></w:r></w:p></w:footnote></w:footnotes>')
                z.writestr('word/endnotes.xml', f'<w:endnotes xmlns:w="{ns}"><w:endnote w:id="42"><w:p><w:r><w:t>미주</w:t></w:r></w:p></w:endnote></w:endnotes>')
            doc, _ = starter.document(source, root / 'out', 0)
            tokens = doc['blocks'][0]['inlineParagraphs'][0]
            self.assertEqual([t['kind'] for t in tokens[:3]], ['text', 'note-reference', 'text'])
            self.assertEqual(len(doc['notes']['footnotes']), 1)
            self.assertEqual(doc['notes']['footnotes'][0]['text'], '1/4분기 4.9 → 8.4\n둘째 줄\n다음 문단')
            links = doc['noteLinks']
            self.assertEqual(len(links), 4)
            self.assertIsNone(links[0]['displayLabel'])
            self.assertEqual(links[0]['sourceId'], '42')
            self.assertEqual(links[0]['tokenIndex'], 1)
            self.assertEqual(links[1]['text'], '미주')
            self.assertEqual(links[2]['status'], 'unresolved')
            self.assertEqual(links[3]['sourceBlock'], 'B0002')
            self.assertTrue((root / 'out/docx-original/word/footnotes.xml').exists())

    def test_word_alternate_content_is_not_double_counted(self):
        node = starter.ET.fromstring(
            f'<w:p xmlns:w="{starter.W[1:-1]}" xmlns:mc="{starter.MC[1:-1]}">'
            '<mc:AlternateContent><mc:Choice Requires="x"><w:r><w:t>원문</w:t></w:r></mc:Choice>'
            '<mc:Fallback><w:r><w:t>원문</w:t></w:r></mc:Fallback></mc:AlternateContent></w:p>')
        self.assertEqual(starter.text(node), "원문")

    def test_sparse_sheet_preserves_formula_and_missing_cache(self):
        with tempfile.TemporaryDirectory(prefix="bok-source-test-") as temp:
            root = Path(temp)
            source = root / "source.xlsx"
            with zipfile.ZipFile(source, "w") as z:
                z.writestr("xl/workbook.xml", f'<workbook xmlns="{starter.S[1:-1]}" xmlns:r="{starter.R[1:-1]}"><workbookPr date1904="1"/><sheets><sheet name="Ⅰ-1" sheetId="1" r:id="r1"/></sheets></workbook>')
                z.writestr("xl/_rels/workbook.xml.rels", f'<Relationships xmlns="{starter.P[1:-1]}"><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>')
                z.writestr("xl/worksheets/sheet1.xml", f'<worksheet xmlns="{starter.S[1:-1]}"><dimension ref="A1:XFD1048576"/><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>제목</t></is></c><c r="B1" s="3"><f>1+2</f><v>3</v></c><c r="C1"><f>B1+1</f></c><c r="XFD1" s="2"/></row></sheetData></worksheet>')
            inventory = starter.workbook(source, root / "out")
            sheet = json.loads((root / "out/sheets/SHEET001.json").read_text(encoding="utf-8"))
            self.assertEqual(inventory["properties"]["date1904"], "1")
            self.assertEqual(len(sheet["cells"]), 3)
            self.assertEqual(sheet["cells"][0]["value"], "제목")
            self.assertEqual(sheet["cells"][1]["cachedRaw"], "3")
            self.assertEqual(sheet["cells"][1]["formula"], "1+2")
            self.assertTrue(sheet["cells"][2]["missingFormulaCache"])


if __name__ == "__main__":
    unittest.main()
