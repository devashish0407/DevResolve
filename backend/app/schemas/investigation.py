"""
Incident Investigation & Agent Pydantic Schemas
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AgentStep(BaseModel):
    step_id: str
    phase: str  # retrieve, analyze, inspect, hypothesize, fix, test, report
    title: str
    status: str  # pending, in_progress, completed, failed
    detail: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class CodeEvidence(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    code_snippet: str
    similarity_score: float
    relevance_reason: str


class InvestigationState(BaseModel):
    conversation_id: uuid.UUID
    project_id: uuid.UUID
    current_phase: str
    confidence_score: float = 0.0
    symptoms: List[str] = []
    suspected_files: List[str] = []
    identified_root_cause: Optional[str] = None
    proposed_fix_patch: Optional[str] = None
    test_results: Optional[Dict[str, Any]] = None
    steps: List[AgentStep] = []


class InvestigationTriggerRequest(BaseModel):
    conversation_id: uuid.UUID
    project_id: uuid.UUID
    error_log: str
    context_notes: Optional[str] = None
    auto_test: bool = True
