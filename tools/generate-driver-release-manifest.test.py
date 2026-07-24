#!/usr/bin/env python3

import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "tools" / "generate-driver-release-manifest.py"


class GenerateDriverReleaseManifestTest(unittest.TestCase):
    def test_generates_manifest_without_fingerprint_revisions(self):
        with tempfile.TemporaryDirectory(prefix="gonavi-release-manifest-test-") as tmp:
            tmpdir = Path(tmp)
            assets_dir = tmpdir / "drivers"
            (assets_dir / "MacOS").mkdir(parents=True)
            (assets_dir / "Linux").mkdir(parents=True)
            (assets_dir / "Windows").mkdir(parents=True)

            fixtures = {
                assets_dir / "MacOS" / "clickhouse-driver-agent-darwin-arm64": b"darwin-binary",
                assets_dir / "Linux" / "clickhouse-driver-agent-linux-amd64": b"linux-binary",
                assets_dir / "Windows" / "clickhouse-driver-agent-windows-amd64.exe": b"MZfake-binary",
                assets_dir / "Windows" / "mongodb-driver-agent-v1-windows-amd64.exe": b"MZfake-mongodb-v1",
                assets_dir / "Windows" / "mongodb-driver-agent-v2-windows-amd64.exe": b"MZfake-mongodb-v2",
            }
            for path, content in fixtures.items():
                path.write_bytes(content)
                os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)

            output = tmpdir / "manifest.json"
            proc = subprocess.run(
                ["python3", str(SCRIPT), "--assets-dir", str(assets_dir), "--output", str(output)],
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True,
            )

            self.assertIn("asset count: 5", proc.stdout)
            manifest = json.loads(output.read_text(encoding="utf-8"))
            assets = manifest["assets"]
            self.assertEqual(assets["clickhouse-driver-agent-darwin-arm64"]["revision"], "")
            self.assertEqual(assets["clickhouse-driver-agent-linux-amd64"]["revision"], "")
            self.assertEqual(assets["clickhouse-driver-agent-windows-amd64.exe"]["revision"], "")
            self.assertEqual(assets["mongodb-driver-agent-v1-windows-amd64.exe"]["driver"], "mongodb")
            self.assertEqual(assets["mongodb-driver-agent-v1-windows-amd64.exe"]["platform"], "windows/amd64")
            self.assertEqual(assets["mongodb-driver-agent-v1-windows-amd64.exe"]["revision"], "")
            self.assertEqual(assets["mongodb-driver-agent-v2-windows-amd64.exe"]["driver"], "mongodb")
            self.assertTrue(assets["clickhouse-driver-agent-windows-amd64.exe"]["sha256"])
            self.assertGreater(assets["clickhouse-driver-agent-windows-amd64.exe"]["size"], 0)


if __name__ == "__main__":
    unittest.main()
