"""
FastAPI REST API Service for PromptGuard.
Fulfills Part 7.1 & Part 7.4 of the Master Project Blueprint.

Run with:
    uvicorn api.main:app --host 0.0.0.0 --port 8000
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from typing import Optional, List, Dict, Any
from prompt_guard.scanner import PromptGuard
from prompt_guard.risk.policy import POLICY_PRESETS

# Simple standalone JSON API handler that also runs on standard library if fastapi is not installed
guard = PromptGuard()

try:
    from fastapi import FastAPI, HTTPException, status
    from pydantic import BaseModel

    app = FastAPI(
        title="PromptGuard Security API",
        version="1.0.0",
        description="Independent Prompt Security Scanner & Protection Middleware REST Gateway",
    )

    class ScanRequest(BaseModel):
        prompt: str
        policy: Optional[str] = "standard"

    @app.post("/v1/scan")
    def scan_endpoint(req: ScanRequest):
        if req.policy in POLICY_PRESETS:
            guard.set_policy(POLICY_PRESETS[req.policy])
        result = guard.scan(req.prompt)
        return result.to_dict()

    @app.get("/v1/health")
    def health_check():
        return {"status": "healthy", "service": "PromptGuard", "version": "1.0.0"}

except ImportError:
    # Fallback to standard library http server if running in bare Python
    app = None


if __name__ == "__main__":
    if app:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        print("PromptGuard API module loaded. Install 'fastapi' and 'uvicorn' to launch ASGI server.")
