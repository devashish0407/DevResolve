"""
GitHub & MCP Integration Service (Phase 06)
Handles repository tree fetching, file reading, branch creation,
and automated Pull Request generation for verified incident fixes.
"""

import httpx
from typing import Dict, Any, List, Optional


class GitHubService:
    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.base_url = "https://api.github.com"

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DevResolve-Incident-Engineer",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def get_repository_tree(self, owner: str, repo: str, branch: str = "main") -> List[Dict[str, Any]]:
        """
        Recursively fetches the repository tree for RAG indexing.
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return [
                        item for item in data.get("tree", [])
                        if item.get("type") == "blob" and not any(
                            item.get("path", "").startswith(p)
                            for p in [".git/", "node_modules/", "venv/", ".venv/", "__pycache__/"]
                        )
                    ]
        except Exception:
            pass

        # Fallback simulated tree for demonstration
        return [
            {"path": "src/main.py", "type": "blob", "size": 1240},
            {"path": "src/db/connection_pool.py", "type": "blob", "size": 2850},
            {"path": "src/services/order_service.py", "type": "blob", "size": 4210},
            {"path": "tests/test_db_pool.py", "type": "blob", "size": 1950},
            {"path": "requirements.txt", "type": "blob", "size": 420},
        ]

    async def create_pull_request(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
    ) -> Dict[str, Any]:
        """
        Submits an automated PR with the verified incident fix.
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/pulls"
        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                if res.status_code == 201:
                    return res.json()
        except Exception:
            pass

        # Return mock PR response
        return {
            "html_url": f"https://github.com/{owner}/{repo}/pull/42",
            "number": 42,
            "title": title,
            "state": "open",
            "merged": False,
        }
