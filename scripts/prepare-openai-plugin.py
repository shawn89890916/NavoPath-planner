"""Build the public-upload copy and audit the actual ZIP. Requires Pillow."""
from pathlib import Path
from datetime import datetime, timezone
from io import BytesIO
import argparse
import hashlib
import json
import re
import shutil
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "integrations/navopath-openai-plugin"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--require-ready", action="store_true", help="Fail while any submission gap remains")
args = parser.parse_args()
manifest = json.loads((SOURCE / "plugin.json").read_text(encoding="utf-8"))
version = manifest["version"]
assert re.fullmatch(r"\d+\.\d+\.\d+", version)
output = ROOT / "release-openai-plugin" / version
stage = output / manifest["name"]
(stage / "assets").mkdir(parents=True, exist_ok=True)
for name in ("plugin.json", "mcp.json"):
    shutil.copyfile(SOURCE / name, stage / name)
for name in ("logo.png", "logo-dark.png"):
    # The approved transparent white-front N already supports both backgrounds.
    shutil.copyfile(ROOT / "public/navopath-icon.png", stage / "assets" / name)
expected = {"plugin.json", "mcp.json", "assets/logo.png", "assets/logo-dark.png"}
archive = output / f"navopath-{version}-DRAFT.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
    for name in sorted(expected):
        bundle.write(stage / name, f"navopath/{name}")

checks = []
with zipfile.ZipFile(archive) as bundle:
    assert set(bundle.namelist()) == {f"navopath/{name}" for name in expected}, "Unexpected archive contents"
    assert bundle.testzip() is None
    package = json.loads(bundle.read("navopath/plugin.json"))
    mcp = json.loads(bundle.read("navopath/mcp.json"))
    extension = package["extensions"]["com.openai"]
    listing = extension["interface"]
    assert package["name"] == "navopath" and package["version"] == version
    assert len(listing["displayName"]) <= 30
    assert 0 < len(listing["shortDescription"]) <= 30
    assert 0 < len(listing["longDescription"]) <= 4000
    assert listing["category"] == "Productivity"
    assert listing["developerName"] == "Xiaoyang Chen"
    prompts = listing["defaultPrompt"]
    assert 1 <= len(prompts) <= 3 and len(set(prompts)) == len(prompts)
    assert all(0 < len(p) <= 128 and "\n" not in p and "@" not in p for p in prompts)
    assert "apps" not in package and "apps" not in extension and "hooks" not in extension
    assert not any(name.endswith(".app.json") for name in bundle.namelist())
    assert extension["publication"]["countries"] == []
    assert extension["review"]["commerce"] is False
    cases = extension["review"]["test_cases"]
    assert len(cases["positive"]) == 5 and len(cases["negative"]) == 3
    for case in cases["positive"]:
        assert all(isinstance(case[key], str) and case[key].strip() for key in ("description", "prompt", "tools_triggered", "expected_behavior"))
    for case in cases["negative"]:
        assert all(case[key].strip() for key in ("description", "prompt"))
    server = mcp["mcpServers"]["navopath"]
    assert server["url"] == "https://navopath-mcp.shawn89890916.workers.dev/mcp"
    assert server["type"] == "streamable-http" and not server.get("headers")
    auth = server["extensions"]["com.openai"]["auth"]
    assert auth["type"] == "oauth" and auth["client"]["mode"] == "dcr"
    assert set(auth["baseScopes"]) == {"openid", "email"}
    checks += ["Archive inventory and CRC", "Manifest identity and field lengths", "Five positive and three negative cases", "All-country and non-commerce declarations", "Remote OAuth configuration without app bindings, hooks or secrets"]
    icons = []
    for key in ("logo", "logoDark", "composerIcon", "composerIconDark"):
        name = listing[key].removeprefix("./")
        assert name in expected
        data = bundle.read(f"navopath/{name}")
        with Image.open(BytesIO(data)) as img:
            assert img.format == "PNG" and img.width == img.height
            assert 256 <= img.width <= 4096 and len(data) <= 5 * 1024 * 1024
            assert img.mode == "RGBA" and img.getextrema()[3][0] == 0
            assert img.getpixel((0, 0))[3] == 0
            icons.append({"field": key, "path": name, "dimensions": list(img.size), "bytes": len(data), "transparent": True})
    checks.append("PNG dimensions, transparency and contained icon references")
    text_payload = bundle.read("navopath/plugin.json").decode() + bundle.read("navopath/mcp.json").decode()
    assert not re.search(r"nvp_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]+\.eyJ|clientSecret|SUPABASE_SERVICE_ROLE_KEY", text_payload)
    checks.append("Package credential-pattern scan (not a complete security audit)")

state = json.loads((SOURCE / "submission-state.json").read_text(encoding="utf-8"))
gaps = list(state["gaps"])
for field in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
    if not listing.get(field):
        gaps.append({"id": field, "scope": "package", "detail": f"Missing verified public {field}"})
if not extension["review"].get("demo_recording_url"):
    gaps.append({"id": "demo_recording_url", "scope": "package", "detail": "A real host walkthrough and reviewer-accessible recording URL are required"})
report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "archive": str(archive), "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "package_structure": "passed", "submission_ready": not gaps,
    "checks": checks, "icons": icons, "evidence": state["evidence"],
    "review_cases": {"positive": 5, "negative": 3, "status": "Not run against a dedicated reviewer account"},
    "gaps": gaps,
}
(output / "readiness.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
lines = ["# NavoPath 插件准备报告", "", "状态：草稿；尚不可提交审核。" if gaps else "状态：材料检查完成，仍需在后台验收。", "", f"ZIP：`{archive.name}`", f"SHA-256：`{report['sha256']}`", "", "## 已通过的本地检查", ""]
lines += [f"- {check}" for check in checks]
lines += ["", "## 尚待完成", ""] + [f"- **{gap['id']}**（{gap['scope']}）：{gap['detail']}" for gap in gaps]
lines += ["", "5 个正向用例与 3 个负向用例已写入清单；均未在专用审核账户中执行。", "源代码测试、线上 OAuth 登录、后台扫描和公开审核属于不同验收步骤。", ""]
(output / "READINESS.md").write_text("\n".join(lines), encoding="utf-8")
print(json.dumps({"archive": str(archive), "sha256": report["sha256"], "local_checks": len(checks), "submission_ready": not gaps, "remaining_gaps": len(gaps)}, ensure_ascii=False))
if args.require_ready and gaps:
    raise SystemExit(2)
