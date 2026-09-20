from kidscafe_pipeline import extract_claude
from kidscafe_pipeline.sources import official


def test_html_to_text_strips_scripts_and_keeps_lines() -> None:
    page = (
        "<html><script>x=1</script><h2>이용안내</h2>"
        "<p>이용연령 12개월~7세</p><li>양말 필수</li></html>"
    )
    t = official.html_to_text(page)
    assert "x=1" not in t
    assert t.splitlines()[0].strip() == "이용안내"
    assert "양말 필수" in t


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
    cmd = extract_claude._cmd("p", model="sonnet", tools=[], add_dir=None)
    assert cmd[cmd.index("--tools") + 1] == ""
    assert "--allowedTools" not in cmd and cmd[-1] == "p"
    cmd2 = extract_claude._cmd("p", model="sonnet", tools=["Read"], add_dir=tmp_path)
    assert "--allowedTools" in cmd2 and str(tmp_path) in cmd2
