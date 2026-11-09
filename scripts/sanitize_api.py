#!/usr/bin/env python3
import json
import sys
from prompt_guard.sanitizer import sanitize_prompt

if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else ""
    result = sanitize_prompt(prompt)
    print(json.dumps(result))
