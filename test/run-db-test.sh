#!/bin/sh
# Recria o banco local de teste e roda os testes do setup.sql
cd "$(dirname "$0")/.."
P="psql -h /tmp -p 54322 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "drop database if exists threads" -c "create database threads" >/dev/null 2>&1
$P -d threads -f test/supabase-shim.sql >/dev/null 2>&1
$P -d threads -f supabase/setup.sql >/dev/null 2>&1 || { echo "setup.sql falhou"; $P -d threads -f supabase/setup.sql 2>&1 | grep ERROR; exit 1; }
$P -d threads -f supabase/setup.sql >/dev/null 2>&1 || { echo "setup.sql falhou na 2a vez"; exit 1; }
$P -d threads -f test/db-test.sql 2>&1 | grep -E "NOTICE:  ok|ERROR|FALHOU|PASSARAM" | sed 's/^psql:[^ ]* //'
