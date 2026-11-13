// Guards against the app writing a column the database does not have (Hockey hit this
// with athletes.sprint_10_date and audit_log). Compares the app's mappings with
// supabase/schema.sql, the schema the Baseball Supabase project is created from.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {services} from './support.js';

const sql=fs.readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
function columns(table){
  const m=sql.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(m,`table ${table} in schema.sql`);
  return new Set(m[1].split(/,(?![^(]*\))/).map(s=>s.trim().split(/\s+/)[0]).filter(Boolean));
}

test('every athlete field the app saves exists in the athletes table',()=>{
  const {api}=services();
  const cols=columns('athletes');
  for(const col of [...Object.values(api.DB_FIELDS),'updated_by']) assert.ok(cols.has(col),`athletes.${col}`);
});

test('every Trackman field the importer produces exists in trackman_pitches',()=>{
  const {api}=services();
  const cols=columns('trackman_pitches');
  const {rows}=api.parseTrackmanCSV('Date,PitchUID,Pitcher,Batter,TaggedPitchType,RelSpeed,SpinRate,InducedVertBreak,HorzBreak,Extension,RelHeight,ExitSpeed,Angle,Distance,HitSpinRate\n2026-10-01,u,"P, A","B, C",Fastball,90,2200,15,-8,6,5.8,95,20,350,2000','x.csv');
  for(const col of [...Object.keys(rows[0]),'created_by']) assert.ok(cols.has(col),`trackman_pitches.${col}`);
});

test('audit_log has the columns the app writes and the Change History page reads',()=>{
  const cols=columns('audit_log');
  for(const col of ['athlete_id','athlete_name','action','changed_fields','changed_by','changed_at']) assert.ok(cols.has(col),`audit_log.${col}`);
});

test('kpi_history has the columns the app writes',()=>{
  const cols=columns('kpi_history');
  for(const col of ['athlete_id','athlete_name','metric_key','test_date','value','source']) assert.ok(cols.has(col),`kpi_history.${col}`);
});

test('schema keeps every table behind RLS and the photo bucket private',()=>{
  for(const t of ['athletes','test_sessions','kpi_history','trackman_pitches','audit_log']) assert.match(sql,new RegExp(`'${t}'`),`${t} in RLS loop`);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/values \('athlete-photos','athlete-photos', false\)/);
  assert.doesNotMatch(sql,/service_role|to anon/i);
});
