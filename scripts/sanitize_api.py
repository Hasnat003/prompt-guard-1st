#!/usr/bin/env python3
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from prompt_guard.sanitizer import sanitize_prompt

if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else ""
    result = sanitize_prompt(prompt)
    print(json.dumps(result))
