import sys
from pathlib import Path
import pytest

# Add .ai-workspace/scripts to sys.path
scripts_dir = Path(__file__).parent.parent / ".ai-workspace" / "scripts"
sys.path.insert(0, str(scripts_dir))

import importlib.util
spec = importlib.util.spec_from_file_location("transpile_skills", scripts_dir / "transpile-skills.py")
transpile_skills = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transpile_skills)

validate_name = transpile_skills.validate_name
validate_description = transpile_skills.validate_description
validate_compatibility = transpile_skills.validate_compatibility
validate_license = transpile_skills.validate_license
validate_metadata = transpile_skills.validate_metadata
validate_allowed_tools = transpile_skills.validate_allowed_tools
parse_skill = transpile_skills.parse_skill


def test_validate_name():
    assert validate_name("my-skill", "my-skill") == []
    assert len(validate_name("My-Skill", "My-Skill")) > 0  # uppercase invalid
    assert len(validate_name("my--skill", "my--skill")) > 0  # consecutive hyphens
    assert len(validate_name("-my-skill", "-my-skill")) > 0  # leading hyphen
    assert len(validate_name("my-skill", "different-dir")) > 0  # mismatch dir name


def test_validate_description():
    assert validate_description("Valid description under 1024 chars") == []
    assert len(validate_description("")) > 0
    assert len(validate_description("a" * 1025)) > 0


def test_validate_compatibility():
    assert validate_compatibility(None) == []
    assert validate_compatibility("Requires Node.js >= 18") == []
    assert len(validate_compatibility(123)) > 0
    assert len(validate_compatibility("x" * 501)) > 0


def test_validate_license():
    assert validate_license(None) == []
    assert validate_license("MIT") == []
    assert len(validate_license(123)) > 0


def test_validate_metadata():
    assert validate_metadata(None) == []
    assert validate_metadata({"author": "test", "version": "1.0"}) == []
    assert len(validate_metadata("not-a-dict")) > 0
    assert len(validate_metadata({"author": 123})) > 0  # non-string value


def test_validate_allowed_tools():
    assert validate_allowed_tools(None) == []
    assert validate_allowed_tools("Bash(git:*) Read") == []
    assert len(validate_allowed_tools(["Read", "Write"])) > 0


def test_parse_skill_valid(tmp_path):
    skill_dir = tmp_path / "sample-skill"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text(
        """---
name: sample-skill
description: A sample skill for testing.
compatibility: Requires Node.js >= 18
license: MIT
metadata:
  author: test-author
allowed-tools: Bash(git:*)
---

# Sample Skill

Instructions go here.
"""
    )

    skill, errors = parse_skill(skill_dir)
    assert errors == []
    assert skill is not None
    assert skill.name == "sample-skill"
    assert skill.compatibility == "Requires Node.js >= 18"
    assert skill.license == "MIT"
    assert skill.metadata == {"author": "test-author"}
    assert skill.allowed_tools == "Bash(git:*)"
