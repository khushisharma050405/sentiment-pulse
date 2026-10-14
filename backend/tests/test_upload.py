import io
import json
import openpyxl
from PIL import Image, ImageDraw
import pypdf
import pytest
from app.file_extractor import is_tesseract_available


def test_upload_unauthenticated(client):
    files = [("files", ("test.txt", io.BytesIO(b"Hello world"), "text/plain"))]
    r = client.post("/api/upload", files=files)
    assert r.status_code == 401


def test_upload_empty_file(client, token):
    h = {"Authorization": f"Bearer {token}"}
    files = [("files", ("empty.txt", io.BytesIO(b""), "text/plain"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_upload_oversize_file(client, token):
    h = {"Authorization": f"Bearer {token}"}
    # 5 MB + 1 KB
    big_data = b"x" * (5 * 1024 * 1024 + 1024)
    files = [("files", ("large.txt", io.BytesIO(big_data), "text/plain"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 413
    assert "5 mb limit" in r.json()["detail"].lower()


def test_upload_fake_extension(client, token):
    h = {"Authorization": f"Bearer {token}"}
    # Text content disguised with .png extension
    fake_png = b"Not a PNG image at all!"
    files = [("files", ("fake.png", io.BytesIO(fake_png), "image/png"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 400
    assert "magic bytes" in r.json()["detail"].lower() or "image" in r.json()["detail"].lower()


def test_upload_csv(client, token):
    h = {"Authorization": f"Bearer {token}"}
    csv_data = b"platform,text\nX,Love this product!\nReddit,Support was helpful\n"
    files = [("files", ("feed.csv", io.BytesIO(csv_data), "text/csv"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "table"
    assert len(res[0]["items"]) == 2
    assert res[0]["items"][0]["platform"] == "X"
    assert res[0]["items"][0]["text"] == "Love this product!"


def test_upload_tsv(client, token):
    h = {"Authorization": f"Bearer {token}"}
    tsv_data = b"platform\ttext\nInstagram\tBeautiful aesthetic and sleek UI!\n"
    files = [("files", ("feed.tsv", io.BytesIO(tsv_data), "text/tab-separated-values"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "table"
    assert res[0]["items"][0]["platform"] == "Instagram"


def test_upload_xlsx(client, token):
    h = {"Authorization": f"Bearer {token}"}
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["platform", "text", "extra_col"])
    ws.append(["Facebook", "Great community feedback today!", "123"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    files = [("files", ("posts.xlsx", buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "table"
    assert len(res[0]["items"]) == 1
    assert res[0]["items"][0]["platform"] == "Facebook"
    assert res[0]["items"][0]["text"] == "Great community feedback today!"


def test_upload_txt(client, token):
    h = {"Authorization": f"Bearer {token}"}
    txt_data = b"First post on line one\nSecond post on line two\n"
    files = [("files", ("notes.txt", io.BytesIO(txt_data), "text/plain"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "text"
    assert len(res[0]["items"]) == 2
    assert res[0]["items"][0]["text"] == "First post on line one"


def test_upload_json(client, token):
    h = {"Authorization": f"Bearer {token}"}
    payload = json.dumps([
        {"platform": "X", "text": "Json tweet format test"},
        {"platform": "Reddit", "text": "Another post in json list"}
    ]).encode("utf-8")
    files = [("files", ("data.json", io.BytesIO(payload), "application/json"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "text"
    assert len(res[0]["items"]) == 2
    assert res[0]["items"][0]["platform"] == "X"


def test_upload_pdf(client, token):
    h = {"Authorization": f"Bearer {token}"}
    # Create simple PDF in memory using pypdf
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    buf.seek(0)

    files = [("files", ("document.pdf", buf, "application/pdf"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "pdf"


@pytest.mark.skipif(not is_tesseract_available(), reason="Tesseract OCR not installed on host")
def test_upload_image_ocr(client, token):
    h = {"Authorization": f"Bearer {token}"}
    # Create test image with text and UI noise
    img = Image.new("RGB", (600, 200), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 30), "Sentiment Pulse is awesome and fast!", fill=(0, 0, 0))
    d.text((20, 80), "1,240 Likes   Reply", fill=(100, 100, 100))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    files = [("files", ("screenshot.png", buf, "image/png"))]
    r = client.post("/api/upload", files=files, headers=h)
    assert r.status_code == 200
    res = r.json()
    assert len(res) == 1
    assert res[0]["type"] == "image"
    assert len(res[0]["items"]) >= 1
    # Check that UI noise like "Likes" or "Reply" was cleaned out and core text kept
    extracted_text = res[0]["items"][0]["text"]
    assert "Sentiment Pulse" in extracted_text or "awesome" in extracted_text.lower()
    assert "Likes" not in extracted_text
    assert "Reply" not in extracted_text


@pytest.mark.skipif(not is_tesseract_available(), reason="Tesseract OCR not installed on host")
def test_screenshot_upload_edit_and_score(client, token):
    h = {"Authorization": f"Bearer {token}"}
    with open("/Users/khushisharma/Downloads/sentiment-pulse/sample_screenshot.png", "rb") as f:
        img_bytes = f.read()

    files = [("files", ("sample_screenshot.png", io.BytesIO(img_bytes), "image/png"))]
    upload_res = client.post("/api/upload", files=files, headers=h)
    assert upload_res.status_code == 200
    extracted = upload_res.json()
    assert len(extracted) == 1
    assert extracted[0]["type"] == "image"
    assert len(extracted[0]["items"]) == 1

    item = extracted[0]["items"][0]
    # Verify noise was removed and caption was extracted
    assert "Likes" not in item["text"]
    assert "Reposts" not in item["text"]
    assert "Translate post" not in item["text"]

    # Edit the text and change platform (simulating user review in UI)
    edited_text = item["text"] + " Truly exceptional service."
    edited_platform = "Instagram"

    batch_payload = {"posts": [{"platform": edited_platform, "text": edited_text}]}
    score_res = client.post("/api/sentiment/batch", json=batch_payload)
    assert score_res.status_code == 200
    scored = score_res.json()
    assert len(scored["results"]) == 1
    assert scored["results"][0]["platform"] == "Instagram"
    assert scored["results"][0]["label"] == "Positive"
    assert scored["results"][0]["score"] > 0
    assert "Instagram" in scored["summary"]["by_platform"]

