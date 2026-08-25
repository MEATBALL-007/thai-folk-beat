"""
Builds the progress report (report/progress-report.html) and prints it to PDF
with headless Chrome.

Run: npm run report

Fonts and screenshots are embedded as data URIs so the HTML is a single
self-contained file — it renders identically on any machine, and the PDF does
not depend on the reader having Thai fonts installed.
"""

import base64
import os
import subprocess
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "report")
HTML_PATH = os.path.join(OUT_DIR, "progress-report.html")
PDF_PATH = os.path.join(OUT_DIR, "progress-report.pdf")
SHOTS = os.path.join(ROOT, "design-reference", "verification")

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def data_uri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def font_face(family, weight, files):
    """One @font-face per subset so Thai and Latin both resolve."""
    css = []
    for path in files:
        if not os.path.exists(path):
            continue
        css.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%s;"
            "src:url(%s) format('woff2');font-display:block;}"
            % (family, weight, data_uri(path, "font/woff2"))
        )
    return "".join(css)


def shot(name):
    p = os.path.join(SHOTS, name)
    return data_uri(p, "image/png") if os.path.exists(p) else ""


def fonts_css():
    fs = lambda *p: os.path.join(ROOT, "node_modules", "@fontsource", *p)
    return "".join([
        font_face("Sarabun", 400, [
            fs("sarabun", "files", "sarabun-thai-400-normal.woff2"),
            fs("sarabun", "files", "sarabun-latin-400-normal.woff2"),
        ]),
        font_face("Sarabun", 700, [
            fs("sarabun", "files", "sarabun-thai-700-normal.woff2"),
            fs("sarabun", "files", "sarabun-latin-700-normal.woff2"),
        ]),
        font_face("Kanit", 700, [
            fs("kanit", "files", "kanit-thai-700-normal.woff2"),
            fs("kanit", "files", "kanit-latin-700-normal.woff2"),
        ]),
    ])


SCREENS = [
    ("01-title.png", "หน้าเริ่มเกม", "ใช้อาร์ตจริงจากผู้ออกแบบทั้งหมด ปุ่มไม้มีตัวอักษรไทยในภาพ"),
    ("02-region-select.png", "เลือกภูมิภาค", "เปิดเฉพาะภาคอีสาน อีก 3 ภาคขึ้นป้าย “เร็วๆ นี้” และกดไม่ได้"),
    ("03-song-select.png", "เลือกเพลง", "การ์ดหมุนได้ แสดง BPM จำนวนโน้ต และคะแนนสูงสุด"),
    ("04-comic.png", "การ์ตูนเล่าที่มา", "คำบรรยายไทยเขียนครบแล้ว รอภาพจากผู้ออกแบบ"),
    ("10-loading.png", "หน้าโหลด", "แถบความคืบหน้าจริง พร้อมวงกลม 4 สีแทน 4 เลนของเกม"),
    ("05-settings.png", "ตั้งค่า", "เสียง ดนตรี ความละเอียด ปรับดีเลย์ และความเร็วโน้ต"),
    ("06-gameplay.png", "หน้าเล่นเกม", "4 เลน = 4 เครื่องดนตรี มีชื่อกำกับใต้แต่ละเลน"),
    ("07-result.png", "สรุปผล", "นับคะแนนขึ้น บันทึกสถิติ และบอกผลผ่าน/ไม่ผ่าน"),
]

PHASES = [
    ("1", "โครงสร้างพื้นฐาน (Vite + TypeScript + PixiJS)", "เสร็จ"),
    ("2", "ระบบเสียง — สังเคราะห์เพลงเอง 4 เครื่องดนตรี", "เสร็จ"),
    ("3", "ระบบเล่นเกม — ตัดสินจังหวะ คอมโบ แพ้/ชนะ", "เสร็จ"),
    ("4", "หน้าสรุปผล + บันทึกคะแนนสูงสุด", "เสร็จ"),
    ("5", "หน้าเมนูทั้งหมด (7 หน้าจอ)", "เสร็จ"),
    ("6", "ระบบจัดการภาพ + รองรับภาพที่ยังไม่มา", "เสร็จ"),
    ("7", "แพ็กเป็นไฟล์ .exe สำหรับ Windows", "ติดเครื่องมือ (ดูหัวข้อ 6)"),
    ("8", "เก็บรายละเอียดภาพและเอฟเฟกต์", "เสร็จ"),
]

TESTS = [
    ("เสียงกับโน้ตตรงกันหรือไม่", "ตรงกัน คลาดเคลื่อนเฉลี่ย 0.96 มิลลิวินาที", "ตรวจครบทั้ง 2 เพลง"),
    ("เล่นจบเพลงได้จริงหรือไม่", "เล่นจบ 62.6 วินาที ได้ผล CLEARED", "โน้ตครบ 150 ตัว ไม่มีตกหล่น"),
    ("จังหวะเพี้ยนสะสมหรือไม่", "ไม่เพี้ยน — กดล่วงหน้าคงที่ 70 มิลลิวินาที ตลอด 62 วินาที ยังเข้า 147/150",
     "ถ้านาฬิกาเพี้ยน โน้ตท้ายเพลงจะหลุดหมด"),
    ("ระบบให้คะแนนถูกต้องหรือไม่", "ผ่านการตรวจอัตโนมัติ 29 ข้อ", "ครอบคลุมช่วงตัดสิน คอมโบ ตัวคูณ และเงื่อนไขแพ้"),
    ("เล่นด้วยเมาส์ได้หรือไม่", "ได้ ทั้งคีย์บอร์ดและคลิก/แตะ", "ทดสอบแล้วทั้งสองทาง"),
    ("ปรับขนาดหน้าต่างแล้วภาพเพี้ยนหรือไม่", "ไม่เพี้ยน คงสัดส่วน 16:9 เสมอ", "ทดสอบถึงจอกว้างพิเศษ"),
]


def build_html():
    today = date.today()
    th_year = today.year + 543
    months = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
              "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
    datestr = "%d %s %d" % (today.day, months[today.month], th_year)

    screens_html = []
    for fname, title, caption in SCREENS:
        uri = shot(fname)
        if not uri:
            continue
        screens_html.append(
            '<figure class="shot"><img src="%s" alt="%s"/>'
            '<figcaption><b>%s</b><span>%s</span></figcaption></figure>'
            % (uri, title, title, caption)
        )

    phase_rows = "".join(
        '<tr><td class="num">%s</td><td>%s</td><td class="%s">%s</td></tr>'
        % (n, name, "ok" if status == "เสร็จ" else "warn", status)
        for n, name, status in PHASES
    )

    test_rows = "".join(
        "<tr><td>%s</td><td class=\"ok\">%s</td><td class=\"note\">%s</td></tr>" % t
        for t in TESTS
    )

    return """<!doctype html>
<html lang="th"><head><meta charset="utf-8"/>
<title>THAI FOLK BEAT — รายงานความคืบหน้า</title>
<style>
%(fonts)s
*{box-sizing:border-box}
@page{size:A4;margin:14mm 13mm}
body{font-family:'Sarabun',sans-serif;color:#2e2418;margin:0;font-size:11.2pt;line-height:1.65}
h1,h2,h3{font-family:'Kanit',sans-serif;font-weight:700;color:#1f7a6c;margin:0}
.cover{background:#ffc976;border:6px solid #2dad9c;border-radius:14px;padding:26px 30px;margin-bottom:22px}
.cover h1{font-size:31pt;color:#17594f;line-height:1.15}
.cover .sub{font-size:14pt;color:#995520;margin-top:6px;font-weight:700}
.cover .meta{margin-top:16px;font-size:10.5pt;color:#5b4326}
.cover .meta b{color:#2e2418}
h2{font-size:15pt;margin:26px 0 10px;padding-bottom:6px;border-bottom:3px solid #ffc976}
h2 .n{color:#f16436;margin-inline-end:8px}
p{margin:0 0 10px}
.lead{background:#fff6e4;border-inline-start:5px solid #f16436;padding:12px 16px;border-radius:0 10px 10px 0;margin-bottom:14px}
table{width:100%%;border-collapse:collapse;margin:8px 0 14px;font-size:10.4pt}
th{background:#2dad9c;color:#fff;text-align:start;padding:8px 10px;font-family:'Kanit',sans-serif}
td{padding:7px 10px;border-bottom:1px solid #efe2cc;vertical-align:top}
tr:nth-child(even) td{background:#fffaf0}
td.num{font-weight:700;color:#f16436;width:34px;text-align:center}
td.ok{color:#1f7a3f;font-weight:700}
td.warn{color:#b4541c;font-weight:700}
td.note{color:#6b5334;font-size:9.6pt}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.shot{margin:0;break-inside:avoid}
.shot img{width:100%%;border:3px solid #995520;border-radius:8px;display:block}
.shot figcaption{font-size:9.6pt;padding-top:5px;line-height:1.45}
.shot figcaption b{display:block;color:#17594f;font-family:'Kanit',sans-serif}
.shot figcaption span{color:#6b5334}
.cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:10px 0 16px}
.card{background:#fff6e4;border:2px solid #e8d3ac;border-radius:10px;padding:12px 14px}
.card .k{font-family:'Kanit',sans-serif;font-size:19pt;color:#f16436;line-height:1.1}
.card .v{font-size:9.6pt;color:#6b5334;margin-top:3px}
.tech{background:#fffaf0;border:2px solid #efe2cc;border-radius:10px;padding:14px 18px;margin-bottom:12px;break-inside:avoid}
.tech h3{font-size:11.5pt;color:#995520;margin-bottom:5px}
.tech p{margin:0;font-size:10.4pt}
ul{margin:6px 0 12px;padding-inline-start:20px}
li{margin-bottom:5px}
.pagebreak{break-before:page}
.foot{margin-top:22px;padding-top:10px;border-top:2px solid #ffc976;font-size:9.4pt;color:#8a7355}
code{background:#f4ead6;padding:1px 5px;border-radius:4px;font-size:9.6pt}
</style></head><body>

<div class="cover">
  <h1>THAI FOLK BEAT</h1>
  <div class="sub">เกมจังหวะดนตรีพื้นบ้านอีสาน — รายงานความคืบหน้า</div>
  <div class="meta">
    <b>ประเภท:</b> เกมจังหวะ (rhythm game) 4 เลน &nbsp;·&nbsp;
    <b>เทคโนโลยี:</b> TypeScript, PixiJS, Web Audio API &nbsp;·&nbsp;
    <b>วันที่:</b> %(date)s
  </div>
</div>

<div class="lead">
<b>สรุปโดยย่อ —</b> เกมเล่นได้ครบวงจรตั้งแต่หน้าเริ่มจนถึงหน้าสรุปผลแล้ว
มีเพลงให้เล่น 2 เพลง คือ <b>หมอลำ</b> และ <b>เซิ้ง</b> ซึ่งโปรแกรม
<b>สังเคราะห์เสียงดนตรีขึ้นเองทั้งหมด</b> โดยไม่ใช้ไฟล์เพลงสำเร็จรูป
ทำงานเสร็จแล้ว 7 จาก 8 ขั้นตอน เหลือเพียงการแพ็กเป็นไฟล์ <code>.exe</code>
ซึ่งติดที่เครื่องมือของเครื่องคอมพิวเตอร์ ไม่ใช่ตัวเกม
</div>

<div class="cards">
  <div class="card"><div class="k">2 เพลง</div><div class="v">หมอลำ 150 โน้ต · เซิ้ง 212 โน้ต</div></div>
  <div class="card"><div class="k">7 หน้าจอ</div><div class="v">ครบทั้งเมนูและหน้าเล่นเกม</div></div>
  <div class="card"><div class="k">0.96 มิลลิวินาที</div><div class="v">ความคลาดเคลื่อนของจังหวะ</div></div>
</div>

<h2><span class="n">1.</span>เกมนี้คืออะไร</h2>
<p>ผู้เล่นกดปุ่มให้ตรงจังหวะเมื่อโน้ตตกลงมาถึงเส้น โดยแต่ละเลนแทนเครื่องดนตรีอีสาน 1 ชิ้น ได้แก่
<b>กลอง</b>, <b>โปงลาง</b>, <b>พิณ</b> และ <b>แคน</b>
เสียงของแต่ละเลนจึงเป็นเสียงเครื่องดนตรีนั้นจริง ๆ ทำให้ผู้เล่นได้ยินและจดจำเสียงเครื่องดนตรีพื้นบ้านไปพร้อมกับการเล่น</p>
<p>ก่อนเริ่มเล่นแต่ละเพลงจะมีการ์ตูนเล่าที่มาของเพลงนั้น เพื่อให้ผู้เล่นรู้จักวัฒนธรรมเบื้องหลังดนตรี ไม่ใช่แค่กดปุ่มตามจังหวะ</p>

<h2><span class="n">2.</span>ความคืบหน้าตามแผน</h2>
<table><thead><tr><th style="width:34px">#</th><th>ขั้นตอน</th><th style="width:150px">สถานะ</th></tr></thead>
<tbody>%(phases)s</tbody></table>

<h2><span class="n">3.</span>หน้าจอทั้งหมดในเกม</h2>
<div class="grid">%(screens)s</div>

<div class="pagebreak"></div>
<h2><span class="n">4.</span>จุดเด่นทางเทคนิค</h2>

<div class="tech"><h3>สังเคราะห์เสียงดนตรีขึ้นเอง ไม่ใช้ไฟล์เพลง</h3>
<p>เสียงเครื่องดนตรีทั้ง 4 ชิ้นสร้างขึ้นด้วย Web Audio API แบบเรียลไทม์ ตั้งแต่เสียงกลองที่ไล่ความถี่ลง
ไปจนถึงเสียงแคนที่ใช้คลื่นสองชุดเหลื่อมกันพร้อมเสียงสั่น ทำให้เกมทำงานได้โดยไม่ต้องรอไฟล์เพลง
และหากภายหลังมีไฟล์เพลงจริง ก็เปลี่ยนมาใช้ได้ทันทีโดยไม่ต้องแก้โครงสร้างโปรแกรม</p></div>

<div class="tech"><h3>โน้ตกับเสียงมาจากข้อมูลชุดเดียวกัน จึงตรงกันเสมอ</h3>
<p>ปัญหาที่พบบ่อยในเกมจังหวะคือเสียงกับโน้ตค่อย ๆ เคลื่อนออกจากกัน โครงงานนี้แก้ที่ต้นเหตุ
ด้วยการเก็บทำนองไว้เป็นข้อมูลชุดเดียว แล้วให้ทั้งเสียงและโน้ตอ่านจากข้อมูลนั้น
จึง <b>ไม่มีทางไม่ตรงกัน</b> โดยหลักการ ไม่ใช่ด้วยการปรับจูนทีหลัง</p></div>

<div class="tech"><h3>ใช้นาฬิกาของระบบเสียงเป็นตัวอ้างอิงเวลา</h3>
<p>เวลาทั้งหมดในเกมอ้างอิงนาฬิกาของระบบเสียง ไม่ใช่นาฬิกาการวาดภาพ เพราะนาฬิกาการวาดภาพ
จะคลาดเคลื่อนสะสมเมื่อเครื่องทำงานหนัก จากการวัดจริงพบว่านาฬิกาการวาดภาพคลาดไปถึง
<b>6.8 วินาทีภายในเวลาเพียง 7.6 วินาที</b> ขณะที่นาฬิกาของระบบเสียงยังตรง</p></div>

<div class="tech"><h3>ระบบภาพที่ทำงานต่อได้แม้ภาพยังไม่เสร็จ</h3>
<p>เมื่อไฟล์ภาพใดยังไม่ถูกส่งมา โปรแกรมจะสร้างภาพแทนที่พร้อมป้ายชื่อไฟล์ให้อัตโนมัติ
เกมจึงเปิดเล่นได้ตลอดเวลาระหว่างรอผู้ออกแบบ และเมื่อวางไฟล์จริงลงไปก็ใช้งานได้ทันทีโดยไม่ต้องแก้โปรแกรม</p></div>

<h2><span class="n">5.</span>ผลการทดสอบ</h2>
<table><thead><tr><th>สิ่งที่ตรวจ</th><th style="width:210px">ผล</th><th style="width:190px">หมายเหตุ</th></tr></thead>
<tbody>%(tests)s</tbody></table>

<h2><span class="n">6.</span>สิ่งที่ยังเหลือ</h2>
<ul>
<li><b>ไฟล์ .exe สำหรับ Windows</b> — ตัวเกมและการตั้งค่าพร้อมแล้ว แต่เครื่องที่ใช้พัฒนายังไม่ได้ติดตั้ง
เครื่องมือแปลงโปรแกรมของ Microsoft (C++ Build Tools) จึงยังสร้างไฟล์ไม่ได้
<b>ไม่ใช่ปัญหาของตัวเกม</b> และติดตั้งเพิ่มเพียงครั้งเดียวก็สร้างได้ทันที
ระหว่างนี้เปิดเล่นผ่านเบราว์เซอร์ได้ตามปกติ</li>
<li><b>ภาพการ์ตูนเล่าที่มา 8 ภาพ</b> — คำบรรยายภาษาไทยเขียนครบแล้ว รอเฉพาะภาพ</li>
<li><b>ภาพตัวละคร</b> — ยังไม่ได้รับ ระบบเตรียมรองรับไว้แล้ว</li>
</ul>

<h2><span class="n">7.</span>วิธีเปิดเดโม</h2>
<p>ดับเบิลคลิกไฟล์ <code>เปิดเกม.bat</code> ในโฟลเดอร์โครงงาน เบราว์เซอร์จะเปิดเกมขึ้นมาเอง</p>
<ul>
<li>ที่หน้าเริ่มเกม ให้ <b>คลิก 1 ครั้งก่อน</b> เพราะเบราว์เซอร์จะยังไม่เล่นเสียงจนกว่าผู้ใช้จะคลิก</li>
<li>ปุ่มที่ใช้เล่น: <b>D F J K</b> หรือปุ่มลูกศร &nbsp;·&nbsp; จะใช้เมาส์คลิกที่วงกลมก็ได้</li>
<li>กด <b>F11</b> เพื่อเล่นแบบเต็มจอ</li>
</ul>

<div class="foot">THAI FOLK BEAT — รายงานความคืบหน้า · จัดทำเมื่อ %(date)s</div>
</body></html>""" % {
        "fonts": fonts_css(),
        "date": datestr,
        "phases": phase_rows,
        "screens": "".join(screens_html),
        "tests": test_rows,
    }


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    html = build_html()
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote %s (%.1f MB)" % (HTML_PATH, os.path.getsize(HTML_PATH) / 1e6))

    chrome = next((p for p in CHROME_CANDIDATES if os.path.exists(p)), None)
    if not chrome:
        print("no Chrome/Edge found — HTML written, PDF skipped", file=sys.stderr)
        return 1

    cmd = [
        chrome,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        "--print-to-pdf=" + PDF_PATH,
        "file:///" + HTML_PATH.replace("\\", "/"),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if os.path.exists(PDF_PATH):
        print("wrote %s (%.2f MB)" % (PDF_PATH, os.path.getsize(PDF_PATH) / 1e6))
        return 0

    print("PDF not produced. rc=%s\n%s\n%s" % (res.returncode, res.stdout, res.stderr), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
