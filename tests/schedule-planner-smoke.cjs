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

// Lead-time regression: short contracts, configurable units, calendar months, disabled and invalid values.
const reminder=overrides=>planner.reminderSettings({
 start:'2026-11-02',end:'2026-11-16',selection:'auto',customValue:1,customUnit:'days',...overrides
});
assert.deepEqual([reminder().date,reminder().reminderDays,reminder().adjusted],['2026-11-14',2,false]);
assert.equal(reminder({selection:'1'}).date,'2026-11-15');
assert.equal(reminder({selection:'2'}).date,'2026-11-14');
assert.equal(reminder({selection:'custom',customValue:4,customUnit:'days'}).date,'2026-11-12');
assert.equal(reminder({selection:'custom',customValue:1,customUnit:'weeks'}).date,'2026-11-09');
assert.equal(reminder({selection:'custom',customValue:1,customUnit:'months'}).date,'2026-11-02');
assert.equal(reminder({selection:'30'}).date,'2026-11-02');
assert.equal(reminder({selection:'30'}).adjusted,true);
assert.equal(reminder({selection:'0'}).date,'2026-11-16');
assert.equal(reminder({selection:'-1'}).disabled,true);
assert.equal(planner.reminderSettings({start:'2027-01-01',end:'2027-03-31',selection:'custom',customValue:1,customUnit:'months'}).date,'2027-02-28');
assert.equal(planner.reminderSettings({start:'2028-01-01',end:'2028-03-31',selection:'custom',customValue:1,customUnit:'months'}).date,'2028-02-29');
assert.equal(planner.reminderSettings({start:'2026-11-02',end:'2026-11-03',selection:'auto'}).reminderDays,1);
assert.equal(planner.reminderSettings({start:'2026-11-02',end:'2026-11-02',selection:'auto'}).reminderDays,0);
assert.throws(()=>reminder({selection:'custom',customValue:0}),/ganze Zahl/);
assert.throws(()=>reminder({selection:'custom',customValue:1.5}),/ganze Zahl/);
assert.throws(()=>reminder({selection:'custom',customValue:25,customUnit:'months'}),/maximal/);
assert.throws(()=>reminder({selection:'custom',customValue:1,customUnit:'nonsense'}),/maximal/);
assert.throws(()=>reminder({end:'2026-10-28'}),/vor/);
console.log('SCHEDULE PLANNER PASS: Tue+Wed 2 months, week intervals, DST/leap, custom day/week/month and short-contract reminders, input limits');
