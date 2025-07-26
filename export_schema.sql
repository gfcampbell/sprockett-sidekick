-- Export complete schema for new project instances
-- Run this in Supabase Dashboard SQL Editor to get clean schema

-- Get all table definitions
SELECT 
    schemaname,
    tablename,
    'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'VARCHAR(' || character_maximum_length || ')'
            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
            WHEN data_type = 'integer' THEN 'INTEGER'
            WHEN data_type = 'bigint' THEN 'BIGINT'
            WHEN data_type = 'text' THEN 'TEXT'
            WHEN data_type = 'boolean' THEN 'BOOLEAN'
            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMP WITH TIME ZONE'
            WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
            WHEN data_type = 'uuid' THEN 'UUID'
            ELSE UPPER(data_type)
        END ||
        CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE 
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ', '
        ORDER BY ordinal_position
    ) || ');' as create_statement
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT LIKE '%_old%'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Get all constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    'ALTER TABLE ' || tc.table_name || ' ADD CONSTRAINT ' || tc.constraint_name || ' ' ||
    CASE tc.constraint_type
        WHEN 'PRIMARY KEY' THEN 'PRIMARY KEY (' || string_agg(kcu.column_name, ', ') || ')'
        WHEN 'FOREIGN KEY' THEN 'FOREIGN KEY (' || string_agg(kcu.column_name, ', ') || ') REFERENCES ' || ccu.table_name || '(' || string_agg(ccu.column_name, ', ') || ')'
        WHEN 'UNIQUE' THEN 'UNIQUE (' || string_agg(kcu.column_name, ', ') || ')'
        WHEN 'CHECK' THEN cc.check_clause
    END || ';' as constraint_statement
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name NOT LIKE '%_old%'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause, ccu.table_name
ORDER BY tc.table_name, tc.constraint_type;

-- Get all indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    'CREATE INDEX ' || indexname || ' ON ' || tablename || ' (' || 
    string_agg(column_name, ', ') || ');' as index_statement
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename NOT LIKE '%_old%'
  AND indexname NOT LIKE '%_pkey'  -- Skip primary key indexes
GROUP BY schemaname, tablename, indexname
ORDER BY tablename, indexname;

-- Get all views
SELECT 
    schemaname,
    viewname,
    'CREATE OR REPLACE VIEW ' || viewname || ' AS ' || definition as view_statement
FROM pg_views 
WHERE schemaname = 'public'
ORDER BY viewname;

-- Get all functions/triggers
SELECT 
    routine_name,
    'CREATE OR REPLACE FUNCTION ' || routine_name || '() RETURNS ' || data_type || ' AS $$ ' || routine_definition || ' $$ LANGUAGE ' || external_language || ';' as function_statement
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;