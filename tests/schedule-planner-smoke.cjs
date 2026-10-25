'use strict';
const assert=require('node:assert/strict');
const planner=require('../schedule-planner.js');
const plan=(options)=>planner.build({mode:'range',start:'2026-11-03',end:'2026-12-31',
 weekdays:[2,3],intervalWeeks:1,startTime:'09:00',endTime:'11:00',...options});
const dates=plan();
assert.equal(dates.length,18);
assert.deepEqual(dates.slice(0,4),['2026-11-03','2026-11-04','2026-11-10','2026-11-11']);
assert.equal(dates.at(-1),'2026-12-30');
assert(dates.every(x=>[2,3].includes(planner.parse(x).getDay())));
assert.deepEqual(plan({intervalWeeks:2}).slice(0,4),['2026-11-03','2026-11-04','2026-11-17','2026-11-18']);
assert.deepEqual(planner.build({mode:'count',start:'2026-11-03',startTime:'09:00',endTime:'11:00',visits:5,rhythm:7}),
 ['2026-11-03','2026-11-10','2026-11-17','2026-11-24','2026-12-01']);
assert.equal(planner.addDays('2026-12-31',-30),'2026-12-01');
assert.equal(planner.addDays('2026-10-25',7),'2026-11-01');
// Test across daylight saving transitions, including February/leap years.
assert.equal(planner.addDays('2027-03-27',2),'2027-03-29');
assert.equal(planner.addDays('2028-02-28',1),'2028-02-29');
assert.throws(()=>plan({weekdays:[]}),/Wochentag/);
assert.throws(()=>plan({start:'2026-12-31',end:'2026-11-03'}),/vor/);
assert.throws(()=>plan({intervalWeeks:5}),/Wochenrhythmus/);
assert.throws(()=>plan({start:'2026-11-31'}),/Ungültiges/);
assert.throws(()=>plan({startTime:'12:00',endTime:'09:00'}),/Start-/);
assert.throws(()=>plan({end:'2029-02-01'}),/zwei Jahre/);
assert.throws(()=>plan({start:'2026-01-01',end:'2027-12-31',weekdays:[1,2,3,4,5]}),/104/);
console.log('SCHEDULE PLANNER PASS: Tue+Wed 2 months, week intervals, DST/leap, 30-day reminders and input limits');
