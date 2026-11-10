#!/usr/bin/env python3
"""
PromptGuard CLI Tool
Run: python3 cli.py "Your prompt here"
"""
import json
import sys
from prompt_guard.scanner import PromptGuard

def main():
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Explain prompt injection attacks and defenses."
    policy_name = sys.argv[2] if len(sys.argv) > 2 else "standard"
    
    guard = PromptGuard(policy=policy_name)
    result = guard.scan(prompt)
    print(json.dumps(result.to_dict(), indent=2))

if __name__ == "__main__":
    main()
