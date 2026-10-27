"""
RAG Service (Phase 03)
AST-aware Code Chunking, Embedding Generation, pgvector Similarity & Full-Text Search.
"""

import ast
import re
from typing import List, Dict, Any, Optional
import numpy as np


class CodeChunk:
    def __init__(
        self,
        file_path: str,
        chunk_type: str,  # function, class, module_block
        name: str,
        start_line: int,
        end_line: int,
        content: str,
    ):
        self.file_path = file_path
        self.chunk_type = chunk_type
        self.name = name
        self.start_line = start_line
        self.end_line = end_line
        self.content = content


class RAGService:
    def __init__(self, openai_api_key: Optional[str] = None):
        self.openai_api_key = openai_api_key

    def chunk_python_code(self, file_path: str, source_code: str) -> List[CodeChunk]:
        """
        AST-aware chunker for Python code.
        Extracts standalone functions, class definitions, and top-level blocks
        preserving line numbers for accurate evidence attribution.
        """
        chunks: List[CodeChunk] = []
        lines = source_code.splitlines()

        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            # Fallback to sliding window line chunking for non-python / invalid syntax
            return self.chunk_text_sliding_window(file_path, source_code)

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                start = node.lineno
                end = getattr(node, "end_lineno", start + 20)
                snippet = "\n".join(lines[start - 1 : end])
                chunks.append(
                    CodeChunk(
                        file_path=file_path,
                        chunk_type="function",
                        name=node.name,
                        start_line=start,
                        end_line=end,
                        content=snippet,
                    )
                )
            elif isinstance(node, ast.ClassDef):
                start = node.lineno
                end = getattr(node, "end_lineno", start + 30)
                snippet = "\n".join(lines[start - 1 : end])
                chunks.append(
                    CodeChunk(
                        file_path=file_path,
                        chunk_type="class",
                        name=node.name,
                        start_line=start,
                        end_line=end,
                        content=snippet,
                    )
                )

        if not chunks:
            # If no functions or classes found, treat entire file or window as chunk
            chunks.append(
                CodeChunk(
                    file_path=file_path,
                    chunk_type="module",
                    name="main",
                    start_line=1,
                    end_line=len(lines),
                    content=source_code[:3000],
                )
            )

        return chunks

    def chunk_text_sliding_window(
        self, file_path: str, text: str, chunk_size: int = 40, overlap: int = 10
    ) -> List[CodeChunk]:
        """Sliding window fallback for markdown, yaml, js/ts, or logs."""
        lines = text.splitlines()
        chunks: List[CodeChunk] = []
        start = 0

        while start < len(lines):
            end = min(start + chunk_size, len(lines))
            snippet = "\n".join(lines[start:end])
            chunks.append(
                CodeChunk(
                    file_path=file_path,
                    chunk_type="text_block",
                    name=f"lines_{start+1}_{end}",
                    start_line=start + 1,
                    end_line=end,
                    content=snippet,
                )
            )
            start += chunk_size - overlap
            if end >= len(lines):
                break

        return chunks

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding vector (1536-dimensional).
        Uses OpenAI text-embedding-3-small if key is present,
        or deterministic normalized pseudo-embedding for local testing.
        """
        if self.openai_api_key:
            try:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=self.openai_api_key)
                response = await client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text[:4000],
                )
                return response.data[0].embedding
            except Exception:
                pass

        # Deterministic offline vector based on character hash distributions
        dim = 1536
        vec = np.zeros(dim, dtype=np.float32)
        words = re.findall(r"\w+", text.lower())
        for w in words:
            idx = abs(hash(w)) % dim
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def hybrid_score(
        self, vector_score: float, keyword_score: float, vector_weight: float = 0.7
    ) -> float:
        """
        Combines pgvector cosine similarity with text match BM25/trigram score.
        """
        return (vector_weight * vector_score) + ((1.0 - vector_weight) * keyword_score)
