-- 唯一索引必须先暴露存量重复。重复数据属于业务归属冲突，不能在迁移中静默合并。
DO $$
DECLARE duplicate_groups integer;
BEGIN
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT source_ref
    FROM requirements
    WHERE source = 'assessor' AND source_ref <> ''
    GROUP BY source_ref
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION 'Assessor 需求存在 %组重复 source_ref，不能创建唯一索引', duplicate_groups
      USING HINT = '请先人工确认每组重复需求的保留记录，并修正或归档其余记录后重试迁移';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_requirements_assessor_source_ref
  ON requirements (source, source_ref)
  WHERE source='assessor' AND source_ref <> '';
