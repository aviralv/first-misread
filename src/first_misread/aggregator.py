"""Finding aggregation and deduplication."""

from __future__ import annotations

from difflib import SequenceMatcher

from first_misread.models import AggregatedFinding, Finding, PersonaResult

OVERLAP_THRESHOLD = 0.6
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _passages_overlap(a: str, b: str) -> bool:
    """Check if two passages overlap above threshold."""
    ratio = SequenceMatcher(None, a.lower(), b.lower()).ratio()
    return ratio >= OVERLAP_THRESHOLD


def _highest_severity(*severities: str) -> str:
    return min(severities, key=lambda s: SEVERITY_ORDER.get(s, 99))


def aggregate_findings(results: list[PersonaResult]) -> list[AggregatedFinding]:
    """Deduplicate and aggregate findings across persona results."""
    aggregated: list[AggregatedFinding] = []

    for result in results:
        for finding in result.findings:
            merged = False
            for agg in aggregated:
                if _passages_overlap(finding.passage, agg.passage):
                    agg.personas.append(result.persona)
                    agg.descriptions.append({
                        "persona": result.persona,
                        "what_happened": finding.what_happened,
                    })
                    agg.severity = _highest_severity(agg.severity, finding.severity)
                    merged = True
                    break

            if not merged:
                aggregated.append(
                    AggregatedFinding(
                        passage=finding.passage,
                        location=finding.location,
                        severity=finding.severity,
                        personas=[result.persona],
                        descriptions=[{
                            "persona": result.persona,
                            "what_happened": finding.what_happened,
                        }],
                    )
                )

    aggregated.sort(
        key=lambda a: (SEVERITY_ORDER.get(a.severity, 99), -len(a.personas))
    )
    return aggregated
