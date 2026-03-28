"""Finding differ — compares findings across runs."""

from __future__ import annotations

from difflib import SequenceMatcher

from first_misread.models import AggregatedFinding, FindingDiff, RunRecord

OVERLAP_THRESHOLD = 0.6

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _passages_match(a: str, b: str) -> bool:
    """Check if two passages match above threshold."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= OVERLAP_THRESHOLD


def _find_match(
    finding: AggregatedFinding,
    candidates: list[AggregatedFinding],
) -> AggregatedFinding | None:
    """Find a matching finding in the candidate list."""
    for candidate in candidates:
        if _passages_match(finding.passage, candidate.passage):
            return candidate
    return None


def _compute_severity_change(
    current: str,
    parent: str,
) -> str | None:
    """Compute severity change direction."""
    c = SEVERITY_ORDER.get(current, 99)
    p = SEVERITY_ORDER.get(parent, 99)
    if c < p:
        return "escalated"
    elif c > p:
        return "de-escalated"
    return None


def _compute_run_streak(
    finding: AggregatedFinding,
    chain: list[RunRecord],
) -> int:
    """Count consecutive runs (from most recent backward) that flagged this passage."""
    streak = 0
    for record in reversed(chain):
        matched = _find_match(finding, record.findings)
        if matched:
            streak += 1
        else:
            break
    return streak + 1


def _was_previously_resolved(
    finding: AggregatedFinding,
    chain: list[RunRecord],
) -> bool:
    """Check if this finding was resolved in a previous run but appeared in an ancestor."""
    if len(chain) < 2:
        return False

    parent = chain[-1]
    parent_match = _find_match(finding, parent.findings)
    if parent_match:
        return False

    for record in chain[:-1]:
        if _find_match(finding, record.findings):
            return True
    return False


def diff_findings(
    current_findings: list[AggregatedFinding],
    chain: list[RunRecord],
) -> list[FindingDiff]:
    """Diff current findings against the chain history.

    Returns a list of FindingDiff with status:
    - new: not seen in any prior run
    - persists: matches a finding in the immediate parent
    - resolved: was in the parent but not in current
    - regressed: was resolved (absent in parent) but reappears from an ancestor
    """
    if not chain:
        return [
            FindingDiff(
                status="new",
                current_finding=f,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            )
            for f in current_findings
        ]

    parent = chain[-1]
    diffs: list[FindingDiff] = []
    matched_parent_indices: set[int] = set()

    for current in current_findings:
        parent_match = None
        for i, pf in enumerate(parent.findings):
            if i not in matched_parent_indices and _passages_match(current.passage, pf.passage):
                parent_match = pf
                matched_parent_indices.add(i)
                break

        if parent_match:
            diffs.append(FindingDiff(
                status="persists",
                current_finding=current,
                parent_finding=parent_match,
                severity_change=_compute_severity_change(current.severity, parent_match.severity),
                persona_count_change=len(current.personas) - len(parent_match.personas),
                run_streak=_compute_run_streak(current, chain),
            ))
        elif _was_previously_resolved(current, chain):
            diffs.append(FindingDiff(
                status="regressed",
                current_finding=current,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))
        else:
            diffs.append(FindingDiff(
                status="new",
                current_finding=current,
                parent_finding=None,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))

    for i, pf in enumerate(parent.findings):
        if i not in matched_parent_indices:
            diffs.append(FindingDiff(
                status="resolved",
                current_finding=None,
                parent_finding=pf,
                severity_change=None,
                persona_count_change=None,
                run_streak=0,
            ))

    return diffs
