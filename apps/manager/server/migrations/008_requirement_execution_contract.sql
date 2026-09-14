ALTER TABLE requirements ADD COLUMN execution_contract jsonb;

CREATE OR REPLACE FUNCTION manager_requirement_content(r requirements) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'title', r.title, 'description', r.description, 'project', r.project,
    'scope', r.scope, 'risk', r.risk, 'acceptanceCriteria', r.acceptance_criteria,
    'dependencyRefs', r.dependency_refs, 'evidenceRefs', r.evidence_refs,
    'executionContract', r.execution_contract
  );
$$;
