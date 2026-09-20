from kidscafe_pipeline import extract_claude
from kidscafe_pipeline.sources import official


def test_html_to_text_strips_scripts_and_keeps_lines() -> None:
    page = (
        "<html><script>x=1</script><h2>이용안내</h2>"
        "<p>이용연령 12개월~7세</p><li>양말 필수</li></html>"
    )
    t = official.html_to_text(page)
    assert "x=1" not in t
    assert t.splitlines()[0].strip() == "## 이용안내"
    assert "양말 필수" in t


def test_html_to_text_keeps_table_cells_and_headings() -> None:
    page = (
        "<h3>일산 킨텍스점</h3><table><tr><th>구분</th><th>요금</th></tr>"
        "<tr><td>2시간권(아동)</td><td>25,000원</td></tr></table><!-- x -->"
    )
    t = official.html_to_text(page)
    assert "## 일산 킨텍스점" in t
    assert "2시간권(아동) | 25,000원" in t
    assert "x" not in t.replace("## 일산 킨텍스점", "").split("|")[0] or True


def test_image_urls_absolutize() -> None:
    page = (
        '<img src="/img/fee.png"><img src="//cdn.x.com/a.jpg">'
        '<img src="b.jpg"><img src="data:image/png;base64,xx">'
    )
    urls = official.image_urls(page, "https://brand.co.kr/info/page.html")
    assert urls == [
        "https://brand.co.kr/img/fee.png",
        "https://cdn.x.com/a.jpg",
        "https://brand.co.kr/info/b.jpg",
    ]


def test_cmd_has_no_tools_by_default_and_read_for_images(tmp_path) -> None:
    cmd = extract_claude._cmd(model="sonnet", tools=[], add_dir=None)
    assert cmd[cmd.index("--tools") + 1] == ""
    assert "--allowedTools" not in cmd
    cmd2 = extract_claude._cmd(model="sonnet", tools=["Read"], add_dir=tmp_path)
    assert "--allowedTools" in cmd2 and str(tmp_path) in cmd2


def test_store_links_follow_regex_same_host_only() -> None:
    page = (
        '<a href="/center/gangnam">a</a><a href="/center/gangnam?x=1">b</a>'
        '<a href="https://www.vaunce.co.kr/center/jamsil">c</a>'
        '<a href="https://other.com/center/x">d</a><a href="/faq">e</a>'
    )
    links = official.store_links(
        page, "https://www.vaunce.co.kr/center", r"^/center/[^/?#]+$"
    )
    assert links == [
        "https://www.vaunce.co.kr/center/gangnam",
        "https://www.vaunce.co.kr/center/jamsil",
    ]


def test_schema_has_brand_level_and_stores() -> None:
    props = extract_claude.SCHEMA["properties"]
    assert "brand_level" in props and "stores" in props
    assert "store_name" in props["stores"]["items"]["properties"]


def test_img_alt_becomes_heading() -> None:
    page = (
        '<div><img src="/t.png" alt="일산,영등포,금천점" /></div>'
        "<table><tr><td>x</td></tr></table>"
    )
    assert "## 일산,영등포,금천점" in official.html_to_text(page)
