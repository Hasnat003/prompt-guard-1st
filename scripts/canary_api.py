#!/usr/bin/env python3
import json
import sys
from prompt_guard.canary import inspect_llm_output, generate_canary_token

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--generate":
        token = generate_canary_token()
        print(json.dumps({"canary_token": token}))
        sys.exit(0)

    output_text = sys.argv[1] if len(sys.argv) > 1 else ""
    canary = sys.argv[2] if len(sys.argv) > 2 else ""
    sys_prompt = sys.argv[3] if len(sys.argv) > 3 else ""

    result = inspect_llm_output(output_text, canary, sys_prompt)
    print(json.dumps(result))
